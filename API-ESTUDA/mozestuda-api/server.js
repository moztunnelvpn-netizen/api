import express from "express";
import cors from "cors";
import fs from "fs-extra";
import multer from "multer";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());
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

// Mapeamento de matérias para arquivos (baseado no seu quiz.json)
const materiasMap = {
  'geografia': 'geografia.json',
  'literatura': 'literatura.json', 
  'química': 'quimica.json',
  'história': 'historia.json',
  'matemática': 'matematica.json'
};

// Função para detectar matérias automaticamente
const detectarMaterias = async () => {
  try {
    const files = await fs.readdir('./data/quiz');
    const materias = files
      .filter(file => file.endsWith('.json') && file !== 'quiz.json')
      .map(file => file.replace('.json', ''));
    
    console.log('📚 Matérias detectadas:', materias);
    return materias;
  } catch (error) {
    console.log('📚 Usando mapeamento padrão de matérias');
    return Object.keys(materiasMap);
  }
};

// ----------------------------
// ROTAS DO QUIZ - COMPATÍVEL COM AMBAS ESTRUTURAS
// ----------------------------

app.get("/api/quiz/perguntas", async (req, res) => {
  try {
    const { materia, nivel, limit = 10 } = req.query;
    
    if (!materia) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'materia' é obrigatório"
      });
    }

    let perguntas = [];

    // PRIMEIRO: Tentar arquivo específico da matéria
    const materiaLower = materia.toLowerCase();
    const arquivoEspecifico = `./data/quiz/${materiaLower}.json`;
    
    if (await fs.pathExists(arquivoEspecifico)) {
      // ✅ Usar arquivo separado da matéria
      const quizData = await readJson(arquivoEspecifico);
      perguntas = [...quizData.perguntas];
      console.log(`📖 Carregando de ${materiaLower}.json: ${perguntas.length} perguntas`);
    } else {
      // ✅ Fallback: usar quiz.json geral e filtrar
      const quizData = await readJson("./data/quiz.json");
      perguntas = quizData.perguntas.filter(p => 
        p.materia.toLowerCase() === materiaLower
      );
      console.log(`📖 Carregando de quiz.json (filtrado): ${perguntas.length} perguntas`);
    }
    
    // Aplicar filtro de nível se fornecido
    if (nivel && perguntas.length > 0) {
      perguntas = perguntas.filter(p => 
        p.nivel.toLowerCase() === nivel.toLowerCase()
      );
    }
    
    // Embaralhar e limitar
    perguntas = perguntas.sort(() => Math.random() - 0.5);
    perguntas = perguntas.slice(0, parseInt(limit));
    
    if (perguntas.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Nenhuma pergunta encontrada para ${materia}`
      });
    }
    
    res.json({
      success: true,
      data: perguntas,
      total: perguntas.length
    });
    
  } catch (error) {
    console.error("Erro ao buscar perguntas:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro interno ao buscar perguntas" 
    });
  }
});

// GET - Listar matérias disponíveis (automático)
app.get("/api/quiz/materias", async (req, res) => {
  try {
    const materias = await detectarMaterias();
    
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

// POST - Adicionar nova pergunta (inteligente)
app.post("/api/quiz/perguntas", async (req, res) => {
  try {
    const { pergunta, opcoes, respostaCorreta, materia, nivel, explicacao } = req.body;
    
    if (!pergunta || !opcoes || !respostaCorreta || !materia) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: pergunta, opcoes, respostaCorreta, materia"
      });
    }

    const materiaLower = materia.toLowerCase();
    const arquivoMateria = `./data/quiz/${materiaLower}.json`;
    
    let quizData;
    let usarArquivoEspecifico = false;

    // Decidir onde salvar
    if (await fs.pathExists(arquivoMateria)) {
      // ✅ Salvar no arquivo específico da matéria
      quizData = await readJson(arquivoMateria);
      usarArquivoEspecifico = true;
    } else {
      // ✅ Salvar no quiz.json geral
      quizData = await readJson("./data/quiz.json");
    }
    
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
    
    if (usarArquivoEspecifico) {
      await fs.writeJson(arquivoMateria, quizData, { spaces: 2 });
    } else {
      await fs.writeJson("./data/quiz.json", quizData, { spaces: 2 });
    }
    
    res.json({
      success: true,
      data: novaPergunta,
      arquivo: usarArquivoEspecifico ? `${materiaLower}.json` : 'quiz.json'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Erro ao adicionar pergunta"
    });
  }
});

// ----------------------------
// ROTAS EXISTENTES (mantenha as suas)
// ----------------------------
app.get("/", (req, res) => {
  res.send("📘 API MozEstuda está online! | 🎯 Quiz com Separação Inteligente de Matérias");
});

app.get("/api/ebooks", async (req, res) => {
  const ebooks = await readJson("./data/ebooks.json");
  res.json(ebooks);
});

app.get("/api/banners", async (req, res) => {
  const banners = await readJson("./data/banners.json");
  res.json(banners);
});

// POST - Verificar resposta (mantenha seu código existente)
app.post("/api/quiz/verificar-resposta", async (req, res) => {
  // ... (mantenha seu código atual)
});

// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando em http://localhost:${PORT} | 🎯 Sistema de Matérias Híbrido!`));
