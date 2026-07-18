import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'src/auth_service.dart';
import 'src/dashboard_page.dart';
import 'src/library_page.dart';
import 'src/artifact_viewer_page.dart';
import 'src/login_page.dart';
import 'src/models.dart';
import 'src/new_artifact_sheet.dart';

class LeonardoApp extends StatelessWidget {
  const LeonardoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthService(),
      child: Consumer<AuthService>(
        builder: (context, authService, _) {
          return MaterialApp(
            title: 'Leonardo',
            debugShowCheckedModeBanner: false,
            theme: _buildTheme(),
            home: authService.isAuthenticated
                ? const MainShell()
                : const LoginPage(),
            onGenerateRoute: (settings) {
              // Handle argument-based routes
              if (settings.name == '/viewer') {
                final artifact = settings.arguments as Artifact;
                return MaterialPageRoute(
                  builder: (_) => ArtifactViewerPage(artifact: artifact),
                  settings: settings,
                );
              }
              // Named routes
              final routes = <String, WidgetBuilder>{
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
      scaffoldBackgroundColor: const Color(0xFF050505),
      colorScheme: const ColorScheme.dark(
        primary: Color(0xFFDC143C),
        secondary: Color(0xFF8B0000),
        surface: Color(0x14FFFFFF),
        onPrimary: Colors.white,
        onSurface: Colors.white,
      ),
      useMaterial3: true,
      textTheme: Typography.whiteMountainView,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0x14FFFFFF),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0x26FFFFFF)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0x26FFFFFF)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0x66DC143C), width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
        labelStyle: const TextStyle(color: Colors.white70),
        hintStyle: const TextStyle(color: Color(0x99FFFFFF)),
      ),
      cardTheme: const CardThemeData(
        color: Color(0x14FFFFFF),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
        ),
        elevation: 0,
        margin: EdgeInsets.zero,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFDC143C),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: Colors.white70,
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
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: _buildBottomNav(context),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showNewArtifact(context),
        backgroundColor: const Color(0xFFDC143C),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0D0D0D),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) {
            if (i == 2) {
              // Profile — show bottom sheet
              _showProfileSheet(context);
              return;
            }
            setState(() => _currentIndex = i);
          },
          backgroundColor: Colors.transparent,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: const Color(0xFFDC143C),
          unselectedItemColor: Colors.white38,
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
    );
  }

  void _showProfileSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0D0D0D),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => const _ProfileSheetContent(),
    );
  }

  void _showNewArtifact(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0D0D0D),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => const NewArtifactSheet(),
    );
  }
}

/// Inline profile sheet content to avoid import issues.
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
          Container(
            margin: const EdgeInsets.only(top: 8),
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Text('Profile', style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w700,
                )),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          CircleAvatar(
            radius: 36,
            backgroundColor: const Color(0xFFDC143C),
            child: Text(initial, style: const TextStyle(
              fontSize: 28, fontWeight: FontWeight.w800, color: Colors.white,
            )),
          ),
          const SizedBox(height: 12),
          Text(email, style: const TextStyle(
            fontSize: 18, fontWeight: FontWeight.w600,
          )),
          const SizedBox(height: 4),
          Text(
            auth.isDriveMode ? 'Drive Account' : 'Guest',
            style: const TextStyle(color: Colors.white54, fontSize: 13),
          ),
          const SizedBox(height: 24),
          const Divider(color: Colors.white12, height: 1),
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

