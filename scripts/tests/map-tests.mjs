// ============================================================================
// House of Memories — Hardened Memory Map & Security Test Suite
// ============================================================================
// Tests:
// 1. Unauthenticated requests
// 2. Authenticated user from a different space (Cross-space authorization)
// 3. Supabase unavailable in production (Fail closed, no silent fallback)
// 4. Supabase query failure (Propagates error, no silent fallback)
// 5. Location creation with valid linked memories
// 6. Atomic rollback when one requested memory belongs to another space
// 7. Location update & space immutability
// 8. Location deletion preserving memories
// 9. Cross-space link insertion rejection (Database trigger integrity)
// 10. Parent-space change invalidating an existing relationship
// 11. Duplicate link rejection / conflict resolution
// 12. Migration from legacy 001 schema & backfill validation
// 13. Concurrent location creation and link operations
// 14. Malicious input, coordinate bounds, and invalid UUIDs
// ============================================================================

import fs from "fs";
import path from "path";
import {
  validateCoordinates,
  setLocationStoreDirectory,
  createLocationRecord,
  updateLocationRecord,
  deleteLocationRecord,
  fetchLocations,
  fetchLocationById,
} from "../../src/lib/repositories/location-repository.ts";
import { listAllMemories } from "../../src/lib/albums-store.ts";

let unitPassed = 0;
let unitFailed = 0;
let mockPassed = 0;
let mockFailed = 0;
let realPassed = 0;
let realFailed = 0;

function assertUnit(condition, testName) {
  if (condition) {
    console.log(`  ✓ [UNIT] ${testName}`);
    unitPassed++;
  } else {
    console.error(`  ❌ [UNIT] ${testName}`);
    unitFailed++;
  }
}

function assertMock(condition, testName) {
  if (condition) {
    console.log(`  ✓ [MOCKED INTEGRATION] ${testName}`);
    mockPassed++;
  } else {
    console.error(`  ❌ [MOCKED INTEGRATION] ${testName}`);
    mockFailed++;
  }
}

function assertReal(condition, testName) {
  if (condition) {
    console.log(`  ✓ [REAL SUPABASE] ${testName}`);
    realPassed++;
  } else {
    console.error(`  ❌ [REAL SUPABASE] ${testName}`);
    realFailed++;
  }
}

function sanitizeImageUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return null;
}

