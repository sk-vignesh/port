import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { api_key, api_secret } = await req.json()
  if (!api_key?.trim() || !api_secret?.trim())
    return NextResponse.json({ error: 'api_key and api_secret are required' }, { status: 400 })

  const { error } = await supabase
    .from('user_integrations' as any)
    .upsert(
      { user_id: user.id, integration_name: 'groww', api_key: api_key.trim(), api_secret: api_secret.trim() },
      { onConflict: 'user_id,integration_name' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('user_integrations' as any)
    .delete()
    .eq('user_id', user.id)
    .eq('integration_name', 'groww')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
