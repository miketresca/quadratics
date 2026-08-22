alter table public.game_user_lesson_progress
  drop constraint if exists game_user_lesson_progress_lesson_id_check;

alter table public.game_user_lesson_progress
  add constraint game_user_lesson_progress_lesson_id_check
  check (lesson_id in ('volume-cubes-lesson-1', 'dynamic-lesson-locked', 'dynamic-lesson-3-locked'));
