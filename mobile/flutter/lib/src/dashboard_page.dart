import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'models.dart';
import 'artifact_card.dart';
import 'new_artifact_sheet.dart';
import 'category_sheet.dart';
import 'glass_theme.dart';

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
    final userLabel = auth.isGuest ? 'Guest' : auth.displayName;
    final hasError = auth.error != null && auth.error!.isNotEmpty;

    final recent = [...auth.artifacts]
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final recent5 = recent.take(5).toList();
    final totalArts = auth.artifacts.length;

    return SafeArea(
      child: RefreshIndicator(
        color: kCrimson,
        backgroundColor: kBgNearBlack,
        onRefresh: _load,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(0, 8, 0, 100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Hero Section ──
              _HeroSection(
                userLabel: userLabel,
                artifactCount: totalArts,
                totalWords: auth.totalWords,
                thisWeek: auth.thisWeekCount,
                categories: auth.categories.length,
                isDriveMode: auth.isDriveMode,
                onRefresh: auth.isLoading ? null : _load,
              ),

              // ── Loading ──
              if (auth.isLoading && !_initialLoadDone)
                const Center(
                    child: Padding(
                  padding: EdgeInsets.all(60),
                  child: CircularProgressIndicator(color: kCrimson),
                ))

              // ── Error ──
              else if (hasError && auth.artifacts.isEmpty)
                _buildError(auth)

              // ── Content ──
              else ...[
                if (hasError) _buildErrorBanner(auth),

                // Recent Activity
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                  child: SectionHeader(
                    title: 'Continue Creating',
                    onViewAll: () {},
                  ),
                ),
                const SizedBox(height: 12),
                if (recent5.isEmpty)
                  _buildEmpty(auth.isDriveMode)
                else
                  ...recent5.map((art) => _RecentTile(
                        artifact: art,
                        onTap: () => Navigator.pushNamed(context, '/viewer',
                            arguments: art),
                      )),

                const SizedBox(height: 28),

                // Quick Actions
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                  child: SectionHeader(title: 'Quick Actions'),
                ),
                const SizedBox(height: 12),
                _QuickActionGrid(
                  onPasteCode: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    barrierColor: kCrimson.withValues(alpha: 0.05),
                    builder: (_) => const GlassSheet(child: NewArtifactSheet()),
                  ),
                  onManageCategories: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    barrierColor: kCrimson.withValues(alpha: 0.05),
                    builder: (_) => const GlassSheet(child: CategorySheet()),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildError(AuthService auth) {
    return Padding(
      padding: const EdgeInsets.all(60),
      child: Column(
        children: [
          GlassCard(
            padding: const EdgeInsets.all(24),
            radius: 20,
            child: const Icon(Icons.cloud_off_rounded,
                size: 36, color: Color(0xFFEF4444)),
          ),
          const SizedBox(height: 20),
          Text(auth.error ?? 'Could not connect to Drive',
              style: const TextStyle(color: kWhite54, fontSize: 15),
              textAlign: TextAlign.center),
          const SizedBox(height: 20),
          GlassButton(
            label: 'Retry',
            icon: Icons.refresh,
            onPressed: auth.isLoading ? null : _load,
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner(AuthService auth) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: GlassCard(
        padding: const EdgeInsets.all(12),
        radius: 12,
        borderColor: const Color(0x33EF4444),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded,
                size: 18, color: Color(0xFFEF4444)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(auth.error!,
                  style:
                      const TextStyle(color: Color(0xFFEF4444), fontSize: 13)),
            ),
            TextButton(
              onPressed: _load,
              child: const Text('Retry',
                  style: TextStyle(fontSize: 13, color: kCrimson)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty(bool isDrive) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GlassCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: kCrimson.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.library_books_outlined,
                  size: 28, color: kCrimson),
            ),
            const SizedBox(height: 12),
            const Text('No artifacts yet',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: kWhite54)),
            const SizedBox(height: 4),
            Text(
              isDrive
                  ? 'Create your first artifact below.'
                  : 'Create your first artifact to get started.',
              style: const TextStyle(color: kWhite38, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  HERO SECTION
// ═══════════════════════════════════════════════════════════════

class _HeroSection extends StatelessWidget {
  final String userLabel;
  final int artifactCount;
  final int totalWords;
  final int thisWeek;
  final int categories;
  final bool isDriveMode;
  final VoidCallback? onRefresh;

  const _HeroSection({
    required this.userLabel,
    required this.artifactCount,
    required this.totalWords,
    required this.thisWeek,
    required this.categories,
    required this.isDriveMode,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  kCrimson.withValues(alpha: 0.12),
                  kBgPureBlack.withValues(alpha: 0.3),
                  kWhite.withValues(alpha: 0.04),
                ],
              ),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: kCrimson.withValues(alpha: 0.2),
                width: 0.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: kCrimson.withValues(alpha: 0.15),
                  blurRadius: 40,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Greeting row
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Welcome back,',
                              style: TextStyle(
                                fontSize: 12,
                                color: kWhite54,
                              )),
                          const SizedBox(height: 1),
                          Text(userLabel,
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.5,
                                foreground: Paint()
                                  ..shader = const LinearGradient(
                                    colors: [kWhite, Color(0xCCFFFFFF)],
                                  ).createShader(
                                      const Rect.fromLTWH(0, 0, 200, 32)),
                              )),
                        ],
                      ),
                    ),
                    if (isDriveMode)
                      Container(
                        decoration: BoxDecoration(
                          color: kWhite.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: IconButton(
                          icon: const Icon(Icons.refresh_rounded,
                              size: 20, color: kWhite54),
                          tooltip: 'Refresh',
                          onPressed: onRefresh,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                // Stats bar
                _StatsBar(
                  items: [
                    _StatItem(
                        icon: Icons.article_outlined,
                        value: '$artifactCount',
                        label: 'Artifacts'),
                    _StatItem(
                        icon: Icons.text_fields,
                        value: '$totalWords',
                        label: 'Words'),
                    _StatItem(
                        icon: Icons.category_outlined,
                        value: '$categories',
                        label: 'Categories'),
                    _StatItem(
                        icon: Icons.trending_up,
                        value: '$thisWeek',
                        label: 'This Week'),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  STATS BAR — horizontal, compact, sleek
// ═══════════════════════════════════════════════════════════════

class _StatItem {
  final IconData icon;
  final String value;
  final String label;
  const _StatItem(
      {required this.icon, required this.value, required this.label});
}

class _StatsBar extends StatelessWidget {
  final List<_StatItem> items;
  const _StatsBar({required this.items});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(items.length, (i) {
        final item = items[i];
        final isLast = i == items.length - 1;
        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: _MiniStat(
                    icon: item.icon, value: item.value, label: item.label),
              ),
              if (!isLast)
                Container(
                  width: 1,
                  height: 24,
                  color: Colors.white.withValues(alpha: 0.08),
                ),
            ],
          ),
        );
      }),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  const _MiniStat(
      {required this.icon, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 12, color: kCrimson.withValues(alpha: 0.7)),
              const SizedBox(width: 4),
              Text(value,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: kWhite,
                    letterSpacing: -0.5,
                  )),
            ],
          ),
          const SizedBox(height: 2),
          Text(label,
              style: const TextStyle(
                fontSize: 10,
                color: kWhite38,
              )),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  RECENT TILE — sleek, minimal
// ═══════════════════════════════════════════════════════════════

class _RecentTile extends StatelessWidget {
  final Artifact artifact;
  final VoidCallback onTap;
  const _RecentTile({required this.artifact, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final tags = artifact.tags.take(2).toList();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom:
                  BorderSide(color: kWhite.withValues(alpha: 0.04), width: 0.5),
            ),
          ),
          child: Row(
            children: [
              // Icon
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: typeColor(artifact.type).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(typeIcon(artifact.type),
                    size: 20, color: typeColor(artifact.type)),
              ),
              const SizedBox(width: 14),
              // Title + tags
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(artifact.title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: kWhite,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    if (tags.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: tags
                            .map((t) => Container(
                                  margin: const EdgeInsets.only(right: 4),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: kCrimson.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                  child: Text(t,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: kCrimson,
                                      )),
                                ))
                            .toList(),
                      ),
                    ],
                  ],
                ),
              ),
              // Date
              Text(formatDateShort(artifact.createdAt),
                  style: const TextStyle(
                    fontSize: 11,
                    color: kWhite38,
                  )),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, size: 16, color: kWhite24),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  QUICK ACTION GRID
// ═══════════════════════════════════════════════════════════════

class _QuickActionGrid extends StatelessWidget {
  final VoidCallback onPasteCode;
  final VoidCallback onManageCategories;

  const _QuickActionGrid({
    required this.onPasteCode,
    required this.onManageCategories,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: _QuickActionCard(
              icon: Icons.upload_file_outlined,
              label: 'Paste Code',
              accent: true,
              onTap: onPasteCode,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _QuickActionCard(
              icon: Icons.category_outlined,
              label: 'Categories',
              accent: false,
              onTap: onManageCategories,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool accent;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.label,
    required this.accent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: accent
                    ? [
                        kCrimson.withValues(alpha: 0.12),
                        kBgPureBlack.withValues(alpha: 0.2)
                      ]
                    : [
                        kWhite.withValues(alpha: 0.04),
                        kBgPureBlack.withValues(alpha: 0.1)
                      ],
              ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: accent
                    ? kCrimson.withValues(alpha: 0.25)
                    : kWhite.withValues(alpha: 0.06),
                width: 0.5,
              ),
              boxShadow: accent
                  ? [
                      BoxShadow(
                        color: kCrimson.withValues(alpha: 0.12),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      )
                    ]
                  : null,
            ),
            child: Column(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: kCrimson.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, size: 22, color: kCrimson),
                ),
                const SizedBox(height: 10),
                Text(label,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: kWhite70,
                    )),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
