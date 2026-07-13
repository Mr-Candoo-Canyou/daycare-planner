// Migration + RLS + business-logic tests against a real PostgreSQL
// (PGlite, WASM Postgres 18). Stubs Supabase's auth.uid() with a session
// GUC, applies every migration verbatim, then exercises the RPCs and RLS
// policies as different users. Run: npm run test:db (from repo root).
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = (await import('node:module')).createRequire(import.meta.url)
let PGlite
try {
  ;({ PGlite } = await import('@electric-sql/pglite'))
} catch {
  console.error('Install the test dependency first: npm i -D @electric-sql/pglite')
  process.exit(2)
}

const here = dirname(fileURLToPath(import.meta.url))
const pg = new PGlite()

// --- Supabase environment stub -------------------------------------------
await pg.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  -- Mirrors Supabase: uid comes from the JWT; here from a session GUC.
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  -- Supabase grants these to its API roles; mirror that.
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`)

// --- apply migrations -----------------------------------------------------
const dir = join(here, '..', 'migrations')
for (const f of readdirSync(dir).sort()) {
  await pg.exec(readFileSync(join(dir, f), 'utf8'))
  console.log(`applied ${f}`)
}

// --- helpers ---------------------------------------------------------------
let passed = 0
let failed = 0
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`PASS ${name}`)
  } catch (e) {
    failed++
    console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`)
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
async function as(uid, sql, params) {
  // Run one statement as an authenticated user; always restore superuser.
  await pg.exec(`set role authenticated; select set_config('test.uid', '${uid ?? ''}', false);`)
  try {
    return await pg.query(sql, params)
  } finally {
    await pg.exec(`reset role; select set_config('test.uid', '', false);`)
  }
}
async function expectError(promise, pattern) {
  try {
    await promise
  } catch (e) {
    assert(new RegExp(pattern, 'i').test(e.message), `wrong error: ${e.message.split('\n')[0]}`)
    return
  }
  throw new Error(`expected error matching /${pattern}/`)
}

// --- fixtures ---------------------------------------------------------------
const U = {
  leah: '00000000-0000-4000-8000-000000000001', // parent
  marc: '00000000-0000-4000-8000-000000000002', // parent
  rhoda: '00000000-0000-4000-8000-000000000003', // daycare admin @ aakuluk
  josh: '00000000-0000-4000-8000-000000000004', // staff @ aakuluk
  meeka: '00000000-0000-4000-8000-000000000005', // funder
  will: '00000000-0000-4000-8000-000000000006', // it admin
}
await pg.exec(`
  insert into public.profiles (id, name, email, mobile) values
    ('${U.leah}', 'Leah Qanatsiaq', 'leah@example.com', '+18672220001'),
    ('${U.marc}', 'Marc Tremblay', 'marc@example.com', null),
    ('${U.rhoda}', 'Rhoda Nauyuq', 'rhoda@aakuluk.example', null),
    ('${U.josh}', 'Josh Peters', 'josh@aakuluk.example', null),
    ('${U.meeka}', 'Meeka Arnaquq', 'meeka@gov.example', null),
    ('${U.will}', 'Will Thomas', 'will@example.com', null);

  insert into public.daycares (id, name, capacity_infant, capacity_toddler, capacity_preschool, availability) values
    ('10000000-0000-4000-8000-000000000001', 'Aakuluk Daycare', 6, 10, 14, 'waitlist_only'),
    ('10000000-0000-4000-8000-000000000002', 'Tundra Buds', 4, 8, 12, 'open'),
    ('10000000-0000-4000-8000-000000000003', 'Nanuq Playhouse', 2, 6, 8, 'closed');

  insert into public.daycare_tiers (daycare_id, kind, label, sort_order) values
    ('10000000-0000-4000-8000-000000000001', 'sibling', 'Siblings', 0),
    ('10000000-0000-4000-8000-000000000001', 'indigenous', 'Inuit community members', 1),
    ('10000000-0000-4000-8000-000000000001', 'general', 'General', 2),
    ('10000000-0000-4000-8000-000000000002', 'general', 'General', 0);

  insert into public.role_grants (user_id, role, daycare_id) values
    ('${U.leah}', 'parent', null),
    ('${U.marc}', 'parent', null),
    ('${U.rhoda}', 'daycare_admin', '10000000-0000-4000-8000-000000000001'),
    ('${U.josh}', 'staff', '10000000-0000-4000-8000-000000000001'),
    ('${U.meeka}', 'funder', null),
    ('${U.will}', 'it_admin', null);
`)
const AAKULUK = '10000000-0000-4000-8000-000000000001'
const TUNDRA = '10000000-0000-4000-8000-000000000002'
const NANUQ = '10000000-0000-4000-8000-000000000003'

// --- tests -------------------------------------------------------------------

let leahApp, marcApp

await test('parent submits ranked application via RPC', async () => {
  const r = await as(U.leah, `select public.submit_application(
    'Maata Qanatsiaq', '2025-05-01', '2026-09-01',
    '{"indigenous": true}', '{}', array['${AAKULUK}','${TUNDRA}']::uuid[]) as id`)
  leahApp = r.rows[0].id
  const entries = await as(U.leah, 'select count(*)::int n from waitlist_entries')
  assert(entries.rows[0].n === 2, 'expected 2 entries visible to parent')
})

