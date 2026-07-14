-- Business logic (SPEC.md §7.3): everything RLS cannot express — the
-- ranked-choice cascade, holding fees, offers, ordering — lives in
-- SECURITY DEFINER functions so the rules are enforced server-side no
-- matter what client calls them. This mirrors src/domain/waitlist.ts,
-- which carries the same rules under unit test.

-- ------------------------------------------------------------- helpers

-- Single seam over Supabase auth; tests stub auth.uid().
create function app.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

create function app.has_grant(p_role app.role, p_daycare uuid default null)
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.role_grants g
    where g.user_id = app.uid()
      and g.role = p_role
      and (p_daycare is null or g.daycare_id = p_daycare)
  )
$$;

create function app.is_it_admin() returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.has_grant('it_admin')
$$;

create function app.is_funder() returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.has_grant('funder')
$$;

-- Staff OR admin at the given daycare.
create function app.works_at(p_daycare uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.role_grants g
    where g.user_id = app.uid()
      and g.role in ('staff', 'daycare_admin')
      and g.daycare_id = p_daycare
  )
$$;

create function app.is_parent_of(p_child uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.children c
    where c.id = p_child and c.parent_user_id = app.uid()
  )
$$;

-- True when the daycare has this child on its list or enrolled — the only
-- children daycare staff may see (§4.3, §5).
create function app.daycare_knows_child(p_child uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.waitlist_entries e
    where e.child_id = p_child and app.works_at(e.daycare_id)
  ) or exists (
    select 1 from public.enrolments en
    where en.child_id = p_child and app.works_at(en.daycare_id)
  )
$$;

-- Age group is derived, never stored (§4.2.7).
create function app.age_group(p_dob date, p_at date default current_date)
returns app.age_group language sql immutable as $$
  select case
    when (extract(year from age(p_at, p_dob)) * 12
        + extract(month from age(p_at, p_dob))) < 18 then 'infant'::app.age_group
    when (extract(year from age(p_at, p_dob)) * 12
        + extract(month from age(p_at, p_dob))) < 36 then 'toddler'::app.age_group
    else 'preschool'::app.age_group
  end
$$;

-- First matching tier in the daycare's configured order; children matching
-- no tier sort after all tiers (§4.3).
create function app.tier_index(p_daycare uuid, p_child uuid)
returns int language sql stable security definer set search_path = public, app as $$
  select coalesce(
    (
      select t.ord from (
        select dt.kind, row_number() over (order by dt.sort_order) - 1 as ord
        from public.daycare_tiers dt where dt.daycare_id = p_daycare
      ) t
      join public.children c on c.id = p_child
      where case t.kind
        when 'sibling' then c.criteria_sibling
        when 'indigenous' then c.criteria_indigenous
        when 'staff_child' then c.criteria_staff_child
        when 'neighbourhood' then c.criteria_neighbourhood
        when 'general' then true
      end
      order by t.ord
      limit 1
    ),
    (select count(*)::int from public.daycare_tiers where daycare_id = p_daycare)
  )
$$;

create function app.tier_label(p_daycare uuid, p_child uuid)
returns text language sql stable security definer set search_path = public, app as $$
  select dt.label from (
    select label, row_number() over (order by sort_order) - 1 as ord
    from public.daycare_tiers where daycare_id = p_daycare
  ) dt
  where dt.ord = app.tier_index(p_daycare, p_child)
$$;

create function app.audit(p_action text, p_detail text)
returns void language sql security definer set search_path = public, app as $$
  insert into public.audit_log (actor, action, detail)
  values (app.uid(), p_action, p_detail)
$$;

create function app.notify(p_user uuid, p_event text, p_body text)
returns void language sql security definer set search_path = public, app as $$
  -- Channels resolved and dispatched by the notify Edge Function
  -- (SMS → push → email, §4.2.3).
  insert into public.notifications (user_id, event, body)
  values (p_user, p_event, p_body)
$$;

-- Release an entry: leaves the list; any open offer on it is superseded.
-- Daycares just see their list advance — no reason attached (§5).
create function app.release_entry(p_entry uuid)
returns void language plpgsql security definer set search_path = public, app as $$
begin
  update public.waitlist_entries set status = 'released' where id = p_entry and status = 'active';
  update public.offers set status = 'superseded' where waitlist_entry_id = p_entry and status = 'open';
end $$;

-- ----------------------------------------------------- shared ordering

