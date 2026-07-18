import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'glass_theme.dart';

/// Animated splash screen with Iris logo animation.
class SplashPage extends StatefulWidget {
  static const routeName = '/splash';
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoFade;
  late final Animation<double> _glowOpacity;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );

    // Logo scales smoothly from 0.6 to 1.0
    _logoScale = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.7, curve: Curves.easeOutCubic),
      ),
    );

    // Logo fades in
    _logoFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.5, curve: Curves.easeIn),
      ),
    );

    // Glow pulses
    _glowOpacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.3, 1.0, curve: Curves.easeInOutSine),
      ),
    );

    _controller.forward();

    // Navigate after animation completes + hold
    Future.delayed(const Duration(milliseconds: 3000), () {
      if (!mounted) return;
      final auth = context.read<AuthService>();
      final destination = auth.isAuthenticated ? '/dashboard' : '/login';
      Navigator.pushReplacementNamed(context, destination);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Pure black background
          Container(color: kBgPureBlack),

          // Animated content
          Center(
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, child) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Glow ring behind logo
                    Container(
                      width: 200,
                      height: 200,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: kCrimson
                                .withValues(alpha: 0.25 * _glowOpacity.value),
                            blurRadius: 80,
                            spreadRadius: 10,
                          ),
                          BoxShadow(
                            color: kCrimson
                                .withValues(alpha: 0.1 * _glowOpacity.value),
                            blurRadius: 160,
                            spreadRadius: 40,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Transform.scale(
                          scale: _logoScale.value,
                          child: Opacity(
                            opacity: _logoFade.value,
                            child: Container(
                              width: 120,
                              height: 120,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(32),
                                color: Colors.transparent,
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(32),
                                child: Image.asset(
                                  'assets/iris_logo.png',
                                  width: 120,
                                  height: 120,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                    decoration: BoxDecoration(
                                      border: Border.all(
                                        color: kCrimson,
                                        width: 6,
                                      ),
                                      borderRadius: BorderRadius.circular(26),
                                    ),
                                    child: const Center(
                                      child: Text(
                                        'I',
                                        style: TextStyle(
                                          fontSize: 56,
                                          fontWeight: FontWeight.w800,
                                          color: kCrimson,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
