import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { getConfig } from "../config.js";

// PR 2b: the uploads directory is resolved via getConfig() at request
// time (inside the multer `destination` callback), NOT at module import
// time. This satisfies the import-order rule — this module is imported
// by index.ts before loadConfig() runs, but getConfig() is only called
// once an actual upload request arrives, which is well after boot.
//
// Observational behavior is identical: the directory always exists by
// the time a photo is written.

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = getConfig().uploadsDir;
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadRouter = Router();

uploadRouter.post("/", upload.single("photo"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No photo uploaded" });
    return;
  }
  res.json({ path: `/uploads/${req.file.filename}` });
});
