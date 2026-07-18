import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'drive_service.dart';
import 'ui_utils.dart';
import 'glass_theme.dart';

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
          // ── Pure black background ──
          Container(color: kBgPureBlack),

          // ── Crimson glow orb (top-right) ──
          Positioned(
            top: -80,
            right: -80,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(0.3, 0.3),
                  radius: 0.8,
                  colors: [
                    kCrimson.withOpacity(0.15),
                    kCrimson.withOpacity(0.05),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // ── Subtle crimson glow (bottom-left) ──
          Positioned(
            bottom: -120,
            left: -120,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(-0.3, -0.3),
                  radius: 0.8,
                  colors: [
                    kCrimson.withOpacity(0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // ── Main content ──
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: BackdropFilter(
                    filter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 36),
                      decoration: BoxDecoration(
                        color: kBgNearBlack.withOpacity(0.75),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(
                          color: kWhite.withOpacity(0.08),
                          width: 0.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: kCrimson.withOpacity(0.12),
                            blurRadius: 60,
                            offset: const Offset(0, 20),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // ── Iris Logo ──
                          Center(
                            child: Container(
                              width: 80,
                              height: 80,
                              decoration: BoxDecoration(
                                color: Colors.transparent,
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: [
                                  BoxShadow(
                                    color: kCrimson.withOpacity(0.3),
                                    blurRadius: 40,
                                    offset: const Offset(0, 12),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(24),
                                child: Image.asset(
                                  'assets/iris_logo.png',
                                  width: 80,
                                  height: 80,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                    width: 80,
                                    height: 80,
                                    decoration: BoxDecoration(
                                      border: Border.all(color: kCrimson, width: 4),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Center(
                                      child: Text('I', style: TextStyle(
                                        fontSize: 36,
                                        fontWeight: FontWeight.w800,
                                        color: kCrimson,
                                      )),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),

                          // ── Sign In with Google ──
                          Center(
                            child: SizedBox(
                              width: 240,
                              height: 44,
                              child: GlassButton(
                                label: 'Sign in with Google',
                                icon: Icons.login_outlined,
                                padding: EdgeInsets.symmetric(vertical: 10, horizontal: 16),
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
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // ── Guest Mode ──
                          Center(
                            child: SizedBox(
                              width: 240,
                              height: 44,
                              child: GestureDetector(
                                onTap: () {
                                  auth.setGuestMode();
                                  Navigator.pushReplacementNamed(context, '/dashboard');
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 0),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: kWhite.withOpacity(0.1),
                                      width: 0.5,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: kCrimson.withOpacity(0.06),
                                        blurRadius: 12,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: BackdropFilter(
                                      filter: ui.ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Icons.person_outline,
                                            size: 16,
                                            color: kWhite.withOpacity(0.7),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            'Continue as guest',
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w600,
                                              color: kWhite.withOpacity(0.7),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
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
