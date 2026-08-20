create table if not exists public.game_user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_fighter_id text check (
    selected_fighter_id is null
    or selected_fighter_id in (
      'mario',
      'donkey-kong',
      'link',
      'samus',
      'captain-falcon',
      'ness',
      'yoshi',
      'kirby',
      'fox',
      'pikachu',
      'luigi',
      'jigglypuff'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.game_user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (lesson_id in ('volume-cubes-lesson-1', 'dynamic-lesson-locked')),
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

create policy "Users can read their own game lesson progress"
  on public.game_user_lesson_progress for select
  using (auth.uid() = user_id);
