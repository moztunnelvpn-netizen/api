import express from "express";
import cors from "cors";
import fs from "fs-extra";
import multer from "multer";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// Pasta estática para arquivos (capas, PDFs)
app.use("/uploads", express.static("uploads"));

// ----------------------------
// Funções auxiliares
// ----------------------------
const readJson = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const writeJson = async (file, data) => {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
};

// ----------------------------
// Rotas principais da API
// ----------------------------
app.get("/", (req, res) => {
  res.send("📘 API MozEstuda está online!");
});

app.get("/api/ebooks", async (req, res) => {
  const ebooks = await readJson("./data/ebooks.json");
  res.json(ebooks);
});

app.get("/api/banners", async (req, res) => {
  const banners = await readJson("./data/banners.json");
  res.json(banners);
});

// ----------------------------
// Upload de arquivos (Admin simples)
// ----------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Endpoint para subir capa ou ebook
app.post("/api/upload", upload.single("file"), (req, res) => {
  const filePath = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url: filePath });
});

// Adicionar novo ebook (salva no JSON)
app.post("/api/ebooks", async (req, res) => {
  const ebooks = await readJson("./data/ebooks.json");
  const novo = { id: Date.now().toString(), ...req.body };
  ebooks.push(novo);
  await writeJson("./data/ebooks.json", ebooks);
  res.json({ success: true, ebook: novo });
});

// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT}`));
