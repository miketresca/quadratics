alter table public.generation_artifacts
  drop constraint generation_artifacts_stage_check;

alter table public.generation_artifacts
  add constraint generation_artifacts_stage_check
  check (
    stage in (
      'solution',
      'lesson',
      'real_world_context',
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
  );
