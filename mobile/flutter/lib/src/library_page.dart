import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'artifact_card.dart';
import 'models.dart';
import 'ui_utils.dart';
import 'glass_theme.dart';

class LibraryPage extends StatefulWidget {
  static const routeName = '/library';
  const LibraryPage({super.key});

  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  bool _isGrid = true;
  String? _selectedCategory;
  final _searchController = TextEditingController();
  bool _initialLoadDone = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final auth = context.read<AuthService>();
    if (auth.artifacts.isEmpty && auth.isDriveMode) {
      await auth.loadFromDrive();
    }
    if (mounted) {
      setState(() => _initialLoadDone = true);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final artifacts = auth.artifacts;
    final categories = auth.categories;

    final searchQuery = _searchController.text.toLowerCase().trim();
    var filtered = artifacts;
    if (_selectedCategory != null) {
      filtered = filtered.where((a) => a.category == _selectedCategory).toList();
    }
    if (searchQuery.isNotEmpty) {
      filtered = filtered.where((a) =>
        a.title.toLowerCase().contains(searchQuery) ||
        a.category.toLowerCase().contains(searchQuery) ||
        a.tags.any((t) => t.toLowerCase().contains(searchQuery))
      ).toList();
    }

    // Sort: newest first
    filtered.sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return Scaffold(
      backgroundColor: kBgPureBlack,
      body: SafeArea(
        child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text('Library', style: TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    foreground: Paint()..shader = const LinearGradient(
                      colors: [kWhite, Color(0x99FFFFFF)],
                    ).createShader(const Rect.fromLTWH(0, 0, 200, 40)),
                  )),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: kWhite.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: kWhite.withValues(alpha: 0.08), width: 0.5),
                  ),
                  child: Row(
                    children: [
                      _ViewToggleBtn(
                        icon: Icons.grid_view_rounded,
                        active: _isGrid,
                        onTap: () => setState(() => _isGrid = true),
                      ),
                      _ViewToggleBtn(
                        icon: Icons.list_rounded,
                        active: !_isGrid,
                        onTap: () => setState(() => _isGrid = false),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Search
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              decoration: glassInputDec(
                hint: 'Search artifacts...',
                prefixIcon: const Icon(Icons.search, size: 20, color: kWhite38),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18, color: kWhite38),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {});
                        },
                      )
                    : null,
              ).copyWith(
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Category chips
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _FilterChip(
                  label: 'All',
                  count: artifacts.length,
                  active: _selectedCategory == null,
                  onTap: () => setState(() => _selectedCategory = null),
                ),
                ...categories.map((cat) => _FilterChip(
                  label: cat.name,
                  count: cat.count,
                  active: _selectedCategory == cat.name,
                  onTap: () => setState(() => _selectedCategory = cat.name),
                )),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Content
          Expanded(
            child: _buildContent(auth, filtered, searchQuery),
          ),
        ],
      ),
    ),
  );
  }

  Widget _buildContent(AuthService auth, List<Artifact> filtered, String searchQuery) {
    // Show loading indicator on first load
    if (!_initialLoadDone && auth.isDriveMode && auth.artifacts.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: kCrimson),
            SizedBox(height: 12),
            Text('Loading artifacts...', style: TextStyle(color: kWhite54, fontSize: 14)),
          ],
        ),
      );
    }

    // Show error with retry
    if (auth.error != null && auth.artifacts.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_rounded, size: 48, color: kWhite24),
              const SizedBox(height: 16),
              Text(auth.error!,
                style: const TextStyle(color: kWhite54, fontSize: 14),
                textAlign: TextAlign.center),
              const SizedBox(height: 16),
              GlassButton(
                label: 'Retry',
                icon: Icons.refresh,
                onPressed: () => auth.loadFromDrive(),
              ),
            ],
          ),
        ),
      );
    }

    if (filtered.isEmpty) {
      return _EmptyState(
        isFiltered: _selectedCategory != null || searchQuery.isNotEmpty,
        onCreate: () {},
      );
    }

    return RefreshIndicator(
      onRefresh: () => auth.loadFromDrive(),
      child: _isGrid ? _buildGrid(filtered) : _buildList(filtered),
    );
  }

  Widget _buildGrid(List<Artifact> items) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.85,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final art = items[index];
        return ArtifactCard(
          artifact: art,
          onTap: () => _openArtifact(art),
          onLongPress: () => _showContextMenu(art),
        );
      },
    );
  }

  Widget _buildList(List<Artifact> items) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(0, 4, 0, 100),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final art = items[index];
        return ArtifactListRow(
          artifact: art,
          onTap: () => _openArtifact(art),
        );
      },
    );
  }

  void _openArtifact(Artifact art) {
    Navigator.pushNamed(context, '/viewer', arguments: art);
  }

  void _showContextMenu(Artifact art) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: kCrimson.withValues(alpha: 0.05),
      builder: (ctx) => GlassSheet(
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SheetHandle(),
              const SizedBox(height: 8),
              // Artifact title header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                child: Text(
                  art.title,
                  style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w700, color: kWhite70,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 4),
              // Move to Category
              ListTile(
                leading: const Icon(Icons.drive_file_rename_outline_rounded, color: kWhite70),
                title: const Text('Move to Category', style: TextStyle(color: kWhite)),
                trailing: const Icon(Icons.chevron_right, color: kWhite38, size: 20),
                onTap: () {
                  Navigator.pop(ctx);
                  _showMoveCategorySheet(art);
                },
              ),
              const GlassDivider(),
              // Delete
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Color(0xFFEF4444)),
                title: const Text('Delete', style: TextStyle(color: Color(0xFFEF4444))),
                onTap: () async {
                  Navigator.pop(ctx);
                  final confirmed = await showConfirmDialog(
                    context,
                    title: 'Delete Artifact',
                    message: 'Delete "${art.title}"?',
                    confirmLabel: 'Delete',
                  );
                  if (confirmed == true) {
                    await context.read<AuthService>().deleteArtifact(art.id);
                  }
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  void _showMoveCategorySheet(Artifact art) {
    final auth = context.read<AuthService>();
    final cats = auth.categories.map((c) => c.name).toSet().toList()..sort();
    final currentCat = art.category;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: kCrimson.withValues(alpha: 0.05),
      builder: (ctx) => GlassSheet(
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SheetHandle(),
              const SizedBox(height: 12),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20),
                child: Text(
                  'Move to Category',
                  style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700, color: kWhite,
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Uncategorized option
              _CategoryOption(
                label: 'Uncategorized',
                icon: Icons.label_off_outlined,
                isSelected: currentCat.isEmpty,
                onTap: () {
                  Navigator.pop(ctx);
                  if (currentCat.isNotEmpty) {
                    auth.updateArtifactCategory(art.id, '');
                  }
                },
              ),

              // Existing categories
              ...cats.map((cat) => _CategoryOption(
                label: cat,
                icon: Icons.label_outline,
                isSelected: currentCat == cat,
                onTap: () {
                  Navigator.pop(ctx);
                  if (currentCat != cat) {
                    auth.updateArtifactCategory(art.id, cat);
                  }
                },
              )),

              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _CategoryOption({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: isSelected ? kCrimson : kWhite54),
      title: Text(
        label,
        style: TextStyle(
          color: isSelected ? kCrimson : kWhite,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
        ),
      ),
      trailing: isSelected
          ? const Icon(Icons.check_rounded, color: kCrimson, size: 20)
          : null,
      onTap: onTap,
    );
  }
}

class _ViewToggleBtn extends StatelessWidget {
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  const _ViewToggleBtn({
    required this.icon,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: active ? kCrimson.withValues(alpha: 0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 18,
          color: active ? kCrimson : kWhite38),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final bool active;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.count,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: active ? kCrimson.withValues(alpha: 0.15) : kWhite.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: active ? kCrimson.withValues(alpha: 0.4) : kWhite.withValues(alpha: 0.08),
              width: 0.5,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: active ? kCrimson : kWhite70,
              )),
              const SizedBox(width: 6),
              Text('$count', style: TextStyle(
                fontSize: 12,
                color: active ? kCrimson : kWhite38,
              )),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool isFiltered;
  final VoidCallback onCreate;

  const _EmptyState({required this.isFiltered, required this.onCreate});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.library_books_outlined, size: 48, color: Colors.white24),
          const SizedBox(height: 16),
          Text(
            isFiltered ? 'No artifacts found' : 'No artifacts yet',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white54),
          ),
          const SizedBox(height: 8),
          Text(
            isFiltered ? 'Try a different category or search term.' : 'Create your first artifact to get started.',
            style: const TextStyle(fontSize: 14, color: Colors.white38),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
