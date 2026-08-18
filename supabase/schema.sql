create extension if not exists pgcrypto;

create table if not exists public.target_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('add', 'remove')),
  category text not null check (category in ('companies', 'roles', 'locations')),
  value text not null check (length(trim(value)) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.target_changes enable row level security;

-- Replace this email before running the file in the Supabase SQL editor.
create policy "Owner can manage target changes"
on public.target_changes
for all
to authenticated
using ((auth.jwt() ->> 'email') = 'bethlindenbaum@comcast.net')
with check (auth.uid() = user_id and (auth.jwt() ->> 'email') = 'bethlindenbaum@comcast.net');

create index if not exists target_changes_created_at_idx
on public.target_changes(created_at);
