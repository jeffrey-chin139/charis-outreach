create extension if not exists "pgcrypto";

create type outreach_type as enum ('Haig Road', 'Dakota', 'Street E');
create type residential_outcome as enum (
  'Very positive',
  'Generally positive',
  'Not interested',
  'Not in / no answer',
  'Do not revisit',
  'Vacant / inaccessible'
);
create type street_e_outcome as enum (
  'Very positive',
  'Generally positive'
);

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.residential_master (
  id uuid primary key default gen_random_uuid(),
  neighbourhood text not null check (length(neighbourhood) between 1 and 80),
  block text not null check (length(block) between 1 and 30),
  floor text not null check (length(floor) between 1 and 10),
  stack text not null check (length(stack) between 1 and 20),
  unit_label text generated always as ('#' || floor || '-' || stack) stored,
  active boolean not null default true,
  source_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (neighbourhood, block, floor, stack)
);

create table public.outreach_sessions (
  id uuid primary key default gen_random_uuid(),
  volunteer_name text not null check (length(volunteer_name) between 1 and 120),
  outreach_type outreach_type not null,
  residential_neighbourhood text,
  residential_block text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check (
    (outreach_type = 'Street E' and residential_neighbourhood is null and residential_block is null)
    or
    (outreach_type in ('Haig Road', 'Dakota') and residential_neighbourhood = outreach_type::text and residential_block is not null)
  )
);

create table public.residential_visits (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.outreach_sessions(id) on delete restrict,
  residential_master_id uuid not null references public.residential_master(id) on delete restrict,
  neighbourhood_snapshot text not null,
  block_snapshot text not null,
  floor_snapshot text not null,
  stack_snapshot text not null,
  unit_label_snapshot text not null,
  outcome residential_outcome not null,
  remarks text check (remarks is null or length(remarks) <= 1000),
  visit_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_by uuid references auth.users(id)
);

create table public.residential_unit_status (
  id uuid primary key default gen_random_uuid(),
  residential_master_id uuid not null references public.residential_master(id) on delete restrict unique,
  do_not_revisit_active boolean not null default false,
  reason text check (reason is null or length(reason) <= 1000),
  activated_by uuid references auth.users(id),
  activated_at timestamptz,
  cleared_by uuid references auth.users(id),
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.street_e_encounters (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.outreach_sessions(id) on delete restrict,
  encounter_number integer not null check (encounter_number > 0),
  outcome street_e_outcome not null,
  location text check (location is null or length(location) <= 120),
  remarks text check (remarks is null or length(remarks) <= 1000),
  encounter_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, encounter_number)
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index residential_master_lookup_idx on public.residential_master (neighbourhood, block, active, floor, stack);
create index residential_visits_filter_idx on public.residential_visits (visit_timestamp, outcome, neighbourhood_snapshot, block_snapshot);
create index residential_visits_unit_idx on public.residential_visits (residential_master_id, visit_timestamp desc);
create index street_e_filter_idx on public.street_e_encounters (encounter_timestamp, outcome);
create index sessions_volunteer_idx on public.outreach_sessions (volunteer_name, outreach_type, started_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger residential_master_touch before update on public.residential_master
  for each row execute function public.touch_updated_at();
create trigger residential_visits_touch before update on public.residential_visits
  for each row execute function public.touch_updated_at();
create trigger residential_unit_status_touch before update on public.residential_unit_status
  for each row execute function public.touch_updated_at();
create trigger street_e_encounters_touch before update on public.street_e_encounters
  for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and active = true
  );
$$;

alter table public.admin_profiles enable row level security;
alter table public.residential_master enable row level security;
alter table public.outreach_sessions enable row level security;
alter table public.residential_visits enable row level security;
alter table public.residential_unit_status enable row level security;
alter table public.street_e_encounters enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "Admins can read admin profiles" on public.admin_profiles
  for select using (public.is_admin());

create policy "Admins manage residential master" on public.residential_master
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage sessions" on public.outreach_sessions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage residential visits" on public.residential_visits
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage unit status" on public.residential_unit_status
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage street encounters" on public.street_e_encounters
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins read audit log" on public.admin_audit_log
  for select using (public.is_admin());
