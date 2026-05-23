import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
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