-- The one canonical waitlist ordering: tier, then admin manual order,
-- then date added (§4.3). Rank is deliberately absent from the output.
create function app.ordered_entries(p_daycare uuid)
returns table (entry_id uuid, child_id uuid, list_position bigint)
language sql stable security definer set search_path = public, app as $$
  select e.id, e.child_id,
    row_number() over (
      order by app.tier_index(e.daycare_id, e.child_id),
        e.manual_order nulls last,
        e.date_added
    )
  from public.waitlist_entries e
  where e.daycare_id = p_daycare and e.status = 'active'
$$;

-- ------------------------------------------------------- parent-facing

create function public.submit_application(
  p_name text, p_dob date, p_desired_start date,
  p_criteria jsonb, p_form_data jsonb, p_ranked_daycares uuid[]
) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_child uuid; v_app uuid; v_daycare uuid; v_rank int := 0; v_version int;
begin
  if app.uid() is null then raise exception 'not signed in'; end if;
  if array_length(p_ranked_daycares, 1) is null then
    raise exception 'rank at least one daycare';
  end if;
  if exists (
    select 1 from public.daycares d
    where d.id = any(p_ranked_daycares) and d.availability = 'closed'
  ) then
    raise exception 'a ranked daycare is closed to applications';
  end if;

  select coalesce(max(version), 1) into v_version from public.form_schemas;

  insert into public.children (
    parent_user_id, name, dob, desired_start_date,
    criteria_sibling, criteria_indigenous, criteria_staff_child, criteria_neighbourhood,
    form_data, form_schema_version
  ) values (
    app.uid(), p_name, p_dob, p_desired_start,
    coalesce((p_criteria->>'sibling')::boolean, false),
    coalesce((p_criteria->>'indigenous')::boolean, false),
    coalesce((p_criteria->>'staffChild')::boolean, false),
    coalesce((p_criteria->>'neighbourhood')::boolean, false),
    coalesce(p_form_data, '{}'), v_version
  ) returning id into v_child;

  insert into public.applications (child_id) values (v_child) returning id into v_app;

  foreach v_daycare in array p_ranked_daycares loop
    v_rank := v_rank + 1;
    insert into public.waitlist_entries (application_id, child_id, daycare_id, rank)
    values (v_app, v_child, v_daycare, v_rank);
  end loop;

  -- Audit details carry IDs, never child names (IT admins read this log
  -- but hold no child-level access, SPEC §3); notification bodies go over
  -- SMS/lock screens, so no names there either.
  perform app.audit('application.submitted',
    format('Child %s: applied to %s daycare(s)', v_child, v_rank));
  perform app.notify(app.uid(), 'application',
    format('Application received — you are on %s waitlist(s). No fee applies.', v_rank));
  return v_app;
end $$;

-- Per-daycare position + global view for one application (§4.2.2).
-- SECURITY DEFINER because a parent cannot read other families' entries,
-- yet their position depends on them.
create function public.application_positions(p_application uuid)
returns table (
  daycare_id uuid, rank int, entry_id uuid,
  list_position bigint, total_active bigint, open_spots bigint
)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not exists (
    select 1 from public.applications a
    join public.children c on c.id = a.child_id
    where a.id = p_application and c.parent_user_id = app.uid()
  ) then
    raise exception 'not your application';
  end if;

  return query
  select e.daycare_id, e.rank, e.id,
    (select o.list_position from app.ordered_entries(e.daycare_id) o where o.entry_id = e.id),
    (select count(*) from public.waitlist_entries x
      where x.daycare_id = e.daycare_id and x.status = 'active'),
    greatest(0,
      (select d.capacity_infant + d.capacity_toddler + d.capacity_preschool
         from public.daycares d where d.id = e.daycare_id)
      - (select count(*) from public.enrolments en
          where en.daycare_id = e.daycare_id and en.status = 'active')
      - (select count(*) from public.offers o
          where o.daycare_id = e.daycare_id and o.status = 'open'))
  from public.waitlist_entries e
  where e.application_id = p_application and e.status = 'active'
  order by e.rank;
end $$;

create function public.accept_offer(p_offer uuid, p_retained uuid[] default '{}')
returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_offer public.offers%rowtype;
  v_entry public.waitlist_entries%rowtype;
  v_sib public.waitlist_entries%rowtype;
  v_fee uuid;
  v_retained_count int := 0;
  v_daycare_name text;
