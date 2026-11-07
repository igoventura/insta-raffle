const IG_OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
const IG_GRAPH_URL = 'https://graph.instagram.com/v21.0'
const IG_LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token'
const FB_GRAPH_URL = 'https://graph.facebook.com/v21.0'
const MAX_COMMENT_PAGES = 100

function getGraphBaseUrl(): string {
  return process.env.INSTAGRAM_CONFIG_ID ? FB_GRAPH_URL : IG_GRAPH_URL
}

export const MOCK_ACCESS_TOKEN = 'mock_access_token'

export type InstagramApiErrorCode =
  | 'IG_AUTH_EXPIRED'
  | 'IG_RATE_LIMITED'
  | 'IG_INCOMPLETE_SYNC'

export interface InstagramAccount {
  id: string
  username: string
  profile_picture_url: string
  name: string
}

export interface InstagramPost {
  id: string
  caption?: string
  media_type: string
  media_url?: string
  thumbnail_url?: string
  permalink: string
  timestamp: string
  comments_count?: number
  username?: string
}

export interface InstagramComment {
  id: string
  text: string
  username: string
  timestamp: string
  like_count: number
}

export interface CommentSyncResult {
  comments: InstagramComment[]
  isComplete: boolean
  pagesFetched: number
  fetchDurationMs: number
  errorCode?: InstagramApiErrorCode
}

export function getMockProfile(): InstagramAccount {
  return {
    id: '17841400000000001',
    username: 'creator_giveaways',
    name: 'Creator Giveaways Official',
    profile_picture_url: '',
  }
}

export function getMockPosts(): InstagramPost[] {
  return [
    {
      id: 'post_giveaway_1',
      caption:
        'MEGA GIVEAWAY! Tag 1 friend per comment with #win to enter! Up to 3 entries per person. Substitutes will be drawn in order.',
      media_type: 'IMAGE',
      media_url: '',
      thumbnail_url: '',
      permalink: 'https://www.instagram.com/p/DEMO_GIVEAWAY_1/',
      timestamp: '2026-11-01T12:00:00Z',
      comments_count: 16,
      username: 'creator_giveaways',
    },
    {
      id: 'post_giveaway_2',
      caption:
        'Weekend Flash Raffle! Tag a friend below to win our starter kit.',
      media_type: 'IMAGE',
      media_url: '',
      thumbnail_url: '',
      permalink: 'https://www.instagram.com/p/DEMO_GIVEAWAY_2/',
      timestamp: '2026-11-05T15:30:00Z',
      comments_count: 8,
      username: 'creator_giveaways',
    },
  ]
}

export function getMockComments(mediaId: string): InstagramComment[] {
  if (mediaId === 'post_giveaway_2') {
    return [
      {
        id: 'p2_c1',
        username: 'lucas_dev',
        text: 'Entering with @marina_design!',
        timestamp: '2026-11-05T16:00:00Z',
        like_count: 2,
      },
      {
        id: 'p2_c2',
        username: 'sofia_art',
        text: 'Lets win @pedro_music',
        timestamp: '2026-11-05T16:10:00Z',
        like_count: 1,
      },
      {
        id: 'p2_c3',
        username: 'rafael_photo',
        text: 'Count me in @bianca_fit.',
        timestamp: '2026-11-05T16:20:00Z',
        like_count: 4,
      },
      {
        id: 'p2_c4',
        username: 'camila_books',
        text: 'Hoping to win @diego_run',
        timestamp: '2026-11-05T16:30:00Z',
        like_count: 0,
      },
    ]
  }

  return [
    {
      id: 'c_101',
      username: 'ana_silva',
      text: 'I want to #win with @bruno_costa.',
      timestamp: '2026-11-02T10:00:00Z',
      like_count: 5,
    },
    {
      id: 'c_102',
      username: 'ana_silva',
      text: 'Second entry #win @carla_mendes!',
      timestamp: '2026-11-02T10:05:00Z',
      like_count: 2,
    },
    {
      id: 'c_103',
      username: 'ana_silva',
      text: 'Duplicate friend tag #win @bruno_costa',
      timestamp: '2026-11-02T10:10:00Z',
      like_count: 0,
    },
    {
      id: 'c_104',
      username: 'ana_silva',
      text: 'Third valid entry #win @diego_rocha',
      timestamp: '2026-11-02T10:15:00Z',
      like_count: 1,
    },
    {
      id: 'c_105',
      username: 'ana_silva',
      text: 'Fourth entry over cap=3 #win @elena_souza',
      timestamp: '2026-11-02T10:20:00Z',
      like_count: 0,
    },
    {
      id: 'c_106',
      username: 'marcos_lima',
      text: 'Joining the raffle #win @fernanda_alves',
      timestamp: '2026-11-02T11:00:00Z',
      like_count: 3,
    },
    {
      id: 'c_107',
      username: 'julia_santos',
      text: 'Fingers crossed #win @gabriel_nunes',
      timestamp: '2026-11-02T11:30:00Z',
      like_count: 4,
    },
    {
      id: 'c_108',
      username: 'pedro_oliveira',
      text: 'Lets go #win @helena_castro',
      timestamp: '2026-11-02T12:00:00Z',
      like_count: 1,
    },
    {
      id: 'c_109',
      username: 'larissa_ferreira',
      text: 'My entry #win @igor_martins',
      timestamp: '2026-11-02T12:30:00Z',
      like_count: 2,
    },
    {
      id: 'c_110',
      username: 'thiago_ribeiro',
      text: 'Pick me #win @karina_dias',
      timestamp: '2026-11-02T13:00:00Z',
      like_count: 6,
    },
    {
      id: 'c_111',
      username: 'multi_tagger',
      text: 'Tagging two people #win @friend_one @friend_two',
      timestamp: '2026-11-02T13:15:00Z',
      like_count: 0,
    },
    {
      id: 'c_112',
      username: 'self_tagger',
      text: 'Tagging myself #win @self_tagger',
      timestamp: '2026-11-02T13:30:00Z',
      like_count: 0,
    },
    {
      id: 'c_113',
      username: 'host_fan',
      text: 'Tagging the host #win @creator_giveaways',
      timestamp: '2026-11-02T13:45:00Z',
      like_count: 0,
    },
    {
      id: 'c_114',
      username: 'no_tag_user',
      text: 'Awesome giveaway #win! Contact me at user@email.com',
      timestamp: '2026-11-02T14:00:00Z',
      like_count: 0,
    },
    {
      id: 'c_115',
      username: 'forgot_keyword',
      text: 'Look at this @mateus_gomes',
      timestamp: '2026-11-02T14:15:00Z',
      like_count: 0,
    },
    {
      id: 'c_116',
      username: 'beatriz_melo',
      text: 'Entering right on time #win @natasha_pires',
      timestamp: '2026-11-02T14:30:00Z',
      like_count: 2,
    },
  ]
}

