import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import 'auth_service.dart';
import 'ui_utils.dart';
import 'glass_theme.dart';

class NewArtifactSheet extends StatefulWidget {
  const NewArtifactSheet({super.key});

  @override
  State<NewArtifactSheet> createState() => _NewArtifactSheetState();
}

class _NewArtifactSheetState extends State<NewArtifactSheet>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final _categoryController = TextEditingController();
  final _tagsController = TextEditingController();
  String _type = 'html';
  bool _saving = false;

  // Upload tab
  String? _selectedFilePath;
  String? _selectedFileName;
  String _uploadDetectedType = 'html';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleController.dispose();
    _contentController.dispose();
    _categoryController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
                  const Text('New Artifact', style: TextStyle(
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
            TabBar(
              controller: _tabController,
              indicatorColor: kCrimson,
              labelColor: kCrimson,
              unselectedLabelColor: kWhite54,
              tabs: const [
                Tab(text: 'Paste Code'),
                Tab(text: 'Upload File'),
              ],
            ),
            SizedBox(
              height: 420,
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildPasteTab(),
                  _buildUploadTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Paste Tab ──

  Widget _buildPasteTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _titleController,
            decoration: glassInputDec(label: 'Title', hint: 'My artifact'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _type,
                  decoration: glassInputDec(label: 'Type'),
                  dropdownColor: kBgNearBlack,
                  items: const [
                    DropdownMenuItem(value: 'html', child: Text('HTML')),
                    DropdownMenuItem(value: 'jsx', child: Text('JSX / React')),
                    DropdownMenuItem(value: 'md', child: Text('Markdown')),
                  ],
                  onChanged: (v) => setState(() => _type = v ?? 'html'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _categoryController,
                  decoration: glassInputDec(label: 'Category', hint: 'e.g. tutorials'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tagsController,
            decoration: glassInputDec(label: 'Tags (comma separated)', hint: 'tag1, tag2'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contentController,
            maxLines: 8,
            decoration: glassInputDec(label: 'Content', hint: 'Paste your code here...'),
            style: const TextStyle(fontFamily: 'monospace', fontSize: 13, color: kWhite),
          ),
          const SizedBox(height: 16),
          GlassButton(
            label: 'Create Artifact',
            onPressed: _saving ? null : _savePaste,
            loading: _saving,
          ),
        ],
      ),
    );
  }

  // ── Upload Tab ──

  Widget _buildUploadTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // File picker area - glass card style
          InkWell(
            onTap: _pickFile,
            borderRadius: BorderRadius.circular(16),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: _selectedFileName != null
                          ? kCrimson.withOpacity(0.5)
                          : kWhite.withOpacity(0.08),
                      width: _selectedFileName != null ? 0.8 : 0.5,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    color: _selectedFileName != null
                        ? kCrimson.withOpacity(0.06)
                        : kWhite.withOpacity(0.02),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        _selectedFileName != null
                            ? Icons.check_circle_outline
                            : Icons.upload_file_outlined,
                        size: 44,
                        color: _selectedFileName != null
                            ? kCrimson
                            : kWhite38,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _selectedFileName ?? 'Tap to select a file',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: _selectedFileName != null
                              ? kWhite70
                              : kWhite54,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      if (_selectedFileName != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Type detected: ${_uploadDetectedType.toUpperCase()}',
                          style: const TextStyle(
                            fontSize: 12, color: kCrimson,
                          ),
                        ),
                      ] else ...[
                        const SizedBox(height: 4),
                        const Text('Supports .html, .jsx, .tsx, .md',
                          style: TextStyle(fontSize: 12, color: kWhite38)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _titleController,
            decoration: glassInputDec(
              label: 'Title',
              hint: _selectedFileName ?? 'Auto-detected from filename',
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _uploadDetectedType,
                  decoration: glassInputDec(label: 'Type'),
                  dropdownColor: kBgNearBlack,
                  items: const [
                    DropdownMenuItem(value: 'html', child: Text('HTML')),
                    DropdownMenuItem(value: 'jsx', child: Text('JSX / React')),
                    DropdownMenuItem(value: 'md', child: Text('Markdown')),
                  ],
                  onChanged: (v) => setState(() => _uploadDetectedType = v ?? 'html'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _categoryController,
                  decoration: glassInputDec(label: 'Category', hint: 'e.g. tutorials'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tagsController,
            decoration: glassInputDec(label: 'Tags', hint: 'tag1, tag2'),
          ),
          const SizedBox(height: 16),
          GlassButton(
            label: 'Upload Artifact',
            onPressed: _saving ? null : _saveUpload,
            loading: _saving,
          ),
        ],
      ),
    );
  }

  /// Open the system file picker and read the selected file.
  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['html', 'jsx', 'tsx', 'md', 'txt', 'css', 'dart', 'py', 'json', 'xml'],
        allowMultiple: false,
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      final path = file.path;
      if (path == null) {
        showToast(context, 'Could not access file path', style: ToastStyle.error);
        return;
      }

      final name = file.name;
      setState(() {
        _selectedFilePath = path;
        _selectedFileName = name;
        _uploadDetectedType = _detectTypeFromName(name);
        // Auto-set title from filename (without extension)
        if (_titleController.text.isEmpty) {
          final titleFromFile = name.replaceAll(RegExp(r'\.[^.]+$'), '');
          _titleController.text = titleFromFile;
        }
      });

      showToast(context, 'File selected: $name', style: ToastStyle.success);
    } catch (e) {
      showToast(context, 'File picker error: $e', style: ToastStyle.error);
    }
  }

  /// Read the selected file content and create an artifact.
  Future<void> _saveUpload() async {
    if (_selectedFilePath == null) {
      showToast(context, 'Please select a file first', style: ToastStyle.warning);
      return;
    }

    final path = _selectedFilePath!;
    final file = File(path);
    if (!await file.exists()) {
      showToast(context, 'Selected file no longer exists', style: ToastStyle.error);
      return;
    }

    setState(() => _saving = true);
    try {
      final content = await file.readAsString();
      if (content.isEmpty) {
        showToast(context, 'Selected file is empty', style: ToastStyle.warning);
        setState(() => _saving = false);
        return;
      }

      final title = _titleController.text.trim();
      if (title.isEmpty) {
        showToast(context, 'Please enter a title', style: ToastStyle.warning);
        setState(() => _saving = false);
        return;
      }

      final tags = _tagsController.text
          .split(',')
          .map((t) => t.trim())
          .where((t) => t.isNotEmpty)
          .toList();

      await context.read<AuthService>().createArtifact(
        title: title,
        content: content,
        type: _uploadDetectedType,
        category: _categoryController.text.trim(),
        tags: tags,
      );

      if (!mounted) return;
      Navigator.pop(context);
      showToast(context, 'Artifact uploaded successfully', style: ToastStyle.success);
    } catch (e) {
      showToast(context, 'Upload failed: $e', style: ToastStyle.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── Paste Save ──

  Future<void> _savePaste() async {
    final title = _titleController.text.trim();
    final content = _contentController.text.trim();
    if (title.isEmpty || content.isEmpty) {
      showToast(context, 'Title and content are required', style: ToastStyle.warning);
      return;
    }
    setState(() => _saving = true);
    try {
      final tags = _tagsController.text
          .split(',')
          .map((t) => t.trim())
          .where((t) => t.isNotEmpty)
          .toList();
      await context.read<AuthService>().createArtifact(
        title: title,
        content: content,
        type: _type,
        category: _categoryController.text.trim(),
        tags: tags,
      );
      if (!mounted) return;
      Navigator.pop(context);
      showToast(context, 'Artifact created', style: ToastStyle.success);
    } catch (e) {
      showToast(context, 'Failed: $e', style: ToastStyle.error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── Helpers ──

  String _detectTypeFromName(String name) {
    final ext = name.split('.').last.toLowerCase();
    switch (ext) {
      case 'md':
        return 'md';
      case 'jsx':
      case 'tsx':
        return 'jsx';
      case 'html':
      case 'htm':
        return 'html';
      default:
        return 'html'; // fallback
    }
  }

}
