# Insta-Raffle 🎉

Provably fair Instagram giveaway tool built with **Next.js 16 (App Router, React 19)**, **Firebase (Cloud Firestore)**, and the **Instagram API with Instagram Login (`graph.instagram.com`)**.

## 1. Core Qualification & Fairness Rules

1. **Top-Level Comments Only**: Fetches top-level comments on the selected Instagram post (`GET /{mediaId}/comments`), ignoring nested thread replies.
2. **Commenters Only Enter Pool**: Only the author of a qualifying comment enters the raffle pool; tagged friends do not receive entries.
3. **Strictly 1 `@mention` Per Comment**:
   a. Comments with `0` mentions are disqualified (`ZERO_MENTIONS`).
   b. Comments with `2` or more mentions in the same comment are disqualified (`MULTIPLE_MENTIONS`).
   c. Comments with **exact 1 `@mention`** qualify as 1 raffle entry, provided the mentioned handle passes all anti-cheat checks.
4. **Anti-Cheat Exclusions & Deduplication**:
   a. Self-tags (`commenter === mentioned`) are disqualified (`SELF_TAG`).
   b. Host-tags (`postOwner === mentioned`) are disqualified (`HOST_TAG`).
   c. Handles on the host's custom blocklist are disqualified (`BLOCKLISTED_COMMENTER` or `BLOCKLISTED_MENTION`).
   d. Repeated tags of the **same friend** by the same commenter across multiple comments are deduplicated (`DUPLICATE_TAGGED_FRIEND`); only the earliest comment (`timestamp ASC`, `id ASC`) counts.
   e. Optional rules include a per-user entry cap (`EXCEEDED_MAX_ENTRIES`), comment cutoff timestamp (`PAST_DEADLINE`), and required keyword/hashtag (`MISSING_KEYWORD`).
5. **Cryptographic Atomic Draw & Audit Certificate**:
   a. Draws $N$ unique winners and $S$ ordered substitutes in a single atomic operation without user replacement ($\text{Winners} \cap \text{Substitutes} = \emptyset$).
   b. Computes a canonical SHA-256 `poolHash` over all valid entries and scores each entry via `HMAC-SHA256(serverSeed, "${poolHash}:${entryIndex}")`.
   c. Atomically increments `drawAttemptCount` on `posts/{mediaId}` and persists a compact (`< 50 KB`) immutable `DrawAuditSnapshot` to `draws/{drawId}`, publicly verifiable at `/verify/[drawId]`.

## 2. Environment Variables

Create a `.env.local` file in the project root:

```bash
# Instagram API with Instagram Login (Meta App Dashboard -> Instagram)
INSTAGRAM_CLIENT_ID=your_instagram_app_id
INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stateless Session & Snapshot Signing Secret (32+ byte random string)
SESSION_SECRET=replace_with_at_least_32_bytes_of_random_entropy

# Firebase Admin SDK (Cloud Firestore)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_firebase_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

1. **Local Demo Mode Fallback**: When `NODE_ENV !== 'production'` or `INSTAGRAM_CLIENT_ID` / `FIREBASE_PROJECT_ID` are omitted, the app automatically enables a **Demo Mode** button on `/` and stores local draw audit snapshots in the OS temporary directory so the full qualification and `/verify/[drawId]` flow works out-of-the-box.

## 3. Development & Verification Commands

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run unit and cryptographic verification tests:
   ```bash
   npm test
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```
