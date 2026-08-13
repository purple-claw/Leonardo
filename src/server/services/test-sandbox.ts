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

  console.log();

  // --- Markdown rendering correctness ---
  console.log("-- Markdown Tests --");

  const renderMd = (content: string) => renderArtifact({ content, type: "md", title: "MD" });

  await test("md: inline math \\(x^2\\) survives markdown escaping", async () => {
    const r = await renderMd(String.raw`Inline \(x^2\) and display \[y = mx + b\].`);
    assert(r.includes(`data-math="x^2"`), `math lost: ${r.slice(0, 300)}`);
    assert(r.includes(`data-math="y = mx + b"`), "display math lost");
  });

  await test("md: math keeps its markers after rendering", async () => {
    const r = await renderMd(String.raw`$x$ math.`);
    assert(r.includes(`data-math="x"`), "should keep math markers");
    assert(!r.includes("§§LEOMATH"), "placeholder must not leak");
  });

  await test("md: block math is not wrapped in <em>", async () => {
    const r = await renderMd("Before\n\n$$x = 1$$\n\nAfter");
    assert(r.includes(`<span class="math math-display" data-math="x = 1">`), "math placed inside em");
    assert(!r.includes("<em>"), "should not have em wrapper");
  });

  await test("md: inline math is not wrapped in <em>", async () => {
    const r = await renderMd("Before *$x$* after");
    assert(r.includes(`<span class="math math-inline" data-math="x">`), "math placed inside em");
    assert(!r.includes("<em>"), "should not have em wrapper");
  });

  await test("md: typographer does not corrupt math", async () => {
    const r = await renderMd(String.raw`$f'$ ok`);
    assert(r.includes(`data-math="f'"`), "sym quote corrupted math");
    assert(!r.includes("&rsquo;"), "should not have curly quote in math");
  });

  await test("md: math inside code fences stays literal", async () => {
    const r = await renderMd("```\n$x = 1$\n```");
    assert(r.includes("$x = 1$"), "should keep $ in code");
    assert(!r.includes('<span class="math'), "should not extract from fenced code");
  });

  await test("md: code fences containing ``` stay inside the highlighted block", async () => {
    const r = await renderMd("```ts\ncode;\n```\n// out\n");
    assert(r.includes("// out"), "content after fence lost");
  });

  await test("md: fenced code language attr is escaped", async () => {
    const r = await renderMd('```js" onmouseover="alert(1)\nvar x = 1;\n```');
    assert(!r.includes('js" onmouseover'), "lang attr injection");
    assert(r.includes("var x = 1;"), "code content should render");
  });

  await test("md: task lists render checkboxes", async () => {
    const r = await renderMd("- [x] done\n- [ ] todo");
    assert(r.includes('<input type="checkbox" checked disabled>'), "checked box missing");
    assert(r.includes('<input type="checkbox" disabled>'), "unchecked box missing");
    assert(!r.includes("<li>[x]"), "raw task marker left behind");
  });

  await test("md: garbage math is left as text, not math", async () => {
    const r = await renderMd("x = $1,000$ and $ horses");
    assert(!r.includes('<span class="math'), "should not extract numeric or unclosed math");
    assert(r.includes("$1,000$"), "should keep raw $ text");
    assert(r.includes("$ horses"), "should keep unclosed $");
  });

  console.log(`\n=== Done (${failures} failures) ===`);
  process.exitCode = failures;
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
