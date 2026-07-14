// Local demo adapter: implements Backend over the in-browser store and the
// unit-tested engine in src/domain/waitlist.ts. Async in signature only —
// everything resolves synchronously from localStorage.

import type {
  Backend,
  DaycareCard,
  DaycareWaitlist,
  FamilyChild,
  OfferView,
  PositionRow,
  SessionGrant,
  SessionInfo,
  WaitlistRow,
} from './types'
import { loadDB, mutate, nowIso, resetDemo } from '../domain/store'
import type { DB, Tier, User } from '../domain/types'
import {
  acceptOffer,
  activeEnrolment,
  ageGroupFor,
  audit,
  childById,
  daycareById,
  declineOffer,
  enrolledCount,
  funderAggregates,
  lapseHoldingFee,
  makeOffer,
  markIneligible,
  moveEntry,
  newId,
  notify,
  openSpots,
  orderedWaitlist,
  positionOf,
  suppressSmall,
  tierIndexFor,
  withdraw,
} from '../domain/waitlist'

function grantView(db: DB, g: { role: User['grants'][number]['role']; daycareId?: string }): SessionGrant {
  return {
    role: g.role,
    daycareId: g.daycareId,
    daycareName: g.daycareId ? db.daycares.find((d) => d.id === g.daycareId)?.name : undefined,
  }
}

function currentUser(db: DB): User | null {
  return db.users.find((u) => u.id === db.session.userId) ?? null
}

function requireUser(db: DB): User {
  const u = currentUser(db)
  if (!u) throw new Error('not signed in')
  return u
}

const listeners = new Set<() => void>()
// store.ts emits via useSyncExternalStore subscribers; mirror mutations here.
function bump() {
  for (const cb of listeners) cb()
}
function change<T>(fn: (db: DB) => T): T {
  const r = mutate(fn)
  bump()
  return r
}

