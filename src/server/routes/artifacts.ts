import { Router } from "express";
import { listArtifacts, getArtifact, createArtifact, updateArtifact, deleteArtifact } from "../db.js";

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
    const { title, type, content, desc, slug, coverImg, category, tags } = req.body;
    if (!title || !type || !content) {
      res.status(400).json({ error: "title, type, and content are required" });
      return;
    }
    if (type !== "html" && type !== "jsx" && type !== "md") {
      res.status(400).json({ error: "type must be 'html', 'jsx', or 'md'" });
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
    const { filename, content: fileContent, title, category, tags } = req.body;
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
    const artTitle = title || filename.replace(/\.[^.]+$/, "");
    const tagList = tags ? tags.split(",").map((t: string) => t.trim()) : [];

    const art = createArtifact({
      title: artTitle,
      type,
      content: fileContent,
      category: category || "",
      tags: tagList,
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
