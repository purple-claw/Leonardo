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
        return `<pre class="hljs language-${lang}"><code>${
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

// ── Exports ───────────────────────────────────────────────────────────────
export function renderMarkdown(content: string): string {
  return md.render(content);
}

export function parseMarkdownWithMeta(content: string): { html: string; meta: Partial<MdMeta> } {
  const { body, meta } = parseFrontmatter(content);
  const html = md.render(body);
  return { html, meta };
}