export function createLocalBackend(): Backend {
  return {
    mode: 'local',

    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },

    // ------------------------------------------------------- session
    async getSession(): Promise<SessionInfo | null> {
      const db = loadDB()
      const u = currentUser(db)
      if (!u) return null
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        willingFlagAt: u.willingToStartDaycare ?? null,
        grants: u.grants.map((g) => grantView(db, g)),
        grantIndex: Math.min(db.session.grantIndex, u.grants.length - 1),
      }
    },
    async signOut() {
      change((db) => {
        if (db.session.userId) audit(db, db.session.userId, 'auth.logout', 'Signed out', nowIso())
        db.session = { userId: null, grantIndex: 0 }
      })
    },
    async setActiveGrant(index) {
      change((db) => {
        db.session.grantIndex = index
      })
    },
    async listDemoUsers() {
      const db = loadDB()
      return db.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        grants: u.grants.map((g) => grantView(db, g)),
      }))
    },
    async signInDemo(userId) {
      change((db) => {
        db.session = { userId, grantIndex: 0 }
        audit(db, userId, 'auth.login', 'Signed in (demo)', nowIso())
      })
    },
    async signInPassword() {
      throw new Error('demo mode uses the account picker')
    },
    async signUp() {
      throw new Error('demo mode uses the account picker')
    },
    async signInMagicLink() {
      throw new Error('demo mode uses the account picker')
    },
    resetDemo() {
      resetDemo()
      bump()
    },

    // ----------------------------------------------------- directory
    async listDaycares(): Promise<DaycareCard[]> {
      const db = loadDB()
      return db.daycares.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        address: d.address,
        phone: d.phone,
        email: d.email,
        hours: d.hours,
        fees: d.fees,
        languages: d.languages,
        photoEmoji: d.photoEmoji,
        availability: d.availability,
        capacity: d.capacity,
        enrolledByGroup: {
          infant: enrolledCount(db, d.id, 'infant'),
          toddler: enrolledCount(db, d.id, 'toddler'),
          preschool: enrolledCount(db, d.id, 'preschool'),
        },
        enrolledTotal: enrolledCount(db, d.id),
        waitlistCount: orderedWaitlist(db, d.id).length,
      }))
    },

    // -------------------------------------------------------- shared
    async getSettings() {
      return loadDB().settings
    },
    async getFormSchema() {
      return loadDB().formSchema
    },
    async listTemplates() {
      return loadDB().templates
    },

    // -------------------------------------------------------- parent
    async getFamily(): Promise<FamilyChild[]> {
      const db = loadDB()
      const u = requireUser(db)
      return db.children
        .filter((c) => c.parentUserId === u.id)
        .map((child) => {
          const application = db.applications.find((a) => a.childId === child.id) ?? null
          const enrolment = activeEnrolment(db, child.id)
          const holdingFee =
            db.holdingFees.find((h) => h.childId === child.id && h.status === 'paid') ?? null

          const positions: PositionRow[] = application
            ? db.entries
                .filter((e) => e.applicationId === application.id && e.status === 'active')
                .sort((a, b) => a.rank - b.rank)
                .map((e) => ({
                  entryId: e.id,
                  daycareId: e.daycareId,
                  daycareName: daycareById(db, e.daycareId).name,
                  rank: e.rank,
                  position: positionOf(db, e.daycareId, child.id),
                  totalActive: db.entries.filter(
                    (x) => x.daycareId === e.daycareId && x.status === 'active'
                  ).length,
                  openSpots: openSpots(db, e.daycareId),
                  heldByFee: !!holdingFee?.retainedEntryIds.includes(e.id),
                }))
            : []

          const offers: OfferView[] = db.offers
            .filter((o) => o.childId === child.id && o.status === 'open')
            .map((o) => {
              const entry = db.entries.find((e) => e.id === o.waitlistEntryId)!
              const higherRanked = application
                ? db.entries
                    .filter(
                      (e) =>
                        e.applicationId === application.id &&
                        e.status === 'active' &&
                        e.rank < entry.rank
                    )
                    .map((e) => ({
                      entryId: e.id,
                      rank: e.rank,
                      daycareName: daycareById(db, e.daycareId).name,
                      position: positionOf(db, e.daycareId, child.id),
                    }))
                : []
              return {
                id: o.id,
                daycareId: o.daycareId,
                daycareName: daycareById(db, o.daycareId).name,
                rank: entry.rank,
                expiresAt: o.expiresAt,
                higherRanked,
              }
            })
            .sort((a, b) => a.rank - b.rank)

          return {
            childId: child.id,
            name: child.name,
            dob: child.dob,
            desiredStartDate: child.desiredStartDate,
            applicationId: application?.id ?? null,
            applicationStatus: application?.status ?? null,
            enrolledDaycareName: enrolment ? daycareById(db, enrolment.daycareId).name : null,
            offers,
            positions,
            holdingFee: holdingFee && holdingFee.retainedEntryIds.length > 0
              ? { id: holdingFee.id, termEnd: holdingFee.termEnd, retainedCount: holdingFee.retainedEntryIds.length }
              : null,
          }
        })
    },

    async submitApplication(input) {
      change((db) => {
        const u = requireUser(db)
        const now = nowIso()
        const child = {
          id: newId('c'),
          parentUserId: u.id,
          name: input.name,
          dob: input.dob,
          desiredStartDate: input.desiredStartDate,
          criteria: input.criteria,
          formData: input.formData,
          formSchemaVersion: db.formSchema.version,
        }
        db.children.push(child)
        const appId = newId('app')
        db.applications.push({
          id: appId,
          childId: child.id,
          submittedAt: now,
          status: 'pending',
          rankedDaycareIds: input.rankedDaycareIds,
        })
        input.rankedDaycareIds.forEach((daycareId, i) => {
          db.entries.push({
            id: newId('we'),
            applicationId: appId,
            childId: child.id,
            daycareId,
            rank: i + 1,
            dateAdded: now,
            status: 'active',
            notes: [],
          })
        })
        audit(db, u.id, 'application.submitted', `Child ${child.id}: applied to ${input.rankedDaycareIds.length} daycare(s)`, now)
        notify(
          db,
          u,
          'application',
          `Application received — you are on ${input.rankedDaycareIds.length} waitlist(s). No fee applies.`,
          now
        )
      })
    },

    async acceptOffer(offerId, retainedEntryIds) {
      change((db) => acceptOffer(db, offerId, retainedEntryIds, requireUser(db).id, nowIso()))
    },
    async declineOffer(offerId) {
      change((db) => declineOffer(db, offerId, requireUser(db).id, nowIso()))
    },
    async withdraw(applicationId, daycareIds) {
      change((db) => withdraw(db, applicationId, daycareIds, requireUser(db).id, nowIso()))
    },
    async lapseHoldingFee(feeId) {
      change((db) => lapseHoldingFee(db, feeId, requireUser(db).id, nowIso()))
    },
    async setWillingFlag(flagged) {
      change((db) => {
        const u = requireUser(db)
        u.willingToStartDaycare = flagged ? nowIso() : null
        audit(
          db,
          u.id,
          flagged ? 'outreach.flagged' : 'outreach.unflagged',
          flagged ? 'Parent flagged as willing to start a daycare' : 'Parent removed willing-to-start flag',
          nowIso()
        )
      })
    },
    async listMyNotifications() {
      const db = loadDB()
      const u = requireUser(db)
      return db.notifications.filter((n) => n.userId === u.id)
    },
    async markNotificationsRead() {
      change((db) => {
        const u = requireUser(db)
        for (const n of db.notifications) if (n.userId === u.id) n.read = true
      })
    },
    async unreadCount() {
      const db = loadDB()
      const u = currentUser(db)
      if (!u) return 0
      return db.notifications.filter((n) => n.userId === u.id && !n.read).length
    },

    // ------------------------------------------------------- daycare
    async getDaycareWaitlist(daycareId): Promise<DaycareWaitlist> {
      const db = loadDB()
      const daycare = daycareById(db, daycareId)
      const now = new Date().toISOString()
      const rows: WaitlistRow[] = orderedWaitlist(db, daycareId).map((e) => {
        const child = childById(db, e.childId)
        return {
          entryId: e.id,
          childName: child.name,
          ageGroup: ageGroupFor(child.dob, now),
          tierLabel: daycare.tiers[tierIndexFor(daycare, child)]?.label ?? '',
          dateAdded: e.dateAdded,
          flagged: !!e.flagged,
          hasOpenOffer: db.offers.some((o) => o.waitlistEntryId === e.id && o.status === 'open'),
          notes: e.notes.map((n) => n.text),
        }
      })
      return {
        rows,
        openSpots: openSpots(db, daycareId),
        openOffers: db.offers.filter((o) => o.daycareId === daycareId && o.status === 'open').length,
      }
    },
    async makeOffer(entryId) {
      change((db) => makeOffer(db, entryId, requireUser(db).id, nowIso()))
    },
    async markIneligible(entryId, reason) {
      change((db) => markIneligible(db, entryId, reason, requireUser(db).id, nowIso()))
    },
    async moveEntry(daycareId, entryId, direction) {
      change((db) => moveEntry(db, daycareId, entryId, direction, requireUser(db).id, nowIso()))
    },
    async setEntryFlag(entryId, flagged) {
      change((db) => {
        const e = db.entries.find((x) => x.id === entryId)
        if (e) e.flagged = flagged
      })
    },
    async addEntryNote(entryId, body) {
      change((db) => {
        const e = db.entries.find((x) => x.id === entryId)
        if (e) e.notes.push({ by: requireUser(db).id, text: body, at: nowIso() })
      })
    },
    async getTiers(daycareId) {
      return daycareById(loadDB(), daycareId).tiers
    },
    async saveTiers(daycareId, tiers) {
      change((db) => {
        const d = daycareById(db, daycareId)
        d.tiers = tiers.map((t) => ({ ...t, id: newId('t') })) as Tier[]
        audit(db, requireUser(db).id, 'policy.updated', `Priority tiers replaced at daycare ${daycareId} (${tiers.length} tiers)`, nowIso())
      })
    },

    // -------------------------------------------------------- funder
    async funderOverview() {
      const db = loadDB()
      const agg = funderAggregates(db, nowIso())
      return {
        totalCapacity: agg.totalCapacity,
        totalEnrolled: agg.totalEnrolled,
        perDaycare: agg.perDaycare.map((p) => ({
          daycareId: p.daycareId,
          name: daycareById(db, p.daycareId).name,
          capacity: p.capacity,
          enrolled: p.enrolled,
          waitlist: suppressSmall(p.waitlist),
        })),
        waitlistByAgeGroup: {
          infant: suppressSmall(agg.waitlistByAgeGroup.infant),
          toddler: suppressSmall(agg.waitlistByAgeGroup.toddler),
          preschool: suppressSmall(agg.waitlistByAgeGroup.preschool),
        },
        indigenousEnrolledDisclosed: agg.indigenousShareDisclosed,
      }
    },
    async listFlaggedParents() {
      const db = loadDB()
      return db.users
        .filter((u) => u.willingToStartDaycare)
        .map((u) => ({
          name: u.name,
          email: u.email,
          mobile: u.mobile,
          flaggedAt: u.willingToStartDaycare!,
        }))
    },
    async sendBroadcast(body) {
      return change((db) => {
        const u = requireUser(db)
        const recipients = db.users.filter((x) => x.willingToStartDaycare)
        db.broadcasts.unshift({
          id: newId('bc'),
          funderUserId: u.id,
          recipientUserIds: recipients.map((r) => r.id),
          body,
          at: nowIso(),
        })
        for (const r of recipients) notify(db, r, 'broadcast', body, nowIso())
        audit(db, u.id, 'broadcast.sent', `Broadcast to ${recipients.length} flagged parent(s)`, nowIso())
        return recipients.length
      })
    },
    async listBroadcasts() {
      const db = loadDB()
      const u = requireUser(db)
      return db.broadcasts.filter((b) => b.funderUserId === u.id).map((b) => ({ body: b.body, at: b.at }))
    },

    // ------------------------------------------------------ IT admin
    async updateSettings(patch) {
      change((db) => {
        Object.assign(db.settings, patch)
        audit(db, requireUser(db).id, 'settings.updated', JSON.stringify(patch), nowIso())
      })
    },
    async saveFormSchema(fields) {
      change((db) => {
        db.formSchema = { version: db.formSchema.version + 1, fields }
        audit(db, requireUser(db).id, 'form.updated', `Form schema v${db.formSchema.version}`, nowIso())
      })
    },
    async listUsers() {
      const db = loadDB()
      return db.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        grants: u.grants.map((g) => grantView(db, g)),
      }))
    },
    async auditLog() {
      const db = loadDB()
      return db.audit.slice(0, 200).map((a) => ({
        ...a,
        actorName: db.users.find((u) => u.id === a.actor)?.name ?? a.actor,
      }))
    },
  }
}
