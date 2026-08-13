import 'dart:convert';
import 'package:markdown/markdown.dart' as md;

class RenderResult {
  final String? webViewHtml;
  final String statusMessage;
  final bool isError;

  const RenderResult({
    this.webViewHtml,
    this.statusMessage = '',
    this.isError = false,
  });

  bool get needsWebView => webViewHtml != null;
}

/// Renders artifact content (markdown, HTML, JSX) into a full HTML document
/// for display in a WebView.
///
/// Pipeline (inspired by markdown-it's token-based architecture):
///   1. Extract fenced code blocks (```...```) and inline code (`...`),
///      convert them to final HTML (<pre><code> / <code>), store them.
///   2. Extract math expressions ($...$, $$...$$, \(...\), \[...\]),
///      store them.
///   3. Run the remaining text through `package:markdown` (GFM).
///   4. Restore code HTML and math KaTeX spans.
class RenderService {
  static const String _csp =
      "default-src 'none'; "
      "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' "
      "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com "
      "https://esm.sh blob:; "
      "style-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com "
      "https://fonts.googleapis.com https://unpkg.com https://cdn.tailwindcss.com; "
      "font-src https://fonts.gstatic.com https://cdn.jsdelivr.net; "
      "img-src data: https:; "
      "connect-src 'self' https://esm.sh https://cdn.jsdelivr.net https://unpkg.com https://esm.sh; "
      "frame-src 'none'; "
      "object-src 'none';";

  // Separate placeholder prefixes to avoid collisions
  static const String _codePrefix = '\u00A7\u00A7LEOCODE';
  static const String _mathPrefix = '\u00A7\u00A7LEOMATH';
  static const String _suffix = '\u00A7\u00A7';

  Future<RenderResult> render({
    required String content,
    required String type,
    String title = 'Iris Artifact',
  }) async {
    if (content.trim().isEmpty) {
      return RenderResult(
        webViewHtml: _buildTemplate(
          title: title,
          body: '<p class="empty">This artifact is empty.</p>',
        ),
        statusMessage: 'Empty content',
      );
    }

    switch (type) {
      case 'html':
        return _renderHtml(content, title);
      case 'jsx':
        return _renderJsx(content, title);
      case 'md':
        return _renderMarkdown(content, title);
      default:
        return RenderResult(
          webViewHtml: _buildTemplate(
            title: title,
            body: '<pre><code>${_escapeHtml(content)}</code></pre>',
          ),
          statusMessage: 'Rendered as plain text',
        );
    }
  }

  RenderResult _renderHtml(String content, String title) {
    return RenderResult(
      webViewHtml: _buildTemplate(title: title, body: content),
      statusMessage: 'Rendered as HTML',
    );
  }

  // ── JSX Rendering Pipeline ─────────────────────────────────

  RenderResult _renderJsx(String content, String title) {
    final importMap = _buildJsxImportMap();
    // Only the "</" sequence needs escaping so it won't close the
    // <script> tag. The source lives in a <script type="text/plain">
    // element so no other escaping is required.
    final safeContent = content.replaceAll('</', '<\\/');
    final componentName = _detectJsxComponentName(content);
    final body = _buildJsxBody(safeContent, componentName, importMap);

    return RenderResult(
      webViewHtml: _buildTemplate(
        title: title,
        body: body,
        extraHead: _buildJsxHead(),
      ),
      statusMessage: 'Rendered JSX component',
    );
  }

  // ── JSX Helpers ────────────────────────────────────────────

  String _buildJsxHead() {
    return '<script src="https://unpkg.com/@babel/standalone@7.26.9/babel.min.js" crossorigin="anonymous"></script>';
  }

