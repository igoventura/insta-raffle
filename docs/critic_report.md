# Stage 7: Critic Review Report (`FeatureRange: lines 1..265`)

1. **Target Document**: [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md) (`FeatureRange`: lines 1–265)
2. **Reviewers**: `egm-design`, `egm-structural`, `egm-style`
3. **Standard Applied**: `feature-spec-standard.md`

--------------------------------------------------------------------------------

## 1. Design Critic Findings (`egm-design`)

### Finding DC-1: Storing Attempt History and Idempotency Keys Directly on `posts/{mediaId}`

1. **Severity**: Nit
2. **Affected Scope**: `Technical Plan (Architecture) > 5. Firestore Data Model and Atomic Persistence` (lines 173–195)
3. **Recommendation**: Line 174 defines `posts/{mediaId}` with `{ mediaId, ownerUsername, drawAttemptCount, lastDrawId, lastDrawnAt }`, whereas lines 191 and 194 require `POST /api/draws` to check `idempotencyKey` and populate `priorAttempts: Array<{ drawId, attemptNumber, executedAt }>` when reading `posts/{mediaId}` inside `db.runTransaction()`. Including `attempts: Array<{ drawId, attemptNumber, executedAt, idempotencyKey }>` directly on `posts/{mediaId}` allows the transaction to resolve both idempotency and `priorAttempts` from the single `posts/{mediaId}` document read without secondary queries.

### Finding DC-2: Timezone-Safe Epoch Comparison for `PAST_DEADLINE`

1. **Severity**: Nit
2. **Affected Scope**: `Technical Plan (Architecture) > 4.2 Deterministic Qualification Pipeline` (lines 153–154)
3. **Recommendation**: Replace string comparison (`comment.timestamp > rules.deadlineIso`) with parsed epoch comparison (`new Date(comment.timestamp).getTime() > new Date(rules.deadlineIso).getTime()`) because Instagram Graph API returns ISO-8601 timestamps with `+0000` numeric offsets whereas browser inputs or normalized ISO strings may use `Z` or local offsets.

### Finding DC-3: Avoid Re-Paginating Graph API Inside `POST /api/draws`

1. **Severity**: Nit
2. **Affected Scope**: `Technical Plan (Architecture) > 5.3 Atomic Transaction (POST /api/draws)` (lines 192–196)
3. **Recommendation**: Cache or HMAC-sign the synced comment snapshot on the server during Phase 1 (`getPostComments`) so `POST /api/draws` does not re-paginate up to 100 Graph API pages a second time during draw execution.

--------------------------------------------------------------------------------

## 2. Structural Reviewer Findings (`egm-structural`)

### Finding ST-1: Heading Level of `Additional Resources` and `Future Improvements`

1. **Severity**: Nit
2. **Affected Scope**: [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md) (`### Additional Resources` at line 254 and `### Future Improvements` at line 259)
3. **Recommendation**: Promote `### Additional Resources` and `### Future Improvements` from H3 (`###`) to H2 (`##`) since they follow a top-level horizontal rule divider (`---`) after `## Non-Functional Requirements`.

### Finding ST-2: Explicit `Risks and Mitigations` Sub-item under `Non-Functional Requirements`

1. **Severity**: Nit
2. **Affected Scope**: [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md) (`## Non-Functional Requirements`, lines 239–251)
3. **Recommendation**: Add `4. **Risks and Mitigations**:` under `## Non-Functional Requirements` (or rename the header `## Non-Functional Requirements and Risks`) to explicitly group the `MAX_PAGES = 100` (5,000 comments) synchronous pagination cap and Graph API rate-limit mitigation in one place per `feature-spec-standard.md`.

--------------------------------------------------------------------------------

## 3. Style Reviewer Findings (`egm-style` — `FeatureRange: lines 1..265`)

### Finding SY-1: Long Parenthetical in `Overview`

1. **Severity**: Nit
2. **Affected Scope**: `## Overview` (line 11)
3. **Recommendation**: Shorten the 74-word second sentence in `## Overview` by summarizing the qualification rules rather than repeating all seven rules that are already enumerated in `## Goals` #3 (lines 28–34).

### Finding SY-2: Redundant Modifier `"100%"` Before `"deterministic"`

1. **Severity**: Nit
2. **Affected Scope**: `## Non-Functional Requirements` — Item 2.b (line 247)
3. **Recommendation**: Replace `"must be 100% deterministic string and timestamp logic"` with `"must use deterministic string and timestamp logic"`.
