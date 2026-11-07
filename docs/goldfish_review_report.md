# Goldfish Annotated Review Report

1. **Target:** [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md) (`lines 1..420`)
2. **Status:** resolved

## Prioritized Findings & AI Suggestions

### 1. [CA-1: Stateless HMAC-Signed Comment Snapshot for `POST /api/draws`] [`egm-zoom-out`, `egm-inventive-catalyst`, `egm-design`] - Severity: Major

1. **Affected Scope:** [Lines 137-142](./designs/insta-raffle.md#L137-L142) (`Technical Plan §3`) and [Lines 192-196](./designs/insta-raffle.md#L192-L196) (`Technical Plan §5.3`)
2. **Discrepancy Description:** Re-paginating up to 100 Graph API pages inside `POST /api/draws` after `/dashboard/post/[postId]` already paginated those comments on page load consumes double the user's hourly Graph API quota (200 calls for a 5,000-comment post) and causes preview-to-draw comment pool drift if new comments arrive while the host tunes rules.
3. **Rationale:** [`docs/concepts_brief.md`](./concepts_brief.md) specifies that every comment is fetched at most once and the official draw executes against a locked comment snapshot without network timeouts.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Signing the canonical synced comment payload (`{ mediaId, isComplete, comments }`) with an HMAC-SHA256 `syncToken` on the server when `/dashboard/post/[postId]` loads allows `GiveawayEngine` to pass `{ comments, isComplete, syncToken }` to `POST /api/draws`, which verifies `syncToken` in stateless memory without database cache tables or redundant Graph API calls.
6. ***Proposed Edit:***
   a. Location: `Technical Plan §3` (lines 137–142), `Technical Plan §5.3` (lines 192–196), and `Detailed Implementation Plan` (`lib/auth/session.ts`, `app/api/draws/route.ts`, `components/giveaway-engine.tsx`, `app/dashboard/post/[postId]/page.tsx`)
   b. Change: Add `signCommentSnapshot` / `verifyCommentSnapshot` HMAC-SHA256 helpers and specify that `/dashboard/post/[postId]` issues `syncToken` over the synced comments so `POST /api/draws` verifies `syncToken` rather than re-paginating `graph.instagram.com`.

### 2. [CA-2: Altitude Separation in `Technical Plan §4` and Exact `hmac-sha256-fy-v1` Specification] [`egm-zoom-out`, `egm-comprehension`, `egm-design`, `egm-implementation-readiness`] - Severity: Major

1. **Affected Scope:** [Lines 143-170](./designs/insta-raffle.md#L143-L170) (`Technical Plan §4`) and [Lines 304-314](./designs/insta-raffle.md#L304-L314) (`Detailed Implementation Plan #6`)
2. **Discrepancy Description:** `Technical Plan §4` embeds low-level regex literals, `.toLowerCase().includes(...)`, string timestamp comparison (`comment.timestamp > rules.deadlineIso`), and local variable names (`userTaggedFriends`, `seenUsernames`), while `Detailed Implementation Plan #6` omits the exact 32-bit unsigned integer extraction (`parseInt(hmacHex.slice(0, 8), 16)`), `counter` increment rule, rejection threshold (`limit = 0x100000000 - (0x100000000 % (i + 1))`), and pool underflow handling.
3. **Rationale:** High-level architecture sections must remain at the contract level per `zoom-out-standard.md`, while implementation plans must leave zero algorithmic ambiguity per `implementation-readiness-standard.md`.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Summarizing `Technical Plan §4` at the contract level (including UTC epoch deadline comparison) and moving the exact regex, epoch comparator, 32-bit HMAC rejection-sampling formula, and pool underflow rules into `Detailed Implementation Plan` satisfies both standards.
6. ***Proposed Edit:***
   a. Location: `Technical Plan §4` (lines 143–170) and `Detailed Implementation Plan` (`lib/giveaway/logic.ts`)
   b. Change: Replace code expressions in `Technical Plan §4` with contract descriptions and add the exact regex, UTC epoch comparison, `uint32` HMAC rejection sampling formula, and pool underflow rules to `lib/giveaway/logic.ts` in the `Detailed Implementation Plan`.

### 3. [CA-3: Partition `Detailed Implementation Plan` into Three Incremental, Buildable Phases] [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major

1. **Affected Scope:** [Lines 266-415](./designs/insta-raffle.md#L266-L415) (`## Detailed Implementation Plan`)
2. **Discrepancy Description:** The 22 file changes are listed in a flat sequence where Step 2 deletes `lib/supabase/*` before Steps 10–16 remove `@/lib/supabase/*` imports from 5 files, and Step 6 replaces `pickWinners` in `lib/giveaway/logic.ts` before Step 14 updates `components/giveaway-engine.tsx`.
3. **Rationale:** `implementation-readiness-standard.md` requires logical, incremental phases where each phase leaves the repository in a buildable and testable state.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Grouping the 22 file operations into three sequential phases (Phase 1: Dependencies & Pure Qualification/Draw Engine + Unit Tests; Phase 2: Server Auth, Instagram ACL & Firestore Persistence Adapters; Phase 3: Route Handlers, UI Components, Pages & Legacy File Deletion) with verification checkpoints prevents intermediate build breakages.
6. ***Proposed Edit:***
   a. Location: `## Detailed Implementation Plan` (lines 266–415)
   b. Change: Reorganize the 22 file items into Phase 1, Phase 2, and Phase 3 with build/test checkpoints after each phase, moving the deletion of `lib/supabase/*` and `app/dashboard/[accountId]/page.tsx` to the end of Phase 3.

### 4. [CA-4: Isomorphic Pure TypeScript SHA-256 and HMAC-SHA256 in `lib/giveaway/logic.ts`] [`egm-implementation-readiness`] - Severity: Major

1. **Affected Scope:** [Lines 304-314](./designs/insta-raffle.md#L304-L314) (`lib/giveaway/logic.ts`) and [Lines 354-361](./designs/insta-raffle.md#L354-L361) (`components/giveaway-engine.tsx`)
2. **Discrepancy Description:** `components/giveaway-engine.tsx` is a `'use client'` component that imports `qualifyComments` from `lib/giveaway/logic.ts`. A top-level `import crypto from 'crypto'` in `lib/giveaway/logic.ts` breaks Next.js 14 Webpack client bundling.
3. **Rationale:** Next.js 14 does not polyfill Node's `crypto` module in browser client bundles.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Implementing pure, zero-dependency TypeScript SHA-256 and HMAC-SHA256 inside `lib/giveaway/logic.ts` keeps the entire qualification and draw module 100% isomorphic across browser and server without external dependencies.
6. ***Proposed Edit:***
   a. Location: `Detailed Implementation Plan` (`lib/giveaway/logic.ts`)
   b. Change: Specify that `computePoolHash` and `executeAtomicDraw` use pure TypeScript SHA-256 and HMAC-SHA256 helpers in `lib/giveaway/logic.ts` with zero Node `crypto` imports.

### 5. [CA-5: Add Inline `attempts` Ledger to `PostDrawMetadata` (`posts/{mediaId}`)] [`egm-implementation-readiness`, `egm-codebase-details`, `egm-comprehension`, `egm-design`, `egm-inventive-catalyst`, `egm-zoom-out`] - Severity: Major

1. **Affected Scope:** [Lines 171-196](./designs/insta-raffle.md#L171-L196) (`Technical Plan §5`) and [Lines 320-328](./designs/insta-raffle.md#L320-L328) (`lib/firebase/admin.ts`)
2. **Discrepancy Description:** `posts/{mediaId}` only lists `{ mediaId, ownerUsername, drawAttemptCount, lastDrawId, lastDrawnAt }`, omitting the fields needed inside `db.runTransaction()` to check `idempotencyKey` and populate `priorAttempts` on `draws/{drawId}` without a secondary composite-indexed query.
3. **Rationale:** Storing a bounded `attempts: Array<{ drawId: string; attemptNumber: number; executedAt: string; idempotencyKey: string }>` on `posts/{mediaId}` allows a single document read inside `db.runTransaction()` to resolve both idempotency and prior attempts.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Directly resolves the schema gap across `Technical Plan §5` and `lib/firebase/admin.ts`.
6. ***Proposed Edit:***
   a. Location: `Technical Plan §5.1` & `§5.3` (lines 173–195) and `Detailed Implementation Plan` (`lib/firebase/admin.ts`)
   b. Change: Add `attempts: Array<{ drawId: string; attemptNumber: number; executedAt: string; idempotencyKey: string }>` to `PostDrawMetadata` (`posts/{mediaId}`).

### 6. [CA-6: Store Local Development Firestore Fallback File in `os.tmpdir()`] [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major

1. **Affected Scope:** [Lines 320-328](./designs/insta-raffle.md#L320-L328) (`lib/firebase/admin.ts`)
2. **Discrepancy Description:** Writing `.local-firestore.json` into the repository root during local development or verification creates an untracked file outside the Target Files allowlist.
3. **Rationale:** `implementation-readiness-standard.md` enforces a strict repository write allowlist.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Using `path.join(os.tmpdir(), 'insta-raffle-local-firestore.json')` keeps the repository working tree clean.
6. ***Proposed Edit:***
   a. Location: `Detailed Implementation Plan` (`lib/firebase/admin.ts`)
   b. Change: Replace `.local-firestore.json` with `path.join(os.tmpdir(), 'insta-raffle-local-firestore.json')`.

### 7. [CA-7: Specify SHA-256 Key Derivation for `SESSION_SECRET`, Dev Fallback, and Client Component Props] [`egm-codebase-details`, `egm-zoom-out`] - Severity: Major

1. **Affected Scope:** [Line 129](./designs/insta-raffle.md#L129) (`Technical Plan §2`), [Lines 285-292](./designs/insta-raffle.md#L285-L292) (`lib/auth/session.ts`), and [Lines 349-361](./designs/insta-raffle.md#L349-L361) (`components/login-button.tsx`, `components/giveaway-engine.tsx`)
2. **Discrepancy Description:** Requiring a raw 32-byte string for `SESSION_SECRET` throws `RangeError` if the env var length differs from 32 bytes; `components/login-button.tsx` (`'use client'`) cannot read non-`NEXT_PUBLIC_` server env vars directly; and `GiveawayEngineProps` is not explicitly listed.
3. **Rationale:** Prevents runtime key-length errors and server/client prop mismatches during implementation.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Deriving the 32-byte AES-256-GCM key via `SHA-256(process.env.SESSION_SECRET || devFallback)` and explicitly specifying `LoginButtonProps` (`showDemoMode?: boolean`) and `GiveawayEngineProps` eliminates ambiguity.
6. ***Proposed Edit:***
   a. Location: `Technical Plan §2` and `Detailed Implementation Plan` (`lib/auth/session.ts`, `components/login-button.tsx`, `components/giveaway-engine.tsx`)
   b. Change: Specify SHA-256 key derivation with a non-production fallback in `lib/auth/session.ts`, `showDemoMode?: boolean` prop on `LoginButton`, and full `GiveawayEngineProps` on `GiveawayEngine`.

### 8. [CA-8: Promote `Additional Resources` and `Future Improvements` Headings to H2] [`egm-structural`] - Severity: Nit

1. **Affected Scope:** [Lines 254-263](./designs/insta-raffle.md#L254-L263) (`### Additional Resources`, `### Future Improvements`)
2. **Discrepancy Description:** Both headings follow a top-level horizontal rule divider (`---`) after `## Non-Functional Requirements` but use H3 (`###`) instead of H2 (`##`).
3. **Rationale:** Promoting both to H2 (`##`) maintains consistent top-level section hierarchy.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Clean structural fix.
6. ***Proposed Edit:***
   a. Location: Lines 254 and 259
   b. Change: Change `### Additional Resources` and `### Future Improvements` to `## Additional Resources` and `## Future Improvements`.

### 9. [CA-9: Add Explicit `Risks and Mitigations` Item Under `Non-Functional Requirements`] [`egm-structural`] - Severity: Nit

1. **Affected Scope:** [Lines 239-251](./designs/insta-raffle.md#L239-L251) (`## Non-Functional Requirements`)
2. **Discrepancy Description:** `feature-spec-standard.md` looks for an explicit Risks and Mitigations callout.
3. **Rationale:** Adding `4. **Risks and Mitigations**:` under `## Non-Functional Requirements` surfaces the `MAX_PAGES = 100` (5,000 comments) pagination cap, `IG_RATE_LIMITED` / `IG_INCOMPLETE_SYNC` completeness gate, and `syncToken` lock in one place.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Clean structural improvement.
6. ***Proposed Edit:***
   a. Location: `## Non-Functional Requirements` (line 251)
   b. Change: Append item `4. **Risks and Mitigations**:` detailing rate-limit and partial-sync mitigations.

### 10. [CA-10: Specify Optional `InstagramPost` Fields and Automatic Mock Dispatch in `lib/instagram/api.ts`] [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Nit

1. **Affected Scope:** [Lines 293-303](./designs/insta-raffle.md#L293-L303) (`lib/instagram/api.ts`)
2. **Discrepancy Description:** `InstagramPost` needs optional `caption?: string`, `media_url?: string`, `thumbnail_url?: string`, `comments_count?: number`, and `username?: string`, and `getInstagramPosts` / `getPostDetails` / `getPostComments` should automatically return mock fixtures when `accessToken === 'mock_access_token'`.
3. **Rationale:** Matches real `graph.instagram.com` payload optionality and avoids mock-mode branching in callers.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Improves type accuracy and caller ergonomics.
6. ***Proposed Edit:***
   a. Location: `Detailed Implementation Plan` (`lib/instagram/api.ts`)
   b. Change: Specify the updated `InstagramPost` fields and automatic mock dispatch when `accessToken === 'mock_access_token'`.

### 11. [CA-11: Shorten Parenthetical in `Overview`] [`egm-style`] - Severity: Nit

1. **Affected Scope:** [Line 11](./designs/insta-raffle.md#L11) (`## Overview`)
2. **Discrepancy Description:** The second sentence of `## Overview` is 74 words long because its parenthetical repeats all seven qualification rules already listed in `## Goals` #3.
3. **Rationale:** Concise summary in `## Overview` improves readability.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Tightens prose without losing detail.
6. ***Proposed Edit:***
   a. Location: `## Overview` (line 11)
   b. Change: Shorten the parenthetical to `(requiring a single valid @mention per comment, deduplicating tagged friends per commenter up to a per-user entry cap, and enforcing deadline, keyword, and blocklist filters)`.

### 12. [CA-12: Remove Filler Modifier `"100%"` in `Non-Functional Requirements`] [`egm-style`] - Severity: Nit

1. **Affected Scope:** [Line 247](./designs/insta-raffle.md#L247) (`## Non-Functional Requirements` Item 2.b)
2. **Discrepancy Description:** `"must be 100% deterministic string and timestamp logic"` uses a redundant modifier (`"100%"`).
3. **Rationale:** Determinism is binary.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Cleaner technical prose.
6. ***Proposed Edit:***
   a. Location: `## Non-Functional Requirements` Item 2.b (line 247)
   b. Change: Replace `"must be 100% deterministic string and timestamp logic"` with `"must use deterministic string and timestamp logic"`.

### 13. [CA-13: Remove Subjective Qualifier `"prominent"` in Verification Page Spec] [`egm-style`] - Severity: Nit

1. **Affected Scope:** [Line 386](./designs/insta-raffle.md#L386) (`Detailed Implementation Plan` — `app/verify/[drawId]/page.tsx`)
2. **Discrepancy Description:** `"and prominent badge Official Draw Attempt #K"` uses a subjective adjective (`"prominent"`).
3. **Rationale:** Objective phrasing is preferred in specifications.
4. ***AI Suggestion:*** `PROPOSE FIX`
5. ***Justification:*** Cleaner specification prose.
6. ***Proposed Edit:***
   a. Location: `Detailed Implementation Plan` (`app/verify/[drawId]/page.tsx`)
   b. Change: Replace `"and prominent badge Official Draw Attempt #K"` with `"and an Official Draw Attempt #K badge"`.
