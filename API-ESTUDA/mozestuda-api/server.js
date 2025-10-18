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
// ROTAS DO QUIZ (ATUALIZADA - ORGANIZADA POR NÍVEL)
// ----------------------------

// GET - Buscar perguntas por nível e matéria
app.get("/api/quiz/perguntas", async (req, res) => {
  try {
    const { materia, nivel, limit = 10 } = req.query;
    
    if (!materia || !nivel) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros 'materia' e 'nivel' são obrigatórios"
      });
    }

    // Mapear níveis para pastas
    const niveisMap = {
      'primario': 'primario',
      'secundario': 'secundario', 
      'medio': 'secundario', // compatibilidade
      'superior': 'superior'
    };

    const pastaNivel = niveisMap[nivel.toLowerCase()];
    
    if (!pastaNivel) {
      return res.status(400).json({
        success: false,
        error: "Nível inválido. Use: primario, secundario ou superior"
      });
    }

    const arquivoMateria = `./data/quiz/${pastaNivel}/${materia.toLowerCase()}.json`;
    
    // Verificar se o arquivo existe
    if (!await fs.pathExists(arquivoMateria)) {
      return res.status(404).json({
        success: false,
        error: `Matéria '${materia}' não encontrada para o nível '${nivel}'`
      });
    }

    // Ler perguntas da matéria específica
    const materiaData = await readJson(arquivoMateria);
    let perguntas = [...materiaData.perguntas];
    
    // Embaralhar perguntas
    perguntas = perguntas.sort(() => Math.random() - 0.5);
    
    // Limitar quantidade
    perguntas = perguntas.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: perguntas,
      total: perguntas.length,
      materia: materia,
      nivel: nivel
    });
    
  } catch (error) {
    console.error("❌ Erro ao buscar perguntas:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar perguntas do quiz" 
    });
  }
});

// POST - Verificar resposta
app.post("/api/quiz/verificar-resposta", async (req, res) => {
  try {
    const { perguntaId, resposta, materia, nivel } = req.body;
    
    if (!perguntaId || !resposta || !materia || !nivel) {
      return res.status(400).json({
        success: false,
        error: "ID da pergunta, resposta, materia e nivel são obrigatórios"
      });
    }
    
    // Mapear níveis para pastas
    const niveisMap = {
      'primario': 'primario',
      'secundario': 'secundario',
      'medio': 'secundario',
      'superior': 'superior'
    };

    const pastaNivel = niveisMap[nivel.toLowerCase()];
    
    if (!pastaNivel) {
      return res.status(400).json({
        success: false,
        error: "Nível inválido. Use: primario, secundario ou superior"
      });
    }

    const arquivoMateria = `./data/quiz/${pastaNivel}/${materia.toLowerCase()}.json`;
    
    // Verificar se o arquivo existe
    if (!await fs.pathExists(arquivoMateria)) {
      return res.status(404).json({
        success: false,
        error: `Matéria '${materia}' não encontrada para o nível '${nivel}'`
      });
    }

    const materiaData = await readJson(arquivoMateria);
    const pergunta = materiaData.perguntas.find(p => p.id === perguntaId);
    
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
    console.error("❌ Erro ao verificar resposta:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao verificar resposta"
    });
  }
});

// GET - Listar matérias disponíveis por nível
app.get("/api/quiz/materias", async (req, res) => {
  try {
    const { nivel } = req.query;
    
    if (!nivel) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'nivel' é obrigatório"
      });
    }

    // Mapear níveis para pastas
    const niveisMap = {
      'primario': 'primario',
      'secundario': 'secundario',
      'medio': 'secundario',
      'superior': 'superior'
    };

    const pastaNivel = niveisMap[nivel.toLowerCase()];
    
    if (!pastaNivel) {
      return res.status(400).json({
        success: false,
        error: "Nível inválido. Use: primario, secundario ou superior"
      });
    }

    const pastaPath = `./data/quiz/${pastaNivel}`;
    
    // Verificar se a pasta existe
    if (!await fs.pathExists(pastaPath)) {
      return res.json({
        success: true,
        data: [],
        message: "Nenhuma matéria encontrada para este nível"
      });
    }

    // Listar arquivos JSON na pasta
    const arquivos = await fs.readdir(pastaPath);
    const materias = arquivos
      .filter(arquivo => arquivo.endsWith('.json'))
      .map(arquivo => arquivo.replace('.json', ''));

    res.json({
      success: true,
      data: materias,
      nivel: nivel
    });
    
  } catch (error) {
    console.error("❌ Erro ao buscar matérias:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar matérias"
    });
  }
});

// GET - Listar todos os níveis disponíveis
app.get("/api/quiz/niveis", async (req, res) => {
  try {
    const pastaQuiz = './data/quiz';
    
    // Verificar se a pasta quiz existe
    if (!await fs.pathExists(pastaQuiz)) {
      return res.json({
        success: true,
        data: [],
        message: "Nenhum nível encontrado"
      });
    }

    // Listar pastas de níveis
    const itens = await fs.readdir(pastaQuiz);
    const niveis = itens.filter(item => {
      return fs.statSync(path.join(pastaQuiz, item)).isDirectory();
    });

    res.json({
      success: true,
      data: niveis
    });
    
  } catch (error) {
    console.error("❌ Erro ao buscar níveis:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar níveis"
    });
  }
});

