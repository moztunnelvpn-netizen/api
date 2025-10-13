import express from "express";
import cors from "cors";
import fs from "fs-extra";
import multer from "multer";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// Pasta estática para arquivos
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
// ROTAS DO QUIZ - CORRIGIDAS
// ----------------------------

// ✅ ENDPOINT CORRIGIDO: AGORA ENVIA respostaCorreta
app.get("/api/quiz/perguntas", async (req, res) => {
  try {
    const { materia, nivel, limit = 10 } = req.query;
    console.log(`📥 Recebida requisição: materia=${materia}, nivel=${nivel}, limit=${limit}`);
    
    const quizData = await readJson("./data/quiz.json");
    
    let perguntas = [...quizData.perguntas];
    console.log(`📚 Total de perguntas no banco: ${perguntas.length}`);
    
    // Aplicar filtros
    if (materia && materia !== "undefined") {
      perguntas = perguntas.filter(p => 
        p.materia && p.materia.toLowerCase() === materia.toLowerCase()
      );
      console.log(`🎯 Perguntas após filtro de matéria: ${perguntas.length}`);
    }
    
    if (nivel && nivel !== "undefined") {
      perguntas = perguntas.filter(p => 
        p.nivel && p.nivel.toLowerCase() === nivel.toLowerCase()
      );
      console.log(`🎯 Perguntas após filtro de nível: ${perguntas.length}`);
    }
    
    // ✅ EMBARALHAR PERGUNTAS
    perguntas = perguntas.sort(() => Math.random() - 0.5);
    console.log(`🎲 Perguntas embaralhadas: ${perguntas.length}`);
    
    // Limitar quantidade
    const limite = parseInt(limit);
    perguntas = perguntas.slice(0, limite);
    console.log(`📦 Perguntas após limite: ${perguntas.length}`);
    
    // ✅ CORREÇÃO: NÃO REMOVER respostaCorreta
    // Agora as perguntas vêm COMPLETAS para o app
    const perguntasParaCliente = [...perguntas];
    
    console.log(`✅ Enviando ${perguntasParaCliente.length} perguntas para o cliente`);
    
    res.json({
      success: true,
      data: perguntasParaCliente,
      total: perguntasParaCliente.length
    });
    
  } catch (error) {
    console.error("❌ Erro no endpoint /api/quiz/perguntas:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar perguntas do quiz" 
    });
  }
});

// POST - Verificar resposta (para uso futuro)
app.post("/api/quiz/verificar-resposta", async (req, res) => {
  try {
    const { perguntaId, resposta } = req.body;
    
    if (!perguntaId || !resposta) {
      return res.status(400).json({
        success: false,
        error: "ID da pergunta e resposta são obrigatórios"
      });
    }
    
    const quizData = await readJson("./data/quiz.json");
    const pergunta = quizData.perguntas.find(p => p.id === perguntaId);
    
    if (!pergunta) {
      return res.status(404).json({
        success: false,
        error: "Pergunta não encontrada"
      });
    }
    
    const estaCorreta = pergunta.respostaCorreta === resposta;
    
    res.json({
      success: true,
      data: {
        estaCorreta,
        respostaCorreta: pergunta.respostaCorreta,
        explicacao: pergunta.explicacao
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Erro ao verificar resposta"
    });
  }
});

// GET - Listar matérias disponíveis
app.get("/api/quiz/materias", async (req, res) => {
  try {
    const quizData = await readJson("./data/quiz.json");
    const materias = [...new Set(quizData.perguntas.map(p => p.materia))].filter(Boolean);
    
    res.json({
      success: true,
      data: materias
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Erro ao buscar matérias"
    });
  }
});

// POST - Adicionar nova pergunta
app.post("/api/quiz/perguntas", async (req, res) => {
  try {
    const { pergunta, opcoes, respostaCorreta, materia, nivel, explicacao } = req.body;
    
    if (!pergunta || !opcoes || !respostaCorreta || !materia) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: pergunta, opcoes, respostaCorreta, materia"
      });
    }
    
    const quizData = await readJson("./data/quiz.json");
    
    const novaPergunta = {
      id: `pergunta_${Date.now()}`,
      pergunta,
      opcoes,
      respostaCorreta,
      materia,
      nivel: nivel || "medio",
      explicacao: explicacao || ""
    };
    
    quizData.perguntas.push(novaPergunta);
    await writeJson("./data/quiz.json", quizData);
    
    res.json({
      success: true,
      data: novaPergunta
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Erro ao adicionar pergunta"
    });
  }
});

// ----------------------------
// Rotas principais da API
// ----------------------------
app.get("/", (req, res) => {
  res.send("📘 API MozEstuda está online! | 🎯 Quiz Disponível");
});

app.get("/api/ebooks", async (req, res) => {
  try {
    const ebooks = await readJson("./data/ebooks.json");
    res.json(ebooks);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar ebooks" });
  }
});

app.get("/api/banners", async (req, res) => {
  try {
    const banners = await readJson("./data/banners.json");
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar banners" });
  }
});

// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎯 Servidor Quiz rodando em http://localhost:${PORT}`);
  console.log(`✅ Endpoints disponíveis:`);
  console.log(`   GET  /api/quiz/perguntas`);
  console.log(`   POST /api/quiz/verificar-resposta`);
  console.log(`   GET  /api/quiz/materias`);
  console.log(`   GET  /api/ebooks`);
  console.log(`   GET  /api/banners`);
});
