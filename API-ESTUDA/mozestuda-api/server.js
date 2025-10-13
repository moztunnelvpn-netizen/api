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
    console.error(`❌ Erro ao ler arquivo ${file}:`, error);
    return { perguntas: [] }; // Retorna estrutura vazia em caso de erro
  }
};

const writeJson = async (file, data) => {
  try {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`❌ Erro ao escrever arquivo ${file}:`, error);
  }
};

// ----------------------------
// ROTAS DO QUIZ - CORRIGIDAS
// ----------------------------

// ✅ ENDPOINT PRINCIPAL CORRIGIDO - AGORA ENVIA respostaCorreta
app.get("/api/quiz/perguntas", async (req, res) => {
  try {
    const { materia, nivel, limit = 10 } = req.query;
    console.log(`📥 Recebida requisição: materia=${materia}, nivel=${nivel}, limit=${limit}`);
    
    const quizData = await readJson("./data/quiz.json");
    
    let perguntas = [...quizData.perguntas];
    console.log(`📚 Total de perguntas no banco: ${perguntas.length}`);
    
    // ✅ FILTROS COM VERIFICAÇÃO DE SEGURANÇA
    if (materia && materia !== "undefined" && materia !== "null") {
      perguntas = perguntas.filter(p => 
        p.materia && p.materia.toLowerCase() === materia.toLowerCase()
      );
      console.log(`🎯 Perguntas após filtro de matéria: ${perguntas.length}`);
    }
    
    if (nivel && nivel !== "undefined" && nivel !== "null") {
      perguntas = perguntas.filter(p => 
        p.nivel && p.nivel.toLowerCase() === nivel.toLowerCase()
      );
      console.log(`🎯 Perguntas após filtro de nível: ${perguntas.length}`);
    }
    
    // ✅ VERIFICAR SE HÁ PERGUNTAS APÓS FILTRO
    if (perguntas.length === 0) {
      console.log("⚠️ Nenhuma pergunta encontrada com os filtros aplicados");
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: "Nenhuma pergunta encontrada para os critérios selecionados"
      });
    }
    
    // ✅ EMBARALHAR PERGUNTAS ALEATORIAMENTE
    perguntas = perguntas.sort(() => Math.random() - 0.5);
    console.log(`🎲 Perguntas embaralhadas: ${perguntas.length}`);
    
    // ✅ LIMITAR QUANTIDADE COM SEGURANÇA
    const limite = Math.min(parseInt(limit) || 10, 20); // Máximo 20 perguntas
    perguntas = perguntas.slice(0, limite);
    console.log(`📦 Perguntas após limite: ${perguntas.length}`);
    
    // ✅✅✅ CORREÇÃO CRÍTICA: NÃO REMOVER respostaCorreta
    // As perguntas vêm COMPLETAS para o app poder verificar localmente
    const perguntasParaCliente = perguntas.map(pergunta => {
      // ✅ Garantir que todas as perguntas tenham a estrutura correta
      return {
        id: pergunta.id || `pergunta_${Date.now()}_${Math.random()}`,
        pergunta: pergunta.pergunta || "Pergunta não disponível",
        opcoes: pergunta.opcoes || { A: "Opção A", B: "Opção B", C: "Opção C", D: "Opção D" },
        respostaCorreta: pergunta.respostaCorreta || "A", // ✅ SEMPRE INCLUIR
        materia: pergunta.materia || "Geral",
        nivel: pergunta.nivel || "medio",
        explicacao: pergunta.explicacao || ""
      };
    });
    
    console.log(`✅ Enviando ${perguntasParaCliente.length} perguntas COMPLETAS para o cliente`);
    
    res.json({
      success: true,
      data: perguntasParaCliente,
      total: perguntasParaCliente.length
    });
    
  } catch (error) {
    console.error("❌ Erro no endpoint /api/quiz/perguntas:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro interno ao buscar perguntas do quiz" 
    });
  }
});

// ✅ POST - Verificar resposta (para uso futuro ou verificação no servidor)
app.post("/api/quiz/verificar-resposta", async (req, res) => {
  try {
    const { perguntaId, resposta } = req.body;
    
    console.log(`🔍 Verificando resposta: perguntaId=${perguntaId}, resposta=${resposta}`);
    
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
    
    console.log(`📊 Resultado: ${estaCorreta ? "✅ CORRETO" : "❌ ERRADO"}`);
    
    res.json({
      success: true,
      data: {
        estaCorreta,
        respostaCorreta: pergunta.respostaCorreta,
        explicacao: pergunta.explicacao || ""
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao verificar resposta:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno ao verificar resposta"
    });
  }
});

// ✅ GET - Listar matérias disponíveis
app.get("/api/quiz/materias", async (req, res) => {
  try {
    const quizData = await readJson("./data/quiz.json");
    const materias = [...new Set(quizData.perguntas
      .map(p => p.materia)
      .filter(Boolean)
    )];
    
    console.log(`📚 Matérias disponíveis: ${materias.length}`);
    
    res.json({
      success: true,
      data: materias.sort()
    });
  } catch (error) {
    console.error("❌ Erro ao buscar matérias:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno ao buscar matérias"
    });
  }
});

// ✅ GET - Listar níveis disponíveis
app.get("/api/quiz/niveis", async (req, res) => {
  try {
    const quizData = await readJson("./data/quiz.json");
    const niveis = [...new Set(quizData.perguntas
      .map(p => p.nivel)
      .filter(Boolean)
    )];
    
    console.log(`📊 Níveis disponíveis: ${niveis.length}`);
    
    res.json({
      success: true,
      data: niveis.sort()
    });
  } catch (error) {
    console.error("❌ Erro ao buscar níveis:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno ao buscar níveis"
    });
  }
});

