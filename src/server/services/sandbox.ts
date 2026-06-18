import { resolveContent } from "./package-resolver.js";
import { transformSync } from "esbuild";

const REACT_VERSION = "18.3.1";
const REACT_DOM_VERSION = "18.3.1";

function transpileJsx(input: string): string {
  const result = transformSync(input, {
    loader: "tsx",
    jsx: "automatic",
    target: "es2022",
    format: "esm",
  });
  return result.code;
}

function splitStaticImports(code: string): { imports: string[]; body: string } {
  const imports: string[] = [];
  const importRegex = /^[ \t]*import\s+(?:[\s\S]*?\s+from\s+)?['"][^'"]+['"]\s*;?\s*/gm;
  const body = code.replace(importRegex, (match) => {
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

export function renderArtifact(options: {
  content: string;
  type: "html" | "jsx";
  title?: string;
}): string {
  const { content, type, title = "Leonardo Artifact" } = options;

  if (type === "html") return content;

  let transformed: string;
  let transformError: unknown = null;
  try {
    transformed = transpileJsx(content);
  } catch (err) {
    transformed = "";
    transformError = err;
  }

  const resolved = resolveContent(transformed, type);

  // Build import map manually: bare specifier → esm.sh CDN URL
  const mountMap: Record<string, string> = {};
  for (const [key, url] of Object.entries(resolved.importMap)) {
    mountMap[key] = url;
  }
  // Ensure react-dom and its subpath prefix are in the map for our injected import
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

  // Inject createRoot as a STATIC import so mount code uses the same React as artifact
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="importmap">
${escapeScriptContent(importMapScript)}
  </script>
  <script>
window.addEventListener("error",function(e){try{
  var root=document.getElementById('root'); if(!root) return;
  var st='';try{st=e.error&&e.error.stack?e.error.stack:''}catch(_){}
  root.innerHTML='';
  var box=document.createElement('div');box.style.cssText='padding:2rem;font-family:sans-serif;background:#fff;min-height:100vh;color:#333';
  var h=document.createElement('h2');h.style.color='#ef4444';h.textContent='Module Error';
  var p=document.createElement('p');p.style.cssText='color:#666;margin-bottom:0.5rem';p.textContent=e.filename||'';
  var pre=document.createElement('pre');pre.style.cssText='color:#333;margin-top:1rem;overflow:auto;white-space:pre-wrap';pre.textContent=(e.message||String(e))+'\\n\\n'+(st||'');
  box.append(h,p,pre);root.appendChild(box);
}catch(_){}});
  </script>
  <script type="module">
${escapeScriptContent(moduleScript)}
  </script>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
