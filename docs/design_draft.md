# Instagram Comment Raffle Web Application (Insta-Raffle)

1. **Author:** Igo Ventura
2. **Status:** Approved
3. **Date:** 2026-11-07

--------------------------------------------------------------------------------

## Overview

Insta-Raffle is a web application built with Next.js 14 and Firebase that enables Instagram Business and Creator account owners to run verifiable, rule-based comment raffles on their Instagram posts. Using the official Instagram API with Instagram Login (`graph.instagram.com`), the application fetches top-level comments on a post, filters them through deterministic qualification rules (requiring a single valid `@mention` per comment, deduplicating tagged friends per commenter up to a per-user entry cap, and enforcing deadline, keyword, and blocklist filters), and executes an atomic, cryptographically seeded draw to select $N$ unique winners and $S$ ordered substitutes. Every executed draw increments an append-only attempt counter for the post and produces a permanent, shareable verification page (`/verify/[drawId]`).

## The Problem

Creators and businesses running comment-based giveaways on Instagram face four recurring problems that existing ad-hoc tools and the initial prototype fail to solve:

1. **Authentication and Onboarding Friction**: The initial prototype required Facebook Login (`graph.facebook.com/me/accounts`), forcing every Instagram creator to link their Instagram account to a Facebook Page and grant Facebook Page management permissions before seeing their posts. Furthermore, the prototype lacked the `pages_show_list` and `pages_read_engagement` scopes, causing account discovery to fail silently, and never implemented the post draw route (`/dashboard/[accountId]/post/[postId]`).
2. **Gaming and Ambiguous Mention Counting**: Simple regular-expression matching (`/@[\w\.]+/g`) allows entrants to game a giveaway by tagging themselves, tagging the giveaway host, tagging multiple accounts in a single comment to inflate counts, or repeatedly tagging the same friend across dozens of comments to flood the entry pool.
3. **Biased Randomness and Secret Re-Rolling**: Selecting winners in browser memory using `.sort(() => 0.5 - Math.random())` produces a statistically biased distribution rather than a uniform draw. Worse, client-side drawing lets a host click "Draw Now" repeatedly in private until a preferred account wins, eroding audience trust.
4. **Post-Draw Disqualifications Without Ordered Backups**: When a primary winner fails to respond or does not meet post-draw checks, hosts either run an entirely new draw (invalidating the original results) or pick a replacement without a pre-established order.

Insta-Raffle solves these problems by authenticating directly via the Instagram API with Instagram Login (`graph.instagram.com`), applying a strict chronological qualification pipeline with a live dry-run preview before drawing, and executing a single server-side atomic draw that selects $N$ unique winners and $S$ ordered substitutes while recording the draw attempt number and cryptographic proof in Firestore.

## Goals

1. **Direct Instagram Professional Authentication**: Authenticate Instagram Business and Creator accounts directly through the Instagram API with Instagram Login (`api.instagram.com` and `graph.instagram.com`) using `instagram_business_basic` and `instagram_business_manage_comments` permissions, without requiring a linked Facebook Page.
2. **Complete Top-Level Comment Sync**: Paginate and fetch all top-level comments on a selected Instagram post (ignoring nested comment replies) with visible progress feedback, a completeness check ensuring pagination finishes before an official draw can be executed, and a server-signed snapshot token (`syncToken`) locking the synced comment pool between preview and draw.
3. **Deterministic Comment Qualification**: Evaluate comments in ascending chronological order (`timestamp ASC`, `id ASC`) so that only commenters enter the raffle pool and a comment qualifies as 1 entry if and only if:
   a. It contains strictly 1 valid `@mention` (`0` mentions or `2+` mentions disqualify the comment).
   b. The `@mention` is neither the commenter (`commenter === mentioned`) nor the post owner (`postOwner === mentioned`).
   c. Neither the commenter nor the `@mention` appears on the host's custom username blocklist.
   d. The commenter has not already tagged that same `@mention` in an earlier valid comment on the same post.
   e. The commenter has not yet reached the host-configured maximum entries cap (`maxEntriesPerUser`).
   f. The comment timestamp is at or before the optional cutoff deadline (compared as UTC epoch milliseconds), and the comment text contains the optional required keyword or hashtag.
4. **Dry-Run Qualification Preview**: Show the host the total fetched comments, qualified entries, unique eligible commenters, and an explicit count of rejected comments grouped by disqualification reason before any official draw is committed.
5. **Single Atomic Draw with Ordered Substitutes**: Select $N$ unique winners and $S$ ordered substitutes in a single server-side pass using a deterministic, cryptographically seeded Fisher-Yates shuffle where each qualified entry is one ticket, and once a user is drawn, their remaining tickets are skipped (`Winners ∩ Substitutes = ∅`).
6. **Tamper-Evident Public Verification**: Persist an immutable, schema-versioned `DrawAuditSnapshot` (< 50 KB) in Cloud Firestore inside the same server transaction that increments the post's `drawAttemptCount`, and expose a read-only public verification URL (`/verify/[drawId]`) displaying the draw attempt number, frozen rules, qualification summary, cryptographic pool hash and seed, $N$ winners, and $S$ ordered substitutes.

## Non-Goals

1. **Nested Replies**: Fetching, parsing, or qualifying threaded replies (`/{ig-comment-id}/replies`) is out of scope; only top-level comments on the media object are evaluated.
2. **Entering Tagged Users into the Pool**: People who are only `@mentioned` inside someone else's comment do not enter the draw pool; only the comment author enters.
3. **External Account Existence, Celebrity, or Follower Verification**: Querying third-party APIs or large language models to check whether a `@mentioned` handle is an active account, a celebrity/brand account, or whether the commenter follows the host is out of scope for this version due to Instagram Graph API restrictions.
4. **Unauthenticated Public URL Scraping**: Scraping comments from arbitrary Instagram post URLs without OAuth authentication by the post owner is out of scope.
5. **Public Raw Comment Dumps**: Persisting or publishing the full list of raw comments or non-winning commenters' usernames on the public verification document is out of scope to comply with Firestore's 1 MiB document limit and Meta Platform Terms.

## Open Questions

1. None at this stage; all foundational product and architectural questions from ideation and review have been resolved in [`docs/concepts_brief.md`](../concepts_brief.md) and [`docs/goldfish_review_report.md`](../goldfish_review_report.md).

