create table if not exists public.game_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_fighter_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.game_user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  status text not null check (status in ('started', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

alter table public.game_user_progress enable row level security;
alter table public.game_user_lesson_progress enable row level security;

create policy "Users can read their own game progress"
  on public.game_user_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own game progress"
  on public.game_user_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own game progress"
  on public.game_user_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own game progress"
  on public.game_user_progress for delete
  using (auth.uid() = user_id);

create policy "Users can read their own game lesson progress"
  on public.game_user_lesson_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own game lesson progress"
  on public.game_user_lesson_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own game lesson progress"
  on public.game_user_lesson_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own game lesson progress"
  on public.game_user_lesson_progress for delete
  using (auth.uid() = user_id);
