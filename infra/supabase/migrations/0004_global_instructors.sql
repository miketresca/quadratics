create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  voice_provider text not null default 'elevenlabs',
  voice_id text,
  reference_image_url text,
  image_zoom numeric not null default 1,
  image_x numeric not null default 50,
  image_y numeric not null default 50,
  avatar_provider text,
  avatar_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.instructors enable row level security;

create policy "instructors_select_authenticated" on public.instructors
  for select using (auth.role() = 'authenticated');

create policy "instructors_insert_authenticated" on public.instructors
  for insert with check (auth.role() = 'authenticated');

create policy "instructors_update_authenticated" on public.instructors
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "instructors_delete_authenticated" on public.instructors
  for delete using (auth.role() = 'authenticated');

insert into public.instructors (id, display_name, voice_provider, voice_id)
values
  ('00000000-0000-0000-0000-000000000101', 'Male Instructor', 'elevenlabs', null),
  ('00000000-0000-0000-0000-000000000102', 'Female Instructor', 'elevenlabs', null)
on conflict (id) do nothing;
