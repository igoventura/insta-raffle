# Instagram Comment Raffle Web Application (Insta-Raffle)

1. **Author:** Igo Ventura
2. **Date:** 2026-11-07

## Overview

Insta-Raffle is a Next.js and Firebase web application that lets Instagram Business and Creator account holders run verifiable comment raffles on their posts using the Instagram API with Instagram Login (`graph.instagram.com`). The application fetches top-level comments on a selected post (ignoring nested replies) and qualifies comments that contain a single `@mention` after applying host-configured rules: excluding self-tags, host-tags, blocked usernames, duplicate tagged friends per commenter across multiple comments, comments posted after a deadline, and comments missing an optional required keyword, up to a configurable entry cap per user. Only commenters enter the raffle pool. When the host executes a draw, the server runs a single atomic, deterministically seeded draw that selects $N$ unique winners and $S$ ordered substitutes in draw order, increments an append-only draw attempt counter for that post, and saves an immutable verification snapshot with a public shareable URL.

## Analysis

### 1. Contradiction: Complete Comment Ingestion and Interactive Rule Tuning vs. API Rate Limits and Serverless Timeouts

1. **The Conflict**: High-engagement giveaway posts can have thousands of top-level comments, while `graph.instagram.com` paginates comments in small pages (50 to 100 comments per request) under strict hourly per-user rate limits (200 calls per user per hour on standard tiers). If the application fetches comments synchronously inside the same server request that evaluates rules and runs the draw, large posts will time out serverless functions (10 to 60 seconds) or burn the host's hourly API quota whenever they tweak a rule (such as changing the deadline or entry cap).
2. **Suggested Pattern (Preliminary Action + Extraction)**: Separate **Comment Sync (Phase 1)** from **Rule Qualification and Atomic Draw (Phase 2)**.
   a. Phase 1 paginates top-level comments from `GET /{ig-media-id}/comments?fields=id,text,timestamp,username` (explicitly omitting the `replies` edge so nested replies are never fetched) and caches a normalized snapshot with cursor resumability and a completeness check (ensuring the final pagination cursor is reached before allowing an official draw).
   b. Phase 2 runs a pure, zero-I/O TypeScript function over the cached comment snapshot. This lets the host adjust entry caps, deadlines, keywords, and blocklists with instant preview feedback (including a breakdown of how many comments were rejected by each rule) before committing an irreversible official draw.
3. **Secondary Trade-offs**: Caching a comment snapshot means comments posted between the sync step and the draw step are excluded unless the host clicks "Sync New Comments" before drawing.
4. **Ideal Final Result**: Every comment on a post is fetched from Instagram at most once, rule adjustments update eligibility counts in milliseconds in memory without API calls, and the official draw executes against a locked comment snapshot without network timeouts.

### 2. Contradiction: Public Cryptographic Auditability vs. Firestore 1 MiB Document Limit and Participant Privacy

1. **The Conflict**: Participants visiting the public verification page (`/verify/[drawId]`) need proof that the draw was fair, that rules were not altered after the fact, and that the host did not cherry-pick winners. However, Cloud Firestore enforces a hard 1 MiB limit per document, and Meta Platform Terms restrict publishing bulk raw comments and non-winning users' personal data on a public web page.
2. **Suggested Pattern (Segmentation + Deterministic Canonical Hashing)**:
   a. Sort all qualified entries in canonical chronological order (`timestamp ASC`, tie-broken by `comment.id ASC`) before running the draw.
   b. Compute a SHA-256 hash (`poolHash`) of the canonical qualified entry list and combine it with a server-generated 256-bit cryptographic seed (`serverSeed`), the post ID, and the draw attempt number inside a deterministic Fisher-Yates shuffle (using Node `crypto` HMAC-SHA256, replacing the biased `.sort(() => 0.5 - Math.random())` used in `_old/`).
   c. Store only a compact, versioned `DrawAuditSnapshot` document (< 50 KB) in Firestore containing: `schemaVersion`, post metadata, frozen rule configuration, qualification funnel counts (how many comments were dropped for `0 mentions`, `2+ mentions`, `self-tag`, `host-tag`, `blocked-handle`, `duplicate-tagged-friend`, `past-deadline`, `missing-keyword`, `exceeded-entry-cap`), `poolHash`, `serverSeed`, `attemptNumber`, and the selected $N$ winners and $S$ ordered substitutes.
3. **Secondary Trade-offs**: Any future change to the canonical sorting or hashing format requires incrementing `schemaVersion` so historical verification pages remain immutable and never recompute results from live code.
4. **Ideal Final Result**: The public verification page loads a single small Firestore document (< 50 KB) that can be statically cached via Next.js ISR, protects non-winning commenters' privacy, never hits the 1 MiB Firestore ceiling, and proves the integrity of the draw.

