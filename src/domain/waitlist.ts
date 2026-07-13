// Ranked-choice waitlist engine — SPEC.md §4.2.2–4.2.7.
// Pure functions over the DB value; all mutation goes through here so the
// inter-daycare rules (cascade on acceptance, holding fees, concurrent
// offers) live in one tested place, independent of the storage backend.

import type {
  AgeGroup,
  Channel,
  Child,
  DB,
  Daycare,
  Offer,
  Tier,
  User,
  WaitlistEntry,
} from './types'

let idCounter = 0
export function newId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

const DAY_MS = 24 * 60 * 60 * 1000

// Age group is derived, never stored (§4.2.7): infant < 18 months,
// toddler 18–35 months, preschool 36+ months.
export function ageGroupFor(dobIso: string, atIso: string): AgeGroup {
  const dob = new Date(dobIso)
  const at = new Date(atIso)
  const months =
    (at.getFullYear() - dob.getFullYear()) * 12 + (at.getMonth() - dob.getMonth())
  if (months < 18) return 'infant'
  if (months < 36) return 'toddler'
  return 'preschool'
}

export function childById(db: DB, childId: string): Child {
  const c = db.children.find((c) => c.id === childId)
  if (!c) throw new Error(`unknown child ${childId}`)
  return c
}

export function daycareById(db: DB, daycareId: string): Daycare {
  const d = db.daycares.find((d) => d.id === daycareId)
  if (!d) throw new Error(`unknown daycare ${daycareId}`)
  return d
}

function tierMatches(tier: Tier, child: Child): boolean {
  switch (tier.kind) {
    case 'sibling':
      return !!child.criteria.sibling
    case 'indigenous':
      return !!child.criteria.indigenous
    case 'staff_child':
      return !!child.criteria.staffChild
    case 'neighbourhood':
      return !!child.criteria.neighbourhood
    case 'general':
      return true
  }
}

// First matching tier in the daycare's configured order wins; a 'general'
// tier acts as the catch-all. Children matching no tier sort after all tiers.
export function tierIndexFor(daycare: Daycare, child: Child): number {
  const i = daycare.tiers.findIndex((t) => tierMatches(t, child))
  return i === -1 ? daycare.tiers.length : i
}

// Ordered active waitlist for one daycare: by tier, then admin manual order
// (when set), then date added (§4.3).
export function orderedWaitlist(db: DB, daycareId: string): WaitlistEntry[] {
  const daycare = daycareById(db, daycareId)
  const entries = db.entries.filter(
    (e) => e.daycareId === daycareId && e.status === 'active'
  )
  return [...entries].sort((a, b) => {
    const ta = tierIndexFor(daycare, childById(db, a.childId))
    const tb = tierIndexFor(daycare, childById(db, b.childId))
    if (ta !== tb) return ta - tb
    const ma = a.manualOrder ?? Number.POSITIVE_INFINITY
    const mb = b.manualOrder ?? Number.POSITIVE_INFINITY
    if (ma !== mb) return ma - mb
    return a.dateAdded.localeCompare(b.dateAdded)
  })
}

export function positionOf(db: DB, daycareId: string, childId: string): number | null {
  const i = orderedWaitlist(db, daycareId).findIndex((e) => e.childId === childId)
  return i === -1 ? null : i + 1
}

export function activeEnrolment(db: DB, childId: string) {
  return db.enrolments.find((e) => e.childId === childId && e.status === 'active') ?? null
}

export function enrolledCount(db: DB, daycareId: string, group?: AgeGroup, nowIso?: string): number {
  const now = nowIso ?? new Date().toISOString()
  return db.enrolments.filter(
    (e) =>
      e.daycareId === daycareId &&
      e.status === 'active' &&
      (!group || ageGroupFor(childById(db, e.childId).dob, now) === group)
  ).length
}

export function openSpots(db: DB, daycareId: string, nowIso?: string): number {
  const d = daycareById(db, daycareId)
  const cap = d.capacity.infant + d.capacity.toddler + d.capacity.preschool
  const pendingOffers = db.offers.filter(
    (o) => o.daycareId === daycareId && o.status === 'open'
  ).length
  return Math.max(0, cap - enrolledCount(db, daycareId, undefined, nowIso) - pendingOffers)
}

// Next eligible child for an offer: first active entry without an open offer
// whose child is not already enrolled at this daycare (§4.3).
export function nextEligible(db: DB, daycareId: string): WaitlistEntry | null {
  for (const e of orderedWaitlist(db, daycareId)) {
    const hasOpenOffer = db.offers.some(
      (o) => o.waitlistEntryId === e.id && o.status === 'open'
    )
    if (hasOpenOffer) continue
    const enr = activeEnrolment(db, e.childId)
    if (enr && enr.daycareId === daycareId) continue
    return e
  }
  return null
}

