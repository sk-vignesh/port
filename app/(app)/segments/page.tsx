import { redirect } from 'next/navigation'

// /segments → redirect to /taxonomies (Segments live under /taxonomies in the app)
export default function SegmentsRedirectPage() {
  redirect('/taxonomies')
}
