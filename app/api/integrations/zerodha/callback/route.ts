import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
export const dynamic = 'force-dynamic'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://port-red-pi.vercel.app'

// Kite redirects here after login: ?request_token=xxx&action=login&status=success
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status       = searchParams.get('status')
  const requestToken = searchParams.get('request_token')

  if (status !== 'success' || !requestToken)
    return NextResponse.redirect(`${SITE}/settings?zerodha=error&reason=kite_cancelled`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${SITE}/auth/login`)

  const apiKey    = process.env.ZERODHA_API_KEY
  const apiSecret = process.env.ZERODHA_API_SECRET
  if (!apiKey || !apiSecret)
    return NextResponse.redirect(`${SITE}/settings?zerodha=error&reason=misconfigured`)

  // SHA-256(api_key + request_token + api_secret)
  const checksum = crypto
    .createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex')

  // Exchange request_token for access_token
  const resp = await fetch('https://api.kite.trade/session/token', {
    method: 'POST',
    headers: { 'X-Kite-Version': '3', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum }),
  })
  const body = await resp.json()

  if (!resp.ok || !body.data?.access_token)
    return NextResponse.redirect(`${SITE}/settings?zerodha=error&reason=exchange_failed`)

  const { access_token, user_name, user_id: kiteUserId } = body.data

  // Store access_token per Supabase user — tokens expire at 6am IST daily
  await (supabase as any)
    .from('user_integrations')
    .upsert(
      {
        user_id: user.id,
        integration_name: 'zerodha',
        api_key:    access_token,        // access_token (daily, user-specific)
        api_secret: '',                  // secret is app-level, not stored per user
        meta: {
          kite_user_id:   kiteUserId,
          kite_user_name: user_name,
          token_date:     new Date().toISOString(),
        },
        last_synced_at: null,
      },
      { onConflict: 'user_id,integration_name' }
    )

  return NextResponse.redirect(`${SITE}/settings?zerodha=success`)
}
