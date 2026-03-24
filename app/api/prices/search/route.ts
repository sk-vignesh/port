import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

/**
 * GET /api/prices/search?q=Reliance
 * Thin proxy → Supabase Edge Function "price-search"
 * (mobile calls the Edge Function directly — no auth needed)
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('price-search', {
    body: { q },
  })
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [])
}
