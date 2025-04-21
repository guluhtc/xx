import { instagramConfig } from './config'
import { supabase } from '@/lib/supabase'

const GRAPH_API_URL = `${instagramConfig.graphApiUrl}/${instagramConfig.apiVersion}`
const GRAPH_API_PUBLISH_URL = `${instagramConfig.graphApiPublishUrl}/${instagramConfig.apiVersion}`

async function getUserAccessToken(userId: string): Promise<string> {
  const { data: session, error } = await supabase
    .from('instagram_auth_sessions')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (error) throw error
  if (!session?.access_token) throw new Error('No valid Instagram session found')

  return session.access_token
}

export async function getProfile(userId: string) {
  try {
    const accessToken = await getUserAccessToken(userId)
    const response = await fetch(
      `${GRAPH_API_URL}/me?fields=id,username,account_type,media_count&access_token=${accessToken}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch profile')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching profile:', error)
    throw new Error('Failed to fetch profile')
  }
}

export async function getMedia(userId: string, limit = 25) {
  try {
    const accessToken = await getUserAccessToken(userId)
    const response = await fetch(
      `${GRAPH_API_URL}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${accessToken}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch media')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching media:', error)
    throw new Error('Failed to fetch media')
  }
}

export async function schedulePost(post: InstagramPost, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('scheduled_posts')
      .insert([{
        user_id: userId,
        caption: post.caption,
        media_type: post.media_type,
        media_url: post.media_url,
        scheduled_time: post.scheduled_time,
        status: 'pending'
      }])

    if (error) throw error

  } catch (error) {
    console.error('Error scheduling post:', error)
    throw new Error('Failed to schedule post')
  }
}

export async function publishPost(userId: string, mediaUrl: string, caption: string): Promise<void> {
  try {
    const accessToken = await getUserAccessToken(userId)

    // Create container
    const containerResponse = await fetch(`${GRAPH_API_PUBLISH_URL}/me/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption,
        access_token: accessToken,
      }),
    })

    if (!containerResponse.ok) {
      throw new Error('Failed to create media container')
    }

    const { id: containerId } = await containerResponse.json()

    // Publish container
    const publishResponse = await fetch(`${GRAPH_API_PUBLISH_URL}/me/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    })

    if (!publishResponse.ok) {
      throw new Error('Failed to publish post')
    }
  } catch (error) {
    console.error('Error publishing post:', error)
    throw new Error('Failed to publish post')
  }
}

export async function getInsights(userId: string, metrics: string[], since?: string, until?: string) {
  try {
    const accessToken = await getUserAccessToken(userId)
    const params = new URLSearchParams({
      metric: metrics.join(','),
      period: 'day',
      access_token: accessToken
    })

    if (since) params.append('since', since)
    if (until) params.append('until', until)

    const response = await fetch(`${GRAPH_API_URL}/me/insights?${params.toString()}`)

    if (!response.ok) {
      throw new Error('Failed to fetch insights')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching insights:', error)
    throw new Error('Failed to fetch insights')
  }
}

export async function getMediaInsights(userId: string, mediaId: string) {
  try {
    const accessToken = await getUserAccessToken(userId)
    const response = await fetch(
      `${GRAPH_API_URL}/${mediaId}/insights?metric=engagement,impressions,reach&access_token=${accessToken}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch media insights')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching media insights:', error)
    throw new Error('Failed to fetch media insights')
  }
}

export async function getHashtagInfo(userId: string, hashtag: string) {
  try {
    const accessToken = await getUserAccessToken(userId)
    const response = await fetch(
      `${GRAPH_API_URL}/ig_hashtag_search?q=${hashtag}&access_token=${accessToken}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch hashtag info')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching hashtag info:', error)
    throw new Error('Failed to fetch hashtag info')
  }
}

interface InstagramPost {
  caption: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url: string
  scheduled_time: string
}