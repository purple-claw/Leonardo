import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'models.dart';
import 'new_artifact_sheet.dart';
import 'category_sheet.dart';

class DashboardPage extends StatefulWidget {
  static const routeName = '/dashboard';
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  bool _initialLoadDone = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthService>();
    await auth.loadFromDrive();
    if (mounted) setState(() => _initialLoadDone = true);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final userLabel = auth.isGuest ? 'Guest' : auth.username ?? 'User';
    final hasError = auth.error != null && auth.error!.isNotEmpty;

    final recent = [...auth.artifacts]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final recent5 = recent.take(5).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Dashboard', style: TextStyle(
                      fontSize: 28, fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      foreground: Paint()..shader = const LinearGradient(
                        colors: [Colors.white, Color(0x99FFFFFF)],
                      ).createShader(const Rect.fromLTWH(0, 0, 200, 40)),
                    )),
                    const SizedBox(height: 4),
                    Text('Welcome back, $userLabel',
                      style: const TextStyle(color: Colors.white60, fontSize: 14)),
                  ],
                ),
              ),
              if (auth.isDriveMode)
                IconButton(
                  icon: const Icon(Icons.refresh_rounded),
                  tooltip: 'Refresh from Drive',
                  onPressed: auth.isLoading ? null : _load,
                ),
            ],
          ),
          const SizedBox(height: 24),

          // Loading state (only on first load)
          if (auth.isLoading && !_initialLoadDone)
            const Center(child: Padding(
              padding: EdgeInsets.all(60),
              child: CircularProgressIndicator(),
            ))

          // Error state (no data loaded yet)
          else if (hasError && auth.artifacts.isEmpty)
            _buildErrorState(auth)

          // Normal state — show content
          else ...[
            _buildStatsGrid(auth),
            const SizedBox(height: 28),

            // Error banner (when data is shown but sync failed)
            if (hasError)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0x1FEF4444),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0x33EF4444)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFEF4444)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(auth.error!,
                          style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13)),
                      ),
                      TextButton(
                        onPressed: _load,
                        child: const Text('Retry', style: TextStyle(fontSize: 13)),
                      ),
                    ],
                  ),
                ),
              ),

            // Recent Activity
            _buildSectionHeader('Recent Activity', onViewAll: () {
              // Switch to library
            }),
            const SizedBox(height: 12),
            if (recent5.isEmpty)
              _buildEmptyState(auth.isDriveMode)
            else
              ...recent5.map((art) => _RecentItem(
                artifact: art,
                onTap: () => Navigator.pushNamed(context, '/viewer', arguments: art),
              )),
            const SizedBox(height: 28),
            // Quick Actions
            _buildSectionHeader('Quick Actions'),
            const SizedBox(height: 12),
            _buildQuickActions(context, auth),
          ],
        ],
      ),
    );
  }

  Widget _buildErrorState(AuthService auth) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 48, color: Colors.white24),
            const SizedBox(height: 16),
            Text(auth.error ?? 'Could not connect to Drive',
              style: const TextStyle(color: Colors.white60, fontSize: 15),
              textAlign: TextAlign.center),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: auth.isLoading ? null : _load,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsGrid(AuthService auth) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 400;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: isWide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth,
              child: _StatCard(
                label: 'Total Artifacts',
                value: '${auth.artifacts.length}',
                icon: Icons.article_outlined,
              ),
            ),
            SizedBox(
              width: isWide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth,
              child: _StatCard(
                label: 'Words Written',
                value: '${auth.totalWords}',
                accent: true,
                icon: Icons.text_fields,
              ),
            ),
            SizedBox(
              width: isWide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth,
              child: _StatCard(
                label: 'Categories',
                value: '${auth.categories.length}',
                icon: Icons.category_outlined,
              ),
            ),
            SizedBox(
              width: isWide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth,
              child: _StatCard(
                label: 'This Week',
                value: '${auth.thisWeekCount}',
                icon: Icons.trending_up,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSectionHeader(String title, {VoidCallback? onViewAll}) {
    return Row(
      children: [
        Text(title, style: const TextStyle(
          fontSize: 18, fontWeight: FontWeight.w700,
        )),
        const Spacer(),
        if (onViewAll != null)
          TextButton(
            onPressed: onViewAll,
            child: const Text('View all', style: TextStyle(
              color: Colors.white54, fontWeight: FontWeight.w600, fontSize: 13)),
          ),
      ],
    );
  }

  Widget _buildEmptyState(bool isDrive) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Column(
        children: [
          Icon(Icons.library_books_outlined, size: 40, color: Colors.white24),
          const SizedBox(height: 12),
          const Text('No artifacts yet', style: TextStyle(
            fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white54)),
          const SizedBox(height: 6),
          Text(
            isDrive
                ? 'Create your first artifact below.'
                : 'Create your first artifact to get started.',
            style: const TextStyle(color: Colors.white38, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context, AuthService auth) {
    return Column(
      children: [
        _ActionBtn(
          icon: Icons.upload_file_outlined,
          label: 'Paste Code',
          onTap: () => showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: const Color(0xFF0D0D0D),
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            builder: (_) => const NewArtifactSheet(),
          ),
        ),
        const SizedBox(height: 8),
        _ActionBtn(
          icon: Icons.category_outlined,
          label: 'Manage Categories',
          onTap: () => showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: const Color(0xFF0D0D0D),
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            builder: (_) => const CategorySheet(),
          ),
        ),
      ],
    );
  }
}

// ── Reusable Widgets ────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final bool accent;
  final IconData icon;

  const _StatCard({
    required this.label,
    required this.value,
    this.accent = false,
    required this.icon,
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
              Icon(icon, size: 14, color: Colors.white38),
              const SizedBox(width: 6),
              Text(label.toUpperCase(), style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white54,
                letterSpacing: 0.8,
              )),
            ],
          ),
          const SizedBox(height: 12),
          Text(value, style: TextStyle(
            fontSize: 32, fontWeight: FontWeight.w800,
            color: accent ? const Color(0xFFDC143C) : Colors.white,
            letterSpacing: -1,
          )),
        ],
      ),
    );
  }
}