await test('closed daycares reject applications', () =>
  expectError(
    as(U.marc, `select public.submit_application('Sophie', '2024-01-01', '2026-09-01',
      '{}', '{}', array['${NANUQ}']::uuid[])`),
    'closed'
  ))

await test('second parent applies; sees only own children (RLS)', async () => {
  const r = await as(U.marc, `select public.submit_application(
    'Sophie Tremblay', '2024-01-01', '2026-09-01',
    '{}', '{}', array['${AAKULUK}']::uuid[]) as id`)
  marcApp = r.rows[0].id
  const kids = await as(U.marc, 'select name from children')
  assert(kids.rows.length === 1 && kids.rows[0].name === 'Sophie Tremblay', 'marc must see only Sophie')
  const otherEntries = await as(U.marc, 'select count(*)::int n from waitlist_entries')
  assert(otherEntries.rows[0].n === 1, 'marc must not see leah entries')
})

await test('priority tiers order the waitlist (indigenous above general)', async () => {
  const r = await as(U.rhoda, `select child_name, tier_label, list_position from public.daycare_waitlist('${AAKULUK}')`)
  assert(r.rows.length === 2, 'two on list')
  assert(r.rows[0].child_name === 'Maata Qanatsiaq', 'Maata (indigenous tier) first despite later fixture order')
  assert(r.rows[0].tier_label === 'Inuit community members', 'tier label exposed')
  assert(!('rank' in r.rows[0]), 'rank must not be exposed to daycares')
})

await test('staff can read the waitlist view but cannot make offers', async () => {
  const r = await as(U.josh, `select count(*)::int n from public.daycare_waitlist('${AAKULUK}')`)
  assert(r.rows[0].n === 2, 'staff sees the list')
  const entry = await as(U.leah, `select id from waitlist_entries where daycare_id='${AAKULUK}'`)
  await expectError(as(U.josh, `select public.make_offer('${entry.rows[0].id}')`), 'admin')
})

await test('staff of another daycare cannot read this waitlist', () =>
  expectError(as(U.marc, `select * from public.daycare_waitlist('${AAKULUK}')`), 'not your daycare'))

let offerId
await test('admin makes an offer; expiry is server-computed', async () => {
  const entry = await as(U.leah, `select id from waitlist_entries where daycare_id='${TUNDRA}'`)
  const r = await as(U.rhoda, `select id from waitlist_entries`).catch(() => null)
  assert(r === null || r.rows.length === 0, 'daycare roles must not read waitlist_entries directly')
  // Tundra has no admin in fixtures; make Rhoda's offer at Aakuluk instead.
  const aEntry = await as(U.leah, `select id from waitlist_entries where daycare_id='${AAKULUK}' and application_id='${leahApp}'`)
  const off = await as(U.rhoda, `select public.make_offer('${aEntry.rows[0].id}') as id`)
  offerId = off.rows[0].id
  const check = await as(U.leah, `select status, expires_at > now() + interval '6 days' as ok from offers where id='${offerId}'`)
  assert(check.rows[0].status === 'open' && check.rows[0].ok, '7-day window from settings')
})

await test('offer notification queued for the parent', async () => {
  const n = await as(U.leah, `select count(*)::int n from notifications where event='offer'`)
  assert(n.rows[0].n === 1, 'parent has an offer notification')
})

await test('another parent cannot accept the offer', () =>
  expectError(as(U.marc, `select public.accept_offer('${offerId}')`), 'not your offer'))

await test('accepting rank-1 enrolls, releases other lists, no holding fee', async () => {
  await as(U.leah, `select public.accept_offer('${offerId}')`)
  const enr = await as(U.leah, `select count(*)::int n from enrolments where status='active'`)
  assert(enr.rows[0].n === 1, 'enrolled')
  const active = await as(U.leah, `select count(*)::int n from waitlist_entries where status='active'`)
  assert(active.rows[0].n === 0, 'tundra entry (rank 2) released')
  const fees = await as(U.leah, `select count(*)::int n from holding_fees`)
  assert(fees.rows[0].n === 0, 'no holding fee for a 1st-choice acceptance')
  const app = await as(U.leah, `select status from applications where id='${leahApp}'`)
  assert(app.rows[0].status === 'enrolled', 'application enrolled')
})

