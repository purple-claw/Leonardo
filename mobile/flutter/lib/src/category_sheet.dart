import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'auth_service.dart';
import 'ui_utils.dart';
import 'glass_theme.dart';

class CategorySheet extends StatefulWidget {
  const CategorySheet({super.key});

  @override
  State<CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends State<CategorySheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final categories = auth.categories;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SheetHandle(),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Text('Manage Categories', style: TextStyle(
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
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      decoration: glassInputDec(hint: 'New category name'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(kRadiusSmall),
                    child: BackdropFilter(
                      filter: ui.ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                      child: FilledButton(
                        onPressed: () async {
                          final name = _controller.text.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '-');
                          if (name.isEmpty) return;
                          try {
                            await auth.addCategory(name);
                            _controller.clear();
                          } catch (e) {
                            if (!mounted) return;
                            showToast(context, 'Failed: $e', style: ToastStyle.error);
                          }
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: kCrimson,
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                        ),
                        child: const Text('Add', style: TextStyle(color: kWhite)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 300),
              child: categories.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(32),
                      child: Text('No categories yet. Add one above.',
                        style: TextStyle(color: kWhite54)),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      itemCount: categories.length,
                      itemBuilder: (context, index) {
                        final cat = categories[index];
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: kWhite.withOpacity(0.04), width: 0.5),
                            ),
                          ),
                          child: ListTile(
                            title: Text(cat.name, style: const TextStyle(color: kWhite)),
                            subtitle: Text('${cat.count} artifact${cat.count == 1 ? '' : 's'}',
                              style: const TextStyle(color: kWhite54, fontSize: 12)),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline, size: 20,
                                color: Color(0xFFEF4444)),
                              onPressed: () async {
                                final confirmed = await showConfirmDialog(
                                  context,
                                  title: 'Remove Category',
                                  message: 'Remove "${cat.name}" from all artifacts?',
                                  confirmLabel: 'Remove',
                                );
                                if (confirmed == true) {
                                  await auth.deleteCategory(cat.name);
                                }
                              },
                            ),
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
