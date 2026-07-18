import 'dart:convert';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class DriveService {
  static final DriveService _instance = DriveService._internal();
  factory DriveService() => _instance;
  DriveService._internal();

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  );

  GoogleSignInAccount? _account;
  String? _accessToken;

  bool get isSignedIn => _googleSignIn.currentUser != null || _account != null;
  String? get accessToken => _accessToken;

  String? get email => _account?.email;

  /// Attempt to sign in. If already authenticated but token expired,
  /// this will silently refresh the token.
  Future<bool> signIn({bool interactive = true}) async {
    try {
      // Try silent sign-in first
      if (interactive) {
        _account = await _googleSignIn.signIn();
      } else {
        _account = await _googleSignIn.signInSilently();
      }
      if (_account == null) return false;
      final auth = await _account!.authentication;
      _accessToken = auth.accessToken;
      final prefs = await SharedPreferences.getInstance();
      if (_accessToken != null) await prefs.setString('drive_access_token', _accessToken!);
      await prefs.setString('drive_email', _account!.email);
      return true;
    } catch (e) {
      _accessToken = null;
      return false;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    _account = null;
    _accessToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('drive_access_token');
    await prefs.remove('drive_email');
  }

  Future<String?> _ensureAccessToken() async {
    if (_accessToken != null) return _accessToken;
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('drive_access_token');
    if (token != null) {
      _accessToken = token;
      return token;
    }
    if (_googleSignIn.currentUser != null) {
      final auth = await _googleSignIn.currentUser!.authentication;
      _accessToken = auth.accessToken;
      if (_accessToken != null) await prefs.setString('drive_access_token', _accessToken!);
      return _accessToken;
    }
    return null;
  }

  /// Find a file by name in the user's Drive root. Returns file metadata map or null.
  Future<Map<String, dynamic>?> findFileByName(String name) async {
    final token = await _ensureAccessToken();
    if (token == null) throw Exception('Not authenticated with Google');
    final q = Uri.encodeQueryComponent("name='${name.replaceAll("'","\\'" )}' and trashed=false");
    final uri = Uri.parse('https://www.googleapis.com/drive/v3/files?q=$q&fields=files(id,name,modifiedTime,size)');
    final res = await http.get(uri, headers: {'Authorization': 'Bearer $token'});
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final files = data['files'] as List<dynamic>;
      if (files.isNotEmpty) return files.first as Map<String, dynamic>;
      return null;
    }
    throw Exception('Drive API error: ${res.statusCode} ${res.body}');
  }

  /// Download file content (media) by fileId.
  Future<String> downloadFile(String fileId) async {
    final token = await _ensureAccessToken();
    if (token == null) throw Exception('Not authenticated with Google');
    final uri = Uri.parse('https://www.googleapis.com/drive/v3/files/$fileId?alt=media');
    final res = await http.get(uri, headers: {'Authorization': 'Bearer $token'});
    if (res.statusCode == 200) return res.body;
    throw Exception('Drive download failed: ${res.statusCode} ${res.body}');
  }

  /// Ensure the artifacts.json file exists in Drive, creating it with [] if missing.
  /// Returns the fileId.
  Future<String> ensureArtifactsFile() async {
    final meta = await findFileByName('artifacts.json');
    if (meta != null && meta['id'] != null) return meta['id'] as String;
    return await uploadOrUpdateFile(name: 'artifacts.json', content: '[]');
  }

  /// Download and parse artifacts from Drive. Returns the list (or [] on first use).
  Future<List<dynamic>> readArtifacts() async {
    final fileId = await ensureArtifactsFile();
    final content = await downloadFile(fileId);
    return jsonDecode(content) as List<dynamic>;
  }

  /// Write the full artifact list to Drive (replaces the entire file).
  Future<void> writeArtifacts(List<dynamic> artifacts) async {
    final fileId = await ensureArtifactsFile();
    await uploadOrUpdateFile(name: 'artifacts.json', content: jsonEncode(artifacts), fileId: fileId);
  }

  /// Upload a new JSON file or update an existing file.
  /// Returns the fileId of the created/updated file.
  Future<String> uploadOrUpdateFile({required String name, required String content, String? fileId}) async {
    final token = await _ensureAccessToken();
    if (token == null) throw Exception('Not authenticated with Google');
    if (fileId == null) {
      final uri = Uri.parse('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
      final metadata = {'name': name, 'mimeType': 'application/json'};
      final boundary = '----dart_boundary_${DateTime.now().millisecondsSinceEpoch}';
      final body = StringBuffer();
      body.writeln('--$boundary');
      body.writeln('Content-Type: application/json; charset=UTF-8');
      body.writeln();
      body.writeln(jsonEncode(metadata));
      body.writeln('--$boundary');
      body.writeln('Content-Type: application/json');
      body.writeln();
      body.writeln(content);
      body.writeln('--$boundary--');
      final res = await http.post(uri, headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'multipart/related; boundary=$boundary'
      }, body: body.toString());
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        return data['id'] as String;
      }
      throw Exception('Upload failed: ${res.statusCode} ${res.body}');
    } else {
      final uri = Uri.parse('https://www.googleapis.com/upload/drive/v3/files/$fileId?uploadType=media');
      final res = await http.patch(uri, headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json'
      }, body: content);
      if (res.statusCode == 200) return fileId;
      throw Exception('Update failed: ${res.statusCode} ${res.body}');
    }
  }
}
