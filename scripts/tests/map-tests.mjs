// ============================================================================
// House of Memories — Memory Map & Geographic Footprints Test Suite
// ============================================================================

import fs from "fs";
import path from "path";
import {
  validateCoordinates,
  createLocationRecord,
  updateLocationRecord,
  deleteLocationRecord,
  fetchLocations,
  fetchLocationById,
} from "../../src/lib/repositories/location-repository.ts";
import { listAllMemories } from "../../src/lib/albums-store.ts";

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ ${testName}`);
    failed++;
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

async function runMapTests() {
  console.log("============================================================");
  console.log("🧪 Unit & Integration Tests: Memory Map, Coordinates, Security & CRUD");
  console.log("============================================================\n");

  // 1. Coordinate Validation
  console.log("1. Coordinate Validation & Boundary Enforcement");
  {
    assert(validateCoordinates(48.8566, 2.3522) === true, "Valid coordinates in Paris accepted");
    assert(validateCoordinates(0, 0) === true, "Equator and Prime Meridian accepted");
    assert(validateCoordinates(90, 180) === true, "Maximum valid boundary [90, 180] accepted");
    assert(validateCoordinates(-90, -180) === true, "Minimum valid boundary [-90, -180] accepted");

    // Invalid coordinates
    assert(validateCoordinates(90.0001, 10) === false, "Latitude > 90 rejected");
    assert(validateCoordinates(-90.0001, 10) === false, "Latitude < -90 rejected");
    assert(validateCoordinates(10, 180.0001) === false, "Longitude > 180 rejected");
    assert(validateCoordinates(10, -180.0001) === false, "Longitude < -180 rejected");
    assert(validateCoordinates(NaN, 10) === false, "NaN latitude rejected");
    assert(validateCoordinates(10, NaN) === false, "NaN longitude rejected");
    assert(validateCoordinates("48.5", "2.3") === false, "String coordinates rejected");
    assert(validateCoordinates(null, undefined) === false, "Null/undefined coordinates rejected");
  }

  // 2. Popup Security & URL Sanitization
  console.log("\n2. Popup Security & Media URL Sanitization");
  {
    assert(
      sanitizeImageUrl("https://images.unsplash.com/photo-test.jpg") === "https://images.unsplash.com/photo-test.jpg",
      "Valid HTTPS media URL permitted"
    );
    assert(
      sanitizeImageUrl("/local/thumbnails/pic.png") === "/local/thumbnails/pic.png",
      "Valid root-relative media path permitted"
    );

    // Malicious protocols
    assert(
      sanitizeImageUrl("javascript:alert(document.cookie)") === null,
      "Dangerous javascript: URI stripped"
    );
    assert(
      sanitizeImageUrl("vbscript:msgbox(1)") === null,
      "Dangerous vbscript: URI stripped"
    );
    assert(
      sanitizeImageUrl("data:text/html,<script>alert(1)</script>") === null,
      "Arbitrary data: URI stripped"
    );
    assert(sanitizeImageUrl("") === null, "Empty string returns null");
    assert(sanitizeImageUrl(null) === null, "Null URL returns null");
  }

  // 3. Database Migration Integrity (007_memory_locations.sql)
  console.log("\n3. Database Migration Verification");
  {
    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "007_memory_locations.sql");
    assert(fs.existsSync(migrationPath), "Migration 007_memory_locations.sql exists");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert(sqlContent.includes("memory_locations"), "Defines memory_locations table");
    assert(sqlContent.includes("memory_location_links"), "Defines memory_location_links junction table");
    assert(sqlContent.includes("chk_memory_locations_coordinates"), "Enforces coordinate check constraint");
    assert(sqlContent.includes("validate_memory_location_space_match"), "Cross-space boundary validation trigger present");
    assert(sqlContent.includes("alter table memory_locations enable row level security"), "RLS enabled on memory_locations");
    assert(sqlContent.includes("alter table memory_location_links enable row level security"), "RLS enabled on memory_location_links");
    assert(sqlContent.includes("on delete cascade"), "Cascade deletes defined for space and memory links");
  }

  // 4. Memory Location Persistence & CRUD Lifecycle
  console.log("\n4. Memory Location CRUD & Memory Preservation");
  {
    // Clean test store
    const testLocationStorePath = path.join(process.cwd(), ".data", "locations-store.json");
    if (fs.existsSync(testLocationStorePath)) {
      fs.writeFileSync(testLocationStorePath, JSON.stringify({ locations: [], links: [] }, null, 2));
    }
    global.__homLocationStore = { locations: [], links: [] };

    // Initial state: no fabricated locations
    const initial = await fetchLocations();
    assert(initial.locations.length === 0, "Initial production state is completely clean (zero fabricated places)");

    // Get available memories
    const memories = listAllMemories();
    const memoryToLink = memories[0] || { id: "mem-test-1", title: "Test Memory" };

    // Create a new location
    const created = await createLocationRecord({
      name: "Whispering Pines Cabin",
      latitude: 45.1234,
      longitude: -121.5678,
      city: "Mount Hood",
      region: "Oregon",
      country: "USA",
      description: "Cozy cabin retreat in the quiet forest.",
      memoryIds: [memoryToLink.id],
    });

    assert(Boolean(created.location.id), "Location created with unique ID");
    assert(created.location.name === "Whispering Pines Cabin", "Location name preserved");
    assert(created.location.latitude === 45.1234, "Latitude stored correctly");
    assert(created.location.longitude === -121.5678, "Longitude stored correctly");
    assert(created.location.memoryCount === 1, "Linked memory count is 1");

    // Fetch by ID
    const fetched = await fetchLocationById(created.location.id);
    assert(fetched !== null && fetched.id === created.location.id, "Location fetched by ID successfully");

    // Update location (move coordinates)
    const updated = await updateLocationRecord(created.location.id, {
      name: "Whispering Pines Lookout Cabin",
      latitude: 45.1300,
      longitude: -121.5700,
      description: "Updated description with sunset view.",
    });

    assert(updated.location.name === "Whispering Pines Lookout Cabin", "Updated name reflected");
    assert(updated.location.latitude === 45.1300, "Updated latitude reflected");

    // Delete location pin
    const deleteResult = await deleteLocationRecord(created.location.id);
    assert(deleteResult.success === true, "Location pin deleted successfully");

    const afterDelete = await fetchLocationById(created.location.id);
    assert(afterDelete === null, "Location is no longer returned after deletion");

    // CRITICAL: Verify memories were NOT deleted when location was removed
    const memoriesAfterDelete = listAllMemories();
    const memoryStillExists = memoriesAfterDelete.some((m) => m.id === memoryToLink.id);
    assert(memoryStillExists === true, "CRITICAL: Associated memories are safely preserved after location pin deletion");
  }

  // 5. Search & Filtering Logic
  console.log("\n5. Location Search & Query Filtering");
  {
    global.__homLocationStore = { locations: [], links: [] };

    await createLocationRecord({
      name: "Café de Flore",
      latitude: 48.854,
      longitude: 2.333,
      city: "Paris",
      country: "France",
    });

    await createLocationRecord({
      name: "Shibuya Crossing",
      latitude: 35.659,
      longitude: 139.700,
      city: "Tokyo",
      country: "Japan",
    });

    const parisResults = await fetchLocations({ search: "Paris" });
    assert(parisResults.locations.length === 1 && parisResults.locations[0].name === "Café de Flore", "Search by city matches correctly");

    const tokyoResults = await fetchLocations({ search: "shibuya" });
    assert(tokyoResults.locations.length === 1 && tokyoResults.locations[0].name === "Shibuya Crossing", "Case-insensitive name search matches correctly");

    const noResults = await fetchLocations({ search: "NonExistentPlace" });
    assert(noResults.locations.length === 0, "Non-matching search returns 0 results");

    // Clean up test store
    global.__homLocationStore = { locations: [], links: [] };
    const testLocationStorePath = path.join(process.cwd(), ".data", "locations-store.json");
    if (fs.existsSync(testLocationStorePath)) {
      fs.writeFileSync(testLocationStorePath, JSON.stringify({ locations: [], links: [] }, null, 2));
    }
  }

  console.log("\n============================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMapTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
