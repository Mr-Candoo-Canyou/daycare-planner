-- Support functions for the frontend Supabase adapter, plus one RLS fix.

-- FIX: the entry_notes policies referenced waitlist_entries in a subquery,
-- but RLS applies inside policy subqueries too — and daycare roles have no
-- select policy on waitlist_entries (by design, §5). Net effect: staff
-- could never read notes they had written. Route the daycare lookup
-- through a SECURITY DEFINER helper instead.

create function app.entry_daycare(p_entry uuid) returns uuid
language sql stable security definer set search_path = public, app as $$
  select daycare_id from public.waitlist_entries where id = p_entry
$$;

drop policy notes_select on public.entry_notes;
drop policy notes_insert on public.entry_notes;

create policy notes_select on public.entry_notes for select using (
  app.works_at(app.entry_daycare(entry_id))
);
create policy notes_insert on public.entry_notes for insert with check (
  author_id = app.uid() and app.works_at(app.entry_daycare(entry_id))
);

-- Public directory statistics (§4.1): the directory is browsable without
-- an account, but anon cannot (and must not) read enrolments/entries.
-- This definer function exposes only per-daycare counts.
create function public.directory_stats()
returns table (
  daycare_id uuid,
  enrolled bigint,
  waitlist bigint,
  enrolled_infant bigint,
  enrolled_toddler bigint,
  enrolled_preschool bigint
)
language sql stable security definer set search_path = public, app as $$
  select d.id,
    (select count(*) from public.enrolments en
      where en.daycare_id = d.id and en.status = 'active'),
    (select count(*) from public.waitlist_entries e
      where e.daycare_id = d.id and e.status = 'active'),
    (select count(*) from public.enrolments en join public.children c on c.id = en.child_id
      where en.daycare_id = d.id and en.status = 'active' and app.age_group(c.dob) = 'infant'),
    (select count(*) from public.enrolments en join public.children c on c.id = en.child_id
      where en.daycare_id = d.id and en.status = 'active' and app.age_group(c.dob) = 'toddler'),
    (select count(*) from public.enrolments en join public.children c on c.id = en.child_id
      where en.daycare_id = d.id and en.status = 'active' and app.age_group(c.dob) = 'preschool')
  from public.daycares d
$$;

-- Flag/unflag an application at your own daycare (§4.3). Staff and admins;
-- daycare roles have no direct write path to waitlist_entries.
create function public.set_entry_flag(p_entry uuid, p_flagged boolean)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_daycare uuid;
begin
  select daycare_id into v_daycare from public.waitlist_entries where id = p_entry;
  if v_daycare is null then raise exception 'no such entry'; end if;
  if not app.works_at(v_daycare) then raise exception 'not your daycare'; end if;
  update public.waitlist_entries set flagged = p_flagged where id = p_entry;
end $$;

-- Add a note to an application at your own daycare.
create function public.add_entry_note(p_entry uuid, p_body text)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_daycare uuid;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'empty note'; end if;
  select daycare_id into v_daycare from public.waitlist_entries where id = p_entry;
  if v_daycare is null then raise exception 'no such entry'; end if;
  if not app.works_at(v_daycare) then raise exception 'not your daycare'; end if;
  insert into public.entry_notes (entry_id, author_id, body) values (p_entry, app.uid(), p_body);
end $$;

-- Notes for a whole daycare list in one call (adapter convenience).
create function public.daycare_entry_notes(p_daycare uuid)
returns table (entry_id uuid, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, app as $$
begin
  if not app.works_at(p_daycare) then raise exception 'not your daycare'; end if;
  return query
  select n.entry_id, n.body, n.created_at
  from public.entry_notes n
  join public.waitlist_entries e on e.id = n.entry_id
  where e.daycare_id = p_daycare
  order by n.created_at;
end $$;

-- Replace a daycare's tier configuration atomically (§4.3). supabase-js
-- cannot run multi-statement transactions client-side; this keeps the
-- delete+insert atomic and validated.
create function public.set_daycare_tiers(p_daycare uuid, p_tiers jsonb)
returns void language plpgsql security definer set search_path = public, app as $$
declare v_tier jsonb; v_order int := 0;
begin
  if not (app.has_grant('daycare_admin', p_daycare) or app.is_it_admin()) then
    raise exception 'only the daycare admin can edit priority rules';
  end if;
  if jsonb_array_length(p_tiers) < 1 then
    raise exception 'at least one tier is required';
  end if;
  delete from public.daycare_tiers where daycare_id = p_daycare;
  for v_tier in select * from jsonb_array_elements(p_tiers) loop
    insert into public.daycare_tiers (daycare_id, kind, label, description, sort_order)
    values (
      p_daycare,
      (v_tier->>'kind')::app.tier_kind,
      v_tier->>'label',
      coalesce(v_tier->>'description', ''),
      v_order
    );
    v_order := v_order + 1;
  end loop;
  perform app.audit('policy.updated', format('Priority tiers replaced at daycare %s (%s tiers)', p_daycare, v_order));
end $$;
