import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'src/auth_service.dart';
import 'src/dashboard_page.dart';
import 'src/library_page.dart';
import 'src/artifact_viewer_page.dart';
import 'src/login_page.dart';
import 'src/models.dart';
import 'src/new_artifact_sheet.dart';
import 'src/glass_theme.dart';
import 'src/splash_page.dart';

class IrisApp extends StatelessWidget {
  const IrisApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthService(),
      child: Consumer<AuthService>(
        builder: (context, authService, _) {
          return MaterialApp(
            title: 'Iris',
            debugShowCheckedModeBanner: false,
            theme: _buildTheme(),
            home: const SplashPage(),
            onGenerateRoute: (settings) {
              if (settings.name == '/viewer') {
                final artifact = settings.arguments as Artifact;
                return MaterialPageRoute(
                  builder: (_) => ArtifactViewerPage(artifact: artifact),
                  settings: settings,
                );
              }
              final routes = <String, WidgetBuilder>{
                '/splash': (_) => const SplashPage(),
                '/login': (_) => const LoginPage(),
                '/dashboard': (_) => const MainShell(),
                '/library': (_) => const MainShell(),
              };
              final builder = routes[settings.name];
              if (builder != null) {
                return MaterialPageRoute(
                  builder: builder,
                  settings: settings,
                );
              }
              return MaterialPageRoute(
                builder: (_) => const MainShell(),
                settings: settings,
              );
            },
          );
        },
      ),
    );
  }

  ThemeData _buildTheme() {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: kBgPureBlack,
      colorScheme: const ColorScheme.dark(
        primary: kCrimson,
        secondary: kCrimsonDark,
        surface: kGlassBase,
        onPrimary: kWhite,
        onSurface: kWhite,
      ),
      useMaterial3: true,
      textTheme: Typography.whiteMountainView,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: kWhite04,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: kGlassBorder, width: 0.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: kGlassBorder, width: 0.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: kCrimsonBorder, width: 0.8),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
        labelStyle: const TextStyle(color: kWhite70),
        hintStyle: const TextStyle(color: kWhite38),
      ),
      cardTheme: const CardThemeData(
        color: kGlassBase,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
        ),
        elevation: 0,
        margin: EdgeInsets.zero,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: kCrimson,
          foregroundColor: kWhite,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: kWhite70,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

/// Main shell with bottom navigation bar.
class MainShell extends StatefulWidget {
  static const routeName = '/shell';
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final _pages = <Widget>[
    const DashboardPage(),
    const LibraryPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBgPureBlack,
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: _buildBottomNav(context),
      floatingActionButton: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: kCrimson.withOpacity(0.35),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: FloatingActionButton(
          onPressed: () => _showNewArtifact(context),
          backgroundColor: kCrimson,
          child: const Icon(Icons.add, color: kWhite),
        ),
      ),
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      decoration: BoxDecoration(
        color: kBgNearBlack.withOpacity(0.95),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kWhite.withOpacity(0.06), width: 0.5),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: (i) {
              if (i == 2) {
                _showProfileSheet(context);
                return;
              }
              setState(() => _currentIndex = i);
            },
            backgroundColor: Colors.transparent,
            elevation: 0,
            type: BottomNavigationBarType.fixed,
            selectedItemColor: kCrimson,
            unselectedItemColor: kWhite38,
            selectedFontSize: 12,
            unselectedFontSize: 12,
            items: const [
              BottomNavigationBarItem(
                icon: Icon(Icons.dashboard_outlined),
                activeIcon: Icon(Icons.dashboard),
                label: 'Dashboard',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.library_books_outlined),
                activeIcon: Icon(Icons.library_books),
                label: 'Library',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.person_outline),
                activeIcon: Icon(Icons.person),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showProfileSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: kCrimson.withOpacity(0.05),
      builder: (_) => const GlassSheet(child: _ProfileSheetContent()),
    );
  }

  void _showNewArtifact(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: kCrimson.withOpacity(0.05),
      builder: (_) => const GlassSheet(child: NewArtifactSheet()),
    );
  }
}

/// Inline profile sheet content.
class _ProfileSheetContent extends StatelessWidget {
  const _ProfileSheetContent();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final email = auth.username ?? 'Drive User';
    final initial = email.isNotEmpty ? email[0].toUpperCase() : 'U';

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SheetHandle(),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Text('Profile', style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w700, color: kWhite,
                )),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: kWhite54),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          CircleAvatar(
            radius: 36,
            backgroundColor: kCrimson,
            child: Text(initial, style: const TextStyle(
              fontSize: 28, fontWeight: FontWeight.w800, color: kWhite,
            )),
          ),
          const SizedBox(height: 12),
          Text(email, style: const TextStyle(
            fontSize: 18, fontWeight: FontWeight.w600, color: kWhite,
          )),
          const SizedBox(height: 4),
          Text(
            auth.isDriveMode ? 'Drive Account' : 'Guest',
            style: const TextStyle(color: kWhite54, fontSize: 13),
          ),
          const SizedBox(height: 24),
          const GlassDivider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Color(0xFFEF4444)),
            title: const Text('Sign Out', style: TextStyle(color: Color(0xFFEF4444))),
            onTap: () async {
              await auth.logout();
              if (!context.mounted) return;
              Navigator.pop(context);
              Navigator.pushNamedAndRemoveUntil(context, '/login', (r) => false);
            },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

