class Artifact {
  final String id;
  final String title;
  final String slug;
  final String type; // html, jsx, md
  final String desc;
  final String coverImg;
  final String category;
  final List<String> tags;
  final int wordCount;
  final int readTimeMin;
  final String createdAt;
  final String updatedAt;
  final String content;
  final String contentHash;

  Artifact({
    required this.id,
    required this.title,
    this.slug = '',
    required this.type,
    this.desc = '',
    this.coverImg = '',
    this.category = '',
    this.tags = const [],
    this.wordCount = 0,
    this.readTimeMin = 1,
    required this.createdAt,
    required this.updatedAt,
    required this.content,
    this.contentHash = '',
  });

  factory Artifact.fromJson(Map<String, dynamic> json) {
    return Artifact(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Untitled',
      slug: json['slug'] as String? ?? '',
      type: json['type'] as String? ?? 'html',
      desc: json['desc'] as String? ?? '',
      coverImg: json['coverImg'] as String? ?? '',
      category: json['category'] as String? ?? '',
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      wordCount: (json['wordCount'] as num?)?.toInt() ?? 0,
      readTimeMin: (json['readTimeMin'] as num?)?.toInt() ?? 1,
      createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
      content: json['content'] as String? ?? '',
      contentHash: json['contentHash'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'slug': slug,
    'type': type,
    'desc': desc,
    'coverImg': coverImg,
    'category': category,
    'tags': tags,
    'wordCount': wordCount,
    'readTimeMin': readTimeMin,
    'createdAt': createdAt,
    'updatedAt': updatedAt,
    'content': content,
    'contentHash': contentHash,
  };

  static String generateId() {
    return DateTime.now().millisecondsSinceEpoch.toRadixString(36) +
        DateTime.now().microsecondsSinceEpoch.toRadixString(36).substring(0, 4);
  }

  static int calcWordCount(String text) {
    return text.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
  }

  static int calcReadTime(int wordCount) {
    return [1, (wordCount / 200).ceil()].reduce((a, b) => a > b ? a : b);
  }

  static String slugify(String text) {
    return text.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'(^-|-$)'), '');
  }
}

class Category {
  final String name;
  final int count;

  Category({required this.name, this.count = 0});

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      name: json['name'] as String? ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {'name': name, 'count': count};
}
