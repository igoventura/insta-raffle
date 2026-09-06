const GRAPH_URL = 'https://graph.facebook.com/v19.0'

export interface InstagramAccount {
  id: string
  username: string
  profile_picture_url: string
  name: string
}

export interface InstagramPost {
  id: string
  caption: string
  media_type: string
  media_url: string
  thumbnail_url: string
  permalink: string
  timestamp: string
}

export interface InstagramComment {
  id: string
  text: string
  username: string
  timestamp: string
  like_count: number
}

/**
 * 1. Get the Facebook Pages the user manages, and extract the connected Instagram account.
 */
export async function getInstagramAccounts(accessToken: string): Promise<InstagramAccount[]> {
  const res = await fetch(`${GRAPH_URL}/me/accounts?fields=instagram_business_account{id,username,profile_picture_url,name}&access_token=${accessToken}`)
  if (!res.ok) throw new Error('Failed to fetch Facebook pages')
  
  const data = await res.json()
  const accounts: InstagramAccount[] = []

  for (const page of data.data) {
    if (page.instagram_business_account) {
      accounts.push({
        id: page.instagram_business_account.id,
        username: page.instagram_business_account.username,
        profile_picture_url: page.instagram_business_account.profile_picture_url,
        name: page.instagram_business_account.name,
      })
    }
  }

  return accounts
}

/**
 * 2. Get recent posts for an Instagram account
 */
export async function getInstagramPosts(igAccountId: string, accessToken: string): Promise<InstagramPost[]> {
  const res = await fetch(`${GRAPH_URL}/${igAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=20&access_token=${accessToken}`)
  if (!res.ok) throw new Error('Failed to fetch posts')
  
  const data = await res.json()
  return data.data
}

/**
 * 3. Get comments for a specific post (handles pagination to get all comments)
 */
export async function getPostComments(mediaId: string, accessToken: string): Promise<InstagramComment[]> {
  let comments: InstagramComment[] = []
  let url = `${GRAPH_URL}/${mediaId}/comments?fields=id,text,username,timestamp,like_count&limit=50&access_token=${accessToken}`

  while (url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch comments')
    
    const data = await res.json()
    if (data.data) {
      comments = comments.concat(data.data)
    }

    // Check for next page
    url = data.paging?.next || null
  }

  return comments
}
