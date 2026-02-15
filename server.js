import express from "express";
import multer from "multer";
import * as ftp from "basic-ftp";
import dotenv from "dotenv";
import cors from "cors";
import { unlink } from "fs/promises";

dotenv.config();

const app = express();
app.use(cors());

// ─── Multer ───────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: "/tmp",
    filename: (req, file, cb) => {
      const safe = file.originalname
        .replace(/\s/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Type non autorisé"));
  },
});

// ─── Upload ───────────────────────────────────────────────────────────────────

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

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
