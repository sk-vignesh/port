import { redirect } from 'next/navigation'

// /segments/new → redirect to /taxonomies/new (Segments live under /taxonomies)
export default function SegmentsNewRedirect() {
  redirect('/taxonomies/new')
}
