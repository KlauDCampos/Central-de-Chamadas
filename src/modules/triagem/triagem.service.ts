import { Prioridade } from '@prisma/client';
import { env } from '../../config/env';

export interface SugestaoTriagem {
  categoria: string;
  prioridade: Prioridade;
  origem: 'IA';
  justificativa: string;
}

// ---------------------------------------------------------------------------
// Estratégia adotada (ver README, seção "Triagem por IA"):
//
// Por padrão (TRIAGEM_PROVIDER=heuristic) usamos um classificador determinístico
// baseado em dicionários de palavras-chave. Isso evita depender de uma API externa
// que exige cadastro/cartão, mantém o projeto 100% reproduzível offline, e o
// critério do desafio é explicitamente "a solução funcionar e estar bem explicada,
// não a sofisticação do modelo".
//
// A função `classificarComHeuristica` é o "modelo". Ela é isolada em sua própria
// camada (triagem.service) para que trocar por uma chamada real de IA seja trivial:
// basta implementar `classificarComHuggingFace` (esqueleto abaixo, plugável via
// TRIAGEM_PROVIDER=huggingface e HUGGINGFACE_API_KEY no .env) sem tocar em nenhuma
// outra camada da aplicação (controllers/services de chamados não sabem qual
// estratégia está sendo usada).
// ---------------------------------------------------------------------------

interface RegraCategoria {
  categoria: string;
  palavrasChave: string[];
}

const REGRAS_CATEGORIA: RegraCategoria[] = [
  {
    categoria: 'Acesso/Senha',
    palavrasChave: ['senha', 'login', 'acesso', 'bloqueado', 'bloqueio', 'usuário', 'usuario', 'entrar no sistema', 'não consigo acessar', 'nao consigo acessar'],
  },
  {
    categoria: 'Hardware',
    palavrasChave: ['computador', 'notebook', 'impressora', 'monitor', 'teclado', 'mouse', 'não liga', 'nao liga', 'travando', 'fumaça', 'fumaca'],
  },
  {
    categoria: 'Rede',
    palavrasChave: ['internet', 'wifi', 'wi-fi', 'rede', 'conexão', 'conexao', 'vpn', 'sem sinal', 'caiu a rede'],
  },
  {
    categoria: 'Software',
    palavrasChave: ['sistema', 'erro', 'bug', 'aplicativo', 'programa', 'atualização', 'atualizacao', 'tela azul', 'não abre', 'nao abre', 'travou'],
  },
  {
    categoria: 'E-mail',
    palavrasChave: ['e-mail', 'email', 'outlook', 'caixa de entrada', 'não recebo', 'nao recebo'],
  },
];

const PALAVRAS_ALTA = [
  'urgente', 'urgência', 'urgencia', 'crítico', 'critico', 'parado', 'parou tudo',
  'não consigo trabalhar', 'nao consigo trabalhar', 'produção', 'producao',
  'todos os usuários', 'todos os usuarios', 'sistema fora do ar', 'fora do ar',
  'imediato', 'grave', 'perda de dados',
];

const PALAVRAS_MEDIA = [
  'erro', 'lentidão', 'lentidao', 'lento', 'falha', 'intermitente',
  'às vezes', 'as vezes', 'não funciona direito', 'nao funciona direito',
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos para comparação mais robusta
}

function contemAlgumaPalavra(textoNormalizado: string, palavras: string[]): boolean {
  return palavras.some((p) => textoNormalizado.includes(normalizar(p)));
}

function classificarComHeuristica(titulo: string, descricao: string): SugestaoTriagem {
  const textoCompleto = normalizar(`${titulo} ${descricao}`);

  // 1) Categoria: primeira regra cujo conjunto de palavras-chave dá "match"
  let categoriaEscolhida = 'Outros';
  for (const regra of REGRAS_CATEGORIA) {
    if (contemAlgumaPalavra(textoCompleto, regra.palavrasChave)) {
      categoriaEscolhida = regra.categoria;
      break;
    }
  }

  // 2) Prioridade: ALTA > MÉDIA > BAIXA, por presença de palavras de urgência
  let prioridadeEscolhida: Prioridade = Prioridade.BAIXA;
  if (contemAlgumaPalavra(textoCompleto, PALAVRAS_ALTA)) {
    prioridadeEscolhida = Prioridade.ALTA;
  } else if (contemAlgumaPalavra(textoCompleto, PALAVRAS_MEDIA)) {
    prioridadeEscolhida = Prioridade.MEDIA;
  }

  return {
    categoria: categoriaEscolhida,
    prioridade: prioridadeEscolhida,
    origem: 'IA',
    justificativa: `Classificação heurística baseada em palavras-chave encontradas no título/descrição (categoria: "${categoriaEscolhida}", prioridade: "${prioridadeEscolhida}").`,
  };
}

// Esqueleto de integração real com Hugging Face Inference API (free tier).
// Não é chamado por padrão. Para ativar: defina TRIAGEM_PROVIDER=huggingface
// e HUGGINGFACE_API_KEY no .env. Mantido simples e isolado, como pede o edital
// ("onde a chamada real entraria").
async function classificarComHuggingFace(titulo: string, descricao: string): Promise<SugestaoTriagem> {
  if (!env.huggingFaceApiKey) {
    // Sem chave configurada: cai automaticamente para a heurística, sem quebrar a API.
    return classificarComHeuristica(titulo, descricao);
  }

  try {
    const resposta = await fetch(
      'https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.huggingFaceApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: `${titulo}. ${descricao}`,
          parameters: {
            candidate_labels: ['Hardware', 'Software', 'Rede', 'Acesso/Senha', 'E-mail', 'Outros'],
          },
        }),
      },
    );

    if (!resposta.ok) {
      // Se a API externa falhar (rate limit, indisponibilidade etc.), degrada
      // graciosamente para a heurística em vez de quebrar a criação do chamado.
      return classificarComHeuristica(titulo, descricao);
    }

    const dados = (await resposta.json()) as { labels: string[] };
    const categoria = dados.labels?.[0] ?? 'Outros';

    // A prioridade continua sendo decidida pela heurística de urgência,
    // já que o modelo de classificação zero-shot acima só resolve categoria.
    const { prioridade } = classificarComHeuristica(titulo, descricao);

    return {
      categoria,
      prioridade,
      origem: 'IA',
      justificativa: 'Categoria sugerida pela Hugging Face Inference API (zero-shot classification); prioridade calculada por heurística de urgência.',
    };
  } catch {
    return classificarComHeuristica(titulo, descricao);
  }
}

export const triagemService = {
  async classificar(titulo: string, descricao: string): Promise<SugestaoTriagem> {
    if (env.triagemProvider === 'huggingface') {
      return classificarComHuggingFace(titulo, descricao);
    }
    return classificarComHeuristica(titulo, descricao);
  },
};
