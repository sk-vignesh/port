/**
 * Supabase Edge Function: amfi-nav
 *
 * GET /functions/v1/amfi-nav?q=<name>           — search MF schemes by name
 * GET /functions/v1/amfi-nav?code=<schemeCode>  — get latest NAV by AMFI scheme code
 *
 * Proxies the AMFI India free open data API (https://api.mfapi.in).
 * No auth required — returns public NAV data only.
 */
import { handleCors, json } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url  = new URL(req.url)
  const q    = url.searchParams.get('q')?.trim()
  const code = url.searchParams.get('code')?.trim()

  try {
    // ── Search by name ─────────────────────────────────────────────────────────
    if (q && q.length >= 2) {
      const res = await fetch(
        `https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(6000) }
      )
      if (!res.ok) return json([])

      const schemes: Array<{ schemeCode: number; schemeName: string }> = await res.json()

      return json(
        schemes.slice(0, 12).map(s => ({
          code:     String(s.schemeCode),
          name:     s.schemeName,
          currency: 'INR',
          type:     'MUTUALFUND',
        }))
      )
    }

    // ── Get latest NAV by scheme code ──────────────────────────────────────────
    if (code) {
      const res = await fetch(
        `https://api.mfapi.in/mf/${encodeURIComponent(code)}/latest`,
        { signal: AbortSignal.timeout(6000) }
      )
      if (!res.ok) return json(null)

      const data: {
        status: string
        data: Array<{ date: string; nav: string }>
      } = await res.json()

      const latest = data?.data?.[0]
      if (!latest) return json(null)

      return json({
        code,
        date: latest.date,           // "DD-MM-YYYY" format from AMFI
        nav:  parseFloat(latest.nav) // INR, e.g. 234.5678
      })
    }

    return json({ error: 'Provide q (search) or code (scheme code) parameter' }, 400)
  } catch {
    return json([])
  }
})
