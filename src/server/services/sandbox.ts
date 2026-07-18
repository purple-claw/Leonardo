import { resolveContent } from "./package-resolver.js";
import { parseMarkdownWithMeta } from "./markdown-renderer.js";
import { transform } from "esbuild";
import { LRUCache } from "lru-cache";
import { createHash } from "node:crypto";

const REACT_VERSION = "18.3.1";
const REACT_DOM_VERSION = "18.3.1";

// ── Render Cache ───────────────────────────────────────────────────────────
// Keyed by content-hash (SHA-256). Artifacts are read >> written, so caching
// the final HTML eliminates redundant transpilation + resolution.
const renderCache = new LRUCache<string, string>({ max: 100 });

function cacheKey(content: string, title: string): string {
  return createHash("sha256")
    .update(content)
    .update(title)
    .digest("hex");
}

// ── Content Security Policy ────────────────────────────────────────────────
// Injected into every rendered artifact to restrict what the sandboxed code
// can load/fetch. Covers the CDN sources used by JSX + Markdown templates.
const CSP = "default-src 'self'; "
  + "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com; "
  + "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; "
  + "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; "
  + "img-src 'self' data: https:; "
  + "connect-src 'self' https://esm.sh; "
  + "frame-src 'none'; "
  + "object-src 'none'";

// CJS packages whose default export properties must be re-exported as ESM
// named exports via esm.sh's ?exports parameter.
const CJS_EXPORTS: Record<string, string> = {
  "react-katex": "InlineMath,BlockMath",
};

function transpileJsx(input: string): Promise<string> {
  return transform(input, {
    loader: "tsx",
    jsx: "automatic",
    target: "es2022",
    format: "esm",
  }).then((r) => r.code);
}

function splitStaticImports(code: string): { imports: string[]; body: string } {
  const imports: string[] = [];
  const importRegex = /^(?:[ \t]*(?:\/\/|\/\*))?[ \t]*import\s+(?:[\s\S]*?\s+from\s+)?['"][^'"]+['"]\s*;?\s*/gm;
  const body = code.replace(importRegex, (match) => {
    const trimmed = match.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*")) return match;
    imports.push(match);
    return "";
  }).trim();
  return { imports, body };
}

function stripExportsAndFindDefault(body: string): { body: string; defaultExport: string | null } {
  let defaultExport: string | null = null;

  const withoutExportBlocks = body.replace(/export\s*\{([\s\S]*?)\};?/g, (_match, exportsList) => {
    const entries = String(exportsList)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    for (const entry of entries) {
      const match = entry.match(/^([A-Za-z_$][\w$]*)\s+as\s+default$/);
      if (match) defaultExport = match[1];
      if (entry === "default") defaultExport = "default";
    }

    return "";
  });

  const withoutNamedExports = withoutExportBlocks.replace(
    /^export\s+(?=(?:const|let|var|function|class)\s)/gm,
    ""
  );

  return { body: withoutNamedExports.trim(), defaultExport };
}

function buildTranspileErrorModule(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `
const __root = document.getElementById("root");
if (__root) {
  __root.innerHTML = "";
  const box = document.createElement("div");
  box.style.cssText = "padding:2rem;font-family:sans-serif;background:#fff;min-height:100vh;color:#333";
  const title = document.createElement("h2");
  title.style.color = "#ef4444";
  title.textContent = "JSX Transform Error";
  const pre = document.createElement("pre");
  pre.style.cssText = "margin-top:1rem;overflow:auto;white-space:pre-wrap";
  pre.textContent = ${JSON.stringify(message)};
  box.append(title, pre);
  __root.appendChild(box);
}
`;
}

function escapeScriptContent(content: string): string {
  return content.replace(/<\/script/gi, "<\\/script");
}

