# Gemini 2.5 Flash Standardization & New Event Pipeline Enablement Plan

## Executive Summary

This plan standardizes all Gemini AI services to use **Gemini 2.5 Flash** and enables the **New Event Pipeline** as the primary search pipeline. This will improve consistency, performance, and leverage the most advanced pipeline architecture.

## Current State Analysis

### Gemini Model Usage (Inconsistent)

| Service | Current Model | Status | Priority |
|---------|---------------|--------|----------|
| **Primary Services (Already 2.5 Flash)** | | | |
| `gemini-service.ts` | ✅ gemini-2.5-flash | Correct | - |
| `enhanced-orchestrator.ts` | ✅ gemini-2.5-flash | Correct | - |
| `enhanced-gemini-service.ts` | ✅ gemini-2.5-flash | Correct | - |
| `enhanced-search-service.ts` | ✅ gemini-2.5-flash | Correct | - |
| `events/search/route.ts` | ✅ gemini-2.5-flash | Correct | - |
| **Services Needing Updates** | | | |
| `event-pipeline/fallback.ts` | ❌ gemini-2.0-flash | Update needed | High |
| `optimized-ai-service.ts` | ❌ gemini-2.0-flash | Update needed | High |
| `chat/route.ts` | ❌ gemini-2.0-flash | Update needed | Medium |
| `profile/generate/route.ts` | ❌ gemini-2.0-flash-001 | Update needed | Medium |
| `events/speakers/route.ts` | ❌ gemini-1.5-pro | Update needed | Low |
| `admin/health/route.ts` | ❌ gemini-pro | Update needed | Low |
| **Test Scripts** | | | |
| `test-enhanced-search.js` | ❌ gemini-1.5-flash | Update needed | Low |

### Pipeline Status

| Pipeline | Status | Usage | Lines of Code |
|----------|--------|-------|---------------|
| **New Event Pipeline** | 🔴 Disabled | Feature-flagged | ~2,000 |
| **Enhanced Orchestrator** | ✅ Active | Primary production | ~2,800 |
| **Legacy Search** | ⚠️ Legacy | Still active | ~969 |

## Phase 1: Gemini 2.5 Flash Standardization

### 1.1 High Priority Updates (Core Services)

#### Update Event Pipeline Fallback
**File:** `src/lib/event-pipeline/fallback.ts`
**Current:** `gemini-2.0-flash`
**Target:** `gemini-2.5-flash`

```typescript
// Line 380: Update model path
const modelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.5-flash:generateContent';
```

#### Update Optimized AI Service
**File:** `src/lib/services/optimized-ai-service.ts`
**Current:** `gemini-2.0-flash`
**Target:** `gemini-2.5-flash`

```typescript
// Line 416: Update API URL
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
```

### 1.2 Medium Priority Updates (User-Facing Services)

#### Update Chat Service
**File:** `src/app/api/chat/route.ts`
**Current:** `gemini-2.0-flash`
**Target:** `gemini-2.5-flash`

```typescript
// Line 14: Update model
const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });
```

#### Update Profile Generation
**File:** `src/app/api/profile/generate/route.ts`
**Current:** `gemini-2.0-flash-001`
**Target:** `gemini-2.5-flash`

```typescript
// Line 149: Update model
model: "gemini-2.5-flash"
```

### 1.3 Low Priority Updates (Specialized Services)

#### Update Speakers Service
**File:** `src/app/api/events/speakers/route.ts`
**Current:** `gemini-1.5-pro`
**Target:** `gemini-2.5-flash`

```typescript
// Line 16: Update model
const LLM_MODEL = "gemini-2.5-flash"; // Standardized to 2.5 Flash
```

#### Update Admin Health Check
**File:** `src/app/api/admin/health/route.ts`
**Current:** `gemini-pro`
**Target:** `gemini-2.5-flash`

```typescript
// Line 297: Update model path
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
```

### 1.4 Test Script Updates

#### Update Test Script
**File:** `scripts/test-enhanced-search.js`
**Current:** `gemini-1.5-flash`
**Target:** `gemini-2.5-flash`

