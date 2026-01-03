# AI-Powered Email Handling & Job Updates Implementation Plan

## Executive Summary

This plan outlines the migration from rule-based email classification and job matching to an AI-powered system that will significantly improve accuracy, reduce manual intervention, and provide richer context extraction from emails.

**Note**: This plan focuses on **server-side email processing** (email sync). The browser extension (client-side job extraction) is a separate system and is addressed in a separate section below.

## Current System Analysis

### Current Architecture
1. **Email Classification**: Keyword-based matching with hardcoded patterns
2. **Entity Extraction**: Regex patterns for company/title/location extraction
3. **Job Matching**: Fuzzy string matching (company + title, domain matching)
4. **Status Updates**: Simple status hierarchy (only advance, never go backwards)
5. **Notifications**: Manual resolution required for ambiguous matches

### Pain Points
- **Low Accuracy**: Keyword matching misses edge cases and variations
- **Brittle Extraction**: Regex patterns fail on non-standard email formats
- **Ambiguous Matches**: Frequent false positives requiring user intervention
- **Limited Context**: No extraction of dates, next steps, or additional details
- **No Learning**: System doesn't improve from corrections
- **High Maintenance**: New patterns require code updates

## Proposed AI Solution

### Core AI Capabilities

#### 1. **Intelligent Email Classification**
- Use LLM to classify email type with context understanding
- Extract confidence scores and reasoning
- Handle edge cases and variations automatically

#### 2. **Advanced Entity Extraction**
- Extract company, title, location with high accuracy
- Handle variations, abbreviations, and non-standard formats
- Extract additional context: dates, times, contact info, next steps

#### 3. **Semantic Job Matching**
- Use embeddings/semantic similarity for job matching
- Understand job title variations (e.g., "React Developer" vs "React.js Engineer")
- Match based on context, not just exact strings

#### 4. **Automatic Resolution**
- AI resolves ambiguous matches using context
- Learns from user corrections to improve over time
- Reduces manual intervention by 80%+

#### 5. **Rich Context Extraction**
- Extract interview dates/times
- Extract next action items
- Extract salary/compensation details
- Extract rejection reasons (for learning)

## Implementation Phases

### Phase 1: Foundation & Infrastructure (Week 1-2)

#### 1.1 AI Service Setup
**Goal**: Set up AI provider integration and service layer

**Tasks**:
- [ ] Set up OpenAI API with GPT-4o-mini model
- [ ] Set up API keys and configuration
- [ ] Create `src/lib/ai/` directory structure
- [ ] Implement base AI service class with retry logic
- [ ] Add rate limiting and cost tracking
- [ ] Create environment variables for API keys

**Files to Create**:
- `src/lib/ai/config.ts` - AI configuration
- `src/lib/ai/client.ts` - Base AI client with retry/error handling
- `src/lib/ai/types.ts` - TypeScript types for AI responses

**Dependencies**:
- `openai` package (for GPT-4o-mini)
- Environment variables for API keys (`OPENAI_API_KEY`)

**Model Choice**: GPT-4o-mini
- Cost-effective: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Fast response times
- Good accuracy for classification tasks
- Suitable for email processing workloads

#### 1.2 Prompt Engineering & Templates
**Goal**: Create structured prompts for each AI task

**Tasks**:
- [ ] Design prompt templates for email classification
- [ ] Design prompt templates for entity extraction
- [ ] Design prompt templates for job matching
- [ ] Create prompt versioning system
- [ ] Test prompts with sample emails

**Files to Create**:
- `src/lib/ai/prompts/classification.ts`
- `src/lib/ai/prompts/extraction.ts`
- `src/lib/ai/prompts/matching.ts`
- `src/lib/ai/prompts/resolution.ts`

**Key Prompts**:
```typescript
// Classification prompt example
const CLASSIFY_EMAIL_PROMPT = `
You are analyzing emails for a job application tracking system. 
CRITICAL: Only process emails that are DIRECTLY related to a specific job application.

IGNORE these types of emails:
- General newsletters from job boards (LinkedIn, Indeed, etc.)
- Marketing emails from companies
- General career advice or tips
- Job board notifications about new jobs (not about YOUR application)
- Company updates/news that aren't about your application
- Promotional emails
- Unrelated personal or business emails

