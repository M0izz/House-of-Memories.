-- ============================================================================
-- House of Memories — Seed Data (Development / Staging Only)
-- NEVER run this against production with real user data.
-- ============================================================================

-- Create a sample memory space
insert into memory_spaces (name, created_by)
values ('House of Memories', auth.uid())
on conflict do nothing;

-- Default tags
insert into tags (space_id, name, color, created_by)
select id, 'Favorite', '#F6E4EC', created_by from memory_spaces
union all
select id, 'Adventure', '#EDE8F7', created_by from memory_spaces
union all
select id, 'Inside Joke', '#F7EBD5', created_by from memory_spaces
union all
select id, 'Birthday', '#E4F0E8', created_by from memory_spaces;

-- Sample special dates
insert into special_dates (space_id, title, event_date, recurrence, created_by)
select id, "Her Birthday", '2026-11-11', 'yearly', created_by from memory_spaces
union all
select id, "First Met", '2024-03-15', 'yearly', created_by from memory_spaces;
