create table public.user_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('heygen')),
  encrypted_api_key text not null,
  key_hint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.user_provider_keys enable row level security;

create index user_provider_keys_user_id_idx
  on public.user_provider_keys(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_provider_keys_set_updated_at
  before update on public.user_provider_keys
  for each row
  execute function public.set_updated_at();
