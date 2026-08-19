create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  stage text not null,
  provider text not null,
  model text,
  unit_type text not null,
  quantity numeric not null default 1,
  unit_cost_usd numeric not null default 0,
  cost_usd numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index usage_events_user_created_idx on public.usage_events(user_id, created_at desc);
create index usage_events_generation_idx on public.usage_events(generation_job_id);
create index usage_events_provider_stage_idx on public.usage_events(provider, stage);

alter table public.usage_events enable row level security;

create policy "usage_events_select_own" on public.usage_events
  for select using (user_id = auth.uid());
