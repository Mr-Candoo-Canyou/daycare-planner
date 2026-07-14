// The backend interface (SPEC §7.2): every page talks to this, never to a
// storage layer directly. Two implementations:
//   local.ts    — in-browser demo adapter over src/domain (localStorage)
//   supabase.ts — production adapter over supabase-js (RLS + RPCs)
// Selection happens in index.ts from VITE_SUPABASE_URL/_ANON_KEY.

import type {
  AgeGroup,
  AuditEntry,
  FormField,
  FormSchema,
  NotificationRecord,
  PolicyTemplate,
  PriorityCriteria,
  Role,
  Settings,
  Tier,
} from '../domain/types'

// ------------------------------------------------------------- session

export interface SessionGrant {
  role: Role
  daycareId?: string
  daycareName?: string
}

export interface SessionInfo {
  userId: string
  name: string
  email: string
  mobile?: string
  willingFlagAt: string | null
  grants: SessionGrant[]
  grantIndex: number
}

export interface DemoUser {
  id: string
  name: string
  email: string
  grants: SessionGrant[]
}

// ------------------------------------------------------------ directory

export interface DaycareCard {
  id: string
  name: string
  description: string
  address: string
  phone: string
  email: string
  hours: string
  fees: string
  languages: string[]
  photoEmoji: string
  availability: 'open' | 'waitlist_only' | 'closed'
  capacity: Record<AgeGroup, number>
  enrolledByGroup: Record<AgeGroup, number>
  enrolledTotal: number
  waitlistCount: number
}

// --------------------------------------------------------------- parent

export interface PositionRow {
  entryId: string
  daycareId: string
  daycareName: string
  rank: number
  position: number | null
  totalActive: number
  openSpots: number
  heldByFee: boolean
}

export interface OfferView {
  id: string
  daycareId: string
  daycareName: string
  rank: number
  expiresAt: string
  // higher-ranked active entries the parent may retain on accept (§4.2.4)
  higherRanked: { entryId: string; rank: number; daycareName: string; position: number | null }[]
}

export interface FamilyChild {
  childId: string
  name: string
  dob: string
  desiredStartDate: string
  applicationId: string | null
  applicationStatus: 'pending' | 'enrolled' | 'withdrawn' | null
  enrolledDaycareName: string | null
  offers: OfferView[]
  positions: PositionRow[]
  holdingFee: { id: string; termEnd: string; retainedCount: number } | null
}

export interface ApplicationInput {
  name: string
  dob: string
  desiredStartDate: string
  criteria: PriorityCriteria
  formData: Record<string, string | boolean>
  rankedDaycareIds: string[]
}

// -------------------------------------------------------------- daycare

export interface WaitlistRow {
  entryId: string
  childName: string
  ageGroup: AgeGroup
  tierLabel: string
  dateAdded: string
  flagged: boolean
  hasOpenOffer: boolean
  notes: string[]
}

export interface DaycareWaitlist {
  rows: WaitlistRow[]
  openSpots: number
  openOffers: number
}

// --------------------------------------------------------------- funder

export interface FunderOverview {
  totalCapacity: number
  totalEnrolled: number
  perDaycare: { daycareId: string; name: string; capacity: number; enrolled: number; waitlist: string }[]
  waitlistByAgeGroup: Record<AgeGroup, string>
  indigenousEnrolledDisclosed: string
}

export interface FlaggedParent {
  name: string
  email: string
  mobile?: string
  flaggedAt: string
}

export interface BroadcastView {
  body: string
  at: string
}

// ------------------------------------------------------------- IT admin

export interface UserRow {
  id: string
  name: string
  email: string
  mobile?: string
  grants: SessionGrant[]
}

// -------------------------------------------------------------- backend

export interface Backend {
  readonly mode: 'local' | 'supabase'

  // change notifications (store mutation / realtime) → useQuery re-runs
  subscribe(cb: () => void): () => void

  // session & auth
  getSession(): Promise<SessionInfo | null>
  signOut(): Promise<void>
  setActiveGrant(index: number): Promise<void>
  // local mode
  listDemoUsers(): Promise<DemoUser[]>
  signInDemo(userId: string): Promise<void>
  // supabase mode
  signInPassword(email: string, password: string): Promise<void>
  signUp(email: string, password: string, name: string): Promise<void>
  signInMagicLink(email: string): Promise<void>
  resetDemo(): void

  // public directory
  listDaycares(): Promise<DaycareCard[]>

  // shared
  getSettings(): Promise<Settings>
  getFormSchema(): Promise<FormSchema>
  listTemplates(): Promise<PolicyTemplate[]>

  // parent
  getFamily(): Promise<FamilyChild[]>
  submitApplication(input: ApplicationInput): Promise<void>
  acceptOffer(offerId: string, retainedEntryIds: string[]): Promise<void>
  declineOffer(offerId: string): Promise<void>
  withdraw(applicationId: string, daycareIds: string[] | null): Promise<void>
  lapseHoldingFee(feeId: string): Promise<void>
  setWillingFlag(flagged: boolean): Promise<void>
  listMyNotifications(): Promise<NotificationRecord[]>
  markNotificationsRead(): Promise<void>
  unreadCount(): Promise<number>

  // daycare staff/admin
  getDaycareWaitlist(daycareId: string): Promise<DaycareWaitlist>
  makeOffer(entryId: string): Promise<void>
  markIneligible(entryId: string, reason: string): Promise<void>
  moveEntry(daycareId: string, entryId: string, direction: -1 | 1): Promise<void>
  setEntryFlag(entryId: string, flagged: boolean): Promise<void>
  addEntryNote(entryId: string, body: string): Promise<void>
  getTiers(daycareId: string): Promise<Tier[]>
  saveTiers(daycareId: string, tiers: Omit<Tier, 'id'>[]): Promise<void>

  // funder
  funderOverview(): Promise<FunderOverview>
  listFlaggedParents(): Promise<FlaggedParent[]>
  sendBroadcast(body: string): Promise<number>
  listBroadcasts(): Promise<BroadcastView[]>

  // IT admin
  updateSettings(patch: Partial<Settings>): Promise<void>
  saveFormSchema(fields: FormField[]): Promise<void>
  listUsers(): Promise<UserRow[]>
  auditLog(): Promise<(AuditEntry & { actorName: string })[]>
}
