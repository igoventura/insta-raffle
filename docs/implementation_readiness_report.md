# Stage 9: Implementation Readiness Review Report (`DetailedRange: lines 266..420`)

1. **Target Document**: [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md) (`DetailedRange`: lines 266–420)
2. **Reviewers**: `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`
3. **Standard Applied**: `implementation-readiness-standard.md`

--------------------------------------------------------------------------------

## 1. Implementation Readiness Reviewer Findings (`egm-implementation-readiness`)

### Finding IR-1: Missing Incremental Phasing and Build/Test Checkpoints

1. **Severity**: Major
2. **Affected Scope**: `## Detailed Implementation Plan` (lines 266–415)
3. **Guidance**:
   a. `implementation-readiness-standard.md` requires partitioning the work into incremental phases where each phase leaves the codebase in a buildable and testable state. Currently, lines 270–407 list 22 file operations in a flat sequence where deleting `lib/supabase/*` in Step 2 breaks compilation of `app/page.tsx`, `app/dashboard/layout.tsx`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`, and `components/login-button.tsx` until Steps 10–16 are completed, and replacing `pickWinners` in `lib/giveaway/logic.ts` (Step 6) breaks `components/giveaway-engine.tsx` until Step 14 is completed.
   b. Partition the 22 file changes into three ordered phases with explicit verification checkpoints:
      1. **Phase 1 — Dependencies and Pure Qualification/Draw Engine**: Update `package.json`/`package-lock.json`, implement `lib/giveaway/logic.ts` (retaining a backwards-compatible wrapper or updating alongside callers), and create `lib/giveaway/logic.test.ts`. Checkpoint: `npm test` passes.
      2. **Phase 2 — Server Auth, Instagram ACL, and Firestore Persistence Adapters**: Create `lib/auth/session.ts`, `lib/firebase/admin.ts`, `firestore.rules`, and update `lib/instagram/api.ts`.
      3. **Phase 3 — Route Handlers, UI Components, Pages, and Legacy Cleanup**: Create/update the auth routes, `POST /api/draws`, `components/login-button.tsx`, `components/giveaway-engine.tsx`, `app/page.tsx`, `app/dashboard/*`, `app/verify/[drawId]/page.tsx`, `app/privacy/page.tsx`, `README.md`, and delete `lib/supabase/*` and `app/dashboard/[accountId]/page.tsx`. Checkpoint: `npm test`, `npm run lint`, and `npm run build` succeed.

### Finding IR-2: Client/Server Module Bundling Hazard in `lib/giveaway/logic.ts`

1. **Severity**: Major
2. **Affected Scope**: Target File #6 (`lib/giveaway/logic.ts`, lines 304–314) and Target File #14 (`components/giveaway-engine.tsx`, lines 354–361)
3. **Guidance**:
   a. `components/giveaway-engine.tsx` is a `'use client'` component that imports `qualifyComments` from `@/lib/giveaway/logic` for live `useMemo` dry-run previews. If `lib/giveaway/logic.ts` has a top-level `import crypto from 'crypto'` for `computePoolHash` and `executeAtomicDraw`, Next.js 14 Webpack client bundling will fail (`Module not found: Can't resolve 'crypto'`).
   b. Resolve this by implementing pure, zero-dependency TypeScript/JavaScript SHA-256 and HMAC-SHA256 helpers inside `lib/giveaway/logic.ts` (or splitting server-only Node `crypto` helpers out of the client import graph) so `lib/giveaway/logic.ts` is 100% isomorphic across browser and server.

### Finding IR-3: Underspecified Deterministic `HMAC-SHA256` Rejection Sampling and Pool Underflow Behavior

1. **Severity**: Major
2. **Affected Scope**: `Technical Plan §4.3` (lines 164–170) and Target File #6 (`lib/giveaway/logic.ts`, lines 304–314)
3. **Guidance**:
   a. Specify the exact 32-bit unsigned integer extraction from each HMAC-SHA256 digest (`parseInt(hmacHex.slice(0, 8), 16)`), `counter` initialization (`0`, incremented by `1` on every HMAC evaluation including rejected samples), and unbiased rejection bound (`limit = 0x100000000 - (0x100000000 % (i + 1))`, rejecting when `uint32 >= limit` and otherwise taking `j = uint32 % (i + 1)`).
   b. Specify pool underflow handling: if `qualifiedEntries.length === 0`, `POST /api/draws` returns HTTP 400 without incrementing `drawAttemptCount`; if `0 < uniqueEligibleCommenters < N + S`, `executeAtomicDraw` fills up to $N$ winners first and places any remaining unique commenters into up to $S$ substitutes without throwing an error.

### Finding IR-4: Firestore Transaction Idempotency Lookup, Prior Attempts Storage, and Local Fallback File Path

1. **Severity**: Major
2. **Affected Scope**: `Technical Plan §5` (lines 171–196) and Target File #8 (`lib/firebase/admin.ts`, lines 320–328)
3. **Guidance**:
   a. Include `attempts: Array<{ drawId: string; idempotencyKey: string; attemptNumber: number; executedAt: string }>` directly in `PostDrawMetadata` (`posts/{mediaId}`) so `commitAtomicDraw` can verify `idempotencyKey` and copy `priorAttempts` from the single `posts/{mediaId}` document read inside `db.runTransaction()` without requiring a composite-indexed Firestore query.
   b. Store the local development Firestore fallback file in `path.join(os.tmpdir(), 'insta-raffle-local-firestore.json')` rather than `.local-firestore.json` in the repository root so no untracked files pollute the git working tree.

### Finding IR-5: Seamless Mock Session Handling in `lib/instagram/api.ts`

1. **Severity**: Nit
2. **Affected Scope**: Target File #5 (`lib/instagram/api.ts`, lines 293–303) and Target File #12 (`app/api/draws/route.ts`, lines 344–348)
3. **Guidance**: Specify that `getInstagramPosts`, `getPostDetails`, and `getPostComments` in `lib/instagram/api.ts` automatically return deterministic mock fixtures whenever `accessToken === 'mock_access_token'`, avoiding conditional branching in route handlers and pages.

--------------------------------------------------------------------------------

## 2. Codebase Details Reviewer Findings (`egm-codebase-details`)

### Finding CD-1: Missing Incremental Phasing and Build/Test Checkpoints

1. **Severity**: Major
2. **Affected Scope**: `## Detailed Implementation Plan` (lines 266–415)
3. **Guidance**: Matches Finding IR-1; group the 22 file changes into ordered phases so `lib/supabase/*` is deleted only after its 5 importing files (`app/auth/callback/route.ts`, `app/auth/signout/route.ts`, `components/login-button.tsx`, `app/page.tsx`, `app/dashboard/layout.tsx`) are updated.

### Finding CD-2: Underspecified `PostDrawMetadata` Schema for Idempotency and `priorAttempts`

1. **Severity**: Major
2. **Affected Scope**: `Technical Plan §5` (lines 171–195) and Target File #8 (`lib/firebase/admin.ts`, lines 320–328)
3. **Guidance**: Matches Finding IR-4.a; include `attempts: Array<{ drawId: string; attemptNumber: number; executedAt: string; idempotencyKey: string }>` in `PostDrawMetadata`.

### Finding CD-3: Local Firestore Fallback File Path Pollutes Repository Outside Target File Allowlist

1. **Severity**: Major
2. **Affected Scope**: Target File #8 (`lib/firebase/admin.ts`, lines 320–328)
3. **Guidance**: Matches Finding IR-4.b; use `path.join(os.tmpdir(), 'insta-raffle-firestore.json')` instead of `.local-firestore.json` in the repository root.

### Finding CD-4: Missing Component Props and Environment Variable Contracts Across Server/Client Boundaries

1. **Severity**: Major
2. **Affected Scope**: Target Files #4 (`lib/auth/session.ts`), #13 (`components/login-button.tsx`), and #14 (`components/giveaway-engine.tsx`)
3. **Guidance**:
   a. In `components/login-button.tsx` (`'use client'`), non-`NEXT_PUBLIC_` server env vars like `INSTAGRAM_CLIENT_ID` are unavailable in the browser; specify passing `isOAuthConfigured?: boolean` as a prop from the Server Component `app/page.tsx` (or always offering the Demo Mode button alongside Instagram Login).
   b. In `components/giveaway-engine.tsx`, explicitly define `GiveawayEngineProps` (`mediaId: string`, `postPermalink?: string`, `postCaption?: string`, `hostUsername: string`, `comments: InstagramComment[]`, `isSyncComplete: boolean`, `initialAttemptCount: number`, `initialPriorAttempts: Array<{ drawId: string; attemptNumber: number; executedAt: string }>`).
   c. In `lib/auth/session.ts`, provide a deterministic development fallback secret when `process.env.NODE_ENV !== 'production'` and `SESSION_SECRET` is unset so `npm run build`, `npm test`, and Demo Mode work out of the box without manual `.env.local` edits.

### Finding CD-5: `InstagramPost` Optional Fields in `lib/instagram/api.ts`

1. **Severity**: Nit
2. **Affected Scope**: Target File #5 (`lib/instagram/api.ts`, lines 293–303)
3. **Guidance**: Explicitly update the `InstagramPost` interface to include `comments_count?: number` and `username?: string`, and mark `caption?: string`, `media_url?: string`, and `thumbnail_url?: string` optional where `graph.instagram.com` omits `thumbnail_url` on `IMAGE` media objects.

--------------------------------------------------------------------------------

## 3. Style Reviewer Findings (`egm-style` — `DetailedRange: lines 266..420`)

### Finding SY-3: Subjective Qualifier `"prominent"` in Verification Page Spec

1. **Severity**: Nit
2. **Affected Scope**: Target File #19 (`app/verify/[drawId]/page.tsx`, line 386)
3. **Guidance**: Replace `"and prominent badge Official Draw Attempt #K"` with `"and an Official Draw Attempt #K badge"`.
