-- Iqaluit Daycare Network — database schema (SPEC.md §6, §7.3).
-- Targets self-hosted Supabase (PostgreSQL + auth schema present).

create schema if not exists app;

-- ---------------------------------------------------------------- enums

create type app.role as enum ('parent', 'staff', 'daycare_admin', 'funder', 'it_admin');
create type app.age_group as enum ('infant', 'toddler', 'preschool');
create type app.availability as enum ('open', 'waitlist_only', 'closed');
create type app.tier_kind as enum ('sibling', 'indigenous', 'staff_child', 'neighbourhood', 'general');
create type app.application_status as enum ('pending', 'enrolled', 'withdrawn');
create type app.entry_status as enum ('active', 'released', 'ineligible');
create type app.offer_status as enum ('open', 'accepted', 'declined', 'expired', 'superseded');
create type app.enrolment_status as enum ('active', 'ended');
create type app.holding_fee_status as enum ('paid', 'due', 'lapsed');

-- --------------------------------------------------------------- tables

-- One row per auth user; mirrors auth.users via trigger in production.
create table public.profiles (
  id uuid primary key,
  name text not null,
  email text not null,
  mobile text,
  -- §4.8.1: set = explicit consent for funders to see name + contact info.
  willing_to_start_daycare timestamptz,
  notify_sms boolean not null default true,
  notify_push boolean not null default true,
  notify_email boolean not null default true,
  created_at timestamptz not null default now()
);

-- §7.5: an account holds one or more role grants; daycare roles are scoped.
create table public.role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role app.role not null,
  daycare_id uuid, -- fk added after daycares exists
  created_at timestamptz not null default now(),
  constraint daycare_scope check (
    (role in ('staff', 'daycare_admin')) = (daycare_id is not null)
  ),
  unique (user_id, role, daycare_id)
);

create table public.daycares (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  hours text not null default '',
  fees text not null default '',
  subsidy_accepted boolean not null default true,
  languages text[] not null default '{English}',
  photo_emoji text not null default '🏠',
  capacity_infant int not null default 0 check (capacity_infant >= 0),
  capacity_toddler int not null default 0 check (capacity_toddler >= 0),
  capacity_preschool int not null default 0 check (capacity_preschool >= 0),
  availability app.availability not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.role_grants
  add constraint role_grants_daycare_fk
  foreign key (daycare_id) references public.daycares(id) on delete cascade;

-- Ordered priority tiers per daycare (§4.3); lowest sort_order = highest priority.
create table public.daycare_tiers (
  id uuid primary key default gen_random_uuid(),
  daycare_id uuid not null references public.daycares(id) on delete cascade,
  kind app.tier_kind not null,
  label text not null,
  description text not null default '',
  sort_order int not null,
  unique (daycare_id, sort_order) deferrable initially deferred
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  dob date not null,
  desired_start_date date not null,
  criteria_sibling boolean not null default false,
  criteria_indigenous boolean not null default false,
  criteria_staff_child boolean not null default false,
  criteria_neighbourhood boolean not null default false,
  form_data jsonb not null default '{}',
  form_schema_version int not null default 1,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  status app.application_status not null default 'pending'
);

-- The parent's rank of this daycare lives here but is NEVER exposed to
-- daycare staff (§5 data minimization) — they read via app.daycare_waitlist().
create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  daycare_id uuid not null references public.daycares(id) on delete cascade,
  rank int not null check (rank >= 1),
  date_added timestamptz not null default now(),
  status app.entry_status not null default 'active',
  manual_order int,
  flagged boolean not null default false,
  ineligible_reason text,
  unique (application_id, daycare_id)
);

create index on public.waitlist_entries (daycare_id) where status = 'active';
create index on public.waitlist_entries (application_id);

create table public.entry_notes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.waitlist_entries(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  waitlist_entry_id uuid not null references public.waitlist_entries(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  daycare_id uuid not null references public.daycares(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- §4.2.3: computed server-side at creation; clients never set it.
  expires_at timestamptz not null,
  status app.offer_status not null default 'open'
);

-- At most one open offer per waitlist entry.
create unique index offers_one_open_per_entry
  on public.offers (waitlist_entry_id) where status = 'open';

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  daycare_id uuid not null references public.daycares(id) on delete cascade,
  start_date timestamptz not null default now(),
  status app.enrolment_status not null default 'active'
);

-- At most one active enrolment per child (seamless transition, §4.2.4).
create unique index enrolments_one_active_per_child
  on public.enrolments (child_id) where status = 'active';

create table public.holding_fees (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  status app.holding_fee_status not null default 'paid',
  term_start timestamptz not null default now(),
  term_end timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.holding_fee_entries (
  holding_fee_id uuid not null references public.holding_fees(id) on delete cascade,
  entry_id uuid not null references public.waitlist_entries(id) on delete cascade,
  primary key (holding_fee_id, entry_id)
);

-- Versioned application form (§4.2.1); the highest version is current.
create table public.form_schemas (
  version int primary key,
  fields jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.policy_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  tiers jsonb not null -- [{kind, label, description}]
);

-- Singleton settings row (§4.9).
create table public.settings (
  id boolean primary key default true check (id),
  offer_window_days int not null default 7 check (offer_window_days >= 1),
  holding_fee_annual numeric not null default 150 check (holding_fee_annual >= 0),
  grace_days int not null default 7 check (grace_days >= 0)
);
insert into public.settings (id) values (true);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null,
  body text not null,
  -- [{channel, status}] — updated by the dispatch Edge Function.
  channels jsonb not null default '[]',
  dispatched boolean not null default false,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.notifications (user_id, created_at desc);
create index on public.notifications (dispatched) where not dispatched;

create table public.broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  funder_user_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.broadcast_recipients (
  broadcast_id uuid not null references public.broadcast_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  primary key (broadcast_id, user_id)
);

-- Append-only (§7.8): no update/delete is ever granted or policy-allowed.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index on public.audit_log (created_at desc);