  Map<String, String> _buildJsxImportMap() {
    return {
      'react': 'https://esm.sh/react@18.3.1',
      'react/': 'https://esm.sh/react@18.3.1/',
      'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime',
      'react-dom': 'https://esm.sh/react-dom@18.3.1?deps=react@18.3.1',
      'react-dom/': 'https://esm.sh/react-dom@18.3.1/',
      'react-dom/client':
          'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1',
      '@react-three/fiber':
          'https://esm.sh/@react-three/fiber@8.17.10?deps=react@18.3.1',
      '@react-three/drei':
          'https://esm.sh/@react-three/drei@9.114.3?deps=react@18.3.1',
      'three': 'https://esm.sh/three@0.170.0',
      'framer-motion':
          'https://esm.sh/framer-motion@11.15.0?deps=react@18.3.1',
      'react-katex':
          'https://esm.sh/react-katex@3.0.1?deps=react@18.3.1&exports=InlineMath,BlockMath',
      'lucide-react':
          'https://esm.sh/lucide-react@0.468.0?deps=react@18.3.1',
      'katex': 'https://esm.sh/katex@0.16.11',
    };
  }

  String _detectJsxComponentName(String content) {
    final defaultExport = RegExp(
      r'export\s+default\s+(?:function\s+)?(\w+)',
      multiLine: true,
    );
    final match = defaultExport.firstMatch(content);
    if (match != null) return match.group(1)!;

    final funcDef = RegExp(r'function\s+(\w+)\s*\(', multiLine: true);
    final funcMatch = funcDef.firstMatch(content);
    if (funcMatch != null) return funcMatch.group(1)!;

    return 'App';
  }

  /// Produces the JSX body HTML: import map + hidden source element + a
  /// regular script that uses Babel Standalone to transform the JSX and
  /// injects the result as a <script type="module">.
  ///
  /// This avoids the Babel <script type="text/babel"> limitation that
  /// prevents proper ESM import-map resolution.  Instead:
  /// 1. The user code lives in a <script type="text/plain"> (never parsed).
  /// 2. A regular script calls Babel.transform() on it.
  /// 3. The transformed module code (with imports intact) is appended to
  ///    the DOM as <script type="module">, so the import map resolves
  ///    bare specifiers like 'react', '@react-three/fiber', etc.
  String _buildJsxBody(
    String safeContent,
    String componentName,
    Map<String, String> importMap,
  ) {
    final importMapJson = _escapeHtml(jsonEncode({'imports': importMap}));

    return '''<div id="root" style="width:100%;min-height:100vh;background:#0a0a0a;"></div>
<script id="__leo_source" type="text/plain">$safeContent</script>
<script type="importmap">$importMapJson</script>
<script>
(function() {
  var rootEl = document.getElementById('root');
  if (!rootEl) return;

  rootEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100px;color:#888;font-family:sans-serif">Loading\u2026</div>';

  function fail(title, msg) {
    rootEl.innerHTML = '<div style="padding:2rem;font-family:system-ui,sans-serif;color:#ef4444">'
      + '<h2 style="color:#ef4444;margin-bottom:0.5rem">' + title + '</h2>'
      + '<pre style="margin-top:0.5rem;overflow:auto;white-space:pre-wrap;font-size:0.85em;color:#cbd5e1;background:#1e293b;padding:1rem;border-radius:8px">'
      + msg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      + '</pre></div>';
  }

  try {
    var srcEl = document.getElementById('__leo_source');
    var src = srcEl ? srcEl.textContent : '';
    var result = Babel.transform(src, { presets: ['react'], filename: 'artifact.jsx' });

    var mount = result.code + '\\n'
      + 'import { createRoot } from "react-dom/client";\\n'
      + 'import React from "react";\\n'
      + '\\n'
      + '(function mount() {\\n'
      + '  var r = document.getElementById("root");\\n'
      + '  if (!r) return;\\n'
      + '  var App = typeof $componentName !== "undefined" ? $componentName : null;\\n'
      + '  if (!App) {\\n'
      + '    r.innerHTML = "<div style=\\"padding:2rem;font-family:sans-serif;color:#ef4444\\"><h2>Render Error</h2><p>Could not find default-exported component <strong>$componentName</strong>.</p><p style=\\"color:#999;font-size:0.9em\\">Try: export default function $componentName() { \\u2026 }</p></div>";\\n'
      + '    return;\\n'
      + '  }\\n'
      + '  try {\\n'
      + '    var root = createRoot(r);\\n'
      + '    root.render(React.createElement(App));\\n'
      + '  } catch (e) {\\n'
      + '    r.innerHTML = "<div style=\\"padding:2rem;font-family:monospace;color:#ef4444\\"><h2 style=\\"color:#ef4444\\">React Render Error</h2><pre style=\\"margin-top:1rem;overflow:auto;white-space:pre-wrap;font-size:0.85em;color:#cbd5e1;background:#1e293b;padding:1rem;border-radius:8px\\">" + (e.stack || String(e)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") + "</pre></div>";\\n'
      + '  }\\n'
      + '})();\\n';

    var script = document.createElement('script');
    script.type = 'module';
    script.textContent = mount;
    document.body.appendChild(script);
  } catch (e) {
    fail('Babel Transform Error', (e && e.message ? e.message : String(e)));
  }
})();
</script>''';
  }

