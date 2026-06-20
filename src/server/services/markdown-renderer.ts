import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true,
        }).value;
        return `<pre class="hljs language-${lang}"><code>${highlighted}</code></pre>`;
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

// ── Plugin: Mermaid code blocks ────────────────────────────────────────────
// Fenced code blocks with language "mermaid" get a <pre class="mermaid"> tag
// that Mermaid.js picks up on the client side.
const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim() === "mermaid") {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

// ── Plugin: Auto-link bare URLs ───────────────────────────────────────────
// The linkify feature already handles this, but we ensure target="_blank"
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

export function renderMarkdown(content: string): string {
  return md.render(content);
}