## Critical User Journeys (CUJs)

### CUJ 1: Host Authenticates and Syncs Post Comments

1. **Given**: A creator with an Instagram Business or Creator account visits the Insta-Raffle landing page (`/`) while logged out.
2. **When**: The creator clicks "Continue with Instagram", authorizes `instagram_business_basic` and `instagram_business_manage_comments`, and selects a giveaway post from `/dashboard`.
3. **Then**: The application stores the encrypted session token in an `httpOnly` cookie, navigates to `/dashboard/post/[postId]`, paginates all top-level comments from `graph.instagram.com`, signs the synced snapshot with a server `syncToken`, and displays the total synced comment count alongside the rule configuration form.

### CUJ 2: Host Previews Qualification Rules and Executes an Official Atomic Draw

1. **Given**: All top-level comments for `postId` are synced in `/dashboard/post/[postId]`, and the host configures $N = 3$ winners, $S = 2$ substitutes, `maxEntriesPerUser = 3`, a cutoff deadline, an optional keyword, and a blocklist.
2. **When**: The host reviews the live Dry-Run Qualification Preview (verifying how many comments qualified and why others were excluded) and clicks "Run Official Draw".
3. **Then**: The server verifies the `syncToken` over the locked comment snapshot, executes an atomic Firestore transaction that increments `drawAttemptCount` for `postId` (for example, to `Attempt #1`), runs the cryptographically seeded draw to select 3 unique winners and 2 unique ordered substitutes, persists the immutable `DrawAuditSnapshot` at `draws/{drawId}`, and displays the winners, substitutes, and shareable `/verify/[drawId]` link.

### CUJ 3: Participant Audits a Shared Raffle Result

1. **Given**: A giveaway host shares `/verify/[drawId]` in their Instagram Story or post caption.
2. **When**: A raffle participant opens `/verify/[drawId]` in any browser without logging in.
3. **Then**: The page renders the immutable audit record showing the post link, `Draw Attempt #K` (plus links/timestamps of any prior attempts on that post), the exact frozen rules used, the qualification funnel counts, the SHA-256 `poolHash` and `serverSeed`, the $N$ primary winners, and the $S$ ordered substitutes.

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

### 1. System Architecture and Data Flow

The application separates interactive browser state (rule configuration and live dry-run preview) from privileged server operations (Instagram OAuth token exchange, Graph API pagination, stateless snapshot signature verification, and atomic Firestore draw persistence). All sensitive tokens remain in an encrypted `httpOnly` cookie on the server, and all Firestore reads and writes execute exclusively through the Firebase Admin SDK (`firebase-admin`) inside Next.js Server Components and Route Handlers.

```text
+-----------------------------------------------------------------------------------+
|                                   Browser Client                                  |
|                                                                                   |
|  1. /dashboard (Select Post)                                                      |
|  2. /dashboard/post/[postId] (GiveawayEngine: Dry-Run Preview & Rule Tuning)      |
|  3. /verify/[drawId] (Public Read-Only Verification Page)                         |
+-------------------+-----------------------------------+---------------------------+
                    |                                   |
   GET /api/auth/*  |                                   | POST /api/draws
   Server Render    |                                   | (idempotencyKey + rules +
                    |                                   |  comments + syncToken)
                    v                                   v
+-----------------------------------------------------------------------------------+
|                             Next.js 14 Server Runtime                             |
|                                                                                   |
|  1. Auth & Snapshot Signing Layer (lib/auth/session.ts)                           |
|     a. AES-256-GCM encrypted httpOnly cookie (insta_raffle_session)               |
|     b. HMAC-SHA256 syncToken signer/verifier for locked comment snapshots         |
|  2. Instagram ACL Adapter (lib/instagram/api.ts)                                  |
|     a. Normalizes graph.instagram.com media and top-level comments                |
|  3. Pure Isomorphic Raffle Domain Engine (lib/giveaway/logic.ts)                  |
|     a. qualifyComments(): chronological sort + 9-rule filter + funnel breakdown   |
|     b. executeAtomicDraw(): SHA-256 poolHash + HMAC-SHA256 Fisher-Yates shuffle   |
|  4. Persistence Adapter (lib/firebase/admin.ts)                                   |
|     a. Atomic db.runTransaction() over posts/{mediaId} and draws/{drawId}         |
+-------------------+-----------------------------------+---------------------------+
                    |                                   |
   HTTPS (OAuth &   |                                   | Firebase Admin SDK
   Cursor Paging)   |                                   | (Server-Only gRPC/HTTPS)
                    v                                   v
+---------------------------------------+   +---------------------------------------+
|   Instagram API with Instagram Login  |   |            Cloud Firestore            |
|   (api.instagram.com /                |   |                                       |
|    graph.instagram.com)               |   |  1. posts/{mediaId} (attempt ledger)  |
|  1. /me & /me/media                   |   |  2. draws/{drawId} (DrawAuditSnapshot)|
|  2. /{mediaId}/comments (top-level)   |   |  Security Rules: read/write false     |
+---------------------------------------+   +---------------------------------------+
```

### 2. Authentication, Session Management, and Snapshot Signing (`lib/auth/session.ts`)

Because Firebase Authentication does not provide a native provider for the Instagram API with Instagram Login, authentication uses a direct OAuth 2.0 authorization code flow backed by a server-encrypted `httpOnly` cookie:

1. **Authorization Redirect (`GET /api/auth/instagram`)**:
   a. Generates a cryptographic `state` nonce stored in a short-lived `httpOnly` cookie (`insta_oauth_state`).
   b. Redirects the user to `https://www.instagram.com/oauth/authorize` with `client_id`, `redirect_uri` (`/auth/callback`), `response_type=code`, `state`, and `scope=instagram_business_basic,instagram_business_manage_comments`.
2. **Callback and Token Exchange (`GET /auth/callback`)**:
   a. Verifies the `state` parameter against `insta_oauth_state` to prevent cross-site request forgery.
   b. Exchanges `code` via `POST https://api.instagram.com/oauth/access_token` for a short-lived Instagram User access token and `user_id`.
   c. Exchanges the short-lived token via `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token` for a 60-day long-lived access token.
   d. Fetches the authenticated account profile (`id`, `username`, `name`, `profile_picture_url`) from `GET https://graph.instagram.com/v21.0/me`.
   e. Encrypts the session payload (`accessToken`, `igUserId`, `username`, `name`, `profilePictureUrl`, `expiresAt`) using Node `crypto` `aes-256-gcm` keyed by the 32-byte SHA-256 digest of `SESSION_SECRET` (with a deterministic development fallback secret when `NODE_ENV !== 'production'` and `SESSION_SECRET` is unset) and stores it in an `httpOnly`, `SameSite=Lax`, `Secure` cookie (`insta_raffle_session`).
