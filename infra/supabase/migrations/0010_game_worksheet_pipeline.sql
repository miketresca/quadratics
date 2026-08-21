create table if not exists public.game_worksheet_templates (
  id text primary key,
  title text not null,
  version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_worksheet_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references public.game_worksheet_templates(id),
  selected_instructor_id text,
  status text not null default 'active' check (status in ('active', 'completed', 'failed')),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists game_worksheet_runs_user_template_instructor_idx
  on public.game_worksheet_runs (user_id, template_id, coalesce(selected_instructor_id, 'default'));

create table if not exists public.game_lesson_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.game_worksheet_runs(id) on delete cascade,
  stage text not null,
  version integer not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'awaiting_approval', 'approved', 'rejected', 'stale')),
  is_current boolean not null default true,
  input_hash text,
  payload jsonb not null default '{}'::jsonb,
  storage_refs jsonb not null default '[]'::jsonb,
  error_message text,
  stale_reason text,
  config_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, stage, version)
);

create unique index if not exists game_lesson_artifacts_current_stage_idx
  on public.game_lesson_artifacts (run_id, stage)
  where is_current;

create table if not exists public.game_lesson_artifact_dependencies (
  artifact_id uuid not null references public.game_lesson_artifacts(id) on delete cascade,
  depends_on_artifact_id uuid not null references public.game_lesson_artifacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (artifact_id, depends_on_artifact_id)
);

create table if not exists public.game_lesson_artifact_approvals (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.game_lesson_artifacts(id) on delete cascade,
  run_id uuid not null references public.game_worksheet_runs(id) on delete cascade,
  artifact_version integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  unique (artifact_id, artifact_version)
);

create table if not exists public.game_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.game_worksheet_runs(id) on delete set null,
  artifact_id uuid references public.game_lesson_artifacts(id) on delete set null,
  stage text not null,
  provider text not null,
  model text,
  unit_type text not null,
  quantity numeric not null default 0,
  unit_cost_usd numeric not null default 0,
  total_cost_usd numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.game_worksheet_templates enable row level security;
alter table public.game_worksheet_runs enable row level security;
alter table public.game_lesson_artifacts enable row level security;
alter table public.game_lesson_artifact_dependencies enable row level security;
alter table public.game_lesson_artifact_approvals enable row level security;
alter table public.game_usage_events enable row level security;

create policy "Users can read worksheet templates"
  on public.game_worksheet_templates for select
  using (true);

create policy "Users can read their worksheet runs"
  on public.game_worksheet_runs for select
  using (auth.uid() = user_id);

create policy "Users can read their game artifacts"
  on public.game_lesson_artifacts for select
  using (
    exists (
      select 1 from public.game_worksheet_runs
      where game_worksheet_runs.id = game_lesson_artifacts.run_id
      and game_worksheet_runs.user_id = auth.uid()
    )
  );

create policy "Users can read their game artifact dependencies"
  on public.game_lesson_artifact_dependencies for select
  using (
    exists (
      select 1
      from public.game_lesson_artifacts artifact
      join public.game_worksheet_runs run on run.id = artifact.run_id
      where artifact.id = game_lesson_artifact_dependencies.artifact_id
      and run.user_id = auth.uid()
    )
  );

create policy "Users can read their game approvals"
  on public.game_lesson_artifact_approvals for select
  using (auth.uid() = user_id);

create policy "Users can read their game usage"
  on public.game_usage_events for select
  using (auth.uid() = user_id);

insert into public.game_worksheet_templates (id, title, version, payload)
values (
  'volume-cubes-lesson-1',
  'Volume With Whole-Number Cubes',
  1,
  '{"source":"misc/task/task_lesson.pdf","sections":["do_now","vocabulary","guided_practice"]}'::jsonb
)
on conflict (id) do update
set title = excluded.title,
    version = excluded.version,
    payload = excluded.payload,
    updated_at = now();