// ---------------------------------------------------------------- audit

export function audit(db: DB, actor: string, action: string, detail: string, atIso: string): void {
  db.audit.unshift({ id: newId('aud'), actor, action, detail, at: atIso })
}

// --------------------------------------------------------- notifications

// Simulated multi-channel dispatch, priority SMS → push → email (§4.2.3).
// The local adapter records the attempt per channel; the Supabase adapter
// would call Twilio / FCM from an Edge Function here.
export function notify(db: DB, user: User, event: string, body: string, atIso: string): void {
  const channels: { channel: Channel; delivered: boolean }[] = []
  channels.push({ channel: 'sms', delivered: !!user.mobile && user.notificationPrefs.sms })
  channels.push({ channel: 'push', delivered: user.notificationPrefs.push })
  channels.push({ channel: 'email', delivered: user.notificationPrefs.email })
  db.notifications.unshift({
    id: newId('ntf'),
    userId: user.id,
    event,
    body,
    channels,
    at: atIso,
    read: false,
  })
}

function notifyParentOfChild(db: DB, childId: string, event: string, body: string, atIso: string) {
  const child = childById(db, childId)
  const parent = db.users.find((u) => u.id === child.parentUserId)
  if (parent) notify(db, parent, event, body, atIso)
}

// ---------------------------------------------------------------- offers

export function makeOffer(db: DB, entryId: string, actor: string, nowIso: string): Offer {
  const entry = db.entries.find((e) => e.id === entryId)
  if (!entry || entry.status !== 'active') throw new Error('entry not active')
  if (db.offers.some((o) => o.waitlistEntryId === entryId && o.status === 'open'))
    throw new Error('entry already has an open offer')
  const expiresAt = new Date(
    new Date(nowIso).getTime() + db.settings.offerWindowDays * DAY_MS
  ).toISOString()
  const offer: Offer = {
    id: newId('off'),
    waitlistEntryId: entry.id,
    childId: entry.childId,
    daycareId: entry.daycareId,
    createdAt: nowIso,
    expiresAt,
    status: 'open',
  }
  db.offers.unshift(offer)
  const daycare = daycareById(db, entry.daycareId)
  const child = childById(db, entry.childId)
  audit(db, actor, 'offer.created', `Offer to ${child.name} at ${daycare.name}`, nowIso)
  notifyParentOfChild(
    db,
    entry.childId,
    'offer',
    `${daycare.name} has offered ${child.name} a spot. Respond by ${new Date(expiresAt).toLocaleDateString('en-CA')}.`,
    nowIso
  )
  return offer
}

function releaseEntry(db: DB, entry: WaitlistEntry): void {
  entry.status = 'released'
  // Cancel any open offer on a released entry; the daycare just sees its
  // list advance, no reason attached (§5 Data Minimization).
  for (const o of db.offers) {
    if (o.waitlistEntryId === entry.id && o.status === 'open') o.status = 'superseded'
  }
}

export interface AcceptResult {
  enrolledDaycareId: string
  releasedBelow: number
  retainedAbove: number
  holdingFeeCharged: boolean
}

