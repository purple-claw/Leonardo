import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart' as android_webview;
import 'models.dart';
import 'render_service.dart';
import 'ui_utils.dart';
import 'glass_theme.dart';

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
      ..setBackgroundColor(const Color(0xFF0A0A0A))
      ..enableZoom(true)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _renderReady = true);
          },
          onWebResourceError: (err) {
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
      ..loadHtmlString(html, baseUrl: 'about:blank');

    // Android-specific WebView configuration.
    final androidController = controller.platform as android_webview.AndroidWebViewController;
    androidController.setMediaPlaybackRequiresUserGesture(false);
    androidController.setTextZoom(100);
    androidController.setUseWideViewPort(true);
    androidController.setMixedContentMode(android_webview.MixedContentMode.alwaysAllow);
    androidController.setAllowFileAccess(false);
    androidController.setAllowContentAccess(false);

    _webViewController = controller;
  }

  @override
  Widget build(BuildContext context) {
    final art = widget.artifact;

    return Scaffold(
      backgroundColor: kBgPureBlack,
      appBar: AppBar(
        backgroundColor: kBgNearBlack,
        title: Text(art.title, style: const TextStyle(color: kWhite)),
        iconTheme: const IconThemeData(color: kWhite70),
        actions: [
          IconButton(
            icon: const Icon(Icons.copy_outlined, color: kWhite54),
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
            CircularProgressIndicator(color: kCrimson),
            SizedBox(height: 12),
            Text('Rendering...', style: TextStyle(color: kWhite54, fontSize: 14)),
          ],
        ),
      );
    }

    if (_renderResult!.needsWebView) {
      return _buildWebViewPreview();
    }

    return _buildFallbackView();
  }

  Widget _buildWebViewPreview() {
    if (_webViewController == null) {
      return const Center(
        child: CircularProgressIndicator(color: kCrimson),
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
                CircularProgressIndicator(color: kCrimson),
                SizedBox(height: 12),
                Text('Loading preview...', style: TextStyle(color: kWhite54, fontSize: 14)),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildFallbackView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(kRadiusSmall),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: glassDeco(radius: kRadiusSmall),
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
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: kWhite)),
            const SizedBox(height: 8),
            Text(_renderError ?? 'Unknown error',
              style: const TextStyle(color: kWhite54, fontSize: 14),
              textAlign: TextAlign.center),
            const SizedBox(height: 16),
            GlassButton(
              label: 'Retry',
              onPressed: () {
                setState(() {
                  _renderError = null;
                  _renderResult = null;
                  _renderReady = false;
                });
                _initRender();
              },
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