3. **Stateless Comment Snapshot Signing (`signCommentSnapshot` / `verifyCommentSnapshot`)**:
   a. When `/dashboard/post/[postId]` finishes syncing top-level comments, the server computes an HMAC-SHA256 `syncToken` over the canonical snapshot (`mediaId`, `isComplete`, and the synced comments list) using the derived session key.
   b. When the host submits an official draw to `POST /api/draws`, the server verifies `syncToken` against the submitted snapshot in stateless memory, ensuring comments are fetched from Instagram at most once per sync and preventing preview-to-draw comment pool drift.
4. **Development Fallback Mode**: When `INSTAGRAM_CLIENT_ID` is not configured in local development, a dedicated development login option allows testing the full dashboard, qualification preview, and Firestore draw flow using deterministic mock post and comment fixtures.

### 3. Instagram Graph API Anti-Corruption Layer (`lib/instagram/api.ts`)

The adapter isolates all `graph.instagram.com` HTTP requests and converts external payloads into normalized internal TypeScript interfaces (`InstagramAccount`, `InstagramPost`, `InstagramComment`, `CommentSyncResult`):

1. **Single-Account Post Listing (`getInstagramPosts`)**: Calls `GET https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,username&limit=24`. Because Instagram Login tokens are already scoped to a single Instagram Professional account, the legacy `/dashboard/[accountId]` route is removed; `/dashboard` renders the user's posts directly and links to `/dashboard/post/[postId]`.
2. **Top-Level Comment Pagination (`getPostComments`)**:
   a. Queries `GET https://graph.instagram.com/v21.0/{mediaId}/comments?fields=id,text,username,timestamp,like_count&limit=50`.
   b. Explicitly omits the `replies` field/edge so nested replies are never fetched or counted.
   c. Loops through `paging.next` cursors up to a safety limit (`MAX_PAGES = 100`, or 5,000 top-level comments for synchronous requests) while tracking `pagesFetched`, `fetchDurationMs`, and whether the cursor reached terminal exhaustion (`isComplete = !data.paging?.next`).
   d. Maps HTTP 401/403 responses to `IG_AUTH_EXPIRED`, HTTP 429 or Meta rate-limit codes (`4`, `32`, `613`) to `IG_RATE_LIMITED`, and partial pagination interruption to `IG_INCOMPLETE_SYNC`.

### 4. Pure Isomorphic Qualification and Cryptographic Draw Engine (`lib/giveaway/logic.ts`)

All comment filtering and winner selection logic resides in pure, deterministic, zero-dependency TypeScript functions that execute identically in browser Client Components (`useMemo` preview) and Next.js Server Route Handlers:

1. **Handle Normalization and Mention Extraction (`extractMentions`)**:
   a. Normalizes Instagram usernames to lowercase without a leading `@`.
   b. Extracts valid Instagram `@mentions` (1 to 30 characters of alphanumeric, underscore, or period characters preceded by start-of-string or a non-word boundary), ignoring email addresses and stripping trailing sentence periods.
2. **Deterministic Qualification Pipeline (`qualifyComments`)**:
   a. Sorts raw comments in canonical ascending chronological order (`timestamp ASC`, tie-broken by `id ASC`).
   b. Evaluates each comment sequentially against nine ordered rules and records an explicit `DisqualificationReason` (`PAST_DEADLINE`, `MISSING_KEYWORD`, `NO_MENTION`, `MULTIPLE_MENTIONS`, `SELF_MENTION`, `HOST_MENTION`, `BLOCKED_HANDLE`, `DUPLICATE_TAGGED_FRIEND`, or `EXCEEDED_USER_CAP`) if rejected, comparing deadline cutoffs using UTC epoch timestamps and tracking unique tagged friends per commenter in chronological order up to `maxEntriesPerUser`.
   c. Returns `QualificationResult` containing `qualifiedEntries`, `disqualifiedComments` (with reasons), `funnelCounts` (exact count per `DisqualificationReason`), and `uniqueEligibleCommenters`.
3. **Cryptographically Seeded Weighted Draw Without User Replacement (`executeAtomicDraw`)**:
   a. Computes a SHA-256 hex digest (`poolHash`) of the canonicalized `qualifiedEntries` list.
   b. Performs an unbiased Fisher-Yates shuffle over the qualified ticket pool using 32-bit unsigned integer rejection sampling derived from `HMAC-SHA256(serverSeed, "${postId}:${attemptNumber}:${poolHash}:${counter}")` with a monotonically increasing `counter` per HMAC evaluation.
   c. Iterates through the shuffled tickets in a single pass to select up to $N + S$ unique `username`s: when a ticket is drawn, its author claims the next slot and any remaining tickets belonging to that same `username` are bypassed (`Winners ∩ Substitutes = ∅`).
   d. Assigns the first $N$ drawn entries as `winners` and the next $S$ drawn entries as ordered `substitutes` (`rank: 1 .. S`).

### 5. Firestore Data Model and Atomic Persistence (`lib/firebase/admin.ts`)

1. **Collection `posts/{mediaId}` (`PostDrawMetadata`)**:
   a. Tracks per-post draw state and the bounded attempt ledger:
      1. `mediaId`: string
      2. `ownerUsername`: string
      3. `drawAttemptCount`: number
      4. `lastDrawId`: string
      5. `lastDrawnAt`: string
      6. `attempts`: `Array<{ drawId: string, attemptNumber: number, executedAt: string, idempotencyKey: string }>`