// POST - Adicionar nova pergunta (atualizada)
app.post("/api/quiz/perguntas", async (req, res) => {
  try {
    const { pergunta, opcoes, respostaCorreta, materia, nivel, explicacao } = req.body;
    
    // Validação básica
    if (!pergunta || !opcoes || !respostaCorreta || !materia || !nivel) {
      return res.status(400).json({
        success: false,
        error: "Campos obrigatórios: pergunta, opcoes, respostaCorreta, materia, nivel"
      });
    }
    
    // Mapear níveis para pastas
    const niveisMap = {
      'primario': 'primario',
      'secundario': 'secundario',
      'medio': 'secundario',
      'superior': 'superior'
    };

    const pastaNivel = niveisMap[nivel.toLowerCase()];
    
    if (!pastaNivel) {
      return res.status(400).json({
        success: false,
        error: "Nível inválido. Use: primario, secundario ou superior"
      });
    }

    // Garantir que a pasta do nível existe
    const pastaNivelPath = `./data/quiz/${pastaNivel}`;
    await fs.ensureDir(pastaNivelPath);

    const arquivoMateria = `${pastaNivelPath}/${materia.toLowerCase()}.json`;
    
    // Verificar/Criar arquivo da matéria
    let materiaData;
    if (await fs.pathExists(arquivoMateria)) {
      materiaData = await readJson(arquivoMateria);
    } else {
      materiaData = { perguntas: [] };
    }
    
    // Gerar ID único
    const novoId = materiaData.perguntas.length > 0 
      ? Math.max(...materiaData.perguntas.map(p => parseInt(p.id))) + 1 
      : 1;
    
    const novaPergunta = {
      id: novoId.toString(),
      pergunta,
      opcoes,
      respostaCorreta,
      materia,
      nivel: nivel,
      explicacao: explicacao || ""
    };
    
    materiaData.perguntas.push(novaPergunta);
    await writeJson(arquivoMateria, materiaData);
    
    res.json({
      success: true,
      data: novaPergunta,
      message: `Pergunta adicionada à matéria ${materia} (${nivel})`
    });
    
  } catch (error) {
    console.error("❌ Erro ao adicionar pergunta:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao adicionar pergunta"
    });
  }
});

// GET - Estatísticas do quiz
app.get("/api/quiz/estatisticas", async (req, res) => {
  try {
    const { nivel } = req.query;
    
    const pastaQuiz = './data/quiz';
    const estatisticas = {
      totalPerguntas: 0,
      totalMaterias: 0,
      porNivel: {}
    };

    // Verificar se a pasta quiz existe
    if (!await fs.pathExists(pastaQuiz)) {
      return res.json({
        success: true,
        data: estatisticas
      });
    }

    // Listar pastas de níveis
    const niveis = await fs.readdir(pastaQuiz);
    
    for (const nivelDir of niveis) {
      const nivelPath = path.join(pastaQuiz, nivelDir);
      const stat = await fs.stat(nivelPath);
      
      if (stat.isDirectory()) {
        estatisticas.porNivel[nivelDir] = {
          totalPerguntas: 0,
          materias: 0
        };

        // Listar arquivos de matéria neste nível
        const arquivos = await fs.readdir(nivelPath);
        const materiasArquivos = arquivos.filter(arq => arq.endsWith('.json'));
        
        estatisticas.porNivel[nivelDir].materias = materiasArquivos.length;
        estatisticas.totalMaterias += materiasArquivos.length;

        // Contar perguntas em cada matéria
        for (const materiaArq of materiasArquivos) {
          const materiaPath = path.join(nivelPath, materiaArq);
          const materiaData = await readJson(materiaPath);
          const totalPerguntasMateria = materiaData.perguntas ? materiaData.perguntas.length : 0;
          
          estatisticas.porNivel[nivelDir].totalPerguntas += totalPerguntasMateria;
          estatisticas.totalPerguntas += totalPerguntasMateria;
        }
      }
    }

    res.json({
      success: true,
      data: estatisticas
    });
    
  } catch (error) {
    console.error("❌ Erro ao buscar estatísticas:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar estatísticas"
    });
  }
});

