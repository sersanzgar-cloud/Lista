-- Lista: schema for cloud-synced library + reading progress.
--
-- Run this once in your Supabase project's SQL editor
-- (https://app.supabase.com/project/_/sql) after creating the project.
-- It's safe to re-run: every statement is idempotent.

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  source_type text not null default 'text' check (source_type in ('pdf', 'text')),
  content text not null,
  char_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_progress (
  book_id uuid primary key references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.books enable row level security;
alter table public.reading_progress enable row level security;

drop policy if exists "Users manage their own books" on public.books;
create policy "Users manage their own books"
  on public.books
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own progress" on public.reading_progress;
create policy "Users manage their own progress"
  on public.reading_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
