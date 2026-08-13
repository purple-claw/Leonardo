import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import footnote from "markdown-it-footnote";
import container from "markdown-it-container";
import matter from "gray-matter";

// ── Frontmatter ───────────────────────────────────────────────────────────
export interface MdMeta {
  title: string;
  desc: string;
  category: string;
  tags: string[];
  coverImg: string;
}

export function parseFrontmatter(content: string): { body: string; meta: Partial<MdMeta> } {
  try {
    const parsed = matter(content);
    const meta: Partial<MdMeta> = {
      title: parsed.data?.title || "",
      desc: parsed.data?.description || parsed.data?.desc || "",
      category: parsed.data?.category || "",
      tags: Array.isArray(parsed.data?.tags) ? parsed.data.tags : [],
      coverImg: parsed.data?.coverImg || parsed.data?.cover_image || "",
    };
    return { body: parsed.content, meta };
  } catch {
    return { body: content, meta: {} };
  }
}

// ── Markdown-it engine ────────────────────────────────────────────────────
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs language-${md.utils.escapeHtml(lang)}"><code>${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
})
  .use(footnote)
  .use(container, "info", {
    validate: (params: string) => params.trim().match(/^info\s*/) !== null,
    render: (tokens: any[], idx: number) => {
      return tokens[idx].nesting === 1
        ? '<div class="callout callout-info"><span class="callout-label">ℹ Info</span>\n'
        : "</div>\n";
    },
  })
  .use(container, "warning", {
    validate: (params: string) => params.trim().match(/^warning\s*/) !== null,
    render: (tokens: any[], idx: number) => {
      return tokens[idx].nesting === 1
        ? '<div class="callout callout-warning"><span class="callout-label">⚠ Warning</span>\n'
        : "</div>\n";
    },
  })
  .use(container, "danger", {
    validate: (params: string) => params.trim().match(/^(danger|error)\s*/) !== null,
    render: (tokens: any[], idx: number) => {
      return tokens[idx].nesting === 1
        ? '<div class="callout callout-danger"><span class="callout-label">⊗ Danger</span>\n'
        : "</div>\n";
    },
  })
  .use(container, "tip", {
    validate: (params: string) => params.trim().match(/^tip\s*/) !== null,
    render: (tokens: any[], idx: number) => {
      return tokens[idx].nesting === 1
        ? '<div class="callout callout-tip"><span class="callout-label">✦ Tip</span>\n'
        : "</div>\n";
    },
  });

// ── Plugin: Mermaid code blocks ───────────────────────────────────────────
const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim() === "mermaid") {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

// ── Plugin: External links → target=_blank ────────────────────────────────
const defaultLink = md.renderer.rules.link_open?.bind(md.renderer.rules);
if (md.renderer.rules.link_open) {
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href") || "";
    if (href.startsWith("http")) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }
    return defaultLink!(tokens, idx, options, env, self);
  };
}

// ── Math extraction ───────────────────────────────────────────────────────
// Math ($…$, $$…$$, \(…\), \[…\]) is lifted out to placeholders BEFORE
// markdown parsing. markdown-it's backslash-escape rule destroys \(…\) /
// \[…\] and typographer rewrites quotes/dashes inside formulas, so KaTeX can
// never see intact math otherwise. Code regions (fenced, indented, inline
// backticks) are left alone so $ inside code is never treated as math.
const MATH_PREFIX = "§§LEOMATH";
const SUFFIX = "§§";

