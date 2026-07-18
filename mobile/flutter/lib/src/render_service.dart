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
      "script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
      "style-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; "
      "font-src https://fonts.gstatic.com https://cdn.jsdelivr.net; "
      "img-src data: https:; "
      "connect-src https:; "
      "frame-src 'none'; "
      "object-src 'none';";

  // Separate placeholder prefixes to avoid collisions
  static const String _codePrefix = '\u00A7\u00A7LEOCODE';
  static const String _mathPrefix = '\u00A7\u00A7LEOMATH';
  static const String _suffix = '\u00A7\u00A7';

  Future<RenderResult> render({
    required String content,
    required String type,
    String title = 'Leonardo Artifact',
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

  RenderResult _renderJsx(String content, String title) {
    final escapedBody = _escapeHtml(content);
    return RenderResult(
      webViewHtml: _buildTemplate(
        title: title,
        body: '<pre><code>$escapedBody</code></pre><p class="hint">JSX preview is not available in this renderer yet.</p>',
      ),
      statusMessage: 'Rendered as text fallback',
    );
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
        final langAttr = lang.isNotEmpty ? ' class="language-$lang"' : '';
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
      final escaped = _escapeHtml(entry.value.expression);
      final display =
          entry.value.displayMode ? 'math-display' : 'math-inline';
      final tag = '<span class="math $display" data-math="$escaped"></span>';
      result = result.replaceAll(entry.key, tag);
    }
    return result;
  }

  // ── HTML Template ────────────────────────────────────────────

  String _buildTemplate({required String title, required String body}) {
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
