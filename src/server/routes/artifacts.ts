import { Router } from "express";
import { LocalDB } from "../local-db.js";

const db = new LocalDB("./data");
db.init();

export const artifactRouter = Router();

artifactRouter.get("/", async (_req, res) => {
  try {
    const metas = await db.list();
    res.json(metas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const art = await db.get(id);
    if (!art) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    res.json(art);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.post("/", async (req, res) => {
  try {
    const { title, type, content, desc, slug, coverImg, category, tags } = req.body;
    if (!title || !type || !content) {
      res.status(400).json({ error: "title, type, and content are required" });
      return;
    }
    if (type !== "html" && type !== "jsx") {
      res.status(400).json({ error: "type must be 'html' or 'jsx'" });
      return;
    }
    const art = await db.create({ title, type, content, desc, slug, coverImg, category, tags });
    res.status(201).json(art);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.post("/upload", async (req, res) => {
  try {
    const { filename, content: fileContent, title, category, tags } = req.body;
    if (!filename || !fileContent) {
      res.status(400).json({ error: "filename and content are required" });
      return;
    }

    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (!["html", "htm", "jsx", "tsx"].includes(ext)) {
      res.status(400).json({ error: "Only .html, .htm, .jsx, .tsx files allowed" });
      return;
    }

    const type = ext === "html" || ext === "htm" ? "html" : "jsx";
    const artTitle = title || filename.replace(/\.[^.]+$/, "");
    const tagList = tags ? tags.split(",").map((t: string) => t.trim()) : [];

    const art = await db.create({
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

artifactRouter.put("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const updated = await db.update(id, req.body);
    if (!updated) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

artifactRouter.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const deleted = await db.del(id);
    if (!deleted) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
