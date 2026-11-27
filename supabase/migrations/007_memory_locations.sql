-- ============================================================================
-- House of Memories — Memory Locations & Geographic Footprints (Migration 007)
-- ============================================================================
-- Comprehensive, idempotent migration supporting:
-- 1. Upgrade from legacy 001 schema (with safe backfill of legacy relationships)
-- 2. Fresh deployment from scratch
-- 3. Strict coordinate bounds, foreign keys, and indexes
-- 4. Cross-space integrity triggers (preventing cross-space links & parent mutations)
-- 5. Row Level Security policies enforcing space membership
-- 6. Atomic RPC functions for single-transaction location & memory linking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema Upgrades & Column Additions
-- ----------------------------------------------------------------------------
do $$
begin
  -- If table does not exist, create it with full modern definition
  if not exists (select 1 from information_schema.tables where table_name = 'memory_locations') then
    create table memory_locations (
      id uuid primary key default gen_random_uuid(),
      space_id uuid references memory_spaces(id) on delete cascade,
      name text,
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
    -- If upgrading from 001, add missing columns safely
    alter table memory_locations add column if not exists space_id uuid references memory_spaces(id) on delete cascade;
    alter table memory_locations add column if not exists name text;
    alter table memory_locations add column if not exists address text;
    alter table memory_locations add column if not exists city text;
    alter table memory_locations add column if not exists region text;
    alter table memory_locations add column if not exists country text;
    alter table memory_locations add column if not exists created_by uuid references auth.users(id) on delete set null;
    alter table memory_locations add column if not exists updated_at timestamptz not null default now();

    -- If memory_id exists (from 001), ensure it is nullable so locations can exist independently
    if exists (select 1 from information_schema.columns where table_name = 'memory_locations' and column_name = 'memory_id') then
      alter table memory_locations alter column memory_id drop not null;
    end if;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Junction Table: memory_location_links
-- ----------------------------------------------------------------------------
create table if not exists memory_location_links (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references memory_locations(id) on delete cascade,
  memory_id uuid not null references memories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (location_id, memory_id)
);

-- ----------------------------------------------------------------------------
-- 3. Legacy Data Backfill & Compatibility Resolution
-- ----------------------------------------------------------------------------
do $$
begin
  -- A. Populate 'name' from legacy 'place_name' if name is null
  if exists (select 1 from information_schema.columns where table_name = 'memory_locations' and column_name = 'place_name') then
    update memory_locations
    set name = place_name
    where name is null and place_name is not null;
  end if;

  -- Default name if still empty
  update memory_locations
  set name = 'Unnamed Location'
  where name is null or trim(name) = '';

  -- B. Backfill 'space_id' from linked legacy memories if memory_id column exists
  if exists (select 1 from information_schema.columns where table_name = 'memory_locations' and column_name = 'memory_id') then
    update memory_locations ml
    set space_id = m.space_id
    from memories m
    where ml.space_id is null
      and ml.memory_id is not null
      and m.id = ml.memory_id;

    -- C. Migrate legacy 1-to-1 memory links into memory_location_links without duplicate conflicts
    insert into memory_location_links (location_id, memory_id, created_at)
    select ml.id, ml.memory_id, ml.created_at
    from memory_locations ml
    where ml.memory_id is not null
      and exists (select 1 from memories m where m.id = ml.memory_id)
    on conflict (location_id, memory_id) do nothing;
  end if;

  -- D. Enforce NOT NULL constraints only if all records have been safely resolved
  if not exists (select 1 from memory_locations where space_id is null) then
    alter table memory_locations alter column space_id set not null;
  else
    raise notice 'Warning: Some memory_locations records have null space_id and were not set to NOT NULL.';
  end if;

  if not exists (select 1 from memory_locations where name is null) then
    alter table memory_locations alter column name set not null;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Constraints & Indexes
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_memory_locations_coordinates') then
    alter table memory_locations
      add constraint chk_memory_locations_coordinates
      check (latitude >= -90.0 and latitude <= 90.0 and longitude >= -180.0 and longitude <= 180.0);
  end if;
end $$;

create index if not exists idx_memory_locations_space_id on memory_locations(space_id);
create index if not exists idx_memory_locations_created_at on memory_locations(created_at desc);
create index if not exists idx_memory_location_links_location_id on memory_location_links(location_id);
create index if not exists idx_memory_location_links_memory_id on memory_location_links(memory_id);

-- ----------------------------------------------------------------------------
-- 5. Cross-Space Boundary Enforcement Triggers
-- ----------------------------------------------------------------------------

-- Trigger A: Verify that linked memory and location belong to the exact same space
create or replace function validate_memory_location_space_match()
returns trigger as $$
declare
  v_loc_space uuid;
  v_mem_space uuid;
begin
  select space_id into v_loc_space from memory_locations where id = new.location_id;
  select space_id into v_mem_space from memories where id = new.memory_id;

  if v_loc_space is null or v_mem_space is null then
    raise exception 'Integrity violation: Location or Memory record not found.';
  end if;

  if v_loc_space <> v_mem_space then
    raise exception 'Cross-space boundary violation: Memory (%) and Location (%) belong to different memory spaces (Memory space %, Location space %).',
      new.memory_id, new.location_id, v_mem_space, v_loc_space;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_memory_location_space on memory_location_links;
create trigger trg_validate_memory_location_space
  before insert or update on memory_location_links
  for each row execute function validate_memory_location_space_match();

-- Trigger B: Prevent parent memory_locations.space_id from changing if it has active links
create or replace function prevent_location_space_mutation()
returns trigger as $$
begin
  if tg_op = 'UPDATE' and old.space_id is distinct from new.space_id then
    if exists (select 1 from memory_location_links where location_id = old.id) then
      raise exception 'Integrity violation: Cannot transfer memory location % to another space while memory links exist. Remove links first.', old.id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_location_space_mutation on memory_locations;
create trigger trg_prevent_location_space_mutation
  before update of space_id on memory_locations
  for each row execute function prevent_location_space_mutation();

-- Trigger C: Prevent memories.space_id from changing if it has active location links
create or replace function prevent_memory_space_mutation_on_locations()
returns trigger as $$
begin
  if tg_op = 'UPDATE' and old.space_id is distinct from new.space_id then
    if exists (select 1 from memory_location_links where memory_id = old.id) then
      raise exception 'Integrity violation: Cannot transfer memory % to another space while location links exist. Remove links first.', old.id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_memory_space_mutation_on_locations on memories;
create trigger trg_prevent_memory_space_mutation_on_locations
  before update of space_id on memories
  for each row execute function prevent_memory_space_mutation_on_locations();

-- ----------------------------------------------------------------------------
-- 6. Row Level Security Policies
-- ----------------------------------------------------------------------------
alter table memory_locations enable row level security;
alter table memory_location_links enable row level security;

-- Policies for memory_locations
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
  )
  with check (
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

-- Policies for memory_location_links
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
      join memories m on m.id = memory_location_links.memory_id
      join space_members sm on sm.space_id = ml.space_id
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

-- ----------------------------------------------------------------------------
-- 7. Atomic RPC Functions (Single-Transaction Creation & Updates)
-- ----------------------------------------------------------------------------

-- A. Atomic Location Creation with Verified Memory Linking
create or replace function create_location_atomic(
  p_space_id uuid,
  p_name text,
  p_latitude double precision,
  p_longitude double precision,
  p_address text default null,
  p_city text default null,
  p_region text default null,
  p_country text default null,
  p_description text default null,
  p_memory_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_new_location memory_locations;
  v_valid_memories_count integer;
  v_requested_memories_count integer;
  v_result jsonb;
begin
  -- 1. Verify authenticated caller
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required: User must be signed in to create locations.';
  end if;

  -- 2. Verify caller belongs to target memory space
  if not exists (
    select 1 from space_members
    where space_id = p_space_id and user_id = v_user_id
  ) then
    raise exception 'Unauthorized: Caller is not a member of memory space %.', p_space_id;
  end if;

  -- 3. Validate coordinates
  if p_latitude is null or p_longitude is null or
     p_latitude < -90.0 or p_latitude > 90.0 or
     p_longitude < -180.0 or p_longitude > 180.0 then
    raise exception 'Invalid coordinates: Latitude must be between -90 and 90, longitude between -180 and 180.';
  end if;

  -- 4. Validate name
  if p_name is null or trim(p_name) = '' then
    raise exception 'Validation failed: Location name cannot be empty.';
  end if;

  -- 5. Atomically validate that ALL requested memories belong to the exact same space
  if p_memory_ids is not null and array_length(p_memory_ids, 1) > 0 then
    v_requested_memories_count := array_length(p_memory_ids, 1);

    select count(distinct id) into v_valid_memories_count
    from memories
    where id = any(p_memory_ids)
      and space_id = p_space_id
      and deleted_at is null;

    if v_valid_memories_count <> v_requested_memories_count then
      raise exception 'Atomic rollback: One or more requested memories (% of % found) do not exist or belong to a different memory space.',
        v_valid_memories_count, v_requested_memories_count;
    end if;
  end if;

  -- 6. Insert Location record
  insert into memory_locations (
    space_id,
    name,
    latitude,
    longitude,
    address,
    city,
    region,
    country,
    description,
    created_by,
    created_at,
    updated_at
  ) values (
    p_space_id,
    trim(p_name),
    p_latitude,
    p_longitude,
    nullif(trim(p_address), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_region), ''),
    nullif(trim(p_country), ''),
    nullif(trim(p_description), ''),
    v_user_id,
    now(),
    now()
  ) returning * into v_new_location;

  -- 7. Insert Links in same transaction
  if p_memory_ids is not null and array_length(p_memory_ids, 1) > 0 then
    insert into memory_location_links (location_id, memory_id, created_at)
    select v_new_location.id, unnest(p_memory_ids), now();
  end if;

  -- 8. Return committed record
  select jsonb_build_object(
    'id', v_new_location.id,
    'spaceId', v_new_location.space_id,
    'name', v_new_location.name,
    'latitude', v_new_location.latitude,
    'longitude', v_new_location.longitude,
    'address', v_new_location.address,
    'city', v_new_location.city,
    'region', v_new_location.region,
    'country', v_new_location.country,
    'description', v_new_location.description,
    'createdBy', v_new_location.created_by,
    'createdAt', v_new_location.created_at,
    'updatedAt', v_new_location.updated_at,
    'memoryCount', coalesce(array_length(p_memory_ids, 1), 0)
  ) into v_result;

  return v_result;
end;
$$;

-- B. Atomic Location Update with Memory Link Synchronization
create or replace function update_location_atomic(
  p_location_id uuid,
  p_name text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_address text default null,
  p_city text default null,
  p_region text default null,
  p_country text default null,
  p_description text default null,
  p_memory_ids uuid[] default null,
  p_sync_memories boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existing memory_locations;
  v_valid_memories_count integer;
  v_requested_memories_count integer;
  v_final_mem_count integer;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required: User must be signed in to update locations.';
  end if;

  -- 1. Fetch location
  select * into v_existing from memory_locations where id = p_location_id;
  if not found then
    raise exception 'Location not found: %', p_location_id;
  end if;

  -- 2. Verify caller space membership
  if not exists (
    select 1 from space_members
    where space_id = v_existing.space_id and user_id = v_user_id
  ) then
    raise exception 'Unauthorized: Caller is not a member of the location memory space.';
  end if;

  -- 3. Validate coordinates if provided
  if p_latitude is not null and (p_latitude < -90.0 or p_latitude > 90.0) then
    raise exception 'Invalid latitude: Must be between -90 and 90.';
  end if;
  if p_longitude is not null and (p_longitude < -180.0 or p_longitude > 180.0) then
    raise exception 'Invalid longitude: Must be between -180 and 180.';
  end if;

  -- 4. Validate memory links if syncing
  if p_sync_memories and p_memory_ids is not null then
    v_requested_memories_count := array_length(p_memory_ids, 1);
    if v_requested_memories_count > 0 then
      select count(distinct id) into v_valid_memories_count
      from memories
      where id = any(p_memory_ids)
        and space_id = v_existing.space_id
        and deleted_at is null;

      if v_valid_memories_count <> v_requested_memories_count then
        raise exception 'Atomic rollback: One or more requested memories do not belong to the location space.';
      end if;
    end if;

    -- Replace links atomically
    delete from memory_location_links where location_id = p_location_id;
    if v_requested_memories_count > 0 then
      insert into memory_location_links (location_id, memory_id, created_at)
      select p_location_id, unnest(p_memory_ids), now();
    end if;
  end if;

  -- 5. Update location record
  update memory_locations
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    latitude = coalesce(p_latitude, latitude),
    longitude = coalesce(p_longitude, longitude),
    address = case when p_address is not null then nullif(trim(p_address), '') else address end,
    city = case when p_city is not null then nullif(trim(p_city), '') else city end,
    region = case when p_region is not null then nullif(trim(p_region), '') else region end,
    country = case when p_country is not null then nullif(trim(p_country), '') else country end,
    description = case when p_description is not null then nullif(trim(p_description), '') else description end,
    updated_at = now()
  where id = p_location_id
  returning * into v_existing;

  select count(*) into v_final_mem_count
  from memory_location_links
  where location_id = p_location_id;

  select jsonb_build_object(
    'id', v_existing.id,
    'spaceId', v_existing.space_id,
    'name', v_existing.name,
    'latitude', v_existing.latitude,
    'longitude', v_existing.longitude,
    'address', v_existing.address,
    'city', v_existing.city,
    'region', v_existing.region,
    'country', v_existing.country,
    'description', v_existing.description,
    'createdBy', v_existing.created_by,
    'createdAt', v_existing.created_at,
    'updatedAt', v_existing.updated_at,
    'memoryCount', v_final_mem_count
  ) into v_result;

  return v_result;
end;
$$;

-- Grant execution to authenticated users
grant execute on function create_location_atomic to authenticated;
grant execute on function update_location_atomic to authenticated;