  // ── Markdown Pipeline ────────────────────────────────────────

  RenderResult _renderMarkdown(String content, String title) {
    try {
      // Step 1: Extract code blocks → pre-rendered HTML, replace with placeholders
      final codeResult = _extractCodeBlocks(content);

      // Step 2: Extract math expressions → store, replace with placeholders
      final mathResult = _extractMath(codeResult.text);

      // Step 3: Run markdown-to-HTML on the remaining text
      final html = md.markdownToHtml(
        mathResult.text,
        extensionSet: md.ExtensionSet.gitHubFlavored,
      );

      // Step 4: Restore math placeholders → KaTeX spans
      final withMath = _restoreMath(html, mathResult.tokens);

      // Step 5: Restore code placeholders → pre-rendered HTML
      final finalHtml = _restoreCode(withMath, codeResult.tokens);

      return RenderResult(
        webViewHtml: _buildTemplate(title: title, body: finalHtml),
        statusMessage: 'Rendered markdown',
      );
    } catch (e) {
      return RenderResult(
        webViewHtml: _buildTemplate(
          title: title,
          body: '<pre><code>${_escapeHtml(content)}</code></pre>',
        ),
        statusMessage: 'Fallback render due to error: $e',
      );
    }
  }

  // ── Code Block Extraction ────────────────────────────────────

  /// Extracts fenced code blocks and inline code, converting them to
  /// final HTML immediately. Returns the text with placeholders and a
  /// map of placeholder → HTML.
  ({String text, Map<String, String> tokens}) _extractCodeBlocks(
      String content) {
    final tokens = <String, String>{};
    int index = 0;

    // 1. Fenced code blocks: ```lang\n...\n```
    String text = content.replaceAllMapped(
      RegExp(r'```(\S*)\s*\n([\s\S]*?)```'),
      (match) {
        final lang = match.group(1) ?? '';
        final code = match.group(2) ?? '';
        final key = '$_codePrefix$index$_suffix';
        final langAttr =
            lang.isNotEmpty ? ' class="language-${_escapeHtml(lang)}"' : '';
        tokens[key] =
            '<pre><code$langAttr>${_escapeHtml(code)}</code></pre>\n';
        index++;
        return key;
      },
    );

    // 2. Inline code: `code` (single-line only, no backticks inside)
    text = text.replaceAllMapped(
      RegExp(r'`([^`\n]+)`'),
      (match) {
        final code = match.group(1) ?? '';
        final key = '$_codePrefix$index$_suffix';
        tokens[key] = '<code>${_escapeHtml(code)}</code>';
        index++;
        return key;
      },
    );

    return (text: text, tokens: tokens);
  }