// Accept an offer (§4.2.3–4.2.5). retainedEntryIds selects which
// higher-ranked waitlists to keep (holding fee applies when non-empty).
export function acceptOffer(
  db: DB,
  offerId: string,
  retainedEntryIds: string[],
  actor: string,
  nowIso: string
): AcceptResult {
  const offer = db.offers.find((o) => o.id === offerId)
  if (!offer || offer.status !== 'open') throw new Error('offer not open')
  if (new Date(offer.expiresAt) < new Date(nowIso)) throw new Error('offer expired')
  const accepted = db.entries.find((e) => e.id === offer.waitlistEntryId)
  if (!accepted) throw new Error('missing entry')
  const application = db.applications.find((a) => a.id === accepted.applicationId)
  if (!application) throw new Error('missing application')

  offer.status = 'accepted'

  // Seamless transition (§4.2.4): end any current enrolment at a lower-ranked daycare.
  const prev = activeEnrolment(db, accepted.childId)
  if (prev) prev.status = 'ended'
  db.enrolments.push({
    id: newId('enr'),
    childId: accepted.childId,
    daycareId: accepted.daycareId,
    startDate: nowIso,
    status: 'active',
  })
  // The accepted entry leaves the waitlist.
  accepted.status = 'released'

  const siblings = db.entries.filter(
    (e) =>
      e.applicationId === application.id && e.id !== accepted.id && e.status === 'active'
  )
  let releasedBelow = 0
  let retainedAbove = 0
  for (const e of siblings) {
    if (e.rank > accepted.rank) {
      releaseEntry(db, e)
      releasedBelow += 1
    } else if (retainedEntryIds.includes(e.id)) {
      retainedAbove += 1
    } else {
      releaseEntry(db, e)
    }
  }

  // Holding fee covers all retained higher-ranked lists, per child per year (§4.2.4).
  let holdingFeeCharged = false
  const retained = siblings.filter((e) => e.rank < accepted.rank && retainedEntryIds.includes(e.id))
  const existing = db.holdingFees.find(
    (h) => h.childId === accepted.childId && h.status === 'paid' && new Date(h.termEnd) > new Date(nowIso)
  )
  if (retained.length > 0) {
    if (existing) {
      existing.retainedEntryIds = retained.map((e) => e.id)
    } else {
      db.holdingFees.push({
        id: newId('hf'),
        childId: accepted.childId,
        retainedEntryIds: retained.map((e) => e.id),
        status: 'paid',
        termStart: nowIso,
        termEnd: new Date(new Date(nowIso).getTime() + 365 * DAY_MS).toISOString(),
      })
      holdingFeeCharged = true
    }
  } else if (existing) {
    existing.retainedEntryIds = []
  }

  application.status = 'enrolled'

  const daycare = daycareById(db, accepted.daycareId)
  const child = childById(db, accepted.childId)
  audit(db, actor, 'offer.accepted', `${child.name} enrolled at ${daycare.name}`, nowIso)
  notifyParentOfChild(
    db,
    accepted.childId,
    'enrolment',
    `${child.name} is enrolled at ${daycare.name}.`,
    nowIso
  )
  return {
    enrolledDaycareId: accepted.daycareId,
    releasedBelow,
    retainedAbove,
    holdingFeeCharged,
  }
}

export function declineOffer(db: DB, offerId: string, actor: string, nowIso: string): void {
  const offer = db.offers.find((o) => o.id === offerId)
  if (!offer || offer.status !== 'open') throw new Error('offer not open')
  offer.status = 'declined'
  // A decline never affects standing elsewhere (§4.2.3).
  const daycare = daycareById(db, offer.daycareId)
  const child = childById(db, offer.childId)
  audit(db, actor, 'offer.declined', `${child.name} declined ${daycare.name}`, nowIso)
}

// Server-side expiry sweep (§7.3) — the local adapter runs it on every load.
export function expireOffers(db: DB, nowIso: string): number {
  let n = 0
  for (const o of db.offers) {
    if (o.status === 'open' && new Date(o.expiresAt) < new Date(nowIso)) {
      o.status = 'expired'
      n += 1
      audit(db, 'system', 'offer.expired', `Offer ${o.id} expired unanswered`, nowIso)
    }
  }
  return n
}

// ------------------------------------------------------------ withdrawal

// Withdraw from specific daycares, or everywhere when daycareIds is null (§4.2.6).
export function withdraw(
  db: DB,
  applicationId: string,
  daycareIds: string[] | null,
  actor: string,
  nowIso: string
): void {
  const application = db.applications.find((a) => a.id === applicationId)
  if (!application) throw new Error('missing application')
  const targets = db.entries.filter(
    (e) =>
      e.applicationId === applicationId &&
      e.status === 'active' &&
      (daycareIds === null || daycareIds.includes(e.daycareId))
  )
  for (const e of targets) releaseEntry(db, e)
  const anyActive = db.entries.some(
    (e) => e.applicationId === applicationId && e.status === 'active'
  )
  if (!anyActive && !activeEnrolment(db, application.childId)) {
    application.status = 'withdrawn'
  }
  const child = childById(db, application.childId)
  audit(
    db,
    actor,
    'application.withdrawn',
    `${child.name}: withdrew from ${daycareIds ? daycareIds.length : 'all'} waitlist(s)`,
    nowIso
  )
}

// ----------------------------------------------------------- holding fee

export function lapseHoldingFee(db: DB, recordId: string, actor: string, nowIso: string): void {
  const rec = db.holdingFees.find((h) => h.id === recordId)
  if (!rec) throw new Error('missing record')
  rec.status = 'lapsed'
  for (const id of rec.retainedEntryIds) {
    const e = db.entries.find((x) => x.id === id)
    if (e && e.status === 'active') releaseEntry(db, e)
  }
  audit(db, actor, 'holdingFee.lapsed', `Holding fee ${rec.id} lapsed; retained entries released`, nowIso)
}

// ------------------------------------------------------------ admin ops