### 3. Contradiction: Host Re-Draw Flexibility vs. Anti-Manipulation Trust

1. **The Conflict**: A host might legitimately misconfigure a rule and need to run a draw again, yet if hosts can run draws in browser memory or delete unfavorable draws until a friend wins, the public verification page becomes meaningless.
2. **Suggested Pattern (Inversion + Blessing in Disguise — Server-Only Commit-Before-Reveal)**:
   a. Keep rule tuning in a **Dry-Run Preview** step that shows only qualified entry counts and rejection reasons without revealing or drawing any winners.
   b. Move winner selection exclusively to a server-side endpoint using `firebase-admin`. Inside a single Firestore `runTransaction()` (protected by a client-supplied `idempotencyKey` to prevent double-click race conditions), increment `drawAttemptCount` on `posts/{igMediaId}` and write the immutable `draws/{drawId}` snapshot *before* returning the $N$ winners and $S$ substitutes to the UI.
   c. Display `Draw Attempt #K` prominently on `/verify/[drawId]` along with timestamps and links to any prior attempts (`#1 .. #K-1`) on the same post. Because $S$ ordered substitutes are drawn atomically alongside the $N$ winners, post-draw disqualifications (such as a winner not responding) are handled by promoting Substitute #1 rather than running a new draw.
3. **Secondary Trade-offs**: Once the host clicks "Run Official Draw", the attempt counter increments permanently and cannot be deleted.
4. **Ideal Final Result**: Secret re-rolling is impossible because winners are only computed inside an append-only server transaction, while legitimate disqualifications are resolved using the pre-drawn ordered substitutes list.

### 4. Architectural Simplifications and Edge-Case Safeguards (`egm-zoom-out`, `egm-codebase-details`, `egm-implementation-readiness`, `egm-structural`)

1. **Eliminate Firebase Client Auth Ceremony**: Firebase Authentication does not have a built-in "Instagram Login" OAuth provider. Rather than building custom Firebase Auth token minting and client auth listeners, implement a direct Next.js OAuth callback route (`/api/auth/instagram` and `/api/auth/callback`) that exchanges the Instagram authorization code for an access token and stores the session in an encrypted `httpOnly` cookie. Use `firebase-admin` strictly on the server for Firestore reads and writes, allowing Firestore Security Rules to deny all direct client writes (`allow read, write: if false;`).
2. **Collapse Multi-Account Routing from `_old/`**: Because `_old/` used Facebook Login (`/me/accounts`), it required an intermediate `/dashboard/[accountId]` route to pick a Facebook Page. With Instagram API with Instagram Login (`graph.instagram.com/me`), the token is already scoped to one Instagram Professional account, so the routing collapses directly to `/dashboard` (select post) and `/dashboard/post/[postId]` (configure and draw).
3. **Deterministic Handle Normalization and `@mention` Parsing**:
   a. Apply lowercase normalization (`trim().toLowerCase()`) to commenter usernames, parsed `@mentions`, the post author username, and the blocklist.
   b. Parse `@mentions` using strict Instagram username rules (`1-30` characters of `[a-zA-Z0-9._]`, preceded by start-of-string or non-word boundary so email addresses like `user@gmail.com` are ignored, and stripping trailing sentence punctuation like `@friend.` or `@friend!`).
   c. Enforce chronological sorting (`timestamp ASC`, `id ASC`) before running the single-pass qualification filter so that a user's *first* valid comment tagging `@bob` is accepted, any subsequent comment by that user tagging `@bob` is rejected as `DUPLICATE_TAGGED_FRIEND`, and valid entries beyond `maxEntriesPerUser` are rejected as `EXCEEDED_USER_CAP`.
4. **Weighted Draw Without User Replacement**: Each qualified comment is one ticket in the pool (up to `maxEntriesPerUser` tickets per user). During the single atomic draw of $N + S$ slots, whenever a ticket is selected, that commenter claims the current winner or substitute slot and any remaining tickets belonging to that same `username` are skipped for the rest of the draw, guaranteeing that all $N$ winners and $S$ substitutes are distinct individuals (`Winners ∩ Substitutes = ∅`).
5. **Restore `_old/` to Root and Strip Legacy Dependencies**: Restore the existing Next.js 14, Tailwind, and `shadcn/ui` project structure from `_old/` back to the repository root rather than scaffolding from scratch, then remove `@supabase/*` and `graph.facebook.com` assumptions and install `firebase-admin`.

## Goals vs. Non-Goals

