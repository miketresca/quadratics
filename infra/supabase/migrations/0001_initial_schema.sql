create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equation_input text not null,
  normalized_equation text,
  equation_hash text,
  instructor_id text,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  credits_used integer not null default 0,
  result_json jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index credit_ledger_idempotency_key_idx
  on public.credit_ledger(user_id, idempotency_key)
  where idempotency_key is not null;

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  equation_input text not null,
  normalized_equation text not null,
  equation_hash text not null,
  method text,
  instructor_id text,
  solution_json jsonb not null,
  created_at timestamptz not null default now()
);

create table public.lesson_steps (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  step_index integer not null,
  step_type text not null,
  step_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (lesson_id, step_index)
);

alter table public.profiles enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_steps enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "generation_jobs_select_own" on public.generation_jobs for select using (user_id = auth.uid());
create policy "generation_jobs_insert_own" on public.generation_jobs for insert with check (user_id = auth.uid());
create policy "generation_jobs_update_own" on public.generation_jobs for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "credit_ledger_select_own" on public.credit_ledger for select using (user_id = auth.uid());

create policy "lessons_select_own" on public.lessons for select using (user_id = auth.uid());
create policy "lessons_insert_own" on public.lessons for insert with check (user_id = auth.uid());

create policy "lesson_steps_select_own_parent" on public.lesson_steps
  for select using (
    exists (
      select 1 from public.lessons
      where lessons.id = lesson_steps.lesson_id
      and lessons.user_id = auth.uid()
    )
  );

create policy "lesson_steps_insert_own_parent" on public.lesson_steps
  for insert with check (
    exists (
      select 1 from public.lessons
      where lessons.id = lesson_steps.lesson_id
      and lessons.user_id = auth.uid()
    )
  );
