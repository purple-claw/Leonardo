interface ResolvedPkg {
  name: string;
  url: string;
  isPeer?: boolean;
}

interface ResolveResult {
  packages: ResolvedPkg[];
  importMap: Record<string, string>;
  scriptTags: string[];
  linkTags: string[];
}

const PEER_DEPS: Record<string, string[]> = {
  "@react-three/fiber": ["react", "react-dom", "three"],
  "@react-three/drei": ["react", "react-dom", "three", "@react-three/fiber"],
  "react-dom": ["react"],
  "lucide-react": ["react"],
};

const REACT_VERSION = "18.3.1";
const REACT_DOM_VERSION = "18.3.1";
const THREE_VERSION = "0.170.0";
const R3F_VERSION = "8.18.0";
const DREI_VERSION = "9.122.0";
const PINNED_ESM_DEPS = [
  `react@${REACT_VERSION}`,
  `react-dom@${REACT_DOM_VERSION}`,
  `three@${THREE_VERSION}`,
  `@react-three/fiber@${R3F_VERSION}`,
].join(",");

const PACKAGE_VERSIONS: Record<string, string> = {
  react: REACT_VERSION,
  "react-dom": REACT_DOM_VERSION,
  three: THREE_VERSION,
  "@react-three/fiber": R3F_VERSION,
  "@react-three/drei": DREI_VERSION,
  cannon: "0.20",
  "cannon-es": "0.20",
  "matter-js": "0.20",
  p5: "1",
};

function parseImports(content: string): string[] {
  // Matches:
  //   import Default from "pkg"
  //   import { a, b } from "pkg"
  //   import Default, { a } from "pkg"
  //   import * as Name from "pkg"
  const importRegex =
    /import\s+(?:\*\s+as\s+\w+\s+from\s+)?(?:(?:\w+\s*,?\s*)?(?:\{[^}]*\})?\s+from\s+)?['"]([^'"]+)['"]/g;
  const packages: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const pkg = match[1];
    if (!pkg.startsWith(".") && !pkg.startsWith("/")) {
      const base = pkg.startsWith("@")
        ? pkg.split("/").slice(0, 2).join("/")
        : pkg.split("/")[0];
      if (!packages.includes(base)) packages.push(base);
    }
  }
  return packages;
}

function parseCdnScripts(content: string): { scripts: string[]; links: string[] } {
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/g;
  const linkRegex = /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/g;
  const scripts: string[] = [];
  const links: string[] = [];
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    if (match[1].startsWith("http")) scripts.push(match[1]);
  }
  while ((match = linkRegex.exec(content)) !== null) {
    if (match[1].startsWith("http")) links.push(match[1]);
  }
  return { scripts, links };
}

// Packages known to bundle React internally. Tell esm.sh to externalize React
// so the browser reuses our pinned React instance — prevents "two Reacts" errors.
const EXTERNALIZE_REACT = new Set([
  "@react-three/fiber",
  "@react-three/drei",
  "@react-three/xr",
  "@react-spring/three",
  "@react-spring/web",
  "framer-motion",
  "react-katex",
]);

function resolvePackage(name: string): ResolvedPkg {
  const version = PACKAGE_VERSIONS[name] || "latest";
  const baseUrl = `https://esm.sh/${name}@${version}`;
  let url = name === "react" || name === "three"
    ? baseUrl
    : `${baseUrl}?deps=${PINNED_ESM_DEPS}`;

  if (EXTERNALIZE_REACT.has(name)) {
    url += `${url.includes("?") ? "&" : "?"}external=react,react-dom`;
  }

  return {
    name,
    url,
  };
}

function packagePrefixUrl(name: string): string {
  const version = PACKAGE_VERSIONS[name] || "latest";
  return `https://esm.sh/${name}@${version}/`;
}

function resolveWithPeers(packages: string[]): ResolvedPkg[] {
  const resolved: ResolvedPkg[] = [];
  const seen = new Set<string>();

  for (const pkg of packages) {
    if (seen.has(pkg)) continue;
    seen.add(pkg);
    resolved.push(resolvePackage(pkg));

    const peers = PEER_DEPS[pkg] || [];
    for (const peer of peers) {
      if (!seen.has(peer)) {
        seen.add(peer);
        resolved.push({ ...resolvePackage(peer), isPeer: true });
      }
    }
  }

  return resolved;
}

export function resolveContent(content: string, type: "html" | "jsx"): ResolveResult {
  if (type === "html") {
    const { scripts, links } = parseCdnScripts(content);
    return {
      packages: [],
      importMap: {},
      scriptTags: scripts,
      linkTags: links,
    };
  }

  const imports = parseImports(content);
  const packages = resolveWithPeers(imports);

  const importMap: Record<string, string> = {};
  for (const pkg of packages) {
    importMap[pkg.name] = pkg.url;
    // Add prefix mapping so subpath imports (e.g. "react-dom/client") resolve too
    const prefixKey = pkg.name + "/";
    importMap[prefixKey] = packagePrefixUrl(pkg.name);
  }

  importMap["react/jsx-runtime"] = `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`;
  importMap["react/jsx-dev-runtime"] = `https://esm.sh/react@${REACT_VERSION}/jsx-dev-runtime`;
  importMap["react-dom/client"] =
    `https://esm.sh/react-dom@${REACT_DOM_VERSION}/client?deps=react@${REACT_VERSION}`;

  return {
    packages,
    importMap,
    scriptTags: [],
    linkTags: [],
  };
}
