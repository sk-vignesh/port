import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

/**
 * GET /api/gains
 * Thin proxy → Supabase Edge Function "gains"
 * (mobile calls the Edge Function directly via supabase.functions.invoke)
 */
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('gains')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