let offer2, marcChildEntry
await test('rank-2 acceptance keeps retained higher list with a holding fee', async () => {
  // Marc applies again for a second child ranked [Aakuluk, Tundra]; offer from Tundra (rank 2).
  const r = await as(U.marc, `select public.submit_application(
    'Theo Tremblay', '2025-08-01', '2026-09-01', '{}', '{}',
    array['${AAKULUK}','${TUNDRA}']::uuid[]) as id`)
  const app2 = r.rows[0].id
  const tEntry = await as(U.marc, `select id from waitlist_entries where application_id='${app2}' and daycare_id='${TUNDRA}'`)
  const aEntry = await as(U.marc, `select id from waitlist_entries where application_id='${app2}' and daycare_id='${AAKULUK}'`)
  marcChildEntry = aEntry.rows[0].id
  // No Tundra admin exists in fixtures; grant one to Will temporarily via superuser insert.
  await pg.exec(`insert into public.role_grants (user_id, role, daycare_id) values ('${U.will}', 'daycare_admin', '${TUNDRA}')`)
  const off = await as(U.will, `select public.make_offer('${tEntry.rows[0].id}') as id`)
  offer2 = off.rows[0].id
  await as(U.marc, `select public.accept_offer('${offer2}', array['${marcChildEntry}']::uuid[])`)
  const kept = await as(U.marc, `select status from waitlist_entries where id='${marcChildEntry}'`)
  assert(kept.rows[0].status === 'active', 'higher-ranked entry retained')
  const fee = await as(U.marc, `select count(*)::int n from holding_fees where status='paid'`)
  assert(fee.rows[0].n === 1, 'holding fee created')
})

await test('lapsing the holding fee releases retained entries', async () => {
  const fee = await as(U.marc, `select id from holding_fees where status='paid'`)
  await as(U.marc, `select public.lapse_holding_fee('${fee.rows[0].id}')`)
  const kept = await as(U.marc, `select status from waitlist_entries where id='${marcChildEntry}'`)
  assert(kept.rows[0].status === 'released', 'retained entry released on lapse')
})

await test('withdrawal releases entries and closes the application', async () => {
  await as(U.marc, `select public.withdraw_application('${marcApp}')`)
  const app = await as(U.marc, `select status from applications where id='${marcApp}'`)
  assert(app.rows[0].status === 'withdrawn', 'withdrawn')
})

await test('expire_offers is not callable by end users', () =>
  expectError(as(U.marc, 'select public.expire_offers()'), 'permission denied'))

await test('expire_offers sweeps overdue offers (as service role)', async () => {
  await pg.exec(`update public.offers set status='open', expires_at = now() - interval '1 hour' where id = '${offer2}'`)
  await pg.exec('set role service_role')
  const r = await pg.query('select public.expire_offers() as n')
  await pg.exec('reset role')
  assert(r.rows[0].n === 1, 'one offer expired')
})

await test('funder sees aggregates with small-cell suppression, not children', async () => {
  const r = await as(U.meeka, 'select public.funder_overview() as o')
  const o = r.rows[0].o
  assert(o.totalCapacity === 70, `capacity 70, got ${o.totalCapacity}`)
  assert(o.indigenousEnrolledDisclosed === '<5', 'small cell suppressed')
  const kids = await as(U.meeka, 'select count(*)::int n from children')
  assert(kids.rows[0].n === 0, 'funder must see zero child rows')
})

await test('funder sees flagged parents only after consent flag is set', async () => {
  const before = await as(U.meeka, `select count(*)::int n from profiles where id='${U.leah}'`)
  assert(before.rows[0].n === 0, 'unflagged parent invisible to funder')
  await as(U.leah, `update profiles set willing_to_start_daycare = now() where id = '${U.leah}'`)
  const after = await as(U.meeka, `select name, email from profiles where willing_to_start_daycare is not null`)
  assert(after.rows.length === 1 && after.rows[0].name === 'Leah Qanatsiaq', 'flagged parent visible with contact info')
})

await test('funder broadcast reaches flagged parents', async () => {
  const r = await as(U.meeka, `select public.send_broadcast('Planning meeting July 30.') as n`)
  assert(r.rows[0].n === 1, 'one recipient')
  const note = await as(U.leah, `select count(*)::int n from notifications where event='broadcast'`)
  assert(note.rows[0].n === 1, 'flagged parent notified')
})

await test('parents cannot read the audit log; IT admin can', async () => {
  const p = await as(U.leah, 'select count(*)::int n from audit_log')
  assert(p.rows[0].n === 0, 'parent sees nothing')
  const it = await as(U.will, 'select count(*)::int n from audit_log')
  assert(it.rows[0].n > 5, 'IT admin sees the log')
})

await test('audit log is append-only even for IT admin', () =>
  expectError(as(U.will, 'delete from audit_log'), 'permission denied'))

await test('mark_ineligible requires a reason and admin grant', async () => {
  const r = await as(U.marc, `select public.submit_application(
    'Nina Tremblay', '2024-03-01', '2026-09-01', '{}', '{}', array['${AAKULUK}']::uuid[]) as id`)
  const entry = await as(U.marc, `select id from waitlist_entries where application_id='${r.rows[0].id}'`)
  await expectError(as(U.rhoda, `select public.mark_ineligible('${entry.rows[0].id}', '')`), 'reason')
  await expectError(as(U.marc, `select public.mark_ineligible('${entry.rows[0].id}', 'x')`), 'admin')
  await as(U.rhoda, `select public.mark_ineligible('${entry.rows[0].id}', 'Outside licensed age range')`)
  const st = await as(U.marc, `select status from waitlist_entries where id='${entry.rows[0].id}'`)
  assert(st.rows[0].status === 'ineligible', 'marked')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
