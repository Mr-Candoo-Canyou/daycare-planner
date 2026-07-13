-- Row-level security (SPEC.md §3, §5, §7.5): every table locked down;
-- each role sees only what its grant allows. Writes that involve business
-- rules go through the SECURITY DEFINER functions in 00002 — there are
-- deliberately NO direct insert/update policies for waitlist entries,
-- offers, enrolments, or holding fees.

alter table public.profiles enable row level security;
alter table public.role_grants enable row level security;
alter table public.daycares enable row level security;
alter table public.daycare_tiers enable row level security;
alter table public.children enable row level security;
alter table public.applications enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.entry_notes enable row level security;
alter table public.offers enable row level security;
alter table public.enrolments enable row level security;
alter table public.holding_fees enable row level security;
alter table public.holding_fee_entries enable row level security;
alter table public.form_schemas enable row level security;
alter table public.policy_templates enable row level security;
alter table public.settings enable row level security;
alter table public.notifications enable row level security;
alter table public.broadcast_messages enable row level security;
alter table public.broadcast_recipients enable row level security;
alter table public.audit_log enable row level security;

-- ------------------------------------------------------------- profiles

-- Own profile; IT admin manages accounts (§4.9); funders see ONLY parents
-- who self-flagged — that flag is the consent (§4.8.1).
create policy profiles_select on public.profiles for select using (
  id = app.uid()
  or app.is_it_admin()
  or (app.is_funder() and willing_to_start_daycare is not null)
);
create policy profiles_update_own on public.profiles for update
  using (id = app.uid()) with check (id = app.uid());
create policy profiles_update_it on public.profiles for update
  using (app.is_it_admin()) with check (app.is_it_admin());
create policy profiles_insert_own on public.profiles for insert
  with check (id = app.uid());

-- ---------------------------------------------------------- role grants

create policy role_grants_select on public.role_grants for select using (
  user_id = app.uid() or app.is_it_admin()
);
-- Only the IT Administrator grants/revokes roles (§4.9, §7.5).
create policy role_grants_write on public.role_grants for all
  using (app.is_it_admin()) with check (app.is_it_admin());

-- ----------------------------------------------- daycares & tiers (§4.1)

-- Public directory: no login required.
create policy daycares_select_public on public.daycares for select using (true);
create policy daycares_write_it on public.daycares for all
  using (app.is_it_admin()) with check (app.is_it_admin());

create policy tiers_select on public.daycare_tiers for select using (true);
-- Daycare admins own their priority rules (§4.3); IT admin can assist.
create policy tiers_write on public.daycare_tiers for all
  using (app.has_grant('daycare_admin', daycare_id) or app.is_it_admin())
  with check (app.has_grant('daycare_admin', daycare_id) or app.is_it_admin());

-- ------------------------------------------------------------- children

-- Parents own their children's records. Daycare staff see only children
-- who applied to or enrolled at their centre. Funders NEVER see child
-- rows; IT admins have no child-level access either (§3).
create policy children_select on public.children for select using (
  parent_user_id = app.uid() or app.daycare_knows_child(id)
);
create policy children_update_parent on public.children for update
  using (parent_user_id = app.uid()) with check (parent_user_id = app.uid());

-- --------------------------------------------------------- applications

-- Rankings are parent-only data (§5): no daycare policy exists here.
create policy applications_select_parent on public.applications for select using (
  app.is_parent_of(child_id)
);

-- ----------------------------------------------------- waitlist entries

-- Parents see their own entries (position comes from application_positions()).
-- Daycare staff DO NOT read this table — daycare_waitlist() exposes an
-- ordered view without the rank column.
create policy entries_select_parent on public.waitlist_entries for select using (
  app.is_parent_of(child_id)
);

-- ---------------------------------------------------------- entry notes

-- Internal to the daycare that wrote them; parents don't see staff notes.
create policy notes_select on public.entry_notes for select using (
  exists (
    select 1 from public.waitlist_entries e
    where e.id = entry_id and app.works_at(e.daycare_id)
  )
);
create policy notes_insert on public.entry_notes for insert with check (
  author_id = app.uid() and exists (
    select 1 from public.waitlist_entries e
    where e.id = entry_id and app.works_at(e.daycare_id)
  )
);

-- --------------------------------------------------------------- offers

create policy offers_select_parent on public.offers for select using (
  app.is_parent_of(child_id)
);
-- Staff see their daycare's offers (no rank data lives here).
create policy offers_select_daycare on public.offers for select using (
  app.works_at(daycare_id)
);

-- ------------------------------------------------------------ enrolments

create policy enrolments_select on public.enrolments for select using (
  app.is_parent_of(child_id) or app.works_at(daycare_id)
);

-- ---------------------------------------------------------- holding fees

create policy holding_fees_select on public.holding_fees for select using (
  app.is_parent_of(child_id)
);
create policy holding_fee_entries_select on public.holding_fee_entries for select using (
  exists (
    select 1 from public.holding_fees h
    where h.id = holding_fee_id and app.is_parent_of(h.child_id)
  )
);

-- ------------------------------------------- form schema, templates, settings

create policy form_schemas_select on public.form_schemas for select using (true);
create policy form_schemas_insert_it on public.form_schemas for insert
  with check (app.is_it_admin()); -- new versions only; old versions immutable

create policy templates_select on public.policy_templates for select using (true);
create policy templates_write_it on public.policy_templates for all
  using (app.is_it_admin()) with check (app.is_it_admin());

create policy settings_select on public.settings for select using (true);
create policy settings_update_it on public.settings for update
  using (app.is_it_admin()) with check (app.is_it_admin());

-- -------------------------------------------------------- notifications

create policy notifications_select_own on public.notifications for select using (
  user_id = app.uid()
);
-- Owners may only flip the read flag; content is server-written.
create policy notifications_update_own on public.notifications for update
  using (user_id = app.uid()) with check (user_id = app.uid());

-- ----------------------------------------------------------- broadcasts

create policy broadcasts_select on public.broadcast_messages for select using (
  funder_user_id = app.uid() or app.is_it_admin()
);
create policy broadcast_recipients_select on public.broadcast_recipients for select using (
  exists (
    select 1 from public.broadcast_messages b
    where b.id = broadcast_id and (b.funder_user_id = app.uid() or app.is_it_admin())
  )
);

-- ------------------------------------------------------------ audit log

-- Append-only, IT Administrator eyes only (§4.9); rows are written by
-- SECURITY DEFINER functions. No update/delete policy exists — ever.
create policy audit_select_it on public.audit_log for select using (app.is_it_admin());

-- --------------------------------------------------------------- grants

grant usage on schema app to anon, authenticated, service_role;
grant execute on all functions in schema app to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant insert (id, name, email, mobile) on public.profiles to authenticated;
grant update (name, mobile, willing_to_start_daycare, notify_sms, notify_push, notify_email)
  on public.profiles to authenticated;
grant update (read) on public.notifications to authenticated;
grant insert on public.entry_notes to authenticated;
grant insert, update, delete on public.daycare_tiers to authenticated;
grant insert on public.form_schemas to authenticated;
grant insert, update, delete on public.policy_templates to authenticated;
grant update (offer_window_days, holding_fee_annual, grace_days) on public.settings to authenticated;
grant update on public.children to authenticated;
grant insert, update, delete on public.role_grants to authenticated;
grant insert, update, delete on public.daycares to authenticated;