begin
  select * into v_offer from public.offers where id = p_offer for update;
  if not found or v_offer.status <> 'open' then raise exception 'offer not open'; end if;
  if v_offer.expires_at < now() then raise exception 'offer expired'; end if;
  if not app.is_parent_of(v_offer.child_id) then raise exception 'not your offer'; end if;

  select * into v_entry from public.waitlist_entries where id = v_offer.waitlist_entry_id;

  update public.offers set status = 'accepted' where id = p_offer;

  -- Seamless transition (§4.2.4): end any current enrolment first.
  update public.enrolments set status = 'ended'
  where child_id = v_offer.child_id and status = 'active';
  insert into public.enrolments (child_id, daycare_id)
  values (v_offer.child_id, v_offer.daycare_id);

  update public.waitlist_entries set status = 'released' where id = v_entry.id;

  -- Cascade over the application's other entries (§4.2.3, §4.2.5).
  for v_sib in
    select * from public.waitlist_entries
    where application_id = v_entry.application_id
      and id <> v_entry.id and status = 'active'
  loop
    if v_sib.rank > v_entry.rank then
      perform app.release_entry(v_sib.id);          -- ranked below: always released
    elsif v_sib.id = any(p_retained) then
      v_retained_count := v_retained_count + 1;     -- ranked above + chosen: kept
    else
      perform app.release_entry(v_sib.id);          -- ranked above, not chosen
    end if;
  end loop;

  -- Holding fee: one per child per year covering all retained lists (§4.2.4).
  if v_retained_count > 0 then
    select id into v_fee from public.holding_fees
    where child_id = v_offer.child_id and status = 'paid' and term_end > now()
    limit 1;
    if v_fee is null then
      insert into public.holding_fees (child_id, term_end)
      values (v_offer.child_id, now() + interval '365 days')
      returning id into v_fee;
    else
      delete from public.holding_fee_entries where holding_fee_id = v_fee;
    end if;
    insert into public.holding_fee_entries (holding_fee_id, entry_id)
    select v_fee, e.id from public.waitlist_entries e
    where e.id = any(p_retained)
      and e.application_id = v_entry.application_id
      and e.rank < v_entry.rank and e.status = 'active';
  end if;

  update public.applications set status = 'enrolled' where id = v_entry.application_id;

  select name into v_daycare_name from public.daycares where id = v_offer.daycare_id;
  perform app.audit('offer.accepted', format('Child %s enrolled at %s', v_offer.child_id, v_daycare_name));
  perform app.notify(app.uid(), 'enrolment', 'Enrolment confirmed — sign in for details.');
end $$;

create function public.decline_offer(p_offer uuid)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_offer public.offers%rowtype;
begin
  select * into v_offer from public.offers where id = p_offer for update;
  if not found or v_offer.status <> 'open' then raise exception 'offer not open'; end if;
  if not app.is_parent_of(v_offer.child_id) then raise exception 'not your offer'; end if;
  -- A decline never affects standing elsewhere (§4.2.3).
  update public.offers set status = 'declined' where id = p_offer;
  perform app.audit('offer.declined', format('Offer %s declined', p_offer));
end $$;

create function public.withdraw_application(p_application uuid, p_daycares uuid[] default null)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_entry record; v_child uuid;
begin
  select a.child_id into v_child from public.applications a where a.id = p_application;
  if v_child is null or not app.is_parent_of(v_child) then
    raise exception 'not your application';
  end if;
  for v_entry in
    select id from public.waitlist_entries
    where application_id = p_application and status = 'active'
      and (p_daycares is null or daycare_id = any(p_daycares))
  loop
    perform app.release_entry(v_entry.id);
  end loop;
  if not exists (
    select 1 from public.waitlist_entries
    where application_id = p_application and status = 'active'
  ) and not exists (
    select 1 from public.enrolments where child_id = v_child and status = 'active'
  ) then
    update public.applications set status = 'withdrawn' where id = p_application;
  end if;
  perform app.audit('application.withdrawn',
    format('Application %s: withdrew from %s', p_application,
      case when p_daycares is null then 'all waitlists' else 'selected waitlists' end));
end $$;

