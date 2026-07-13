import { describe, it, expect, beforeEach } from 'vitest'
import { buildSeed } from './seed'
import type { DB } from './types'
import {
  acceptOffer,
  ageGroupFor,
  declineOffer,
  expireOffers,
  globalView,
  lapseHoldingFee,
  makeOffer,
  markIneligible,
  moveEntry,
  nextEligible,
  orderedWaitlist,
  positionOf,
  suppressSmall,
  withdraw,
} from './waitlist'

const NOW = new Date('2026-07-13T12:00:00Z').getTime()
const nowIso = new Date(NOW).toISOString()

let db: DB
beforeEach(() => {
  db = buildSeed(NOW)
})

describe('age groups (§4.2.7)', () => {
  it('derives age group from DOB, not a stored value', () => {
    expect(ageGroupFor('2026-01-13', nowIso)).toBe('infant')
    expect(ageGroupFor('2024-06-13', nowIso)).toBe('toddler')
    expect(ageGroupFor('2022-01-13', nowIso)).toBe('preschool')
  })
})

describe('priority tiers (§4.3)', () => {
  it('orders by tier first, then date added', () => {
    // Aakuluk tiers: sibling → indigenous → general. All seeded applicants
    // are indigenous except Sophie (general), so Sophie sorts last even
    // though her application is oldest at Aakuluk.
    const list = orderedWaitlist(db, 'dc_aakuluk')
    const ids = list.map((e) => e.childId)
    expect(ids[ids.length - 1]).toBe('c_sophie')
    // Within the indigenous tier: Elisapee (150d) < Maata (90d) < Aput (45d) < Joanasie (60d)?
    // No — by dateAdded ascending: Elisapee 150, Maata 90, Joanasie 60, Aput 45.
    expect(ids.slice(0, 4)).toEqual(['c_elisapee', 'c_maata', 'c_joanasie', 'c_aput'])
  })

  it('sibling tier outranks general at Tundra Buds', () => {
    // Tundra tiers: staff_child → sibling → general. Sila (sibling, newest
    // application) must sit above non-sibling children with older entries.
    const ids = orderedWaitlist(db, 'dc_tundra').map((e) => e.childId)
    expect(ids.indexOf('c_sila')).toBeLessThan(ids.indexOf('c_joanasie'))
    expect(ids.indexOf('c_sila')).toBeLessThan(ids.indexOf('c_nuka'))
  })

  it('manual reordering stays within a tier and is audited', () => {
    const before = orderedWaitlist(db, 'dc_aakuluk').map((e) => e.childId)
    const maataEntry = db.entries.find((e) => e.id === 'we_maata_aa')!
    moveEntry(db, 'dc_aakuluk', maataEntry.id, -1, 'u_admin_aakuluk', nowIso)
    const after = orderedWaitlist(db, 'dc_aakuluk').map((e) => e.childId)
    expect(after.indexOf('c_maata')).toBe(before.indexOf('c_maata') - 1)
    expect(db.audit[0].action).toBe('waitlist.reordered')
    // Sophie (general tier, last) cannot be moved up across the tier boundary.
    const sophieEntry = db.entries.find((e) => e.id === 'we_sophie_aa')!
    const beforeSophie = orderedWaitlist(db, 'dc_aakuluk').map((e) => e.childId)
    moveEntry(db, 'dc_aakuluk', sophieEntry.id, -1, 'u_admin_aakuluk', nowIso)
    expect(orderedWaitlist(db, 'dc_aakuluk').map((e) => e.childId)).toEqual(beforeSophie)
  })
})

describe('offers (§4.2.3)', () => {
  it('computes expiry server-side from the configured window', () => {
    const entry = nextEligible(db, 'dc_aakuluk')!
    const offer = makeOffer(db, entry.id, 'u_admin_aakuluk', nowIso)
    const days = (new Date(offer.expiresAt).getTime() - NOW) / 86400000
    expect(days).toBe(db.settings.offerWindowDays)
  })

  it('skips children who already hold an open offer from this daycare', () => {
    const first = nextEligible(db, 'dc_aakuluk')!
    makeOffer(db, first.id, 'u_admin_aakuluk', nowIso)
    const second = nextEligible(db, 'dc_aakuluk')!
    expect(second.childId).not.toBe(first.childId)
  })

  it('declining keeps the child on all their waitlists', () => {
    declineOffer(db, 'off_maata_sk', 'u_leah', nowIso)
    expect(positionOf(db, 'dc_sikusiilaq', 'c_maata')).not.toBeNull()
    expect(positionOf(db, 'dc_aakuluk', 'c_maata')).not.toBeNull()
    expect(positionOf(db, 'dc_tundra', 'c_maata')).not.toBeNull()
  })

  it('expiry sweep expires overdue offers only', () => {
    const later = new Date(NOW + 6 * 86400000).toISOString()
    expect(expireOffers(db, later)).toBe(1)
    expect(db.offers.find((o) => o.id === 'off_maata_sk')!.status).toBe('expired')
  })
})

