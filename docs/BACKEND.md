# Backend mapping — local adapter ↔ Supabase

**Status: both adapters are implemented.** Every page consumes the `Backend`
interface (`src/backend/types.ts`); `src/backend/index.ts` selects the
implementation at build time:

- No env vars → `src/backend/local.ts` (in-browser demo over the domain
  engine; Vite dead-code-eliminates supabase-js from this build).
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set → `src/backend/supabase.ts`
  (supabase-js over the RLS schema and RPCs below, Supabase Auth with
  password + magic-link sign-in, realtime invalidation on offers/entries/
  notifications per §4.2.2).

The frontend's domain layer (`src/domain/waitlist.ts` + `src/domain/store.ts`)
and the database layer (`supabase/migrations/`) implement the **same rules
twice, deliberately**: the TypeScript engine gives the demo and unit tests an
in-browser backend; the SQL functions are the production authority. Both are
tested (`npm test` — 20 engine tests; `npm run test:db` — 26 database tests
covering the same scenarios plus RLS). The Supabase adapter itself is
type-checked against the RPC signatures and column names but has not been
integration-tested against a live instance — do that on the staging deploy
(docs/DEPLOYMENT.md) before inviting users.

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
| flag/unflag an entry | `public.set_entry_flag(entry, bool)` | staff/admin of the daycare |
| add/read staff notes | `public.add_entry_note`, `public.daycare_entry_notes` | staff/admin of the daycare |
| tier editor (whole-list save) | `public.set_daycare_tiers(daycare, tiers)` | daycare admin; atomic replace |
| public directory counts | `public.directory_stats()` | anon-callable definer; counts only |

Plain-table reads (directory, own children, own offers, notifications,
settings) go through the Supabase client directly — RLS in
`00003_rls.sql` scopes every row.

## Building for each mode

```bash
npm run build                                    # demo build (local adapter)
VITE_SUPABASE_URL=https://idn.example.ca \
VITE_SUPABASE_ANON_KEY=<anon key> npm run build  # production build
```

Accounts with no role grants are parents (parents self-register; every other
role is granted by an IT Administrator via `role_grants`). The active role
context for multi-grant accounts is client-side state; data access is
enforced per-grant by RLS regardless of the selected context.

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