// GET - Buscar perguntas aleatórias de qualquer matéria (modo misto)
app.get("/api/quiz/aleatorio", async (req, res) => {
  try {
    const { nivel, limit = 10 } = req.query;
    
    if (!nivel) {
      return res.status(400).json({
        success: false,
        error: "Parâmetro 'nivel' é obrigatório"
      });
    }

    // Mapear níveis para pastas
    const niveisMap = {
      'primario': 'primario',
      'secundario': 'secundario',
      'medio': 'secundario',
      'superior': 'superior'
    };

    const pastaNivel = niveisMap[nivel.toLowerCase()];
    
    if (!pastaNivel) {
      return res.status(400).json({
        success: false,
        error: "Nível inválido. Use: primario, secundario ou superior"
      });
    }

    const pastaPath = `./data/quiz/${pastaNivel}`;
    
    // Verificar se a pasta existe
    if (!await fs.pathExists(pastaPath)) {
      return res.status(404).json({
        success: false,
        error: "Nenhuma matéria encontrada para este nível"
      });
    }

    // Listar arquivos JSON na pasta
    const arquivos = await fs.readdir(pastaPath);
    const materiasArquivos = arquivos.filter(arquivo => arquivo.endsWith('.json'));
    
    if (materiasArquivos.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Nenhuma matéria encontrada para este nível"
      });
    }

    // Coletar todas as perguntas de todas as matérias
    let todasPerguntas = [];
    
    for (const materiaArq of materiasArquivos) {
      const materiaPath = path.join(pastaPath, materiaArq);
      const materiaData = await readJson(materiaPath);
      
      if (materiaData.perguntas && materiaData.perguntas.length > 0) {
        todasPerguntas = todasPerguntas.concat(materiaData.perguntas);
      }
    }

    // Embaralhar todas as perguntas
    todasPerguntas = todasPerguntas.sort(() => Math.random() - 0.5);
    
    // Limitar quantidade
    const perguntasSelecionadas = todasPerguntas.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: perguntasSelecionadas,
      total: perguntasSelecionadas.length,
      nivel: nivel,
      tipo: "aleatorio"
    });
    
  } catch (error) {
    console.error("❌ Erro ao buscar perguntas aleatórias:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar perguntas aleatórias"
    });
  }
});

// ----------------------------
// Rotas principais da API (existentes)
// ----------------------------
app.get("/", (req, res) => {
  res.send("📘 API MozEstuda está online! | 🎯 Quiz Disponível | 🎓 Níveis: Primário, Secundário, Superior");
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

// Rota para servir arquivos de dados do quiz (para debug)
app.get("/api/quiz/debug/:nivel/:materia", async (req, res) => {
  try {
    const { nivel, materia } = req.params;
    const arquivoMateria = `./data/quiz/${nivel}/${materia}.json`;
    
    if (!await fs.pathExists(arquivoMateria)) {
      return res.status(404).json({
        success: false,
        error: "Arquivo não encontrado"
      });
    }

    const materiaData = await readJson(arquivoMateria);
    res.json({
      success: true,
      data: materiaData
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Erro ao carregar dados"
    });
  }
});

// ----------------------------
// Inicialização do servidor
// ----------------------------
const PORT = process.env.PORT || 3000;

// Função para inicializar estrutura de pastas
const inicializarEstruturaQuiz = async () => {
  try {
    const pastas = [
      './data/quiz/primario',
      './data/quiz/secundario', 
      './data/quiz/superior'
    ];

    for (const pasta of pastas) {
      await fs.ensureDir(pasta);
      console.log(`✅ Pasta criada/verificada: ${pasta}`);
    }

    console.log("🎯 Estrutura do quiz inicializada com sucesso!");
    
    // Verificar estatísticas
    const estatisticas = {
      primario: 0,
      secundario: 0,
      superior: 0,
      total: 0
    };

    for (const nivel of pastas) {
      const nivelNome = nivel.split('/').pop();
      const arquivos = await fs.readdir(nivel);
      const materiasArquivos = arquivos.filter(arq => arq.endsWith('.json'));
      
      for (const materiaArq of materiasArquivos) {
        const materiaPath = path.join(nivel, materiaArq);
        const materiaData = await readJson(materiaPath);
        const totalPerguntas = materiaData.perguntas ? materiaData.perguntas.length : 0;
        
        estatisticas[nivelNome] += totalPerguntas;
        estatisticas.total += totalPerguntas;
      }
    }

    console.log("📊 Estatísticas do Quiz:");
    console.log(`   Primário: ${estatisticas.primario} perguntas`);
    console.log(`   Secundário: ${estatisticas.secundario} perguntas`);
    console.log(`   Superior: ${estatisticas.superior} perguntas`);
    console.log(`   TOTAL: ${estatisticas.total} perguntas`);

  } catch (error) {
    console.error("❌ Erro ao inicializar estrutura:", error);
  }
};

app.listen(PORT, async () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`🎯 Quiz API Pronta! | 🎓 Níveis: Primário, Secundário, Superior`);
  console.log(`📚 Endpoints disponíveis:`);
  console.log(`   GET /api/quiz/niveis - Listar níveis`);
  console.log(`   GET /api/quiz/materias?nivel=primario - Listar matérias por nível`);
  console.log(`   GET /api/quiz/perguntas?materia=matematica&nivel=primario - Buscar perguntas`);
  console.log(`   GET /api/quiz/aleatorio?nivel=primario - Perguntas aleatórias`);
  console.log(`   POST /api/quiz/verificar-resposta - Verificar resposta`);
  console.log(`   GET /api/quiz/estatisticas - Estatísticas do quiz`);
  
  // Inicializar estrutura de pastas
  await inicializarEstruturaQuiz();
});
