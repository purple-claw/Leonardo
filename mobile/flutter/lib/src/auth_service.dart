import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'drive_service.dart';
import 'models.dart';

class AuthService extends ChangeNotifier {
  String? _token;
  String? _username;
  String? _displayName;
  bool _loading = false;
  String? _error;
  bool _guestMode = false;
  bool _driveMode = false;

  // In-memory data
  List<Artifact> _artifacts = [];
  List<Artifact> get artifacts => _artifacts;
  List<Category> _categories = [];
  List<Category> get categories => _categories;
  List<String> _extraCategories = []; // categories with no artifacts yet

  int get totalWords =>
      _artifacts.fold(0, (sum, a) => sum + a.wordCount);
  int get thisWeekCount {
    final weekAgo = DateTime.now().subtract(const Duration(days: 7));
    return _artifacts.where((a) {
      final dt = DateTime.tryParse(a.createdAt);
      return dt != null && dt.isAfter(weekAgo);
    }).length;
  }

  bool get isAuthenticated => _token != null || _guestMode || _driveMode;
  bool get isLoading => _loading;
  String? get username => _username;
  String? get error => _error;
  bool get isGuest => _guestMode;
  bool get isDriveMode => _driveMode;

  /// The user's chosen display name, or 'User' as fallback.
  String get displayName => _displayName ?? 'User';

  /// Update the user's display name and persist it.
  void setDisplayName(String name) {
    _displayName = name.trim().isEmpty ? 'User' : name.trim();
    SharedPreferences.getInstance().then((prefs) {
      prefs.setString('display_name', _displayName!);
    });
    notifyListeners();
  }

  bool _loadingDrive = false; // guard against concurrent loadFromDrive

  AuthService() {
    _loadState();
  }