```javascript
// Line 167: Update model
model: 'gemini-2.5-flash'
```

### 1.5 Environment Variable Standardization

Create centralized model configuration:

```typescript
// src/config/ai-models.ts
export const AI_MODELS = {
  GEMINI_PRIMARY: 'gemini-2.5-flash',
  GEMINI_FALLBACK: 'gemini-2.0-flash', // For backward compatibility
  GEMINI_API_BASE: 'https://generativelanguage.googleapis.com/v1beta/models'
} as const;

export const getGeminiModelPath = (model: string = AI_MODELS.GEMINI_PRIMARY) => 
  `${AI_MODELS.GEMINI_API_BASE}/${model}:generateContent`;
```

## Phase 2: New Event Pipeline Enablement

### 2.1 Pipeline Configuration Updates

#### Update Default Configuration
**File:** `src/lib/event-pipeline/config.ts`

```typescript
// Update thresholds for production use
export const DEFAULT_PIPELINE_CONFIG: EventPipelineConfig = {
  thresholds: {
    prioritization: 0.6,      // Higher threshold for production quality
    confidence: 0.7,          // Higher confidence for production
    parseQuality: 0.5         // Higher parse quality for production
  },
  sources: {
    cse: true,                // Keep CSE enabled
    firecrawl: true,          // Keep Firecrawl enabled
    curated: true             // Enable curated sources for better coverage
  },
  limits: {
    maxCandidates: 100,       // Increase for better coverage
    maxExtractions: 20        // Increase for more results
  },
  timeouts: {
    discovery: 30000,         // 30s for comprehensive discovery
    prioritization: 15000,    // 15s for AI prioritization
    parsing: 10000            // 10s for content parsing
  }
};
```

### 2.2 Environment Configuration

#### Production Environment Variables
```bash
# Enable New Event Pipeline
ENABLE_NEW_PIPELINE=true

# Pipeline Configuration
PIPELINE_PRIORITIZATION_THRESHOLD=0.6
PIPELINE_CONFIDENCE_THRESHOLD=0.7
PIPELINE_PARSE_QUALITY_THRESHOLD=0.5
PIPELINE_MAX_CANDIDATES=100
PIPELINE_MAX_EXTRACTIONS=20

# Source Configuration
PIPELINE_ENABLE_CSE=true
PIPELINE_ENABLE_FIRECRAWL=true
PIPELINE_ENABLE_CURATED=true

# AI Model Configuration
GEMINI_MODEL_PATH=v1beta/models/gemini-2.5-flash:generateContent
```

### 2.3 Feature Flag Updates

#### Update Feature Flags
**File:** `src/config/flags.ts`

```typescript
export const FLAGS = {
  aiRankingEnabled: true,           // Enable AI ranking in new pipeline
  speakerExtractionEnabled: true,   // Enable speaker extraction (CRITICAL for New Pipeline)
  BYPASS_GEMINI_JSON_STRICT: false, // Use strict JSON parsing
  ALLOW_UNDATED: false,             // Keep date filtering
  RELAX_COUNTRY: false,             // Keep country filtering
  RELAX_DATE: false,                // Keep date filtering
  ENABLE_CURATION_TIER: true,       // Enable curated sources
  ENABLE_TLD_PREFERENCE: true,      // Enable TLD preference
  MAX_QUERY_TIERS: 3,
  MIN_KEEP_AFTER_PRIOR: 2,
  TBS_WINDOW_DAYS: 30,
  FIRECRAWL_LIMIT: 20               // Increase Firecrawl limit
};
```

### 2.4 Speaker Extraction & Session Parsing Configuration

#### New Event Pipeline Speaker/Session Features
The New Event Pipeline includes comprehensive speaker extraction and session parsing capabilities:

