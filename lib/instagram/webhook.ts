import { instagramConfig } from './config'
import { supabase } from '@/lib/supabase'

const GRAPH_API_URL = `${instagramConfig.graphApiPublishUrl}/${instagramConfig.apiVersion}`
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/instagram`

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

export async function subscribe(userId: string, fields: string[]) {
  try {
    const accessToken = await getUserAccessToken(userId)
    const response = await fetch(
      `${GRAPH_API_URL}/instagram/subscriptions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          callback_url: WEBHOOK_URL,
          fields: fields.join(','),
          verify_token: process.env.WEBHOOK_VERIFY_TOKEN,
          object: 'instagram',
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to subscribe to webhook')
    }

    return await response.json()
  } catch (error) {
    console.error('Error subscribing to webhook:', error)
    throw new Error('Failed to subscribe to webhook')
  }
}

export async function listSubscriptions(userId: string) {
  try {
    const accessToken = await getUserAccessToken(userId)
    const response = await fetch(
      `${GRAPH_API_URL}/instagram/subscriptions?access_token=${accessToken}`
    )

    if (!response.ok) {
      throw new Error('Failed to list subscriptions')
    }

    return await response.json()
  } catch (error) {
    console.error('Error listing subscriptions:', error)
    throw new Error('Failed to list subscriptions')
  }
}

export async function deleteSubscription(userId: string, subscriptionId: string) {
  try {
    const accessToken = await getUserAccessToken(userId)
    const response = await fetch(
      `${GRAPH_API_URL}/instagram/subscriptions`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          object: 'instagram',
          subscription_id: subscriptionId,
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to delete subscription')
    }

    return await response.json()
  } catch (error) {
    console.error('Error deleting subscription:', error)
    throw new Error('Failed to delete subscription')
  }
}