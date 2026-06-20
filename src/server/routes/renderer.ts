import { Router } from "express";
import { getArtifact } from "../db.js";
import { renderArtifact } from "../services/sandbox.js";

export const rendererRouter = Router();

rendererRouter.get("/render/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const art = getArtifact(id);
    if (!art) {
      res.status(404).json({ error: "Artifact not found" });
      return;
    }

    const html = await renderArtifact({
      content: art.content,
      type: art.type,
      title: art.title,
    });

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rendererRouter.post("/render", async (req, res) => {
  try {
    const { content, type, title } = req.body;
    if (!content || !type) {
      res.status(400).json({ error: "content and type are required" });
      return;
    }

    const html = await renderArtifact({ content, type, title });
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
