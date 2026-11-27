// ============================================================================
// House of Memories — Repository Layer Integration Tests
// ============================================================================

import {
  fetchAlbums,
  fetchAlbumById,
  createAlbumRecord,
  updateAlbumRecord,
  deleteAlbumRecord,
  linkMemoriesToAlbum,
  unlinkMemoryFromAlbum,
  fetchAllMemories,
  insertMemoryRecord,
} from "../src/lib/repositories/memory-repository.ts";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log("============================================================");
console.log("📚 House of Memories — Repository CRUD & Relations Tests");
console.log("============================================================\n");

async function runRepoTests() {
  // 1. Fetch initial albums
  const initial = await fetchAlbums();
  assert(Array.isArray(initial.albums), "Albums must be an array");
  console.log(`✓ Test 1: fetchAlbums returned ${initial.albums.length} albums (totalMemories: ${initial.totalMemories})`);

  // 2. Create album record
  const { album: newAlb } = await createAlbumRecord({
    title: "Integration Test Album",
    description: "Testing repository layer CRUD",
    createdBy: "TestUser",
  });
  assert(Boolean(newAlb?.id), "Album ID must be generated");
  assert(newAlb.title === "Integration Test Album", "Album title must match");
  console.log(`✓ Test 2: createAlbumRecord created album ${newAlb.id}`);

  // 3. Update album record
  const { album: updatedAlb } = await updateAlbumRecord(newAlb.id, {
    title: "Integration Test Album (Updated)",
    isFavorite: true,
  });
  assert(updatedAlb.title === "Integration Test Album (Updated)", "Updated title must match");
  assert(updatedAlb.isFavorite === true, "isFavorite must be updated");
  console.log("✓ Test 3: updateAlbumRecord updated album successfully");

  // 4. Create a memory record
  const { memory: newMem } = await insertMemoryRecord({
    title: "Repository Test Photo",
    caption: "Verifying metadata persistence",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
    mediaType: "image",
    tag: "Integration",
  });
  assert(Boolean(newMem?.id), "Memory ID must be generated");
  console.log(`✓ Test 4: insertMemoryRecord created memory ${newMem.id}`);

  // 5. Link memory to album (Many-to-Many junction)
  const linkRes = await linkMemoriesToAlbum(newAlb.id, [newMem.id]);
  assert(linkRes.addedCount === 1, "Must add 1 memory to album");
  console.log("✓ Test 5: linkMemoriesToAlbum added memory to album");

  // 6. Duplicate link prevention
  const dupRes = await linkMemoriesToAlbum(newAlb.id, [newMem.id]);
  assert(dupRes.duplicateCount >= 1 || dupRes.addedCount === 0, "Duplicate link must be handled idempotently");
  console.log("✓ Test 6: Duplicate memory-album junction prevented");

  // 7. Verify album details include linked memory
  const { album: detailAlb } = await fetchAlbumById(newAlb.id);
  assert(detailAlb.memories.some((m) => m.id === newMem.id), "Album details must contain linked memory");
  console.log("✓ Test 7: fetchAlbumById verified many-to-many relationship");

  // 8. Unlink memory from album (leaves original memory untouched)
  const unlinkRes = await unlinkMemoryFromAlbum(newAlb.id, newMem.id);
  assert(unlinkRes.success === true, "Unlinking must succeed");
  const allMems = await fetchAllMemories();
  assert(allMems.memories.some((m) => m.id === newMem.id), "Original memory MUST remain preserved in archive");
  console.log("✓ Test 8: unlinkMemoryFromAlbum safely unlinked without deleting original memory");

  // 9. Delete album (cascades junction rows, preserves original memories)
  const delRes = await deleteAlbumRecord(newAlb.id);
  assert(delRes.success === true, "Album deletion must succeed");
  const postMems = await fetchAllMemories();
  assert(postMems.memories.some((m) => m.id === newMem.id), "Original memory MUST survive album deletion");
  console.log("✓ Test 9: deleteAlbumRecord deleted album while preserving original memories");

  console.log("\n============================================================");
  console.log("🎉 ALL REPOSITORY CRUD & RELATIONS TESTS PASSED!");
  console.log("============================================================\n");
}

runRepoTests();
