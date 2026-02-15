import express from "express";
import multer from "multer";
import * as ftp from "basic-ftp";
import dotenv from "dotenv";
import cors from "cors";
import { fileTypeFromBuffer } from "file-type"; // ✅ version buffer
import rateLimit from "express-rate-limit";
import { Readable } from "stream";
import path from "path";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: 60_000,
  max: 20,
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
  storage: multer.memoryStorage(), // ✅ Vercel compatible
  limits: { fileSize: 10 * 1024 * 1024 }, // ⚠️ 10MB max (RAM limitée sur Vercel)
  fileFilter: (req, file, cb) => {
    ALLOWED_MIMES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Type non autorisé"));
  },
});

// ─── Upload ───────────────────────────────────────────────────────────────────

app.post("/api/upload", limiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

  // ✅ Vérification MIME réelle depuis le buffer
  const real = await fileTypeFromBuffer(req.file.buffer);
  if (!real || !ALLOWED_MIMES.has(real.mime)) {
    return res.status(400).json({ error: "Fichier invalide ou type non autorisé" });
  }

  // ✅ Nom aléatoire sécurisé
  const ext = path.extname(req.file.originalname).toLowerCase();
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;

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

    // ✅ Convertir buffer en stream pour basic-ftp
    const stream = Readable.from(req.file.buffer);
    await client.uploadFrom(stream, filename);

    res.json({
      success: true,
      url: `${process.env.PUBLIC_BASE_URL}/${filename}`,
      filename,
    });
  } catch (err) {
    console.error("FTP Error:", err.message);
    res.status(500).json({ error: "Erreur FTP : " + err.message });
  } finally {
    client.close();
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.json({ status: "ok" }));

app.listen(3001, () => console.log("🚀 Server running on port 3001"));