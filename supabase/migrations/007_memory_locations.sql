-- ============================================================================
-- House of Memories — Memory Locations & Geographic Footprints (Migration 007)
-- ============================================================================
-- Enhances memory_locations and introduces memory_location_links junction table
-- for Many-to-Many linking between memories and persistent geographic places.
-- ============================================================================

-- 1. Ensure memory_locations table has all required columns and constraints
do $$
begin
  -- If table doesn't exist, create it cleanly
  if not exists (select 1 from information_schema.tables where table_name = 'memory_locations') then
    create table memory_locations (
      id uuid primary key default gen_random_uuid(),
      space_id uuid not null references memory_spaces(id) on delete cascade,
      name text not null,
      address text,
      city text,
      region text,
      country text,
      latitude double precision not null,
      longitude double precision not null,
      description text,
      created_by uuid references auth.users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  else
    -- If table was created in migration 001, add missing columns
    alter table memory_locations add column if not exists space_id uuid references memory_spaces(id) on delete cascade;
    alter table memory_locations add column if not exists name text;
    alter table memory_locations add column if not exists address text;
    alter table memory_locations add column if not exists city text;
    alter table memory_locations add column if not exists region text;
    alter table memory_locations add column if not exists country text;
    alter table memory_locations add column if not exists created_by uuid references auth.users(id) on delete set null;
    alter table memory_locations add column if not exists updated_at timestamptz not null default now();

    -- Populate name from place_name if name is null
    if exists (select 1 from information_schema.columns where table_name = 'memory_locations' and column_name = 'place_name') then
      update memory_locations set name = place_name where name is null and place_name is not null;
    end if;

    -- Make memory_id nullable if it was required in 001 (since locations now stand independently in space)
    if exists (select 1 from information_schema.columns where table_name = 'memory_locations' and column_name = 'memory_id') then
      alter table memory_locations alter column memory_id drop not null;
    end if;
  end if;
end $$;

-- Enforce coordinate bounds
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_memory_locations_coordinates') then
    alter table memory_locations
      add constraint chk_memory_locations_coordinates
      check (latitude >= -90.0 and latitude <= 90.0 and longitude >= -180.0 and longitude <= 180.0);
  end if;
end $$;

-- 2. Create memory_location_links junction table for Many-to-Many associations
create table if not exists memory_location_links (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references memory_locations(id) on delete cascade,
  memory_id uuid not null references memories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (location_id, memory_id)
);

-- Indexes for performance
create index if not exists idx_memory_locations_space_id on memory_locations(space_id);
create index if not exists idx_memory_location_links_location_id on memory_location_links(location_id);
create index if not exists idx_memory_location_links_memory_id on memory_location_links(memory_id);

-- 3. Cross-space integrity validation trigger
create or replace function validate_memory_location_space_match()
returns trigger as $$
declare
  v_loc_space uuid;
  v_mem_space uuid;
begin
  select space_id into v_loc_space from memory_locations where id = new.location_id;
  select space_id into v_mem_space from memories where id = new.memory_id;

  if v_loc_space is null or v_mem_space is null or v_loc_space <> v_mem_space then
    raise exception 'Integrity violation: Memory (%) and Location (%) must belong to the exact same memory space.', new.memory_id, new.location_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_memory_location_space on memory_location_links;
create trigger trg_validate_memory_location_space
  before insert or update on memory_location_links
  for each row execute function validate_memory_location_space_match();

-- 4. Enable RLS
alter table memory_locations enable row level security;
alter table memory_location_links enable row level security;

-- 5. RLS Policies for memory_locations
drop policy if exists "Members can read memory locations" on memory_locations;
create policy "Members can read memory locations"
  on memory_locations for select
  to authenticated
  using (
    exists (
      select 1 from space_members sm
      where sm.space_id = memory_locations.space_id
      and sm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can create memory locations" on memory_locations;
create policy "Members can create memory locations"
  on memory_locations for insert
  to authenticated
  with check (
    exists (
      select 1 from space_members sm
      where sm.space_id = memory_locations.space_id
      and sm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can update memory locations" on memory_locations;
create policy "Members can update memory locations"
  on memory_locations for update
  to authenticated
  using (
    exists (
      select 1 from space_members sm
      where sm.space_id = memory_locations.space_id
      and sm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete memory locations" on memory_locations;
create policy "Members can delete memory locations"
  on memory_locations for delete
  to authenticated
  using (
    exists (
      select 1 from space_members sm
      where sm.space_id = memory_locations.space_id
      and sm.user_id = auth.uid()
    )
  );

-- 6. RLS Policies for memory_location_links
drop policy if exists "Members can read location links" on memory_location_links;
create policy "Members can read location links"
  on memory_location_links for select
  to authenticated
  using (
    exists (
      select 1 from memory_locations ml
      join space_members sm on sm.space_id = ml.space_id
      where ml.id = memory_location_links.location_id
      and sm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can create location links" on memory_location_links;
create policy "Members can create location links"
  on memory_location_links for insert
  to authenticated
  with check (
    exists (
      select 1 from memory_locations ml
      join space_members sm on sm.space_id = ml.space_id
      join memories m on m.id = memory_location_links.memory_id
      where ml.id = memory_location_links.location_id
      and m.space_id = ml.space_id
      and sm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete location links" on memory_location_links;
create policy "Members can delete location links"
  on memory_location_links for delete
  to authenticated
  using (
    exists (
      select 1 from memory_locations ml
      join space_members sm on sm.space_id = ml.space_id
      where ml.id = memory_location_links.location_id
      and sm.user_id = auth.uid()
    )
  );
