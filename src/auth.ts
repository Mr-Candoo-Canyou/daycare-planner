// Session hook over the backend (local demo picker or Supabase Auth —
// SPEC §7.5). The shape pages consume — user info plus an active role
// grant — is identical in both modes.

import { backend, useQuery } from './backend'
import type { SessionGrant, SessionInfo } from './backend/types'

export interface Session {
  session: SessionInfo | null
  grant: SessionGrant | null
  loading: boolean
}

export function useSession(): Session {
  const q = useQuery(() => backend.getSession())
  const session = q.data ?? null
  const grant = session ? (session.grants[session.grantIndex] ?? session.grants[0] ?? null) : null
  return { session, grant, loading: q.loading }
}

// Where each role context lands after sign-in or a context switch.
export function landingFor(grant: SessionGrant | null): string {
  switch (grant?.role) {
    case 'parent':
      return '/family'
    case 'staff':
    case 'daycare_admin':
      return '/waitlist'
    case 'funder':
      return '/funder'
    case 'it_admin':
      return '/it'
    default:
      return '/login'
  }
}
