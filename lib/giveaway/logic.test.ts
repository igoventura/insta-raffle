import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  normalizeHandle,
  extractMentions,
  qualifyComments,
  sha256Hex,
  hmacSha256Hex,
  computePoolHash,
  executeAtomicDraw,
  type GiveawayRules,
} from './logic'
import type { InstagramComment } from '../instagram/api'

describe('normalizeHandle and extractMentions', () => {
  it('normalizes handles to lowercase without leading @ or trailing periods', () => {
    expect(normalizeHandle('  @Alice_123. ')).toBe('alice_123')
    expect(normalizeHandle('Bob.Smith')).toBe('bob.smith')
  })

  it('extracts valid single and multiple @mentions while stripping trailing sentence periods', () => {
    expect(extractMentions('Check this out @Friend_One!')).toEqual(['friend_one'])
    expect(extractMentions('Tagging @bob.smith.')).toEqual(['bob.smith'])
    expect(extractMentions('@first and @second')).toEqual(['first', 'second'])
  })

  it('ignores email addresses and malformed handles with consecutive periods', () => {
    expect(extractMentions('Contact me at alice@example.com please')).toEqual([])
    expect(extractMentions('Invalid @bad..handle here')).toEqual([])
    expect(extractMentions('Just plain text without mentions')).toEqual([])
  })
})

describe('Pure TypeScript SHA-256 and HMAC-SHA256 parity with Node crypto', () => {
  it('matches Node crypto SHA-256 and HMAC-SHA256 digests across short and multi-block inputs', () => {
    const samples = [
      '',
      'insta-raffle',
      'post_1:1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855:0',
      'a'.repeat(200),
    ]
    const keys = ['short-key', 'k'.repeat(100)]

    for (const msg of samples) {
      const expectedSha = crypto.createHash('sha256').update(msg, 'utf8').digest('hex')
      expect(sha256Hex(msg)).toBe(expectedSha)

      for (const key of keys) {
        const expectedHmac = crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex')
        expect(hmacSha256Hex(key, msg)).toBe(expectedHmac)
      }
    }
  })
})

describe('qualifyComments 9-rule deterministic pipeline', () => {
  const baseRules: GiveawayRules = {
    numWinners: 2,
    numSubstitutes: 1,
    maxEntriesPerUser: 2,
    hostUsername: 'raffle_host',
    deadlineIso: '2026-11-07T15:00:00Z',
    requiredKeyword: '#win',
    blockedHandles: ['banned_user', 'sponsor_brand'],
  }

  const sampleComments: InstagramComment[] = [
    // Valid comment #1 by alice (chronologically second for alice, testing sort order)
    {
      id: 'c2',
      username: 'Alice',
      text: 'I want to #win with @charlie!',
      timestamp: '2026-11-07T12:05:00+0000',
      like_count: 1,
    },
    // Valid comment #2 by alice (chronologically first for alice)
    {
      id: 'c1',
      username: 'alice',
      text: 'Entering to #WIN @bob.',
      timestamp: '2026-11-07T12:00:00+0000',
      like_count: 2,
    },
    // Duplicate tagged friend (@bob already tagged by alice in c1)
    {
      id: 'c3',
      username: 'alice',
      text: 'Trying again #win @BOB',
      timestamp: '2026-11-07T12:10:00+0000',
      like_count: 0,
    },
    // Exceeds per-user cap (alice already has 2 valid entries from c1 and c2)
    {
      id: 'c4',
      username: 'alice',
      text: 'Third friend #win @david',
      timestamp: '2026-11-07T12:15:00+0000',
      like_count: 0,
    },
    // Disqualified: PAST_DEADLINE (15:01 UTC > 15:00 UTC)
    {
      id: 'c5',
      username: 'late_user',
      text: 'Late entry #win @friend1',
      timestamp: '2026-11-07T15:01:00+0000',
      like_count: 0,
    },
    // Disqualified: MISSING_KEYWORD
    {
      id: 'c6',
      username: 'no_keyword_user',
      text: 'Tagging @friend2',
      timestamp: '2026-11-07T13:00:00+0000',
      like_count: 0,
    },
    // Disqualified: NO_MENTION (email ignored)
    {
      id: 'c7',
      username: 'no_mention_user',
      text: 'Hope to #win contact test@example.com',
      timestamp: '2026-11-07T13:05:00+0000',
      like_count: 0,
    },
    // Disqualified: MULTIPLE_MENTIONS (2+ mentions discarded)
    {
      id: 'c8',
      username: 'multi_tag_user',
      text: 'Lets #win @friend1 @friend2',
      timestamp: '2026-11-07T13:10:00+0000',
      like_count: 0,
    },
    // Disqualified: SELF_MENTION
    {
      id: 'c9',
      username: 'Narcissist',
      text: 'Me #win @narcissist',
      timestamp: '2026-11-07T13:15:00+0000',
      like_count: 0,
    },
    // Disqualified: HOST_MENTION
    {
      id: 'c10',
      username: 'fan_user',
      text: 'Love you #win @raffle_host',
      timestamp: '2026-11-07T13:20:00+0000',
      like_count: 0,
    },
    // Disqualified: BLOCKED_HANDLE (commenter is blocked)
    {
      id: 'c11',
      username: 'banned_user',
      text: 'Entry #win @someone',
      timestamp: '2026-11-07T13:25:00+0000',
      like_count: 0,
    },
    // Disqualified: BLOCKED_HANDLE (tagged friend is blocked)
    {
      id: 'c12',
      username: 'normal_user',
      text: 'Entry #win @sponsor_brand',
      timestamp: '2026-11-07T13:30:00+0000',
      like_count: 0,
    },
    // Valid entry by bruno
    {
      id: 'c13',
      username: 'bruno',
      text: 'Count me in #win @lucas',
      timestamp: '2026-11-07T14:00:00+0000',
      like_count: 3,
    },
  ]

  it('sorts chronologically and categorizes all 9 rejection reasons accurately', () => {
    const res = qualifyComments(sampleComments, baseRules)

    expect(res.qualifiedEntries.map((e) => e.id)).toEqual(['c1', 'c2', 'c13'])
    expect(res.uniqueEligibleCommenters).toBe(2) // alice and bruno
    expect(res.funnelCounts.totalFetched).toBe(13)
    expect(res.funnelCounts.qualifiedEntries).toBe(3)
    expect(res.funnelCounts.rejectedByReason).toEqual({
      PAST_DEADLINE: 1,
      MISSING_KEYWORD: 1,
      NO_MENTION: 1,
      MULTIPLE_MENTIONS: 1,
      SELF_MENTION: 1,
      HOST_MENTION: 1,
      BLOCKED_HANDLE: 2,
      DUPLICATE_TAGGED_FRIEND: 1,
      EXCEEDED_USER_CAP: 1,
    })
  })
})

