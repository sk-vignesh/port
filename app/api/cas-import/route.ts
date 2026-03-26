import { NextResponse } from 'next/server'

/**
 * POST /api/cas-import
 *
 * CAS (Consolidated Account Statement) PDF import.
 * CAMS/KFintech PDF parsing requires a dedicated service.
 * This stub returns a clear not-yet-available response so the UI
 * can show a friendly message instead of a silent 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'CAS import is coming soon. Please use manual add or contact support.',
      code: 'NOT_IMPLEMENTED',
    },
    { status: 501 }
  )
}
