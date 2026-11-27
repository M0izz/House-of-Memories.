-- ============================================================================
-- House of Memories — Many-to-Many Album Memories (Migration 004)
-- ============================================================================

-- Ensure albums table has cover_image_url and is_favorite
alter table albums add column if not exists cover_image_url text;
alter table albums add column if not exists is_favorite boolean not null default false;

-- Create album_memories junction table for Many-to-Many relationships
create table if not exists album_memories (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  memory_id uuid not null references memories(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (album_id, memory_id)
);

-- Indexes for fast lookups
create index if not exists idx_album_memories_album_id on album_memories(album_id);
create index if not exists idx_album_memories_memory_id on album_memories(memory_id);

-- Enable RLS
alter table album_memories enable row level security;

-- RLS Policy: Space members can read album memories
create policy "Space members can read album_memories"
  on album_memories for select
  using (
    exists (
      select 1 from albums a
      join space_members sm on sm.space_id = a.space_id
      where a.id = album_memories.album_id
      and sm.user_id = auth.uid()
    )
  );

-- RLS Policy: Space members can insert into album_memories
create policy "Space members can insert album_memories"
  on album_memories for insert
  with check (
    exists (
      select 1 from albums a
      join space_members sm on sm.space_id = a.space_id
      where a.id = album_memories.album_id
      and sm.user_id = auth.uid()
    )
  );

-- RLS Policy: Space members can delete from album_memories
create policy "Space members can delete album_memories"
  on album_memories for delete
  using (
    exists (
      select 1 from albums a
      join space_members sm on sm.space_id = a.space_id
      where a.id = album_memories.album_id
      and sm.user_id = auth.uid()
    )
  );

-- Safe migration of existing memories.album_id relationships to album_memories
insert into album_memories (album_id, memory_id, added_by, created_at)
select album_id, id, created_by, created_at
from memories
where album_id is not null
on conflict (album_id, memory_id) do nothing;
