import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { initDB } from "./db.js";
import { artifactRouter } from "./routes/artifacts.js";
import { authRouter } from "./routes/auth.js";
import { rendererRouter } from "./routes/renderer.js";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/artifacts", artifactRouter);
app.use("/api", rendererRouter);

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/viewer/:id", (_req, res) => {
  res.sendFile(path.join(publicDir, "viewer.html"));
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Leonardo running on http://localhost:${PORT}`);
  });
});
