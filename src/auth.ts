// Demo authentication for the local adapter. In production this is
// Supabase Auth (email/password + magic link, SPEC.md §7.5); the session
// shape — a user with one or more role grants and an active grant index —
// is what the rest of the app depends on.

import type { DB, RoleGrant, User } from './domain/types'
import { mutate, nowIso, useDB } from './domain/store'
import { audit } from './domain/waitlist'

export interface Session {
  db: DB
  user: User | null
  grant: RoleGrant | null
}

export function useSession(): Session {
  const db = useDB()
  const user = db.users.find((u) => u.id === db.session.userId) ?? null
  const grant = user?.grants[db.session.grantIndex] ?? user?.grants[0] ?? null
  return { db, user, grant }
}

export function login(userId: string): void {
  mutate((db) => {
    db.session = { userId, grantIndex: 0 }
    audit(db, userId, 'auth.login', 'Signed in (demo)', nowIso())
  })
}

export function logout(): void {
  mutate((db) => {
    if (db.session.userId) audit(db, db.session.userId, 'auth.logout', 'Signed out', nowIso())
    db.session = { userId: null, grantIndex: 0 }
  })
}

// Where each role context lands after sign-in or a context switch.
export function landingFor(grant: RoleGrant | null): string {
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

// Explicit role-context switch for accounts with multiple grants (§7.5).
export function switchGrant(index: number): void {
  mutate((db) => {
    db.session.grantIndex = index
  })
}
