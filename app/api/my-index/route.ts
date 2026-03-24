import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

/**
 * GET /api/my-index?days=365
 * Thin proxy → Supabase Edge Function "personal-index"
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const days = searchParams.get('days') ?? '365'

  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('personal-index', {
    body: { days: parseInt(days, 10) },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
