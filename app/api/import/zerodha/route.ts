import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

/**
 * POST /api/import/zerodha
 * Thin proxy → Supabase Edge Function "import-trades"
 *
 * The web client continues to call this Next.js route.
 * The Flutter mobile app calls the Edge Function directly.
 */
export async function POST(req: Request) {
  const body = await req.json()

  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('import-trades', {
    body,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
