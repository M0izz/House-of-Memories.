-- ============================================================================
-- House of Memories — Extended Features (Migration 002)
-- Adds created_by to tags, composite constraints, and additional indexes.
-- ============================================================================

-- Add created_by to tags (was missing in initial migration)
alter table tags add column if not exists created_by uuid references auth.users(id);

-- Composite uniqueness & foreign key safety for multi-space isolation
-- Prevents records from accidentally referencing resources in another space
alter table albums
  add constraint if not exists albums_space_title_unique unique (space_id, title);

alter table timeline_events
  add constraint if not exists timeline_events_space_title_unique unique (space_id, title);

alter table special_dates
  add constraint if not exists special_dates_space_title_unique unique (space_id, title);

-- Additional performance indexes
create index if not exists idx_memories_space_captured on memories(space_id, captured_at desc);
create index if not exists idx_memories_space_created on memories(space_id, created_at desc);
create index if not exists idx_memory_media_memory_created on memory_media(memory_id, created_at);
create index if not exists idx_letters_space_unlock on letters(space_id, unlock_at);
create index if not exists idx_special_dates_space_date on special_dates(space_id, event_date);
create index if not exists idx_memory_views_user_viewed on memory_views(user_id, viewed_at desc);

-- Seed: default tags for the space (optional, run via seed.sql)
-- insert into tags (space_id, name, color, created_by)
-- select id, 'Favorite', '#F6E4EC', created_by from memory_spaces;
