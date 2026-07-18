import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'drive_service.dart';
import 'ui_utils.dart';

class LoginPage extends StatefulWidget {
  static const routeName = '/login';
  const LoginPage({Key? key}) : super(key: key);

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF050505), Color(0xFF0B0B0D)],
              ),
            ),
          ),
          Align(
            alignment: Alignment.topCenter,
            child: Container(
              height: 220,
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(-0.8, -0.8),
                  radius: 1.8,
                  colors: [Color(0x44DC143C), Colors.transparent],
                ),
              ),
            ),
          ),
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Card(
                  color: const Color(0x14141414),
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFFDC143C), Color(0xFF8B0000)],
                            ),
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0x66DC143C),
                                blurRadius: 24,
                                offset: const Offset(0, 10),
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Text('L', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text('Leonardo', textAlign: TextAlign.center, style: TextStyle(fontSize: 36, fontWeight: FontWeight.w800, letterSpacing: -0.8)),
                        const SizedBox(height: 8),
                        const Text('Your Drive-backed workspace', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70, fontSize: 16)),
                        const SizedBox(height: 32),
                        FilledButton.icon(
                          onPressed: () async {
                            final ds = DriveService();
                            final ok = await ds.signIn();
                            if (ok) {
                              final email = ds.email ?? 'Drive User';
                              auth.setDriveMode(email);
                              if (!mounted) return;
                              Navigator.pushReplacementNamed(context, '/dashboard');
                            } else {
                              if (!mounted) return;
                              showToast(context, 'Google sign-in failed. Try again.', style: ToastStyle.error);
                            }
                          },
                          icon: const Icon(Icons.login_outlined),
                          label: const Text('Sign in with Google'),
                        ),
                        const SizedBox(height: 14),
                        TextButton(
                          onPressed: () {
                            auth.setGuestMode();
                            Navigator.pushReplacementNamed(context, '/dashboard');
                          },
                          child: const Text('Continue as guest'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