ONLY PROCESS emails that are about YOUR specific job application:
- Application confirmations ("We received your application")
- Interview invitations or scheduling
- Rejections for a specific position you applied to
- Job offers
- Follow-ups about your application status
- Updates about a position you applied to

Email:
Subject: {subject}
From: {from}
Body: {body}

Classify as one of:
- APPLICATION_CONFIRMATION: Confirms they received your application
- INTERVIEW_INVITE: Invites you to interview or schedule a call
- REJECTION: Rejects your application for a specific job
- OFFER: Extends a job offer
- FOLLOW_UP: Follow-up about your application status
- OTHER: Not job-related OR general info (ignore these)

Return JSON: { 
  type: string, 
  confidence: number (0-100), 
  reasoning: string,
  shouldProcess: boolean (true only if directly about YOUR application)
}
`
```

### Phase 2: AI Classification (Week 2-3)

#### 2.1 Replace Keyword Classification
**Goal**: Replace keyword-based classification with AI

**Tasks**:
- [ ] Create `AIClassifier` class implementing same interface as `EmailClassifier`
- [ ] Implement AI-based classification method
- [ ] Add fallback to rule-based for low-confidence AI results
- [ ] Add caching for repeated emails
- [ ] Update `sync-helper.ts` to use `AIClassifier`

**Files to Modify**:
- `src/lib/email-classifier.ts` - Add AI mode or create new `src/lib/ai-email-classifier.ts`
- `src/app/api/cron/sync-emails/sync-helper.ts` - Switch to AI classifier

**Files to Create**:
- `src/lib/ai-email-classifier.ts` - New AI-powered classifier

**Interface Compatibility**:
```typescript
// Maintain same interface for drop-in replacement
class AIClassifier {
  classify(email: EmailMessage): Promise<ClassifiedEmail>
  // Same return type as EmailClassifier
}
```

#### 2.2 Testing & Validation
**Goal**: Ensure AI classification is more accurate than keyword-based

**Tasks**:
- [ ] Create test suite comparing AI vs keyword classification
- [ ] Test on sample of real emails (100+)
- [ ] Measure accuracy improvement
- [ ] Add feature flag to toggle between AI/keyword modes
- [ ] Log AI responses for analysis

**Metrics to Track**:
- Classification accuracy (% correct)
- Confidence score distribution
- False positive/negative rates
- Cost per email

### Phase 3: AI Entity Extraction (Week 3-4)

#### 3.1 Replace Regex Extraction
**Goal**: Replace regex-based extraction with AI

**Tasks**:
- [ ] Create AI entity extraction method
- [ ] Extract: company, title, location, dates, times, next steps
- [ ] Handle edge cases (abbreviations, variations)
- [ ] Add validation and normalization
- [ ] Update classification to use AI extraction

**Files to Create**:
- `src/lib/ai-entity-extractor.ts`

**Extraction Schema**:
```typescript
interface ExtractedEntities {
  company: string | null
  title: string | null
  location: string | null
  interviewDate?: Date | null
  interviewTime?: string | null
  nextSteps?: string[]
  contactName?: string | null
  contactEmail?: string | null
  salary?: string | null
  rejectionReason?: string | null
}
```

#### 3.2 Enhanced Context Extraction
**Goal**: Extract rich context beyond basic entities

**Tasks**:
- [ ] Extract interview scheduling details
- [ ] Extract action items and next steps
- [ ] Extract compensation information
- [ ] Extract rejection feedback
- [ ] Store extracted context in Activity records

**Database Updates**:
- Add `metadata` JSON field to `Activity` model (if not exists)
- Store extracted context in activity metadata

### Phase 4: AI Job Matching (Week 4-5)

#### 4.1 Semantic Matching
**Goal**: Replace fuzzy string matching with semantic similarity

**Tasks**:
- [ ] Implement embedding-based job matching
- [ ] Create job embeddings for existing jobs
- [ ] Match emails to jobs using cosine similarity
- [ ] Set confidence thresholds for matches
- [ ] Handle multiple candidate jobs intelligently

**Approach Options**:
1. **Embedding-based**: Generate embeddings for job titles/companies, compare with email
2. **LLM-based**: Use LLM to determine if email matches job with reasoning
3. **Hybrid**: Use embeddings for candidate selection, LLM for final decision

**Files to Create**:
- `src/lib/ai-job-matcher.ts`
- `src/lib/ai/embeddings.ts` (if using embeddings)

