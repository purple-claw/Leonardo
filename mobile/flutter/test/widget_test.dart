import 'package:flutter_test/flutter_test.dart';
import 'package:leonardo_mobile/app.dart';
import 'package:leonardo_mobile/src/render_service.dart';

void main() {
  testWidgets('IrisApp smoke test - app builds without error', (tester) async {
    await tester.pumpWidget(const IrisApp());
    expect(find.byType(IrisApp), findsOneWidget);
    // Advance past SplashPage 3s delay to clear timer and allow navigation.
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    // Should have navigated to LoginPage (no auth)
    expect(find.byType(IrisApp), findsOneWidget);
  });

  group('RenderService smoke in widget context', () {
    test('render service handles all three types', () async {
      final svc = RenderService();
      final md = await svc.render(content: '# Hello', type: 'md');
      expect(md.webViewHtml, contains('Hello'));
      final html = await svc.render(content: '<b>hi</b>', type: 'html');
      expect(html.webViewHtml, contains('<b>hi</b>'));
      final jsx = await svc.render(
        content: 'export default function App(){return <div>hi</div>}',
        type: 'jsx',
      );
      expect(jsx.webViewHtml, contains('Babel'));
    });
  });
}
