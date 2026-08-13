import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'glass_theme.dart';

class ProfileSheet extends StatefulWidget {
  const ProfileSheet({super.key});

  @override
  State<ProfileSheet> createState() => _ProfileSheetState();
}

class _ProfileSheetState extends State<ProfileSheet> {
  late TextEditingController _nameCtl;
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    // Initialize with a safe default; will sync after first frame
    _nameCtl = TextEditingController(text: '');
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final auth = context.read<AuthService>();
      _nameCtl.text = auth.displayName;
    });
  }

  @override
  void dispose() {
    _nameCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final initial = auth.displayName.isNotEmpty
        ? auth.displayName[0].toUpperCase()
        : 'U';

    // Sync controller text if display name changed externally
    if (!_isEditing && _nameCtl.text != auth.displayName) {
      _nameCtl.text = auth.displayName;
    }

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
          const SizedBox(height: 20),
          CircleAvatar(
            radius: 36,
            backgroundColor: kCrimson,
            child: Text(initial, style: const TextStyle(
              fontSize: 28, fontWeight: FontWeight.w800, color: kWhite,
            )),
          ),
          const SizedBox(height: 20),

          // Name display & edit — solid, visible
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0x22FFFFFF),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x44FFFFFF), width: 1),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _isEditing
                      ? TextField(
                          controller: _nameCtl,
                          autofocus: true,
                          style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            hintText: 'Your name',
                            hintStyle: TextStyle(color: Color(0x88FFFFFF)),
                            isDense: true,
                          ),
                          cursorColor: kCrimson,
                          textCapitalization: TextCapitalization.words,
                          maxLines: 1,
                        )
                      : Text(
                          auth.displayName,
                          style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),
                const SizedBox(width: 8),
                // Edit / Save button — solid and obvious
                SizedBox(
                  width: 44,
                  height: 44,
                  child: RawMaterialButton(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    fillColor: _isEditing
                        ? kCrimson
                        : const Color(0x33FFFFFF),
                    onPressed: () {
                      if (_isEditing) {
                        auth.setDisplayName(_nameCtl.text);
                        setState(() => _isEditing = false);
                      } else {
                        setState(() => _isEditing = true);
                      }
                    },
                    child: Icon(
                      _isEditing ? Icons.check : Icons.edit,
                      color: _isEditing
                          ? Colors.white
                          : kCrimson,
                      size: 22,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
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
