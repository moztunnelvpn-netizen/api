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
// ROTAS DO QUIZ
// ----------------------------

// GET - Buscar perguntas (com filtros opcionais)
app.get("/api/quiz/perguntas", async (req, res) => {
  try {
    const { materia, nivel, limit = 10 } = req.query;
    const quizData = await readJson("./data/quiz.json");
    
    let perguntas = [...quizData.perguntas];
    
    // Aplicar filtros
    if (materia) {
      perguntas = perguntas.filter(p => 
        p.materia.toLowerCase() === materia.toLowerCase()
      );
    }
    
    if (nivel) {
      perguntas = perguntas.filter(p => 
        p.nivel.toLowerCase() === nivel.toLowerCase()
      );
    }
    
    // Embaralhar perguntas
    perguntas = perguntas.sort(() => Math.random() - 0.5);
    
    // Limitar quantidade
    perguntas = perguntas.slice(0, parseInt(limit));
    
    // Remover resposta correta para o cliente
    const perguntasParaCliente = perguntas.map(p => {
      const { respostaCorreta, ...perguntaSemResposta } = p;
      return perguntaSemResposta;
    });
    
    res.json({
      success: true,
      data: perguntasParaCliente,
      total: perguntasParaCliente.length
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar perguntas do quiz" 
    });
  }
});

// POST - Verificar resposta
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
    const materias = [...new Set(quizData.perguntas.map(p => p.materia))];
    
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

// POST - Adicionar nova pergunta (para admin)
app.post("/api/quiz/perguntas", async (req, res) => {
  try {
    const { pergunta, opcoes, respostaCorreta, materia, nivel, explicacao } = req.body;
    
    // Validação básica
    if (!pergunta || !opcoes || !respostaCorreta || !materia) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: pergunta, opcoes, respostaCorreta, materia"
      });
    }
    
    const quizData = await readJson("./data/quiz.json");
    
    const novaPergunta = {
      id: (quizData.perguntas.length + 1).toString(),
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
// Rotas principais da API (existentes)
// ----------------------------
app.get("/", (req, res) => {
  res.send("📘 API MozEstuda está online! | 🎯 Quiz Disponível");
});

app.get("/api/ebooks", async (req, res) => {
  const ebooks = await readJson("./data/ebooks.json");
  res.json(ebooks);
});

app.get("/api/banners", async (req, res) => {
  const banners = await readJson("./data/banners.json");
  res.json(banners);
});

// ... (mantenha o resto do seu código existente para ebooks)

// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT} | 🎯 Quiz API Pronta!`));
