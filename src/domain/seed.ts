// Demo seed data for the local adapter. The Supabase adapter replaces this
// with real rows; shapes are identical (SPEC.md §7.2).

import type { AgeGroup, Child, DB, Daycare, Enrolment, PolicyTemplate, User } from './types'
import { newId } from './waitlist'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n: number, now: number): string {
  return new Date(now - n * DAY_MS).toISOString()
}
function monthsAgoDate(n: number, now: number): string {
  const d = new Date(now)
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

export const TEMPLATES: PolicyTemplate[] = [
  {
    id: 'tpl_sibling',
    name: 'Siblings First',
    description: 'Siblings of currently enrolled children are prioritized.',
    tiers: [{ kind: 'sibling', label: 'Siblings of enrolled children' }],
  },
  {
    id: 'tpl_indigenous',
    name: 'Indigenous Community Priority',
    description: 'Members of a named Indigenous group are prioritized.',
    tiers: [{ kind: 'indigenous', label: 'Indigenous community members' }],
  },
  {
    id: 'tpl_staff',
    name: 'Staff Children',
    description: 'Children of daycare employees receive priority.',
    tiers: [{ kind: 'staff_child', label: 'Children of staff' }],
  },
  {
    id: 'tpl_neighbourhood',
    name: 'Neighbourhood Residents',
    description: 'Families within a defined area are prioritized.',
    tiers: [{ kind: 'neighbourhood', label: 'Neighbourhood residents' }],
  },
  {
    id: 'tpl_fifo',
    name: 'General FIFO',
    description: 'First-come, first-served with no special tiers.',
    tiers: [{ kind: 'general', label: 'General waitlist' }],
  },
]

const FILLER_FIRST = ['Aju', 'Malaya', 'Qavvik', 'Panika', 'Tulugaq', 'Alasie', 'Kumaglak', 'Ippiksaut', 'Saila', 'Naja', 'Terry', 'Emma', 'Noah', 'Ava', 'Liam', 'Nadia', 'Peter', 'Ruth', 'Sam', 'Tia']
const FILLER_LAST = ['Kripanik', 'Onalik', 'Tikivik', 'Padluq', 'Metcalfe', 'Gagnon', 'Ashoona', 'Etuangat', 'Michael', 'Nowdluk']

export function buildSeed(now = Date.now()): DB {
  const daycares: Daycare[] = [
    {
      id: 'dc_aakuluk',
      name: 'Aakuluk Daycare',
      description:
        'A licensed centre in the heart of Iqaluit offering full-day programming rooted in Inuit Qaujimajatuqangit principles, with daily Inuktitut circle time and land-based learning in season.',
      address: '1085 Mivvik St, Iqaluit',
      phone: '(867) 979-0101',
      email: 'hello@aakuluk.example',
      hours: 'Mon–Fri 7:30–17:30',
      fees: '$62/day; FNICCI and territorial subsidies accepted',
      subsidyAccepted: true,
      languages: ['English', 'Inuktitut'],
      photoEmoji: '🌱',
      capacity: { infant: 6, toddler: 10, preschool: 14 },
      availability: 'waitlist_only',
      tiers: [
        { id: 't_aa_sib', kind: 'sibling', label: 'Siblings of enrolled children' },
        { id: 't_aa_ind', kind: 'indigenous', label: 'Inuit community members' },
        { id: 't_aa_gen', kind: 'general', label: 'General waitlist' },
      ],
    },
    {
      id: 'dc_tundra',
      name: 'Tundra Buds Early Learning',
      description:
        'Play-based early learning centre near the Road to Nowhere neighbourhood with a strong outdoor program year-round and a dedicated infant room.',
      address: '2214 Paurngaq Cres, Iqaluit',
      phone: '(867) 979-0202',
      email: 'office@tundrabuds.example',
      hours: 'Mon–Fri 8:00–17:00',
      fees: '$58/day; territorial subsidy accepted',
      subsidyAccepted: true,
      languages: ['English'],
      photoEmoji: '❄️',
      capacity: { infant: 4, toddler: 8, preschool: 12 },
      availability: 'open',
      tiers: [
        { id: 't_tb_staff', kind: 'staff_child', label: 'Children of staff' },
        { id: 't_tb_sib', kind: 'sibling', label: 'Siblings of enrolled children' },
        { id: 't_tb_gen', kind: 'general', label: 'General waitlist' },
      ],
    },
    {
      id: 'dc_sikusiilaq',
      name: 'Sikusiilaq Childcare Centre',
      description:
        'Community-run centre in Apex focused on bilingual English–Inuktitut programming, elder visits, and traditional food Fridays.',
      address: '12 Nuvuk Pl, Apex, Iqaluit',
      phone: '(867) 979-0303',
      email: 'info@sikusiilaq.example',
      hours: 'Mon–Fri 7:45–17:15',
      fees: '$60/day; FNICCI and territorial subsidies accepted',
      subsidyAccepted: true,
      languages: ['English', 'Inuktitut'],
      photoEmoji: '🧊',
      capacity: { infant: 4, toddler: 8, preschool: 10 },
      availability: 'waitlist_only',
      tiers: [
        { id: 't_sk_ind', kind: 'indigenous', label: 'Inuit community members' },
        { id: 't_sk_nbh', kind: 'neighbourhood', label: 'Apex residents' },
        { id: 't_sk_gen', kind: 'general', label: 'General waitlist' },
      ],
    },
    {
      id: 'dc_nanuq',
      name: 'Nanuq Playhouse',
      description:
        'Small home-style daycare with mixed-age programming and a focus on music and storytelling. Currently closed to new applications.',
      address: '317 Sinaa St, Iqaluit',
      phone: '(867) 979-0404',
      email: 'nanuq@playhouse.example',
      hours: 'Mon–Fri 8:30–16:30',
      fees: '$55/day; subsidies not accepted',
      subsidyAccepted: false,
      languages: ['English'],
      photoEmoji: '🐻‍❄️',
      capacity: { infant: 2, toddler: 6, preschool: 8 },
      availability: 'closed',
      tiers: [{ id: 't_nq_gen', kind: 'general', label: 'General waitlist' }],
    },
  ]

  const users: User[] = [
    {
      id: 'u_leah',
      name: 'Leah Qanatsiaq',
      email: 'leah@example.com',
      mobile: '+1 867 222 0001',
      grants: [{ role: 'parent' }],
      notificationPrefs: { sms: true, push: true, email: true },
    },
    {
      id: 'u_marc',
      name: 'Marc Tremblay',
      email: 'marc@example.com',
      grants: [{ role: 'parent' }],
      notificationPrefs: { sms: false, push: true, email: true },
    },
    {
      id: 'u_siula',
      name: 'Siula Ipeelie',
      email: 'siula@example.com',
      mobile: '+1 867 222 0003',
      // Dual role grant (SPEC.md §7.5): staff at Aakuluk AND applicant parent.
      grants: [{ role: 'parent' }, { role: 'staff', daycareId: 'dc_aakuluk' }],
      willingToStartDaycare: daysAgo(40, now),
      notificationPrefs: { sms: true, push: true, email: true },
    },
    {
      id: 'u_pitsi',
      name: 'Pitseolak Alainga',
      email: 'pitseolak@example.com',
      mobile: '+1 867 222 0004',
      grants: [{ role: 'parent' }],
      willingToStartDaycare: daysAgo(12, now),
      notificationPrefs: { sms: true, push: false, email: true },
    },
    {
      id: 'u_dora',
      name: 'Dora Angutialuk',
      email: 'dora@example.com',
      grants: [{ role: 'parent' }],
      notificationPrefs: { sms: false, push: false, email: true },
    },
    {
      id: 'u_ben',
      name: 'Ben Kilabuk',
      email: 'ben@example.com',
      mobile: '+1 867 222 0006',
      grants: [{ role: 'parent' }],
      notificationPrefs: { sms: true, push: true, email: true },
    },
    {
      id: 'u_admin_aakuluk',
      name: 'Rhoda Nauyuq',
      email: 'rhoda@aakuluk.example',
      grants: [{ role: 'daycare_admin', daycareId: 'dc_aakuluk' }],
      notificationPrefs: { sms: false, push: true, email: true },
    },
    {
      id: 'u_admin_tundra',
      name: 'Claire Fortin',
      email: 'claire@tundrabuds.example',
      grants: [{ role: 'daycare_admin', daycareId: 'dc_tundra' }],
      notificationPrefs: { sms: false, push: true, email: true },
    },
    {
      id: 'u_staff_tundra',
      name: 'Josh Peters',
      email: 'josh@tundrabuds.example',
      grants: [{ role: 'staff', daycareId: 'dc_tundra' }],
      notificationPrefs: { sms: false, push: true, email: true },
    },
    {
      id: 'u_funder',
      name: 'Meeka Arnaquq (GN Education)',
      email: 'meeka@gov.example',
      grants: [{ role: 'funder' }],
      notificationPrefs: { sms: false, push: false, email: true },
    },
    {
      id: 'u_it1',
      name: 'Will Thomas',
      email: 'will@projectnunavut.example',
      grants: [{ role: 'it_admin' }],
      notificationPrefs: { sms: false, push: true, email: true },
    },
    {
      id: 'u_it2',
      name: 'Amber Kootoo',
      email: 'amber@projectnunavut.example',
      grants: [{ role: 'it_admin' }],
      notificationPrefs: { sms: false, push: true, email: true },
    },
  ]

  const children: Child[] = [
    {
      id: 'c_maata',
      parentUserId: 'u_leah',
      name: 'Maata Qanatsiaq',
      dob: monthsAgoDate(14, now),
      desiredStartDate: monthsAgoDate(-2, now),
      criteria: { indigenous: true },
      formData: {},
      formSchemaVersion: 1,
    },
    {
      id: 'c_joanasie',
      parentUserId: 'u_leah',
      name: 'Joanasie Qanatsiaq',
      dob: monthsAgoDate(50, now),
      desiredStartDate: monthsAgoDate(-1, now),
      criteria: { indigenous: true },
      formData: {},
      formSchemaVersion: 1,
    },
    {
      id: 'c_sophie',
      parentUserId: 'u_marc',
      name: 'Sophie Tremblay',
      dob: monthsAgoDate(30, now),
      desiredStartDate: monthsAgoDate(-3, now),
      criteria: {},
      formData: {},
      formSchemaVersion: 1,
    },
    {
      id: 'c_aput',
      parentUserId: 'u_siula',
      name: 'Aput Ipeelie',
      dob: monthsAgoDate(20, now),
      desiredStartDate: monthsAgoDate(-1, now),
      criteria: { indigenous: true, staffChild: true },
      formData: {},
      formSchemaVersion: 1,
    },
    {
      id: 'c_nuka',
      parentUserId: 'u_pitsi',
      name: 'Nuka Alainga',
      dob: monthsAgoDate(26, now),
      desiredStartDate: monthsAgoDate(-2, now),
      criteria: { indigenous: true, neighbourhood: true },
      formData: {},
      formSchemaVersion: 1,
    },
    {
      id: 'c_elisapee',
      parentUserId: 'u_dora',
      name: 'Elisapee Angutialuk',
      dob: monthsAgoDate(9, now),
      desiredStartDate: monthsAgoDate(-4, now),
      criteria: { indigenous: true },
      formData: {},
      formSchemaVersion: 1,
    },
    {
      id: 'c_taqqiq',
      parentUserId: 'u_ben',
      name: 'Taqqiq Kilabuk',
      dob: monthsAgoDate(46, now),
      desiredStartDate: monthsAgoDate(10, now),
      criteria: { indigenous: true },
      formData: {},
      formSchemaVersion: 1,
    },
    {
      id: 'c_sila',
      parentUserId: 'u_ben',
      name: 'Sila Kilabuk',
      dob: monthsAgoDate(11, now),
      desiredStartDate: monthsAgoDate(-3, now),
      criteria: { indigenous: true, sibling: true },
      formData: {},
      formSchemaVersion: 1,
    },
  ]

  const db: DB = {
    users,
    children,
    daycares,
    applications: [
      { id: 'app_maata', childId: 'c_maata', submittedAt: daysAgo(90, now), status: 'pending', rankedDaycareIds: ['dc_aakuluk', 'dc_sikusiilaq', 'dc_tundra'] },
      { id: 'app_joanasie', childId: 'c_joanasie', submittedAt: daysAgo(60, now), status: 'pending', rankedDaycareIds: ['dc_tundra', 'dc_aakuluk'] },
      { id: 'app_sophie', childId: 'c_sophie', submittedAt: daysAgo(120, now), status: 'pending', rankedDaycareIds: ['dc_sikusiilaq', 'dc_aakuluk'] },
      { id: 'app_aput', childId: 'c_aput', submittedAt: daysAgo(45, now), status: 'pending', rankedDaycareIds: ['dc_aakuluk', 'dc_tundra'] },
      { id: 'app_nuka', childId: 'c_nuka', submittedAt: daysAgo(30, now), status: 'pending', rankedDaycareIds: ['dc_tundra', 'dc_sikusiilaq'] },
      { id: 'app_elisapee', childId: 'c_elisapee', submittedAt: daysAgo(150, now), status: 'pending', rankedDaycareIds: ['dc_aakuluk'] },
      { id: 'app_sila', childId: 'c_sila', submittedAt: daysAgo(20, now), status: 'pending', rankedDaycareIds: ['dc_tundra'] },
    ],
    entries: [
      { id: 'we_maata_aa', applicationId: 'app_maata', childId: 'c_maata', daycareId: 'dc_aakuluk', rank: 1, dateAdded: daysAgo(90, now), status: 'active', notes: [] },
      { id: 'we_maata_sk', applicationId: 'app_maata', childId: 'c_maata', daycareId: 'dc_sikusiilaq', rank: 2, dateAdded: daysAgo(90, now), status: 'active', notes: [] },
      { id: 'we_maata_tb', applicationId: 'app_maata', childId: 'c_maata', daycareId: 'dc_tundra', rank: 3, dateAdded: daysAgo(90, now), status: 'active', notes: [] },
      { id: 'we_joanasie_tb', applicationId: 'app_joanasie', childId: 'c_joanasie', daycareId: 'dc_tundra', rank: 1, dateAdded: daysAgo(60, now), status: 'active', notes: [] },
      { id: 'we_joanasie_aa', applicationId: 'app_joanasie', childId: 'c_joanasie', daycareId: 'dc_aakuluk', rank: 2, dateAdded: daysAgo(60, now), status: 'active', notes: [] },
      { id: 'we_sophie_sk', applicationId: 'app_sophie', childId: 'c_sophie', daycareId: 'dc_sikusiilaq', rank: 1, dateAdded: daysAgo(120, now), status: 'active', notes: [] },
      { id: 'we_sophie_aa', applicationId: 'app_sophie', childId: 'c_sophie', daycareId: 'dc_aakuluk', rank: 2, dateAdded: daysAgo(120, now), status: 'active', notes: [] },
      { id: 'we_aput_aa', applicationId: 'app_aput', childId: 'c_aput', daycareId: 'dc_aakuluk', rank: 1, dateAdded: daysAgo(45, now), status: 'active', notes: [] },
      { id: 'we_aput_tb', applicationId: 'app_aput', childId: 'c_aput', daycareId: 'dc_tundra', rank: 2, dateAdded: daysAgo(45, now), status: 'active', notes: [] },
      { id: 'we_nuka_tb', applicationId: 'app_nuka', childId: 'c_nuka', daycareId: 'dc_tundra', rank: 1, dateAdded: daysAgo(30, now), status: 'active', notes: [] },
      { id: 'we_nuka_sk', applicationId: 'app_nuka', childId: 'c_nuka', daycareId: 'dc_sikusiilaq', rank: 2, dateAdded: daysAgo(30, now), status: 'active', notes: [] },
      { id: 'we_elisapee_aa', applicationId: 'app_elisapee', childId: 'c_elisapee', daycareId: 'dc_aakuluk', rank: 1, dateAdded: daysAgo(150, now), status: 'active', notes: [] },
      { id: 'we_sila_tb', applicationId: 'app_sila', childId: 'c_sila', daycareId: 'dc_tundra', rank: 1, dateAdded: daysAgo(20, now), status: 'active', notes: [] },
    ],
    offers: [
      // Open offer from Maata's 2nd choice — exercises the holding-fee
      // decision on accept (§4.2.4).
      {
        id: 'off_maata_sk',
        waitlistEntryId: 'we_maata_sk',
        childId: 'c_maata',
        daycareId: 'dc_sikusiilaq',
        createdAt: daysAgo(2, now),
        expiresAt: new Date(now + 5 * DAY_MS).toISOString(),
        status: 'open',
      },
    ],
    enrolments: [
      { id: 'enr_taqqiq', childId: 'c_taqqiq', daycareId: 'dc_tundra', startDate: daysAgo(300, now), status: 'active' },
    ],
    holdingFees: [],
    formSchema: {
      version: 1,
      fields: [
        { id: 'name', label: "Child's full name", type: 'text', required: true, system: true },
        { id: 'dob', label: 'Date of birth', type: 'date', required: true, system: true },
        { id: 'desiredStartDate', label: 'Desired start date', type: 'date', required: true, system: true },
        { id: 'indigenous', label: 'Member of an Indigenous community (self-declared)', type: 'checkbox', required: false, system: true },
        { id: 'sibling', label: 'Sibling currently enrolled at a daycare you are applying to', type: 'checkbox', required: false, system: true },
        { id: 'staffChild', label: 'Parent works at a daycare you are applying to', type: 'checkbox', required: false, system: true },
        { id: 'neighbourhood', label: 'Resident of the daycare’s neighbourhood (e.g. Apex)', type: 'checkbox', required: false, system: true },
        { id: 'notes', label: 'Anything else the daycares should know? (optional)', type: 'text', required: false },
      ],
    },
    templates: TEMPLATES,
    settings: { offerWindowDays: 7, holdingFeeAnnual: 150, graceDays: 7 },
    notifications: [
      {
        id: 'ntf_seed_offer',
        userId: 'u_leah',
        event: 'offer',
        body: `Sikusiilaq Childcare Centre has offered Maata a spot. Respond by ${new Date(now + 5 * DAY_MS).toLocaleDateString('en-CA')}.`,
        channels: [
          { channel: 'sms', delivered: true },
          { channel: 'push', delivered: true },
          { channel: 'email', delivered: true },
        ],
        at: daysAgo(2, now),
        read: false,
      },
    ],
    broadcasts: [],
    audit: [
      { id: 'aud_seed_1', actor: 'u_admin_sikusiilaq', action: 'offer.created', detail: 'Offer to Maata Qanatsiaq at Sikusiilaq Childcare Centre', at: daysAgo(2, now) },
      { id: 'aud_seed_0', actor: 'system', action: 'platform.seeded', detail: 'Demo data initialised', at: daysAgo(2, now) },
    ],
    session: { userId: null, grantIndex: 0 },
  }

  // Filler enrolled children so capacity/enrolment numbers are realistic.
  // Aakuluk 27/30, Tundra +20 (21/24 with Taqqiq), Sikusiilaq 21/22, Nanuq 16/16.
  const fillPlan: { daycareId: string; perGroup: Record<AgeGroup, number> }[] = [
    { daycareId: 'dc_aakuluk', perGroup: { infant: 5, toddler: 9, preschool: 13 } },
    { daycareId: 'dc_tundra', perGroup: { infant: 3, toddler: 7, preschool: 10 } },
    { daycareId: 'dc_sikusiilaq', perGroup: { infant: 4, toddler: 7, preschool: 10 } },
    { daycareId: 'dc_nanuq', perGroup: { infant: 2, toddler: 6, preschool: 8 } },
  ]
  const groupDobMonths: Record<AgeGroup, number> = { infant: 10, toddler: 26, preschool: 44 }
  let f = 0
  for (const plan of fillPlan) {
    for (const group of ['infant', 'toddler', 'preschool'] as AgeGroup[]) {
      for (let i = 0; i < plan.perGroup[group]; i++) {
        const name = `${FILLER_FIRST[f % FILLER_FIRST.length]} ${FILLER_LAST[f % FILLER_LAST.length]}`
        const child: Child = {
          id: newId('c_fill'),
          parentUserId: 'offline_record',
          name,
          dob: monthsAgoDate(groupDobMonths[group] + (f % 5), now),
          desiredStartDate: monthsAgoDate(8, now),
          criteria: { indigenous: f % 3 !== 0 },
          formData: {},
          formSchemaVersion: 1,
        }
        const enr: Enrolment = {
          id: newId('enr_fill'),
          childId: child.id,
          daycareId: plan.daycareId,
          startDate: daysAgo(200 + f, now),
          status: 'active',
        }
        db.children.push(child)
        db.enrolments.push(enr)
        f += 1
      }
    }
  }

  return db
}
