# Deployment — self-hosted Supabase on Hetzner (SPEC §7)

This guide takes the platform from this repository to a production instance:
one Hetzner Cloud VM running self-hosted Supabase (PostgreSQL, Auth, PostgREST,
Realtime, Storage, Edge Functions) plus the static PWA behind Caddy with TLS.

> **Data residency (SPEC §7.4):** Hetzner hosts in Germany/Finland/US. This is
> an accepted v1 risk. If Canadian residency becomes a funder requirement,
> repeat these steps on OVH Canada or Vultr Montreal — nothing in the
> application changes, only this infrastructure layer.

## 1. Server

- Hetzner Cloud **CX32** (4 vCPU / 8 GB) is ample for community scale; start
  smaller (CX22) if budget-bound.
- Ubuntu 24.04 LTS. Create a non-root user, disable password SSH, enable
  unattended-upgrades, and open only 22/80/443 in the Hetzner firewall.

## 2. Self-hosted Supabase

Follow the official self-hosting guide (https://supabase.com/docs/guides/self-hosting/docker):

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

Edit `.env` — at minimum:

- `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` — generate
  fresh values per the guide; never keep the examples.
- `SITE_URL` / `API_EXTERNAL_URL` — your public domain.
- `SMTP_*` — required for Supabase Auth emails (magic links, §7.5).
- Disable public signups for non-parent roles: roles are granted only via
  `role_grants` by an IT Administrator, so leave signups open (parents
  self-register) and rely on RLS — a fresh account has no grants and can
  only see the public directory and its own profile.

Then `docker compose up -d`.

## 3. Apply this repository's migrations

```bash
# from the repo root, with the Supabase CLI pointed at the instance:
supabase db push --db-url "postgresql://postgres:<password>@<host>:5432/postgres"
# or apply supabase/migrations/*.sql in order with psql.
```

The migrations are self-contained and idempotence-safe to apply once in
order: schema → functions → RLS → baseline data → push tokens. They are
tested end-to-end by `npm run test:db` (runs against an in-process
PostgreSQL 18 with RLS enforced — no Docker needed).

**Bootstrap accounts (§7.5):** after the first two people sign up, insert
their IT Administrator grants once, directly in SQL:

```sql
insert into public.role_grants (user_id, role)
select id, 'it_admin' from public.profiles where email in ('admin1@…', 'admin2@…');
```

Two IT admin accounts minimum — single point of failure is a spec violation.

## 4. Edge Functions & schedules

```bash
supabase functions deploy notify
supabase functions deploy expire-offers
```

Secrets (`supabase secrets set`): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER`, `FCM_PROJECT_ID`, `FCM_ACCESS_TOKEN`, `RESEND_API_KEY`,
`EMAIL_FROM`. Unset credentials degrade gracefully: that channel records
`skipped` and the next channel is attempted (§4.2.3).

Schedule with pg_cron (bundled in Supabase Postgres):

```sql
select cron.schedule('expire-offers', '0 * * * *',   -- hourly
  $$select net.http_post('https://<host>/functions/v1/expire-offers',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb)$$);
select cron.schedule('notify', '* * * * *',          -- every minute
  $$select net.http_post('https://<host>/functions/v1/notify',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb)$$);
```

## 5. The PWA

```bash
npm run build        # emits dist/
```

Serve `dist/` with Caddy (automatic TLS):

```
idn.example.ca {
  root * /srv/idn/dist
  file_server
  try_files {path} /index.html   # SPA routing
}
```

Point the frontend at the instance via build-time env
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) once the Supabase adapter
replaces the local demo adapter — see docs/BACKEND.md for the mapping.

## 6. Backups & retention (SPEC §7.8)

- Nightly `pg_dump` to Hetzner Storage Box or S3-compatible bucket,
  encrypted (age/gpg), **30-day retention**; quarterly restore drill.
- `audit_log` is append-only and retained ≥ 7 years — exclude it from any
  data-pruning jobs.
- Uptime target 99.5%/month: a single region is acceptable; monitor with an
  external ping (UptimeRobot or similar) on `/` and the Supabase health
  endpoint.

## 7. Pre-launch checklist

- [ ] Privacy review completed (SPEC §7.4 — gates launch, not development).
- [ ] Two IT Administrator accounts exist and can both reach the admin panel.
- [ ] Twilio sender verified for Canadian carriers; test SMS to an Iqaluit number.
- [ ] Offer-expiry cron observed to run (check `audit_log` for `offer.expired`).
- [ ] Restore drill performed from a real nightly backup.
- [ ] `expire_offers()` denied for a signed-in non-admin (run `npm run test:db`).
