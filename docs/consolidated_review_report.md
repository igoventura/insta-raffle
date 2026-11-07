# Consolidated EGM Goldfish Review Report

1. **Target Document**: [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md)
2. **Semantic Split**: `FeatureRange: lines 1..265`, `DetailedRange: lines 266..420`
3. **Stage Reports Generated**:
   a. Stage 5 (Initial Zoom Out & Inventive Catalyst): [`docs/zoom_out_report.md`](./zoom_out_report.md)
   b. Stage 6 (Comprehension Test): [`docs/comprehension_report.md`](./comprehension_report.md)
   c. Stage 7 (Critic Review — Design, Structural, Style): [`docs/critic_report.md`](./critic_report.md)
   d. Stage 8 (Intermediate Zoom Out): [`docs/intermediate_zoom_out_report.md`](./intermediate_zoom_out_report.md)
   e. Stage 9 (Implementation Readiness — Tech Lead, Codebase Details, Style): [`docs/implementation_readiness_report.md`](./implementation_readiness_report.md)

--------------------------------------------------------------------------------

## 1. Executive Summary of Findings

1. **🔴 Blockers**: `0`
2. **🟡 Majors**: `7` consolidated actionable items (deduplicated from 12 raw Major findings across Stages 5, 8, and 9)
3. **🟢 Nits**: `6` consolidated actionable items (deduplicated from 12 raw Nit findings across Stages 5, 6, 7, 8, and 9)

--------------------------------------------------------------------------------

## 2. Consolidated Action Items by Priority

### 🟡 Major Action Items

1. **CA-1 (Stateless HMAC-Signed Comment Snapshot to Prevent Double Pagination & Pool Drift)**:
   a. **Severity**: 🟡 Major
   b. **Source Findings**: `ZO-1`, `IC-1`, `DC-3`, `IZO-1`
   c. **Target Scope**: `Technical Plan §3 & §5.3` (lines 137–142, 192–196) and `Detailed Implementation Plan #5, #12, #14, #18`
   d. **Action Required**: Instead of re-paginating up to 100 Graph API pages inside `POST /api/draws` (which doubles Graph API quota usage and causes preview-to-draw comment drift), have `/dashboard/post/[postId]` compute an HMAC-SHA256 `syncToken` over `{ mediaId, isComplete, comments }` using the server session secret key. Pass `{ comments, isComplete, syncToken }` from `GiveawayEngine` to `POST /api/draws`, which verifies `syncToken` in stateless memory before running `qualifyComments` and `commitAtomicDraw`.

2. **CA-2 (Altitude Separation in `Technical Plan §4` vs. `Detailed Implementation Plan #6`)**:
   a. **Severity**: 🟡 Major
   b. **Source Findings**: `ZO-2`, `IZO-2`, `Comprehension-2`, `DC-2`, `IR-3`
   c. **Target Scope**: `Technical Plan §4` (lines 143–170) and `Detailed Implementation Plan #6` (`lib/giveaway/logic.ts`, lines 304–314)
   d. **Action Required**:
      1. Keep `Technical Plan §4` at the architectural contract level (removing inline JavaScript regex literals, `.toLowerCase().includes(...)`, and local `Map`/`Set` variable names while stating that `PAST_DEADLINE` compares UTC epoch timestamps and `executeAtomicDraw` uses 32-bit unsigned integer rejection sampling over `HMAC-SHA256`).
      2. Place the exact regex literal, epoch comparison (`new Date(comment.timestamp).getTime() > new Date(rules.deadlineIso).getTime()`), 32-bit unsigned integer extraction (`parseInt(hmacHex.slice(0, 8), 16)`), `counter` progression (`0`, incremented by `1` on every HMAC evaluation), rejection threshold (`limit = 0x100000000 - (0x100000000 % (i + 1))`), and pool underflow handling (HTTP 400 when `qualifiedEntries.length === 0`; graceful partial fill when `0 < uniqueEligibleCommenters < N + S`) in `Detailed Implementation Plan #6`.