  /// Restores code placeholders with their pre-rendered HTML.
  /// Also unwraps any <p>...</p> that the markdown parser may have
  /// wrapped around a placeholder.
  String _restoreCode(String html, Map<String, String> tokens) {
    var result = html;
    for (final entry in tokens.entries) {
      // Unwrap <p>placeholder</p> → placeholder
      result = result.replaceAll(
        RegExp('<p>\\s*${RegExp.escape(entry.key)}\\s*</p>'),
        entry.key,
      );
      result = result.replaceAll(entry.key, entry.value);
    }
    return result;
  }

  // ── Math Expression Extraction ───────────────────────────────

  /// Extracts math expressions and stores them. Returns text with
  /// placeholders and a map of placeholder → math expression info.
  ({String text, Map<String, _MathToken> tokens}) _extractMath(
      String content) {
    final tokens = <String, _MathToken>{};
    final buf = StringBuffer();
    int index = 0;
    int i = 0;

    while (i < content.length) {
      final ch = content[i];

      // \[ ... \] display math
      if (ch == '\\' && i + 1 < content.length && content[i + 1] == '[') {
        final end = content.indexOf('\\]', i + 2);
        if (end != -1) {
          final expr = content.substring(i + 2, end);
          final key = '$_mathPrefix$index$_suffix';
          tokens[key] = _MathToken(expr, true);
          buf.write(key);
          index++;
          i = end + 2;
          continue;
        }
      }

      // \( ... \) inline math
      if (ch == '\\' && i + 1 < content.length && content[i + 1] == '(') {
        final end = content.indexOf('\\)', i + 2);
        if (end != -1) {
          final expr = content.substring(i + 2, end);
          final key = '$_mathPrefix$index$_suffix';
          tokens[key] = _MathToken(expr, false);
          buf.write(key);
          index++;
          i = end + 2;
          continue;
        }
      }

      // $$ ... $$ display math
      if (content.startsWith('\$\$', i)) {
        final end = content.indexOf('\$\$', i + 2);
        if (end != -1) {
          final expr = content.substring(i + 2, end);
          final key = '$_mathPrefix$index$_suffix';
          tokens[key] = _MathToken(expr, true);
          buf.write(key);
          index++;
          i = end + 2;
          continue;
        }
      }

      // $ ... $ inline math (single line, heuristic)
      if (ch == '\$') {
        // Skip $$ (already handled above)
        if (i + 1 < content.length && content[i + 1] == '\$') {
          buf.write(ch);
          i += 1;
          continue;
        }

        final lineEnd = content.indexOf('\n', i + 1);
        final searchEnd = lineEnd == -1 ? content.length : lineEnd;
        int closeIdx = -1;
        for (int j = i + 1; j < searchEnd; j++) {
          if (content[j] == '\$') {
            closeIdx = j;
            break;
          }
        }

        if (closeIdx != -1) {
          final inner = content.substring(i + 1, closeIdx);
          // Heuristic: must be non-empty, not start/end with space,
          // not a bare currency amount like $5 or $1,000
          final looksLikeMath = inner.isNotEmpty &&
              !inner.startsWith(' ') &&
              !inner.endsWith(' ') &&
              !RegExp(r'^\d[\d,]*(\.\d+)?$').hasMatch(inner.trim());
          if (looksLikeMath) {
            final key = '$_mathPrefix$index$_suffix';
            tokens[key] = _MathToken(inner, false);
            buf.write(key);
            index++;
            i = closeIdx + 1;
            continue;
          }
        }
      }

      buf.write(ch);
      i += 1;
    }

    return (text: buf.toString(), tokens: tokens);
  }

  /// Restores math placeholders with KaTeX HTML spans.
  String _restoreMath(String html, Map<String, _MathToken> tokens) {
    var result = html;
    for (final entry in tokens.entries) {
      // Unwrap <p>placeholder</p> and <em>placeholder</em> wrappers the
      // markdown parser adds around a placeholder token, so display math
      // is not trapped inside a paragraph and inline math is not italic.
      result = result.replaceAll(
        RegExp('<p>\\s*${RegExp.escape(entry.key)}\\s*</p>'),
        entry.key,
      );
      result = result.replaceAll(
        RegExp('<em>${RegExp.escape(entry.key)}</em>'),
        entry.key,
      );
      final escaped = _escapeHtml(entry.value.expression);
      final display =
          entry.value.displayMode ? 'math-display' : 'math-inline';
      final tag = '<span class="math $display" data-math="$escaped"></span>';
      result = result.replaceAll(entry.key, tag);
    }
    return result;
  }

