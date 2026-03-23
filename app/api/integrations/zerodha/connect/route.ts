import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// Redirects the logged-in user to the Kite login page
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'))

  const apiKey = process.env.ZERODHA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ZERODHA_API_KEY not configured' }, { status: 500 })

  const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`
  return NextResponse.redirect(loginUrl)
}