export function markIneligible(db: DB, entryId: string, reason: string, actor: string, nowIso: string): void {
  const e = db.entries.find((x) => x.id === entryId)
  if (!e) throw new Error('missing entry')
  e.status = 'ineligible'
  e.ineligibleReason = reason
  for (const o of db.offers) {
    if (o.waitlistEntryId === e.id && o.status === 'open') o.status = 'superseded'
  }
  audit(db, actor, 'entry.ineligible', `Entry ${entryId} marked ineligible: ${reason}`, nowIso)
}

export function moveEntry(db: DB, daycareId: string, entryId: string, direction: -1 | 1, actor: string, nowIso: string): void {
  const list = orderedWaitlist(db, daycareId)
  const daycare = daycareById(db, daycareId)
  const idx = list.findIndex((e) => e.id === entryId)
  const swapWith = idx + direction
  if (idx === -1 || swapWith < 0 || swapWith >= list.length) return
  // Manual reordering only applies within a tier (§4.3).
  const tierA = tierIndexFor(daycare, childById(db, list[idx].childId))
  const tierB = tierIndexFor(daycare, childById(db, list[swapWith].childId))
  if (tierA !== tierB) return
  // Materialize manual order for the whole tier from current visual order, then swap.
  const tierEntries = list.filter((e) => tierIndexFor(daycare, childById(db, e.childId)) === tierA)
  tierEntries.forEach((e, i) => (e.manualOrder = i))
  const a = list[idx]
  const b = list[swapWith]
  const tmp = a.manualOrder
  a.manualOrder = b.manualOrder
  b.manualOrder = tmp
  audit(db, actor, 'waitlist.reordered', `Manual reorder at ${daycare.name}`, nowIso)
}

// -------------------------------------------------------- parent views

export interface GlobalView {
  totalAhead: number
  totalOpenSpots: number
  perDaycare: { daycareId: string; rank: number; position: number | null; entryId: string }[]
}

// Global transparency view (§4.2.2): children ahead across all ranked
// daycares vs. open spots across those daycares.
export function globalView(db: DB, applicationId: string, nowIso?: string): GlobalView {
  const entries = db.entries.filter(
    (e) => e.applicationId === applicationId && e.status === 'active'
  )
  let totalAhead = 0
  let totalOpenSpots = 0
  const perDaycare = entries
    .sort((a, b) => a.rank - b.rank)
    .map((e) => {
      const position = positionOf(db, e.daycareId, e.childId)
      if (position) totalAhead += position - 1
      totalOpenSpots += openSpots(db, e.daycareId, nowIso)
      return { daycareId: e.daycareId, rank: e.rank, position, entryId: e.id }
    })
  return { totalAhead, totalOpenSpots, perDaycare }
}

// ------------------------------------------------------ funder aggregates

// Small-cell suppression (§4.8): buckets under 5 report as "<5".
export function suppressSmall(n: number): string {
  return n > 0 && n < 5 ? '<5' : String(n)
}

export interface FunderAggregates {
  totalCapacity: number
  totalEnrolled: number
  waitlistByAgeGroup: Record<AgeGroup, number>
  perDaycare: { daycareId: string; capacity: number; enrolled: number; waitlist: number }[]
  indigenousShareDisclosed: string
}

export function funderAggregates(db: DB, nowIso: string): FunderAggregates {
  let totalCapacity = 0
  let totalEnrolled = 0
  const waitlistByAgeGroup: Record<AgeGroup, number> = { infant: 0, toddler: 0, preschool: 0 }
  const perDaycare = db.daycares.map((d) => {
    const capacity = d.capacity.infant + d.capacity.toddler + d.capacity.preschool
    const enrolled = enrolledCount(db, d.id, undefined, nowIso)
    const waitlist = orderedWaitlist(db, d.id).length
    totalCapacity += capacity
    totalEnrolled += enrolled
    return { daycareId: d.id, capacity, enrolled, waitlist }
  })
  const seen = new Set<string>()
  for (const e of db.entries) {
    if (e.status !== 'active' || seen.has(e.childId)) continue
    seen.add(e.childId)
    waitlistByAgeGroup[ageGroupFor(childById(db, e.childId).dob, nowIso)] += 1
  }
  const enrolledChildIds = db.enrolments.filter((e) => e.status === 'active').map((e) => e.childId)
  const indigenous = enrolledChildIds.filter((id) => childById(db, id).criteria.indigenous).length
  return {
    totalCapacity,
    totalEnrolled,
    waitlistByAgeGroup,
    perDaycare,
    indigenousShareDisclosed: suppressSmall(indigenous),
  }
}
