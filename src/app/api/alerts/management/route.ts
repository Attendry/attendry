/**
 * Alert Management API
 * 
 * This API endpoint provides alert management functionality including:
 * - Alert rule management
 * - Alert acknowledgment and resolution
 * - Alert analytics and reporting
 * - Alert correlation analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  alertingSystem,
  AlertRule,
  Alert,
  AlertAnalytics,
  AlertCorrelation
} from '@/lib/alerting-system';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const metric = url.searchParams.get('metric');

    switch (action) {
      case 'rules':
        const rules = alertingSystem.getAllRules();
        return NextResponse.json({
          success: true,
          data: { rules }
        });

      case 'alerts':
        const alerts = alertingSystem.getAlerts({ 
          status: status || undefined, 
          severity: severity || undefined, 
          metric: metric || undefined 
        });
        return NextResponse.json({
          success: true,
          data: { alerts }
        });

      case 'analytics':
        const analytics = alertingSystem.getAnalytics();
        return NextResponse.json({
          success: true,
          data: analytics
        });

      case 'correlations':
        const correlations = alertingSystem.getCorrelations();
        return NextResponse.json({
          success: true,
          data: { correlations }
        });

      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            initialized: true,
            rulesCount: alertingSystem.getAllRules().length,
            activeAlerts: alertingSystem.getAlerts({ status: 'active' }).length,
            lastUpdate: new Date().toISOString()
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: rules, alerts, analytics, correlations, status'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[alert-management] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, rule, ruleId, updates, alertId, acknowledgedBy, resolvedBy } = body;

    switch (action) {
      case 'add-rule':
        if (!rule) {
          return NextResponse.json({
            success: false,
            error: 'Rule is required for adding alert rule'
          }, { status: 400 });
        }

        alertingSystem.addRule(rule as AlertRule);
        
        return NextResponse.json({
          success: true,
          message: 'Alert rule added successfully'
        });

      case 'update-rule':
        if (!ruleId || !updates) {
          return NextResponse.json({
            success: false,
            error: 'Rule ID and updates are required for updating alert rule'
          }, { status: 400 });
        }

        const updated = alertingSystem.updateRule(ruleId, updates);
        if (!updated) {
          return NextResponse.json({
            success: false,
            error: 'Alert rule not found'
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          message: 'Alert rule updated successfully'
        });

      case 'acknowledge-alert':
        if (!alertId || !acknowledgedBy) {
          return NextResponse.json({
            success: false,
            error: 'Alert ID and acknowledged by are required'
          }, { status: 400 });
        }

        const acknowledged = await alertingSystem.acknowledgeAlert(alertId, acknowledgedBy);
        if (!acknowledged) {
          return NextResponse.json({
            success: false,
            error: 'Alert not found or not active'
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          message: 'Alert acknowledged successfully'
        });

      case 'resolve-alert':
        if (!alertId || !resolvedBy) {
          return NextResponse.json({
            success: false,
            error: 'Alert ID and resolved by are required'
          }, { status: 400 });
        }

        const resolved = await alertingSystem.resolveAlert(alertId, resolvedBy);
        if (!resolved) {
          return NextResponse.json({
            success: false,
            error: 'Alert not found or already resolved'
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          message: 'Alert resolved successfully'
        });

      case 'test-rule':
        if (!rule) {
          return NextResponse.json({
            success: false,
            error: 'Rule is required for testing'
          }, { status: 400 });
        }

        // Test rule with sample metrics
        const testMetrics = {
          api_response_time: 6000,
          error_rate: 0.15,
          cache_hit_rate: 0.65,
          memory_usage: 0.9,
          cpu_usage: 0.8,
          total_requests: 1000
        };

        // Temporarily add rule for testing
        const testRule = { ...rule, id: `test_${Date.now()}` } as AlertRule;
        alertingSystem.addRule(testRule);
        
        // Evaluate with test metrics
        await alertingSystem.evaluateMetrics(testMetrics);
        
        // Get any alerts that were triggered
        const testAlerts = alertingSystem.getAlerts().filter(alert => 
          alert.ruleId === testRule.id
        );
        
        // Remove test rule
        alertingSystem.removeRule(testRule.id);
        
        return NextResponse.json({
          success: true,
          message: 'Rule test completed',
          data: {
            triggered: testAlerts.length > 0,
            alerts: testAlerts
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: add-rule, update-rule, acknowledge-alert, resolve-alert, test-rule'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[alert-management] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const ruleId = url.searchParams.get('ruleId');

    if (!ruleId) {
      return NextResponse.json({
        success: false,
        error: 'Rule ID is required for deletion'
      }, { status: 400 });
    }

    const deleted = alertingSystem.removeRule(ruleId);
    if (!deleted) {
      return NextResponse.json({
        success: false,
        error: 'Alert rule not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Alert rule deleted successfully'
    });
  } catch (error) {
    console.error('[alert-management] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
