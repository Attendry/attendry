# Quick Reference Guide - Search Pipeline Optimization

## 🚀 Quick Start Commands

### System Health Check
```bash
# Get overall system health
curl http://localhost:3000/api/production/readiness?action=health

# Get detailed health checks
curl http://localhost:3000/api/production/readiness?action=health-checks

# Get system status
curl http://localhost:3000/api/production/readiness?action=status
```

### Performance Monitoring
```bash
# Get performance metrics
curl http://localhost:3000/api/production/readiness?action=performance

# Get SLA metrics
curl http://localhost:3000/api/production/readiness?action=sla

# Get monitoring dashboard
curl http://localhost:3000/api/production/readiness?action=dashboard
```

### Cache Management
```bash
# Get cache analytics
curl http://localhost:3000/api/cache/management?action=analytics

# Warm cache
curl -X POST http://localhost:3000/api/cache/management \
  -H "Content-Type: application/json" \
  -d '{"action": "warm_popular"}'

# Clear cache
curl -X DELETE http://localhost:3000/api/cache/management?action=clear
```

### Testing Commands
```bash
# Run comprehensive tests
curl -X POST http://localhost:3000/api/testing/integration \
  -H "Content-Type: application/json" \
  -d '{"action": "run-comprehensive"}'

# Run performance benchmarks
curl -X POST http://localhost:3000/api/testing/performance \
  -H "Content-Type: application/json" \
  -d '{"action": "run-comprehensive"}'

# Run load tests
curl -X POST http://localhost:3000/api/testing/integration \
  -H "Content-Type: application/json" \
  -d '{"action": "run-load-test"}'
```

## 🔧 Troubleshooting Commands

### High Response Times
```bash
# Check performance metrics
curl http://localhost:3000/api/testing/performance?action=results

# Check cache hit rates
curl http://localhost:3000/api/cache/management?action=analytics

# Warm cache
curl -X POST http://localhost:3000/api/cache/management \
  -H "Content-Type: application/json" \
  -d '{"action": "warm_popular"}'
```

### Circuit Breaker Issues
```bash
# Check circuit breaker status
curl http://localhost:3000/api/circuit-breaker/management

# Reset circuit breakers
curl -X POST http://localhost:3000/api/circuit-breaker/management \
  -H "Content-Type: application/json" \
  -d '{"action": "reset"}'
```

### Database Issues
```bash
# Check database pool metrics
curl http://localhost:3000/api/database/pool/management?action=metrics

# Warm database connections
curl -X POST http://localhost:3000/api/database/pool/management \
  -H "Content-Type: application/json" \
  -d '{"action": "warm"}'
```

## 📊 Key Metrics to Monitor

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Response Time | < 2s | > 3s | > 5s |
| Cache Hit Rate | > 80% | < 70% | < 50% |
| Error Rate | < 1% | > 2% | > 5% |
| CPU Usage | < 60% | > 70% | > 80% |
| Memory Usage | < 60% | > 70% | > 80% |
| Database Connections | < 80% | > 90% | > 95% |

## 🚨 Emergency Procedures

### System Down
1. Check system health: `curl http://localhost:3000/api/production/readiness?action=health`
2. Check circuit breakers: `curl http://localhost:3000/api/circuit-breaker/management`
3. Reset circuit breakers: `POST /api/circuit-breaker/management {"action": "reset"}`
4. Clear cache: `DELETE /api/cache/management?action=clear`

### Performance Issues
1. Check performance metrics: `curl http://localhost:3000/api/production/readiness?action=performance`
2. Warm cache: `POST /api/cache/management {"action": "warm_popular"}`
3. Warm database connections: `POST /api/database/pool/management {"action": "warm"}`
4. Check alerts: `curl http://localhost:3000/api/alerts/management?type=alerts`

### Cache Issues
1. Check cache status: `curl http://localhost:3000/api/cache/management?action=status`
2. Check cache analytics: `curl http://localhost:3000/api/cache/management?action=analytics`
3. Clear cache: `DELETE /api/cache/management?action=clear`
4. Warm cache: `POST /api/cache/management {"action": "warm_popular"}`

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] Performance benchmarks passing
- [ ] Production readiness report generated

### Post-Deployment
- [ ] System health validated
- [ ] Performance metrics monitored
- [ ] Cache warmed
- [ ] Monitoring started
- [ ] Smoke tests passed

## 🔍 Debug Information

### Get System Status
```bash
curl http://localhost:3000/api/production/readiness?action=status
```

### Get All Metrics
```bash
# Performance metrics
curl http://localhost:3000/api/testing/performance?action=results

# Cache metrics
curl http://localhost:3000/api/cache/management?action=analytics

# Database metrics
curl http://localhost:3000/api/database/pool/management?action=metrics

# Alert status
curl http://localhost:3000/api/alerts/management?type=alerts
```

### Generate Reports
```bash
# Production readiness report
curl -X POST http://localhost:3000/api/production/readiness \
  -H "Content-Type: application/json" \
  -d '{"action": "generate-report"}'

# Performance benchmark report
curl -X POST http://localhost:3000/api/testing/performance \
  -H "Content-Type: application/json" \
  -d '{"action": "run-comprehensive"}'
```

## 📞 Support Contacts

- **Development Team**: [Contact Information]
- **Operations Team**: [Contact Information]
- **Emergency Escalation**: [Contact Information]

## 📚 Additional Resources

- **Full Documentation**: `MASTER_PLAN_IMPLEMENTATION_DOCUMENTATION.md`
- **API Reference**: See documentation for complete API endpoint reference
- **Configuration Guide**: See documentation for detailed configuration options
- **Troubleshooting Guide**: See documentation for comprehensive troubleshooting procedures

---

**Last Updated**: January 2025
**Version**: 1.0