// ✅ POST - Adicionar nova pergunta (para admin)
app.post("/api/quiz/perguntas", async (req, res) => {
  try {
    const { pergunta, opcoes, respostaCorreta, materia, nivel, explicacao } = req.body;
    
    console.log(`➕ Adicionando nova pergunta: ${pergunta?.substring(0, 50)}...`);
    
    // Validação robusta
    if (!pergunta || !opcoes || !respostaCorreta || !materia) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: pergunta, opcoes, respostaCorreta, materia"
      });
    }
    
    // Validar opções
    if (!opcoes.A || !opcoes.B || !opcoes.C || !opcoes.D) {
      return res.status(400).json({
        success: false,
        error: "Todas as opções (A, B, C, D) são obrigatórias"
      });
    }
    
    // Validar resposta correta
    if (!['A', 'B', 'C', 'D'].includes(respostaCorreta)) {
      return res.status(400).json({
        success: false,
        error: "Resposta correta deve ser A, B, C ou D"
      });
    }
    
    const quizData = await readJson("./data/quiz.json");
    
    const novaPergunta = {
      id: `pergunta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pergunta: pergunta.trim(),
      opcoes: {
        A: opcoes.A.trim(),
        B: opcoes.B.trim(),
        C: opcoes.C.trim(),
        D: opcoes.D.trim()
      },
      respostaCorreta,
      materia: materia.trim(),
      nivel: (nivel || "medio").trim(),
      explicacao: (explicacao || "").trim()
    };
    
    quizData.perguntas.push(novaPergunta);
    await writeJson("./data/quiz.json", quizData);
    
    console.log(`✅ Pergunta adicionada com ID: ${novaPergunta.id}`);
    
    res.json({
      success: true,
      data: novaPergunta,
      message: "Pergunta adicionada com sucesso"
    });
    
  } catch (error) {
    console.error("❌ Erro ao adicionar pergunta:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno ao adicionar pergunta"
    });
  }
});

// ✅ GET - Health check do quiz
app.get("/api/quiz/health", async (req, res) => {
  try {
    const quizData = await readJson("./data/quiz.json");
    const totalPerguntas = quizData.perguntas.length;
    const materias = [...new Set(quizData.perguntas.map(p => p.materia).filter(Boolean)];
    const niveis = [...new Set(quizData.perguntas.map(p => p.nivel).filter(Boolean))];
    
    res.json({
      success: true,
      data: {
        status: "online",
        totalPerguntas,
        materias: materias.length,
        niveis: niveis.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Servidor com problemas"
    });
  }
});

// ----------------------------
// ROTAS PRINCIPAIS DA API
// ----------------------------

app.get("/", (req, res) => {
  res.json({
    message: "📘 API MozEstuda está online!",
    endpoints: {
      quiz: {
        "GET /api/quiz/perguntas": "Buscar perguntas aleatórias",
        "POST /api/quiz/verificar-resposta": "Verificar resposta",
        "GET /api/quiz/materias": "Listar matérias",
        "GET /api/quiz/niveis": "Listar níveis",
        "POST /api/quiz/perguntas": "Adicionar pergunta",
        "GET /api/quiz/health": "Status do servidor"
      },
      conteudo: {
        "GET /api/ebooks": "Listar ebooks",
        "GET /api/banners": "Listar banners"
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ Rota de ebooks com tratamento de erro
app.get("/api/ebooks", async (req, res) => {
  try {
    const ebooks = await readJson("./data/ebooks.json");
    res.json(ebooks);
  } catch (error) {
    console.error("❌ Erro ao carregar ebooks:", error);
    res.status(500).json({ 
      error: "Erro ao carregar lista de ebooks" 
    });
  }
});

// ✅ Rota de banners com tratamento de erro
app.get("/api/banners", async (req, res) => {
  try {
    const banners = await readJson("./data/banners.json");
    res.json(banners);
  } catch (error) {
    console.error("❌ Erro ao carregar banners:", error);
    res.status(500).json({ 
      error: "Erro ao carregar lista de banners" 
    });
  }
});

// ✅ Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Rota não encontrada: ${req.method} ${req.path}`,
    suggestion: "Verifique a documentação em GET /"
  });
});

// ✅ Middleware global de tratamento de erros
app.use((error, req, res, next) => {
  console.error("💥 Erro global não tratado:", error);
  res.status(500).json({
    success: false,
    error: "Erro interno do servidor",
    message: process.env.NODE_ENV === 'development' ? error.message : 'Entre em contato com o suporte'
  });
});

// ----------------------------
// INICIALIZAÇÃO DO SERVIDOR
// ----------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🎯 ==========================================`);
  console.log(`✅ Servidor Quiz API rodando!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🕐 Iniciado em: ${new Date().toLocaleString()}`);
  console.log(`🎯 ==========================================`);
  console.log(`📚 Endpoints disponíveis:`);
  console.log(`   GET  /api/quiz/perguntas`);
  console.log(`   POST /api/quiz/verificar-resposta`);
  console.log(`   GET  /api/quiz/materias`);
  console.log(`   GET  /api/quiz/niveis`);
  console.log(`   POST /api/quiz/perguntas`);
  console.log(`   GET  /api/quiz/health`);
  console.log(`   GET  /api/ebooks`);
  console.log(`   GET  /api/banners`);
  console.log(`🎯 ==========================================\n`);
});

// ✅ Tratamento gracioso de desligamento
process.on('SIGINT', () => {
  console.log('\n🛑 Servidor sendo encerrado...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Servidor recebeu SIGTERM...');
  process.exit(0);
});
