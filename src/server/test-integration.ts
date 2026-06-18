import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001/api";
const REF_DIR = path.resolve("./ref");

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

const ARTIFACTS = [
  {
    file: "eigFcs.html",
    type: "html" as const,
    title: "Eigenfaces: Interactive Dimensionality Reduction",
    category: "linear-algebra",
    tags: ["eigenfaces", "pca", "dimensionality-reduction"],
  },
  {
    file: "tanlog.html",
    type: "html" as const,
    title: "The Translator Analogy: Interactive Diagonalization",
    category: "linear-algebra",
    tags: ["diagonalization", "eigenvectors", "matrix-decomposition"],
  },
  {
    file: "trns.jsx",
    type: "jsx" as const,
    title: "Linear Regression 3D Visualizer",
    category: "machine-learning",
    tags: ["regression", "three.js", "3d"],
  },
  {
    file: "matInv.jsx",
    type: "jsx" as const,
    title: "Matrix Inverse & Multicollinearity",
    category: "linear-algebra",
    tags: ["matrix-inverse", "multicollinearity", "three.js"],
  },
];

async function run() {
  console.log("=== Integration Test: ref/ Artifacts ===\n");

  // Clean slate
  const existing = await req("GET", "/artifacts");
  if (Array.isArray(existing.json)) {
    for (const art of existing.json) {
      await req("DELETE", `/artifacts/${art.id}`);
    }
  }

  // --- Upload all artifacts ---
  console.log("-- Upload Phase --");
  const ids: Record<string, string> = {};

  for (const art of ARTIFACTS) {
    const content = fs.readFileSync(path.join(REF_DIR, art.file), "utf-8");
    const res = await req("POST", "/artifacts", {
      title: art.title,
      type: art.type,
      content,
      category: art.category,
      tags: art.tags,
    });

    test(`upload ${art.file} (${art.type})`, () => {
      assert(res.status === 201, `status ${res.status}: ${JSON.stringify(res.json)}`);
      assert(res.json.id, "should have id");
      ids[art.file] = res.json.id;
    });
  }

  console.log();

  // --- List all ---
  console.log("-- List Phase --");
  const list = await req("GET", "/artifacts");

  test("list returns all 4 artifacts", () => {
    assert(Array.isArray(list.json), "should be array");
    assert(list.json.length === 4, `expected 4, got ${list.json.length}`);
  });

  test("all artifacts have required fields", () => {
    for (const meta of list.json) {
      assert(meta.id, "missing id");
      assert(meta.title, "missing title");
      assert(meta.type, "missing type");
      assert(meta.slug, "missing slug");
      assert(typeof meta.wordCount === "number", "missing wordCount");
      assert(typeof meta.readTimeMin === "number", "missing readTimeMin");
      assert(meta.createdAt, "missing createdAt");
    }
  });

  console.log();

  // --- Get each artifact ---
  console.log("-- Get Phase --");

  for (const art of ARTIFACTS) {
    const id = ids[art.file];
    const res = await req("GET", `/artifacts/${id}`);

    test(`get ${art.file} returns full content`, () => {
      assert(res.status === 200, `status ${res.status}`);
      assert(res.json.content.length > 100, "content too short");
      assert(res.json.title === art.title, "title mismatch");
      assert(res.json.type === art.type, "type mismatch");
      assert(res.json.category === art.category, "category mismatch");
    });
  }

  console.log();

  // --- Render each artifact ---
  console.log("-- Render Phase --");

  for (const art of ARTIFACTS) {
    const id = ids[art.file];
    const res = await fetch(`${BASE}/render/${id}`);
    const html = await res.text();

    test(`render ${art.file} returns valid HTML`, () => {
      assert(res.status === 200, `status ${res.status}`);
      assert(html.length > 200, "rendered HTML too short");
    });

    if (art.type === "jsx") {
      test(`render ${art.file} has importmap`, () => {
        assert(html.includes("importmap"), "missing importmap");
        assert(html.includes("esm.sh"), "missing esm.sh URLs");
        assert(html.includes("react"), "missing react in importmap");
      });

      test(`render ${art.file} has root div`, () => {
        assert(html.includes('id="root"'), "missing root div");
      });
    }

    if (art.type === "html") {
      test(`render ${art.file} preserves original scripts`, () => {
        if (art.file === "eigFcs.html") {
          assert(html.includes("tailwindcss"), "missing tailwind");
        }
        if (art.file === "tanlog.html") {
          assert(html.includes("katex"), "missing katex");
        }
      });
    }
  }

  console.log();

  // --- Render raw content (preview endpoint) ---
  console.log("-- Preview Endpoint Tests --");

  const previewRes = await fetch(`${BASE}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `function App() { return <div>Hello Preview</div>; } export default App;`,
      type: "jsx",
      title: "Preview Test",
    }),
  });
  const previewHtml = await previewRes.text();

  test("POST /render returns wrapped JSX", () => {
    assert(previewRes.status === 200, `status ${previewRes.status}`);
    assert(previewHtml.includes("importmap"), "should have importmap");
  });

  const badPreview = await fetch(`${BASE}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "x" }),
  });

  test("POST /render without type returns 400", () => {
    assert(badPreview.status === 400, `status ${badPreview.status}`);
  });

  console.log();

  // --- Cleanup ---
  console.log("-- Cleanup --");
  for (const art of ARTIFACTS) {
    await req("DELETE", `/artifacts/${ids[art.file]}`);
  }

  const finalList = await req("GET", "/artifacts");
  test("all artifacts cleaned up", () => {
    assert(finalList.json.length === 0, `expected 0, got ${finalList.json.length}`);
  });

  console.log("\n=== Done ===");
}

run().catch((err) => {
  console.error("Integration test error:", err);
  process.exit(1);
});