/**
 * 1. Exchange OAuth authorization code for a short-lived token,
 *    then exchange for a 60-day long-lived token. Supports both Meta Unified Login
 *    (when INSTAGRAM_CONFIG_ID is set) and direct Instagram Login.
 */
export async function exchangeInstagramCode(code: string): Promise<{
  accessToken: string
  userId: string
  expiresIn: number
}> {
  const clientId = process.env.INSTAGRAM_CLIENT_ID || ''
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET || ''
  const configId = process.env.INSTAGRAM_CONFIG_ID
  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`

  if (configId) {
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    })
    const shortRes = await fetch(
      `${FB_GRAPH_URL}/oauth/access_token?${tokenParams.toString()}`
    )
    if (!shortRes.ok) {
      throw new Error('Failed to exchange Unified Login authorization code')
    }
    const shortData = await shortRes.json()
    const shortToken: string = shortData.access_token

    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: shortToken,
    })
    const longRes = await fetch(
      `${FB_GRAPH_URL}/oauth/access_token?${longParams.toString()}`
    )
    if (longRes.ok) {
      const longData = await longRes.json()
      return {
        accessToken: longData.access_token || shortToken,
        userId: '',
        expiresIn: Number(longData.expires_in) || 60 * 60 * 24 * 60,
      }
    }

    return {
      accessToken: shortToken,
      userId: '',
      expiresIn: Number(shortData.expires_in) || 3600,
    }
  }

  const formData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })

  const shortRes = await fetch(IG_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  if (!shortRes.ok) {
    throw new Error('Failed to exchange Instagram authorization code')
  }

  const shortData = await shortRes.json()
  const rawEntry = Array.isArray(shortData.data) ? shortData.data[0] : shortData
  const shortToken: string = rawEntry.access_token
  const userId = String(rawEntry.user_id || '')

  // Upgrade to long-lived token (60 days)
  const longParams = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortToken,
  })
  const longRes = await fetch(`${IG_LONG_LIVED_TOKEN_URL}?${longParams.toString()}`)

  if (longRes.ok) {
    const longData = await longRes.json()
    return {
      accessToken: longData.access_token || shortToken,
      userId,
      expiresIn: Number(longData.expires_in) || 60 * 60 * 24 * 60,
    }
  }

  return {
    accessToken: shortToken,
    userId,
    expiresIn: 3600,
  }
}

/**
 * 2. Fetch the authenticated Instagram Business/Creator profile.
 *    Supports both Meta Unified Login (/me/accounts -> instagram_business_account)
 *    and direct Instagram Login (/me).
 */
export async function getInstagramProfile(
  accessToken: string
): Promise<InstagramAccount> {
  if (accessToken === MOCK_ACCESS_TOKEN) {
    return getMockProfile()
  }

  if (process.env.INSTAGRAM_CONFIG_ID) {
    const pagesRes = await fetch(
      `${FB_GRAPH_URL}/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`
    )
    if (pagesRes.ok) {
      const pagesData = await pagesRes.json()
      const pageWithIg = (pagesData.data || []).find(
        (p: { instagram_business_account?: InstagramAccount }) =>
          p.instagram_business_account
      )
      if (pageWithIg?.instagram_business_account) {
        const ig = pageWithIg.instagram_business_account
        return {
          id: String(ig.id),
          username: String(ig.username || ''),
          name: String(ig.name || ig.username || 'Instagram Creator'),
          profile_picture_url: String(ig.profile_picture_url || ''),
        }
      }
    }
  }

  const res = await fetch(
    `${IG_GRAPH_URL}/me?fields=id,user_id,username,name,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
  )
  if (!res.ok) {
    throw new Error('Failed to fetch Instagram profile')
  }

  const data = await res.json()
  return {
    id: String(data.user_id || data.id || ''),
    username: String(data.username || ''),
    name: String(data.name || data.username || 'Instagram Creator'),
    profile_picture_url: String(data.profile_picture_url || ''),
  }
}