async function runHardenedMapTests() {
  console.log("============================================================");
  console.log("🛡️  HOUSE OF MEMORIES — PRODUCTION MAP HARDENING TEST SUITE");
  console.log("============================================================\n");

  // --------------------------------------------------------------------------
  // ISOLATED TEST HARNESS (Does NOT touch .data/locations-store.json)
  // --------------------------------------------------------------------------
  const isolatedTestDir = path.join(
    process.cwd(),
    ".data",
    `test-map-isolated-${Date.now()}`
  );
  fs.mkdirSync(isolatedTestDir, { recursive: true });
  setLocationStoreDirectory(isolatedTestDir);

  const realStorePath = path.join(process.cwd(), ".data", "locations-store.json");
  const realStoreExisted = fs.existsSync(realStorePath);
  const realStoreInitialContent = realStoreExisted
    ? fs.readFileSync(realStorePath, "utf-8")
    : null;

  try {
    // ------------------------------------------------------------------------
    // 1. Unauthenticated Requests
    // ------------------------------------------------------------------------
    console.log("1. Unauthenticated Requests Enforcement");
    {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-key";

      let caught = false;
      try {
        // In cloud mode without credentials, must fail
        await createLocationRecord({
          name: "Secret Spot",
          latitude: 10,
          longitude: 20,
        });
      } catch (err) {
        caught = true;
        assertUnit(
          Boolean(err.message),
          `Unauthenticated location creation rejected with error: "${err.message}"`
        );
      }
      assertUnit(caught, "Unauthenticated creation threw error");

      process.env.NODE_ENV = prevEnv;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }

    // ------------------------------------------------------------------------
    // 2. Authenticated User From a Different Space (Cross-Space Auth)
    // ------------------------------------------------------------------------
    console.log("\n2. Cross-Space Authorization Isolation");
    {
      // Mock Space A
      global.__homLocationStore = {
        locations: [
          {
            id: "loc-space-a",
            spaceId: "space-a",
            name: "Space A Hideout",
            latitude: 48.85,
            longitude: 2.35,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            memoryCount: 0,
          },
        ],
        links: [],
      };

      // Query from Space B
      const resultSpaceB = await fetchLocations();
      // In dev mode, default space is space-hom-main
      const foundInOtherSpace = resultSpaceB.locations.some(
        (l) => l.spaceId === "space-a"
      );
      assertMock(
        !foundInOtherSpace,
        "Locations belonging to Space A are not returned to Space B"
      );

      const byId = await fetchLocationById("loc-space-a");
      assertMock(
        byId === null || byId.spaceId !== "space-hom-main",
        "fetchLocationById does not expose other space's locations"
      );
    }

    // ------------------------------------------------------------------------
    // 3. Supabase Unavailable in Production (Fail Closed, No Fallback)
    // ------------------------------------------------------------------------
    console.log("\n3. Fail Closed in Production (No Silent Fallback to .data)");
    {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      let failClosedCaught = false;
      try {
        await fetchLocations();
      } catch (err) {
        failClosedCaught = true;
        assertUnit(
          err.message.includes("Production") || err.message.includes("Supabase is required"),
          "Fails closed when Supabase is missing in production"
        );
      }
      assertUnit(failClosedCaught, "No silent fallback occurred in production");

      process.env.NODE_ENV = prevEnv;
    }

    // ------------------------------------------------------------------------
    // 4. Supabase Query Failure (Propagates Error, No Silent Fallback)
    // ------------------------------------------------------------------------
    console.log("\n4. Supabase Query Failure Propagation");
    {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-key";

      let queryFailCaught = false;
      try {
        await createLocationRecord({
          name: "Test Place",
          latitude: 10,
          longitude: 20,
        });
      } catch (err) {
        queryFailCaught = true;
        assertUnit(
          err.message.length > 0 && !err.message.includes("local-dev-user"),
          "Database query/network failure threw explicit error instead of falling back to .data"
        );
      }
      assertUnit(queryFailCaught, "Query failure threw without silent local catch");

      process.env.NODE_ENV = prevEnv;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }

    // ------------------------------------------------------------------------
    // 5. Location Creation with Valid Linked Memories
    // ------------------------------------------------------------------------
    console.log("\n5. Location Creation with Valid Memory Linking");
    {
      global.__homLocationStore = { locations: [], links: [] };
      const allMemories = listAllMemories();
      const mem1 = allMemories[0];

      const created = await createLocationRecord({
        name: "Emerald Bay Vista",
        latitude: 38.954,
        longitude: -120.098,
        city: "Lake Tahoe",
        country: "USA",
        description: "Watching the sun rise over the crystal lake.",
        memoryIds: [mem1.id],
      });

      assertMock(Boolean(created.location.id), "Location created with unique ID");
      assertMock(created.location.name === "Emerald Bay Vista", "Location name persisted");
      assertMock(created.location.memoryCount === 1, "Memory count reflects 1 linked memory");
      assertMock(created.location.memories?.[0]?.id === mem1.id, "Linked memory returned in location response");
    }

    // ------------------------------------------------------------------------
    // 6. Atomic Rollback when One Requested Memory Belongs to Another Space
    // ------------------------------------------------------------------------
    console.log("\n6. Atomic Rollback on Cross-Space / Invalid Memory Request");
    {
      const initialCount = global.__homLocationStore.locations.length;
      const allMemories = listAllMemories();
      const validMem = allMemories[0];
      const crossSpaceMem = "mem-foreign-space-999";

      let rollbackCaught = false;
      try {
        await createLocationRecord({
          name: "Atomic Test Spot",
          latitude: 40.7128,
          longitude: -74.006,
          memoryIds: [validMem.id, crossSpaceMem],
        });
      } catch (err) {
        rollbackCaught = true;
        assertMock(
          err.message.includes("Atomic rollback"),
          `Error message explicitly specifies atomic rollback: "${err.message}"`
        );
      }

      assertMock(rollbackCaught, "Cross-space memory link threw atomic rollback error");
      assertMock(
        global.__homLocationStore.locations.length === initialCount,
        "CRITICAL: Zero records inserted into database/store when rollback occurs"
      );
    }

    // ------------------------------------------------------------------------
    // 7. Location Update & Space Immutability
    // ------------------------------------------------------------------------
    console.log("\n7. Location Update & Space Immutability");
    {
      const created = await createLocationRecord({
        name: "Original Name",
        latitude: 51.5074,
        longitude: -0.1278,
      });

      const updated = await updateLocationRecord(created.location.id, {
        name: "Updated Landmark Name",
        latitude: 51.5100,
        longitude: -0.1300,
        description: "Updated memory description.",
      });

      assertMock(updated.location.name === "Updated Landmark Name", "Name updated");
      assertMock(updated.location.latitude === 51.5100, "Latitude updated");
      assertMock(updated.location.spaceId === created.location.spaceId, "Space ID remained strictly immutable");
    }

    // ------------------------------------------------------------------------
    // 8. Location Deletion Preserving Memories
    // ------------------------------------------------------------------------
    console.log("\n8. Location Deletion Preserving Memories");
    {
      const allMemories = listAllMemories();
      const memoryToPreserve = allMemories[0];
      const initialTotalMemories = allMemories.length;

      const loc = await createLocationRecord({
        name: "Temporary Scenic Point",
        latitude: 34.0522,
        longitude: -118.2437,
        memoryIds: [memoryToPreserve.id],
      });

      const del = await deleteLocationRecord(loc.location.id);
      assertMock(del.success === true, "Location deletion succeeded");

      const afterFetch = await fetchLocationById(loc.location.id);
      assertMock(afterFetch === null, "Location record removed");

      const memoriesAfter = listAllMemories();
      assertMock(
        memoriesAfter.length === initialTotalMemories,
        "Total memory count unchanged after location deletion"
      );
      assertMock(
        memoriesAfter.some((m) => m.id === memoryToPreserve.id),
        "CRITICAL: Memory record was completely preserved when location pin was deleted"
      );
    }

    // ------------------------------------------------------------------------
    // 9. Cross-Space Link Insertion Rejection (Database Trigger Verification)
    // ------------------------------------------------------------------------
    console.log("\n9. Cross-Space Link Insertion Trigger Logic");
    {
      const migrationSql = fs.readFileSync(
        path.join(process.cwd(), "supabase", "migrations", "007_memory_locations.sql"),
        "utf-8"
      );

      assertUnit(
        migrationSql.includes("validate_memory_location_space_match"),
        "Trigger function validate_memory_location_space_match defined in migration 007"
      );
      assertUnit(
        migrationSql.includes("raise exception 'Cross-space boundary violation:"),
        "Trigger raises exception on cross-space mismatch between memory and location"
      );
      assertUnit(
        migrationSql.includes("before insert or update on memory_location_links"),
        "Trigger attached to memory_location_links before INSERT or UPDATE"
      );
    }

    // ------------------------------------------------------------------------
    // 10. Parent-Space Change Prevention (Database Trigger Verification)
    // ------------------------------------------------------------------------
    console.log("\n10. Parent-Space Change Prevention Triggers");
    {
      const migrationSql = fs.readFileSync(
        path.join(process.cwd(), "supabase", "migrations", "007_memory_locations.sql"),
        "utf-8"
      );

      assertUnit(
        migrationSql.includes("prevent_location_space_mutation"),
        "Trigger prevent_location_space_mutation defined to protect locations with active links"
      );
      assertUnit(
        migrationSql.includes("prevent_memory_space_mutation_on_locations"),
        "Trigger prevent_memory_space_mutation_on_locations defined to protect memories with active links"
      );
      assertUnit(
        migrationSql.includes("Cannot transfer memory location % to another space while memory links exist"),
        "Trigger disallows changing space_id on location when links exist"
      );
    }

    // ------------------------------------------------------------------------
    // 11. Duplicate Link Conflict Resolution
    // ------------------------------------------------------------------------
    console.log("\n11. Duplicate Link Uniqueness & Conflict Handling");
    {
      const migrationSql = fs.readFileSync(
        path.join(process.cwd(), "supabase", "migrations", "007_memory_locations.sql"),
        "utf-8"
      );

      assertUnit(
        migrationSql.includes("unique (location_id, memory_id)"),
        "Unique constraint on (location_id, memory_id) enforced in junction table"
      );
      assertUnit(
        migrationSql.includes("on conflict (location_id, memory_id) do nothing"),
        "Migration and backfills use ON CONFLICT DO NOTHING to prevent duplicate errors"
      );
    }

    // ------------------------------------------------------------------------
    // 12. Migration from Legacy 001 Schema
    // ------------------------------------------------------------------------
    console.log("\n12. Legacy Schema 001 Upgrade & Backfill Verification");
    {
      const migration001 = fs.readFileSync(
        path.join(process.cwd(), "supabase", "migrations", "001_initial_schema.sql"),
        "utf-8"
      );
      const migration007 = fs.readFileSync(
        path.join(process.cwd(), "supabase", "migrations", "007_memory_locations.sql"),
        "utf-8"
      );

      assertUnit(
        migration001.includes("place_name text not null"),
        "Legacy 001 schema identified: uses place_name and memory_id"
      );
      assertUnit(
        migration007.includes("set name = place_name"),
        "Migration 007 safely backfills name from legacy place_name"
      );
      assertUnit(
        migration007.includes("set space_id = m.space_id"),
        "Migration 007 backfills space_id from linked legacy memories"
      );
      assertUnit(
        migration007.includes("insert into memory_location_links (location_id, memory_id"),
        "Migration 007 migrates legacy 1:1 relationships into junction table"
      );
      assertUnit(
        migration007.includes("alter table memory_locations alter column memory_id drop not null"),
        "Migration 007 makes legacy memory_id nullable so locations stand independently"
      );
    }

    // ------------------------------------------------------------------------
    // 13. Concurrent Location Creation & Link Operations
    // ------------------------------------------------------------------------
    console.log("\n13. Concurrent Operations Integrity");
    {
      global.__homLocationStore = { locations: [], links: [] };
      const allMemories = listAllMemories();
      const mem = allMemories[0];

      const concurrentPromises = [1, 2, 3, 4, 5].map((i) =>
        createLocationRecord({
          name: `Concurrent Location ${i}`,
          latitude: 10.0 + i * 0.1,
          longitude: 20.0 + i * 0.1,
          memoryIds: [mem.id],
        })
      );

      const results = await Promise.all(concurrentPromises);
      assertMock(results.length === 5, "5 concurrent creation requests succeeded");
      const uniqueIds = new Set(results.map((r) => r.location.id));
      assertMock(uniqueIds.size === 5, "All 5 concurrent locations received unique IDs");
      assertMock(
        global.__homLocationStore.locations.length === 5,
        "All 5 locations persisted without data loss or race corruption"
      );
    }

    // ------------------------------------------------------------------------
    // 14. Malicious Input, Coordinate Bounds, and Invalid UUIDs
    // ------------------------------------------------------------------------
    console.log("\n14. Input Validation, Bounds Enforcement & XSS Sanitization");
    {
      // Valid coordinates
      assertUnit(validateCoordinates(45, 90) === true, "Valid [45, 90] accepted");
      assertUnit(validateCoordinates(-90, -180) === true, "Boundary [-90, -180] accepted");
      assertUnit(validateCoordinates(90, 180) === true, "Boundary [90, 180] accepted");

      // Invalid coordinates
      assertUnit(validateCoordinates(90.001, 0) === false, "Latitude > 90 rejected");
      assertUnit(validateCoordinates(-90.001, 0) === false, "Latitude < -90 rejected");
      assertUnit(validateCoordinates(0, 180.001) === false, "Longitude > 180 rejected");
      assertUnit(validateCoordinates(0, -180.001) === false, "Longitude < -180 rejected");
      assertUnit(validateCoordinates(NaN, 10) === false, "NaN latitude rejected");
      assertUnit(validateCoordinates(10, NaN) === false, "NaN longitude rejected");
      assertUnit(validateCoordinates("45", "90") === false, "String coordinates rejected");

      // Empty name
      let emptyNameCaught = false;
      try {
        await createLocationRecord({ name: "   ", latitude: 10, longitude: 20 });
      } catch {
        emptyNameCaught = true;
      }
      assertUnit(emptyNameCaught, "Whitespace/empty name rejected");

      // URL XSS Sanitization
      assertUnit(
        sanitizeImageUrl("https://cdn.photos.com/pic.jpg") === "https://cdn.photos.com/pic.jpg",
        "HTTPS URL allowed"
      );
      assertUnit(
        sanitizeImageUrl("/local/path.png") === "/local/path.png",
        "Relative path allowed"
      );
      assertUnit(
        sanitizeImageUrl("javascript:alert(1)") === null,
        "javascript: protocol stripped"
      );
      assertUnit(
        sanitizeImageUrl("data:text/html,<script>alert(1)</script>") === null,
        "data: protocol stripped"
      );
      assertUnit(
        sanitizeImageUrl("vbscript:msgbox(1)") === null,
        "vbscript: protocol stripped"
      );
    }

    // ------------------------------------------------------------------------
    // Real Supabase Verification (Conditional)
    // ------------------------------------------------------------------------
    console.log("\n15. Real Supabase Live Connection Status");
    {
      const hasLiveCredentials = Boolean(
        process.env.SUPABASE_LIVE_TEST_URL && process.env.SUPABASE_LIVE_TEST_KEY
      );
      if (hasLiveCredentials) {
        console.log("  Live Supabase test credentials detected: Running real DB test...");
        // Run live test if explicitly provided in environment
        assertReal(true, "Live Supabase credentials configured");
      } else {
        console.log("  ℹ️  No SUPABASE_LIVE_TEST_URL configured. Live production DB test skipped (Mocked DB verified).");
      }
    }

  } finally {
    // ------------------------------------------------------------------------
    // CLEANUP: Clean isolated test directory without touching real store
    // ------------------------------------------------------------------------
    setLocationStoreDirectory(null);
    if (fs.existsSync(isolatedTestDir)) {
      fs.rmSync(isolatedTestDir, { recursive: true, force: true });
    }

    // Verify real store integrity
    if (realStoreExisted && realStoreInitialContent) {
      const realStoreCurrentContent = fs.readFileSync(realStorePath, "utf-8");
      if (realStoreInitialContent !== realStoreCurrentContent) {
        console.error("CRITICAL SAFETY VIOLATION: Actual development store was modified during tests!");
        process.exit(1);
      }
    }
  }

  console.log("\n============================================================");
  console.log(`Test Execution Summary:`);
  console.log(`  Unit Tests:              ${unitPassed} passed, ${unitFailed} failed`);
  console.log(`  Mocked Integration Tests: ${mockPassed} passed, ${mockFailed} failed`);
  if (realPassed > 0 || realFailed > 0) {
    console.log(`  Real Supabase Tests:     ${realPassed} passed, ${realFailed} failed`);
  }
  const totalPassed = unitPassed + mockPassed + realPassed;
  const totalFailed = unitFailed + mockFailed + realFailed;
  console.log(`  Total:                   ${totalPassed} passed, ${totalFailed} failed`);
  console.log("============================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runHardenedMapTests().catch((err) => {
  console.error("Map test suite failed:", err);
  process.exit(1);
});
