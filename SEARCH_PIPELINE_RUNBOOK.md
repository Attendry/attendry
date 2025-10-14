# Search Pipeline Runbook

## How to Reproduce

### Environment Setup

```bash
# 1. Install dependencies
npm install zod @opentelemetry/api

# 2. Set environment variables
export GOOGLE_CSE_KEY="your-cse-key"
export FIRECRAWL_API_KEY="your-firecrawl-key"
export GEMINI_API_KEY="your-gemini-key"
export REDIS_URL="redis://localhost:6379"
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-supabase-key"

# 3. Database setup
psql -d your_database -f setup-search-persistence.sql
```

### Running the Pipeline

```bash
# 1. Start the development server
npm run dev

# 2. Run evaluation harness
npm run test:search-evaluation

# 3. Run specific tests
npm run test:localisation
npm run test:deduplication
npm run test:ranking
```

### Seeds and Configuration

```bash
# 1. Load gold test queries
node scripts/load-gold-queries.js

# 2. Initialize cache tables
node scripts/init-cache-tables.js

# 3. Set up monitoring
node scripts/setup-monitoring.js
```

## Triage Checklist

### When Results Look Wrong

#### 1. Localisation Drift
```bash
# Check localisation violations
curl -X POST http://localhost:3000/api/debug/localisation \
  -H "Content-Type: application/json" \
  -d '{"query": "legal conference", "country": "FR"}'

# Expected: Only French results
# If German results appear:
# 1. Check LocalisationGuard.assertCountry() logs
# 2. Verify country constraints in SearchQueryBuilder
# 3. Check CSE parameters (gl, cr)
# 4. Review Firecrawl location settings
```

#### 2. Stale Cache
```bash
# Check cache status
curl -X GET http://localhost:3000/api/debug/cache/status

# Clear specific cache
curl -X DELETE http://localhost:3000/api/debug/cache/clear \
  -H "Content-Type: application/json" \
  -d '{"type": "qcache", "pattern": "query:legal*"}'

# Check cache TTLs
curl -X GET http://localhost:3000/api/debug/cache/ttl
```

#### 3. Provider Outage
```bash
# Check provider health
curl -X GET http://localhost:3000/api/debug/providers/health

# Test individual providers
curl -X POST http://localhost:3000/api/debug/providers/test \
  -H "Content-Type: application/json" \
  -d '{"provider": "cse", "query": "test"}'

# Check circuit breaker status
curl -X GET http://localhost:3000/api/debug/circuit-breakers
```

#### 4. Performance Issues
```bash
# Check SLO compliance
curl -X GET http://localhost:3000/api/debug/slo/status

# View recent metrics
curl -X GET http://localhost:3000/api/debug/metrics/recent

# Check slow queries
curl -X GET http://localhost:3000/api/debug/performance/slow-queries
```

#### 5. Budget Exceeded
```bash
# Check LLM budget status
curl -X GET http://localhost:3000/api/debug/budget/status

# View cost breakdown
curl -X GET http://localhost:3000/api/debug/budget/breakdown

# Check rate limits
curl -X GET http://localhost:3000/api/debug/rate-limits
```

### Debugging Commands

#### 1. Query Normalisation
```bash
# Test query normalisation
curl -X POST http://localhost:3000/api/debug/normalise \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Légal Conférence 2024",
    "country": "FR",
    "intent": "event"
  }'
```

#### 2. Deduplication
```bash
# Test deduplication
curl -X POST http://localhost:3000/api/debug/dedupe \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "title": "Legal Conference 2024",
        "venue": "Paris Convention Center",
        "starts_at": "2024-06-15T09:00:00Z",
        "source_url": "https://example.com/event1"
      },
      {
        "title": "Legal Conference 2024",
        "venue": "Paris Convention Center",
        "starts_at": "2024-06-15T09:00:00Z",
        "source_url": "https://example.com/event2"
      }
    ]
  }'
```

#### 3. Ranking
```bash
# Test ranking
curl -X POST http://localhost:3000/api/debug/rank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "legal conference",
    "country": "FR",
    "candidates": [
      {
        "url": "https://example.fr/event1",
        "title": "Legal Conference 2024",
        "snippet": "Annual legal conference in Paris"
      }
    ]
  }'
```

#### 4. Security Compliance
```bash
# Test URL compliance
curl -X POST http://localhost:3000/api/debug/security/check-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/event"}'

# Test PII detection
curl -X POST http://localhost:3000/api/debug/security/check-pii \
  -H "Content-Type: application/json" \
  -d '{"content": "Contact us at info@example.com or call +33 1 23 45 67 89"}'
```

### Monitoring and Alerts

#### 1. Key Metrics to Watch
- **Precision@5**: Should be ≥ 0.85
- **Localisation Accuracy**: Should be ≥ 0.99
- **P95 Latency**: Should be ≤ 2000ms
- **Error Rate**: Should be ≤ 0.1%
- **Cost per Query**: Should be ≤ 50 pence

