const BASE = "http://localhost:3001/api";

async function req(method: string, path: string, body?: any) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e: any) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
    process.exitCode = 1;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function run() {
  console.log("=== CRUD API Tests ===\n");

  // Health check
  const health = await req("GET", "/health");
  test("health endpoint returns ok", () => {
    assert(health.status === 200, `status ${health.status}`);
    assert(health.json.status === "ok", "status not ok");
  });

  // List (empty)
  const list0 = await req("GET", "/artifacts");
  test("list artifacts returns empty array", () => {
    assert(list0.status === 200, `status ${list0.status}`);
    assert(Array.isArray(list0.json), "should be array");
  });

  // Create HTML artifact
  const htmlContent = `<!DOCTYPE html>
<html><head><style>body{font-family:sans-serif;padding:2rem;}</style></head>
<body><h1>Hello from Leonardo!</h1><p>Test artifact.</p></body></html>`;

  const create1 = await req("POST", "/artifacts", {
    title: "Test HTML Artifact",
    type: "html",
    content: htmlContent,
    desc: "A test HTML page",
    category: "tutorials",
    tags: ["test", "html"],
  });

  let htmlId = "";
  test("create HTML artifact returns 201", () => {
    assert(create1.status === 201, `status ${create1.status}`);
    assert(create1.json.id, "should have id");
    assert(create1.json.title === "Test HTML Artifact", "title mismatch");
    assert(create1.json.type === "html", "type mismatch");
    assert(create1.json.wordCount > 0, "wordCount should be > 0");
    assert(create1.json.readTimeMin > 0, "readTimeMin should be > 0");
    htmlId = create1.json.id;
  });

  // Create JSX artifact
  const jsxContent = `import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Counter</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}

export default Counter;`;

  const create2 = await req("POST", "/artifacts", {
    title: "Test JSX Artifact",
    type: "jsx",
    content: jsxContent,
    tags: ["test", "jsx"],
  });

  let jsxId = "";
  test("create JSX artifact returns 201", () => {
    assert(create2.status === 201, `status ${create2.status}`);
    assert(create2.json.type === "jsx", "type mismatch");
    jsxId = create2.json.id;
  });

  // Validation
  const badCreate = await req("POST", "/artifacts", { title: "No type" });
  test("create without required fields returns 400", () => {
    assert(badCreate.status === 400, `status ${badCreate.status}`);
  });

  const badType = await req("POST", "/artifacts", {
    title: "Bad",
    type: "css",
    content: "x",
  });
  test("create with invalid type returns 400", () => {
    assert(badType.status === 400, `status ${badType.status}`);
  });

  // List (has items)
  const list1 = await req("GET", "/artifacts");
  test("list returns created artifacts", () => {
    assert(list1.json.length === 2, `expected 2, got ${list1.json.length}`);
  });

  // Get single
  const get1 = await req("GET", `/artifacts/${htmlId}`);
  test("get artifact returns full content", () => {
    assert(get1.status === 200, `status ${get1.status}`);
    assert(get1.json.content === htmlContent, "content mismatch");
    assert(get1.json.category === "tutorials", "category mismatch");
  });

  // Get missing
  const getMissing = await req("GET", "/artifacts/nonexistent");
  test("get missing artifact returns 404", () => {
    assert(getMissing.status === 404, `status ${getMissing.status}`);
  });

  // Update
  const update1 = await req("PUT", `/artifacts/${htmlId}`, {
    title: "Updated HTML Artifact",
    tags: ["test", "html", "updated"],
  });
  test("update artifact returns updated data", () => {
    assert(update1.status === 200, `status ${update1.status}`);
    assert(update1.json.title === "Updated HTML Artifact", "title not updated");
    assert(update1.json.tags.includes("updated"), "tags not updated");
  });

  // Verify update persisted
  const get2 = await req("GET", `/artifacts/${htmlId}`);
  test("update persists", () => {
    assert(get2.json.title === "Updated HTML Artifact", "title not persisted");
  });

  // Render HTML artifact
  const render1 = await fetch(`${BASE}/render/${htmlId}`);
  test("render HTML artifact returns HTML", () => {
    assert(render1.status === 200, `status ${render1.status}`);
    assert(render1.headers.get("content-type")?.includes("text/html") ?? false, "should be text/html");
  });

  // Render JSX artifact
  const render2 = await fetch(`${BASE}/render/${jsxId}`);
  const jsxHtml = await render2.text();
  test("render JSX artifact returns wrapped HTML with importmap", () => {
    assert(render2.status === 200, `status ${render2.status}`);
    assert(jsxHtml.includes("importmap"), "should have importmap");
    assert(jsxHtml.includes("esm.sh"), "should reference esm.sh");
  });

  // Render missing
  const renderMiss = await fetch(`${BASE}/render/nonexistent`);
  test("render missing artifact returns 404", () => {
    assert(renderMiss.status === 404, `status ${renderMiss.status}`);
  });

  // Delete
  const del1 = await req("DELETE", `/artifacts/${jsxId}`);
  test("delete returns success", () => {
    assert(del1.status === 200, `status ${del1.status}`);
    assert(del1.json.success === true, "success should be true");
  });

  // Verify deleted
  const getDeleted = await req("GET", `/artifacts/${jsxId}`);
  test("deleted artifact returns 404", () => {
    assert(getDeleted.status === 404, `status ${getDeleted.status}`);
  });

  // List after delete
  const list2 = await req("GET", "/artifacts");
  test("list after delete has 1 item", () => {
    assert(list2.json.length === 1, `expected 1, got ${list2.json.length}`);
  });

  // Cleanup
  await req("DELETE", `/artifacts/${htmlId}`);

  console.log("\n=== Done ===");
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
