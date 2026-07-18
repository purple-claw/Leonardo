import { Router } from "express";
import { createUser, getUserByUsername, getUserById, getUserCount, createSession, getSessionUserId, destroySession, verifyPassword } from "../db.js";

export const authRouter = Router();

authRouter.post("/register", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    if (username.length < 2) {
      res.status(400).json({ error: "username must be at least 2 characters" });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: "password must be at least 4 characters" });
      return;
    }
    const isFirst = getUserCount() === 0;
    const role = isFirst ? 'admin' : 'user';
    const user = createUser(username, password, role);
    if (!user) {
      res.status(409).json({ error: "username already taken" });
      return;
    }
    const token = createSession(user.id);
    res.status(201).json({ user, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    const user = getUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: "invalid username or password" });
      return;
    }
    const token = createSession(user.id);
    res.json({ user: { id: user.id, username: user.username, role: user.role }, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.get("/me", (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "no token" });
      return;
    }
    const userId = getSessionUserId(token);
    if (!userId) {
      res.status(401).json({ error: "invalid or expired token" });
      return;
    }
    const user = getUserById(userId);
    if (!user) {
      res.status(401).json({ error: "user not found" });
      return;
    }
    res.json({ user, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

authRouter.post("/logout", (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token) destroySession(token);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
