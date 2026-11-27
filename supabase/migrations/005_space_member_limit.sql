-- ============================================================================
-- House of Memories — Atomic Two-Person Space Member Limit (Migration 005)
-- ============================================================================

-- Function to atomically enforce that a space never exceeds two members
create or replace function check_space_member_limit()
returns trigger as $$
declare
  member_count integer;
begin
  select count(*) into member_count
  from space_members
  where space_id = new.space_id;

  if member_count >= 2 then
    raise exception 'Space limit exceeded: House of Memories is restricted to exactly two members per space.';
  end if;

  return new;
end;
$$ language plpgsql;

-- Trigger firing before insert on space_members
drop trigger if exists trg_enforce_space_member_limit on space_members;
create trigger trg_enforce_space_member_limit
  before insert on space_members
  for each row execute function check_space_member_limit();
