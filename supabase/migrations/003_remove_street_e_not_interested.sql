alter type public.street_e_outcome rename to street_e_outcome_old;

create type public.street_e_outcome as enum (
  'Very positive',
  'Generally positive'
);

alter table public.street_e_encounters
  alter column outcome type public.street_e_outcome
  using outcome::text::public.street_e_outcome;

drop type public.street_e_outcome_old;
