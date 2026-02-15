import express from "express";
import multer from "multer";
import * as ftp from "basic-ftp";
import dotenv from "dotenv";
import cors from "cors";
import { unlink } from "fs/promises";
import { fileTypeFromFile } from "file-type"; // ✅ npm install file-type
import rateLimit from "express-rate-limit"; // ✅ npm install express-rate-limit
import path from "path";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 20, // 20 uploads max par IP
  message: { error: "Trop de requêtes, réessaye dans 1 minute." },
});

// ─── Multer ───────────────────────────────────────────────────────────────────

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: "/tmp",
    filename: (req, file, cb) => {
      // ✅ 1. Nom aléatoire — évite path traversal et conflits
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Premier filtre rapide sur le MIME déclaré
    ALLOWED_MIMES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Type non autorisé"));
  },
});

// ─── Upload ───────────────────────────────────────────────────────────────────

app.post("/api/upload", limiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

  // ✅ 4. Vérification MIME réelle (contenu du fichier, pas juste le header)
  const real = await fileTypeFromFile(req.file.path);
  if (!real || !ALLOWED_MIMES.has(real.mime)) {
    await unlink(req.file.path).catch(() => {});
    return res
      .status(400)
      .json({ error: "Fichier invalide ou type non autorisé" });
  }

  const client = new ftp.Client(30_000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      port: parseInt(process.env.FTP_PORT) || 21,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
    });

    await client.ensureDir(process.env.FTP_UPLOAD_PATH);
    await client.uploadFrom(req.file.path, req.file.filename);

    res.json({
      success: true,
      url: `${process.env.PUBLIC_BASE_URL}/${req.file.filename}`,
      filename: req.file.filename,
    });
  } catch (err) {
    console.error("FTP Error:", err.message);
    res.status(500).json({ error: "Erreur FTP : " + err.message });
  } finally {
    client.close();
    unlink(req.file.path).catch(() => {});
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.json({ status: "ok" }));

app.listen(3001, () => console.log("🚀 Server running on port 3001"));
