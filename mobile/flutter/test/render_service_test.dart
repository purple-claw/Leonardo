import 'package:flutter_test/flutter_test.dart';
import 'package:leonardo_mobile/src/render_service.dart';

void main() {
  final service = RenderService();

  group('Basic markdown', () {
    test('renders bold and italic text', () async {
      final r = await service.render(
        content: 'Hello **world** and *italic* text',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<strong>world</strong>'));
      expect(r.webViewHtml, contains('<em>italic</em>'));
    });

    test('renders accented and special characters', () async {
      final r = await service.render(
        content: 'Café, résumé, naïve, piñata — em-dash & ampersand',
        type: 'md',
      );
      expect(r.webViewHtml, contains('Café'));
      expect(r.webViewHtml, contains('résumé'));
      expect(r.webViewHtml, contains('naïve'));
      expect(r.webViewHtml, contains('piñata'));
      expect(r.webViewHtml, contains('—'));
      expect(r.webViewHtml, contains('&amp;'));
    });

    test('renders headings', () async {
      final r = await service.render(
        content: '# H1\n## H2\n### H3',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<h1>'));
      expect(r.webViewHtml, contains('H1'));
      expect(r.webViewHtml, contains('<h2>'));
      expect(r.webViewHtml, contains('H2'));
      expect(r.webViewHtml, contains('<h3>'));
      expect(r.webViewHtml, contains('H3'));
    });

    test('renders links', () async {
      final r = await service.render(
        content: '[Click here](https://example.com)',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<a'));
      expect(r.webViewHtml, contains('https://example.com'));
      expect(r.webViewHtml, contains('Click here'));
    });

    test('renders unordered lists', () async {
      final r = await service.render(
        content: '- Item 1\n- Item 2\n- Item 3',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<ul>'));
      expect(r.webViewHtml, contains('<li>Item 1</li>'));
      expect(r.webViewHtml, contains('<li>Item 2</li>'));
      expect(r.webViewHtml, contains('<li>Item 3</li>'));
      expect(r.webViewHtml, contains('</ul>'));
    });

    test('renders ordered lists', () async {
      final r = await service.render(
        content: '1. First\n2. Second\n3. Third',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<ol>'));
      expect(r.webViewHtml, contains('<li>First</li>'));
      expect(r.webViewHtml, contains('<li>Second</li>'));
      expect(r.webViewHtml, contains('<li>Third</li>'));
      expect(r.webViewHtml, contains('</ol>'));
    });

    test('renders blockquotes', () async {
      final r = await service.render(
        content: '> This is a blockquote\n> Multiple lines',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<blockquote>'));
      expect(r.webViewHtml, contains('This is a blockquote'));
    });

    test('renders horizontal rules', () async {
      final r = await service.render(
        content: 'Text\n\n---\n\nMore text',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<hr'));
    });

    test('renders strikethrough (GFM)', () async {
      final r = await service.render(
        content: 'This is ~~deleted~~ text',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<del>'));
      expect(r.webViewHtml, contains('deleted'));
    });

    test('renders tables (GFM)', () async {
      final r = await service.render(
        content: '| A | B |\n|---|---|\n| 1 | 2 |',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<table>'));
      expect(r.webViewHtml, contains('<th>A</th>'));
      expect(r.webViewHtml, contains('<td>1</td>'));
    });
  });

  group('Code blocks', () {
    test('renders fenced code blocks', () async {
      final r = await service.render(
        content: '```dart\nvoid main() {\n  print("hello");\n}\n```',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<pre>'));
      expect(r.webViewHtml, contains('<code'));
      expect(r.webViewHtml, contains('language-dart'));
      expect(r.webViewHtml, contains('print'));
      expect(r.webViewHtml, contains('hello'));
    });

    test('renders inline code', () async {
      final r = await service.render(
        content: 'Use the `print()` function.',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<code>print()</code>'));
    });

    test('code blocks do not corrupt math inside them', () async {
      final r = await service.render(
        content: '```\n\u0024x = 5\u0024  # this dollar is not math\n```\n\nOutside: \u0024y = 3\u0024',
        type: 'md',
      );
      // The code block should contain the literal $x = 5$
      expect(r.webViewHtml, contains('\u0024x = 5\u0024'));
      // The outside math should have a data-math attribute
      expect(r.webViewHtml, contains('data-math'));
    });
  });

  group('Math rendering', () {
    test('renders inline math with dollar signs', () async {
      final r = await service.render(
        content: 'Inline math \u0024x^2 + y^2 = z^2\u0024 is beautiful.',
        type: 'md',
      );
      expect(r.webViewHtml, contains('data-math'));
      expect(r.webViewHtml, contains('math-inline'));
    });

    test('renders display math with double dollar signs', () async {
      final r = await service.render(
        content: 'Display math:\n\u0024\u0024\\\\frac{a}{b}\u0024\u0024',
        type: 'md',
      );
      expect(r.webViewHtml, contains('data-math'));
      expect(r.webViewHtml, contains('math-display'));
    });

    test('renders display math with \\[...\\]', () async {
      final r = await service.render(
        content: r'Display: \[\int_a^b f(x)\,dx\]',
        type: 'md',
      );
      expect(r.webViewHtml, contains('data-math'));
      expect(r.webViewHtml, contains('math-display'));
    });

    test('renders inline math with \\(...\\)', () async {
      final r = await service.render(
        content: r'Inline: \(E = mc^2\) is famous.',
        type: 'md',
      );
      expect(r.webViewHtml, contains('data-math'));
      expect(r.webViewHtml, contains('math-inline'));
    });

    test('does not treat currency as math', () async {
      final r = await service.render(
        content: 'Price is \u00245.99 and \u00241,000.',
        type: 'md',
      );
      // Currency amounts should NOT have data-math
      expect(r.webViewHtml, contains('\u00245.99'));
    });

    test('math with special HTML characters', () async {
      final r = await service.render(
        content: 'Math: \u0024a < b\u0024 and \u0024x > y\u0024',
        type: 'md',
      );
      expect(r.webViewHtml, contains('data-math'));
      // The HTML should not have literal < or > in the math expression
      // They should be escaped in data-math attribute
      expect(r.webViewHtml, contains('a &lt; b'));
    });
  });

  group('Math wrappers', () {
    test('display math on its own line is not wrapped in <p>', () async {
      final r = await service.render(
        content: 'Before\n\n\u0024\u0024x = 1\u0024\u0024\n\nAfter',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<span class="math math-display" data-math="x = 1">'));
      expect(r.webViewHtml, isNot(contains('<p><span class="math math-display"')));
      expect(r.webViewHtml, isNot(contains('<em><span class="math math-display"')));
    });

    test('inline math next to emphasis is not italicized', () async {
      final r = await service.render(
        content: 'Before *\u0024x\u0024* after',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<span class="math math-inline" data-math="x">'));
      expect(r.webViewHtml, isNot(contains('<em><span class="math math-inline"')));
    });

    test('emphasis around math still renders the emphasis text', () async {
      final r = await service.render(
        content: 'Look at *this \u0024x\u0024 is math* inline',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<em>this '));
      expect(r.webViewHtml, contains(' is math</em>'));
    });
  });

  group('Code safety', () {
    test('fenced code language attribute is escaped', () async {
      final r = await service.render(
        content: '```js" onmouseover="alert(1)\nvar x = 1;\n```',
        type: 'md',
      );
      expect(r.webViewHtml, contains('language-js&quot;'));
      expect(r.webViewHtml, isNot(contains('class="language-js"')));
      expect(r.webViewHtml, contains('var x = 1;'));
    });
  });

  group('Footnotes', () {
    test('footnote definitions render as blockquote text', () async {
      final r = await service.render(
        content: 'Here is a note[^1].\n\n[^1]: The note body.',
        type: 'md',
      );
      expect(r.webViewHtml, contains('The note body.'));
    });
  });

  group('Mixed content', () {
    test('renders complex document with headings, code, math, lists', () async {
      final r = await service.render(
        content: '''# My Document

## Introduction

This is a **paragraph** with *formatting* and \u0024E = mc^2\u0024.

## Code Example

```python
def hello():
    print("Hello, World!")
```

## Math

\u0024\u0024\\\\sum_{n=1}^{\\\\infty} \\\\frac{1}{n^2} = \\\\frac{\\\\pi^2}{6}\u0024\u0024

## List

- Item with **bold**
- Item with \u0024x^2\u0024
- Item with `code`

> A wise quote.

| Name | Value |
|------|-------|
| Alpha | 1 |
| Beta  | 2 |''',
        type: 'md',
      );
      expect(r.webViewHtml, contains('<h1>My Document</h1>'));
      expect(r.webViewHtml, contains('<h2>Introduction</h2>'));
      expect(r.webViewHtml, contains('<strong>paragraph</strong>'));
      expect(r.webViewHtml, contains('<em>formatting</em>'));
      expect(r.webViewHtml, contains('data-math')); // math
      expect(r.webViewHtml, contains('language-python')); // code lang
      expect(r.webViewHtml, contains('Hello, World!')); // code content
      expect(r.webViewHtml, contains('<blockquote>')); // blockquote
      expect(r.webViewHtml, contains('<table>')); // table
      expect(r.webViewHtml, contains('<th>Name</th>')); // table header
      expect(r.webViewHtml, contains('<td>1</td>')); // table cell
      expect(r.webViewHtml, contains('katex.min.js')); // KaTeX loaded
      expect(r.webViewHtml, contains('highlight.min.js')); // hljs loaded
    });
  });

  group('Edge cases', () {
    test('handles empty content', () async {
      final r = await service.render(content: '', type: 'md');
      expect(r.webViewHtml, contains('empty'));
    });

    test('handles content with only whitespace', () async {
      final r = await service.render(content: '   ', type: 'md');
      expect(r.webViewHtml, contains('empty'));
    });

    test('handles HTML type', () async {
      final r = await service.render(
        content: '<div class="test">Hello</div>',
        type: 'html',
      );
      expect(r.webViewHtml, contains('<div class="test">Hello</div>'));
    });

    test('handles unknown type as plain text', () async {
      final r = await service.render(
        content: 'Just some text',
        type: 'txt',
      );
      expect(r.webViewHtml, contains('<code>Just some text</code>'));
    });

    test('handles JSX type with full babel pipeline', () async {
      final r = await service.render(
        content: 'const x = <div>hello</div>;',
        type: 'jsx',
      );
      // Should produce a full WebView template with Babel + import map + mount script
      expect(r.webViewHtml, contains('__leo_source'));
      expect(r.webViewHtml, contains('babel.min.js'));
      expect(r.webViewHtml, contains('import { createRoot }'));
      expect(r.webViewHtml, contains('Babel.transform'));
    });
  });
}