interface MathToken {
  expr: string;
  display: boolean;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isEscapedDollar(content: string, i: number): boolean {
  let backslashes = 0;
  for (let j = i - 1; j >= 0 && content[j] === "\\"; j--) backslashes++;
  return backslashes % 2 === 1;
}

function looksLikeMath(inner: string): boolean {
  return (
    inner.length > 0 &&
    !inner.startsWith(" ") &&
    !inner.endsWith(" ") &&
    !/^\d[\d,]*(\.\d+)?$/.test(inner)
  );
}

function collectMath(content: string): { text: string; tokens: Map<string, MathToken> } {
  const tokens = new Map<string, MathToken>();
  const buf: string[] = [];
  let index = 0;
  let i = 0;
  let lineStart = true;
  let inFence = false;

  const lineEndOf = (pos: number): number => {
    const nl = content.indexOf("\n", pos);
    return nl === -1 ? content.length : nl;
  };

  while (i < content.length) {
    const ch = content[i];

    if (ch === "\n") {
      buf.push(ch);
      i++;
      lineStart = true;
      continue;
    }

    if (lineStart) {
      lineStart = false;
      let indent = 0;
      while (i + indent < content.length && content[i + indent] === " ") indent++;
      const j = i + indent;
      const opensFence = content.startsWith("```", j) || content.startsWith("~~~", j);
      if (opensFence) {
        if (inFence) inFence = false;
        else if (indent < 4 && content[j] !== "\t") inFence = true;
      }
      if (inFence || indent >= 4 || content[j] === "\t") {
        const le = lineEndOf(i);
        while (i < le) {
          buf.push(content[i]);
          i++;
        }
        continue;
      }
    }

    const lineEnd = lineEndOf(i);

    // \[ ... \] display math
    if (ch === "\\" && content[i + 1] === "[") {
      const end = content.indexOf("\\]", i + 2);
      if (end !== -1) {
        const key = `${MATH_PREFIX}${index}${SUFFIX}`;
        tokens.set(key, { expr: content.slice(i + 2, end), display: true });
        buf.push(key);
        index++;
        i = end + 2;
        continue;
      }
    }

    // \( ... \) inline math
    if (ch === "\\" && content[i + 1] === "(") {
      const end = content.indexOf("\\)", i + 2);
      if (end !== -1) {
        const key = `${MATH_PREFIX}${index}${SUFFIX}`;
        tokens.set(key, { expr: content.slice(i + 2, end), display: false });
        buf.push(key);
        index++;
        i = end + 2;
        continue;
      }
    }

    // $$ ... $$ display math (may span lines)
    if (content.startsWith("$$", i) && !isEscapedDollar(content, i)) {
      const end = content.indexOf("$$", i + 2);
      if (end !== -1) {
        const key = `${MATH_PREFIX}${index}${SUFFIX}`;
        tokens.set(key, { expr: content.slice(i + 2, end), display: true });
        buf.push(key);
        index++;
        i = end + 2;
        continue;
      }
    }

    // $ ... $ inline math (single line, heuristic)
    if (ch === "$" && !isEscapedDollar(content, i) && content[i + 1] !== "$") {
      const close = content.indexOf("$", i + 1);
      if (close !== -1 && close < lineEnd) {
        const inner = content.slice(i + 1, close);
        if (looksLikeMath(inner)) {
          const key = `${MATH_PREFIX}${index}${SUFFIX}`;
          tokens.set(key, { expr: inner, display: false });
          buf.push(key);
          index++;
          i = close + 1;
          continue;
        }
      }
    }

    buf.push(ch);
    i++;
  }

  return { text: buf.join(""), tokens };
}

function restoreMath(html: string, tokens: Map<string, MathToken>): string {
  let out = html;
  for (const [key, tok] of tokens) {
    out = out
      .replace(new RegExp(`<p>\\s*${escapeRegExp(key)}\\s*</p>`), key)
      .replace(new RegExp(`<em>${escapeRegExp(key)}</em>`), key);
    const display = tok.display ? "math-display" : "math-inline";
    const escaped = md.utils.escapeHtml(tok.expr);
    out = out.replaceAll(key, `<span class="math ${display}" data-math="${escaped}"></span>`);
  }
  return out;
}

// ── Plugin: GFM task lists ────────────────────────────────────────────────
// markdown-it has no task-list support; the renderer CSS already styles
// checkbox inputs and hides the bullet via `ul:has(input[type="checkbox"])`.
function renderTaskLists(html: string): string {
  return html.replace(/<li>\[([ xX])\]\s+/g, (_m, state: string) => {
    const checked = state === "x" || state === "X" ? " checked" : "";
    return `<li><input type="checkbox"${checked} disabled> `;
  });
}

// ── Exports ───────────────────────────────────────────────────────────────
export function renderMarkdown(content: string): string {
  const { text, tokens } = collectMath(content);
  const html = md.render(text);
  return renderTaskLists(restoreMath(html, tokens));
}

export function parseMarkdownWithMeta(content: string): { html: string; meta: Partial<MdMeta> } {
  const { body, meta } = parseFrontmatter(content);
  const html = renderMarkdown(body);
  return { html, meta };
}