#### 4.2 Automatic Ambiguity Resolution
**Goal**: Reduce manual intervention for ambiguous matches

**Tasks**:
- [ ] Use AI to resolve ambiguous matches automatically
- [ ] Consider email context, dates, and job history
- [ ] Only ask user when confidence is truly low
- [ ] Learn from user corrections

**Resolution Strategy**:
```typescript
interface MatchResolution {
  jobId: string | null
  confidence: number
  reasoning: string
  requiresUserInput: boolean
  alternativeMatches?: Array<{ jobId: string; confidence: number }>
}
```

### Phase 5: Learning & Improvement (Week 5-6)

#### 5.1 Feedback Loop
**Goal**: Learn from user corrections to improve accuracy

**Tasks**:
- [ ] Track user corrections (when user fixes AI mistakes)
- [ ] Store correction patterns in database
- [ ] Use corrections to improve prompts
- [ ] Create feedback API endpoint

**Database Schema**:
```prisma
model AICorrection {
  id          String   @id @default(cuid())
  userId      String
  emailId     String?  // Reference to email if available
  jobId       String?  // Reference to job if available
  correctionType String // 'classification' | 'extraction' | 'matching'
  originalAIResult Json
  userCorrection   Json
  createdAt   DateTime @default(now())
  
  @@index([userId, createdAt])
}
```

#### 5.2 Prompt Refinement
**Goal**: Continuously improve prompts based on errors

**Tasks**:
- [ ] Analyze correction patterns
- [ ] Update prompts with common error patterns
- [ ] A/B test prompt variations
- [ ] Monitor accuracy metrics over time

### Phase 6: Advanced Features (Week 6-7)

#### 6.1 Multi-Email Context
**Goal**: Use email threads/conversations for better understanding

**Tasks**:
- [ ] Group related emails (same thread/conversation)
- [ ] Use conversation history for classification
- [ ] Track email threads in database
- [ ] Update job status based on full conversation context

#### 6.2 Proactive Insights
**Goal**: Provide AI-generated insights about job applications

**Tasks**:
- [ ] Detect patterns (e.g., "no response after 2 weeks")
- [ ] Suggest follow-up actions
- [ ] Identify ghosting patterns
- [ ] Generate status update summaries

**Example Insights**:
- "You haven't heard back from [Company] in 2 weeks. Consider following up."
- "You've received 3 interview invites this week - great progress!"
- "Pattern detected: Companies in [Industry] respond faster than average"

## Technical Architecture

### AI Service Layer

```
src/lib/ai/
├── config.ts           # AI configuration
├── client.ts           # Base AI client
├── types.ts            # TypeScript types
├── prompts/
│   ├── classification.ts
│   ├── extraction.ts
│   ├── matching.ts
│   └── resolution.ts
└── utils/
    ├── embeddings.ts    # Embedding generation (if used)
    └── cache.ts        # Response caching
```

### Integration Points

1. **Email Sync Flow** (`sync-helper.ts`)
   - Replace `EmailClassifier` with `AIClassifier`
   - Replace `matchToJob` with `AIJobMatcher`
   - Add AI extraction step

2. **Notification System**
   - Reduce ambiguous match notifications
   - Add AI confidence indicators
   - Show AI reasoning for transparency

3. **Activity Timeline**
   - Store AI-extracted context
   - Show extracted dates/times
   - Display next steps

### Cost Management

**Estimated Costs** (OpenAI GPT-4o-mini):
- Classification: ~$0.001 per email (much cheaper than GPT-4)
- Extraction: ~$0.002 per email
- Matching: ~$0.001 per email
- **Total: ~$0.004 per email** (10x cheaper than GPT-4!)

**Cost Optimization**:
- Cache results for duplicate emails
- Use GPT-4o-mini for all tasks (cost-effective and accurate)
- Batch processing when possible
- Rate limiting to prevent spikes
- Skip processing non-job emails early (saves costs)

**Monthly Estimate** (100 emails/day, 50% job-related):
- 100 emails/day × 30 days = 3,000 emails/month
- ~1,500 job-related emails (after filtering)
- 1,500 × $0.004 = **$6/month** (very affordable!)

**Note**: Filtering out non-job emails early saves significant costs.

### Feature Flags

Implement feature flags for gradual rollout:

