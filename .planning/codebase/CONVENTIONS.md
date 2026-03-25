# CONVENTIONS.md — Code Style & Patterns

## TypeScript Style
- **Strict mode**: `strict: false` in `tsconfig.json` — some implicit `any` tolerated
- **Path alias**: `@/` maps to project root (e.g. `import { formatAmount } from '@/lib/format'`)
- **Inline types**: Types declared inline near usage, not in separate `types/` file
- **`unknown` casting pattern**: Used routinely for Supabase columns lacking generated types:
  ```ts
  const portfolios = (portfoliosRaw as unknown as Portfolio[] | null) ?? []
  ```
- **Interface over type**: Interfaces used for object shapes (`interface HoldingRow {...}`)

## Component Patterns

### Server Components (data fetching)
```tsx
export const dynamic = 'force-dynamic'

export default async function SomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: rows } = await supabase.from('table').select('...')
  return <SomeClientComponent rows={rows ?? []} />
}
```

### Client Components (interactivity)
```tsx
'use client'

import { useState } from 'react'
export default function SomeClientComponent({ rows }: { rows: Row[] }) {
  const [active, setActive] = useState(false)
  // ...
}
```

### API Route Handlers
```ts
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // parse body, validate, insert, return result
}
```

## Styling Conventions
- **No inline Tailwind** — all styling via CSS custom properties + utility classes from `app/globals.css`
- **Inline `style={{}}` props** preferred for one-off layout (padding, margins, flex, colors)
- **CSS variables** for all colours:
  ```css
  var(--color-text-primary)
  var(--color-text-muted)
  var(--color-accent)
  var(--color-accent-light)
  var(--color-bg-elevated)
  var(--color-bg-page)
  var(--color-bg-input)
  var(--color-border)
  var(--color-success)
  var(--color-danger)
  ```
- **Badge classes**: `.badge .badge-blue`, `.badge-green`, `.badge-purple`, `.badge-gray`
- **Card class**: `.card` (elevated panel with border-radius, `--color-bg-elevated` background)
- **Button classes**: `.btn .btn-primary`, `.btn-secondary`, `.btn-sm`, `.btn-danger`

## Amount Encoding
- Monetary values stored as **BIGINT × 100** (1 EUR/INR = 100)
- Share quantities as **BIGINT × 100,000,000** (1 share = 100_000_000)
- Display: `lib/format.ts` → `formatAmount(value, currency)` divides by 100 internally

## Supabase Query Pattern
- Server: `createClient()` from `lib/supabase/server.ts` (async, uses cookie store)
- Browser: `createClient()` from `lib/supabase/client.ts` (singleton browser client)
- Never pass user ID manually — rely on RLS with `auth.uid()`
- Use `.maybeSingle()` instead of `.single()` when row may not exist

## Error Handling
- Server components: unhandled Supabase errors result in null data — defensively default with `?? []`
- API routes: explicit `NextResponse.json({ error: msg }, { status: N })`
- Client components: local `useState<string | null>(null)` for error display
- No global error boundary — each page handles its own empty/error state

## Performance Math Conventions
- All math functions in `lib/performance.ts` are **pure** (no side effects, no DB calls)
- Edge functions duplicate the `buildHoldings` function in `supabase/functions/_shared/performance.ts` (Deno-compatible copy)

## Asset Class Convention
- 4 classes: `EQUITY`, `COMMODITY`, `FIXED_INCOME`, `REAL_ESTATE`
- Always import from `lib/assetClasses.ts` — never inline icon/label maps
