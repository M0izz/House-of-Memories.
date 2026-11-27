-- ============================================================================
-- House of Memories — Concurrency-Safe Two-Person Space Member Limit (Migration 005)
-- ============================================================================

-- 1. Ensure explicit unique constraint on (space_id, user_id) preventing duplicate membership
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'space_members_space_user_unique'
  ) then
    alter table space_members add constraint space_members_space_user_unique unique (space_id, user_id);
  end if;
end $$;

-- 2. Concurrency-safe enforcement function using row-level locking on memory_spaces
create or replace function enforce_space_member_limit_safe()
returns trigger as $$
declare
  v_count integer;
begin
  -- If this is an UPDATE that does not change space_id, member count in the space cannot increase
  if tg_op = 'UPDATE' and old.space_id = new.space_id then
    return new;
  end if;

  -- 1. Serialize concurrent membership modifications for this space
  -- by acquiring an exclusive row-level lock on the parent memory_spaces row.
  -- Any concurrent transaction attempting to insert/update members in the same space
  -- will serialize behind this lock and observe the committed post-lock state.
  perform 1
  from memory_spaces
  where id = new.space_id
  for update;

  if not found then
    raise exception 'Parent memory space % does not exist.', new.space_id;
  end if;

  -- 2. Count existing members with exclusive lock held
  select count(*) into v_count
  from space_members
  where space_id = new.space_id
    and (tg_op = 'INSERT' or user_id <> new.user_id);

  if v_count >= 2 then
    raise exception 'Space limit exceeded: House of Memories spaces are strictly restricted to exactly two members (current count: %).', v_count;
  end if;

  return new;
end;
$$ language plpgsql;

-- 3. Trigger on both INSERT and UPDATE of space_id
drop trigger if exists trg_enforce_space_member_limit on space_members;
create trigger trg_enforce_space_member_limit
  before insert or update of space_id on space_members
  for each row execute function enforce_space_member_limit_safe();