```typescript
// Feature flags
const FEATURES = {
  AI_CLASSIFICATION: process.env.ENABLE_AI_CLASSIFICATION === 'true',
  AI_EXTRACTION: process.env.ENABLE_AI_EXTRACTION === 'true',
  AI_MATCHING: process.env.ENABLE_AI_MATCHING === 'true',
  AI_RESOLUTION: process.env.ENABLE_AI_RESOLUTION === 'true',
}
```

## Migration Strategy

### Phase 1: Parallel Running
- Run AI and rule-based systems in parallel
- Compare results
- Log differences for analysis
- Don't make changes, just observe

### Phase 2: Gradual Rollout
- Enable AI for 10% of users
- Monitor accuracy and errors
- Gradually increase to 50%, then 100%

### Phase 3: Full Migration
- Switch all users to AI
- Keep rule-based as fallback
- Monitor for 2 weeks

### Phase 4: Cleanup
- Remove rule-based code (or keep as fallback)
- Optimize AI prompts based on data
- Document learnings
- **Remove old files** (see Cleanup section below)

## Success Metrics

### Accuracy Metrics
- **Classification Accuracy**: Target 95%+ (vs current ~70%)
- **Entity Extraction Accuracy**: Target 90%+ (vs current ~60%)
- **Job Matching Accuracy**: Target 95%+ (vs current ~75%)
- **Ambiguous Match Rate**: Reduce from 15% to <5%

### User Experience Metrics
- **Manual Interventions**: Reduce by 80%
- **Time to Update**: Reduce from minutes to seconds
- **User Satisfaction**: Measure via feedback

### Cost Metrics
- **Cost per Email**: Track and optimize
- **Monthly AI Costs**: Stay under budget
- **ROI**: Measure time saved vs cost

## Risk Mitigation

### Risks
1. **AI API Downtime**: Fallback to rule-based system
2. **High Costs**: Rate limiting, caching, model selection
3. **Accuracy Issues**: Human review for low-confidence results
4. **Data Privacy**: Ensure email content is handled securely

### Mitigation
- Implement fallback mechanisms
- Set cost alerts and limits
- Add confidence thresholds
- Review AI provider security practices
- Consider on-premise models for sensitive data

## Testing Strategy

### Unit Tests
- Test AI service with mocked responses
- Test prompt formatting
- Test error handling

### Integration Tests
- Test full sync flow with AI
- Test fallback to rule-based
- Test cost tracking

### Validation Tests
- Compare AI vs rule-based on sample emails
- Measure accuracy improvements
- Track cost per email

## Documentation

### Developer Documentation
- AI service architecture
- Prompt engineering guide
- Cost optimization guide
- Troubleshooting guide

### User Documentation
- How AI improves accuracy
- What data is sent to AI
- Privacy and security information

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| Phase 1: Foundation | Week 1-2 | AI service setup, prompts |
| Phase 2: Classification | Week 2-3 | AI classification, testing |
| Phase 3: Extraction | Week 3-4 | AI entity extraction |
| Phase 4: Matching | Week 4-5 | Semantic job matching |
| Phase 5: Learning | Week 5-6 | Feedback loop, improvements |
| Phase 6: Advanced | Week 6-7 | Multi-email, insights |

**Total Timeline**: 6-7 weeks

## Next Steps

1. **Review this plan** with stakeholders
2. **Choose AI provider** (OpenAI recommended for ease)
3. **Set up development environment** with API keys
4. **Create Phase 1 tasks** in project management tool
5. **Begin implementation** with foundation setup

## Questions to Consider

1. **AI Provider**: ✅ **OpenAI GPT-4o-mini** (selected)
2. **Cost Budget**: ✅ **~$6/month** for 100 emails/day (very affordable)
3. **Privacy**: Can we send email content to external AI?
4. **Rollout**: Gradual or all-at-once?
5. **Fallback**: Keep rule-based as permanent fallback?
6. **Email Filtering**: ✅ **Critical requirement** - Must filter out non-job emails

## Critical Requirements

### Email Filtering (HIGH PRIORITY)

The AI must distinguish between:
- ✅ **Process**: Emails about YOUR specific job application
  - Application confirmations ("We received your application")
  - Interview invites
  - Rejections for positions you applied to
  - Job offers
  - Follow-ups about your application status

- ❌ **Ignore**: Non-job-related or general info emails
  - General newsletters from job boards (LinkedIn, Indeed, etc.)
  - Marketing emails from companies
  - Job board notifications about new jobs (not your application)
  - Company updates/news unrelated to your application
  - Promotional emails
  - Career advice emails
  - General info emails from job sources

