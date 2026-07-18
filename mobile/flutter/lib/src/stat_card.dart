import 'package:flutter/material.dart';

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
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: accent
            ? const LinearGradient(colors: [Color(0x1FDC143C), Color(0x10000000)])
            : const LinearGradient(colors: [Color(0x14FFFFFF), Color(0x10FFFFFF)]),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 14, color: Colors.white38),
                const SizedBox(width: 6),
              ],
              Text(label.toUpperCase(), style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.white54,
                letterSpacing: 0.8,
              )),
            ],
          ),
          const SizedBox(height: 12),
          Text(value, style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w800,
            color: accent ? const Color(0xFFDC143C) : Colors.white,
            letterSpacing: -1,
          )),
        ],
      ),
    );
  }
}
