// ============================================================================
// House of Memories — Concurrency & Member Limit Verification Test
// ============================================================================

console.log("============================================================");
console.log("🔒 House of Memories — Concurrency & Member Limit Tests");
console.log("============================================================\n");

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

// Simulated relational space model with parent locking
class SimulatedSpaceDatabase {
  constructor() {
    this.spaces = new Map();
    this.members = [];
    this.spaceLocks = new Map(); // spaceId -> Promise chain for row locking
  }

  createSpace(id, name) {
    this.spaces.set(id, { id, name });
    this.spaceLocks.set(id, Promise.resolve());
  }

  // Simulates PostgreSQL "SELECT 1 FROM memory_spaces WHERE id = $1 FOR UPDATE"
  async acquireSpaceLock(spaceId) {
    if (!this.spaces.has(spaceId)) {
      throw new Error(`Parent memory space ${spaceId} does not exist.`);
    }

    let releaseLock;
    const nextLock = new Promise((resolve) => {
      releaseLock = resolve;
    });

    const currentLock = this.spaceLocks.get(spaceId) || Promise.resolve();
    this.spaceLocks.set(spaceId, nextLock);

    // Wait for the lock to become available
    await currentLock;
    return releaseLock;
  }

  // Atomic insert with parent lock
  async addMember(spaceId, userId, role = "member", delayMs = 10) {
    const unlock = await this.acquireSpaceLock(spaceId);

    try {
      // Simulate network / disk latency while holding the row lock
      await new Promise((r) => setTimeout(r, delayMs));

      // 1. Check duplicate user constraint
      const existingUser = this.members.find(
        (m) => m.spaceId === spaceId && m.userId === userId
      );
      if (existingUser) {
        throw new Error(`Duplicate membership: User ${userId} is already in space ${spaceId}.`);
      }

      // 2. Count existing members
      const count = this.members.filter((m) => m.spaceId === spaceId).length;
      if (count >= 2) {
        throw new Error(
          `Space limit exceeded: House of Memories spaces are strictly restricted to exactly two members (current count: ${count}).`
        );
      }

      const member = { spaceId, userId, role, joinedAt: new Date().toISOString() };
      this.members.push(member);
      return member;
    } finally {
      unlock();
    }
  }

  // Update space_id with parent lock
  async moveMember(userId, oldSpaceId, newSpaceId, delayMs = 10) {
    const unlock = await this.acquireSpaceLock(newSpaceId);
    try {
      await new Promise((r) => setTimeout(r, delayMs));
      const count = this.members.filter((m) => m.spaceId === newSpaceId).length;
      if (count >= 2) {
        throw new Error(
          `Space limit exceeded: Target space ${newSpaceId} already has 2 members.`
        );
      }
      const member = this.members.find(
        (m) => m.spaceId === oldSpaceId && m.userId === userId
      );
      if (member) member.spaceId = newSpaceId;
      return member;
    } finally {
      unlock();
    }
  }

  removeMember(spaceId, userId) {
    this.members = this.members.filter(
      (m) => !(m.spaceId === spaceId && m.userId === userId)
    );
  }
}

async function runTests() {
  const db = new SimulatedSpaceDatabase();
  const space1 = "space-alpha";
  const space2 = "space-beta";
  db.createSpace(space1, "Alex & Maya");
  db.createSpace(space2, "Solo Space");

  // Test 1: Add first member
  await db.addMember(space1, "user-alex", "creator");
  assert(db.members.filter((m) => m.spaceId === space1).length === 1, "Must have 1 member");
  console.log("✓ Test 1: First member successfully added");

  // Test 2: Add second member
  await db.addMember(space1, "user-maya", "member");
  assert(db.members.filter((m) => m.spaceId === space1).length === 2, "Must have 2 members");
  console.log("✓ Test 2: Second member successfully added");

  // Test 3: Attempt third member addition -> Must fail with limit exceeded
  let failedAsExpected = false;
  try {
    await db.addMember(space1, "user-intruder");
  } catch (err) {
    failedAsExpected = true;
    assert(err.message.includes("Space limit exceeded"), "Expected limit exceeded message");
  }
  assert(failedAsExpected, "Third member addition MUST throw limit exceeded error");
  console.log("✓ Test 3: Third member addition strictly rejected by limit constraint");

  // Test 4: Concurrent race condition test!
  // Start with a new space with 1 existing member.
  // Fire TWO SIMULTANEOUS requests to add user-2 and user-3 concurrently!
  const spaceRace = "space-race";
  db.createSpace(spaceRace, "Race Condition Test");
  await db.addMember(spaceRace, "user-race-1");

  console.log("  Executing 2 simultaneous concurrent transactions for the 2nd slot...");
  const [resA, resB] = await Promise.allSettled([
    db.addMember(spaceRace, "user-race-2", "member", 25),
    db.addMember(spaceRace, "user-race-3", "member", 25),
  ]);

  const succeededCount = [resA, resB].filter((r) => r.status === "fulfilled").length;
  const rejectedCount = [resA, resB].filter((r) => r.status === "rejected").length;

  assert(succeededCount === 1, `Exactly 1 concurrent transaction must succeed (got ${succeededCount})`);
  assert(rejectedCount === 1, `Exactly 1 concurrent transaction must be rejected (got ${rejectedCount})`);
  assert(
    db.members.filter((m) => m.spaceId === spaceRace).length === 2,
    "Final space membership MUST NOT exceed 2 under concurrent writes"
  );
  console.log("✓ Test 4: Row-level lock serialized concurrent transactions — race condition prevented!");

  // Test 5: Prevent moving membership into an already full space
  let moveFailed = false;
  try {
    await db.addMember(space2, "user-solo-1");
    // space1 is full (2 members: alex & maya). Try to move user-solo-1 into space1:
    await db.moveMember("user-solo-1", space2, space1);
  } catch (err) {
    moveFailed = true;
    assert(err.message.includes("Space limit exceeded"), "Expected limit exceeded on move");
  }
  assert(moveFailed, "Moving into a full space MUST be rejected");
  console.log("✓ Test 5: UPDATE space_id into full space rejected");

  // Test 6: Removal workflow works cleanly and allows new member
  db.removeMember(space1, "user-maya");
  assert(db.members.filter((m) => m.spaceId === space1).length === 1, "Must have 1 member after removal");
  await db.addMember(space1, "user-replacement");
  assert(db.members.filter((m) => m.spaceId === space1).length === 2, "Replacement member accepted");
  console.log("✓ Test 6: Member removal and re-fill workflow functions cleanly");

  console.log("\n============================================================");
  console.log("🎉 ALL CONCURRENCY & MEMBERSHIP CONSTRAINT TESTS PASSED!");
  console.log("============================================================\n");
}

runTests();
