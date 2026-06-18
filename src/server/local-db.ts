import fs from "node:fs";
import path from "node:path";
import { Artifact, ArtifactMeta } from "./types.js";
import { DBAdapter } from "./db-adapter.js";

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

export class LocalDB implements DBAdapter {
  private dataDir: string;
  private indexPath: string;
  private artifactsDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.indexPath = path.join(dataDir, "local-index.json");
    this.artifactsDir = path.join(dataDir, "local-artifacts");
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.artifactsDir)) fs.mkdirSync(this.artifactsDir, { recursive: true });
    if (!fs.existsSync(this.indexPath)) this.saveIdx([]);
  }

  private loadIdx(): ArtifactMeta[] {
    if (!fs.existsSync(this.indexPath)) return [];
    return JSON.parse(fs.readFileSync(this.indexPath, "utf-8"));
  }

  private saveIdx(metas: ArtifactMeta[]): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(metas, null, 2));
  }

  private loadArtifact(id: string): Artifact | null {
    const p = path.join(this.artifactsDir, `${id}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }

  private saveArtifact(art: Artifact): void {
    fs.writeFileSync(path.join(this.artifactsDir, `${art.id}.json`), JSON.stringify(art, null, 2));
  }

  private deleteArtifact(id: string): void {
    const p = path.join(this.artifactsDir, `${id}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  async list(): Promise<ArtifactMeta[]> {
    return this.loadIdx();
  }

  async get(id: string): Promise<Artifact | null> {
    return this.loadArtifact(id);
  }

  async create(data: {
    title: string;
    type: "html" | "jsx";
    content: string;
    desc?: string;
    slug?: string;
    coverImg?: string;
    category?: string;
    tags?: string[];
  }): Promise<Artifact> {
    const now = new Date().toISOString();
    const wc = countWords(data.content);

    const art: Artifact = {
      id: genId(),
      title: data.title,
      slug: data.slug || slugify(data.title),
      type: data.type,
      content: data.content,
      desc: data.desc || "",
      coverImg: data.coverImg || "",
      category: data.category || "",
      tags: data.tags || [],
      wordCount: wc,
      readTimeMin: calcReadTime(wc),
      createdAt: now,
      updatedAt: now,
    };

    this.saveArtifact(art);

    const meta: ArtifactMeta = { ...art };
    delete (meta as any).content;
    const metas = this.loadIdx();
    metas.push(meta);
    this.saveIdx(metas);

    return art;
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      slug: string;
      type: "html" | "jsx";
      content: string;
      desc: string;
      coverImg: string;
      category: string;
      tags: string[];
    }>
  ): Promise<Artifact | null> {
    const existing = await this.get(id);
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
    }

    this.saveArtifact(updated);

    const metas = this.loadIdx();
    const idx = metas.findIndex((m) => m.id === id);
    if (idx !== -1) {
      const meta: ArtifactMeta = { ...updated };
      delete (meta as any).content;
      metas[idx] = meta;
      this.saveIdx(metas);
    }

    return updated;
  }

  async del(id: string): Promise<boolean> {
    this.deleteArtifact(id);
    const metas = this.loadIdx().filter((m) => m.id !== id);
    this.saveIdx(metas);
    return true;
  }
}