3. **CA-3 (Order Implementation into Three Buildable, Testable Phases with Checkpoints)**:
   a. **Severity**: 🟡 Major
   b. **Source Findings**: `IR-1`, `CD-1`
   c. **Target Scope**: `Detailed Implementation Plan` (lines 266–415)
   d. **Action Required**: Partition the 22 file changes into three incremental phases so the build never breaks mid-phase:
      1. **Phase 1 — Dependencies & Pure Qualification/Draw Engine + Unit Tests**: `package.json`, `package-lock.json`, `lib/giveaway/logic.ts`, `lib/giveaway/logic.test.ts` (Checkpoint: `npm test` passes).
      2. **Phase 2 — Server Auth, Instagram ACL & Firestore Persistence Adapters**: `lib/auth/session.ts`, `lib/instagram/api.ts`, `lib/firebase/admin.ts`, `firestore.rules`.
      3. **Phase 3 — Route Handlers, UI Components, Pages & Legacy Cleanup**: `app/api/auth/instagram/route.ts`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`, `app/api/draws/route.ts`, `components/login-button.tsx`, `components/giveaway-engine.tsx`, `app/page.tsx`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/post/[postId]/page.tsx`, `app/verify/[drawId]/page.tsx`, `app/privacy/page.tsx`, `README.md`, and delete `lib/supabase/*` and `app/dashboard/[accountId]/page.tsx` last (Checkpoint: `npm test`, `npm run lint`, and `npm run build` pass).

4. **CA-4 (Isomorphic Browser/Server SHA-256 & HMAC-SHA256 in `lib/giveaway/logic.ts`)**:
   a. **Severity**: 🟡 Major
   b. **Source Findings**: `IR-2`
   c. **Target Scope**: `Detailed Implementation Plan #6` (`lib/giveaway/logic.ts`) and `#14` (`components/giveaway-engine.tsx`)
   d. **Action Required**: Specify that `lib/giveaway/logic.ts` uses pure, zero-dependency TypeScript/JavaScript SHA-256 and HMAC-SHA256 functions (no top-level `import crypto from 'crypto'`) so importing `lib/giveaway/logic.ts` inside the `'use client'` component `components/giveaway-engine.tsx` never fails Next.js Webpack client bundling.

5. **CA-5 (Include Inline `attempts` Ledger on `posts/{mediaId}` for O(1) Idempotency and `priorAttempts`)**:
   a. **Severity**: 🟡 Major
   b. **Source Findings**: `IR-4.a`, `CD-2`, `Comprehension-1`, `DC-1`, `IC-2`, `IZO-3`
   c. **Target Scope**: `Technical Plan §5` (lines 171–195) and `Detailed Implementation Plan #8` (`lib/firebase/admin.ts`, lines 320–328)
   d. **Action Required**: Add `attempts: Array<{ drawId: string; attemptNumber: number; executedAt: string; idempotencyKey: string }>` to `PostDrawMetadata` (`posts/{mediaId}`). Inside `db.runTransaction()`, reading `posts/{mediaId}` alone resolves whether `idempotencyKey` was already processed and provides the exact `priorAttempts` list for `DrawAuditSnapshot` without composite-indexed secondary queries.

6. **CA-6 (Store Local Firestore Fallback in `os.tmpdir()` Instead of Repository Root)**:
   a. **Severity**: 🟡 Major
   b. **Source Findings**: `IR-4.b`, `CD-3`
   c. **Target Scope**: `Detailed Implementation Plan #8` (`lib/firebase/admin.ts`, line 323)
   d. **Action Required**: Change the local development fallback path from `.local-firestore.json` in the repository root to `path.join(os.tmpdir(), 'insta-raffle-local-firestore.json')` so running tests or local draws never creates untracked files in the git workspace.

7. **CA-7 (Specify Server/Client Props and Dev Environment Fallbacks)**:
   a. **Severity**: 🟡 Major
   b. **Source Findings**: `CD-4`, `ZO-3`
   c. **Target Scope**: `Detailed Implementation Plan #4` (`lib/auth/session.ts`), `#13` (`components/login-button.tsx`), and `#14` (`components/giveaway-engine.tsx`)
   d. **Action Required**:
      1. In `lib/auth/session.ts`, derive the 32-byte AES-256-GCM key via `SHA-256(process.env.SESSION_SECRET || devFallbackSecret)` so arbitrary-length secrets work and local builds/tests succeed when `.env.local` is unconfigured.
      2. In `components/login-button.tsx`, accept `showDemoMode?: boolean` from the Server Component `app/page.tsx` rather than reading non-`NEXT_PUBLIC_` server env vars in client code.
      3. In `components/giveaway-engine.tsx`, explicitly define `GiveawayEngineProps` (`mediaId`, `postPermalink`, `postCaption`, `hostUsername`, `comments`, `isSyncComplete`, `syncToken`, `initialAttemptCount`, `initialPriorAttempts`).

--------------------------------------------------------------------------------

### 🟢 Nit Action Items

