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

// ----------------------------
// Novos Endpoints para Detalhes
// ----------------------------

// Buscar ebook por ID
app.get("/api/ebooks/:id", async (req, res) => {
    try {
        const ebooks = await readJson("./data/ebooks.json");
        const ebook = ebooks.find(e => e.id === req.params.id);
        
        if (ebook) {
            // ✅ DADOS COMPLETOS DO EBOOK
            const ebookCompleto = {
                ...ebook,
                // Informações adicionais
                paginas: Math.floor(Math.random() * 200) + 100, // Exemplo
                idioma: "Português",
                nivel: getNivelDificuldade(ebook.categoria),
                rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 - 5.0
                dataPublicacao: ebook.dataCriacao || "2024",
                tags: [ebook.categoria, "educação", "aprendizado"],
                downloads: Math.floor(Math.random() * 1000),
                isbn: `ISBN-${Date.now()}`
            };
            res.json({ success: true, data: ebookCompleto });
        } else {
            res.status(404).json({ success: false, error: "Ebook não encontrado" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: "Erro ao buscar ebook" });
    }
});

// Buscar ebooks relacionados por categoria
app.get("/api/ebooks/:id/related", async (req, res) => {
    try {
        const ebooks = await readJson("./data/ebooks.json");
        const ebookAtual = ebooks.find(e => e.id === req.params.id);
        
        if (!ebookAtual) {
            return res.status(404).json({ success: false, error: "Ebook não encontrado" });
        }

        // ✅ EBOOKS DA MESMA CATEGORIA (excluindo o atual)
        const relacionados = ebooks.filter(e => 
            e.id !== req.params.id && 
            e.categoria === ebookAtual.categoria
        ).slice(0, 5); // Limitar a 5 ebooks

        res.json({ success: true, data: relacionados });
    } catch (error) {
        res.status(500).json({ success: false, error: "Erro ao buscar relacionados" });
    }
});

// Buscar por categoria
app.get("/api/ebooks/category/:categoria", async (req, res) => {
    try {
        const ebooks = await readJson("./data/ebooks.json");
        const ebooksCategoria = ebooks.filter(e => 
            e.categoria.toLowerCase() === req.params.categoria.toLowerCase()
        );
        
        res.json({ success: true, data: ebooksCategoria });
    } catch (error) {
        res.status(500).json({ success: false, error: "Erro ao buscar por categoria" });
    }
});

// Função auxiliar para nível de dificuldade
function getNivelDificuldade(categoria) {
    const niveis = {
        "Programação": "Intermediário",
        "Matemática": "Avançado", 
        "Ciências": "Básico",
        "História": "Básico",
        "Línguas": "Intermediário"
    };
    return niveis[categoria] || "Básico";
}

