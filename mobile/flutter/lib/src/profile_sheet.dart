import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'glass_theme.dart';

class ProfileSheet extends StatelessWidget {
  const ProfileSheet({super.key});

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