1. **In-Scope Goals:**
   a. Authenticate Instagram Business and Creator accounts via **Instagram API with Instagram Login** (`api.instagram.com` / `graph.instagram.com`) with `instagram_business_basic` and `instagram_business_manage_comments` permissions.
   b. List the authenticated user's posts and paginate all top-level comments on a selected post (excluding nested replies) with progress feedback and completeness checks.
   c. Qualify comments through a deterministic, chronologically ordered pipeline enforcing:
      1. Exactly 1 valid `@mention` per comment (`0` or `2+` mentions are discarded).
      2. No self-tags (`commenter === mentioned`) and no host-tags (`postOwner === mentioned`).
      3. No usernames present in the host's custom blocklist (checked against both commenter and mentioned handle).
      4. Deduplicated tagged friends per commenter across multiple comments (each entry by `@alice` must tag a distinct `@friend`).
      5. Configurable maximum valid entries cap per commenter (`maxEntriesPerUser`, e.g., 3).
      6. Optional comment deadline cutoff timestamp (with explicit timezone) and optional required keyword/hashtag filter.
   d. Provide a **Dry-Run Qualification Preview** displaying total comments, qualified entries, unique eligible commenters, and a breakdown of disqualified comments by exact rejection reason before running the official draw.
   e. Execute a server-side atomic draw (`firebase-admin` transaction with idempotency protection) using a deterministic cryptographic shuffle to select $N$ unique winners and $S$ ordered substitutes in draw order.
   f. Persist an immutable, schema-versioned `DrawAuditSnapshot` and increment the post's `drawAttemptCount` in Firestore, exposing a shareable public verification page (`/verify/[drawId]`).
   g. Restore the Next.js 14 + Tailwind + `shadcn/ui` project from `_old/` to the root directory, reusing its UI primitives, dashboard layout, and privacy policy page while replacing Supabase and Facebook Login with Firebase (`firebase-admin`) and Instagram Login.

2. **Out-of-Scope Non-Goals:**
   a. Fetching or qualifying nested comment replies (`/{ig-comment-id}/replies`).
   b. Entering tagged friends directly into the draw pool (only commenters enter the pool).
   c. Calling external APIs or LLMs to verify whether a tagged `@mention` is a real account, a celebrity/famous account, or whether the commenter follows the host (deferred to future iterations due to Instagram Graph API limitations).
   d. Scraping public Instagram URLs without OAuth authentication.
   e. Storing full raw comment dumps of non-winning participants on the public verification document.

## Alternatives Weighed

1. **Instagram API with Facebook Login (`graph.facebook.com`)**: Rejected by author in favor of **Instagram API with Instagram Login** (`graph.instagram.com`) to avoid forcing creators to link their Instagram account to a Facebook Page and to avoid multi-page account selection overhead.
2. **Supabase Backend (used in `_old/`)**: Rejected by author in favor of **Firebase (Firestore via `firebase-admin`)** for the new root project.
3. **Accepting Comments with 2+ `@mentions` (Taking the First Unused Mention)**: Rejected by author in favor of **strictly requiring 1 `@mention` per comment and discarding comments with 2 or more `@mentions`** to keep qualification rules unambiguous and simple.
4. **Entering Both Commenters and Tagged Friends into the Raffle Pool**: Rejected by author; **only the commenter enters the raffle pool**, using unique tagged friends across separate comments to earn additional entries up to the per-user cap.
5. **Drawing Substitutes On-Demand After the Initial Draw**: Rejected by author in favor of **selecting $N$ winners and $S$ ordered substitutes in a single atomic draw** to prevent post-draw manipulation or cherry-picking accusations.
6. **Client-Side Winner Calculation (`Math.random()` in Browser)**: Rejected during Goldfish review because `.sort(() => 0.5 - Math.random())` in `_old/` is statistically biased and allows hosts to secretly re-roll in browser memory without incrementing the post's audit counter.

## Key Decisions & Staging for Next Steps

1. **Auth & Session Strategy**: Use custom Next.js OAuth route handlers for Instagram Login (`httpOnly` encrypted session cookies) rather than Firebase Client Auth, paired with `firebase-admin` on the server for all Firestore operations.
2. **Two-Phase Workflow**: Separate **Sync & Preview** (paginating top-level comments + live in-memory qualification funnel preview) from **Official Atomic Draw** (server-side Firestore transaction that increments `drawAttemptCount` and writes the immutable `draws/{drawId}` snapshot).
3. **Canonical Audit Record**: Store a compact, schema-versioned `DrawAuditSnapshot` (< 50 KB) with `poolHash` (SHA-256 of chronologically sorted qualified entries), `serverSeed`, rule snapshot, qualification rejection counts, `attemptNumber`, $N$ winners, and $S$ ordered substitutes.
4. **Baseline Restoration from `_old/`**: Restore the project files from `_old/` back to the root workspace as the foundation (preserving `app/`, `components/`, `node_modules/`, Tailwind, and `shadcn/ui` setup) and refactor in place rather than starting from an empty directory.
