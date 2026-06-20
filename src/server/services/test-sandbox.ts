import { renderArtifact } from "./sandbox.js";
import fs from "node:fs";
import path from "node:path";

const REF_DIR = path.resolve("./ref");

let failures = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (e: any) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
    failures++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function run() {
  console.log("=== Sandbox Renderer Tests ===\n");

  // --- HTML artifacts pass through ---
  console.log("-- HTML Passthrough Tests --");

  const eigFcs = fs.readFileSync(path.join(REF_DIR, "eigFcs.html"), "utf-8");
  const eigResult = await renderArtifact({ content: eigFcs, type: "html", title: "Eigenfaces" });

  await test("eigFcs.html: passes through original content", () => {
    assert(eigResult === eigFcs, "should be identical to input");
  });

  const tanlog = fs.readFileSync(path.join(REF_DIR, "tanlog.html"), "utf-8");
  const tanResult = await renderArtifact({ content: tanlog, type: "html", title: "TanLog" });

  await test("tanlog.html: passes through original content", () => {
    assert(tanResult === tanlog, "should be identical to input");
  });

  console.log();

  // --- JSX artifacts get wrapped ---
  console.log("-- JSX Wrapping Tests --");

  const trns = fs.readFileSync(path.join(REF_DIR, "trns.jsx"), "utf-8");
  const trnsResult = await renderArtifact({ content: trns, type: "jsx", title: "3D Regression" });

  await test("jsx: output is valid HTML", () => {
    assert(trnsResult.startsWith("<!DOCTYPE html>"), "should start with DOCTYPE");
    assert(trnsResult.includes("</html>"), "should end with closing html tag");
  });

  await test("jsx: contains importmap with esm.sh URLs", () => {
    assert(trnsResult.includes('"react"'), "importmap should have react");
    assert(trnsResult.includes('"three"'), "importmap should have three");
    assert(trnsResult.includes("esm.sh"), "should reference esm.sh");
  });

  await test("jsx: has root div for React mount", () => {
    assert(trnsResult.includes('<div id="root">'), "should have root div");
  });

  await test("jsx: has module script", () => {
    assert(trnsResult.includes('<script type="module">'), "should have module script");
  });

  await test("jsx: preserves original imports", () => {
    assert(
      trnsResult.includes("import React") || trnsResult.includes("import { Canvas }"),
      "should preserve original import statements"
    );
  });

  await test("jsx: has title from options", () => {
    assert(trnsResult.includes("<title>3D Regression</title>"), "should use provided title");
  });

  await test("jsx: default title is Leonardo Artifact", async () => {
    const r = await renderArtifact({ content: trns, type: "jsx" });
    assert(r.includes("<title>Leonardo Artifact</title>"), "should use default title");
  });

  console.log();

  // --- Import map correctness ---
  console.log("-- Import Map Tests --");

  const matInv = fs.readFileSync(path.join(REF_DIR, "matInv.jsx"), "utf-8");
  const matResult = await renderArtifact({ content: matInv, type: "jsx", title: "Matrix Inverse" });

  await test("import map includes all resolved packages", () => {
    assert(matResult.includes('"@react-three/fiber"'), "missing fiber");
    assert(matResult.includes('"@react-three/drei"'), "missing drei");
    assert(matResult.includes('"react-dom"'), "missing react-dom");
  });

  await test("import map values point to esm.sh", () => {
    const mapMatch = matResult.match(/<script type="importmap">([\s\S]*?)<\/script>/);
    assert(mapMatch !== null, "should have importmap block");
    const map = JSON.parse(mapMatch![1]);
    for (const url of Object.values(map.imports)) {
      assert(
        (url as string).includes("esm.sh"),
        `URL should be esm.sh: ${url}`
      );
    }
  });

  console.log();

  // --- JSX transform correctness ---
  console.log("-- JSX Transform Tests --");

  await test("jsx: supports automatic React runtime without React import", async () => {
    const r = await renderArtifact({
      content: `export default function App() { return <main>Hello</main>; }`,
      type: "jsx",
    });
    assert(r.includes('from "react/jsx-runtime"'), "should import automatic jsx runtime");
    assert(r.includes("App as default") === false, "should strip ESM export block from inline module");
    assert(r.includes("const _LEONARDO_App = App;"), "should mount default function export");
  });

  await test("jsx: supports export default App statements", async () => {
    const r = await renderArtifact({
      content: `function App() { return <main>Hello</main>; }\nexport default App;`,
      type: "jsx",
    });
    assert(r.includes("const _LEONARDO_App = stdin_default;"), "should mount normalized default binding");
  });

  await test("jsx: supports App component without default export", async () => {
    const r = await renderArtifact({
      content: `function App() { return <main>Hello</main>; }`,
      type: "jsx",
    });
    assert(
      r.includes('const _LEONARDO_App = (typeof App !== "undefined" ? App : undefined);'),
      "should fall back to App when no default export exists"
    );
  });

  await test("jsx: supports TSX syntax", async () => {
    const r = await renderArtifact({
      content: `type Props = { label: string };\nconst App = ({ label }: Props) => <main>{label}</main>;\nexport default App;`,
      type: "jsx",
    });
    assert(!r.includes("type Props"), "should strip TypeScript syntax");
    assert(r.includes("const _LEONARDO_App = stdin_default;"), "should mount TSX default export");
  });

  console.log();

  // --- Security: XSS prevention ---
  console.log("-- Security Tests --");

  await test("jsx: escapes HTML in title", async () => {
    const r = await renderArtifact({
      content: trns,
      type: "jsx",
      title: '<script>alert("xss")</script>',
    });
    assert(!r.includes('<script>alert("xss")</script>'), "should escape title");
    assert(r.includes("&lt;script&gt;"), "should be escaped");
  });

  console.log(`\n=== Done (${failures} failures) ===`);
  process.exitCode = failures;
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