**Speaker Extraction Features:**
- **Multi-format Support**: Handles both string arrays and structured `SpeakerInfo` objects
- **Rich Metadata**: Extracts name, title, company, and bio information
- **Related Page Discovery**: Automatically finds speaker pages via enrichment links
- **LLM Enhancement**: Uses Gemini 2.5 Flash to enhance speaker data with structured output
- **Fallback Handling**: Graceful degradation when speaker extraction fails

**Session Parsing Features:**
- **Agenda Extraction**: Parses event sessions and agenda items
- **Structured Data**: Extracts session titles, descriptions, start/end times, and associated speakers
- **Multi-source Parsing**: Combines deterministic parsing with LLM enhancement
- **Related Link Processing**: Discovers and processes agenda/program pages

#### Enhanced Orchestrator Speaker/Session Features
The Enhanced Orchestrator also provides robust speaker and session capabilities:

**Speaker Extraction:**
- **Cheerio-based Parsing**: HTML parsing for speaker detection from multiple page structures
- **Normalization Functions**: `normalizeSpeaker()` and `parseSpeakerText()` for consistent formatting
- **Speaker Page Detection**: Automatically identifies speaker-related pages via URL patterns
- **Timeout Protection**: 10-second timeout for speaker extraction to prevent hanging

**Session Parsing:**
- **Session Normalization**: `normalizeSession()` function for consistent session data
- **Multi-format Support**: Handles various session data formats
- **Speaker-Session Linking**: Associates speakers with their sessions

#### Configuration for Speaker/Session Features

**Environment Variables for Speaker/Session Processing:**
```bash
# Speaker extraction configuration
SPEAKER_EXTRACTION_TIMEOUT=10000        # 10 seconds timeout
SPEAKER_PAGE_PATTERNS=speaker,talent,faculty,referenten,program.*speaker
ENABLE_SPEAKER_ENRICHMENT=true          # Enable related page discovery

# Session parsing configuration  
SESSION_PARSING_ENABLED=true            # Enable session extraction
AGENDA_EXTRACTION_ENABLED=true          # Enable agenda parsing
ENABLE_SESSION_SPEAKER_LINKING=true     # Link speakers to sessions

# Related page discovery
ENRICHMENT_LINK_KEYWORDS=speaker,speakers,agenda,program,programme,schedule,sponsor,sponsors,partner,partners,exhibitor,exhibitors,practical-information,venue
RELATED_LINK_TIMEOUT_MS=18000           # 18 seconds for related page processing
RELATED_LINK_MAX=3                      # Maximum related pages to process
```

**Pipeline Configuration Updates:**
```typescript
// Update pipeline config to ensure speaker/session features are enabled
export const DEFAULT_PIPELINE_CONFIG: EventPipelineConfig = {
  thresholds: {
    prioritization: 0.6,
    confidence: 0.7,
    parseQuality: 0.5
  },
  sources: {
    cse: true,
    firecrawl: true,
    curated: true
  },
  limits: {
    maxCandidates: 100,
    maxExtractions: 20
  },
  timeouts: {
    discovery: 30000,
    prioritization: 15000,
    parsing: 10000
  },
  // Add speaker/session specific configuration
  extraction: {
    enableSpeakerExtraction: true,      // Enable speaker extraction
    enableSessionParsing: true,         // Enable session parsing
    enableRelatedPageDiscovery: true,   // Enable related page discovery
    speakerExtractionTimeout: 10000,    // 10 seconds
    relatedPageTimeout: 18000,          // 18 seconds
    maxRelatedPages: 3                  // Maximum related pages
  }
};
```

## Phase 3: Migration Strategy

### 3.1 Gradual Rollout Plan

#### Week 1: Gemini Standardization
- **Day 1-2**: Update high-priority services (fallback, optimized-ai)
- **Day 3-4**: Update medium-priority services (chat, profile)
- **Day 5**: Update low-priority services and test scripts
- **Testing**: Run comprehensive tests after each update

#### Week 2: Pipeline Enablement (Staging)
- **Day 1**: Enable new pipeline in staging environment
- **Day 2-3**: Run performance and quality tests
- **Day 4**: Compare results between old and new pipelines
- **Day 5**: Fine-tune configuration based on results

