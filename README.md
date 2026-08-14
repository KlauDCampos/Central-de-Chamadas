# Helpdesk API — Central de Chamados com Triagem Inteligente

Desafio técnico (vaga Analista de Desenvolvimento — Fadex). API REST para uma
central de chamados internos (helpdesk) com **triagem automática por IA** e
**indicadores em tempo real**.

## Sumário

- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Arquitetura e organização do código](#arquitetura-e-organização-do-código)
- [Modelo de dados](#modelo-de-dados)
- [Triagem por IA — como funciona e por quê](#triagem-por-ia--como-funciona-e-por-quê)
- [Indicadores em tempo real](#indicadores-em-tempo-real)
- [Como rodar localmente](#como-rodar-localmente)
- [Como rodar com Docker](#como-rodar-com-docker)
- [Usuários de teste](#usuários-de-teste)
- [Como testar a API](#como-testar-a-api)
- [Regras de negócio implementadas](#regras-de-negócio-implementadas)
- [Testes automatizados](#testes-automatizados)
- [Segurança](#segurança)
- [Diferenciais implementados](#diferenciais-implementados)
- [Decisões de projeto / limitações conhecidas](#decisões-de-projeto--limitações-conhecidas)

## Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript |
| Runtime / Framework | Node.js + Express |
| Banco de dados | SQLite (padrão, zero configuração) via Prisma ORM — compatível com PostgreSQL/MySQL trocando 1 linha |
| Autenticação | JWT (jsonwebtoken) + bcryptjs (hash de senha) |
| Validação | Zod |
| Tempo real | Server-Sent Events (SSE) |
| Documentação da API | Swagger/OpenAPI (`/docs`) |
| Testes | Jest + Supertest |
| Containerização | Docker / docker-compose |

## Arquitetura e organização do código

O código é organizado por **módulos de domínio**, cada um seguindo o padrão em
camadas pedido no edital (`controller → service → repository`):

```
src/
  app.ts                  # criação/configuração do Express (rotas, middlewares, swagger)
  server.ts                # ponto de entrada (start do servidor)
  config/
    env.ts                 # variáveis de ambiente centralizadas
    database.ts             # instância única do Prisma Client
  middlewares/
    auth.middleware.ts      # autenticação (JWT) e autorização (papel/role)
    validate.middleware.ts  # validação de payloads com Zod
    error.middleware.ts     # tratamento central de erros -> respostas HTTP padronizadas
  modules/
    auth/                   # cadastro/login
    users/                  # repository de usuários
    chamados/                # CRUD de chamados (controller/service/repository/schemas)
    comentarios/             # (rotas de comentário vivem dentro de chamados, ver abaixo)
    triagem/                 # classificador automático (IA/heurística) — camada isolada
    dashboard/                # indicadores + SSE (tempo real)
  docs/
    openapi.yaml            # especificação Swagger
  utils/
    AppError.ts             # erro padronizado da aplicação
    jwt.ts / hash.ts
prisma/
  schema.prisma             # modelo de dados
  seed.ts                   # cria usuários de teste (ADMIN e SOLICITANTE)
public/
  index.html                # painel simples que consome o SSE (diferencial)
tests/
  auth.test.ts
  chamado.test.ts
postman/
  helpdesk.postman_collection.json
```

Comentários/histórico não têm um módulo próprio de rotas porque, por design,
todo comentário pertence a um chamado (`/api/chamados/:id/comentarios`) — mas a
lógica está isolada em métodos próprios no repository/service de chamados,
mantendo a separação de responsabilidades.

## Modelo de dados

- **Usuario**: `nome`, `email` (único), `senhaHash`, `papel` (`ADMIN` | `SOLICITANTE`)
- **Chamado**: `titulo`, `descricao`, `categoria`, `prioridade` (`BAIXA`/`MEDIA`/`ALTA`),
  `status` (`ABERTO`/`EM_ANDAMENTO`/`RESOLVIDO`/`FECHADO`), `solicitanteId`,
  `responsavelId` (opcional), `origemClassificacao` (`IA`/`MANUAL`), `createdAt`, `updatedAt`
- **Comentario**: `texto`, `chamadoId`, `autorId`, `createdAt` — usado tanto para
  interações humanas quanto para registrar automaticamente mudanças de status
  e classificação (histórico completo do chamado)

Ver `prisma/schema.prisma` para o detalhamento de relacionamentos e constraints
(chaves estrangeiras, `email` único, cascade delete de comentários ao excluir chamado).

> **Nota sobre os campos "enum" (`papel`, `prioridade`, `status`,
> `origemClassificacao`):** o SQLite não tem suporte nativo a `enum` no Prisma
> (só PostgreSQL/MySQL/CockroachDB têm). Por isso, esses campos são salvos
> como `String` no banco, e os valores válidos são garantidos na camada de
> aplicação por dois mecanismos: os enums TypeScript em `src/enums/` (dão
> autocomplete e checagem de tipo no código) e os schemas Zod em cada módulo
> (validam o valor recebido na requisição antes de chegar ao banco). Se o
> projeto for rodar com PostgreSQL/MySQL, é possível voltar a usar `enum`
> nativo do Prisma no `schema.prisma`, mas não é obrigatório.

## Triagem por IA — como funciona e por quê

Por padrão (`TRIAGEM_PROVIDER=heuristic` no `.env`), a classificação automática
de **categoria** e **prioridade** é feita por um classificador determinístico
baseado em dicionários de palavras-chave (`src/modules/triagem/triagem.service.ts`).

**Por que essa abordagem:**
- APIs de IA gratuitas geralmente exigem cadastro com cartão de crédito (o
  próprio edital reconhece isso na seção 3.3) — a heurística evita essa
  barreira e mantém o projeto **100% reproduzível offline**, sem chaves.
- O critério de avaliação do desafio é explícito: *"a solução funcionar e
  estar bem explicada, não a sofisticação do modelo"*.
- A lógica é **isolada em sua própria camada**: o restante da aplicação chama
  apenas `triagemService.classificar(titulo, descricao)` e recebe de volta
  `{ categoria, prioridade, origem }`. Trocar a estratégia não exige mudar
  nenhuma outra camada.

**Como funciona:**
1. Normaliza o texto (minúsculas, remove acentos).
2. Testa o texto contra listas de palavras-chave por categoria (Hardware,
   Software, Rede, Acesso/Senha, E-mail, Outros).
3. Testa por palavras que indicam urgência (`urgente`, `parou tudo`, `fora do
   ar`, `produção` etc.) para decidir prioridade ALTA/MÉDIA/BAIXA.
4. Se o solicitante já enviou `categoria`/`prioridade` manualmente ao criar o
   chamado, a IA **não é acionada** e a origem é registrada como `MANUAL`.
5. O **ADMIN pode corrigir a sugestão** a qualquer momento via
   `PATCH /api/chamados/:id/classificacao` (a origem passa a `MANUAL`).

**Ponto de extensão para uma IA real:** o arquivo já contém dois esqueletos de
integração prontos, plugáveis só trocando a variável `TRIAGEM_PROVIDER` no
`.env` — nenhuma outra camada da aplicação precisa mudar:

- `TRIAGEM_PROVIDER=huggingface` + `HUGGINGFACE_API_KEY` — usa a **Hugging
  Face Inference API** (free tier) com um modelo de *zero-shot classification*
  para sugerir a categoria.
- `TRIAGEM_PROVIDER=openai` + `OPENAI_API_KEY` (e opcionalmente
  `OPENAI_MODEL`, padrão `gpt-4o-mini`) — usa a **OpenAI Chat Completions
  API** com *JSON mode* (`response_format: json_object`) para retornar
  `categoria`/`prioridade` já estruturados. A resposta do modelo é validada
  contra as listas de categorias/prioridades permitidas antes de ser usada —
  nunca se confia cegamente na saída de um LLM.

Em ambos os casos, se a chave não estiver configurada, ou a chamada externa
falhar (rate limit, indisponibilidade, resposta fora do formato esperado), o
sistema **degrada automaticamente para a heurística** — a criação do chamado
nunca quebra por causa de uma falha na IA.

> A OpenAI, diferente da Hugging Face free tier, cobra por uso e exige cartão
> cadastrado na conta — por isso não é o provider padrão do projeto (mesma
> barreira que a seção 3.3 do edital reconhece existir em várias APIs de IA
> gratuitas).

## Indicadores em tempo real

- `GET /api/dashboard/indicadores` — snapshot atual (contagem por status e
  por prioridade, mais um contador de chamados ALTA ainda abertos).
- `GET /api/dashboard/stream` — conexão **Server-Sent Events (SSE)**: ao
  conectar, recebe um evento `snapshot` imediato e depois passa a receber o
  evento `indicadores` sempre que um chamado é criado/atualizado, além do
  evento `alerta-prioridade-alta` sempre que um chamado ALTA é aberto.
- `GET /painel` — painel HTML simples (vanilla JS) que consome o SSE acima e
  atualiza os cartões automaticamente, sem recarregar a página (diferencial
  do item 3.2).

SSE foi escolhido em vez de WebSocket por ser mais simples (HTTP puro, sem
handshake especial), unidirecional (server → client, que é exatamente o caso
de uso de um painel de indicadores) e nativamente suportado por
`EventSource` no navegador.

## Como rodar localmente

Pré-requisitos: **Node.js 20+** e **npm**.

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPOSITORIO>
cd helpdesk-api

# 2. Instalar dependências (isso também gera o Prisma Client via postinstall)
npm install

# 3. Copiar as variáveis de ambiente
cp .env.example .env

# 4. Criar o banco de dados (SQLite) e aplicar o schema
npx prisma migrate dev --name init

# 5. Popular o banco com os usuários de teste (ADMIN e SOLICITANTE)
npm run prisma:seed

# 6. Subir a API em modo desenvolvimento
npm run dev
```

A API sobe em `http://localhost:3000`. Endpoints úteis:
- `GET /health` — healthcheck
- `GET /docs` — documentação Swagger interativa
- `GET /painel` — painel de indicadores em tempo real (abra depois de fazer login)

Para rodar em produção:
```bash
npm run build
npm start
```

## Como rodar com Docker

```bash
docker compose up --build
```

Isso builda a imagem, roda as migrations (`prisma migrate deploy`), popula o
seed e sobe a API em `http://localhost:3000` — tudo com um único comando,
sem precisar instalar Node localmente.

## Usuários de teste

Criados automaticamente pelo `npm run prisma:seed` (ou pelo Docker):

| Papel | E-mail | Senha |
|---|---|---|
| ADMIN | `admin@fadex.org.br` | `admin123` |
| SOLICITANTE | `solicitante@fadex.org.br` | `solicitante123` |

> Por segurança, o endpoint público `POST /api/auth/register` **sempre** cria
> usuários com papel `SOLICITANTE`, mesmo que `papel` seja enviado no corpo da
> requisição. Usuários `ADMIN` só são criados via seed/migration — evitando
> que qualquer pessoa se autopromova a administrador pela API.

## Como testar a API

### Opção 1 — Postman/Insomnia
Importe `postman/helpdesk.postman_collection.json`. A coleção já vem com
requisições para todos os endpoints, usando variáveis (`{{baseUrl}}`,
`{{tokenAdmin}}`, `{{tokenSolicitante}}`, `{{chamadoId}}`) — basta rodar
"Login ADMIN"/"Login SOLICITANTE" primeiro e colar os tokens retornados nas
variáveis da coleção.

### Opção 2 — Swagger
Acesse `http://localhost:3000/docs` com a API rodando. Para testar rotas
protegidas (a maioria delas), autentique-se primeiro:
1. Expanda `POST /api/auth/login`, clique em **"Try it out"**, preencha com
   um usuário de teste (ex.: `solicitante@fadex.org.br` / `solicitante123`)
   e clique em **"Execute"**.
2. Copie o valor do campo `"token"` da resposta.
3. Clique no botão **"Authorize"** (ícone de cadeado, no topo da página),
   cole o token e confirme.
4. A partir daí, todas as requisições feitas pelo Swagger já incluem o token
   automaticamente no header `Authorization`.

### Opção 3 — curl

```bash
# Login como solicitante (usuário de teste do seed)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"solicitante@fadex.org.br","senha":"solicitante123"}'
# -> copie o "token" da resposta

TOKEN="cole_o_token_aqui"

# Criar chamado (a IA classifica automaticamente)
curl -X POST http://localhost:3000/api/chamados \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "titulo": "Sistema fora do ar, urgente",
    "descricao": "O sistema caiu para todos os usuários e ninguém consegue trabalhar."
  }'

# Listar chamados com filtro
curl "http://localhost:3000/api/chamados?status=ABERTO&prioridade=ALTA" \
  -H "Authorization: Bearer $TOKEN"

# Ver indicadores em tempo real (stream SSE)
curl -N "http://localhost:3000/api/dashboard/stream?token=$TOKEN"
```

## Regras de negócio implementadas

- E-mail único por usuário (constraint no banco + erro 409 amigável).
- Campos obrigatórios validados via Zod em todas as rotas de escrita (erro 400
  com detalhes por campo).
- **Não é possível reabrir um chamado `FECHADO`** — é tratado como estado
  terminal; qualquer tentativa retorna `400` com mensagem explicativa
  (`chamado.service.ts`, `TRANSICOES_PERMITIDAS`).
- `SOLICITANTE` só visualiza/gerencia os próprios chamados; tentar acessar
  chamado de outra pessoa retorna `403`.
- Apenas `ADMIN` pode listar todos os chamados, reatribuir responsável e
  corrigir a classificação sugerida pela IA.
- Toda mudança de status, atribuição de responsável e correção de
  classificação gera automaticamente uma entrada no histórico (comentário do
  sistema), então o histórico do chamado sempre reflete tudo que aconteceu.

## Testes automatizados

```bash
npm test
```

Cobrem: cadastro/login, rejeição de e-mail duplicado e credenciais inválidas,
a regra de que o registro público nunca cria ADMIN, criação de chamado com
triagem automática (incluindo o caso de prioridade ALTA por palavras de
urgência), isolamento de chamados por solicitante, autorização (`403` para
ações restritas a ADMIN), a regra de não reabrir chamado fechado, e resposta
`404` para chamado inexistente.

> Os testes usam um arquivo SQLite separado (`test.db`, ver `tests/setup.ts`)
> para não interferir no banco de desenvolvimento.

## Segurança

- Senhas nunca são armazenadas em texto puro (hash com bcrypt, 10 salt rounds).
- Nenhuma chave/segredo está commitada — tudo vem de variáveis de ambiente,
  com `.env.example` documentando o que é esperado (sem valores reais).
- `.env`, `node_modules`, `dist` e os arquivos de banco SQLite estão no
  `.gitignore`.
- Tokens JWT expiram (`JWT_EXPIRES_IN`, padrão 1 dia).
- Autorização por papel aplicada tanto nas rotas (`requireRole`) quanto nas
  regras de negócio dentro do service (defesa em profundidade).

## Diferenciais implementados

- [x] Interface web simples (`/painel`) consumindo a API e exibindo o painel em tempo real
- [x] Containerização com Docker/docker-compose (`docker compose up --build`)
- [x] Testes automatizados (Jest + Supertest)
- [x] Documentação da API com Swagger/OpenAPI (`/docs`)
- [x] Integração opcional com IA real (Hugging Face e OpenAI), além da heurística padrão
- [ ] Detecção de chamados duplicados/similares — não implementado (ver limitações)
- [ ] Deploy funcional — não incluído por padrão; ver observação abaixo

> O painel em `/painel` foi feito em HTML/JS puro (sem build step) em vez de
> React/Angular/Next para manter o projeto leve e fácil de rodar com um único
> comando — ele cobre o mesmo objetivo funcional (consumir a API e exibir o
> painel em tempo real), mas vale registrar que não é a stack sugerida como
> exemplo no edital.

## Decisões de projeto / limitações conhecidas

- **SQLite por padrão**: escolhido para que o projeto rode com um único
  comando, sem precisar instalar Postgres/MySQL. O `schema.prisma` e o
  `DATABASE_URL` podem ser trocados para Postgres/MySQL sem mudar nenhuma
  linha de código de aplicação (Prisma abstrai isso).
- **Exclusão de chamado**: `DELETE /api/chamados/:id` remove o registro.
  `SOLICITANTE` só pode excluir chamados ainda com status `ABERTO`
  (não pode "apagar" um chamado que já está sendo tratado); `ADMIN` pode
  excluir em qualquer status.
- **Detecção de duplicados/similares** (diferencial do item 3.2) não foi
  implementada por prioridade de tempo — o desenho já é compatível com essa
  extensão: bastaria, no `chamadoService.criar`, comparar o novo texto contra
  chamados abertos recentes (ex.: similaridade de Jaccard entre conjuntos de
  palavras, ou embeddings via a mesma API de IA usada na triagem).
- **Deploy**: não incluído por padrão pois depende de credenciais de uma conta
  específica (Render/Railway/Vercel). O `Dockerfile` está pronto para deploy
  em qualquer plataforma que suporte containers.