/**
 * 3. Get recent posts for the authenticated Instagram account.
 */
export async function getInstagramPosts(
  accessToken: string,
  igUserId?: string
): Promise<InstagramPost[]> {
  if (accessToken === MOCK_ACCESS_TOKEN) {
    return getMockPosts()
  }

  const baseUrl = getGraphBaseUrl()
  const targetNode =
    process.env.INSTAGRAM_CONFIG_ID && igUserId
      ? encodeURIComponent(igUserId)
      : 'me'

  const res = await fetch(
    `${baseUrl}/${targetNode}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,username&limit=24&access_token=${encodeURIComponent(accessToken)}`
  )
  if (!res.ok) {
    throw new Error('Failed to fetch Instagram posts')
  }

  const data = await res.json()
  return Array.isArray(data.data) ? data.data : []
}

/**
 * 4. Get details for a single Instagram media post.
 */
export async function getPostDetails(
  mediaId: string,
  accessToken: string
): Promise<InstagramPost> {
  if (accessToken === MOCK_ACCESS_TOKEN) {
    const found = getMockPosts().find((p) => p.id === mediaId)
    return found || getMockPosts()[0]
  }

  const baseUrl = getGraphBaseUrl()
  const res = await fetch(
    `${baseUrl}/${encodeURIComponent(mediaId)}?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,username&access_token=${encodeURIComponent(accessToken)}`
  )
  if (!res.ok) {
    throw new Error('Failed to fetch Instagram post details')
  }

  return await res.json()
}

/**
 * 5. Paginate all top-level comments for a specific post (explicitly omitting nested replies).
 */
export async function getPostComments(
  mediaId: string,
  accessToken: string
): Promise<CommentSyncResult> {
  const startMs = Date.now()

  if (accessToken === MOCK_ACCESS_TOKEN) {
    const comments = getMockComments(mediaId)
    return {
      comments,
      isComplete: true,
      pagesFetched: 1,
      fetchDurationMs: Date.now() - startMs,
    }
  }

  const baseUrl = getGraphBaseUrl()
  let comments: InstagramComment[] = []
  let url: string | null =
    `${baseUrl}/${encodeURIComponent(mediaId)}/comments?fields=id,text,username,timestamp,like_count&limit=50&access_token=${encodeURIComponent(accessToken)}`
  let pagesFetched = 0

  while (url && pagesFetched < MAX_COMMENT_PAGES) {
    const res: Response = await fetch(url)
    if (!res.ok) {
      let errorCode: InstagramApiErrorCode = 'IG_INCOMPLETE_SYNC'
      if (res.status === 401 || res.status === 403) {
        errorCode = 'IG_AUTH_EXPIRED'
      } else if (res.status === 429) {
        errorCode = 'IG_RATE_LIMITED'
      } else {
        try {
          const errBody = await res.json()
          const metaCode = errBody?.error?.code
          if (metaCode === 4 || metaCode === 32 || metaCode === 613) {
            errorCode = 'IG_RATE_LIMITED'
          } else if (metaCode === 190) {
            errorCode = 'IG_AUTH_EXPIRED'
          }
        } catch {
          // keep IG_INCOMPLETE_SYNC
        }
      }

      return {
        comments,
        isComplete: false,
        pagesFetched,
        fetchDurationMs: Date.now() - startMs,
        errorCode,
      }
    }

    const data: { data?: InstagramComment[]; paging?: { next?: string } } =
      await res.json()
    pagesFetched += 1
    if (Array.isArray(data.data)) {
      comments = comments.concat(data.data)
    }

    url = data.paging?.next || null
  }

  const isComplete = url === null
  return {
    comments,
    isComplete,
    pagesFetched,
    fetchDurationMs: Date.now() - startMs,
    errorCode: isComplete ? undefined : 'IG_INCOMPLETE_SYNC',
  }
}