class _RecentItem extends StatelessWidget {
  final Artifact artifact;
  final VoidCallback onTap;

  const _RecentItem({required this.artifact, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: _typeColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(child: Icon(_typeIcon, size: 16, color: _typeColor)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(artifact.title, style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14,
                  )),
                  const SizedBox(height: 1),
                  Text(
                    '${artifact.category.isNotEmpty ? '${artifact.category} · ' : ''}${_formatDate(artifact.createdAt)}',
                    style: const TextStyle(color: Colors.white54, fontSize: 12),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(artifact.type.toUpperCase(), style: const TextStyle(
                fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white54)),
            ),
          ],
        ),
      ),
    );
  }

  Color get _typeColor {
    if (artifact.type == 'jsx') return const Color(0xFFFBBF24);
    if (artifact.type == 'html') return const Color(0xFF60A5FA);
    if (artifact.type == 'md') return const Color(0xFF34D399);
    return Colors.white54;
  }

  IconData get _typeIcon {
    if (artifact.type == 'jsx') return Icons.code;
    if (artifact.type == 'html') return Icons.web;
    if (artifact.type == 'md') return Icons.article;
    return Icons.insert_drive_file;
  }

  String _formatDate(String s) {
    final dt = DateTime.tryParse(s);
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

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionBtn({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 18, color: Colors.white70),
        label: Text(label, style: const TextStyle(color: Colors.white70)),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
          side: BorderSide(color: Colors.white.withOpacity(0.1)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          backgroundColor: Colors.white.withOpacity(0.03),
        ),
      ),
    );
  }
}
