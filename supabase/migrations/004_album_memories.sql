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

-- RLS Policy: Space members can insert into album_memories (with strict space boundary validation)
create policy "Space members can insert album_memories"
  on album_memories for insert
  with check (
    exists (
      select 1 from albums a
      join space_members sm on sm.space_id = a.space_id
      join memories m on m.id = album_memories.memory_id
      where a.id = album_memories.album_id
      and m.space_id = a.space_id
      and sm.user_id = auth.uid()
    )
  );

-- Function and trigger to enforce cross-space integrity at the database level
create or replace function validate_album_memory_space_match()
returns trigger as $$
declare
  v_album_space uuid;
  v_memory_space uuid;
begin
  select space_id into v_album_space from albums where id = new.album_id;
  select space_id into v_memory_space from memories where id = new.memory_id;

  if v_album_space is null or v_memory_space is null or v_album_space <> v_memory_space then
    raise exception 'Integrity violation: Memory (%) and Album (%) must belong to the exact same memory space.', new.memory_id, new.album_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_album_memory_space on album_memories;
create trigger trg_validate_album_memory_space
  before insert or update on album_memories
  for each row execute function validate_album_memory_space_match();

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
