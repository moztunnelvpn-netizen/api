import fs from 'fs-extra';

async function separarMaterias() {
  try {
    console.log('📚 Iniciando separação de matérias...');
    
    // Ler o arquivo quiz.json atual
    const quizData = await fs.readJson('./data/quiz.json');
    console.log(`📖 Encontradas ${quizData.perguntas.length} perguntas no total`);
    
    // Agrupar perguntas por matéria
    const perguntasPorMateria = {};
    
    quizData.perguntas.forEach(pergunta => {
      const materia = pergunta.materia.toLowerCase();
      
      if (!perguntasPorMateria[materia]) {
        perguntasPorMateria[materia] = [];
      }
      
      perguntasPorMateria[materia].push(pergunta);
    });
    
    // Criar arquivos separados
    for (const [materia, perguntas] of Object.entries(perguntasPorMateria)) {
      const arquivoMateria = {
        perguntas: perguntas
      };
      
      await fs.writeJson(`./data/quiz/${materia}.json`, arquivoMateria, { spaces: 2 });
      console.log(`✅ ${materia}.json: ${perguntas.length} perguntas`);
    }
    
    console.log('🎯 Separação concluída! Matérias encontradas:');
    console.log(Object.keys(perguntasPorMateria));
    
  } catch (error) {
    console.error('❌ Erro ao separar matérias:', error);
  }
}

separarMaterias();
