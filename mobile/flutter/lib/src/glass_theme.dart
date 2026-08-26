/// Liquid-glass design system for Iris.
///
/// Pure black backgrounds, frosted glass cards with `BackdropFilter`,
/// crimson red ultra-thin accent borders, and glow effects.

import 'dart:ui' as ui;
import 'package:flutter/material.dart';

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════

const Color kBgPureBlack = Color(0xFF000000);
const Color kBgNearBlack = Color(0xFF040404);
const Color kCrimson = Color(0xFFDC143C);
const Color kCrimsonDark = Color(0xFF8B0000);
const Color kWhite = Colors.white;
const Color kWhite70 = Color(0xB3FFFFFF);
const Color kWhite54 = Color(0x8AFFFFFF);
const Color kWhite38 = Color(0x61FFFFFF);
const Color kWhite24 = Color(0x3DFFFFFF);
const Color kWhite12 = Color(0x1FFFFFFF);
const Color kWhite08 = Color(0x14FFFFFF);
const Color kWhite04 = Color(0x0AFFFFFF);
const Color kCrimsonGlass = Color(0x1ADC143C);
const Color kCrimsonBorder = Color(0x33DC143C);
const Color kCrimsonGlow = Color(0x22DC143C);
const Color kGlassBase = Color(0x0FFFFFFF);
const Color kGlassBorder = Color(0x12FFFFFF);

/// Standard glass card border radius.
const double kRadiusCard = 20.0;
const double kRadiusSmall = 12.0;
const double kRadiusTiny = 8.0;

// ═══════════════════════════════════════════════════════════════
//  Glass Decoration Helpers
// ═══════════════════════════════════════════════════════════════

/// Frosted glass decoration (use inside a [ClipRRect] + [BackdropFilter]).
BoxDecoration glassDeco({
  double opacity = 0.06,
  Color? borderColor,
  double borderWidth = 0.5,
  double radius = kRadiusCard,
  List<BoxShadow>? shadows,
}) {
  return BoxDecoration(
    color: Colors.white.withValues(alpha: opacity),
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(
      color: borderColor ?? kGlassBorder,
      width: borderWidth,
    ),
    boxShadow: shadows,
  );
}

/// Glass decoration with a crimson glow (for active/selected state).
BoxDecoration glassDecoActive({
  double opacity = 0.08,
  double borderWidth = 0.8,
  double radius = kRadiusCard,
  double glowRadius = 24,
}) {
  return BoxDecoration(
    color: kCrimson.withValues(alpha: opacity),
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(
      color: kCrimson.withValues(alpha: 0.4),
      width: borderWidth,
    ),
    boxShadow: [
      BoxShadow(
        color: kCrimson.withValues(alpha: 0.25),
        blurRadius: glowRadius,
        offset: const Offset(0, 6),
      ),
    ],
  );
}

/// Crimson gradient overlay decoration (for hero sections).
BoxDecoration glassGradientDeco({
  double radius = kRadiusCard,
  bool accent = false,
}) {
  return BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: accent
          ? [kCrimson.withValues(alpha: 0.12), kBgPureBlack.withValues(alpha: 0.2)]
          : [kWhite.withValues(alpha: 0.04), kBgPureBlack.withValues(alpha: 0.1)],
    ),
    borderRadius: BorderRadius.circular(radius),
    border: Border.all(
      color: accent ? kCrimson.withValues(alpha: 0.2) : kGlassBorder,
      width: 0.5,
    ),
  );
}

/// Crimson glow box shadow list.
List<BoxShadow> crimsonGlow({double blur = 24, double opacity = 0.2}) {
  return [
    BoxShadow(
      color: kCrimson.withValues(alpha: opacity),
      blurRadius: blur,
      offset: const Offset(0, 6),
    ),
  ];
}

// ═══════════════════════════════════════════════════════════════
//  GlassCard Widget
// ═══════════════════════════════════════════════════════════════

/// A frosted-glass card with optional crimson accent border and glow.
///
/// Wraps [child] in a [ClipRRect] + [BackdropFilter] for true glass effect,
/// then applies [glassDeco] or [glassDecoActive] styling.
class GlassCard extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final bool active;
  final double glassOpacity;
  final double borderWidth;
  final Color? borderColor;
  final List<BoxShadow>? shadows;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final Gradient? gradient;

  const GlassCard({
    super.key,
    required this.child,
    this.radius = kRadiusCard,
    this.padding = const EdgeInsets.all(20),
    this.margin = EdgeInsets.zero,
    this.active = false,
    this.glassOpacity = 0.06,
    this.borderWidth = 0.5,
    this.borderColor,
    this.shadows,
    this.onTap,
    this.onLongPress,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    Widget inner = ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: padding,
          decoration: active
              ? glassDecoActive(
                  opacity: glassOpacity,
                  borderWidth: borderWidth,
                  radius: radius,
                )
              : (gradient != null
                  ? BoxDecoration(
                      gradient: gradient,
                      borderRadius: BorderRadius.circular(radius),
                      border: Border.all(
                        color: borderColor ?? kGlassBorder,
                        width: borderWidth,
                      ),
                      boxShadow: shadows,
                    )
                  : glassDeco(
                      opacity: glassOpacity,
                      borderColor: borderColor,
                      borderWidth: borderWidth,
                      radius: radius,
                      shadows: shadows,
                    )),
          child: child,
        ),
      ),
    );

    if (onTap != null || onLongPress != null) {
      inner = GestureDetector(
        onTap: onTap,
        onLongPress: onLongPress,
        child: inner,
      );
    }

    if (margin != EdgeInsets.zero) {
      inner = Padding(padding: margin, child: inner);
    }

    return inner;
  }
}