create function public.lapse_holding_fee(p_fee uuid)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_child uuid; v_entry record;
begin
  select child_id into v_child from public.holding_fees where id = p_fee and status = 'paid';
  if v_child is null then raise exception 'no active holding fee'; end if;
  if not (app.is_parent_of(v_child) or app.uid() is null) then
    raise exception 'not your holding fee';
  end if;
  update public.holding_fees set status = 'lapsed' where id = p_fee;
  for v_entry in
    select entry_id from public.holding_fee_entries where holding_fee_id = p_fee
  loop
    perform app.release_entry(v_entry.entry_id);
  end loop;
  perform app.audit('holdingFee.lapsed', format('Holding fee %s lapsed; retained entries released', p_fee));
end $$;

-- ------------------------------------------------------ daycare-facing

-- The only read surface daycare staff have onto the waitlist: ordered,
-- tier-labelled, and WITHOUT the parent's rank or cross-daycare data (§5).
create function public.daycare_waitlist(p_daycare uuid)
returns table (
  entry_id uuid, child_id uuid, child_name text,
  age_group app.age_group, tier_label text,
  date_added timestamptz, flagged boolean, has_open_offer boolean,
  list_position bigint
)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.works_at(p_daycare) then raise exception 'not your daycare'; end if;
  return query
  select o.entry_id, o.child_id, c.name,
    app.age_group(c.dob), app.tier_label(p_daycare, o.child_id),
    e.date_added, e.flagged,
    exists (select 1 from public.offers ofr
            where ofr.waitlist_entry_id = o.entry_id and ofr.status = 'open'),
    o.list_position
  from app.ordered_entries(p_daycare) o
  join public.waitlist_entries e on e.id = o.entry_id
  join public.children c on c.id = o.child_id
  order by o.list_position;
end $$;

create function public.make_offer(p_entry uuid)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_offer uuid; v_window int; v_expires timestamptz;
  v_parent uuid; v_daycare_name text;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry for update;
  if not found or v_entry.status <> 'active' then raise exception 'entry not active'; end if;
  if not app.has_grant('daycare_admin', v_entry.daycare_id) then
    raise exception 'only the daycare admin can make offers';
  end if;
  -- §4.2.3: expiry computed here, server-side, from the configured window.
  select offer_window_days into v_window from public.settings;
  v_expires := now() + make_interval(days => v_window);
  insert into public.offers (waitlist_entry_id, child_id, daycare_id, expires_at)
  values (p_entry, v_entry.child_id, v_entry.daycare_id, v_expires)
  returning id into v_offer;

  select c.parent_user_id into v_parent
    from public.children c where c.id = v_entry.child_id;
  select name into v_daycare_name from public.daycares where id = v_entry.daycare_id;
  perform app.audit('offer.created',
    format('Offer created for child %s at %s', v_entry.child_id, v_daycare_name));
  perform app.notify(v_parent, 'offer',
    format('You have a daycare offer waiting. Sign in to respond by %s.',
      to_char(v_expires at time zone 'America/Iqaluit', 'YYYY-MM-DD')));
  return v_offer;
end $$;