#### 2. Alert Conditions
```yaml
alerts:
  - name: "Low Precision"
    condition: "precision_at_5 < 0.82"
    severity: "critical"
    
  - name: "Localisation Failure"
    condition: "localisation_accuracy < 0.99"
    severity: "critical"
    
  - name: "High Latency"
    condition: "p95_latency > 2000"
    severity: "warning"
    
  - name: "Budget Exceeded"
    condition: "cost_per_query > 50"
    severity: "warning"
    
  - name: "Provider Outage"
    condition: "provider_error_rate > 0.1"
    severity: "critical"
```

#### 3. Log Analysis
```bash
# Search for localisation violations
grep "localisation_violation" logs/search.log | jq '.'

# Search for budget violations
grep "budget_violation" logs/search.log | jq '.'

# Search for performance issues
grep "slow_query" logs/search.log | jq '.'

# Search for security violations
grep "security_violation" logs/search.log | jq '.'
```

### Recovery Procedures

#### 1. Localisation Drift Recovery
```bash
# 1. Check recent changes
git log --oneline -10

# 2. Verify country constraints
curl -X GET http://localhost:3000/api/debug/country-constraints

# 3. Clear affected cache
curl -X DELETE http://localhost:3000/api/debug/cache/clear \
  -H "Content-Type: application/json" \
  -d '{"type": "qcache", "country": "FR"}'

# 4. Re-run evaluation
npm run test:localisation
```

#### 2. Cache Corruption Recovery
```bash
# 1. Check cache integrity
curl -X GET http://localhost:3000/api/debug/cache/integrity

# 2. Clear corrupted entries
curl -X DELETE http://localhost:3000/api/debug/cache/clear \
  -H "Content-Type: application/json" \
  -d '{"type": "all", "corrupted": true}'

# 3. Rebuild cache
curl -X POST http://localhost:3000/api/debug/cache/rebuild
```

#### 3. Provider Outage Recovery
```bash
# 1. Check circuit breaker status
curl -X GET http://localhost:3000/api/debug/circuit-breakers

# 2. Reset circuit breaker
curl -X POST http://localhost:3000/api/debug/circuit-breakers/reset \
  -H "Content-Type: application/json" \
  -d '{"service": "cse"}'

# 3. Test provider
curl -X POST http://localhost:3000/api/debug/providers/test \
  -H "Content-Type: application/json" \
  -d '{"provider": "cse", "query": "test"}'
```

#### 4. Performance Degradation Recovery
```bash
# 1. Check resource usage
curl -X GET http://localhost:3000/api/debug/performance/resources

# 2. Clear slow queries
curl -X DELETE http://localhost:3000/api/debug/performance/clear-slow

# 3. Restart services
pm2 restart search-pipeline

# 4. Monitor recovery
curl -X GET http://localhost:3000/api/debug/performance/status
```

### Testing Procedures

#### 1. Pre-deployment Testing
```bash
# 1. Run full evaluation suite
npm run test:search-evaluation

# 2. Check SLO compliance
npm run test:slo-compliance

# 3. Run security tests
npm run test:security

# 4. Performance testing
npm run test:performance
```

#### 2. Post-deployment Validation
```bash
# 1. Smoke test
curl -X POST http://localhost:3000/api/events/search \
  -H "Content-Type: application/json" \
  -d '{"query": "legal conference", "country": "FR"}'

# 2. Check metrics
curl -X GET http://localhost:3000/api/debug/metrics/recent

# 3. Verify localisation
curl -X GET http://localhost:3000/api/debug/localisation/status
```

### Maintenance Tasks

#### 1. Daily
- Check SLO compliance
- Review error logs
- Monitor cost metrics
- Verify localisation accuracy

#### 2. Weekly
- Run full evaluation suite
- Review performance metrics
- Check cache hit rates
- Update gold test queries

#### 3. Monthly
- Review and update country constraints
- Analyze user feedback
- Optimize ranking weights
- Update security rules

### Emergency Contacts

- **On-call Engineer**: +1-555-0123
- **Search Team Lead**: +1-555-0124
- **Infrastructure Team**: +1-555-0125
- **Security Team**: +1-555-0126

### Escalation Procedures

1. **Level 1**: Localisation drift, cache issues
2. **Level 2**: Provider outages, performance issues
3. **Level 3**: Security violations, budget exceeded
4. **Level 4**: Complete system failure

### Documentation Links

- [Search Pipeline Architecture](./docs/search-pipeline.md)
- [Provider Capabilities](./docs/search-provider-capabilities.md)
- [Security Guidelines](./docs/security-compliance.md)
- [Performance Tuning](./docs/performance-tuning.md)
- [Troubleshooting Guide](./docs/troubleshooting.md)