// ═══════════════════════════════════════════════════════════════
//  GlassButton
// ═══════════════════════════════════════════════════════════════

/// A sleek glass-styled button with crimson accent and glow.
class GlassButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool loading;
  final double radius;
  final EdgeInsetsGeometry padding;

  const GlassButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.loading = false,
    this.radius = 16,
    this.padding = const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null || loading;
    return GestureDetector(
      onTap: disabled ? null : onPressed,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: disabled
                ? [kWhite.withValues(alpha: 0.04), kWhite.withValues(alpha: 0.02)]
                : [kCrimson.withValues(alpha: 0.9), kCrimsonDark.withValues(alpha: 0.8)],
          ),
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(
            color: disabled
                ? kWhite.withValues(alpha: 0.08)
                : kCrimson.withValues(alpha: 0.5),
            width: disabled ? 0.5 : 0.8,
          ),
          boxShadow: disabled
              ? null
              : [
                  BoxShadow(
                    color: kCrimson.withValues(alpha: 0.35),
                    blurRadius: 20,
                    offset: const Offset(0, 6),
                  ),
                ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(radius),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 6, sigmaY: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (loading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: kWhite,
                    ),
                  )
                else ...[
                  if (icon != null) ...[
                    Icon(icon, size: 18, color: kWhite),
                    const SizedBox(width: 8),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: kWhite,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  GlassInputDecoration
// ═══════════════════════════════════════════════════════════════

/// Glass-styled input decoration builder.
InputDecoration glassInputDec({
  String? label,
  String? hint,
  String? prefixText,
  Widget? prefixIcon,
  Widget? suffixIcon,
}) {
  return InputDecoration(
    labelText: label,
    hintText: hint,
    prefixText: prefixText,
    prefixIcon: prefixIcon,
    suffixIcon: suffixIcon,
    filled: true,
    fillColor: kWhite04,
    labelStyle: const TextStyle(color: kWhite54, fontSize: 13),
    hintStyle: const TextStyle(color: kWhite38, fontSize: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(kRadiusSmall),
      borderSide: const BorderSide(color: kGlassBorder, width: 0.5),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(kRadiusSmall),
      borderSide: const BorderSide(color: kGlassBorder, width: 0.5),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(kRadiusSmall),
      borderSide: const BorderSide(color: kCrimsonBorder, width: 0.8),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(kRadiusSmall),
      borderSide: const BorderSide(color: Color(0x44EF4444), width: 0.8),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  );
}

// ═══════════════════════════════════════════════════════════════
//  Section Header
// ═══════════════════════════════════════════════════════════════

/// Reusable section header with optional "View all" action.
class SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onViewAll;
  final String? viewAllLabel;

  const SectionHeader({
    super.key,
    required this.title,
    this.onViewAll,
    this.viewAllLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            color: kCrimson,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: kWhite,
          ),
        ),
        const Spacer(),
        if (onViewAll != null)
          TextButton(
            onPressed: onViewAll,
            child: Text(
              viewAllLabel ?? 'View all',
              style: const TextStyle(
                color: kWhite54,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  Glass Divider
// ═══════════════════════════════════════════════════════════════

class GlassDivider extends StatelessWidget {
  final double thickness;
  const GlassDivider({super.key, this.thickness = 0.5});

  @override
  Widget build(BuildContext context) {
    return Divider(
      color: kWhite.withValues(alpha: 0.06),
      thickness: thickness,
      height: 1,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  Sheet Handle (for bottom sheets)
// ═══════════════════════════════════════════════════════════════

class SheetHandle extends StatelessWidget {
  const SheetHandle({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      width: 40,
      height: 4,
      decoration: BoxDecoration(
        color: kWhite.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  Glass Sheet Wrapper
// ═══════════════════════════════════════════════════════════════

/// Wraps bottom-sheet content with glass styling.
class GlassSheet extends StatelessWidget {
  final Widget child;
  const GlassSheet({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: kBgNearBlack.withValues(alpha: 0.92),
            border: Border(
              top: BorderSide(
                color: kWhite.withValues(alpha: 0.06),
                width: 0.5,
              ),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
