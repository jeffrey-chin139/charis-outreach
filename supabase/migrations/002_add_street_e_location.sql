alter table public.street_e_encounters
  add column if not exists location text check (location is null or length(location) <= 120);