describe('acceptance cascade (§4.2.3–4.2.5)', () => {
  it('accepting a rank-2 offer releases lower ranks, keeps retained higher ranks with a fee', () => {
    // Maata: aakuluk(1), sikusiilaq(2, offered), tundra(3). Retain aakuluk.
    const res = acceptOffer(db, 'off_maata_sk', ['we_maata_aa'], 'u_leah', nowIso)
    expect(res.enrolledDaycareId).toBe('dc_sikusiilaq')
    expect(res.releasedBelow).toBe(1) // tundra
    expect(res.retainedAbove).toBe(1) // aakuluk
    expect(res.holdingFeeCharged).toBe(true)
    expect(positionOf(db, 'dc_tundra', 'c_maata')).toBeNull()
    expect(positionOf(db, 'dc_aakuluk', 'c_maata')).not.toBeNull()
    expect(db.enrolments.some((e) => e.childId === 'c_maata' && e.daycareId === 'dc_sikusiilaq' && e.status === 'active')).toBe(true)
  })

  it('accepting without retaining releases every other list and charges no fee', () => {
    const res = acceptOffer(db, 'off_maata_sk', [], 'u_leah', nowIso)
    expect(res.retainedAbove).toBe(0)
    expect(res.holdingFeeCharged).toBe(false)
    expect(positionOf(db, 'dc_aakuluk', 'c_maata')).toBeNull()
    expect(db.holdingFees).toHaveLength(0)
  })

  it('accepting the 1st choice needs no holding fee and ends the application', () => {
    const entry = db.entries.find((e) => e.id === 'we_joanasie_tb')! // rank 1
    const offer = makeOffer(db, entry.id, 'u_admin_tundra', nowIso)
    const res = acceptOffer(db, offer.id, [], 'u_leah', nowIso)
    expect(res.holdingFeeCharged).toBe(false)
    expect(positionOf(db, 'dc_aakuluk', 'c_joanasie')).toBeNull()
    expect(db.applications.find((a) => a.id === 'app_joanasie')!.status).toBe('enrolled')
  })

  it('seamless transition: accepting a retained higher-ranked spot later releases the current enrolment', () => {
    acceptOffer(db, 'off_maata_sk', ['we_maata_aa'], 'u_leah', nowIso)
    const offer2 = makeOffer(db, 'we_maata_aa', 'u_admin_aakuluk', nowIso)
    acceptOffer(db, offer2.id, [], 'u_leah', nowIso)
    const active = db.enrolments.filter((e) => e.childId === 'c_maata' && e.status === 'active')
    expect(active).toHaveLength(1)
    expect(active[0].daycareId).toBe('dc_aakuluk')
    // Sikusiilaq's list advanced with no reason attached (§5).
    expect(db.enrolments.find((e) => e.childId === 'c_maata' && e.daycareId === 'dc_sikusiilaq')!.status).toBe('ended')
  })

  it('accepting supersedes open offers from lower-ranked daycares (§4.2.5)', () => {
    // Give Maata a second open offer from tundra (rank 3), then accept sikusiilaq (rank 2).
    const offer3 = makeOffer(db, 'we_maata_tb', 'u_admin_tundra', nowIso)
    acceptOffer(db, 'off_maata_sk', [], 'u_leah', nowIso)
    expect(db.offers.find((o) => o.id === offer3.id)!.status).toBe('superseded')
  })

  it('a lapsed offer cannot be accepted', () => {
    const later = new Date(NOW + 8 * 86400000).toISOString()
    expect(() => acceptOffer(db, 'off_maata_sk', [], 'u_leah', later)).toThrow(/expired/)
  })
})

describe('withdrawal (§4.2.6)', () => {
  it('withdrawing everywhere releases entries, cancels offers, and closes the application', () => {
    withdraw(db, 'app_maata', null, 'u_leah', nowIso)
    expect(db.entries.filter((e) => e.applicationId === 'app_maata' && e.status === 'active')).toHaveLength(0)
    expect(db.offers.find((o) => o.id === 'off_maata_sk')!.status).toBe('superseded')
    expect(db.applications.find((a) => a.id === 'app_maata')!.status).toBe('withdrawn')
  })

  it('withdrawing from one daycare leaves the rest standing', () => {
    withdraw(db, 'app_maata', ['dc_tundra'], 'u_leah', nowIso)
    expect(positionOf(db, 'dc_tundra', 'c_maata')).toBeNull()
    expect(positionOf(db, 'dc_aakuluk', 'c_maata')).not.toBeNull()
    expect(db.applications.find((a) => a.id === 'app_maata')!.status).toBe('pending')
  })
})

describe('holding fee lapse (§4.2.4)', () => {
  it('lapsing releases the retained entries', () => {
    acceptOffer(db, 'off_maata_sk', ['we_maata_aa'], 'u_leah', nowIso)
    const rec = db.holdingFees[0]
    lapseHoldingFee(db, rec.id, 'system', nowIso)
    expect(positionOf(db, 'dc_aakuluk', 'c_maata')).toBeNull()
    expect(rec.status).toBe('lapsed')
  })
})

describe('admin ops & views', () => {
  it('marking ineligible removes the child from the ordered list with an audited reason', () => {
    markIneligible(db, 'we_sophie_aa', 'Outside licensed age range at intake', 'u_admin_aakuluk', nowIso)
    expect(positionOf(db, 'dc_aakuluk', 'c_sophie')).toBeNull()
    expect(db.audit[0].action).toBe('entry.ineligible')
  })

  it('global view sums children ahead and open spots across ranked daycares (§4.2.2)', () => {
    const view = globalView(db, 'app_maata', nowIso)
    expect(view.perDaycare).toHaveLength(3)
    expect(view.perDaycare[0].rank).toBe(1)
    const ahead = view.perDaycare.reduce((s, p) => s + ((p.position ?? 1) - 1), 0)
    expect(view.totalAhead).toBe(ahead)
  })

  it('suppresses small cells in funder aggregates (§4.8)', () => {
    expect(suppressSmall(3)).toBe('<5')
    expect(suppressSmall(0)).toBe('0')
    expect(suppressSmall(12)).toBe('12')
  })
})