2. **Collection `draws/{drawId}` (`DrawAuditSnapshot`)**:
   a. Immutable, self-contained document (< 50 KB) with schema:
      1. `schemaVersion`: `1`
      2. `drawId`: UUID v4
      3. `idempotencyKey`: string (client-generated per draw click)
      4. `mediaId`: string
      5. `postPermalink`: string
      6. `postCaption`: string
      7. `ownerUsername`: string
      8. `attemptNumber`: number (1-based sequential counter for `mediaId`)
      9. `executedAt`: ISO-8601 UTC string
      10. `rules`: `{ numWinners: number, numSubstitutes: number, maxEntriesPerUser: number, deadlineIso: string | null, requiredKeyword: string | null, blockedHandles: string[] }`
      11. `funnelCounts`: `{ totalFetched: number, qualifiedEntries: number, uniqueEligibleCommenters: number, rejectedByReason: Record<DisqualificationReason, number> }`
      12. `verification`: `{ algorithmVersion: 'hmac-sha256-fy-v1', poolHash: string, serverSeed: string }`
      13. `winners`: `Array<{ rank: number, commentId: string, username: string, mentionedHandle: string, text: string, timestamp: string }>`
      14. `substitutes`: `Array<{ rank: number, commentId: string, username: string, mentionedHandle: string, text: string, timestamp: string }>`
      15. `priorAttempts`: `Array<{ drawId: string, attemptNumber: number, executedAt: string }>`
3. **Atomic Transaction (`POST /api/draws`)**:
   a. Validates the host's session cookie, verifies `isComplete === true` and the HMAC `syncToken` over the locked comment snapshot, and runs `qualifyComments` on the server (returning HTTP 400 without incrementing `drawAttemptCount` if `qualifiedEntries.length === 0`).
   b. Inside `db.runTransaction()`, reads `posts/{mediaId}`. If an entry in `postDoc.attempts` already matches `idempotencyKey`, reads and returns the existing `draws/{drawId}` snapshot without incrementing `drawAttemptCount`.
   c. Otherwise increments `drawAttemptCount` to `nextAttempt = (postDoc.drawAttemptCount || 0) + 1`, populates `priorAttempts` from `postDoc.attempts`, runs `executeAtomicDraw(..., nextAttempt)`, writes `draws/{drawId}`, and appends the new attempt summary to `posts/{mediaId}` atomically.

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative 1: Instagram API with Facebook Login (`graph.facebook.com`)

