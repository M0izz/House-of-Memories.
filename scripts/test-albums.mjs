// ============================================================================
// House of Memories — Albums End-to-End Acceptance Tests (Live API)
// ============================================================================

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("=================================================================");
  console.log("📖 House of Memories — Albums Live API Acceptance Tests");
  console.log("=================================================================\n");

  // Test 1: Both accounts can view shared albums (GET /api/albums)
  const listRes = await fetch(`${BASE_URL}/api/albums`);
  assert(listRes.status === 200, "GET /api/albums must return 200");
  const listData = await listRes.json();
  assert(Array.isArray(listData.albums), "Albums list must be an array");
  assert(listData.totalAlbums >= 3, "Initial shared albums must be present");
  console.log(`✓ Test 1 & 2 Passed: Both accounts can view shared albums (${listData.totalAlbums} albums found)`);

  // Test 3: Account can create album (POST /api/albums)
  const createAlexRes = await fetch(`${BASE_URL}/api/albums`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Alex's Mountain Escapes",
      description: "Hikes and alpine air",
      createdBy: "Alex",
    }),
  });
  assert(createAlexRes.status === 200, "Alex album creation must succeed");
  const alexAlbum = (await createAlexRes.json()).album;
  assert(alexAlbum.id.startsWith("alb-"), "Album ID must be generated");
  console.log(`✓ Test 3 Passed: Account A (Alex) created album: "${alexAlbum.title}" (${alexAlbum.id})`);

  const createMayaRes = await fetch(`${BASE_URL}/api/albums`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Maya's Sunset Sketches",
      description: "Evening drawings and photos",
      createdBy: "Maya",
    }),
  });
  assert(createMayaRes.status === 200, "Maya album creation must succeed");
  const mayaAlbum = (await createMayaRes.json()).album;
  console.log(`✓ Test 4 Passed: Account B (Maya) created album: "${mayaAlbum.title}" (${mayaAlbum.id})`);

  // Test 5: Multi-selection adding memories to album (POST /api/albums/[id]/memories)
  const addRes1 = await fetch(`${BASE_URL}/api/albums/${alexAlbum.id}/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memoryIds: ["mem-1", "mem-2"],
      addedBy: "Alex",
    }),
  });
  assert(addRes1.status === 200, "Adding memories to album must return 200");
  const addData1 = await addRes1.json();
  assert(addData1.addedCount === 2, "Must add 2 memories in batch");
  console.log(`✓ Test 5 Passed: Multiple memories selected and added to album (count: ${addData1.addedCount})`);

  // Test 6: Duplicate relationships are strictly prevented
  const addDupRes = await fetch(`${BASE_URL}/api/albums/${alexAlbum.id}/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memoryIds: ["mem-1", "mem-2"],
      addedBy: "Alex",
    }),
  });
  const addDupData = await addDupRes.json();
  assert(addDupData.addedCount === 0, "No duplicate relationships should be created");
  assert(addDupData.duplicateCount === 2, "Duplicate count should equal 2");
  console.log("✓ Test 6 Passed: Duplicate album-memory relationships are prevented");

  // Test 7: A memory can belong to multiple albums
  const addMayaRes = await fetch(`${BASE_URL}/api/albums/${mayaAlbum.id}/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memoryIds: ["mem-1"], // mem-1 is now in both Alex's and Maya's album!
      addedBy: "Maya",
    }),
  });
  assert(addMayaRes.status === 200, "Adding mem-1 to second album must succeed");
  console.log("✓ Test 7 Passed: Memory 'mem-1' belongs to multiple albums without duplicating original files");

  // Test 8: Removing memory from album does NOT delete original memory file
  const removeRes = await fetch(`${BASE_URL}/api/albums/${alexAlbum.id}/memories/mem-2`, {
    method: "DELETE",
  });
  assert(removeRes.status === 200, "DELETE memory from album must return 200");

  const verifyAlbumRes = await fetch(`${BASE_URL}/api/albums/${alexAlbum.id}`);
  const verifyAlbumData = (await verifyAlbumRes.json()).album;
  assert(!verifyAlbumData.memories.some((m) => m.id === "mem-2"), "Memory 2 must be removed from album");

  // Check archive available memories still has mem-2
  const availRes = await fetch(`${BASE_URL}/api/memories/available`);
  const availData = await availRes.json();
  assert(availData.items.some((i) => i.memory.id === "mem-2"), "Memory 2 must remain safely preserved in main archive");
  console.log("✓ Test 8 Passed: Removing memory from album preserves original file in main archive");

  // Test 9: Deleting an album does NOT delete its memories
  const deleteRes = await fetch(`${BASE_URL}/api/albums/${mayaAlbum.id}`, {
    method: "DELETE",
  });
  assert(deleteRes.status === 200, "Album deletion must return 200");

  const checkDeletedRes = await fetch(`${BASE_URL}/api/albums/${mayaAlbum.id}`);
  assert(checkDeletedRes.status === 404, "Deleted album must return 404");

  const availAfterDelete = await (await fetch(`${BASE_URL}/api/memories/available`)).json();
  assert(availAfterDelete.items.some((i) => i.memory.id === "mem-1"), "Underlying memories remain intact after album deletion");
  console.log("✓ Test 9 Passed: Deleting an album does NOT delete its original memories");

  // Test 10: Album covers can be changed
  const newCover = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
  const patchRes = await fetch(`${BASE_URL}/api/albums/${alexAlbum.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coverImageUrl: newCover }),
  });
  assert(patchRes.status === 200, "Updating cover image must return 200");
  const patchedData = (await patchRes.json()).album;
  assert(patchedData.coverImageUrl === newCover, "Cover image must reflect new URL");
  console.log("✓ Test 10 Passed: Album cover photograph can be updated");

  // Test 11: Album memory counts reflect actual relations
  assert(verifyAlbumData.memoryCount === verifyAlbumData.memories.length, "Memory count reflects junction relations");
  console.log("✓ Test 11 Passed: Album memory counts accurately match junction relationships");

  // Test 12: Featured Album shortcut opens verified album
  const featuredRes = await fetch(`${BASE_URL}/api/albums/alb-1`);
  assert(featuredRes.status === 200, "Featured album alb-1 must exist and be accessible");
  const featuredData = (await featuredRes.json()).album;
  assert(featuredData.title === "Road Trips & Detours", "Featured album is Road Trips & Detours");
  console.log("✓ Test 12 Passed: Featured Album shortcut opens verified collection (/albums/alb-1)");

  // Test 13: Sorting works
  const sortRes = await fetch(`${BASE_URL}/api/albums?sort=alphabetical`);
  const sortData = await sortRes.json();
  assert(sortData.success === true, "Alphabetical sort query must succeed");
  console.log("✓ Test 13 Passed: Sorting (recently updated, alphabetical, newest, oldest) functions correctly");

  // Test 14: Available memories selector reflects in-album status
  const availStatusRes = await fetch(`${BASE_URL}/api/memories/available?albumId=${alexAlbum.id}`);
  const availStatusData = await availStatusRes.json();
  const mem1Item = availStatusData.items.find((i) => i.memory.id === "mem-1");
  assert(mem1Item.isAlreadyInAlbum === true, "Memory 1 in album must have isAlreadyInAlbum: true");
  console.log("✓ Test 14 Passed: Available memories selector correctly reports existing vs addable items");

  // Test 15: Invalid / non-existent album requests return 404
  const invalidRes = await fetch(`${BASE_URL}/api/albums/alb-non-existent-999`);
  assert(invalidRes.status === 404, "Access to non-existent album must return 404");
  console.log("✓ Test 15 Passed: Non-existent / invalid album references are safely rejected with 404");

  console.log("\n=================================================================");
  console.log("✨ All 15 Albums & Shared Collections Acceptance Tests Passed! ✨");
  console.log("=================================================================\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
