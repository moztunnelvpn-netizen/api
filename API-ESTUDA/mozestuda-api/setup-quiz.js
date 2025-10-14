import fs from 'fs-extra';

// Criar estrutura de diretórios
await fs.ensureDir('./data/quiz');

// Arquivos iniciais vazios
const arquivosIniciais = {
  'matematica.json': { perguntas: [] },
  'portugues.json': { perguntas: [] },
  'ingles.json': { perguntas: [] },
  'historia.json': { perguntas: [] },
  'geografia.json': { perguntas: [] },
  'fisica.json': { perguntas: [] },
  'quimica.json': { perguntas: [] },
  'biologia.json': { perguntas: [] }
};

for (const [arquivo, dados] of Object.entries(arquivosIniciais)) {
  await fs.writeJson(`./data/quiz/${arquivo}`, dados, { spaces: 2 });
  console.log(`✅ Criado: ${arquivo}`);
}

console.log('🎯 Estrutura de quiz criada com sucesso!');