  // ── HTML Template ────────────────────────────────────────────

  String _buildTemplate({
    required String title,
    required String body,
    String extraHead = '',
  }) {
    final escapedTitle = _escapeHtml(title);
    final safeBody =
        body.trim().isEmpty ? '<p class="empty">Nothing to display.</p>' : body;

    return '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
  <meta http-equiv="Content-Security-Policy" content="$_csp" />
  <meta name="theme-color" content="#0a0a0a" />
  <title>$escapedTitle</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github-dark.min.css" crossorigin="anonymous" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      margin: 0;
      padding: 16px;
      background: #0a0a0a;
      color: #f5f5f5;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.7;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      overflow-wrap: anywhere;
    }
    a { color: #7db8ff; }
    a:hover { text-decoration: underline; }
    strong, b { color: #ffffff; font-weight: 700; }
    em, i { font-style: italic; }
    h1, h2, h3, h4 { line-height: 1.3; margin: 1.2em 0 0.5em; }
    h1 { font-size: 1.6rem; }
    h2 { font-size: 1.35rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.3em; }
    h3 { font-size: 1.15rem; }
    p { margin: 0.7em 0; }
    ul, ol { padding-left: 1.3em; margin: 0.7em 0; }
    li { margin: 0.25em 0; }
    blockquote {
      margin: 1em 0;
      padding: 0.7em 1em;
      border-left: 3px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.04);
      border-radius: 0 8px 8px 0;
      color: #c7c7c7;
    }
    pre {
      background: #111111;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 0;
      overflow: auto;
      margin: 1em 0;
    }
    pre code {
      display: block;
      padding: 1em;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.92rem;
      line-height: 1.55;
      white-space: pre;
    }
    code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      background: rgba(255,255,255,0.08);
      padding: 0.16em 0.4em;
      border-radius: 4px;
      font-size: 0.92em;
    }
    table { border-collapse: collapse; margin: 1em 0; width: 100%; }
    th, td { border: 1px solid rgba(255,255,255,0.12); padding: 0.5em 0.8em; text-align: left; }
    th { background: rgba(255,255,255,0.06); font-weight: 600; }
    hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5em 0; }
    img { max-width: 100%; border-radius: 6px; }
    .empty { color: #8b8b8b; font-style: italic; }
    .hint { color: #8d8d8d; font-size: 0.95rem; }
    .math { display: inline-block; }
    .math-display { display: block; overflow-x: auto; margin: 1em 0; text-align: center; }
    .math-error { color: #ff8a8a; }
  </style>
  $extraHead
</head>
<body>
  $safeBody
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js" crossorigin="anonymous"></script>
  <script>
    window.addEventListener('DOMContentLoaded', function () {
      if (window.katex) {
        document.querySelectorAll('.math[data-math]').forEach(function (el) {
          var expr = el.getAttribute('data-math') || '';
          var displayMode = el.classList.contains('math-display');
          try {
            el.innerHTML = window.katex.renderToString(expr, {
              displayMode: displayMode,
              throwOnError: false,
              strict: false
            });
          } catch (e) {
            el.textContent = '\u0024' + expr + '\u0024';
            el.classList.add('math-error');
          }
        });
      }
      if (window.hljs) {
        document.querySelectorAll('pre code').forEach(function (block) {
          window.hljs.highlightElement(block);
        });
      }
    });
  </script>
</body>
</html>
''';
  }

  String _escapeHtml(String value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
  }
}

class _MathToken {
  final String expression;
  final bool displayMode;

  const _MathToken(this.expression, this.displayMode);
}
