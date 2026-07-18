import 'package:flutter/material.dart';
import 'models.dart';

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
    final desc = artifact.desc.isNotEmpty
        ? artifact.desc
        : artifact.content.length > 100
            ? artifact.content.substring(0, 100).replaceAll(RegExp(r'<[^>]*>'), '')
            : artifact.content.replaceAll(RegExp(r'<[^>]*>'), '');

    final tags = artifact.tags.take(3).toList();

    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0x14FFFFFF), Color(0x10FFFFFF)],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.06)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _TypeBadge(type: artifact.type),
                const Spacer(),
                Icon(Icons.more_horiz, size: 16, color: Colors.white38),
              ],
            ),
            const SizedBox(height: 12),
            Text(artifact.title, style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ), maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Text(desc, style: const TextStyle(
              fontSize: 13,
              color: Colors.white60,
              height: 1.5,
            ), maxLines: 3, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 12),
            Row(
              children: [
                _MetaItem(icon: Icons.description_outlined, text: '${artifact.wordCount} words'),
                const SizedBox(width: 12),
                _MetaItem(icon: Icons.access_time, text: '${artifact.readTimeMin} min'),
                const Spacer(),
                Text(_formatDate(artifact.createdAt), style: const TextStyle(
                  fontSize: 11, color: Colors.white38,
                )),
              ],
            ),
            if (tags.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: tags.map((t) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0x33DC143C),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(t, style: const TextStyle(
                    fontSize: 11, color: Color(0xFFDC143C),
                  )),
                )).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(String dateStr) {
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
}

class _TypeBadge extends StatelessWidget {
  final String type;
  const _TypeBadge({required this.type});

  @override
  Widget build(BuildContext context) {
    Color color;
    if (type == 'jsx') {
      color = const Color(0xFFFBBF24);
    } else if (type == 'html') {
      color = const Color(0xFF60A5FA);
    } else if (type == 'md') {
      color = const Color(0xFF34D399);
    } else {
      color = Colors.white54;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(type.toUpperCase(), style: TextStyle(
        fontSize: 10, fontWeight: FontWeight.w700, color: color,
      )),
    );
  }
}

class _MetaItem extends StatelessWidget {
  final IconData icon;
  final String text;
  const _MetaItem({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: Colors.white38),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 11, color: Colors.white54)),
      ],
    );
  }
}

class ArtifactListRow extends StatelessWidget {
  final Artifact artifact;
  final VoidCallback? onTap;

  const ArtifactListRow({super.key, required this.artifact, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.04))),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFFBBF24).withOpacity(0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(artifact.type.toUpperCase(), style: const TextStyle(
                fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFFFBBF24),
              )),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(artifact.title, style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14,
                  )),
                  if (artifact.category.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(artifact.category, style: const TextStyle(
                      fontSize: 12, color: Colors.white54,
                    )),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text('${artifact.wordCount}', style: const TextStyle(
              fontSize: 12, color: Colors.white54,
            )),
            const SizedBox(width: 16),
            Text(_fmtDate(artifact.createdAt), style: const TextStyle(
              fontSize: 11, color: Colors.white38,
            )),
          ],
        ),
      ),
    );
  }

  String _fmtDate(String s) {
    final dt = DateTime.tryParse(s);
    if (dt == null) return '';
    return '${dt.month}/${dt.day}';
  }
}