1. **Pros**: Supported by legacy OAuth providers (such as Supabase's built-in `facebook` provider) and allows managing multiple Instagram Business accounts linked to different Facebook Pages from a single login.
2. **Cons**: Forces every Instagram creator to create and link a Facebook Page to their Instagram Professional account, requires additional Facebook Page scopes (`pages_show_list`, `pages_read_engagement`), and requires an extra account-selection screen (`/dashboard/[accountId]`) before showing posts.
3. **Reason for Rejection**: Rejected by author: The **Instagram API with Instagram Login** (`graph.instagram.com`) authenticates Instagram Business and Creator accounts directly without requiring a linked Facebook Page and scopes the session directly to the creator's Instagram account.

### Alternative 2: Supabase Backend and Database

1. **Pros**: Was partially wired in the initial prototype (`@supabase/ssr`, `@supabase/supabase-js`) and offers a relational PostgreSQL schema.
2. **Cons**: Supabase Auth lacks a built-in OAuth provider for the Instagram API with Instagram Login, and storing self-contained, immutable JSON audit snapshots with atomic per-post counter increments fits a document database without relational join overhead.
3. **Reason for Rejection**: Rejected by author: Replaced with **Firebase (Cloud Firestore via `firebase-admin`)** to store self-contained `DrawAuditSnapshot` documents and atomic post attempt counters.

### Alternative 3: Accepting Comments with 2+ `@mentions` (Taking the First Unused Mention)

1. **Pros**: Forgives users who tag multiple friends in a single comment when the giveaway rules ask for 1 tag per comment.
2. **Cons**: Introduces ambiguity in deduplication order when a user tags multiple handles across multiple comments (for example, deciding whether to inspect only the first mention or scan forward to the next unused mention in the same comment).
3. **Reason for Rejection**: Rejected by author: Enforcing **strictly 1 `@mention` per comment** (and discarding comments with 0 or 2+ `@mentions` with a clear `MULTIPLE_MENTIONS` rejection reason in the preview) keeps the qualification rule deterministic and simple to explain and audit.

### Alternative 4: Entering Both Commenters and Tagged Friends into the Raffle Pool

1. **Pros**: Allows tagged friends to win even if they do not leave a comment themselves.
2. **Cons**: Incentivizes users to tag inactive accounts or secondary accounts they control to double their odds, and complicates contact verification because the tagged person never interacted with the post.
3. **Reason for Rejection**: Rejected by author: **Only the commenter enters the raffle pool**, while tagging distinct friends across separate comments lets the commenter accumulate entries up to `maxEntriesPerUser`.

### Alternative 5: Drawing Substitutes On-Demand After the Initial Draw

1. **Pros**: Only draws a replacement when a primary winner fails to respond.
2. **Cons**: Allows a dishonest host to click "Draw Substitute" repeatedly until a favored username appears, undermining the auditability of the draw.
3. **Reason for Rejection**: Rejected by author: **Selecting $N$ winners and $S$ ordered substitutes in a single atomic draw** establishes a fixed, tamper-evident backup order at draw time.

### Alternative 6: Client-Side Winner Selection (`Math.random()` in Browser Memory)

1. **Pros**: Zero server latency and requires no backend transaction to compute winners.
2. **Cons**: `.sort(() => 0.5 - Math.random())` is statistically biased, cannot be verified by third parties, and enables hosts to re-run the draw in browser memory without incrementing the public draw attempt counter.
3. **Reason for Rejection**: Rejected during Goldfish review: Replaced with a **server-only atomic transaction** that increments `drawAttemptCount` and writes the cryptographic `poolHash` and `serverSeed` before returning winners to the client.

--------------------------------------------------------------------------------

## Non-Functional Requirements

1. **Security and Privacy**:
   a. Instagram OAuth access tokens must never be exposed to client-side JavaScript or stored in Firestore; they must reside exclusively in an AES-256-GCM encrypted `httpOnly` cookie (`insta_raffle_session`).
   b. Firestore Security Rules must deny all direct client reads and writes (`allow read, write: if false;`), routing all persistence through server-side `firebase-admin`.
   c. Public verification documents (`draws/{drawId}`) must store only summary counts, rule snapshots, cryptographic hashes (`poolHash`, `serverSeed`), and the winning/substitute comments—never the full raw list of non-winning commenters.
2. **Performance and Quotas**:
   a. Every Firestore `DrawAuditSnapshot` document must remain under 50 KB (well below Firestore's 1 MiB document ceiling) regardless of post comment volume.
   b. The qualification engine must use deterministic string and timestamp logic with zero LLM calls so that filtering 5,000 comments completes in under 50 ms in memory.
   c. Public verification pages (`/verify/[drawId]`) must be cached via Next.js Incremental Static Regeneration / cache headers since completed draw snapshots are immutable.
3. **Rollout and Rollback**:
   a. Every `DrawAuditSnapshot` document includes `schemaVersion: 1` so future schema additions do not break existing `/verify/[drawId]` URLs.
4. **Risks and Mitigations**:
   a. **Graph API Rate Limits and Serverless Timeouts**: Synchronous cursor pagination is capped at `MAX_PAGES = 100` (5,000 top-level comments), and the synced comment snapshot is locked with a server HMAC `syncToken` so `POST /api/draws` never re-paginates `graph.instagram.com`.
   b. **Incomplete Comment Syncs**: If cursor pagination stops early due to rate limiting (`IG_RATE_LIMITED`) or upstream errors (`IG_INCOMPLETE_SYNC`), `isComplete` is set to `false` and official draw execution is blocked until a complete sync succeeds.

--------------------------------------------------------------------------------

## Additional Resources

1. [Instagram API with Instagram Login Documentation](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login)
2. [Predecessor Brainstorm Brief (`docs/concepts_brief.md`)](../concepts_brief.md)

## Future Improvements

1. **Celebrity and Fake Account Filtering**: Add an optional background verification step or curated blocklist to detect and discard comments that tag verified celebrity or brand accounts rather than personal friends.
2. **Incremental Background Comment Sync for Viral Posts (50,000+ Comments)**: Offload pagination for massive posts to a background job storing compressed comment chunks in Firebase Cloud Storage so posts exceeding 5,000 comments can be synced across multiple rate-limit windows.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

The implementation is partitioned into three sequential, buildable phases so that dependencies, pure domain logic, server adapters, and UI/routes can be verified incrementally without breaking the build mid-flight.

### Phase 1: Dependencies, Isomorphic Qualification/Draw Engine, and Unit Tests

#### 1. [`../../package.json`](../../package.json) and [`../../package-lock.json`](../../package-lock.json) (Modify)

1. **Type / Scope**: Package Manifest and Dependency Graph
2. **Rationale and Proposed Changes**: Remove legacy Supabase dependencies (`@supabase/ssr`, `@supabase/supabase-js`), add `firebase-admin` for server-side Firestore transactions, add `vitest` as a devDependency, and add `"test": "vitest run"` to `scripts` so the pure qualification and draw engine can be unit-tested independently.

#### 2. [`../../lib/giveaway/logic.ts`](../../lib/giveaway/logic.ts) (Modify)

1. **Type / Scope**: Pure Isomorphic Domain Qualification and Cryptographic Draw Engine
2. **Rationale and Proposed Changes**: Replace the biased `.sort(() => 0.5 - Math.random())` implementation with pure, zero-I/O, zero-Node-`crypto` deterministic functions (using pure TypeScript SHA-256 and HMAC-SHA256 implementations so importing `@/lib/giveaway/logic` inside `'use client'` components never triggers Next.js Webpack `crypto` bundling errors):
   a. `DisqualificationReason` union type (`'PAST_DEADLINE' | 'MISSING_KEYWORD' | 'NO_MENTION' | 'MULTIPLE_MENTIONS' | 'SELF_MENTION' | 'HOST_MENTION' | 'BLOCKED_HANDLE' | 'DUPLICATE_TAGGED_FRIEND' | 'EXCEEDED_USER_CAP'`).
   b. `GiveawayRules` interface (`numWinners: number`, `numSubstitutes: number`, `maxEntriesPerUser: number`, `hostUsername: string`, `deadlineIso?: string | null`, `requiredKeyword?: string | null`, `blockedHandles?: string[]`).
   c. `normalizeHandle(raw: string): string` (`raw.trim().toLowerCase().replace(/^@/, '')`) and `extractMentions(text: string): string[]` using `/(?:^|[^\w.])@([a-zA-Z0-9._]{1,30})(?![a-zA-Z0-9._])/g`, stripping trailing sentence periods (`replace(/\.+$/, '')`) and rejecting handles with consecutive periods (`..`) or email addresses (`user@domain.com`).
   d. `qualifyComments(comments: InstagramComment[], rules: GiveawayRules): QualificationResult`:
      1. Sorts raw comments in ascending chronological order: `new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()`, tie-broken by `a.id.localeCompare(b.id)`.
      2. Evaluates each comment against the 9 ordered rules using a `Map<string, Set<string>>` (`userTaggedFriends`):
         a. `PAST_DEADLINE`: `rules.deadlineIso` is non-empty and `new Date(comment.timestamp).getTime() > new Date(rules.deadlineIso).getTime()`.
         b. `MISSING_KEYWORD`: `rules.requiredKeyword` is non-empty and `!comment.text.toLowerCase().includes(rules.requiredKeyword.trim().toLowerCase())`.
         c. `NO_MENTION`: `extractedMentions.length === 0`.
         d. `MULTIPLE_MENTIONS`: `extractedMentions.length >= 2`.
         e. `SELF_MENTION`: `mentionedHandle === commenterHandle`.
         f. `HOST_MENTION`: `mentionedHandle === hostHandle`.
         g. `BLOCKED_HANDLE`: `blockedSet.has(commenterHandle) || blockedSet.has(mentionedHandle)`.
         h. `DUPLICATE_TAGGED_FRIEND`: `userTaggedFriends.get(commenterHandle)?.has(mentionedHandle)` is true.
         i. `EXCEEDED_USER_CAP`: `(userTaggedFriends.get(commenterHandle)?.size ?? 0) >= rules.maxEntriesPerUser`.
      3. Records qualified tickets and returns `QualificationResult` (`qualifiedEntries`, `disqualifiedComments`, `funnelCounts`, `uniqueEligibleCommenters`).
   e. `sha256Hex(message: string): string`, `hmacSha256Hex(key: string, message: string): string`, and `computePoolHash(qualifiedEntries: QualifiedEntry[]): string` (pure TypeScript SHA-256 hex digest of canonical JSON `qualifiedEntries.map(e => ({ id: e.id, username: e.commenterHandle, mentionedHandle: e.mentionedHandle, timestamp: e.timestamp }))`).
   f. `executeAtomicDraw(qualifiedEntries: QualifiedEntry[], rules: GiveawayRules, seedInput: { serverSeed: string; postId: string; attemptNumber: number }): AtomicDrawOutput`:
      1. Computes `poolHash = computePoolHash(qualifiedEntries)`.
      2. Initializes `counter = 0` and performs a Fisher-Yates shuffle from `i = pool.length - 1` down to `1`: for each `i` (`range = i + 1`, `limit = 0x100000000 - (0x100000000 % range)`), repeatedly computes `hmacHex = hmacSha256Hex(serverSeed, "${postId}:${attemptNumber}:${poolHash}:${counter}")`, increments `counter++` on every evaluation, extracts unsigned 32-bit integer `uint32 = parseInt(hmacHex.slice(0, 8), 16) >>> 0`, and repeats if `uint32 >= limit`; otherwise swaps index `i` with `j = uint32 % range`.
      3. Iterates through the shuffled tickets in a single pass, selecting unique `commenterHandle`s into `drawnEntries` until `drawnEntries.length === rules.numWinners + rules.numSubstitutes` or the pool is exhausted (if `0 < uniqueEligibleCommenters < numWinners + numSubstitutes`, fills up to `numWinners` first and places remaining unique commenters into `substitutes`).
      4. Slices `0 .. numWinners` as `winners` (`rank: 1 .. N`) and `numWinners .. numWinners + numSubstitutes` as `substitutes` (`rank: 1 .. S`).

#### 3. [`../../lib/giveaway/logic.test.ts`](../../lib/giveaway/logic.test.ts) (Create)

1. **Type / Scope**: Unit Test Suite (`vitest`)
2. **Rationale and Proposed Changes**: Verify handle normalization, email vs. `@mention` disambiguation, trailing period stripping, strict 1-mention filtering (`0` and `2+` mentions rejected), self-tag and host-tag rejection, blocklist filtering, UTC epoch deadline filtering across timezone offsets, chronological cross-comment duplicate tagged friend rejection, `maxEntriesPerUser` capping, deterministic `poolHash` generation, and `executeAtomicDraw` reproducibility, rejection sampling determinism, pool underflow handling, and winner/substitute uniqueness (`Winners ∩ Substitutes = ∅`).
3. **Phase 1 Checkpoint**: Run `npm test` (`vitest run`) and confirm 100% of unit tests in `lib/giveaway/logic.test.ts` pass.

--------------------------------------------------------------------------------

### Phase 2: Server Auth, Instagram ACL, and Firestore Persistence Adapters

#### 4. [`../../lib/auth/session.ts`](../../lib/auth/session.ts) (Create)

1. **Type / Scope**: TypeScript Server Session and Snapshot Signing Module
2. **Rationale and Proposed Changes**: Centralize encrypted `httpOnly` cookie session management and stateless HMAC comment snapshot signing:
   a. `SessionPayload` interface (`accessToken: string`, `igUserId: string`, `username: string`, `name: string`, `profilePictureUrl: string`, `expiresAt: number`, `isMock?: boolean`).
   b. Derive the 32-byte encryption key via `crypto.createHash('sha256').update(process.env.SESSION_SECRET || 'dev-fallback-insta-raffle-session-secret').digest()` (throwing in production if `SESSION_SECRET` is unset).
   c. `encryptSession(payload: SessionPayload): string` and `decryptSession(token: string): SessionPayload | null` using Node `crypto` AES-256-GCM.
   d. `getSession(): Promise<SessionPayload | null>`, `setSessionCookie(payload: SessionPayload): void`, and `clearSessionCookie(): void`.
   e. `signCommentSnapshot(mediaId: string, isComplete: boolean, comments: InstagramComment[]): string` and `verifyCommentSnapshot(mediaId: string, isComplete: boolean, comments: InstagramComment[], syncToken: string): boolean` using `crypto.createHmac('sha256', derivedKey)` and `crypto.timingSafeEqual`.

#### 5. [`../../lib/instagram/api.ts`](../../lib/instagram/api.ts) (Modify)

1. **Type / Scope**: Instagram Graph API Anti-Corruption Layer
2. **Rationale and Proposed Changes**: Replace `https://graph.facebook.com/v26.0` and `getInstagramAccounts` with the Instagram API with Instagram Login (`https://api.instagram.com` and `https://graph.instagram.com/v21.0`). Expose:
   a. Updated `InstagramPost` interface (`id: string`, `caption?: string`, `media_type: string`, `media_url?: string`, `thumbnail_url?: string`, `permalink: string`, `timestamp: string`, `comments_count?: number`, `username?: string`) and `CommentSyncResult` interface (`comments: InstagramComment[]`, `isComplete: boolean`, `pagesFetched: number`, `fetchDurationMs: number`, `errorCode?: 'IG_AUTH_EXPIRED' | 'IG_RATE_LIMITED' | 'IG_INCOMPLETE_SYNC'`).
   b. `exchangeInstagramCode(code: string): Promise<{ accessToken: string; userId: string; expiresIn: number }>` (exchanges OAuth code for short-lived token and upgrades to 60-day long-lived token).
   c. `getInstagramProfile(accessToken: string): Promise<InstagramAccount>` (`GET /me?fields=id,user_id,username,name,profile_picture_url`).
   d. `getInstagramPosts(accessToken: string): Promise<InstagramPost[]>` (`GET /me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,username&limit=24`).
   e. `getPostDetails(mediaId: string, accessToken: string): Promise<InstagramPost>` (`GET /{mediaId}`).
   f. `getPostComments(mediaId: string, accessToken: string): Promise<CommentSyncResult>` (paginates top-level comments via `GET /{mediaId}/comments?fields=id,text,username,timestamp,like_count&limit=50`, omitting `replies`, up to `MAX_PAGES = 100`).
   g. Automatic mock dispatch: whenever `accessToken === 'mock_access_token'`, `getInstagramProfile`, `getInstagramPosts`, `getPostDetails`, and `getPostComments` automatically return deterministic development mock fixtures covering all 9 qualification and rejection scenarios.

#### 6. [`../../lib/firebase/admin.ts`](../../lib/firebase/admin.ts) (Create)

1. **Type / Scope**: Server-Only Firebase Admin and Atomic Persistence Adapter
2. **Rationale and Proposed Changes**: Initialize `firebase-admin/app` and `firebase-admin/firestore` using `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (with a local file-backed fallback at `path.join(os.tmpdir(), 'insta-raffle-local-firestore.json')` when Firebase credentials are not configured in local dev so end-to-end draws and verification pages work offline without creating untracked files in the repository root). Expose:
   a. `PostDrawMetadata` interface (`mediaId: string`, `ownerUsername: string`, `drawAttemptCount: number`, `lastDrawId: string`, `lastDrawnAt: string`, `attempts: Array<{ drawId: string; attemptNumber: number; executedAt: string; idempotencyKey: string }>`).
   b. `DrawAuditSnapshot` interface (`schemaVersion: 1`, `drawId`, `idempotencyKey`, `mediaId`, `postPermalink`, `postCaption`, `ownerUsername`, `attemptNumber`, `executedAt`, `rules`, `funnelCounts`, `verification`, `winners`, `substitutes`, `priorAttempts`).
   c. `getPostDrawMetadata(mediaId: string): Promise<PostDrawMetadata>`.
   d. `commitAtomicDraw(params: CommitDrawInput): Promise<DrawAuditSnapshot>` (executes an atomic Firestore `runTransaction` over `posts/{mediaId}` and `draws/{drawId}`, checking `postDoc.attempts` for a matching `idempotencyKey`, incrementing `drawAttemptCount`, copying `priorAttempts` from `postDoc.attempts`, generating the 32-byte `serverSeed` via `crypto.randomBytes(32).toString('hex')`, calling `executeAtomicDraw`, and writing both documents atomically).
   e. `getDrawAuditSnapshot(drawId: string): Promise<DrawAuditSnapshot | null>`.

#### 7. [`../../firestore.rules`](../../firestore.rules) (Create)

1. **Type / Scope**: Cloud Firestore Security Rules
2. **Rationale and Proposed Changes**: Deny all direct client SDK reads and writes (`allow read, write: if false;`) across all collections so that only the server-side `firebase-admin` SDK can read or write `posts/{mediaId}` and `draws/{drawId}`.

--------------------------------------------------------------------------------

### Phase 3: Route Handlers, UI Components, Pages, and Legacy Cleanup

#### 8. [`../../app/api/auth/instagram/route.ts`](../../app/api/auth/instagram/route.ts) (Create)

1. **Type / Scope**: Next.js Route Handler (`GET`)
2. **Rationale and Proposed Changes**: Generate the CSRF `state` cookie and redirect to `https://www.instagram.com/oauth/authorize` with `instagram_business_basic,instagram_business_manage_comments` scopes (or create a mock creator session with `accessToken: 'mock_access_token'` and redirect to `/dashboard` when `?mock=1` is passed in development mode or when `INSTAGRAM_CLIENT_ID` is unset).

#### 9. [`../../app/auth/callback/route.ts`](../../app/auth/callback/route.ts) (Modify)

1. **Type / Scope**: Next.js OAuth Callback Route Handler (`GET`)
2. **Rationale and Proposed Changes**: Remove Supabase `exchangeCodeForSession` and `fb_provider_token`. Validate `state`, call `exchangeInstagramCode(code)` and `getInstagramProfile(accessToken)`, store the encrypted `insta_raffle_session` cookie via `setSessionCookie`, and redirect to `/dashboard`.

#### 10. [`../../app/auth/signout/route.ts`](../../app/auth/signout/route.ts) (Modify)

1. **Type / Scope**: Next.js Sign-Out Route Handler (`POST`)
2. **Rationale and Proposed Changes**: Replace `supabase.auth.signOut()` with `clearSessionCookie()` and redirect to `/`.

#### 11. [`../../app/api/draws/route.ts`](../../app/api/draws/route.ts) (Create)

1. **Type / Scope**: Next.js Route Handler (`POST`)
2. **Rationale and Proposed Changes**: Authenticate the host via `getSession()`, parse and validate the draw request payload (`mediaId`, `postPermalink`, `postCaption`, `idempotencyKey`, `rules`, `comments`, `isSyncComplete`, `syncToken`), verify `isSyncComplete === true` and `verifyCommentSnapshot(mediaId, isSyncComplete, comments, syncToken) === true`, run `qualifyComments` (returning HTTP 400 if `qualifiedEntries.length === 0`), and invoke `commitAtomicDraw` to atomically increment `drawAttemptCount`, run the seeded draw, and return the persisted `DrawAuditSnapshot`.

#### 12. [`../../components/login-button.tsx`](../../components/login-button.tsx) (Modify)

1. **Type / Scope**: Client UI Component
2. **Rationale and Proposed Changes**: Remove `@/lib/supabase/client` and Facebook OAuth. Accept `LoginButtonProps` (`{ showDemoMode?: boolean }`) from the Server Component `app/page.tsx`, navigate to `/api/auth/instagram` with primary CTA "Continue with Instagram", and when `showDemoMode` is true, render a secondary "Try Demo Mode (Mock Data)" button linking to `/api/auth/instagram?mock=1`.

#### 13. [`../../components/giveaway-engine.tsx`](../../components/giveaway-engine.tsx) (Modify)

1. **Type / Scope**: Interactive Host Configuration and Draw Client Component
2. **Rationale and Proposed Changes**: Accept `GiveawayEngineProps` (`{ mediaId: string; postPermalink: string; postCaption: string; hostUsername: string; comments: InstagramComment[]; isSyncComplete: boolean; syncToken: string; initialAttemptCount: number; initialPriorAttempts: Array<{ drawId: string; attemptNumber: number; executedAt: string }> }`) and support the two-phase workflow:
   a. **Rule Configuration Form**: Inputs for `numWinners` ($N$), `numSubstitutes` ($S$), `maxEntriesPerUser`, `deadlineIso` (datetime-local with timezone display), `requiredKeyword`, and `blockedHandles` (comma/newline-separated `@handles`).
   b. **Live Dry-Run Qualification Preview**: Invokes `qualifyComments` in `useMemo` as rules change, displaying total fetched comments, qualified tickets, unique eligible commenters, a breakdown table of all 9 `DisqualificationReason` counts, and an expandable audit list of qualified and rejected comments.
   c. **Official Atomic Draw Execution**: Sends `POST /api/draws` with a fresh `idempotencyKey` and the locked `{ comments, isSyncComplete, syncToken }` snapshot, updates the displayed attempt counter and history, triggers confetti, and renders the $N$ primary winners, $S$ ordered substitutes, cryptographic verification metadata (`poolHash`, `serverSeed`, `attemptNumber`), and a copyable link to `/verify/[drawId]`.

#### 14. [`../../app/page.tsx`](../../app/page.tsx) (Modify)

1. **Type / Scope**: Landing Page Server Component
2. **Rationale and Proposed Changes**: Replace `supabase.auth.getSession()` with `getSession()` from `@/lib/auth/session`, pass `showDemoMode={process.env.NODE_ENV !== 'production' || !process.env.INSTAGRAM_CLIENT_ID}` to `<LoginButton />`, and update copy to reflect Instagram Business and Creator login and verifiable draws.

#### 15. [`../../app/dashboard/layout.tsx`](../../app/dashboard/layout.tsx) (Modify)

1. **Type / Scope**: Dashboard Layout Server Component
2. **Rationale and Proposed Changes**: Replace Supabase session check with `getSession()`, redirect unauthenticated requests to `/`, and display the connected `@username` in the top navigation bar.

#### 16. [`../../app/dashboard/page.tsx`](../../app/dashboard/page.tsx) (Modify)

1. **Type / Scope**: Post Selection Dashboard Page
2. **Rationale and Proposed Changes**: Replace the legacy Facebook Page account selector with the authenticated Instagram user's post grid (`getInstagramPosts`), showing each post's thumbnail, caption, date, and comment count, and linking directly to `/dashboard/post/[postId]`.

#### 17. [`../../app/dashboard/post/[postId]/page.tsx`](../../app/dashboard/post/[postId]/page.tsx) (Create)

1. **Type / Scope**: Raffle Configuration and Execution Page Server Component
2. **Rationale and Proposed Changes**: Load post metadata (`getPostDetails`), paginate top-level comments (`getPostComments`), sign the synced comment snapshot via `signCommentSnapshot(params.postId, syncResult.isComplete, syncResult.comments)`, load current `PostDrawMetadata` (`drawAttemptCount` and `attempts`) from `lib/firebase/admin.ts`, and render `GiveawayEngine`.

#### 18. [`../../app/verify/[drawId]/page.tsx`](../../app/verify/[drawId]/page.tsx) (Create)

1. **Type / Scope**: Public Audit Verification Page Server Component
2. **Rationale and Proposed Changes**: Fetch `getDrawAuditSnapshot(params.drawId)` and render a tamper-evident public certificate showing:
   a. Post permalink, owner `@username`, execution timestamp, and an `Official Draw Attempt #K` badge.
   b. Links and timestamps for any prior attempts (`#1 .. #K-1`) on the same post.
   c. Frozen rule configuration (`numWinners`, `numSubstitutes`, `maxEntriesPerUser`, `deadlineIso`, `requiredKeyword`, blocked handle count).
   d. Qualification funnel summary (total comments fetched, qualified entries, unique eligible commenters, and rejection counts by reason).
   e. Ordered list of $N$ winners and $S$ substitutes with their winning comment text, tagged `@friend`, and comment timestamp.
   f. Cryptographic verification box displaying `algorithmVersion`, `poolHash`, and `serverSeed`.

#### 19. [`../../app/privacy/page.tsx`](../../app/privacy/page.tsx) (Modify)

1. **Type / Scope**: Privacy Policy Page
2. **Rationale and Proposed Changes**: Update third-party service disclosures from Supabase and Facebook Login to Firebase (Cloud Firestore) and the official Instagram API with Instagram Login, explaining that only compact draw verification snapshots (`draws/{drawId}`) are persisted while raw non-winning comments are never stored publicly.

#### 20. [`../../README.md`](../../README.md) (Modify)

1. **Type / Scope**: Project Documentation
2. **Rationale and Proposed Changes**: Document setup instructions, required environment variables (`INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`, `SESSION_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), the qualification rules, and verification mechanics.

#### 21. [`../../lib/supabase/client.ts`](../../lib/supabase/client.ts) and [`../../lib/supabase/server.ts`](../../lib/supabase/server.ts) (Delete)

1. **Type / Scope**: Legacy Authentication and Database Clients
2. **Rationale and Proposed Changes**: Delete both files after all importing routes and components (`app/auth/*`, `components/login-button.tsx`, `app/page.tsx`, `app/dashboard/layout.tsx`) have been migrated to `@/lib/auth/session`.

#### 22. [`../../app/dashboard/[accountId]/page.tsx`](../../app/dashboard/[accountId]/page.tsx) (Delete)

1. **Type / Scope**: Legacy Multi-Account Intermediate Route
2. **Rationale and Proposed Changes**: Delete this intermediate route now that `/dashboard` links directly to `/dashboard/post/[postId]`.
3. **Phase 3 Checkpoint**: Run `npm test`, `npm run lint`, and `npm run build` and verify all three pass with zero errors.

### Verification Plan

1. **Compilation and Type Checking**: Run `npm run build` to verify zero TypeScript, Next.js App Router, or bundling errors and confirm no residual `@supabase/*` imports remain.
2. **Unit Tests**: Run `npm test` (`vitest run`) executing [`../../lib/giveaway/logic.test.ts`](../../lib/giveaway/logic.test.ts) to validate all 9 qualification rules, chronological ordering, per-user friend deduplication, entry cap enforcement, SHA-256 `poolHash` calculation, and deterministic HMAC-SHA256 Fisher-Yates winner/substitute selection.
3. **Static Analysis and Linting**: Run `npm run lint` (`next lint`) with zero warnings or errors.
4. **Test Coverage Requirement**: Achieve 90%+ branch coverage on [`../../lib/giveaway/logic.ts`](../../lib/giveaway/logic.ts).
5. **End-to-End Functional Verification**: Verify the full user journey from `/` -> Demo/Instagram Login -> `/dashboard` -> `/dashboard/post/[postId]` (Dry-Run Qualification Preview updates live on rule changes) -> `POST /api/draws` (atomic draw verifies `syncToken`, selects $N$ winners + $S$ substitutes, and increments `Attempt #1` -> `Attempt #2` on re-run) -> `/verify/[drawId]` (renders immutable audit certificate with `poolHash`, `serverSeed`, rules, winners, and substitutes).

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
