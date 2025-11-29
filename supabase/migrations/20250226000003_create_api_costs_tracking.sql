-- API Costs Tracking
-- Comprehensive cost tracking for all API calls (Firecrawl, Gemini, Google CSE, etc.)
-- Extends existing discovery_cost_tracking with per-call granularity

CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service TEXT NOT NULL, -- 'firecrawl', 'gemini', 'google_cse', 'linkedin', 'email_discovery'
  feature TEXT, -- 'speaker_enrichment', 'event_search', 'contact_research', etc.
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0, -- Cost in USD (supports micro-costs)
  tokens_used INTEGER, -- For LLM services
  api_calls INTEGER DEFAULT 1, -- Number of API calls made
  cache_hit BOOLEAN DEFAULT false, -- Whether this was served from cache
  cache_savings_usd DECIMAL(10,6) DEFAULT 0, -- Savings from cache (if cache_hit)
  metadata JSONB DEFAULT '{}', -- Additional context (query, model, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Partitioning by date for better query performance
  cost_date DATE
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_api_costs_user_date ON api_costs(user_id, cost_date DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_service_date ON api_costs(service, cost_date DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_feature_date ON api_costs(feature, cost_date DESC) WHERE feature IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_costs_created_at ON api_costs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_cost_date ON api_costs(cost_date DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_api_costs_user_service_date ON api_costs(user_id, service, cost_date DESC);

-- Function to set cost_date from created_at
CREATE OR REPLACE FUNCTION set_api_costs_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cost_date IS NULL THEN
    NEW.cost_date := DATE(NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set cost_date
CREATE TRIGGER set_api_costs_date_trigger
  BEFORE INSERT ON api_costs
  FOR EACH ROW
  EXECUTE FUNCTION set_api_costs_date();

-- Budget tracking table
CREATE TABLE IF NOT EXISTS budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_type TEXT NOT NULL, -- 'monthly', 'daily', 'per_feature'
  budget_limit_usd DECIMAL(10,2) NOT NULL,
  current_spend_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  alert_threshold DECIMAL(5,2) DEFAULT 80.0, -- Percentage (80% = alert at 80% of budget)
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_at TIMESTAMPTZ,
  period_start DATE NOT NULL, -- Start of budget period
  period_end DATE NOT NULL, -- End of budget period
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for budget alerts
CREATE INDEX IF NOT EXISTS idx_budget_alerts_user ON budget_alerts(user_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_period ON budget_alerts(period_start, period_end);

-- Cost summary view (for dashboard)
CREATE OR REPLACE VIEW api_costs_summary AS
SELECT 
  user_id,
  service,
  feature,
  cost_date,
  COUNT(*) as call_count,
  SUM(cost_usd) as total_cost_usd,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
  SUM(cache_savings_usd) as total_savings_usd,
  SUM(tokens_used) as total_tokens
FROM api_costs
GROUP BY user_id, service, feature, cost_date;

-- Monthly cost summary view
CREATE OR REPLACE VIEW api_costs_monthly AS
SELECT 
  user_id,
  service,
  feature,
  DATE_TRUNC('month', cost_date) as month,
  COUNT(*) as call_count,
  SUM(cost_usd) as total_cost_usd,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
  SUM(cache_savings_usd) as total_savings_usd,
  SUM(tokens_used) as total_tokens
FROM api_costs
GROUP BY user_id, service, feature, DATE_TRUNC('month', cost_date);

-- RLS policies
ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API costs" ON api_costs
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service can insert API costs" ON api_costs
  FOR INSERT WITH CHECK (true);

-- Budget alerts RLS
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budget alerts" ON budget_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage budget alerts" ON budget_alerts
  FOR ALL USING (true);

-- Function to get monthly cost for user
CREATE OR REPLACE FUNCTION get_user_monthly_cost(
  p_user_id UUID,
  p_month DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  total_cost DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(cost_usd), 0)
  INTO total_cost
  FROM api_costs
  WHERE user_id = p_user_id
    AND DATE_TRUNC('month', cost_date) = DATE_TRUNC('month', p_month);
  
  RETURN total_cost;
END;
$$;

-- Function to check and send budget alerts
CREATE OR REPLACE FUNCTION check_budget_alerts(
  p_user_id UUID,
  p_month DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  alert_sent BOOLEAN,
  budget_type TEXT,
  current_spend DECIMAL(10,2),
  budget_limit DECIMAL(10,2),
  percentage_used DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  monthly_cost DECIMAL(10,2);
  budget_record RECORD;
  percentage DECIMAL(5,2);
BEGIN
  -- Get current monthly cost
  monthly_cost := get_user_monthly_cost(p_user_id, p_month);
  
  -- Check all active budgets for user
  FOR budget_record IN
    SELECT * FROM budget_alerts
    WHERE user_id = p_user_id
      AND period_start <= p_month
      AND period_end >= p_month
      AND alert_sent = false
  LOOP
    percentage := (monthly_cost / budget_record.budget_limit_usd) * 100;
    
    -- Check if threshold exceeded
    IF percentage >= budget_record.alert_threshold THEN
      -- Update alert status
      UPDATE budget_alerts
      SET alert_sent = true,
          alert_sent_at = NOW(),
          current_spend_usd = monthly_cost
      WHERE id = budget_record.id;
      
      -- Return alert info
      RETURN QUERY SELECT
        true as alert_sent,
        budget_record.budget_type,
        monthly_cost as current_spend,
        budget_record.budget_limit_usd as budget_limit,
        percentage as percentage_used;
    END IF;
  END LOOP;
  
  -- Return no alerts if none triggered
  RETURN QUERY SELECT false, NULL::TEXT, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL
  WHERE false;
END;
$$;

-- Grant permissions
GRANT SELECT ON api_costs TO authenticated;
GRANT SELECT ON api_costs_summary TO authenticated;
GRANT SELECT ON api_costs_monthly TO authenticated;
GRANT SELECT ON budget_alerts TO authenticated;

COMMENT ON TABLE api_costs IS 'Comprehensive cost tracking for all API calls. Tracks per-call costs with service, feature, and user attribution.';
COMMENT ON TABLE budget_alerts IS 'Budget limits and alert tracking for users. Alerts sent when spending exceeds threshold.';