**Implementation**:
- Classification prompt must explicitly filter these out
- Return `shouldProcess: false` for non-job emails
- Skip all processing (extraction, matching) if `shouldProcess: false`
- This saves costs and prevents false positives
- Application confirmations ARE job-related and should be processed

## File Cleanup Plan

After successful AI migration, the following files should be removed or deprecated:

### Files to Remove (After AI is Fully Operational)

1. **`src/lib/email-classifier.ts`** (or significant portions)
   - **Current Purpose**: Keyword-based email classification
   - **Replaced By**: `src/lib/ai-email-classifier.ts`
   - **Action**: Remove entire file OR keep minimal fallback methods only
   - **Lines to Remove**: 
     - Keyword arrays (lines 38-186)
     - `classify()` method keyword matching logic (lines 192-261)
     - Regex-based `extractJobInfo()` method (lines 330-535)
     - `matchToJob()` fuzzy matching logic (lines 541-731)

2. **Test Files** (if they test old logic):
   - `scripts/__tests__/email-classifier.test.ts` - Update to test AI classifier
   - `scripts/__tests__/job-matching.test.ts` - Update to test AI matching

### Files to Update (Keep but Modify)

1. **`src/app/api/cron/sync-emails/sync-helper.ts`**
   - **Current**: Uses `EmailClassifier` from `email-classifier.ts`
   - **Action**: Replace with `AIClassifier` import
   - **Lines to Change**: 
     - Line 3: `import { EmailClassifier }` → `import { AIClassifier }`
     - Line 83: `const classifier = new EmailClassifier()` → `const classifier = new AIClassifier()`

2. **`src/scripts/test-email-sync-live.ts`**
   - **Current**: Uses `EmailClassifier`
   - **Action**: Update to use `AIClassifier`
   - **Lines to Change**:
     - Line 20: Import statement
     - Line 333: Classifier instantiation

3. **`src/scripts/debug-email-sync.ts`**
   - **Current**: May use old classifier
   - **Action**: Update to use AI classifier

### Migration Strategy for File Removal

**Phase 1: Parallel Running** (Keep old files)
- Keep `email-classifier.ts` intact
- Add new `ai-email-classifier.ts`
- Use feature flag to switch between them
- Both files coexist

**Phase 2: Gradual Migration** (Keep as fallback)
- Keep `email-classifier.ts` but mark as deprecated
- Add `@deprecated` JSDoc comments
- Use AI as primary, old as fallback on errors

**Phase 3: Full Migration** (Remove old code)
- After 2+ weeks of stable AI operation
- Remove keyword arrays and regex extraction from `email-classifier.ts`
- Keep only interface/types if needed for compatibility
- OR: Delete entire file if interface is in separate types file

**Phase 4: Cleanup** (Final removal)
- Delete `email-classifier.ts` completely
- Update all imports
- Remove from git history (optional, for cleaner history)

### Backup Strategy

Before removing files:
1. **Create backup branch**: `git checkout -b backup/pre-ai-migration`
2. **Tag current state**: `git tag pre-ai-migration-v1.0`
3. **Document what was removed**: Add notes in CHANGELOG.md

### Files to Keep (Don't Remove)

- `src/lib/email-service.ts` - Email fetching (still needed)
- `src/lib/notification-service.ts` - Notifications (still needed)
- `src/lib/email-sync-logger.ts` - Logging (still needed)
- All test files (update them, don't delete)

### Cleanup Checklist

After AI migration is complete and stable:

- [ ] Remove keyword arrays from `email-classifier.ts` (lines 38-186)
- [ ] Remove `classify()` keyword matching logic (lines 192-261)
- [ ] Remove `extractJobInfo()` regex extraction (lines 330-535)
- [ ] Remove `matchToJob()` fuzzy matching (lines 541-731)
- [ ] Update all imports to use `AIClassifier`
- [ ] Update test files to test AI classifier
- [ ] Remove `email-classifier.ts` entirely (if no longer needed)
- [ ] Update documentation references
- [ ] Commit with message: "Remove legacy email classifier, replaced by AI"

---

**Document Version**: 1.1  
**Last Updated**: 2025-01-27  
**Author**: AI Assistant  
**Status**: Draft for Review

