-- ============================================================================
-- House of Memories — Initial Database Schema (Migration 001)
-- ============================================================================
-- Core tables: memory spaces, members, albums, memories, media, tags,
-- timeline events, locations, favorites, letters, special dates,
-- birthday experiences, user preferences, memory views, comments, reactions.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. memory_spaces — the shared friendship space (one per friendship)
-- ----------------------------------------------------------------------------
create table memory_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'House of Memories',
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- 2. space_members — membership in a memory space (exactly 2 members in v1)
-- ----------------------------------------------------------------------------
create table space_members (
  space_id uuid not null references memory_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('creator', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. albums — collections of memories
-- ----------------------------------------------------------------------------
create table albums (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  title text not null,
  description text,
  cover_memory_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. memories — core memory records
-- ----------------------------------------------------------------------------
create table memories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  album_id uuid references albums(id) on delete set null,
  created_by uuid not null references auth.users(id),
  title text,
  caption text,
  captured_at timestamptz,
  is_favorite boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. memory_media — original files + derivatives
-- ----------------------------------------------------------------------------
create table memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references memories(id) on delete cascade,
  storage_path text not null unique,
  bucket text not null default 'memories',
  thumbnail_path text,
  media_type text not null
    check (media_type in ('image', 'video', 'audio')),
  mime_type text not null,
  file_size bigint not null,
  width integer,
  height integer,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. tags — reusable labels within a space
-- ----------------------------------------------------------------------------
create table tags (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (space_id, name)
);

-- ----------------------------------------------------------------------------
-- 7. memory_tags — many-to-many memory <-> tag
-- ----------------------------------------------------------------------------
create table memory_tags (
  memory_id uuid not null references memories(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (memory_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- 8. timeline_events — friendship milestones
-- ----------------------------------------------------------------------------
create table timeline_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  cover_memory_id uuid references memories(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. memory_locations — geographic information for memories
-- ----------------------------------------------------------------------------
create table memory_locations (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references memories(id) on delete cascade,
  place_name text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  date_visited date,
  description text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10. memory_favorites — per-user favorite bookmarks
-- ----------------------------------------------------------------------------
create table memory_favorites (
  memory_id uuid not null references memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (memory_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 11. memory_comments — notes attached to memories
-- ----------------------------------------------------------------------------
create table memory_comments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 12. memory_reactions — lightweight reactions (heart, smile, etc.)
-- ----------------------------------------------------------------------------
create table memory_reactions (
  memory_id uuid not null references memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  primary key (memory_id, user_id, reaction)
);

-- ----------------------------------------------------------------------------
-- 13. letters — "Open When" private letters
-- ----------------------------------------------------------------------------
create table letters (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  content text not null,
  illustration_style text default 'envelope',
  unlock_at timestamptz,
  is_locked boolean not null default true,
  editable_by_recipient boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 14. letter_media — optional media attached to letters
-- ----------------------------------------------------------------------------
create table letter_media (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references letters(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'audio')),
  mime_type text not null,
  file_size bigint not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 15. special_dates — countdowns and important occasions
-- ----------------------------------------------------------------------------
create table special_dates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  title text not null,
  event_date date not null,
  recurrence text not null default 'none'
    check (recurrence in ('none', 'yearly', 'monthly')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 16. birthday_experiences — configurable birthday reveal
-- ----------------------------------------------------------------------------
create table birthday_experiences (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  title text not null,
  config jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  preview_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 17. user_preferences — per-user settings
-- ----------------------------------------------------------------------------
create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dreamy',
  sound_enabled boolean not null default true,
  volume numeric not null default 0.7 check (volume >= 0 and volume <= 1),
  mute boolean not null default false,
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 18. memory_views — view history (used by Memory Lane to avoid repetition)
-- ----------------------------------------------------------------------------
create table memory_views (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 19. activity_events — shared activity history (feed-like, internal only)
-- ----------------------------------------------------------------------------
create table activity_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references memory_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 20. upload_jobs — tracking processing state for uploads
-- ----------------------------------------------------------------------------
create table upload_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  file_name text,
  storage_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================
create index idx_memories_space_id on memories(space_id);
create index idx_memories_created_by on memories(created_by);
create index idx_memories_album_id on memories(album_id);
create index idx_memories_captured_at on memories(captured_at);
create index idx_memories_created_at on memories(created_at);
create index idx_memories_deleted_at on memories(deleted_at);

create index idx_memory_media_memory_id on memory_media(memory_id);
create index idx_memory_media_storage_path on memory_media(storage_path);

create index idx_albums_space_id on albums(space_id);
create index idx_albums_created_by on albums(created_by);

create index idx_tags_space_id on tags(space_id);

create index idx_timeline_events_space_id on timeline_events(space_id);
create index idx_timeline_events_event_date on timeline_events(event_date);

create index idx_memory_locations_memory_id on memory_locations(memory_id);

create index idx_memory_favorites_user_id on memory_favorites(user_id);
create index idx_memory_favorites_memory_id on memory_favorites(memory_id);

create index idx_memory_comments_memory_id on memory_comments(memory_id);
create index idx_memory_comments_user_id on memory_comments(user_id);

create index idx_letters_space_id on letters(space_id);
create index idx_letters_created_by on letters(created_by);
create index idx_letters_unlock_at on letters(unlock_at);

create index idx_special_dates_space_id on special_dates(space_id);
create index idx_special_dates_event_date on special_dates(event_date);

create index idx_memory_views_user_id on memory_views(user_id);
create index idx_memory_views_memory_id on memory_views(memory_id);

create index idx_activity_events_space_id on activity_events(space_id);
create index idx_activity_events_created_at on activity_events(created_at);

create index idx_upload_jobs_user_id on upload_jobs(user_id);
create index idx_upload_jobs_status on upload_jobs(status);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
-- Helper: current user is a member of the given space
create or replace function is_space_member(space_id uuid)
returns boolean
language plpgsql
stable
as $$
begin
  return exists (
    select 1 from space_members sm
    where sm.space_id = is_space_member.space_id
      and sm.user_id = (select auth.uid())
  );
end;
$$;

-- Enable RLS on all user-facing tables
alter table memory_spaces enable row level security;
alter table space_members enable row level security;
alter table albums enable row level security;
alter table memories enable row level security;
alter table memory_media enable row level security;
alter table tags enable row level security;
alter table memory_tags enable row level security;
alter table timeline_events enable row level security;
alter table memory_locations enable row level security;
alter table memory_favorites enable row level security;
alter table memory_comments enable row level security;
alter table memory_reactions enable row level security;
alter table letters enable row level security;
alter table letter_media enable row level security;
alter table special_dates enable row level security;
alter table birthday_experiences enable row level security;
alter table user_preferences enable row level security;
alter table memory_views enable row level security;
alter table activity_events enable row level security;
alter table upload_jobs enable row level security;

-- ----------------------------------------------------------------------------
-- memory_spaces policies
-- ----------------------------------------------------------------------------
create policy "Members can read their memory spaces"
on memory_spaces for select
to authenticated
using (is_space_member(id));

create policy "Only creator can create memory spaces"
on memory_spaces for insert
to authenticated
with check (created_by = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- space_members policies
-- ----------------------------------------------------------------------------
create policy "Members can read space memberships"
on space_members for select
to authenticated
using (is_space_member(space_id));

create policy "Only creator can manage memberships"
on space_members for all
to authenticated
using (
  is_space_member(space_id)
  and exists (
    select 1 from space_members sm
    where sm.space_id = space_members.space_id
      and sm.user_id = (select auth.uid())
      and sm.role = 'creator'
  )
)
with check (
  is_space_member(space_id)
  and exists (
    select 1 from space_members sm
    where sm.space_id = space_members.space_id
      and sm.user_id = (select auth.uid())
      and sm.role = 'creator'
  )
);

-- ----------------------------------------------------------------------------
-- albums policies
-- ----------------------------------------------------------------------------
create policy "Members can read albums"
on albums for select
to authenticated
using (is_space_member(space_id));

create policy "Members can create albums"
on albums for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and is_space_member(space_id)
);

create policy "Members can update albums"
on albums for update
to authenticated
using (
  is_space_member(space_id)
  and (
    created_by = (select auth.uid())
    or exists (
      select 1 from space_members sm
      where sm.space_id = albums.space_id
        and sm.user_id = (select auth.uid())
        and sm.role = 'creator'
    )
  )
);

create policy "Members can delete albums"
on albums for delete
to authenticated
using (
  is_space_member(space_id)
  and (
    created_by = (select auth.uid())
    or exists (
      select 1 from space_members sm
      where sm.space_id = albums.space_id
        and sm.user_id = (select auth.uid())
        and sm.role = 'creator'
    )
  )
);

-- ----------------------------------------------------------------------------
-- memories policies
-- ----------------------------------------------------------------------------
create policy "Members can read memories"
on memories for select
to authenticated
using (is_space_member(space_id));

create policy "Members can create memories"
on memories for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and is_space_member(space_id)
);

create policy "Members can update own memories"
on memories for update
to authenticated
using (
  is_space_member(space_id)
  and (created_by = (select auth.uid()))
);

create policy "Members can soft-delete own memories"
on memories for delete
to authenticated
using (
  is_space_member(space_id)
  and (created_by = (select auth.uid()))
);

-- ----------------------------------------------------------------------------
-- memory_media policies
-- ----------------------------------------------------------------------------
create policy "Members can read memory media"
on memory_media for select
to authenticated
using (
  exists (
    select 1 from memories m
    where m.id = memory_media.memory_id
      and is_space_member(m.space_id)
  )
);

create policy "Members can create memory media"
on memory_media for insert
to authenticated
with check (
  exists (
    select 1 from memories m
    where m.id = memory_media.memory_id
      and m.created_by = (select auth.uid())
      and is_space_member(m.space_id)
  )
);

-- ----------------------------------------------------------------------------
-- tags policies
-- ----------------------------------------------------------------------------
create policy "Members can read tags"
on tags for select
to authenticated
using (is_space_member(space_id));

create policy "Members can create tags"
on tags for insert
to authenticated
with check (
  is_space_member(space_id)
);

-- ----------------------------------------------------------------------------
-- memory_tags policies
-- ----------------------------------------------------------------------------
create policy "Members can manage memory tags"
on memory_tags for all
to authenticated
using (
  exists (
    select 1 from memories m
    where m.id = memory_tags.memory_id
      and is_space_member(m.space_id)
  )
);

-- ----------------------------------------------------------------------------
-- timeline_events policies
-- ----------------------------------------------------------------------------
create policy "Members can read timeline events"
on timeline_events for select
to authenticated
using (is_space_member(space_id));

create policy "Members can create timeline events"
on timeline_events for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and is_space_member(space_id)
);

create policy "Members can update timeline events"
on timeline_events for update
to authenticated
using (
  is_space_member(space_id)
  and (
    created_by = (select auth.uid())
    or exists (
      select 1 from space_members sm
      where sm.space_id = timeline_events.space_id
        and sm.user_id = (select auth.uid())
        and sm.role = 'creator'
    )
  )
);

-- ----------------------------------------------------------------------------
-- memory_locations policies
-- ----------------------------------------------------------------------------
create policy "Members can read memory locations"
on memory_locations for select
to authenticated
using (
  exists (
    select 1 from memories m
    where m.id = memory_locations.memory_id
      and is_space_member(m.space_id)
  )
);

create policy "Members can create memory locations"
on memory_locations for insert
to authenticated
with check (
  exists (
    select 1 from memories m
    where m.id = memory_locations.memory_id
      and m.created_by = (select auth.uid())
      and is_space_member(m.space_id)
  )
);

-- ----------------------------------------------------------------------------
-- memory_favorites policies
-- ----------------------------------------------------------------------------
create policy "Users can read own favorites"
on memory_favorites for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can manage own favorites"
on memory_favorites for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- memory_comments policies
-- ----------------------------------------------------------------------------
create policy "Members can read comments on visible memories"
on memory_comments for select
to authenticated
using (
  exists (
    select 1 from memories m
    where m.id = memory_comments.memory_id
      and is_space_member(m.space_id)
  )
);

create policy "Members can create comments"
on memory_comments for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from memories m
    where m.id = memory_comments.memory_id
      and is_space_member(m.space_id)
  )
);

-- ----------------------------------------------------------------------------
-- memory_reactions policies
-- ----------------------------------------------------------------------------
create policy "Members can read reactions on visible memories"
on memory_reactions for select
to authenticated
using (
  exists (
    select 1 from memories m
    where m.id = memory_reactions.memory_id
      and is_space_member(m.space_id)
  )
);

create policy "Members can manage own reactions"
on memory_reactions for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- letters policies
-- ----------------------------------------------------------------------------
create policy "Members can read letters"
on letters for select
to authenticated
using (is_space_member(space_id));

create policy "Only creator can create letters"
on letters for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and is_space_member(space_id)
);

create policy "Only creator can update letters"
on letters for update
to authenticated
using (
  created_by = (select auth.uid())
  and is_space_member(space_id)
);

-- ----------------------------------------------------------------------------
-- letter_media policies
-- ----------------------------------------------------------------------------
create policy "Members can read letter media"
on letter_media for select
to authenticated
using (
  exists (
    select 1 from letters l
    where l.id = letter_media.letter_id
      and is_space_member(l.space_id)
  )
);

create policy "Only creator can create letter media"
on letter_media for insert
to authenticated
with check (
  exists (
    select 1 from letters l
    where l.id = letter_media.letter_id
      and l.created_by = (select auth.uid())
      and is_space_member(l.space_id)
  )
);

-- ----------------------------------------------------------------------------
-- special_dates policies
-- ----------------------------------------------------------------------------
create policy "Members can read special dates"
on special_dates for select
to authenticated
using (is_space_member(space_id));

create policy "Members can create special dates"
on special_dates for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and is_space_member(space_id)
);

-- ----------------------------------------------------------------------------
-- birthday_experiences policies
-- ----------------------------------------------------------------------------
create policy "Members can read birthday experiences"
on birthday_experiences for select
to authenticated
using (is_space_member(space_id));

create policy "Only creator can manage birthday experiences"
on birthday_experiences for all
to authenticated
using (
  exists (
    select 1 from space_members sm
    where sm.space_id = birthday_experiences.space_id
      and sm.user_id = (select auth.uid())
      and sm.role = 'creator'
  )
);

-- ----------------------------------------------------------------------------
-- user_preferences policies
-- ----------------------------------------------------------------------------
create policy "Users can read own preferences"
on user_preferences for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can manage own preferences"
on user_preferences for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- memory_views policies
-- ----------------------------------------------------------------------------
create policy "Users can manage own memory views"
on memory_views for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- activity_events policies
-- ----------------------------------------------------------------------------
create policy "Members can read activity events"
on activity_events for select
to authenticated
using (is_space_member(space_id));

create policy "Members can create activity events"
on activity_events for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and is_space_member(space_id)
);

-- ----------------------------------------------------------------------------
-- upload_jobs policies
-- ----------------------------------------------------------------------------
create policy "Users can manage own upload jobs"
on upload_jobs for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
