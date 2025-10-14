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
  try {
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao ler arquivo ${file}:`, error);
    return { perguntas: [] };
  }
};

const writeJson = async (file, data) => {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
};

// Mapeamento de matérias para arquivos
const materiasMap = {
  'matematica': 'matematica.json',
  'portugues': 'portugues.json', 
  'ingles': 'ingles.json',
  'historia': 'historia.json',
  'geografia': 'geografia.json',
  'fisica': 'fisica.json',
  'quimica': 'quimica.json',
  'biologia': 'biologia.json'
};

// ----------------------------
// ROTAS DO QUIZ MODIFICADAS
// ----------------------------

// GET - Buscar perguntas por matéria
app.get("/api/quiz/perguntas", async (req, res) => {
  try {
    const { materia, nivel, limit = 10 } = req.query;
    
    if (!materia) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'materia' é obrigatório"
      });
    }

    // Verificar se a matéria existe no mapeamento
    const arquivoMateria = materiasMap[materia.toLowerCase()];
    if (!arquivoMateria) {
      return res.status(404).json({
        success: false,
        error: `Matéria '${materia}' não encontrada`
      });
    }

    // Ler arquivo específico da matéria
    const quizData = await readJson(`./data/quiz/${arquivoMateria}`);
    
    let perguntas = [...quizData.perguntas];
    
    // Aplicar filtro de nível se fornecido
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
      data: perguntas, // ✅ AGORA ENVIAMOS A RESPOSTA CORRETA
      total: perguntas.length
    });
    
  } catch (error) {
    console.error("Erro ao buscar perguntas:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro interno ao buscar perguntas do quiz" 
    });
  }
});

// POST - Verificar resposta (agora desnecessário pois enviamos a resposta correta)
app.post("/api/quiz/verificar-resposta", async (req, res) => {
  try {
    const { perguntaId, resposta, materia } = req.body;
    
    if (!perguntaId || !resposta || !materia) {
      return res.status(400).json({
        success: false,
        error: "ID da pergunta, resposta e matéria são obrigatórios"
      });
    }
    
    const arquivoMateria = materiasMap[materia.toLowerCase()];
    if (!arquivoMateria) {
      return res.status(404).json({
        success: false,
        error: `Matéria '${materia}' não encontrada`
      });
    }

    const quizData = await readJson(`./data/quiz/${arquivoMateria}`);
    const pergunta = quizData.perguntas.find(p => p.id === perguntaId || p._id === perguntaId);
    
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
    const materias = Object.keys(materiasMap);
    
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

// POST - Adicionar nova pergunta (para admin) - AGORA ESPECIFICA MATÉRIA
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
    
    const arquivoMateria = materiasMap[materia.toLowerCase()];
    if (!arquivoMateria) {
      return res.status(404).json({
        success: false,
        error: `Matéria '${materia}' não encontrada`
      });
    }

    const quizData = await readJson(`./data/quiz/${arquivoMateria}`);
    
    const novaPergunta = {
      _id: (quizData.perguntas.length + 1).toString(),
      pergunta,
      opcoes,
      respostaCorreta,
      materia,
      nivel: nivel || "medio",
      explicacao: explicacao || ""
    };
    
    quizData.perguntas.push(novaPergunta);
    await writeJson(`./data/quiz/${arquivoMateria}`, quizData);
    
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

// GET - Estatísticas das matérias
app.get("/api/quiz/estatisticas", async (req, res) => {
  try {
    const estatisticas = {};
    
    for (const [materia, arquivo] of Object.entries(materiasMap)) {
      const quizData = await readJson(`./data/quiz/${arquivo}`);
      estatisticas[materia] = {
        totalPerguntas: quizData.perguntas.length,
        niveis: {}
      };
      
      // Contar por nível
      quizData.perguntas.forEach(p => {
        const nivel = p.nivel || 'medio';
        estatisticas[materia].niveis[nivel] = (estatisticas[materia].niveis[nivel] || 0) + 1;
      });
    }
    
    res.json({
      success: true,
      data: estatisticas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Erro ao buscar estatísticas"
    });
  }
});

// ----------------------------
// Rotas principais da API (existentes)
// ----------------------------
app.get("/", (req, res) => {
  res.send("📘 API MozEstuda está online! | 🎯 Quiz com Matérias Separadas");
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
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT} | 🎯 Quiz com Matérias Separadas!`));
