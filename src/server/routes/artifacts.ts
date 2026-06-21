import { Router } from "express";
import { listArtifacts, getArtifact, createArtifact, updateArtifact, deleteArtifact, listCategories, renameCategory, removeCategory } from "../db.js";
import { parseFrontmatter } from "../services/markdown-renderer.js";

const API_KEY = process.env.LEONARDO_API_KEY || "";

function requireAuth(req: any, res: any, next: any) {
  if (!API_KEY) return next();
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token === API_KEY) return next();
  res.status(401).json({ error: "Unauthorized. Set LEONARDO_API_KEY or pass a Bearer token." });
}

export const artifactRouter = Router();

artifactRouter.get("/", (_req, res) => {
  try {
    res.json(listArtifacts());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.get("/categories", (_req, res) => {
  try {
    res.json(listCategories());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.patch("/category/rename", requireAuth, (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      res.status(400).json({ error: "from and to are required" });
      return;
    }
    const count = renameCategory(from, to);
    res.json({ success: true, updated: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.delete("/category/:name", requireAuth, (req, res) => {
  try {
    const name = String(req.params.name);
    const count = removeCategory(name);
    res.json({ success: true, updated: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.get("/:id", (req, res) => {
  try {
    const id = String(req.params.id);
    const art = getArtifact(id);
    if (!art) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    res.json(art);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.post("/", requireAuth, (req, res) => {
  try {
    let { title, type, content, desc, slug, coverImg, category, tags } = req.body;
    if (!type || !content) {
      res.status(400).json({ error: "type and content are required" });
      return;
    }
    if (type !== "html" && type !== "jsx" && type !== "md") {
      res.status(400).json({ error: "type must be 'html', 'jsx', or 'md'" });
      return;
    }

    // Extract YAML frontmatter from markdown artifacts and merge metadata
    if (type === "md") {
      const { meta } = parseFrontmatter(content);
      if (meta.title && !title) title = meta.title;
      if (meta.desc && !desc) desc = meta.desc;
      if (meta.category && !category) category = meta.category;
      if (meta.coverImg && !coverImg) coverImg = meta.coverImg;
      if (meta.tags && meta.tags.length > 0 && !tags) tags = meta.tags;
    }

    if (!title) {
      res.status(400).json({ error: "title is required (provide one or use YAML frontmatter in .md files)" });
      return;
    }

    const art = createArtifact({ title, type, content, desc, slug, coverImg, category, tags });
    res.status(201).json(art);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.post("/upload", requireAuth, (req, res) => {
  try {
    let { filename, content: fileContent, title, category, tags } = req.body;
    if (!filename || !fileContent) {
      res.status(400).json({ error: "filename and content are required" });
      return;
    }

    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (!["html", "htm", "jsx", "tsx", "md"].includes(ext)) {
      res.status(400).json({ error: "Only .html, .htm, .jsx, .tsx, .md files allowed" });
      return;
    }

    const type = ext === "html" || ext === "htm" ? "html" : ext === "md" ? "md" : "jsx";
    let artTitle = title || filename.replace(/\.[^.]+$/, "");

    // Extract YAML frontmatter from .md uploads and merge metadata
    let mdTags: string[] = [];
    let mdDesc = "";
    let mdCategory = "";
    let mdCoverImg = "";
    if (type === "md") {
      const { meta } = parseFrontmatter(fileContent);
      if (meta.title && !title) artTitle = meta.title;
      mdDesc = meta.desc || "";
      mdCategory = meta.category || "";
      mdCoverImg = meta.coverImg || "";
      mdTags = meta.tags || [];
    }

    // Merge tags: request body tags split by comma, then frontmatter tags appended
    const bodyTags = tags
      ? (Array.isArray(tags) ? tags : String(tags).split(",").map((t: string) => t.trim()).filter(Boolean))
      : [];
    const mergedTags = [...new Set([...bodyTags, ...mdTags])];

    const art = createArtifact({
      title: artTitle,
      type,
      content: fileContent,
      category: category || mdCategory,
      tags: mergedTags,
      desc: mdDesc,
      coverImg: mdCoverImg,
    });
    res.status(201).json(art);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.put("/:id", requireAuth, (req, res) => {
  try {
    const id = String(req.params.id);
    const updated = updateArtifact(id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.delete("/:id", requireAuth, (req, res) => {
  try {
    const id = String(req.params.id);
    const deleted = deleteArtifact(id);
    if (!deleted) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
