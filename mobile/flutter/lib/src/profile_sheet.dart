import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';

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
