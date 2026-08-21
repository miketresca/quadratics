create index if not exists game_usage_events_user_created_idx
  on public.game_usage_events (user_id, created_at desc);

create index if not exists game_usage_events_run_idx
  on public.game_usage_events (run_id);

create index if not exists game_usage_events_artifact_idx
  on public.game_usage_events (artifact_id);

create index if not exists game_usage_events_provider_stage_idx
  on public.game_usage_events (provider, stage);
