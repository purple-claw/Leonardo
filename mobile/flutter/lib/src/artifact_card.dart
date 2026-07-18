import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'models.dart';
import 'glass_theme.dart';

// ── Type Helpers ────────────────────────────────────────────

Color typeColor(String type) {
  switch (type) {
    case 'jsx': return const Color(0xFFFBBF24);
    case 'html': return const Color(0xFF60A5FA);
    case 'md':  return const Color(0xFF34D399);
    default:    return Colors.white54;
  }
}

IconData typeIcon(String type) {
  switch (type) {
    case 'jsx': return Icons.code;
    case 'html': return Icons.web;
    case 'md':  return Icons.article;
    default:    return Icons.insert_drive_file;
  }
}

String formatDateShort(String dateStr) {
  final dt = DateTime.tryParse(dateStr);
  if (dt == null) return '';
  final now = DateTime.now();
  final diff = now.difference(dt);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inHours < 1) return '${diff.inMinutes}m ago';
  if (diff.inDays < 1) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return '${dt.month}/${dt.day}';
}

// ── Reusable Type Badge ─────────────────────────────────────

class TypeBadge extends StatelessWidget {
  final String type;
  final double fontSize;
  const TypeBadge({super.key, required this.type, this.fontSize = 10});

  @override
  Widget build(BuildContext context) {
    final c = typeColor(type);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: c.withOpacity(0.3), width: 0.5),
      ),
      child: Text(type.toUpperCase(), style: TextStyle(
        fontSize: fontSize, fontWeight: FontWeight.w700, color: c,
      )),
    );
  }
}

// ── Tag Chips ───────────────────────────────────────────────

class TagChips extends StatelessWidget {
  final List<String> tags;
  final int max;
  const TagChips({super.key, required this.tags, this.max = 3});

  @override
  Widget build(BuildContext context) {
    final shown = tags.take(max).toList();
    if (shown.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: shown.map((t) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0x33DC143C),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(t, style: const TextStyle(
          fontSize: 11, color: Color(0xFFDC143C),
        )),
      )).toList(),
    );
  }
}

// ── Grid Card (modular, clean — title + tags only) ──────────

class ArtifactCard extends StatelessWidget {
  final Artifact artifact;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  const ArtifactCard({
    super.key,
    required this.artifact,
    this.onTap,
    this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: glassDeco(radius: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    TypeBadge(type: artifact.type),
                    const Spacer(),
                    Icon(Icons.more_horiz, size: 16, color: kWhite38),
                  ],
                ),
                const SizedBox(height: 14),
                Text(artifact.title, style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w600, height: 1.2, color: kWhite,
                ), maxLines: 2, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 8),
                TagChips(tags: artifact.tags),
                const Spacer(),
                Text(formatDateShort(artifact.createdAt), style: const TextStyle(
                  fontSize: 11, color: kWhite38,
                )),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── List Row (compact — title + tags) ───────────────────────

class ArtifactListRow extends StatelessWidget {
  final Artifact artifact;
  final VoidCallback? onTap;

  const ArtifactListRow({super.key, required this.artifact, this.onTap});

  @override
  Widget build(BuildContext context) {
    final tags = artifact.tags.take(2).toList();
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: kWhite.withOpacity(0.04), width: 0.5)),
        ),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: typeColor(artifact.type).withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(typeIcon(artifact.type), size: 18, color: typeColor(artifact.type)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(artifact.title, style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14, color: kWhite,
                  ), maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (tags.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: tags.map((t) => Container(
                        margin: const EdgeInsets.only(right: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: kCrimson.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(t, style: const TextStyle(
                          fontSize: 10, color: kCrimson,
                        )),
                      )).toList(),
                    ),
                  ],
                ],
              ),
            ),
            Text(formatDateShort(artifact.createdAt), style: const TextStyle(
              fontSize: 11, color: kWhite38,
            )),
          ],
        ),
      ),
    );
  }
}
