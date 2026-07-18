/// Shared UI component system for the Iris app.
///
/// Provides styled toast notifications and confirmation dialogs
/// that match the liquid glass design language.

import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'glass_theme.dart';

// ── Toast System ─────────────────────────────────────────────

/// Toast severity / visual style.
enum ToastStyle { success, error, warning, info }

/// Show a beautiful glassmorphism toast at the bottom of the screen.
///
/// Returns immediately; the toast auto-dismisses after [duration].
void showToast(
  BuildContext context,
  String message, {
  ToastStyle style = ToastStyle.info,
  Duration duration = const Duration(seconds: 3),
}) {
  final colors = _toastColors(style);

  final overlay = Overlay.of(context);
  late OverlayEntry entry;

  entry = OverlayEntry(
    builder: (_) => _ToastWidget(
      message: message,
      backgroundColor: colors.background,
      accentColor: colors.accent,
      icon: colors.icon,
      onDismiss: () => entry.remove(),
    ),
  );

  overlay.insert(entry);
  Future.delayed(duration, () {
    if (entry.mounted) entry.remove();
  });
}

/// Show a styled confirmation dialog. Returns `true` if confirmed.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Delete',
  String cancelLabel = 'Cancel',
  Color? confirmColor,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      content: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: kBgNearBlack.withOpacity(0.9),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: kWhite.withOpacity(0.08), width: 0.5),
              boxShadow: [
                BoxShadow(
                  color: kCrimson.withOpacity(0.12),
                  blurRadius: 40,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700, color: kWhite,
                )),
                const SizedBox(height: 12),
                Text(message, style: const TextStyle(
                  fontSize: 14, color: kWhite70, height: 1.5,
                )),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: Text(cancelLabel, style: const TextStyle(
                        color: kWhite54, fontWeight: FontWeight.w600,
                      )),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: (confirmColor ?? const Color(0xFFEF4444)).withOpacity(0.3),
                          width: 0.5,
                        ),
                      ),
                      child: TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: Text(confirmLabel, style: TextStyle(
                          color: confirmColor ?? const Color(0xFFEF4444),
                          fontWeight: FontWeight.w700,
                        )),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
  return result ?? false;
}

// ── Internal Toast Widget ───────────────────────────────────

class _ToastWidget extends StatefulWidget {
  final String message;
  final Color backgroundColor;
  final Color accentColor;
  final IconData icon;
  final VoidCallback onDismiss;

  const _ToastWidget({
    required this.message,
    required this.backgroundColor,
    required this.accentColor,
    required this.icon,
    required this.onDismiss,
  });

  @override
  State<_ToastWidget> createState() => _ToastWidgetState();
}

class _ToastWidgetState extends State<_ToastWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slideAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    _fadeAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 100,
      left: 20,
      right: 20,
      child: SlideTransition(
        position: _slideAnim,
        child: FadeTransition(
          opacity: _fadeAnim,
          child: GestureDetector(
            onTap: () {
              _controller.reverse().then((_) => widget.onDismiss());
            },
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: widget.backgroundColor,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: widget.accentColor.withOpacity(0.3),
                  width: 0.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: widget.accentColor.withOpacity(0.15),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: widget.accentColor.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(widget.icon, size: 16, color: widget.accentColor),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      widget.message,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        height: 1.3,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      _controller.reverse().then((_) => widget.onDismiss());
                    },
                    child: Icon(Icons.close, size: 16, color: Colors.white38),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  ),
);
  }
}

// ── Helpers ─────────────────────────────────────────────────

class _ToastColors {
  final Color background;
  final Color accent;
  final IconData icon;
  const _ToastColors({required this.background, required this.accent, required this.icon});
}

_ToastColors _toastColors(ToastStyle style) {
  switch (style) {
    case ToastStyle.success:
      return _ToastColors(
        background: const Color(0xFF0D1F0D),
        accent: const Color(0xFF22C55E),
        icon: Icons.check_circle_rounded,
      );
    case ToastStyle.error:
      return _ToastColors(
        background: const Color(0xFF1F0D0D),
        accent: const Color(0xFFEF4444),
        icon: Icons.error_rounded,
      );
    case ToastStyle.warning:
      return _ToastColors(
        background: const Color(0xFF1F1A0D),
        accent: const Color(0xFFFACC15),
        icon: Icons.warning_rounded,
      );
    case ToastStyle.info:
      return _ToastColors(
        background: const Color(0xFF0D111F),
        accent: const Color(0xFF60A5FA),
        icon: Icons.info_rounded,
      );
  }
}
