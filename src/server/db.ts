import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("./data");
const DB_PATH = path.join(DATA_DIR, "leonardo.db");
const INDEX_PATH = path.join(DATA_DIR, "local-index.json");
const ARTIFACTS_DIR = path.join(DATA_DIR, "local-artifacts");

export type ArtifactType = "html" | "jsx" | "md";

export interface ArtifactMeta {
  id: string;
  title: string;
  slug: string;
  type: ArtifactType;
  desc: string;
  coverImg: string;
  category: string;
  tags: string[];
  wordCount: number;
  readTimeMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact extends ArtifactMeta {
  content: string;
  contentHash: string;
}

export const enum RestoreVersion {
  master = "master",
  latest = "latest",
}

let db: SqlJsDatabase;

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function calcReadTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200));
}

function parseTags(raw: string): string[] {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

function saveDb(): void {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

export async function initDB(): Promise<void> {
  const SQL = await initSqlJs();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('html','jsx','md')),
    content TEXT NOT NULL,
    content_hash TEXT,
    desc TEXT DEFAULT '',
    cover_img TEXT DEFAULT '',
    category TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    word_count INTEGER DEFAULT 0,
    read_time INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  // Create indexes (IF NOT EXISTS only works in SQLite 3.3+; we use try/catch for safety)
  try { db.run("CREATE INDEX IF NOT EXISTS idx_artifacts_slug ON artifacts(slug)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type)"); } catch {}
  try { db.run("CREATE INDEX IF NOT EXISTS idx_artifacts_created ON artifacts(created_at)"); } catch {}

  // Auto-migrate from old JSON storage
  if (fs.existsSync(INDEX_PATH)) {
    const existingCount = db.exec("SELECT COUNT(*) AS c FROM artifacts");
    if (!existingCount[0] || existingCount[0].values[0][0] === 0) {
      migrateFromJson();
    }
  }
}

export function migrateFromJson(): void {
  if (!fs.existsSync(INDEX_PATH)) return;
  if (!fs.existsSync(ARTIFACTS_DIR)) return;

  const metas: any[] = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  if (!Array.isArray(metas) || metas.length === 0) return;

  let count = 0;
  const insert = db.prepare(`INSERT OR IGNORE INTO artifacts
    (id, title, slug, type, content, content_hash, desc, cover_img, category, tags, word_count, read_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  for (const meta of metas) {
    const artPath = path.join(ARTIFACTS_DIR, `${meta.id}.json`);
    if (!fs.existsSync(artPath)) continue;

    const art = JSON.parse(fs.readFileSync(artPath, "utf-8"));
    const ch = hashContent(art.content || "");
    insert.run([
      art.id, art.title, art.slug || "", art.type || "html",
      art.content || "", ch, art.desc || "", art.coverImg || "",
      art.category || "", JSON.stringify(art.tags || []),
      art.wordCount || 0, art.readTimeMin || 1,
      art.createdAt || new Date().toISOString(),
      art.updatedAt || new Date().toISOString(),
    ]);
    count++;
  }

  insert.free();
  saveDb();
  console.log(`Migrated ${count} artifacts from JSON to SQLite`);
}

export function listArtifacts(): ArtifactMeta[] {
  const results = db.exec(`SELECT id, title, slug, type, desc, cover_img, category, tags,
    word_count, read_time, created_at, updated_at
    FROM artifacts ORDER BY created_at DESC`);
  if (!results[0]) return [];
  return results[0].values.map((row: any) => ({
    id: row[0] as string,
    title: row[1] as string,
    slug: row[2] as string,
    type: row[3] as ArtifactType,
    desc: row[4] as string || "",
    coverImg: row[5] as string || "",
    category: row[6] as string || "",
    tags: parseTags(row[7] as string),
    wordCount: row[8] as number,
    readTimeMin: row[9] as number,
    createdAt: row[10] as string,
    updatedAt: row[11] as string,
  }));
}

export function getArtifact(id: string): Artifact | null {
  const results = db.exec(`SELECT * FROM artifacts WHERE id = ?`, [id]);
  if (!results[0] || results[0].values.length === 0) return null;
  const row = results[0].values[0];
  return {
    id: row[0] as string,
    title: row[1] as string,
    slug: row[2] as string,
    type: row[3] as ArtifactType,
    content: row[4] as string,
    contentHash: row[5] as string || "",
    desc: row[6] as string || "",
    coverImg: row[7] as string || "",
    category: row[8] as string || "",
    tags: parseTags(row[9] as string),
    wordCount: row[10] as number,
    readTimeMin: row[11] as number,
    createdAt: row[12] as string,
    updatedAt: row[13] as string,
  };
}

export function createArtifact(data: {
  title: string;
  type: ArtifactType;
  content: string;
  desc?: string;
  slug?: string;
  coverImg?: string;
  category?: string;
  tags?: string[];
}): Artifact {
  const now = new Date().toISOString();
  const wc = countWords(data.content);
  const ch = hashContent(data.content);

  const art: Artifact = {
    id: genId(),
    title: data.title,
    slug: data.slug || slugify(data.title),
    type: data.type,
    content: data.content,
    contentHash: ch,
    desc: data.desc || "",
    coverImg: data.coverImg || "",
    category: data.category || "",
    tags: data.tags || [],
    wordCount: wc,
    readTimeMin: calcReadTime(wc),
    createdAt: now,
    updatedAt: now,
  };

  db.run(`INSERT INTO artifacts
    (id, title, slug, type, content, content_hash, desc, cover_img, category, tags, word_count, read_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    art.id, art.title, art.slug, art.type, art.content, art.contentHash,
    art.desc, art.coverImg, art.category, JSON.stringify(art.tags),
    art.wordCount, art.readTimeMin, art.createdAt, art.updatedAt,
  ]);

  saveDb();
  return art;
}

export function updateArtifact(
  id: string,
  data: Partial<{
    title: string;
    slug: string;
    type: ArtifactType;
    content: string;
    desc: string;
    coverImg: string;
    category: string;
    tags: string[];
  }>
): Artifact | null {
  const existing = getArtifact(id);
  if (!existing) return null;

  const updated: Artifact = {
    ...existing,
    ...data,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (data.content && data.content !== existing.content) {
    updated.wordCount = countWords(data.content);
    updated.readTimeMin = calcReadTime(updated.wordCount);
    updated.contentHash = hashContent(data.content);
  }

  db.run(`UPDATE artifacts SET
    title=?, slug=?, type=?, content=?, content_hash=?, desc=?, cover_img=?,
    category=?, tags=?, word_count=?, read_time=?, updated_at=?
    WHERE id=?`, [
    updated.title, updated.slug, updated.type,
    updated.content, updated.contentHash,
    updated.desc, updated.coverImg,
    updated.category, JSON.stringify(updated.tags),
    updated.wordCount, updated.readTimeMin,
    updated.updatedAt, id,
  ]);

  saveDb();
  return updated;
}

export function deleteArtifact(id: string): boolean {
  db.run("DELETE FROM artifacts WHERE id = ?", [id]);
  saveDb();

  // Verify deletion
  const check = db.exec("SELECT COUNT(*) AS c FROM artifacts WHERE id = ?", [id]);
  return !check[0] || check[0].values[0][0] === 0;
}
