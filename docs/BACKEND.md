# Backend mapping — local adapter → Supabase

The frontend's domain layer (`src/domain/waitlist.ts` + `src/domain/store.ts`)
and the database layer (`supabase/migrations/`) implement the **same rules
twice, deliberately**: the TypeScript engine gives the demo and unit tests an
in-browser backend; the SQL functions are the production authority. Both are
tested (`npm test` — 20 engine tests; `npm run test:db` — 21 database tests
covering the same scenarios plus RLS).

## Function mapping

| Frontend (src/domain) | Database (RPC / view) | Access enforced |
|---|---|---|
| `submit_application` (ApplyPage inline) | `public.submit_application(name, dob, start, criteria, form_data, ranked[])` | signed-in parent |
| `globalView` / `positionOf` | `public.application_positions(application_id)` | parent of the application |
| `orderedWaitlist` + tier labels | `public.daycare_waitlist(daycare_id)` | staff/admin of that daycare; **rank never exposed** |
| `makeOffer` | `public.make_offer(entry_id)` | daycare admin of the entry's daycare |
| `acceptOffer` | `public.accept_offer(offer_id, retained[])` | parent of the child |
| `declineOffer` | `public.decline_offer(offer_id)` | parent of the child |
| `withdraw` | `public.withdraw_application(application_id, daycares[]?)` | parent |
| `lapseHoldingFee` | `public.lapse_holding_fee(fee_id)` | parent (or system) |
| `markIneligible` | `public.mark_ineligible(entry_id, reason)` | daycare admin; reason required |
| `moveEntry` | `public.move_entry(entry_id, direction)` | daycare admin; within-tier only |
| `expireOffers` (on load) | `public.expire_offers()` | **service role only** (pg_cron) |
| `funderAggregates` | `public.funder_overview()` | funder/IT; small cells pre-suppressed |
| broadcast (FunderPage inline) | `public.send_broadcast(body)` | funder; recipients snapshotted |
| `notify` (simulated channels) | `notify` Edge Function drains `public.notifications` | service role |

Plain-table reads (directory, own children, own offers, notifications,
settings) go through the Supabase client directly — RLS in
`00003_rls.sql` scopes every row.

## Swapping the adapter

1. `npm i @supabase/supabase-js` and create the client from
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. Replace `useDB()`-based reads with queries/RPCs above; subscribe to
   `waitlist_entries` / `offers` via Supabase Realtime for the live position
   updates (SPEC §4.2.2).
3. Replace demo `login()` with `supabase.auth.signInWithPassword` /
   `signInWithOtp` (magic link, §7.5); role grants come from `role_grants`
   instead of the seeded user record — the `Session { user, grant }` shape in
   `src/auth.ts` stays identical.
4. Delete `src/domain/seed.ts` from the production bundle; the engine in
   `waitlist.ts` remains as the offline/optimistic layer if desired, but the
   database functions are authoritative.

## Design invariants (must survive any refactor)

- Daycare roles never read `waitlist_entries` directly; `daycare_waitlist()`
  is their only surface, and it omits the parent's rank (SPEC §5).
- Releases are indistinguishable: acceptance elsewhere, withdrawal, and
  holding-fee lapse all just advance the list (§4.2.3/§8).
- Offer expiry timestamps are written at creation, server-side (§4.2.3);
  the sweep runs under the service role.
- `audit_log` is append-only — there is no UPDATE/DELETE grant or policy.
- Funders see child data never, flagged-parent contact info only while the
  parent's consent flag is set (§4.8.1), aggregates only with `<5`
  suppression (§4.8).
