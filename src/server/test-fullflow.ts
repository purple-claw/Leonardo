const BASE = "http://localhost:3001";

async function req(method: string, path: string, body?: any) {
  const opts: RequestInit = { method };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, text };
}

function test(name: string, fn: () => void) {
  try { fn(); console.log(`  PASS  ${name}`); }
  catch (e: any) { console.log(`  FAIL  ${name}\n        ${e.message}`); process.exitCode = 1; }
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }

async function run() {
  console.log("=== Full Flow Test ===\n");

  // Clean
  const old = await req("GET", "/api/artifacts");
  if (Array.isArray(old.json)) for (const a of old.json) await req("DELETE", `/api/artifacts/${a.id}`);

  // 1. Frontend served
  const page = await req("GET", "/");
  test("GET / serves index.html", () => {
    assert(page.status === 200, `status ${page.status}`);
    assert(page.text.includes("Leonardo"), "missing title");
    assert(page.text.includes("upload-modal"), "missing modal");
  });

  // 2. Upload file via JSON
  const fileContent = `<!DOCTYPE html>
<html><head><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-blue-50 p-8"><h1 class="text-4xl font-bold">File Upload Test</h1></body></html>`;

  const upload = await req("POST", "/api/artifacts/upload", {
    filename: "test-upload.html",
    content: fileContent,
    title: "Uploaded HTML",
    category: "test",
    tags: "upload, test",
  });

  let uploadId = "";
  test("POST /api/artifacts/upload accepts file", () => {
    assert(upload.status === 201, `status ${upload.status}: ${JSON.stringify(upload.json)}`);
    assert(upload.json.title === "Uploaded HTML", "title mismatch");
    assert(upload.json.type === "html", "type should be html");
    uploadId = upload.json.id;
  });

  // 3. Paste code
  const pasteRes = await req("POST", "/api/artifacts", {
    title: "Pasted JSX Counter",
    type: "jsx",
    content: `import React, { useState } from 'react';
function App() {
  const [n, setN] = useState(0);
  return <div><h1>Count: {n}</h1><button onClick={() => setN(n+1)}>+1</button></div>;
}
export default App;`,
    category: "react",
    tags: ["counter", "jsx"],
  });

  let pasteId = "";
  test("POST /api/artifacts creates pasted artifact", () => {
    assert(pasteRes.status === 201, `status ${pasteRes.status}`);
    assert(pasteRes.json.type === "jsx", "type should be jsx");
    pasteId = pasteRes.json.id;
  });

  // 4. List
  const list = await req("GET", "/api/artifacts");
  test("list returns 2 artifacts", () => {
    assert(Array.isArray(list.json) && list.json.length === 2, `expected 2, got ${list.json?.length}`);
  });

  // 5. Get detail
  const detail = await req("GET", `/api/artifacts/${uploadId}`);
  test("get returns full content", () => {
    assert(detail.json.content.includes("tailwindcss"), "content mismatch");
    assert(detail.json.category === "test", "category mismatch");
  });

  // 6. Render HTML
  const renderHtml = await fetch(`${BASE}/api/render/${uploadId}`);
  const renderHtmlText = await renderHtml.text();
  test("render HTML returns preserved content", () => {
    assert(renderHtml.status === 200, `status ${renderHtml.status}`);
    assert(renderHtmlText.includes("tailwindcss"), "missing tailwind");
  });

  // 7. Render JSX
  const renderJsx = await fetch(`${BASE}/api/render/${pasteId}`);
  const renderJsxText = await renderJsx.text();
  test("render JSX has importmap", () => {
    assert(renderJsxText.includes("importmap"), "missing importmap");
    assert(renderJsxText.includes("esm.sh"), "missing esm.sh");
  });

  // 8. Delete
  await req("DELETE", `/api/artifacts/${uploadId}`);
  await req("DELETE", `/api/artifacts/${pasteId}`);
  const final = await req("GET", "/api/artifacts");
  test("cleanup leaves 0 artifacts", () => {
    assert(final.json.length === 0, `expected 0, got ${final.json.length}`);
  });

  console.log("\n=== Done ===");
}

run().catch(e => { console.error(e); process.exit(1); });