1. **CA-8 (Promote `Additional Resources` and `Future Improvements` Headings to H2)**:
   a. **Severity**: 🟢 Nit
   b. **Source Findings**: `ST-1`
   c. **Target Scope**: Lines 254 and 259 of [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md)
   d. **Action Required**: Change `### Additional Resources` and `### Future Improvements` to `## Additional Resources` and `## Future Improvements`.

2. **CA-9 (Add Explicit `Risks and Mitigations` Sub-item Under `Non-Functional Requirements`)**:
   a. **Severity**: 🟢 Nit
   b. **Source Findings**: `ST-2`
   c. **Target Scope**: `## Non-Functional Requirements` (lines 239–251)
   d. **Action Required**: Add `4. **Risks and Mitigations**:` summarizing the `MAX_PAGES = 100` (5,000 comments) synchronous pagination cap and `IG_RATE_LIMITED` / `IG_INCOMPLETE_SYNC` completeness gate.

3. **CA-10 (Update `InstagramPost` Optional Fields & Automatic Mock Fixture Dispatch in `lib/instagram/api.ts`)**:
   a. **Severity**: 🟢 Nit
   b. **Source Findings**: `CD-5`, `IR-5`
   c. **Target Scope**: `Detailed Implementation Plan #5` (`lib/instagram/api.ts`)
   d. **Action Required**: Specify `comments_count?: number`, `username?: string`, `caption?: string`, `media_url?: string`, and `thumbnail_url?: string` on `InstagramPost`, and state that `getInstagramPosts`, `getPostDetails`, and `getPostComments` automatically return deterministic mock fixtures whenever `accessToken === 'mock_access_token'`.

4. **CA-11 (Tighten `Overview` Sentence Length)**:
   a. **Severity**: 🟢 Nit
   b. **Source Findings**: `SY-1`
   c. **Target Scope**: `## Overview` (line 11)
   d. **Action Required**: Shorten the parenthetical in the second sentence of `## Overview` so it summarizes the qualification rules without repeating all seven items listed in `## Goals` #3.

5. **CA-12 (Remove Filler Modifier `"100%"` in `Non-Functional Requirements`)**:
   a. **Severity**: 🟢 Nit
   b. **Source Findings**: `SY-2`
   c. **Target Scope**: `## Non-Functional Requirements` Item 2.b (line 247)
   d. **Action Required**: Replace `"must be 100% deterministic string and timestamp logic"` with `"must use deterministic string and timestamp logic"`.

6. **CA-13 (Remove Subjective Adjective `"prominent"` in Verification Page Spec)**:
   a. **Severity**: 🟢 Nit
   b. **Source Findings**: `SY-3`
   c. **Target Scope**: `Detailed Implementation Plan #19` (`app/verify/[drawId]/page.tsx`, line 386)
   d. **Action Required**: Replace `"and prominent badge Official Draw Attempt #K"` with `"and an Official Draw Attempt #K badge"`.

--------------------------------------------------------------------------------

## 3. Cross-Stage Traceability Matrix

| Consolidated ID | Priority | Stage 5 (`zoom_out_report.md`) | Stage 6 (`comprehension_report.md`) | Stage 7 (`critic_report.md`) | Stage 8 (`intermediate_zoom_out_report.md`) | Stage 9 (`implementation_readiness_report.md`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CA-1** | 🟡 Major | `ZO-1`, `IC-1` | — | `DC-3` | `IZO-1` | — |
| **CA-2** | 🟡 Major | `ZO-2` | `Comprehension-2` | `DC-2` | `IZO-2` | `IR-3` |
| **CA-3** | 🟡 Major | — | — | — | — | `IR-1`, `CD-1` |
| **CA-4** | 🟡 Major | — | — | — | — | `IR-2` |
| **CA-5** | 🟡 Major | `IC-2` | `Comprehension-1` | `DC-1` | `IZO-3` | `IR-4.a`, `CD-2` |
| **CA-6** | 🟡 Major | — | — | — | — | `IR-4.b`, `CD-3` |
| **CA-7** | 🟡 Major | `ZO-3` | — | — | — | `CD-4` |
| **CA-8** | 🟢 Nit | — | — | `ST-1` | — | — |
| **CA-9** | 🟢 Nit | — | — | `ST-2` | — | — |
| **CA-10** | 🟢 Nit | — | — | — | — | `IR-5`, `CD-5` |
| **CA-11** | 🟢 Nit | — | — | `SY-1` | — | — |
| **CA-12** | 🟢 Nit | — | — | `SY-2` | — | — |
| **CA-13** | 🟢 Nit | — | — | — | — | `SY-3` |