#### Week 3: Production Rollout
- **Day 1**: Enable new pipeline for 10% of traffic
- **Day 2**: Monitor metrics and quality
- **Day 3**: Increase to 50% of traffic
- **Day 4**: Monitor and adjust
- **Day 5**: Full rollout if metrics are positive

### 3.2 Rollback Strategy

#### Immediate Rollback Triggers
- Response time increase > 50%
- Error rate increase > 5%
- Quality score decrease > 20%
- User complaints increase significantly

#### Rollback Procedure
```bash
# Disable new pipeline
ENABLE_NEW_PIPELINE=false

# Revert to enhanced orchestrator
# (Automatic fallback in code)

# Monitor recovery
# Check metrics return to baseline
```

### 3.3 Monitoring and Metrics

#### Key Metrics to Track
- **Performance**: Response time, throughput, error rate
- **Quality**: Result relevance, user satisfaction, click-through rate
- **Cost**: AI API usage, processing time
- **Reliability**: Success rate, fallback usage

#### Monitoring Setup
```typescript
// Add to pipeline metrics
const metrics = {
  pipeline: 'new_event_pipeline',
  model: 'gemini-2.5-flash',
  responseTime: Date.now() - startTime,
  quality: finalConfidence,
  cost: aiTokensUsed,
  fallbackUsed: false
};
```

## Phase 4: Testing Strategy

### 4.1 Unit Tests

#### Gemini Model Tests
```typescript
// Test all services use correct model
describe('Gemini Model Standardization', () => {
  test('All services use gemini-2.5-flash', () => {
    expect(GeminiService.getModelPath()).toBe('gemini-2.5-flash');
    expect(OptimizedAIService.getModelPath()).toBe('gemini-2.5-flash');
    // ... test all services
  });
});
```

#### Pipeline Tests
```typescript
// Test new pipeline functionality
describe('New Event Pipeline', () => {
  test('Pipeline processes events correctly', async () => {
    const result = await executeNewPipeline({
      userText: 'legal conference 2025',
      country: 'DE'
    });
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.pipeline_metrics).toBeDefined();
  });
});
```

### 4.2 Integration Tests

#### End-to-End Pipeline Test
```typescript
// Test complete pipeline flow
describe('Pipeline Integration', () => {
  test('Complete search flow works', async () => {
    const response = await fetch('/api/events/run', {
      method: 'POST',
      body: JSON.stringify({
        userText: 'compliance conference',
        country: 'DE',
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31'
      })
    });
    
    const data = await response.json();
    expect(data.events).toBeDefined();
    expect(data.provider).toBe('new_pipeline');
  });
});
```

### 4.3 Performance Tests

#### Load Testing
```bash
# Test pipeline performance
npm run test:performance

# Compare old vs new pipeline
npm run test:pipeline-comparison
```

#### Quality Testing
```bash
# Test result quality
npm run test:quality

# Test AI model consistency
npm run test:ai-consistency
```

## Phase 5: Implementation Checklist

### 5.1 Pre-Implementation

- [ ] **Backup current configuration**
- [ ] **Set up monitoring dashboards**
- [ ] **Prepare rollback procedures**
- [ ] **Notify stakeholders of changes**
- [ ] **Schedule maintenance window**

### 5.2 Gemini Standardization

- [ ] **Update event-pipeline/fallback.ts**
- [ ] **Update optimized-ai-service.ts**
- [ ] **Update chat/route.ts**
- [ ] **Update profile/generate/route.ts**
- [ ] **Update events/speakers/route.ts**
- [ ] **Update admin/health/route.ts**
- [ ] **Update test scripts**
- [ ] **Create centralized model config**
- [ ] **Run unit tests**
- [ ] **Run integration tests**

### 5.3 Speaker/Session Feature Configuration

