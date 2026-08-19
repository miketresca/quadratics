create table public.generation_artifacts (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (
    stage in (
      'solution',
      'lesson',
      'teacher_script',
      'elevenlabs_request',
      'elevenlabs_audio',
      'animation_plan',
      'resolved_timeline',
      'motion_canvas_render',
      'base_video',
      'heygen_avatar',
      'avatar_composition',
      'final_video'
    )
  ),
  version integer not null check (version > 0),
  status text not null check (
    status in ('pending', 'running', 'completed', 'failed', 'stale', 'skipped')
  ),
  input_hash text not null,
  upstream_artifact_ids uuid[] not null default '{}',
  provider text,
  model text,
  config_metadata jsonb not null default '{}'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  storage_objects jsonb not null default '[]'::jsonb,
  is_current boolean not null default false,
  cache_hit boolean not null default false,
  stale_reason text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (status = 'stale' or stale_reason is null),
  check (status <> 'stale' or stale_reason is not null),
  check (status = 'failed' or (error_code is null and error_message is null)),
  check (status <> 'failed' or (error_code is not null or error_message is not null)),
  check (status <> 'completed' or completed_at is not null),
  unique (id, generation_job_id),
  unique (id, generation_job_id, user_id),
  unique (generation_job_id, stage, version)
);

create unique index generation_artifacts_one_current_per_stage_idx
  on public.generation_artifacts(generation_job_id, stage)
  where is_current;

create index generation_artifacts_user_generation_idx
  on public.generation_artifacts(user_id, generation_job_id);

create index generation_artifacts_cache_lookup_idx
  on public.generation_artifacts(generation_job_id, stage, input_hash, status)
  where status = 'completed';

create table public.generation_artifact_dependencies (
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  upstream_artifact_id uuid not null,
  downstream_artifact_id uuid not null,
  dependency_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (upstream_artifact_id, downstream_artifact_id),
  check (upstream_artifact_id <> downstream_artifact_id),
  foreign key (upstream_artifact_id, generation_job_id)
    references public.generation_artifacts(id, generation_job_id)
    on delete cascade,
  foreign key (downstream_artifact_id, generation_job_id)
    references public.generation_artifacts(id, generation_job_id)
    on delete cascade
);

create index generation_artifact_dependencies_downstream_idx
  on public.generation_artifact_dependencies(generation_job_id, downstream_artifact_id);

create index generation_artifact_dependencies_upstream_idx
  on public.generation_artifact_dependencies(generation_job_id, upstream_artifact_id);

alter table public.generation_artifacts enable row level security;
alter table public.generation_artifact_dependencies enable row level security;

create policy "generation_artifacts_select_own"
  on public.generation_artifacts
  for select
  using (user_id = auth.uid());

create policy "generation_artifact_dependencies_select_own"
  on public.generation_artifact_dependencies
  for select
  using (
    exists (
      select 1
      from public.generation_artifacts upstream
      where upstream.id = generation_artifact_dependencies.upstream_artifact_id
      and upstream.generation_job_id = generation_artifact_dependencies.generation_job_id
      and upstream.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-media',
  'generated-media',
  false,
  524288000,
  array['audio/mpeg', 'audio/wav', 'audio/mp4', 'video/mp4', 'application/json']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "generated_media_select_own_folder"
  on storage.objects
  for select
  using (
    bucket_id = 'generated-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
