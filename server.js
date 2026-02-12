import express from "express";
import multer from "multer";
import * as ftp from "basic-ftp";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { Readable } from "stream";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: ["https://file-upload-octenium-ui.vercel.app"],
  }),
);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé"), false);
    }
  },
});

// ✅ Route d'upload
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu" });
  }

  const client = new ftp.Client();
  client.ftp.verbose = true; // logs détaillés dans le terminal

  try {
    // Connexion FTP
    await client.access({
      host: process.env.FTP_HOST,
      port: parseInt(process.env.FTP_PORT) || 21,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false, // mettre true si ton hébergeur supporte FTPS
    });

    // Naviguer vers le dossier uploads
    await client.ensureDir(process.env.FTP_UPLOAD_PATH);

    // Nom unique pour éviter les conflits
    const timestamp = Date.now();
    const filename = `${timestamp}-${req.file.originalname.replace(/\s/g, "_")}`;

    // Convertir le buffer en stream lisible pour basic-ftp
    const stream = Readable.from(req.file.buffer);

    // Upload
    await client.uploadFrom(stream, filename);

    client.close();

    const publicUrl = `${process.env.PUBLIC_BASE_URL}/${filename}`;

    return res.status(200).json({
      success: true,
      url: publicUrl,
      filename,
    });
  } catch (err) {
    console.error("FTP Error:", err.message);
    client.close();
    return res.status(500).json({
      error: "Erreur FTP : " + err.message,
    });
  }
});

// Health check
app.get("/", (req, res) => res.json({ status: "ok" }));

app.listen(3001, () => console.log("Server running on port 3001"));
