# Stage 8: Intermediate Zoom Out Review Report

1. **Target Document**: [`docs/designs/insta-raffle.md`](./designs/insta-raffle.md) (Full File: lines 1–420)
2. **Reviewer**: `egm-zoom-out`
3. **Standard Applied**: `zoom-out-standard.md`
4. **Prior Stage Reports Audited**: [`docs/zoom_out_report.md`](./zoom_out_report.md), [`docs/comprehension_report.md`](./comprehension_report.md), [`docs/critic_report.md`](./critic_report.md)

--------------------------------------------------------------------------------

## 1. Intermediate Zoom Out Findings (`egm-zoom-out`)

### Finding IZO-1: Stateless HMAC-Signed Comment Snapshot Instead of Stateful Cache Tables for `POST /api/draws`

1. **Severity**: Major
2. **Affected Scope**:
   a. `Technical Plan > 3. Instagram Graph API Anti-Corruption Layer` (lines 137–142)
   b. `Technical Plan > 5.3 Atomic Transaction (POST /api/draws)` (lines 192–196)
   c. `Detailed Implementation Plan > 12. app/api/draws/route.ts` (lines 344–348)
3. **Simplicity Rationale**:
   a. Stage 5 (`ZO-1`, `IC-1`) and Stage 7 (`DC-3`) flagged that re-paginating up to 100 Graph API pages inside `POST /api/draws` wastes half of the user's hourly Graph API quota and introduces preview-to-draw comment drift.
   b. Solving this by adding a Firestore comment-cache collection or background invalidation jobs would violate **Non-Goal #5** (Firestore's 1 MiB limit and no raw comment storage) and `zoom-out-standard.md` §2 (*Minimalist Data Flow*). Conversely, an in-process Node memory `Map` breaks across stateless serverless invocations.
   c. **Minimalist Resolution**: Have the server compute an HMAC-SHA256 signature (`syncToken`) over the canonical synced comment snapshot (`mediaId`, `isComplete`, `syncedAt`, and normalized `comments`) using the session secret key when `/dashboard/post/[postId]` loads. When the host clicks "Run Official Draw", the client submits the locked snapshot and `syncToken` to `POST /api/draws`, which verifies the HMAC signature in stateless memory before running `qualifyComments` and `commitAtomicDraw`. This eliminates double pagination and pool drift with zero database cache tables, zero TTL cleanup jobs, and zero extra API routes.

### Finding IZO-2: Preserve Altitude Separation When Clarifying `PAST_DEADLINE` and `hmac-sha256-fy-v1`

1. **Severity**: Major
2. **Affected Scope**:
   a. `Technical Plan > 4. Pure Qualification and Cryptographic Draw Engine` (lines 143–170)
   b. `Detailed Implementation Plan > 6. lib/giveaway/logic.ts` (lines 304–314)
3. **Simplicity Rationale**:
   a. Stage 5 (`ZO-2`) flagged that `Technical Plan (Architecture) §4` drops into code-level implementation expressions, while Stage 6 (`Comprehension #2`) and Stage 7 (`DC-2`) requested clarifying epoch timestamp comparison for `PAST_DEADLINE` and the exact 32-bit unsigned integer extraction and counter progression for `hmac-sha256-fy-v1` rejection sampling.
   b. **Altitude-Safe Resolution**:
      1. In `Technical Plan (Architecture) §4` (lines 143–170), keep the specification at the **architectural contract level**: state that handles are normalized to lowercase without `@`, comments are sorted chronologically (`timestamp ASC, id ASC`), `PAST_DEADLINE` compares parsed UTC epoch timestamps, and `executeAtomicDraw` performs an unbiased Fisher-Yates shuffle using 32-bit unsigned integer rejection sampling over `HMAC-SHA256(serverSeed, "${postId}:${attemptNumber}:${poolHash}:${counter}")` with a monotonically increasing `counter` per HMAC evaluation.
      2. Place the concrete implementation expressions (regex literals, `new Date(comment.timestamp).getTime()`, `parseInt(hmacHex.slice(0, 8), 16)`, `limit = 0x100000000 - (0x100000000 % (i + 1))`, and `Map`/`Set` accumulators) in `Detailed Implementation Plan > 6. lib/giveaway/logic.ts`.

### Finding IZO-3: Bounded Inline `attempts` Ledger on `posts/{mediaId}`

1. **Severity**: Nit
2. **Affected Scope**:
   a. `Technical Plan > 5. Firestore Data Model and Atomic Persistence` (lines 173–196)
   b. `Detailed Implementation Plan > 8. lib/firebase/admin.ts` (lines 320–328)
3. **Simplicity Rationale**:
   a. Resolving `IC-2`, `Comprehension #1`, and `DC-1` by storing `attempts: Array<{ drawId: string, attemptNumber: number, executedAt: string, idempotencyKey: string }>` inline on `posts/{mediaId}` simplifies the architecture: it lets `commitAtomicDraw` verify `idempotencyKey` and populate `priorAttempts` from a single `posts/{mediaId}` document read inside `db.runTransaction()` without composite index queries.
   b. At ~120 bytes per attempt entry, even 100 draw attempts on a single post consume under 12 KB, requiring no secondary subcollection.