  Future<void> _loadState() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    _username = prefs.getString('auth_username');
    _displayName = prefs.getString('display_name');
    _driveMode = prefs.getBool('drive_mode') ?? false;
    _extraCategories = prefs.getStringList('extra_categories') ?? [];
    if (_driveMode && _username == null) {
      _username = prefs.getString('drive_email');
    }
    if (_token != null) {
      _guestMode = false;
    }
    notifyListeners();
    // DO NOT call loadFromDrive here — it would trigger sign-in UI during
    // app initialization before any user interaction. The Dashboard will
    // call loadFromDrive when it becomes visible.
  }

  /// Enter Drive mode — called after successful Google sign-in.
  void setDriveMode(String email) {
    _driveMode = true;
    _username = email;
    _guestMode = false;
    _token = null;
    _error = null;
    SharedPreferences.getInstance().then((prefs) {
      prefs.setBool('drive_mode', true);
      prefs.setString('auth_username', email);
      prefs.remove('auth_token');
    });
    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    _username = null;
    _displayName = null;
    _guestMode = false;
    _driveMode = false;
    _artifacts = [];
    _categories = [];
    _extraCategories = [];
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('auth_username');
    await prefs.remove('display_name');
    await prefs.remove('extra_categories');
    await prefs.remove('drive_mode');
    try {
      await DriveService().signOut();
    } catch (_) {}
    notifyListeners();
  }

  void setGuestMode() {
    _guestMode = true;
    _driveMode = false;
    _error = null;
    notifyListeners();
  }

  // ── Data Loading ───────────────────────────────────────────

  /// Load all data from Drive. Guarded against concurrent calls.
  Future<void> loadFromDrive() async {
    if (!_driveMode) return;
    if (_loadingDrive) {
      // Another load is already in progress — wait for it
      await Future.doWhile(() => Future.delayed(const Duration(milliseconds: 100), () => _loadingDrive));
      return;
    }
    _loadingDrive = true;
    _setLoading(true);
    _setError(null);
    notifyListeners();
    try {
      final ds = DriveService();
      // Try silent re-auth first (uses stored cookies/refresh token)
      if (!ds.isSignedIn) {
        final ok = await ds.signIn(interactive: false);
        if (!ok) {
          // Silent re-auth failed — the user should tap the refresh button
          _setError('Google sign-in required. Tap refresh to sign in.');
          _loadingDrive = false;
          _setLoading(false);
          notifyListeners();
          return;
        }
      }
      final raw = await ds.readArtifacts();
      _artifacts = raw
          .map((e) => Artifact.fromJson(e as Map<String, dynamic>))
          .toList();
      _rebuildCategories();
      _error = null;
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      _setError(msg);
    } finally {
      _loadingDrive = false;
      _setLoading(false);
      notifyListeners();
    }
  }

  /// Fetch artifacts list (used by dashboard/library).
  Future<List<Artifact>> fetchArtifacts() async {
    if (_artifacts.isEmpty && _driveMode) {
      await loadFromDrive();
    }
    return _artifacts;
  }

  /// Save current artifacts list to Drive.
  Future<void> _saveToDrive() async {
    if (!_driveMode) return;
    final ds = DriveService();
    await ds.writeArtifacts(_artifacts.map((a) => a.toJson()).toList());
  }

  // ── Category helpers ───────────────────────────────────────

  void _rebuildCategories() {
    final map = <String, int>{};
    for (final a in _artifacts) {
      if (a.category.isNotEmpty) {
        map[a.category] = (map[a.category] ?? 0) + 1;
      }
    }
    // Also include extra categories (defined but no artifacts yet)
    for (final name in _extraCategories) {
      if (!map.containsKey(name)) {
        map[name] = 0;
      }
    }
    final entries = map.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    _categories = entries
        .map((e) => Category(name: e.key, count: e.value))
        .toList();
  }

  // ── CRUD ───────────────────────────────────────────────────

  Future<Artifact> createArtifact({
    required String title,
    required String content,
    String type = 'html',
    String category = '',
    List<String> tags = const [],
  }) async {
    final now = DateTime.now().toIso8601String();
    final wordCount = Artifact.calcWordCount(content);
    final art = Artifact(
      id: Artifact.generateId(),
      title: title,
      slug: Artifact.slugify(title),
      type: type,
      desc: content.replaceAll(RegExp(r'<[^>]*>'), '').substring(
          0, content.length > 120 ? 120 : content.length),
      category: category,
      tags: tags,
      wordCount: wordCount,
      readTimeMin: Artifact.calcReadTime(wordCount),
      createdAt: now,
      updatedAt: now,
      content: content,
    );
    _artifacts.insert(0, art);
    _rebuildCategories();
    // Notify UI immediately — the artifact appears instantly
    notifyListeners();
    // Then save to Drive in the background; swallow errors silently
    // so a Drive failure never blocks the UI
    try {
      await _saveToDrive();
    } catch (_) {
      // Drive sync failed — artifact is still in local state
    }
    return art;
  }

  Future<void> deleteArtifact(String id) async {
    _artifacts.removeWhere((a) => a.id == id);
    _rebuildCategories();
    await _saveToDrive();
    notifyListeners();
  }

  Future<void> addCategory(String name) async {
    final cleaned = name.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '-');
    if (cleaned.isEmpty) return;
    // Already exists in artifacts or extra list?
    if (_artifacts.any((a) => a.category == cleaned)) return;
    if (_extraCategories.contains(cleaned)) return;
    _extraCategories.add(cleaned);
    _saveExtraCategories();
    _rebuildCategories();
    notifyListeners();
  }

  void _saveExtraCategories() {
    SharedPreferences.getInstance().then((prefs) {
      prefs.setStringList('extra_categories', _extraCategories);
    });
  }

  Future<void> deleteCategory(String name) async {
    for (var i = 0; i < _artifacts.length; i++) {
      if (_artifacts[i].category == name) {
        _artifacts[i] = Artifact(
          id: _artifacts[i].id,
          title: _artifacts[i].title,
          type: _artifacts[i].type,
          createdAt: _artifacts[i].createdAt,
          updatedAt: _artifacts[i].updatedAt,
          content: _artifacts[i].content,
          desc: _artifacts[i].desc,
          category: '',
          tags: _artifacts[i].tags,
          wordCount: _artifacts[i].wordCount,
          readTimeMin: _artifacts[i].readTimeMin,
        );
      }
    }
    _rebuildCategories();
    await _saveToDrive();
    notifyListeners();
  }

  /// Move an artifact to a different category.
  Future<void> updateArtifactCategory(String artifactId, String newCategory) async {
    final idx = _artifacts.indexWhere((a) => a.id == artifactId);
    if (idx == -1) return;
    final a = _artifacts[idx];
    _artifacts[idx] = Artifact(
      id: a.id,
      title: a.title,
      type: a.type,
      createdAt: a.createdAt,
      updatedAt: DateTime.now().toIso8601String(),
      content: a.content,
      desc: a.desc,
      category: newCategory,
      tags: a.tags,
      wordCount: a.wordCount,
      readTimeMin: a.readTimeMin,
    );
    // If this category was an extra category with no artifacts, remove from extras
    _extraCategories.remove(newCategory);
    _saveExtraCategories();
    _rebuildCategories();
    await _saveToDrive();
    notifyListeners();
  }

  // ── Internals ──────────────────────────────────────────────

  void _setLoading(bool v) {
    _loading = v;
    notifyListeners();
  }

  void _setError(String? m) {
    _error = m;
    notifyListeners();
  }
}