create function public.mark_ineligible(p_entry uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_entry public.waitlist_entries%rowtype;
begin
  select * into v_entry from public.waitlist_entries where id = p_entry for update;
  if not found then raise exception 'no such entry'; end if;
  if not app.has_grant('daycare_admin', v_entry.daycare_id) then
    raise exception 'only the daycare admin can mark ineligible';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'a reason is required (audited)'; -- §4.3
  end if;
  update public.waitlist_entries
  set status = 'ineligible', ineligible_reason = p_reason where id = p_entry;
  update public.offers set status = 'superseded'
  where waitlist_entry_id = p_entry and status = 'open';
  perform app.audit('entry.ineligible', format('Entry %s marked ineligible: %s', p_entry, p_reason));
end $$;

-- Manual reorder within a tier only (§4.3); audited.
create function public.move_entry(p_entry uuid, p_direction int)
returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_tier int; v_pos int; v_swap uuid; v_a int; v_b int;
begin
  if p_direction not in (-1, 1) then raise exception 'direction must be -1 or 1'; end if;
  select * into v_entry from public.waitlist_entries where id = p_entry for update;
  if not found or v_entry.status <> 'active' then raise exception 'entry not active'; end if;
  if not app.has_grant('daycare_admin', v_entry.daycare_id) then
    raise exception 'only the daycare admin can reorder';
  end if;
  v_tier := app.tier_index(v_entry.daycare_id, v_entry.child_id);

  -- Materialize manual order for the whole tier from the current ordering.
  with tier_entries as (
    select o.entry_id,
      row_number() over (order by o.list_position) - 1 as pos
    from app.ordered_entries(v_entry.daycare_id) o
    join public.waitlist_entries e on e.id = o.entry_id
    where app.tier_index(e.daycare_id, e.child_id) = v_tier
  )
  update public.waitlist_entries e set manual_order = t.pos
  from tier_entries t where e.id = t.entry_id;

  select manual_order into v_pos from public.waitlist_entries where id = p_entry;
  select id into v_swap from public.waitlist_entries e
  where e.daycare_id = v_entry.daycare_id and e.status = 'active'
    and app.tier_index(e.daycare_id, e.child_id) = v_tier
    and e.manual_order = v_pos + p_direction;
  if v_swap is null then return; end if; -- at the tier boundary

  select manual_order into v_a from public.waitlist_entries where id = p_entry;
  select manual_order into v_b from public.waitlist_entries where id = v_swap;
  update public.waitlist_entries set manual_order = v_b where id = p_entry;
  update public.waitlist_entries set manual_order = v_a where id = v_swap;
  perform app.audit('waitlist.reordered', format('Manual reorder at daycare %s', v_entry.daycare_id));
end $$;

-- -------------------------------------------------------------- system

-- Offer-expiry sweep (§7.3): run by pg_cron / scheduled Edge Function with
-- the service role. Never callable by end users.
create function public.expire_offers()
returns int language plpgsql security definer set search_path = public, app as $$
declare v_count int;
begin
  with expired as (
    update public.offers set status = 'expired'
    where status = 'open' and expires_at < now()
    returning id
  )
  select count(*) into v_count from expired;
  if v_count > 0 then
    perform app.audit('offer.expired', format('%s offer(s) expired unanswered', v_count));
  end if;
  return v_count;
end $$;

revoke execute on function public.expire_offers() from public, anon, authenticated;
grant execute on function public.expire_offers() to service_role;

-- -------------------------------------------------------------- funder

-- Aggregates only, with small-cell suppression (§4.8).
create function app.suppress_small(n bigint) returns text
language sql immutable as $$
  select case when n > 0 and n < 5 then '<5' else n::text end
$$;

create function public.funder_overview()
returns jsonb language plpgsql stable security definer set search_path = public, app as $$
begin
  if not (app.is_funder() or app.is_it_admin()) then
    raise exception 'funder role required';
  end if;
  return jsonb_build_object(
    'totalCapacity', (select coalesce(sum(capacity_infant + capacity_toddler + capacity_preschool), 0) from public.daycares),
    'totalEnrolled', (select count(*) from public.enrolments where status = 'active'),
    'perDaycare', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'daycareId', d.id, 'name', d.name,
        'capacity', d.capacity_infant + d.capacity_toddler + d.capacity_preschool,
        'enrolled', (select count(*) from public.enrolments en where en.daycare_id = d.id and en.status = 'active'),
        'waitlist', app.suppress_small((select count(*) from public.waitlist_entries e where e.daycare_id = d.id and e.status = 'active'))
      ) order by d.name), '[]') from public.daycares d
    ),
    'waitlistByAgeGroup', (
      select jsonb_object_agg(g, app.suppress_small(n)) from (
        select app.age_group(c.dob) as g, count(distinct c.id) as n
        from public.children c
        where exists (select 1 from public.waitlist_entries e where e.child_id = c.id and e.status = 'active')
        group by 1
      ) x
    ),
    'indigenousEnrolledDisclosed', app.suppress_small((
      select count(distinct c.id) from public.children c
      join public.enrolments en on en.child_id = c.id and en.status = 'active'
      where c.criteria_indigenous
    ))
  );
end $$;

-- Broadcast to self-flagged parents (§4.8.1): snapshot recipients at send.
create function public.send_broadcast(p_body text)
returns int language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; v_count int;
begin
  if not app.is_funder() then raise exception 'funder role required'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'empty message'; end if;
  insert into public.broadcast_messages (funder_user_id, body)
  values (app.uid(), p_body) returning id into v_id;
  insert into public.broadcast_recipients (broadcast_id, user_id)
  select v_id, p.id from public.profiles p where p.willing_to_start_daycare is not null;
  get diagnostics v_count = row_count;
  insert into public.notifications (user_id, event, body)
  select r.user_id, 'broadcast', p_body
  from public.broadcast_recipients r where r.broadcast_id = v_id;
  perform app.audit('broadcast.sent', format('Broadcast to %s flagged parent(s)', v_count));
  return v_count;
end $$;
