import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'models.dart';
import 'render_service.dart';
import 'ui_utils.dart';

class ArtifactViewerPage extends StatefulWidget {
  static const routeName = '/viewer';
  final Artifact artifact;

  const ArtifactViewerPage({super.key, required this.artifact});

  @override
  State<ArtifactViewerPage> createState() => _ArtifactViewerPageState();
}

class _ArtifactViewerPageState extends State<ArtifactViewerPage> {
  late final RenderService _renderService;
  RenderResult? _renderResult;
  WebViewController? _webViewController;
  bool _renderReady = false;
  String? _renderError;

  @override
  void initState() {
    super.initState();
    _renderService = RenderService();
    _initRender();
  }

  Future<void> _initRender() async {
    try {
      final result = await _renderService.render(
        content: widget.artifact.content,
        type: widget.artifact.type,
        title: widget.artifact.title,
      );
      if (!mounted) return;
      setState(() {
        _renderResult = result;
        _renderError = null;
      });
      if (result.needsWebView && result.webViewHtml != null) {
        _setupWebView(result.webViewHtml!);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _renderError = '$e');
    }
  }

  void _setupWebView(String html) {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _renderReady = true);
          },
          onWebResourceError: (err) {
            // Only treat main-frame errors as fatal. Sub-resource failures
            // (CDN scripts, images, etc.) should not break the whole view.
            if (err.isForMainFrame == true && mounted) {
              setState(() => _renderError = err.description);
            }
          },
          onNavigationRequest: (request) {
            if (!request.url.startsWith('about:') &&
                !request.url.startsWith('data:')) {
              launchUrl(Uri.parse(request.url), mode: LaunchMode.externalApplication);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      // Use about:blank as base URL to avoid Android WebView attempting
      // a real network connection to the origin. All resource URLs in the
      // rendered HTML are absolute CDN paths, so no base URL is needed.
      ..loadHtmlString(html, baseUrl: 'about:blank');
    _webViewController = controller;
  }

  @override
  Widget build(BuildContext context) {
    final art = widget.artifact;

    return Scaffold(
      appBar: AppBar(
        title: Text(art.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.copy_outlined),
            tooltip: 'Copy content',
            onPressed: _copyContent,
          ),
        ],
      ),
      body: _buildPreview(),
    );
  }

  Widget _buildPreview() {
    if (_renderError != null) {
      return _buildErrorState();
    }

    if (_renderResult == null) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: Color(0xFFDC143C)),
            SizedBox(height: 12),
            Text('Rendering...', style: TextStyle(color: Colors.white54, fontSize: 14)),
          ],
        ),
      );
    }

    // WebView rendering (all content types go through WebView for
    // consistent KaTeX + highlight.js support)
    if (_renderResult!.needsWebView) {
      return _buildWebViewPreview();
    }

    // Fallback: render as rich text
    return _buildFallbackView();
  }

  Widget _buildWebViewPreview() {
    if (_webViewController == null) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFDC143C)),
      );
    }

    return Stack(
      children: [
        WebViewWidget(controller: _webViewController!),
        if (!_renderReady)
          const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: Color(0xFFDC143C)),
                SizedBox(height: 12),
                Text('Loading preview...', style: TextStyle(color: Colors.white54, fontSize: 14)),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildFallbackView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF0A0A0A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withOpacity(0.06)),
        ),
        child: SelectableText(
          widget.artifact.content,
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 13,
            height: 1.6,
            color: Color(0xFFE0E0E0),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Color(0xFFEF4444)),
            const SizedBox(height: 16),
            const Text('Render Error',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(_renderError ?? 'Unknown error',
              style: const TextStyle(color: Colors.white60, fontSize: 14),
              textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                setState(() {
                  _renderError = null;
                  _renderResult = null;
                  _renderReady = false;
                });
                _initRender();
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  void _copyContent() {
    Clipboard.setData(ClipboardData(text: widget.artifact.content));
    showToast(context, 'Content copied', style: ToastStyle.success);
  }
}
