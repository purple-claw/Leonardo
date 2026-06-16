import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { getAuthClnt, cfg } from "./auth.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Artifact {
  id: string;
  title: string;
  slug: string;
  type: "html" | "jsx";
  content: string;
  desc: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactMeta {
  id: string;
  title: string;
  slug: string;
  type: "html" | "jsx";
  desc: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface DBState {
  folderId: string | null;
  indexFileId: string | null;
  artifactFileIds: Record<string, string>;
  localCache: ArtifactMeta[];
}

// ─── Local paths ─────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve("./data");
const INDEX_PATH = path.join(DATA_DIR, "artifacts-index.json");
const ARTIFACTS_DIR = path.join(DATA_DIR, "artifacts");
const STATE_PATH = path.join(DATA_DIR, "db-state.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Drive helpers ───────────────────────────────────────────────────────────

async function getDrv() {
  const auth = await getAuthClnt();
  return google.drive({ version: "v3", auth });
}

async function findOrCreateFldr(d: Awaited<ReturnType<typeof getDrv>>, name: string): Promise<string> {
  const res = await d.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
  });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!;
  const folder = await d.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  return folder.data.id!;
}

async function findFileInFldr(
  d: Awaited<ReturnType<typeof getDrv>>,
  fldrId: string,
  name: string
): Promise<string | null> {
  const res = await d.files.list({
    q: `'${fldrId}' in parents and name='${name}' and trashed=false`,
    fields: "files(id,name)",
  });
  return res.data.files?.[0]?.id ?? null;
}

async function uploadOrUpdate(
  d: Awaited<ReturnType<typeof getDrv>>,
  fldrId: string,
  name: string,
  body: string,
  mime: string,
  existingId?: string | null
): Promise<string> {
  if (existingId) {
    await d.files.update({
      fileId: existingId,
      requestBody: { name },
      media: { mimeType: mime, body },
    });
    return existingId;
  }
  const file = await d.files.create({
    requestBody: { name, parents: [fldrId] },
    media: { mimeType: mime, body },
    fields: "id",
  });
  return file.data.id!;
}

async function dlFile(d: Awaited<ReturnType<typeof getDrv>>, fileId: string): Promise<string> {
  const res = await d.files.get({ fileId, alt: "media" }, { responseType: "text" });
  return res.data as string;
}

async function rmFile(d: Awaited<ReturnType<typeof getDrv>>, fileId: string) {
  await d.files.delete({ fileId });
}

// ─── State ───────────────────────────────────────────────────────────────────

function loadState(): DBState {
  ensureDirs();
  if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  return { folderId: null, indexFileId: null, artifactFileIds: {}, localCache: [] };
}

function saveState(s: DBState) {
  ensureDirs();
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function loadIdx(): ArtifactMeta[] {
  ensureDirs();
  if (fs.existsSync(INDEX_PATH)) return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  return [];
}

function saveIdx(metas: ArtifactMeta[]) {
  ensureDirs();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(metas, null, 2));
}