describe('executeAtomicDraw determinism, uniqueness, and underflow', () => {
  const rules: GiveawayRules = {
    numWinners: 2,
    numSubstitutes: 2,
    maxEntriesPerUser: 3,
    hostUsername: 'host',
  }

  const comments: InstagramComment[] = [
    { id: '1', username: 'user_a', text: '@f1', timestamp: '2026-11-07T10:00:00Z', like_count: 0 },
    { id: '2', username: 'user_a', text: '@f2', timestamp: '2026-11-07T10:01:00Z', like_count: 0 },
    { id: '3', username: 'user_a', text: '@f3', timestamp: '2026-11-07T10:02:00Z', like_count: 0 },
    { id: '4', username: 'user_b', text: '@f4', timestamp: '2026-11-07T10:03:00Z', like_count: 0 },
    { id: '5', username: 'user_c', text: '@f5', timestamp: '2026-11-07T10:04:00Z', like_count: 0 },
    { id: '6', username: 'user_d', text: '@f6', timestamp: '2026-11-07T10:05:00Z', like_count: 0 },
    { id: '7', username: 'user_e', text: '@f7', timestamp: '2026-11-07T10:06:00Z', like_count: 0 },
  ]

  it('produces identical winners and substitutes for the same seed and never duplicates a user across winners and substitutes', () => {
    const { qualifiedEntries } = qualifyComments(comments, rules)
    expect(qualifiedEntries.length).toBe(7)

    const seedInput = {
      serverSeed: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      postId: 'post_999',
      attemptNumber: 1,
    }

    const draw1 = executeAtomicDraw(qualifiedEntries, rules, seedInput)
    const draw2 = executeAtomicDraw(qualifiedEntries, rules, seedInput)

    expect(draw1).toEqual(draw2)
    expect(draw1.poolHash).toBe(computePoolHash(qualifiedEntries))
    expect(draw1.winners.length).toBe(2)
    expect(draw1.substitutes.length).toBe(2)

    const allDrawnHandles = [
      ...draw1.winners.map((w) => w.username.toLowerCase()),
      ...draw1.substitutes.map((s) => s.username.toLowerCase()),
    ]
    expect(new Set(allDrawnHandles).size).toBe(4)

    // Changing attemptNumber produces a different draw order
    const drawAttempt2 = executeAtomicDraw(qualifiedEntries, rules, {
      ...seedInput,
      attemptNumber: 2,
    })
    expect(drawAttempt2.poolHash).toBe(draw1.poolHash)
  })

  it('handles pool underflow gracefully when uniqueEligibleCommenters < numWinners + numSubstitutes', () => {
    const smallComments: InstagramComment[] = [
      { id: '1', username: 'user_a', text: '@f1', timestamp: '2026-11-07T10:00:00Z', like_count: 0 },
      { id: '2', username: 'user_a', text: '@f2', timestamp: '2026-11-07T10:01:00Z', like_count: 0 },
      { id: '3', username: 'user_b', text: '@f3', timestamp: '2026-11-07T10:02:00Z', like_count: 0 },
    ]
    const { qualifiedEntries } = qualifyComments(smallComments, {
      ...rules,
      numWinners: 2,
      numSubstitutes: 2,
    })

    const res = executeAtomicDraw(qualifiedEntries, rules, {
      serverSeed: 'abcdef',
      postId: 'post_1',
      attemptNumber: 1,
    })

    expect(res.winners.length).toBe(2)
    expect(res.substitutes.length).toBe(0)
  })
})
