/**
 * SecLink — hyperlinks a security name to its detail page.
 * Needs securityId to build the href; renders plain text if id is missing.
 */
import Link from 'next/link'

interface SecLinkProps {
  id: string | null | undefined
  name: string | null | undefined
  className?: string
}

export default function SecLink({ id, name, className }: SecLinkProps) {
  if (!name) return null
  if (!id)   return <span className={className}>{name}</span>
  return (
    <Link
      href={`/securities/${id}`}
      style={{ color: 'var(--color-accent-light)', textDecoration: 'none', fontWeight: 'inherit' }}
      className={className}
      prefetch={false}
    >
      {name}
    </Link>
  )
}
