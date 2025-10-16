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
// ROTAS PARA EBOOKS RELACIONADOS
// ----------------------------

// GET - Buscar ebooks relacionados
app.get("/api/ebooks/relacionados", async (req, res) => {
  try {
    const { ebookId, categoria } = req.query;
    
    if (!ebookId && !categoria) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros ebookId ou categoria são obrigatórios"
      });
    }

    // Ler dados dos ebooks e relacionamentos
    const [ebooksData, relacionadosData] = await Promise.all([
      readJson("./data/ebooks.json"),
      readJson("./data/ebooks/relacionados.json")
    ]);

    let ebooksRelacionados = [];

    if (ebookId) {
      // ✅ BUSCAR POR ID ESPECÍFICO DO EBOOK
      const relacionamento = relacionadosData.relacionamentos.find(
        rel => rel.ebookId === parseInt(ebookId)
      );
      
      if (relacionamento) {
        ebooksRelacionados = ebooksData.filter(ebook =>
          relacionamento.ebooksRelacionados.includes(ebook.id)
        );
      }
    }

    // ✅ SE NÃO ENCONTRAR POR ID, BUSCAR POR CATEGORIA
    if (ebooksRelacionados.length === 0 && categoria) {
      ebooksRelacionados = ebooksData.filter(ebook =>
        ebook.categoria.toLowerCase() === categoria.toLowerCase() &&
        ebook.id !== parseInt(ebookId || 0)
      ).slice(0, 4); // Limitar a 4 ebooks
    }

    // ✅ EMBARALHAR RESULTADOS
    ebooksRelacionados = ebooksRelacionados.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: ebooksRelacionados,
      total: ebooksRelacionados.length
    });

  } catch (error) {
    console.error("❌ Erro ao buscar ebooks relacionados:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno do servidor ao buscar ebooks relacionados"
    });
  }
});

// POST - Adicionar relacionamento entre ebooks
app.post("/api/ebooks/relacionamentos", async (req, res) => {
  try {
    const { ebookId, ebooksRelacionados, categoria } = req.body;

    if (!ebookId || !ebooksRelacionados || !categoria) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: ebookId, ebooksRelacionados, categoria"
      });
    }

    const relacionadosData = await readJson("./data/ebooks/relacionados.json");

    // Verificar se já existe relacionamento para este ebook
    const index = relacionadosData.relacionamentos.findIndex(
      rel => rel.ebookId === parseInt(ebookId)
    );

    const novoRelacionamento = {
      ebookId: parseInt(ebookId),
      categoria,
      ebooksRelacionados: ebooksRelacionados.map(id => parseInt(id))
    };

    if (index !== -1) {
      // Atualizar existente
      relacionadosData.relacionamentos[index] = novoRelacionamento;
    } else {
      // Adicionar novo
      relacionadosData.relacionamentos.push(novoRelacionamento);
    }

    await writeJson("./data/ebooks/relacionados.json", relacionadosData);

    res.json({
      success: true,
      data: novoRelacionamento,
      message: "Relacionamento de ebooks atualizado com sucesso"
    });

  } catch (error) {
    console.error("❌ Erro ao adicionar relacionamento:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao adicionar relacionamento entre ebooks"
    });
  }
});
// ----------------------------
// ROTAS DO QUIZ (ORIGINAL)
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
    
    res.json({
      success: true,
      data: perguntas,
      total: perguntas.length
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

// POST - Adicionar nova pergunta
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

// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT} | 🎯 Quiz API Pronta!`));

