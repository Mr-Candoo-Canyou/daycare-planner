// Production adapter: implements Backend over supabase-js against the
// schema/RLS/RPCs in supabase/migrations (see docs/BACKEND.md for the
// mapping). Auth is Supabase Auth (password + magic link, SPEC §7.5);
// grants come from role_grants; accounts with no grants are parents.
//
// NOTE: exercised against the migrations via `npm run test:db` at the SQL
// level; end-to-end integration requires a running Supabase instance
// (docs/DEPLOYMENT.md).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  ApplicationInput,
  Backend,
  DaycareCard,
  DaycareWaitlist,
  FamilyChild,
  FunderOverview,
  OfferView,
  PositionRow,
  SessionGrant,
  SessionInfo,
} from './types'
import type { AgeGroup, FormSchema, NotificationRecord, Settings, Tier } from '../domain/types'

const GRANT_KEY = 'idn-active-grant'

function ageGroupFor(dobIso: string): AgeGroup {
  const dob = new Date(dobIso)
  const now = new Date()
  const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth())
  if (months < 18) return 'infant'
  if (months < 36) return 'toddler'
  return 'preschool'
}

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey)

  const listeners = new Set<() => void>()
  const bump = () => listeners.forEach((cb) => cb())

  sb.auth.onAuthStateChange(() => bump())

  // Realtime invalidation (§4.2.2 live positions): RLS scopes what each
  // client actually receives; events are used purely as refresh triggers.
  for (const table of ['offers', 'waitlist_entries', 'notifications', 'enrolments']) {
    sb.channel(`idn-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => bump())
      .subscribe()
  }

  async function uid(): Promise<string | null> {
    const { data } = await sb.auth.getUser()
    return data.user?.id ?? null
  }

  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw new Error(error.message)
    return data as T
  }

  async function select<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data ?? []) as T
  }

  async function daycareNames(): Promise<Map<string, string>> {
    const rows = await select<{ id: string; name: string }[]>(sb.from('daycares').select('id, name'))
    return new Map(rows.map((r) => [r.id, r.name]))
  }

  return {
    mode: 'supabase',

    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },

    // ------------------------------------------------------- session
    async getSession(): Promise<SessionInfo | null> {
      const { data } = await sb.auth.getUser()
      const user = data.user
      if (!user) return null

      // Ensure the profile row exists (first sign-in).
      let profile = (
        await select<{ id: string; name: string; email: string; mobile: string | null; willing_to_start_daycare: string | null }[]>(
          sb.from('profiles').select('id, name, email, mobile, willing_to_start_daycare').eq('id', user.id)
        )
      )[0]
      if (!profile) {
        const name = (user.user_metadata?.name as string) ?? user.email ?? 'New parent'
        await sb.from('profiles').insert({ id: user.id, name, email: user.email ?? '' })
        profile = { id: user.id, name, email: user.email ?? '', mobile: null, willing_to_start_daycare: null }
      }

      const grantRows = await select<{ role: SessionGrant['role']; daycare_id: string | null }[]>(
        sb.from('role_grants').select('role, daycare_id').eq('user_id', user.id)
      )
      const names = grantRows.some((g) => g.daycare_id) ? await daycareNames() : new Map<string, string>()
      // No grants = parent: parents self-register; other roles are granted
      // by the IT Administrator (§7.5).
      const grants: SessionGrant[] =
        grantRows.length > 0
          ? grantRows.map((g) => ({
              role: g.role,
              daycareId: g.daycare_id ?? undefined,
              daycareName: g.daycare_id ? names.get(g.daycare_id) : undefined,
            }))
          : [{ role: 'parent' }]

      const stored = Number(localStorage.getItem(GRANT_KEY) ?? '0')
      return {
        userId: user.id,
        name: profile.name,
        email: profile.email,
        mobile: profile.mobile ?? undefined,
        willingFlagAt: profile.willing_to_start_daycare,
        grants,
        grantIndex: Math.min(Number.isFinite(stored) ? stored : 0, grants.length - 1),
      }
    },
    async signOut() {
      localStorage.removeItem(GRANT_KEY)
      await sb.auth.signOut()
      bump()
    },
    async setActiveGrant(index) {
      localStorage.setItem(GRANT_KEY, String(index))
      bump()
    },
    async listDemoUsers() {
      return []
    },
    async signInDemo() {
      throw new Error('demo sign-in is not available against Supabase')
    },
    async signInPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      bump()
    },
    async signUp(email, password, name) {
      const { error } = await sb.auth.signUp({ email, password, options: { data: { name } } })
      if (error) throw new Error(error.message)
      bump()
    },
    async signInMagicLink(email) {
      const { error } = await sb.auth.signInWithOtp({ email })
      if (error) throw new Error(error.message)
    },
    resetDemo() {
      /* no-op in production */
    },

    // ----------------------------------------------------- directory
    async listDaycares(): Promise<DaycareCard[]> {
      const [daycares, stats] = await Promise.all([
        select<Record<string, unknown>[]>(sb.from('daycares').select('*')),
        rpc<
          {
            daycare_id: string
            enrolled: number
            waitlist: number
            enrolled_infant: number
            enrolled_toddler: number
            enrolled_preschool: number
          }[]
        >('directory_stats'),
      ])
      const byId = new Map(stats.map((s) => [s.daycare_id, s]))
      return daycares.map((d) => {
        const s = byId.get(d.id as string)
        return {
          id: d.id as string,
          name: d.name as string,
          description: d.description as string,
          address: d.address as string,
          phone: d.phone as string,
          email: d.email as string,
          hours: d.hours as string,
          fees: d.fees as string,
          languages: (d.languages as string[]) ?? [],
          photoEmoji: d.photo_emoji as string,
          availability: d.availability as DaycareCard['availability'],
          capacity: {
            infant: d.capacity_infant as number,
            toddler: d.capacity_toddler as number,
            preschool: d.capacity_preschool as number,
          },
          enrolledByGroup: {
            infant: Number(s?.enrolled_infant ?? 0),
            toddler: Number(s?.enrolled_toddler ?? 0),
            preschool: Number(s?.enrolled_preschool ?? 0),
          },
          enrolledTotal: Number(s?.enrolled ?? 0),
          waitlistCount: Number(s?.waitlist ?? 0),
        }
      })
    },

    // -------------------------------------------------------- shared
    async getSettings(): Promise<Settings> {
      const rows = await select<
        { offer_window_days: number; holding_fee_annual: number; grace_days: number }[]
      >(sb.from('settings').select('*'))
      const s = rows[0]
      return {
        offerWindowDays: s.offer_window_days,
        holdingFeeAnnual: Number(s.holding_fee_annual),
        graceDays: s.grace_days,
      }
    },
    async getFormSchema(): Promise<FormSchema> {
      const rows = await select<{ version: number; fields: FormSchema['fields'] }[]>(
        sb.from('form_schemas').select('version, fields').order('version', { ascending: false }).limit(1)
      )
      return rows[0]
    },
    async listTemplates() {
      const rows = await select<{ id: string; name: string; description: string; tiers: Omit<Tier, 'id'>[] }[]>(
        sb.from('policy_templates').select('*')
      )
      return rows
    },

    // -------------------------------------------------------- parent
    async getFamily(): Promise<FamilyChild[]> {
      const me = await uid()
      if (!me) return []
      const [children, applications, offers, holdingFees, feeEntries, enrolments, names] =
        await Promise.all([
          select<{ id: string; name: string; dob: string; desired_start_date: string }[]>(
            sb.from('children').select('id, name, dob, desired_start_date').eq('parent_user_id', me)
          ),
          select<{ id: string; child_id: string; status: FamilyChild['applicationStatus'] }[]>(
            sb.from('applications').select('id, child_id, status')
          ),
          select<
            { id: string; child_id: string; daycare_id: string; waitlist_entry_id: string; expires_at: string; status: string }[]
          >(sb.from('offers').select('*').eq('status', 'open')),
          select<{ id: string; child_id: string; status: string; term_end: string }[]>(
            sb.from('holding_fees').select('*').eq('status', 'paid')
          ),
          select<{ holding_fee_id: string; entry_id: string }[]>(
            sb.from('holding_fee_entries').select('*')
          ),
          select<{ child_id: string; daycare_id: string; status: string }[]>(
            sb.from('enrolments').select('child_id, daycare_id, status').eq('status', 'active')
          ),
          daycareNames(),
        ])

      const out: FamilyChild[] = []
      for (const child of children) {
        const application = applications.find((a) => a.child_id === child.id) ?? null
        // Per-daycare positions come from the definer RPC (§4.2.2) — a
        // parent cannot compute them client-side under RLS.
        let positions: PositionRow[] = []
        if (application) {
          const rows = await rpc<
            { daycare_id: string; rank: number; entry_id: string; list_position: number; total_active: number; open_spots: number }[]
          >('application_positions', { p_application: application.id })
          const fee = holdingFees.find((h) => h.child_id === child.id)
          const held = new Set(
            fee ? feeEntries.filter((fe) => fe.holding_fee_id === fee.id).map((fe) => fe.entry_id) : []
          )
          positions = rows.map((r) => ({
            entryId: r.entry_id,
            daycareId: r.daycare_id,
            daycareName: names.get(r.daycare_id) ?? '',
            rank: r.rank,
            position: r.list_position,
            totalActive: Number(r.total_active),
            openSpots: Number(r.open_spots),
            heldByFee: held.has(r.entry_id),
          }))
        }

        const childOffers: OfferView[] = offers
          .filter((o) => o.child_id === child.id)
          .map((o) => {
            const mine = positions.find((p) => p.entryId === o.waitlist_entry_id)
            const rank = mine?.rank ?? 0
            return {
              id: o.id,
              daycareId: o.daycare_id,
              daycareName: names.get(o.daycare_id) ?? '',
              rank,
              expiresAt: o.expires_at,
              higherRanked: positions
                .filter((p) => p.rank < rank)
                .map((p) => ({
                  entryId: p.entryId,
                  rank: p.rank,
                  daycareName: p.daycareName,
                  position: p.position,
                })),
            }
          })
          .sort((a, b) => a.rank - b.rank)

        const enrolment = enrolments.find((e) => e.child_id === child.id) ?? null
        const fee = holdingFees.find((h) => h.child_id === child.id) ?? null
        const feeCount = fee ? feeEntries.filter((fe) => fe.holding_fee_id === fee.id).length : 0
        out.push({
          childId: child.id,
          name: child.name,
          dob: child.dob,
          desiredStartDate: child.desired_start_date,
          applicationId: application?.id ?? null,
          applicationStatus: application?.status ?? null,
          enrolledDaycareName: enrolment ? (names.get(enrolment.daycare_id) ?? '') : null,
          offers: childOffers,
          positions,
          holdingFee: fee && feeCount > 0 ? { id: fee.id, termEnd: fee.term_end, retainedCount: feeCount } : null,
        })
      }
      return out
    },

    async submitApplication(input: ApplicationInput) {
      await rpc('submit_application', {
        p_name: input.name,
        p_dob: input.dob,
        p_desired_start: input.desiredStartDate,
        p_criteria: {
          sibling: !!input.criteria.sibling,
          indigenous: !!input.criteria.indigenous,
          staffChild: !!input.criteria.staffChild,
          neighbourhood: !!input.criteria.neighbourhood,
        },
        p_form_data: input.formData,
        p_ranked_daycares: input.rankedDaycareIds,
      })
      bump()
    },
    async acceptOffer(offerId, retainedEntryIds) {
      await rpc('accept_offer', { p_offer: offerId, p_retained: retainedEntryIds })
      bump()
    },
    async declineOffer(offerId) {
      await rpc('decline_offer', { p_offer: offerId })
      bump()
    },
    async withdraw(applicationId, daycareIds) {
      await rpc('withdraw_application', { p_application: applicationId, p_daycares: daycareIds })
      bump()
    },
    async lapseHoldingFee(feeId) {
      await rpc('lapse_holding_fee', { p_fee: feeId })
      bump()
    },
    async setWillingFlag(flagged) {
      const me = await uid()
      if (!me) throw new Error('not signed in')
      const { error } = await sb
        .from('profiles')
        .update({ willing_to_start_daycare: flagged ? new Date().toISOString() : null })
        .eq('id', me)
      if (error) throw new Error(error.message)
      bump()
    },
    async listMyNotifications(): Promise<NotificationRecord[]> {
      const me = await uid()
      if (!me) return []
      const rows = await select<
        {
          id: string
          user_id: string
          event: string
          body: string
          channels: { channel: 'sms' | 'push' | 'email'; status?: string; delivered?: boolean }[] | null
          created_at: string
          read: boolean
        }[]
      >(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100))
      return rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        event: r.event,
        body: r.body,
        // The notify Edge Function writes {channel, status}; normalize to
        // the delivered boolean the UI renders.
        channels: (r.channels ?? []).map((c) => ({
          channel: c.channel,
          delivered: c.delivered ?? c.status === 'sent',
        })),
        at: r.created_at,
        read: r.read,
      }))
    },
    async markNotificationsRead() {
      const me = await uid()
      if (!me) return
      await sb.from('notifications').update({ read: true }).eq('user_id', me).eq('read', false)
      bump()
    },
    async unreadCount() {
      const me = await uid()
      if (!me) return 0
      const { count } = await sb
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', me)
        .eq('read', false)
      return count ?? 0
    },

    // ------------------------------------------------------- daycare
    async getDaycareWaitlist(daycareId): Promise<DaycareWaitlist> {
      const [rows, notes, daycare, enrolledCount, openOfferCount] = await Promise.all([
        rpc<
          { entry_id: string; child_name: string; age_group: AgeGroup; tier_label: string; date_added: string; flagged: boolean; has_open_offer: boolean; list_position: number }[]
        >('daycare_waitlist', { p_daycare: daycareId }),
        rpc<{ entry_id: string; body: string }[]>('daycare_entry_notes', { p_daycare: daycareId }),
        select<{ capacity_infant: number; capacity_toddler: number; capacity_preschool: number }[]>(
          sb.from('daycares').select('capacity_infant, capacity_toddler, capacity_preschool').eq('id', daycareId)
        ),
        sb.from('enrolments').select('id', { count: 'exact', head: true }).eq('daycare_id', daycareId).eq('status', 'active'),
        sb.from('offers').select('id', { count: 'exact', head: true }).eq('daycare_id', daycareId).eq('status', 'open'),
      ])
      const capacity = daycare[0]
        ? daycare[0].capacity_infant + daycare[0].capacity_toddler + daycare[0].capacity_preschool
        : 0
      const openOffers = openOfferCount.count ?? 0
      return {
        rows: rows.map((r) => ({
          entryId: r.entry_id,
          childName: r.child_name,
          ageGroup: r.age_group,
          tierLabel: r.tier_label ?? '',
          dateAdded: r.date_added,
          flagged: r.flagged,
          hasOpenOffer: r.has_open_offer,
          notes: notes.filter((n) => n.entry_id === r.entry_id).map((n) => n.body),
        })),
        openSpots: Math.max(0, capacity - (enrolledCount.count ?? 0) - openOffers),
        openOffers,
      }
    },
    async makeOffer(entryId) {
      await rpc('make_offer', { p_entry: entryId })
      bump()
    },
    async markIneligible(entryId, reason) {
      await rpc('mark_ineligible', { p_entry: entryId, p_reason: reason })
      bump()
    },
    async moveEntry(_daycareId, entryId, direction) {
      await rpc('move_entry', { p_entry: entryId, p_direction: direction })
      bump()
    },
    async setEntryFlag(entryId, flagged) {
      await rpc('set_entry_flag', { p_entry: entryId, p_flagged: flagged })
      bump()
    },
    async addEntryNote(entryId, body) {
      await rpc('add_entry_note', { p_entry: entryId, p_body: body })
      bump()
    },
    async getTiers(daycareId): Promise<Tier[]> {
      const rows = await select<{ id: string; kind: Tier['kind']; label: string; description: string }[]>(
        sb.from('daycare_tiers').select('*').eq('daycare_id', daycareId).order('sort_order')
      )
      return rows.map((r) => ({ id: r.id, kind: r.kind, label: r.label, description: r.description }))
    },
    async saveTiers(daycareId, tiers) {
      await rpc('set_daycare_tiers', { p_daycare: daycareId, p_tiers: tiers })
      bump()
    },

    // -------------------------------------------------------- funder
    async funderOverview(): Promise<FunderOverview> {
      const o = await rpc<{
        totalCapacity: number
        totalEnrolled: number
        perDaycare: { daycareId: string; name: string; capacity: number; enrolled: number; waitlist: string }[]
        waitlistByAgeGroup: Partial<Record<AgeGroup, string>> | null
        indigenousEnrolledDisclosed: string
      }>('funder_overview')
      return {
        totalCapacity: Number(o.totalCapacity),
        totalEnrolled: Number(o.totalEnrolled),
        perDaycare: o.perDaycare ?? [],
        waitlistByAgeGroup: {
          infant: o.waitlistByAgeGroup?.infant ?? '0',
          toddler: o.waitlistByAgeGroup?.toddler ?? '0',
          preschool: o.waitlistByAgeGroup?.preschool ?? '0',
        },
        indigenousEnrolledDisclosed: o.indigenousEnrolledDisclosed,
      }
    },
    async listFlaggedParents() {
      const rows = await select<{ name: string; email: string; mobile: string | null; willing_to_start_daycare: string }[]>(
        sb.from('profiles').select('name, email, mobile, willing_to_start_daycare').not('willing_to_start_daycare', 'is', null)
      )
      return rows.map((r) => ({
        name: r.name,
        email: r.email,
        mobile: r.mobile ?? undefined,
        flaggedAt: r.willing_to_start_daycare,
      }))
    },
    async sendBroadcast(body) {
      const n = await rpc<number>('send_broadcast', { p_body: body })
      bump()
      return n
    },
    async listBroadcasts() {
      const rows = await select<{ body: string; created_at: string }[]>(
        sb.from('broadcast_messages').select('body, created_at').order('created_at', { ascending: false })
      )
      return rows.map((r) => ({ body: r.body, at: r.created_at }))
    },

    // ------------------------------------------------------ IT admin
    async updateSettings(patch) {
      const { error } = await sb
        .from('settings')
        .update({
          ...(patch.offerWindowDays !== undefined && { offer_window_days: patch.offerWindowDays }),
          ...(patch.holdingFeeAnnual !== undefined && { holding_fee_annual: patch.holdingFeeAnnual }),
          ...(patch.graceDays !== undefined && { grace_days: patch.graceDays }),
        })
        .eq('id', true)
      if (error) throw new Error(error.message)
      bump()
    },
    async saveFormSchema(fields) {
      const current = await this.getFormSchema()
      const { error } = await sb.from('form_schemas').insert({ version: current.version + 1, fields })
      if (error) throw new Error(error.message)
      bump()
    },
    async listUsers() {
      const [profiles, grants, names] = await Promise.all([
        select<{ id: string; name: string; email: string; mobile: string | null }[]>(
          sb.from('profiles').select('id, name, email, mobile')
        ),
        select<{ user_id: string; role: SessionGrant['role']; daycare_id: string | null }[]>(
          sb.from('role_grants').select('user_id, role, daycare_id')
        ),
        daycareNames(),
      ])
      return profiles.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        mobile: p.mobile ?? undefined,
        grants: grants
          .filter((g) => g.user_id === p.id)
          .map((g) => ({
            role: g.role,
            daycareId: g.daycare_id ?? undefined,
            daycareName: g.daycare_id ? names.get(g.daycare_id) : undefined,
          })),
      }))
    },
    async auditLog() {
      const [rows, users] = await Promise.all([
        select<{ id: number; actor: string | null; action: string; detail: string; created_at: string }[]>(
          sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200)
        ),
        this.listUsers(),
      ])
      const byId = new Map(users.map((u) => [u.id, u.name]))
      return rows.map((r) => ({
        id: String(r.id),
        actor: r.actor ?? 'system',
        action: r.action,
        detail: r.detail,
        at: r.created_at,
        actorName: (r.actor && byId.get(r.actor)) || r.actor || 'system',
      }))
    },
  }
}

export { ageGroupFor as supabaseAgeGroupFor }