function wrapMarkdown(html: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${CSP}">
  <title>${escHtml(title)}</title>
  <link rel="stylesheet" href="/fonts/fonts.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
      background: #0a0a0a; color: #e8e8e8;
      font-size: 18px; line-height: 1.75;
      max-width: 880px; margin: 0 auto; padding: 3rem 2rem;
    }

    h1, h2, h3, h4 { font-family: var(--font-serif, Georgia, serif); font-weight: 600; color: #f5f5f5; letter-spacing: -0.02em; }
    h1 { font-size: 2.6rem; margin: 0 0 0.5rem; line-height: 1.2; }
    h2 { font-size: 1.8rem; margin: 2.5rem 0 1rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
    h3 { font-size: 1.4rem; margin: 2rem 0 0.75rem; }
    h4 { font-size: 1.15rem; margin: 1.5rem 0 0.5rem; }
    p  { margin-bottom: 1.2rem; }
    a  { color: #80b8ff; text-decoration: none; border-bottom: 1px solid rgba(128,184,255,0.3); transition: border-color 0.3s; }
    a:hover { border-color: #80b8ff; }
    strong { color: #f5f5f5; font-weight: 600; }
    blockquote {
      margin: 1.5rem 0; padding: 1rem 1.5rem;
      border-left: 3px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.03);
      border-radius: 0 12px 12px 0;
      color: #bbb;
    }
    blockquote p:last-child { margin-bottom: 0; }
    hr { border: none; height: 1px; background: rgba(255,255,255,0.08); margin: 2.5rem 0; }

    ul, ol { margin: 0 0 1.2rem 1.5rem; }
    li { margin-bottom: 0.3rem; }
    li > ul, li > ol { margin-bottom: 0; }

    code {
      font-family: var(--font-mono, monospace);
      font-size: 0.85em;
      background: rgba(255,255,255,0.06);
      padding: 0.15em 0.4em;
      border-radius: 6px;
    }
    pre {
      margin: 1.2rem 0; border-radius: 12px;
      background: #0d0d0d !important;
      border: 1px solid rgba(255,255,255,0.06);
      overflow-x: auto;
    }
    pre code {
      background: none; padding: 1rem; font-size: 0.82rem;
      line-height: 1.55; display: block;
    }
    :not(pre) > code { white-space: nowrap; }

    table {
      width: 100%; border-collapse: collapse;
      margin: 1.5rem 0; font-size: 0.92rem;
    }
    th, td {
      padding: 0.6rem 1rem; text-align: left;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    th { font-weight: 600; color: #f5f5f5; background: rgba(255,255,255,0.03); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.02); }

    img { max-width: 100%; border-radius: 12px; margin: 1.5rem 0; border: 1px solid rgba(255,255,255,0.06); }
    input[type="checkbox"] { margin-right: 0.5rem; accent-color: #80b8ff; }
    ul:has(input[type="checkbox"]) { list-style: none; margin-left: 0; }
    .katex { font-size: 1.05em; }
    .katex-display { margin: 1.5rem 0; overflow-x: auto; overflow-y: hidden; }
    .mermaid {
      margin: 1.5rem 0; padding: 1rem;
      background: rgba(255,255,255,0.02);
      border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);
      display: flex; justify-content: center;
    }
    .footnotes { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.85rem; color: #999; }
    .footnotes ol { margin-left: 1.2rem; }
    .footnote-ref { font-size: 0.75em; vertical-align: super; }

    /* ── Footnotes ── */
    .footnotes-sep { margin: 3rem 0 1rem; }
    .footnotes { font-size: 0.85rem; color: #999; }
    .footnotes ol { margin-left: 1.2rem; }
    .footnotes li { margin-bottom: 0.4rem; }
    .footnote-backref { font-size: 0; }
    .footnote-backref::before { content: "↩"; font-size: 0.85rem; }

    /* ── Callout / Container blocks ── */
    .callout {
      margin: 1.5rem 0; padding: 1rem 1.25rem;
      border-radius: 12px; border-left: 4px solid;
      font-size: 0.95rem; line-height: 1.6;
    }
    .callout .callout-label {
      display: block; font-weight: 600; font-size: 0.82rem;
      text-transform: uppercase; letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
    }
    .callout p:last-child { margin-bottom: 0; }
    .callout-info    { background: rgba(59,130,246,0.08); border-color: #3b82f6; }
    .callout-info .callout-label { color: #60a5fa; }
    .callout-warning { background: rgba(234,179,8,0.08);  border-color: #eab308; }
    .callout-warning .callout-label { color: #facc15; }
    .callout-danger  { background: rgba(239,68,68,0.08);  border-color: #ef4444; }
    .callout-danger .callout-label { color: #f87171; }
    .callout-tip     { background: rgba(34,197,94,0.08);  border-color: #22c55e; }
    .callout-tip .callout-label { color: #4ade80; }

    @media (max-width: 700px) {
      body { padding: 1rem 0.75rem; font-size: 15px; max-width: 100%; }
      h1 { font-size: 1.5rem; }
      h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; }
      h3 { font-size: 1.1rem; }
      pre { margin: 0.8rem -0.75rem; border-radius: 0; }
      pre code { padding: 0.75rem; font-size: 0.75rem; }
      table { font-size: 0.78rem; display: block; overflow-x: auto; }
      th, td { padding: 0.3rem 0.5rem; }
      img { margin: 1rem 0; }
      blockquote { margin: 1rem 0; padding: 0.75rem 1rem; }
      .callout { margin: 1rem 0; padding: 0.75rem 1rem; }
      .katex-display { font-size: 0.9em; }
    }
    @media (max-width: 480px) {
      body { font-size: 14px; padding: 0.75rem 0.5rem; }
      h1 { font-size: 1.3rem; }
      h2 { font-size: 1.1rem; }
    }
  </style>
</head>
<body>
${html}

<script src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/contrib/auto-render.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.1/mermaid.min.js" defer></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
  if (typeof renderMathInElement === "function") {
    try {
      renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\\\\\\\(", right: "\\\\\\\\)", display: false },
          { left: "\\\\\\\\[", right: "\\\\\\\\]", display: true }
        ],
        throwOnError: false
      });
    } catch(e) { console.warn("KaTeX error:", e); }
  }
  if (typeof mermaid !== "undefined") {
    try {
      mermaid.initialize({ startOnLoad: true, theme: "dark" });
    } catch(e) { console.warn("Mermaid error:", e); }
  }
});
</script>
</body>
</html>`;
}

export async function renderArtifact(options: {
  content: string;
  type: "html" | "jsx" | "md";
  title?: string;
}): Promise<string> {
  const { content, type, title = "Leonardo Artifact" } = options;

  // HTML passthrough (no caching — content IS the output)
  if (type === "html") return content;

  // Cache check: use content + title hash
  const ck = cacheKey(content, title);
  const cached = renderCache.get(ck);
  if (cached) return cached;

  let html: string;

  if (type === "md") {
    const { html: mdHtml } = parseMarkdownWithMeta(content);
    html = wrapMarkdown(mdHtml, title);
    renderCache.set(ck, html);
    return html;
  }

  // ── JSX/TSX rendering pipeline ──
  let transformed: string;
  let transformError: unknown = null;
  try {
    transformed = await transpileJsx(content);
  } catch (err) {
    transformed = "";
    transformError = err;
  }

  const resolved = resolveContent(transformed, "jsx");

  // Build import map
  const mountMap: Record<string, string> = {};
  for (const [key, url] of Object.entries(resolved.importMap)) {
    mountMap[key] = url;
  }
  if (!mountMap["react"]) mountMap["react"] = `https://esm.sh/react@${REACT_VERSION}`;
  if (!mountMap["react/"]) mountMap["react/"] = `https://esm.sh/react@${REACT_VERSION}/`;
  if (!mountMap["react/jsx-runtime"]) {
    mountMap["react/jsx-runtime"] = `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`;
  }
  if (!mountMap["react/jsx-dev-runtime"]) {
    mountMap["react/jsx-dev-runtime"] = `https://esm.sh/react@${REACT_VERSION}/jsx-dev-runtime`;
  }
  if (!mountMap["react-dom"]) {
    mountMap["react-dom"] =
      `https://esm.sh/react-dom@${REACT_DOM_VERSION}?deps=react@${REACT_VERSION}`;
  }
  if (!mountMap["react-dom/"]) mountMap["react-dom/"] = `https://esm.sh/react-dom@${REACT_DOM_VERSION}/`;
  if (!mountMap["react-dom/client"]) {
    mountMap["react-dom/client"] =
      `https://esm.sh/react-dom@${REACT_DOM_VERSION}/client?deps=react@${REACT_VERSION}`;
  }

  // CJS named exports fix
  for (const [pkg, url] of Object.entries(mountMap)) {
    if (pkg.endsWith("/")) continue;
    const sep = url.includes("?") ? "&" : "?";
    if (CJS_EXPORTS[pkg]) {
      mountMap[pkg] = url.includes("exports=") ? url : `${url}${sep}exports=${CJS_EXPORTS[pkg]}`;
    }
  }

  // Build module script
  const moduleScript = transformError
    ? buildTranspileErrorModule(transformError)
    : (() => {
        const { imports, body } = splitStaticImports(transformed);
        const prepared = stripExportsAndFindDefault(body);
        const appExpression = prepared.defaultExport
          ? prepared.defaultExport
          : '(typeof App !== "undefined" ? App : undefined)';

        imports.push(`import * as _LEONARDO_React from 'react';`);
        imports.push(`import { createRoot as _LEONARDO_createRoot } from 'react-dom/client';`);

        return `${imports.join("\n")}

${prepared.body}

const _LEONARDO_App = ${appExpression};
const __root = document.getElementById("root");

function _LEONARDO_showError(title, err) {
  if (!__root) return;
  __root.innerHTML = "";
  const box = document.createElement("div");
  box.style.cssText = "padding:2rem;font-family:sans-serif;background:#fff;min-height:100vh;color:#333";
  const heading = document.createElement("h2");
  heading.style.color = "#ef4444";
  heading.textContent = title;
  const pre = document.createElement("pre");
  pre.style.cssText = "color:#333;margin-top:1rem;overflow:auto;white-space:pre-wrap";
  const message = err && err.message ? err.message : String(err);
  const stack = err && err.stack ? "\\n" + err.stack : "";
  pre.textContent = message + stack;
  box.append(heading, pre);
  __root.appendChild(box);
}

if (!__root) {
  document.body.textContent = "Error: #root missing";
} else {
  __root.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#999;background:#fff">Loading...</div>';
  try {
    if (_LEONARDO_App) {
      _LEONARDO_createRoot(__root, {
        onRecoverableError(err) {
          _LEONARDO_showError("React Recoverable Error", err);
        }
      }).render(_LEONARDO_React.createElement(_LEONARDO_App));
    } else {
      _LEONARDO_showError("Render Error", new Error("No default export or App component found."));
    }
  } catch (e) {
    _LEONARDO_showError("Render Error", e);
  }
}
`;
      })();

  const importMapScript = JSON.stringify({ imports: mountMap }, null, 2);

  html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Content-Security-Policy" content="${CSP}">
  <title>${escHtml(title)}</title>
  <link rel="stylesheet" href="/fonts/fonts.css">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; }
    body { font-family: var(--font-sans, 'Inter', system-ui, -apple-system, sans-serif); }
    @media (max-width: 700px) {
      html { font-size: 15px; }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="importmap">
${escapeScriptContent(importMapScript)}
  </script>
  <script>
(function(){
  var root=document.getElementById('root');

  window.addEventListener("error",function(e){try{
    if(!root)return;
    var st='';try{st=e.error&&e.error.stack?e.error.stack:''}catch(_){}
    root.innerHTML='';
    var box=document.createElement('div');box.style.cssText='padding:2rem;font-family:sans-serif;background:#fff;min-height:100vh;color:#333';
    var h=document.createElement('h2');h.style.color='#ef4444';h.textContent='Module Error';
    var p=document.createElement('p');p.style.cssText='color:#666;margin-bottom:0.5rem';p.textContent=e.filename||'';
    var pre=document.createElement('pre');pre.style.cssText='color:#333;margin-top:1rem;overflow:auto;white-space:pre-wrap';pre.textContent=(e.message||String(e))+'\\n\\n'+(st||'');
    box.append(h,p,pre);root.appendChild(box);
  }catch(_){}});

})();
  </script>
  <script type="module">
${escapeScriptContent(moduleScript)}
  </script>
</body>
</html>`;

  renderCache.set(ck, html);
  return html;
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
