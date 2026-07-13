-- FCM device tokens registered by the PWA on push opt-in (SPEC §7.2).
-- Read only by the notify Edge Function (service role); users manage
-- their own tokens.

create table public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy push_tokens_own on public.push_tokens for all
  using (user_id = app.uid()) with check (user_id = app.uid());

grant select, insert, delete on public.push_tokens to authenticated;