function loadLocal(id: string): string | null {
  const p = path.join(ARTIFACTS_DIR, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf-8");
}

function saveLocal(id: string, art: Artifact) {
  ensureDirs();
  fs.writeFileSync(path.join(ARTIFACTS_DIR, `${id}.json`), JSON.stringify(art, null, 2));
}

function delLocal(id: string) {
  const p = path.join(ARTIFACTS_DIR, `${id}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function initDB() {
  const d = await getDrv();
  const s = loadState();

  console.log("Initializing Google Drive database...");

  s.folderId = await findOrCreateFldr(d, cfg.dbFolderName);
  console.log("  Folder: " + cfg.dbFolderName + " (" + s.folderId + ")");

  s.indexFileId = await findFileInFldr(d, s.folderId, cfg.dbFileName);

  if (s.indexFileId) {
    console.log("  Downloading existing index...");
    const raw = await dlFile(d, s.indexFileId);
    const metas: ArtifactMeta[] = JSON.parse(raw);
    saveIdx(metas);
    s.localCache = metas;
    console.log("  Found " + metas.length + " existing artifacts");
  } else {
    console.log("  Creating new index...");
    s.indexFileId = await uploadOrUpdate(d, s.folderId, cfg.dbFileName, JSON.stringify([], null, 2), "application/json");
    s.localCache = [];
    saveIdx([]);
    console.log("  Empty index created");
  }

  for (const m of s.localCache) {
    if (!loadLocal(m.id) && s.artifactFileIds[m.id]) {
      const raw = await dlFile(d, s.artifactFileIds[m.id]);
      saveLocal(m.id, { ...m, content: raw });
    }
  }

  saveState(s);
  console.log("  Database initialized\n");
}

export async function list(): Promise<ArtifactMeta[]> {
  return loadIdx();
}

export async function get(id: string): Promise<Artifact | null> {
  const metas = loadIdx();
  const meta = metas.find((m) => m.id === id);
  if (!meta) return null;
  const content = loadLocal(id);
  if (!content) return null;
  return { ...meta, content };
}

export async function create(data: Omit<Artifact, "id" | "createdAt" | "updatedAt">): Promise<Artifact> {
  const s = loadState();
  const d = await getDrv();
  const now = new Date().toISOString();

  const art: Artifact = {
    id: genId(),
    ...data,
    slug: data.slug || slugify(data.title),
    createdAt: now,
    updatedAt: now,
  };

  saveLocal(art.id, art);

  const fileId = await uploadOrUpdate(d, s.folderId!, art.id + ".json", JSON.stringify(art, null, 2), "application/json");
  s.artifactFileIds[art.id] = fileId;

  const meta: ArtifactMeta = { ...art };
  delete (meta as any).content;
  const metas = loadIdx();
  metas.push(meta);
  saveIdx(metas);
  s.localCache = metas;

  s.indexFileId = await uploadOrUpdate(d, s.folderId!, cfg.dbFileName, JSON.stringify(metas, null, 2), "application/json", s.indexFileId);

  saveState(s);
  console.log("  Created: " + art.title + " (" + art.id + ")");
  return art;
}

export async function update(id: string, data: Partial<Omit<Artifact, "id" | "createdAt">>): Promise<Artifact | null> {
  const s = loadState();
  const d = await getDrv();
  const existing = await get(id);
  if (!existing) return null;

  const updated: Artifact = {
    ...existing,
    ...data,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  saveLocal(id, updated);

  const fid = s.artifactFileIds[id];
  if (fid) {
    await uploadOrUpdate(d, s.folderId!, id + ".json", JSON.stringify(updated, null, 2), "application/json", fid);
  }

  const metas = loadIdx();
  const idx = metas.findIndex((m) => m.id === id);
  if (idx !== -1) {
    const meta: ArtifactMeta = { ...updated };
    delete (meta as any).content;
    metas[idx] = meta;
    saveIdx(metas);
    s.localCache = metas;
    s.indexFileId = await uploadOrUpdate(d, s.folderId!, cfg.dbFileName, JSON.stringify(metas, null, 2), "application/json", s.indexFileId);
  }

  saveState(s);
  console.log("  Updated: " + updated.title + " (" + id + ")");
  return updated;
}

export async function del(id: string): Promise<boolean> {
  const s = loadState();
  const d = await getDrv();

  const fid = s.artifactFileIds[id];
  if (fid) {
    await rmFile(d, fid);
    delete s.artifactFileIds[id];
  }

  const metas = loadIdx().filter((m) => m.id !== id);
  saveIdx(metas);
  s.localCache = metas;

  s.indexFileId = await uploadOrUpdate(d, s.folderId!, cfg.dbFileName, JSON.stringify(metas, null, 2), "application/json", s.indexFileId);

  delLocal(id);
  saveState(s);
  console.log("  Deleted: " + id);
  return true;
}