- [ ] **Update feature flags to enable speaker extraction**
- [ ] **Configure speaker extraction timeouts and patterns**
- [ ] **Enable session parsing and agenda extraction**
- [ ] **Configure related page discovery settings**
- [ ] **Update pipeline configuration for extraction features**
- [ ] **Test speaker extraction functionality**
- [ ] **Test session parsing functionality**
- [ ] **Validate speaker-session linking**
- [ ] **Test related page discovery**
- [ ] **Verify fallback handling for extraction failures**

### 5.4 Pipeline Enablement

- [ ] **Update pipeline configuration**
- [ ] **Update feature flags**
- [ ] **Set environment variables**
- [ ] **Enable in staging**
- [ ] **Run staging tests**
- [ ] **Compare old vs new results**
- [ ] **Fine-tune configuration**
- [ ] **Enable in production (gradual)**
- [ ] **Monitor metrics**
- [ ] **Full rollout**

### 5.5 Post-Implementation

- [ ] **Monitor for 48 hours**
- [ ] **Collect user feedback**
- [ ] **Analyze performance metrics**
- [ ] **Document lessons learned**
- [ ] **Update documentation**
- [ ] **Plan legacy pipeline removal**

## Expected Benefits

### Performance Improvements
- **Consistent AI Model**: All services use the same advanced model
- **Better Pipeline**: 5-stage pipeline with early termination
- **Optimized Processing**: Parallel discovery and content-based prioritization
- **Reduced Latency**: Early termination when quality threshold met

### Quality Improvements
- **Higher Accuracy**: Gemini 2.5 Flash provides better results
- **Better Filtering**: Multiple quality gates and thresholds
- **Rich Metadata**: Comprehensive pipeline tracking and metrics
- **Enhanced Coverage**: Multi-source discovery with curated sources
- **Advanced Speaker/Session Extraction**: Comprehensive speaker and session parsing capabilities
- **Related Page Discovery**: Automatic discovery and processing of speaker/agenda pages

### Maintainability Improvements
- **Consistent Architecture**: Single AI model across all services
- **Modular Design**: Clear separation of pipeline stages
- **Better Testing**: Comprehensive test coverage
- **Clear Documentation**: Well-documented pipeline stages

## Risk Mitigation

### Technical Risks
- **Model Compatibility**: Test all services with 2.5 Flash
- **Performance Impact**: Monitor response times closely
- **Quality Degradation**: Compare results before/after
- **Integration Issues**: Comprehensive integration testing

### Business Risks
- **User Experience**: Gradual rollout with monitoring
- **Cost Increase**: Monitor AI usage and costs
- **Downtime**: Rollback procedures ready
- **Data Quality**: Quality metrics and thresholds

## Success Criteria

### Technical Success
- [ ] All services use Gemini 2.5 Flash
- [ ] New pipeline processes 100% of requests
- [ ] Response time < 30 seconds (95th percentile)
- [ ] Error rate < 1%
- [ ] Quality score > 0.8
- [ ] Speaker extraction success rate > 80%
- [ ] Session parsing success rate > 70%
- [ ] Related page discovery working correctly

### Business Success
- [ ] User satisfaction maintained or improved
- [ ] Search result relevance improved
- [ ] Cost per search optimized
- [ ] Developer productivity improved
- [ ] System reliability maintained

## Timeline

| Week | Phase | Activities | Deliverables |
|------|-------|------------|--------------|
| **Week 1** | Gemini Standardization | Update all services to 2.5 Flash | All services standardized |
| **Week 2** | Pipeline Testing | Enable in staging, test thoroughly | Staging validation complete |
| **Week 3** | Production Rollout | Gradual rollout with monitoring | Production deployment |
| **Week 4** | Monitoring & Optimization | Monitor metrics, fine-tune | Optimized configuration |

## Conclusion

This plan will standardize the codebase on Gemini 2.5 Flash and enable the advanced New Event Pipeline, resulting in:

- **Consistent AI behavior** across all services
- **Improved search quality** and performance
- **Better maintainability** and developer experience
- **Reduced technical debt** and complexity

The gradual rollout approach minimizes risk while maximizing the benefits of these significant improvements to the search infrastructure.
