# Stage 5: Initial Zoom Out & Inventive Catalyst Review Report

1. **Target Document**: [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md) (Full File: lines 1–420)
2. **Reviewers**: `egm-zoom-out`, `egm-inventive-catalyst`

--------------------------------------------------------------------------------

## 1. Zoom Out Reviewer Findings (`egm-zoom-out`)

### Finding ZO-1: Redundant Graph API Re-Pagination and Preview-to-Draw Pool Drift in `POST /api/draws`

1. **Severity**: Major
2. **Affected Scope**: `Technical Plan (Architecture) > 5. Firestore Data Model and Atomic Persistence` (lines 192–195) and `Detailed Implementation Plan > 12. app/api/draws/route.ts` (lines 344–348)
3. **Simplicity and Architecture Rationale**:
   a. In the current draft, `/dashboard/post/[postId]` paginates all top-level comments on page load, and `POST /api/draws` re-fetches and paginates all top-level comments from `graph.instagram.com` again when the host clicks "Run Official Draw". This contradicts the resolution in [`docs/concepts_brief.md`](./concepts_brief.md) (*"Every comment on a post is fetched from Instagram at most once... and the official draw executes against a locked comment snapshot without network timeouts"*).
   b. **Rate-Limit and Timeout Risk**: A post with 5,000 comments requires 100 pagination requests on page load and another 100 requests on draw execution—exhausting Meta's 200 calls/user/hour rate limit on a single draw and risking serverless timeouts during the atomic draw transaction.
   c. **Preview-to-Draw Pool Drift**: If new comments arrive while the host is tuning rules in the Dry-Run Qualification Preview, re-fetching live comments inside `POST /api/draws` silently changes the comment pool compared to what the host previewed.
   d. **Recommendation**: Cache the synced `CommentSyncResult` snapshot on the server (or pass an HMAC-SHA256 server-signed snapshot digest/cache key) when `/dashboard/post/[postId]` loads (with an explicit "Resync Comments" action if the host wants to refresh), so `POST /api/draws` evaluates the exact locked comment snapshot that the host previewed without re-paginating `graph.instagram.com`.

### Finding ZO-2: Altitude Drop into Code-Level Implementation Weeds in the High-Level Architecture Section

1. **Severity**: Major
2. **Affected Scope**: `Technical Plan (Architecture) > 4. Pure Qualification and Cryptographic Draw Engine (lib/giveaway/logic.ts)` (lines 147–169)
3. **Simplicity Rationale**:
   a. Per `zoom-out-standard.md` (Section 3: *Anti-Weeds / Altitude Control*), high-level architecture sections must describe component responsibilities, interfaces, and data flow rather than low-level code expressions and local variable names. Lines 148–168 embed literal regular expressions, string manipulation chains (`.toLowerCase().includes(...)`), comparator expressions (`new Date(a.timestamp).getTime() - ...`), and local variable accessors (`userTaggedFriends.get(...)`, `blockedSet.has(...)`, `seenUsernames.add(...)`).
   b. **Recommendation**: Summarize the qualification rules and cryptographic draw pipeline at the architectural contract level in `Technical Plan (Architecture)`, and move the exact regex, comparator expressions, and data structure details into `Detailed Implementation Plan > 6. lib/giveaway/logic.ts`.

### Finding ZO-3: Raw 32-Byte Key Length Requirement for `SESSION_SECRET`

1. **Severity**: Nit
2. **Affected Scope**: `Technical Plan (Architecture) > 2. Authentication and Session Management` (line 129) and `Detailed Implementation Plan > 4. lib/auth/session.ts` (line 290)
3. **Simplicity Rationale**:
   a. Requiring `SESSION_SECRET` to be an exact 32-byte string for `aes-256-gcm` is error-prone (`crypto.createCipheriv` throws `RangeError: Invalid key length` if the secret is 31 or 33 characters).
   b. **Recommendation**: Derive the 32-byte key via `crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest()` so any non-empty secret string works safely.

--------------------------------------------------------------------------------

## 2. Inventive Catalyst Findings (`egm-inventive-catalyst`)

### Finding IC-1: Double Comment Pagination & Preview-to-Draw Pool Drift

1. **Severity**: Major
2. **Affected Scope**: Section 3 (`Instagram Graph API Anti-Corruption Layer`), Section 5.3 (`Atomic Transaction (POST /api/draws)`), and Target Files #5 (`lib/instagram/api.ts`), #12 (`app/api/draws/route.ts`), and #18 (`app/dashboard/post/[postId]/page.tsx`)
3. **False Compromise**: Surrendering to re-paginating `graph.instagram.com` inside `POST /api/draws` to avoid trusting client-submitted comments wastes 50% of the user's hourly Graph API quota and causes preview-to-draw comment drift.
4. **Proposed Resolution (Preliminary Action + Extraction — Server-Locked Sync Snapshot)**: Cache the synced comment snapshot on the server during Phase 1 (`getPostComments`) keyed by `mediaId` (with a 30-minute TTL and explicit "Resync Comments" button), or verify a server-issued HMAC signature over the synced snapshot, so `POST /api/draws` executes in milliseconds against the exact previewed comment pool.

### Finding IC-2: Immutable Audit Snapshot vs. Complete Attempt Lineage Discovery

1. **Severity**: Nit
2. **Affected Scope**: Section 5.1–5.3 (`Firestore Data Model and Atomic Persistence`), Non-Functional Requirements (2.c), and Target Files #8 (`lib/firebase/admin.ts`) and #19 (`app/verify/[drawId]/page.tsx`)
3. **False Compromise**: Storing only `{ drawAttemptCount, lastDrawId, lastDrawnAt }` on `posts/{mediaId}` while requiring `draws/{drawId}` to list `priorAttempts` forces extra queries or omits full attempt lineage when later draws occur on the same post.
4. **Proposed Resolution (Segmentation — Append-Only Attempt Ledger on `posts/{mediaId}`)**: Store a bounded `attempts: Array<{ drawId: string, attemptNumber: number, executedAt: string, idempotencyKey: string }>` summary array directly inside `posts/{mediaId}` during `commitAtomicDraw`. This lets the transaction check `idempotencyKey` and populate `priorAttempts` in a single document read, and lets `/verify/[drawId]` read `posts/{mediaId}` to show both prior and any subsequent draw attempts executed on the same post.
