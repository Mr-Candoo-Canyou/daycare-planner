// Core data entities — SPEC.md §6

export type AgeGroup = 'infant' | 'toddler' | 'preschool'
export const AGE_GROUPS: AgeGroup[] = ['infant', 'toddler', 'preschool']

export type Role = 'parent' | 'staff' | 'daycare_admin' | 'funder' | 'it_admin'

export interface RoleGrant {
  role: Role
  daycareId?: string // required for staff / daycare_admin
}

export interface User {
  id: string
  name: string
  email: string
  mobile?: string
  grants: RoleGrant[]
  willingToStartDaycare?: string | null // ISO timestamp when flagged (§4.8.1)
  notificationPrefs: { sms: boolean; push: boolean; email: boolean }
}

export interface PriorityCriteria {
  sibling?: boolean
  indigenous?: boolean
  staffChild?: boolean
  neighbourhood?: boolean
}

export interface Child {
  id: string
  parentUserId: string
  name: string
  dob: string // ISO date
  desiredStartDate: string
  criteria: PriorityCriteria
  formData: Record<string, string | boolean>
  formSchemaVersion: number
}

export type ApplicationStatus = 'pending' | 'enrolled' | 'withdrawn'

export interface Application {
  id: string
  childId: string
  submittedAt: string
  status: ApplicationStatus
  rankedDaycareIds: string[] // index 0 = 1st choice
}

export type EntryStatus = 'active' | 'released' | 'ineligible'

export interface WaitlistEntry {
  id: string
  applicationId: string
  childId: string
  daycareId: string
  rank: number // parent's rank of this daycare, 1 = first choice
  dateAdded: string
  status: EntryStatus
  manualOrder?: number // admin override within tier (audited)
  notes: { by: string; text: string; at: string }[]
  flagged?: boolean
  ineligibleReason?: string
}

export type TierKind = 'sibling' | 'indigenous' | 'staff_child' | 'neighbourhood' | 'general'

export interface Tier {
  id: string
  kind: TierKind
  label: string
  description?: string
}

export interface Daycare {
  id: string
  name: string
  description: string
  address: string
  phone: string
  email: string
  hours: string
  fees: string
  subsidyAccepted: boolean
  languages: string[]
  photoEmoji: string
  capacity: Record<AgeGroup, number>
  availability: 'open' | 'waitlist_only' | 'closed'
  tiers: Tier[] // ordered; a 'general' tier catches everyone
}

export type OfferStatus = 'open' | 'accepted' | 'declined' | 'expired' | 'superseded'

export interface Offer {
  id: string
  waitlistEntryId: string
  childId: string
  daycareId: string
  createdAt: string
  expiresAt: string // server-computed at creation (§4.2.3)
  status: OfferStatus
}

export interface Enrolment {
  id: string
  childId: string
  daycareId: string
  startDate: string
  status: 'active' | 'ended'
}

export interface HoldingFeeRecord {
  id: string
  childId: string
  retainedEntryIds: string[]
  status: 'paid' | 'due' | 'lapsed'
  termStart: string
  termEnd: string
}

export type FormFieldType = 'text' | 'date' | 'checkbox' | 'select'

export interface FormField {
  id: string
  label: string
  type: FormFieldType
  required: boolean
  options?: string[]
  system?: boolean // system fields (name, dob…) cannot be removed, only relabelled
}

export interface FormSchema {
  version: number
  fields: FormField[]
}

export interface PolicyTemplate {
  id: string
  name: string
  description: string
  tiers: Omit<Tier, 'id'>[]
}

export interface Settings {
  offerWindowDays: number
  holdingFeeAnnual: number
  graceDays: number
}

export type Channel = 'sms' | 'push' | 'email'

export interface NotificationRecord {
  id: string
  userId: string
  event: string
  body: string
  channels: { channel: Channel; delivered: boolean }[]
  at: string
  read: boolean
}

export interface BroadcastMessage {
  id: string
  funderUserId: string
  recipientUserIds: string[]
  body: string
  at: string
}

export interface AuditEntry {
  id: string
  actor: string
  action: string
  detail: string
  at: string
}

export interface DB {
  users: User[]
  children: Child[]
  applications: Application[]
  entries: WaitlistEntry[]
  daycares: Daycare[]
  offers: Offer[]
  enrolments: Enrolment[]
  holdingFees: HoldingFeeRecord[]
  formSchema: FormSchema
  templates: PolicyTemplate[]
  settings: Settings
  notifications: NotificationRecord[]
  broadcasts: BroadcastMessage[]
  audit: AuditEntry[]
  session: { userId: string | null; grantIndex: number }
}
