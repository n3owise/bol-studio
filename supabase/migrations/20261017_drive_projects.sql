-- Run in Supabase SQL editor. Credentials never pass through browser-accessible tables.
create table if not exists public.bol_drive_connections (
  owner uuid primary key references auth.users(id) on delete cascade,
  credentials text not null,
  folder_id text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.bol_drive_oauth_states (
  id text primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists public.bol_saved_projects (
  id uuid primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  source_file_id text not null,
  name text not null,
  snapshot jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.bol_drive_connections enable row level security;
alter table public.bol_drive_oauth_states enable row level security;
alter table public.bol_saved_projects enable row level security;
-- Deliberately no client policies. All access is through authenticated server routes.
revoke all on public.bol_drive_connections, public.bol_drive_oauth_states, public.bol_saved_projects from anon, authenticated;
grant all on public.bol_drive_connections, public.bol_drive_oauth_states, public.bol_saved_projects to service_role;
create or replace function public.bol_save_drive_project(p_id uuid, p_owner uuid, p_revision integer, p_snapshot jsonb)
returns setof public.bol_saved_projects language sql security invoker set search_path = public as $$
  update bol_saved_projects set snapshot = p_snapshot, revision = revision + 1,
    name = left(coalesce(p_snapshot->>'name', name), 120), updated_at = now()
  where id = p_id and owner = p_owner and revision = p_revision
  returning *;
$$;
revoke all on function public.bol_save_drive_project(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.bol_save_drive_project(uuid, uuid, integer, jsonb) to service_role;
