import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'glass_theme.dart';

class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final bool accent;
  final IconData? icon;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.accent = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: accent
                  ? [kCrimson.withValues(alpha: 0.1), kBgPureBlack.withValues(alpha: 0.2)]
                  : [kWhite.withValues(alpha: 0.04), kBgPureBlack.withValues(alpha: 0.1)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: accent ? kCrimson.withValues(alpha: 0.2) : kGlassBorder,
              width: 0.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 14, color: kWhite38),
                    const SizedBox(width: 6),
                  ],
                  Text(label.toUpperCase(), style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: kWhite54,
                    letterSpacing: 0.8,
                  )),
                ],
              ),
              const SizedBox(height: 12),
              Text(value, style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w800,
                color: accent ? kCrimson : kWhite,
                letterSpacing: -1,
              )),
            ],
          ),
        ),
      ),
    );
  }
}
