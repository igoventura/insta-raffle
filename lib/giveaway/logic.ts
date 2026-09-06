import { InstagramComment } from '../instagram/api'

export interface GiveawayRules {
  numWinners: number
  minMentions: number
  allowMultipleEntries: boolean
}

export interface GiveawayResult {
  winners: InstagramComment[]
  totalValidEntries: number
  totalCommentsProcessed: number
}

export function pickWinners(comments: InstagramComment[], rules: GiveawayRules): GiveawayResult {
  const validEntries: InstagramComment[] = []
  const userEntryCount = new Map<string, number>()

  // Regex to find @mentions (alphanumeric, underscores, dots)
  const mentionRegex = /@[\w\.]+/g

  for (const comment of comments) {
    const mentions = comment.text.match(mentionRegex) || []
    
    // Check if it meets the minimum mentions requirement
    if (mentions.length >= rules.minMentions) {
      const hasEntered = userEntryCount.has(comment.username)
      
      if (!hasEntered || rules.allowMultipleEntries) {
        validEntries.push(comment)
        userEntryCount.set(comment.username, (userEntryCount.get(comment.username) || 0) + 1)
      }
    }
  }

  // Shuffle and pick winners
  const shuffled = [...validEntries].sort(() => 0.5 - Math.random())
  
  // Ensure we pick unique users as winners (even if allowMultipleEntries is true, one user shouldn't win twice in the same draw usually, but for simplicity we just slice. Let's make sure winners are unique users)
  const winners: InstagramComment[] = []
  const winningUsernames = new Set<string>()

  for (const entry of shuffled) {
    if (winners.length >= rules.numWinners) break
    
    if (!winningUsernames.has(entry.username)) {
      winners.push(entry)
      winningUsernames.add(entry.username)
    }
  }

  return {
    winners,
    totalValidEntries: validEntries.length,
    totalCommentsProcessed: comments.length
  }
}
