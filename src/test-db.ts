import { initDB, list, get, create, update, del } from "./db.js";

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #fdfdfb; color: #111; }
    h1 { color: #3b82f6; }
    .card { border: 1px solid #e7e7e2; border-radius: 12px; padding: 1.5rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Hello from Leonardo!</h1>
  <div class="card">
    <p>This is a test artifact - HTML page with inline CSS.</p>
    <p id="time"></p>
  </div>
  <script>
    document.getElementById('time').textContent = 'Rendered at: ' + new Date().toLocaleString();
  <\/script>
</body>
</html>`;

const JSX_CONTENT = `function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Counter Artifact</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
}`;

async function runTests() {
  console.log("===========================================");
  console.log("  Leonardo DB - End-to-End Test Suite");
  console.log("=======================================\n");

  // init
  console.log(">> TEST: Initialize database");
  await initDB();
  console.log("  PASS\n");

  // list (initial)
  console.log(">> TEST: List artifacts (initial)");
  const initial = await list();
  console.log("  Found " + initial.length + " existing artifacts");
  console.log("  PASS\n");

  // create html
  console.log(">> TEST: Create HTML artifact");
  const htmlArt = await create({
    title: "Test HTML Artifact",
    type: "html",
    content: HTML_CONTENT,
    desc: "A test HTML page with inline CSS and JS",
    coverImg: "https://example.com/cover.png",
    category: "tutorials",
    tags: ["test", "html"],
  });
  console.log("  Id: " + htmlArt.id);
  console.log("  Word count: " + htmlArt.wordCount);
  console.log("  Read time: " + htmlArt.readTimeMin + " min");
  console.log("  Slug: " + htmlArt.slug);
  console.log("  Category: " + htmlArt.category);
  if (!htmlArt.id || htmlArt.type !== "html") throw new Error("Create HTML failed");
  if (htmlArt.wordCount <= 0) throw new Error("Word count should be > 0");
  if (htmlArt.readTimeMin <= 0) throw new Error("Read time should be > 0");
  if (htmlArt.coverImg !== "https://example.com/cover.png") throw new Error("Cover img mismatch");
  if (htmlArt.category !== "tutorials") throw new Error("Category mismatch");
  console.log("  PASS\n");

  // create jsx
  console.log(">> TEST: Create JSX artifact");
  const jsxArt = await create({
    title: "Test JSX Artifact",
    type: "jsx",
    content: JSX_CONTENT,
    desc: "A test React component",
    tags: ["test", "jsx", "react"],
  });
  console.log("  Id: " + jsxArt.id);
  console.log("  Slug: " + jsxArt.slug);
  if (jsxArt.type !== "jsx") throw new Error("Create JSX failed");
  if (jsxArt.coverImg !== "") throw new Error("Default coverImg should be empty");
  if (jsxArt.category !== "") throw new Error("Default category should be empty");
  console.log("  PASS\n");

  // list after create
  console.log(">> TEST: List artifacts (after create)");
  const afterCreate = await list();
  console.log("  Found " + afterCreate.length + " artifacts");
  if (afterCreate.length < 2) throw new Error("Should have >= 2 artifacts");
  console.log("  PASS\n");

  // get single
  console.log(">> TEST: Get single artifact");
  const fetched = await get(htmlArt.id);
  if (!fetched) throw new Error("Artifact not found");
  if (fetched.title !== "Test HTML Artifact") throw new Error("Title mismatch");
  if (!fetched.content.includes("Hello from Leonardo")) throw new Error("Content mismatch");
  if (fetched.wordCount <= 0) throw new Error("Word count missing");
  console.log("  Fetched: " + fetched.title);
  console.log("  PASS\n");

  // update
  console.log(">> TEST: Update artifact");
  const updated = await update(htmlArt.id, {
    title: "Updated HTML Artifact",
    tags: ["test", "html", "updated"],
    category: "notes",
  });
  if (!updated) throw new Error("Update returned null");
  if (updated.title !== "Updated HTML Artifact") throw new Error("Title not updated");
  if (!updated.tags.includes("updated")) throw new Error("Tags not updated");
  if (updated.category !== "notes") throw new Error("Category not updated");
  console.log("  Updated: " + updated.title);
  console.log("  PASS\n");

  // verify update
  console.log(">> TEST: Verify update persisted");
  const refetched = await get(htmlArt.id);
  if (!refetched || refetched.title !== "Updated HTML Artifact") throw new Error("Update not persisted");
  console.log("  PASS\n");

  // delete
  console.log(">> TEST: Delete artifact");
  const deleted = await del(jsxArt.id);
  if (deleted !== true) throw new Error("Delete did not return true");
  const gone = await get(jsxArt.id);
  if (gone !== null) throw new Error("Deleted artifact still exists");
  console.log("  PASS\n");

  // final list
  console.log(">> TEST: Final list");
  const finalList = await list();
  console.log("  " + finalList.length + " artifact(s) remaining");
  console.log("  PASS\n");

  // cleanup
  console.log(">> TEST: Cleanup");
  await del(htmlArt.id);
  const clean = await list();
  console.log("  " + clean.length + " artifact(s) after cleanup");
  console.log("  PASS\n");

  console.log("===========================================");
  console.log("  All tests passed!");
  console.log("=======================================\n");
}

runTests().catch((err) => {
  console.error("\nTest failed:", err);
  process.exit(1);
});
