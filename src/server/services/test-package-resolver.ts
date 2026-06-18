import { resolveContent } from "./package-resolver.js";
import fs from "node:fs";
import path from "node:path";

const REF_DIR = path.resolve("./ref");

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

console.log("=== Package Resolver Tests ===\n");

// --- Test 1: JSX with Three.js imports ---
console.log("-- JSX Artifact Tests --");

const trns = fs.readFileSync(path.join(REF_DIR, "trns.jsx"), "utf-8");
const trnsResult = resolveContent(trns, "jsx");

test("trns.jsx: detects react import", () => {
  assert(trnsResult.packages.some((p) => p.name === "react"), "missing react");
});

test("trns.jsx: detects three import", () => {
  assert(trnsResult.packages.some((p) => p.name === "three"), "missing three");
});

test("trns.jsx: detects @react-three/fiber import", () => {
  assert(
    trnsResult.packages.some((p) => p.name === "@react-three/fiber"),
    "missing @react-three/fiber"
  );
});

test("trns.jsx: detects @react-three/drei import", () => {
  assert(
    trnsResult.packages.some((p) => p.name === "@react-three/drei"),
    "missing @react-three/drei"
  );
});

test("trns.jsx: adds react-dom as peer dep of fiber", () => {
  assert(
    trnsResult.packages.some((p) => p.name === "react-dom" && p.isPeer),
    "missing react-dom peer"
  );
});

test("trns.jsx: import map has esm.sh URLs", () => {
  const url = trnsResult.importMap["react"];
  assert(url?.includes("esm.sh/react"), `bad react url: ${url}`);
});

test("trns.jsx: no CDN script tags (pure JSX)", () => {
  assert(trnsResult.scriptTags.length === 0, "should have no script tags");
});

console.log();

// --- Test 2: HTML with CDN scripts ---
console.log("-- HTML Artifact Tests --");

const eigFcs = fs.readFileSync(path.join(REF_DIR, "eigFcs.html"), "utf-8");
const eigResult = resolveContent(eigFcs, "html");

test("eigFcs.html: detects tailwind CDN script", () => {
  assert(
    eigResult.scriptTags.some((s) => s.includes("tailwindcss")),
    "missing tailwind script"
  );
});

test("eigFcs.html: detects font link tags", () => {
  assert(
    eigResult.linkTags.some((l) => l.includes("inter")),
    "missing inter font link"
  );
  assert(
    eigResult.linkTags.some((l) => l.includes("fira-code")),
    "missing fira-code font link"
  );
});

test("eigFcs.html: no npm packages (uses CDN)", () => {
  assert(eigResult.packages.length === 0, "should have no packages");
});

console.log();

// --- Test 3: HTML with KaTeX ---
const tanlog = fs.readFileSync(path.join(REF_DIR, "tanlog.html"), "utf-8");
const tanResult = resolveContent(tanlog, "html");

test("tanlog.html: detects katex scripts", () => {
  assert(
    tanResult.scriptTags.some((s) => s.includes("katex")),
    "missing katex script"
  );
});

test("tanlog.html: detects katex CSS link", () => {
  assert(
    tanResult.linkTags.some((l) => l.includes("katex")),
    "missing katex css link"
  );
});

test("tanlog.html: detects tailwind script", () => {
  assert(
    tanResult.scriptTags.some((s) => s.includes("tailwindcss")),
    "missing tailwind"
  );
});

console.log();

// --- Test 4: matInv.jsx (same deps as trns.jsx) ---
const matInv = fs.readFileSync(path.join(REF_DIR, "matInv.jsx"), "utf-8");
const matResult = resolveContent(matInv, "jsx");

test("matInv.jsx: resolves same packages as trns.jsx", () => {
  const names = matResult.packages.map((p) => p.name);
  assert(names.includes("react"), "missing react");
  assert(names.includes("three"), "missing three");
  assert(names.includes("@react-three/fiber"), "missing fiber");
  assert(names.includes("@react-three/drei"), "missing drei");
});

console.log();

// --- Test 5: Edge cases ---
console.log("-- Edge Case Tests --");

test("empty content returns no packages", () => {
  const r = resolveContent("", "jsx");
  assert(r.packages.length === 0, "should be empty");
});

test("relative imports are excluded", () => {
  const r = resolveContent(`import Foo from './local'`, "jsx");
  assert(r.packages.length === 0, "relative should be excluded");
});

test("alias imports are parsed correctly", () => {
  const r = resolveContent(
    `import React, { useState } from 'react'`,
    "jsx"
  );
  assert(r.packages.some((p) => p.name === "react"), "missing react");
});

test("react peer packages are pinned to the renderer React version", () => {
  const r = resolveContent(
    `import { Compass } from 'lucide-react';\nexport default function App() { return null; }`,
    "jsx"
  );
  const lucideUrl = r.importMap["lucide-react"];
  const clientUrl = r.importMap["react-dom/client"];
  assert(lucideUrl?.includes("deps="), `lucide-react missing pinned deps: ${lucideUrl}`);
  assert(lucideUrl?.includes("react@18.3.1"), `lucide-react missing React pin: ${lucideUrl}`);
  assert(clientUrl?.includes("react@18.3.1"), `react-dom/client missing React pin: ${clientUrl}`);
});

console.log("\n=== Done ===");
