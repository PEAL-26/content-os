# ContentOS — Prompts de Desenvolvimento por Feature

Stack: **React + Vite + Supabase + Prisma + Tailwind CSS + Zustand**

Cada prompt inclui uma fase de análise obrigatória antes de qualquer implementação.
Segue a ordem das fases para evitar dependências em falta.

---

## FASE 1 — Setup & Autenticação

### [x] PROMPT 1.1 — Estrutura base do projecto + configuração Supabase

```markdown
Antes de implementar qualquer coisa, analisa toda a estrutura actual do projecto:
verifica se já existe configuração do Vite, quais as dependências instaladas no
`package.json`, se existe algum ficheiro de ambiente (`.env`, `.env.example`),
se o cliente Supabase já está inicializado algures em `src/lib/`, e se existe
alguma configuração de router (React Router ou similar). Verifica também se o
Tailwind está configurado no `tailwind.config.js` e `postcss.config.js`, e se
o Prisma Client já foi gerado. Só depois de teres esse contexto completo,
implementa o seguinte:

Configura a base do projecto ContentOS com React + Vite + Supabase + Prisma +
Tailwind + Zustand. Cria os seguintes ficheiros de setup:

- `src/lib/supabase.ts` — cliente Supabase com tipos gerados pelo Prisma
- `src/lib/prisma.ts` — instância singleton do Prisma Client
- `src/lib/constants.ts` — constantes globais (nomes dos enums, labels, cores
  dos pilares P1/P2/P3/P4, ícones por canal social)
- `.env.example` — com as variáveis `DATABASE_URL`, `DIRECT_URL`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ANTHROPIC_API_KEY`
- `src/types/index.ts` — tipos TypeScript derivados do schema Prisma para uso
  nos componentes (WorkspaceWithRelations, ArticleWithRelations, etc.)

O cliente Supabase deve usar as variáveis `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`. Todos os ficheiros devem ter tipagem TypeScript
estrita e sem `any`. Não implementar UI nesta fase.
```

---

### [x] PROMPT 1.2 — Sistema de autenticação completo

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto
relacionado com autenticação: verifica se existe alguma página de login ou
registo em `src/pages/`, se já há rotas protegidas configuradas no router,
se existe algum contexto ou store de autenticação em `src/stores/` ou
`src/context/`, e como o cliente Supabase está actualmente configurado em
`src/lib/supabase.ts`. Verifica também se existe algum middleware de rota ou
guard de navegação. Só depois de teres esse contexto completo, implementa
o seguinte:

Implementa o sistema de autenticação completo usando Supabase Auth. Cria:

- `src/pages/auth/login.tsx` — formulário de login com email + password,
  link para registo, tratamento de erros com mensagens em português
- `src/pages/auth/register.tsx` — formulário de registo com nome, email e
  password, validação de campos, e criação automática de workspace inicial
  para o primeiro utilizador
- `src/context/auth-context.ts` (ReactContext) — estado global de autenticação com
  `user`, `session`, `isLoading`, `signIn()`, `signOut()`, `signUp()`
- `src/components/auth/protected-route.tsx` — wrapper que redireciona para
  `/login` se não houver sessão activa
- `src/hooks/use-auth.ts` — hook que expõe o estado e acções do auth-context
- Configuração do router em `src/App.tsx` com rotas públicas (`/login`,
  `/register`) e rotas protegidas (tudo o resto dentro de `ProtectedRoute`)

O listener `onAuthStateChange` do Supabase deve ser iniciado uma única vez no
ponto de entrada da aplicação e sincronizar com o Zustand store. Após login
com sucesso, redirecionar para `/dashboard`. Sem bibliotecas de formulário
externas — usar estado React controlado simples.
```

---

## FASE 2 — Workspace & Configurações

### [x] PROMPT 2.1 — Criação e gestão de Workspace

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se o authStore está implementado e exporta o `user` e `session`
correctamente, se o Prisma Client está a funcionar em `src/lib/prisma.ts`,
se existem hooks de dados em `src/hooks/`, e se há alguma página de dashboard
ou layout principal já criado. Verifica o schema Prisma para confirmar os
campos exactos do modelo `Workspace` e `WorkspaceMember`. Só depois de teres
esse contexto completo, implementa o seguinte:

Implementa o sistema de workspace — a raiz multi-tenant da aplicação. Cria:

- `src/hooks/useWorkspace.ts` — hook com `createWorkspace()`, `getWorkspace()`,
  `updateWorkspace()`, e estado reactivo `currentWorkspace`. Ao fazer login,
  verificar automaticamente se o utilizador já tem workspace; se não, redirecionar
  para onboarding
- `src/pages/onboarding/CreateWorkspace.tsx` — formulário de criação de
  workspace com campos: nome da empresa, sector, website, tom de voz
  (`voiceTone`), público-alvo (`targetAudience`), proposta de valor
  (`valueProposition`), idioma do conteúdo, e rácio valor/produto
  (slider 70/30 por defeito). Após criação, o utilizador é automaticamente
  adicionado como `OWNER` na tabela `workspace_members`
- `src/stores/workspaceStore.ts` (Zustand) — estado global com
  `currentWorkspace`, `setWorkspace()`, `clearWorkspace()`
- `src/components/workspace/WorkspaceSelector.tsx` — dropdown no header para
  trocar de workspace (caso o utilizador pertença a mais de um)

O `workspace_id` deve estar sempre disponível via `useWorkspaceStore()` em
qualquer parte da app. Todas as queries à BD devem incluir o `workspaceId`
como filtro obrigatório. Sem mock data — tudo ligado ao Supabase real.
```

---

### [x] PROMPT 2.2 — Configuração de Pilares de Conteúdo

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se o `workspaceStore` está implementado e exporta o `currentWorkspace`
com o `id`, se existe alguma página de settings ou layout de configurações em
`src/pages/Settings/`, se há componentes de formulário reutilizáveis em
`src/components/ui/`, e se existem os 4 pilares já criados pelo seed no
Supabase. Confirma no schema Prisma os campos exactos de `PillarConfig`,
incluindo o enum `ContentPillar` (P1_EDUCATION, P2_USE_CASES, P3_CONVERSION,
P4_AUTHORITY) e `FunnelStage`. Só depois de teres esse contexto completo,
implementa o seguinte:

Implementa a página de configuração dos pilares de conteúdo. Cria:

- `src/pages/Settings/Pillars.tsx` — página com 4 cards editáveis (um por
  pilar). Cada card mostra: nome customizável, objectivo, etapa do funil
  (TOP/MIDDLE/BOTTOM), descrição, e lista de exemplos editável (adicionar/
  remover exemplos individualmente). Badge de cor por pilar: P1=azul,
  P2=verde, P3=laranja, P4=roxo. Toggle para activar/desactivar o pilar
- `src/hooks/usePillars.ts` — hook com `getPillars()`, `updatePillar()`,
  sempre filtrado por `workspaceId`
- `src/components/content/PillarBadge.tsx` — componente reutilizável que
  recebe um `ContentPillar` enum e renderiza badge com cor e label correctos.
  Será usado em toda a aplicação (artigos, peças, planeador)

Os pilares não podem ser apagados (são fixos no enum), apenas editados e
activados/desactivados. As alterações devem ser guardadas individualmente
por pilar com feedback visual de sucesso/erro. Sem page refresh após guardar.
```

---

### [x] PROMPT 2.3 — Gestão de Produtos

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se existe alguma página de produtos em `src/pages/Settings/`,
se o `PillarBadge` já está implementado, se há componentes de modal ou drawer
reutilizáveis em `src/components/ui/`, e se o `workspaceStore` está disponível
com o `workspaceId` correcto. Confirma no schema Prisma os campos do modelo
`Product` (name, slug, description, tagline, landingUrl, demoUrl,
targetAudience, problemSolved, isActive). Só depois de teres esse contexto
completo, implementa o seguinte:

Implementa a gestão de produtos da empresa. Cria:

- `src/pages/Settings/Products.tsx` — lista de produtos com cards. Cada card
  mostra: nome, tagline, canal landing (URL), público-alvo, badge activo/
  inactivo, e acções de editar e arquivar. Botão "Novo Produto" abre modal
- `src/components/products/ProductForm.tsx` — formulário de criação/edição
  com todos os campos do modelo. O `slug` deve ser gerado automaticamente
  a partir do `name` (lowercase, hífens, sem caracteres especiais) mas
  editável manualmente. O campo `problemSolved` tem placeholder com exemplo:
  "Perda de pedidos e falta de visibilidade sobre encomendas"
- `src/hooks/useProducts.ts` — hook com `getProducts()`, `createProduct()`,
  `updateProduct()`, `toggleActive()`, sempre filtrado por `workspaceId`
- `src/components/products/ProductSelector.tsx` — dropdown reutilizável para
  seleccionar produto. Será usado no editor de artigos e no gerador de conteúdo

Ao arquivar um produto (`isActive = false`), mostrar aviso de que os artigos
e conteúdos existentes não são afectados. Sem eliminação real de produtos —
apenas arquivar.
```

---

### [x] PROMPT 2.4 — Configuração de Canais Sociais

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se existe página de settings com tabs ou navegação lateral, se o
`ProductSelector` já está implementado como referência de componente reutilizável,
se existem ícones para redes sociais (Lucide ou outro), e os canais criados
pelo seed no Supabase (LinkedIn, Instagram, TikTok, YouTube). Confirma no
schema os campos de `ChannelConfig` (channel, isActive, handle, isPrimary,
defaultTone, notes). Só depois de teres esse contexto completo, implementa
o seguinte:

Implementa a configuração dos canais de distribuição. Cria:

- `src/pages/settings/channels.tsx` — página com um card por canal social.
  Cada card tem: ícone do canal, toggle activo/inactivo, campo para handle/URL
  do perfil, toggle "canal principal" (só um pode ser principal — LinkedIn por
  defeito), campo de tom padrão para esse canal, e notas internas. Canal
  inactivo fica com card em estado desabilitado (opacity reduzida)
- `src/hooks/use-channels.ts` — hook com `getChannels()`, `updateChannel()`,
  `getActiveChannels()`. O método `getActiveChannels()` será usado no
  planeador e gerador de conteúdo
- `src/components/channels/channel-badge.tsx` — componente reutilizável com
  ícone + nome do canal. Cores por canal: LinkedIn=azul, Instagram=rosa,
  TikTok=preto, YouTube=vermelho. Aceita prop `size` (sm/md/lg)

Garantir que apenas um canal pode ter `isPrimary = true` por workspace — ao
activar um como principal, desactivar automaticamente o anterior. O YouTube
começa inactivo por defeito (conforme estratégia do documento (README.md)).
```

---

## FASE 3 — Artigos (Core da aplicação)

### [x] PROMPT 3.1 — Lista de artigos e estrutura da página

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se existe alguma página de artigos em `src/pages/articles/`, se
o `pillar-badge` e `product-selector` já estão implementados, se existe
componente de layout principal com sidebar/header já configurado, e como
está configurado o router em `src/app.tsx`. Confirma no schema os campos
do modelo `article` (status enum: DRAFT/REVIEW/APPROVED/PUBLISHED, campos
SEO, relações com Product e PillarConfig). Só depois de teres esse contexto
completo, implementa o seguinte:

Implementa a página de lista de artigos. Cria:

- `src/pages/articles/article-list.tsx` — lista paginada de artigos com:
  filtros por status (todos / rascunho / revisão / aprovado / publicado),
  filtro por pilar (P1/P2/P3/P4), filtro por produto, barra de pesquisa
  por título. Cada item da lista mostra: título, pilar (badge), produto
  associado (se houver), status (badge com cor), data de criação, número
  de peças de conteúdo geradas, e acções rápidas (editar, duplicar, apagar)
- `src/hooks/use-articles.ts` — hook com `getArticles(filters)`,
  `createArticle()`, `updateArticle()`, `deleteArticle()`,
  `duplicateArticle()`. Todas as queries filtradas por `workspaceId`
- `src/components/articles/article-status-badge.tsx` — badge com cor por
  status: DRAFT=cinza, REVIEW=amarelo, APPROVED=verde, PUBLISHED=azul
- Estado vazio com CTA claro: "Ainda não tens artigos. Cria o primeiro ou
  gera um com IA"

Sem paginação infinita — usar paginação simples com "Carregar mais" (limit 20
por defecto). A lista deve actualizar em tempo real após criar ou editar um
artigo sem recarregar a página. Qualquer função ligada ao supabase, deve estar na pasta services, confome o padrão já usado
```

---

### [x] PROMPT 3.2 — Editor de artigos

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se existe algum editor de texto instalado (TipTap, react-md-editor,
ou similar) nas dependências do `package.json`, se a página `article-list.tsx`
já está implementada e o hook `use-articles.ts` está disponível, se o
`ProductSelector` e `PillarBadge` já estão criados, e se existe alguma
lógica de geração de slug. Confirma todos os campos editáveis do modelo
`Article` incluindo os arrays (`keywords`) e campos opcionais de SEO.
Só depois de teres esse contexto completo, implementa o seguinte:

Implementa o editor completo de artigos. Cria:

- `src/pages/articles/article-editor.tsx` — página de criação e edição com
  dois painéis: painel esquerdo com formulário (título, pilar, produto,
  tags, campos SEO expansíveis) e painel direito com o editor de texto.
  O slug é gerado automaticamente ao escrever o título mas editável
  manualmente. Campo de keywords SEO com input de adicionar/remover tags
  individualmente. Selector de status com transições permitidas: DRAFT →
  REVIEW → APPROVED → PUBLISHED. Campo `readingTimeMin` calculado
  automaticamente com base no número de palavras do body (250 palavras/min)
- Editor de texto: usar `react-md-editor` (simples, sem dependências
  pesadas) com preview em Markdown. Se já existir outro editor no projecto,
  adaptar para ele
- Auto-save: guardar rascunho automaticamente 3 segundos após o utilizador
  parar de escrever (debounce). Indicador visual de "A guardar..." /
  "Guardado" no header do editor
- `src/components/articles/article-form.tsx` — secção de metadados
  (pilar, produto, tags, SEO) separada do editor, usada também no gerador IA

O editor não deve perder conteúdo ao navegar para outra tab e voltar.
Usar `sessionStorage` para persistir rascunho local não guardado.
```

---

### [x] PROMPT 3.3 — Gerador de artigos com IA

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se existe alguma integração com a API da Anthropic em `src/lib/`
ou `src/services/`, se o `article-editor.tsx` já está implementado, se o
`workspaceStore` exporta os dados completos do workspace (voiceTone,
targetAudience, valueProposition), se o hook `usePillars.ts` está disponível,
e se a chave `VITE_ANTHROPIC_API_KEY` está no `.env`. Confirma os campos do
workspace que alimentam o contexto da IA (voiceTone, targetAudience,
valueProposition, contentLanguage). Só depois de teres esse contexto completo,
implementa o seguinte:

Implementa a geração de artigos com IA. Cria:

- `src/lib/ai.ts` — serviço central de IA com a função `generateArticle({
  topic, pillar, product, workspace })`. Esta função constrói o prompt
  combinando: tom de voz do workspace, público-alvo, proposta de valor,
  pilar seleccionado (nome + objectivo + exemplos), produto relacionado
  (problema resolvido + público), e instruções de formato (título SEO,
  slug, summary, body em Markdown estruturado, keywords, readingTimeMin).
  A resposta deve ser JSON estruturado que mapeia directamente para o
  modelo Article. Guardar o prompt usado em `aiPromptUsed` para auditoria
- `src/components/articles/article-generator-modal.tsx` — modal com: campo
  de tema/ideia inicial (obrigatório), selector de pilar, selector de produto
  (opcional), botão "Gerar artigo". Durante a geração mostrar loading com
  mensagem. Após gerar, abrir directamente no article-editor para revisão
  antes de guardar — nunca guardar automaticamente sem o utilizador confirmar
- `src/hooks/use-ai.ts` — hook com `isGenerating`, `error`, e as funções
  de geração. Toda a lógica de chamada à API isolada aqui, nunca directamente
  nos componentes

A chamada à API Anthropic deve ser feita do lado do cliente com a
`VITE_ANTHROPIC_API_KEY`. O modelo a usar é `claude-sonnet-4-20250514`.
Tratar erros de rate limit e timeout com mensagens claras em português.
```

---

## FASE 4 — Distribuição de Conteúdo

### [] PROMPT 4.1 — Gerador de peças de conteúdo derivadas

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se o `src/lib/ai.ts` já existe com a função `generateArticle` e
como está estruturada a chamada à API Anthropic, se o hook `useArticles.ts`
expõe o artigo completo com as suas relações (product, pillar, workspace),
se existe alguma página de content pieces em `src/pages/content/`, e se
o `ChannelBadge` já está implementado. Confirma no schema os campos do
modelo `ContentPiece` incluindo o campo `slides` (Json) e o enum
`ContentFormat` (CAROUSEL, SHORT_VIDEO, LINKEDIN_POST, INSTAGRAM_POST,
THREAD, CTA_POST). Só depois de teres esse contexto completo, implementa
o seguinte:

Implementa a geração automática de peças de conteúdo a partir de um artigo.
Cria:

- `src/lib/ai.ts` (expandir) — adicionar a função `generateContentPieces({
  article, formats, workspace })` que, dado um artigo, gera múltiplas peças
  em simultâneo usando Promise.all. Para cada formato, o prompt deve adaptar
  o tom, comprimento e estrutura: CAROUSEL gera JSON com array de slides
  `[{order, title, body}]` (máx 10 slides), LINKEDIN_POST gera post opinativo
  de 150-300 palavras com gancho forte, INSTAGRAM_POST gera post curto com
  hashtags, SHORT_VIDEO gera apenas hook + CTA (o roteiro completo é gerado
  separadamente), CTA_POST gera post directo com link para landing do produto
- `src/components/content/content-generator-panel.tsx` — painel que aparece
  dentro do `ArticleDetail` com checkboxes para seleccionar quais os formatos
  a gerar, selector de canal por formato, e botão "Gerar conteúdo
  seleccionado". Mostra progresso individual por peça durante a geração
- `src/hooks/use-content-pieces.ts` — hook com `getContentPieces(articleId)`,
  `generatePieces()`, `updatePiece()`, `approvePiece()`, `deletePiece()`

Cada peça gerada começa com status `DRAFT`. O utilizador tem de a aprovar
(`APPROVED`) antes de poder ser adicionada ao planeador. Nunca apagar e
regenerar — criar sempre nova versão.
```

---

### [] PROMPT 4.2 — Visualização e edição de peças de conteúdo

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se o `use-content-pieces.ts` já está implementado com os métodos
correctos, se o `ContentGeneratorPanel` já está a funcionar e a criar
registos na BD, e se existe alguma página de listagem de conteúdos em
`src/pages/content/`. Confirma o campo `slides` do modelo `ContentPiece`
que é do tipo `Json` (deve ser interpretado como `Array<{order: number,
title: string, body: string}>`). Só depois de teres esse contexto completo,
implementa o seguinte:

Implementa a visualização e edição das peças de conteúdo geradas. Cria:

- `src/pages/content/content-pieces.tsx` — lista de todas as peças do
  workspace com filtros por formato, canal, status e artigo de origem.
  Cada item mostra: formato (ícone), canal alvo (ChannelBadge), status,
  gancho (hookText truncado), e acções. Vista em lista ou grid (toggle)
- `src/components/content/content-piece-card.tsx` — card de preview que
  simula visualmente o formato: post LinkedIn com caixa de texto longa,
  post Instagram com hashtags em baixo, carrossel com navegação entre
  slides (anterior/próximo), CTA com botão destacado
- `src/components/content/content-piece-editor.tsx` — editor inline para
  editar qualquer campo da peça (body, hookText, ctaText, hashtags,
  slides individuais). Edição de slides do carrossel: lista reordenável
  com drag-and-drop simples (não precisa de biblioteca externa — reorder
  com botões cima/baixo é suficiente)
- Botão "Aprovar" em cada peça que muda o status para `APPROVED` e a
  torna disponível para o planeador. Botão "Regenerar" que gera nova
  versão sem apagar a actual

A edição deve ser guardada automaticamente (debounce 1.5s) igual ao editor
de artigos. Um contador "X peças aprovadas / Y total" visível no topo da lista.
```

---

### [] PROMPT 4.3 — Gerador de roteiros de vídeo

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se o `src/lib/ai.ts` já tem a função `generateContentPieces` e
como está estruturada, se existe alguma referência a `VideoScript` no código
React (páginas ou hooks), e se o `ArticleDetail` já tem o
`ContentGeneratorPanel` integrado. Confirma no schema os campos específicos
de `VideoScript` (hook, problem, solution, cta, fullScript, durationSec,
targetChannel, onScreenText, bRoll). Só depois de teres esse contexto
completo, implementa o seguinte:

Implementa o gerador de roteiros de vídeo curto (TikTok/Reels). Cria:

- `src/lib/ai.ts` (expandir) — adicionar `generateVideoScript({ article,
  targetChannel, durationSec, workspace })`. O prompt deve gerar um roteiro
  estruturado com: gancho verbal para os primeiros 3 segundos (hook),
  apresentação do problema (5-10 seg), desenvolvimento/solução (30-40 seg),
  CTA final (5-10 seg), sugestões de texto para aparecer no ecrã
  (onScreenText), e sugestões de b-roll (imagens/vídeos de apoio). O
  `fullScript` deve ser o roteiro completo formatado para leitura em voz
  alta, com indicações de pausa e ênfase
- `src/pages/content/video-scripts.tsx` — lista de roteiros com filtro por
  canal (Instagram/TikTok) e status. Cada item mostra: título, gancho
  (primeiras palavras), duração estimada, canal alvo
- `src/components/content/video-script-Card.tsx` — card expandível que
  mostra o roteiro secção a secção: gancho destacado a negrito, corpo,
  CTA, e no final as sugestões de onScreenText e b-roll em formato de
  checklist. Botão "Copiar roteiro completo" para clipboard
- `src/hooks/use-video-scripts.ts` — hook com `getVideoScripts(articleId)`,
  `generateScript()`, `updateScript()`

O tempo de leitura estimado deve ser calculado automaticamente:
150 palavras/minuto (ritmo de fala). Mostrar aviso se o roteiro gerado
exceder a duração seleccionada.
```

---

## FASE 5 — Planeador Semanal

### [] PROMPT 5.1 — Estrutura do planeador semanal

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se existe alguma página de planeador em `src/pages/planner/`, se
o `use-content-pieces.ts` tem o método `getApprovedPieces()` ou similar para
listar peças aprovadas disponíveis para agendamento, se o `ChannelBadge` e
`PillarBadge` já estão disponíveis, e se existem helpers de data no projecto
(date-fns ou similar nas dependências). Confirma no schema os campos de
`WeeklyPlan` e `PlanItem` incluindo `dayOfWeek` (1=Segunda ... 7=Domingo),
`scheduledFor` (DateTime), e o enum `PlanItemStatus`. Só depois de teres
esse contexto completo, implementa o seguinte:

Implementa a estrutura base do planeador semanal. Cria:

- `src/pages/planner/weekly-planner.tsx` — página principal com:
  navegação de semana (botões anterior/próxima semana, botão "Esta semana"),
  cabeçalho com as datas da semana (Seg a Dom), e 7 colunas de dias.
  Os dias activos por defeito são Segunda, Quarta e Sexta (conforme
  estratégia do documento(README.md)). Os restantes dias aparecem mas mais subtis.
  Cada coluna mostra: dia da semana + data, pilar sugerido para esse dia
  (Seg=P1, Qua=P2, Sex=P3), e lista de items agendados nesse dia
- `src/hooks/use-weekly-plan.ts` — hook com `getOrCreateWeekPlan(weekStart)`,
  `getPlanItems(weeklyPlanId)`, `addPlanItem()`, `removePlanItem()`,
  `updatePlanItemStatus()`. O `getOrCreateWeekPlan` cria automaticamente
  o registo na BD se não existir para aquela semana
- `src/components/planner/week-column.tsx` — coluna de um dia com: header
  com data e pilar sugerido, área de drop para items, e botão "+" para
  adicionar item manualmente
- Usar `date-fns` para toda a manipulação de datas. A semana começa sempre
  na Segunda-feira. O `weekStart` deve ser normalizado para meia-noite UTC

Sem drag-and-drop nesta fase — apenas adicionar e remover items. O DnD
será adicionado numa iteração posterior se necessário.
```

---

### [] PROMPT 5.2 — Adicionar e gerir items no planeador

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se o `weekly-planner.tsx` e `use-weekly-plan.ts` já estão implementados
e funcionais, se existe método para listar peças aprovadas por canal e pilar,
se o `ArticleStatusBadge` já está disponível, e se o `ContentPieceCard` tem
um modo compacto ou preview adequado para o planeador. Confirma os campos
do `PlanItem` — em especial que pode referenciar `articleId` OU
`contentPieceId` (nunca os dois obrigatórios em simultâneo). Só depois de
teres esse contexto completo, implementa o seguinte:

Implementa a adição e gestão de items no planeador. Cria:

- `src/components/planner/add-plan-item-modal.tsx` — modal para adicionar item
  a um dia específico. Tem duas tabs: "Peça de conteúdo" (lista de
  ContentPieces com status APPROVED, filtráveis por canal e pilar) e
  "Artigo" (lista de artigos publicados ou aprovados para partilha directa).
  Selector de canal alvo e hora de publicação. Campo de notas opcional
- `src/components/planner/plan-item-card.tsx` — card dentro da coluna do dia
  mostrando: ícone do formato, canal (ChannelBadge small), título curto,
  pilar (cor de fundo sutil), e botões de acção: "Marcar publicado",
  "Ver conteúdo", "Remover". Quando status=PUBLISHED, mostrar com
  checkbox marcado e opacidade reduzida
- `src/components/planner/publish-confirm-modal.tsx` — modal ao marcar como
  publicado: pede URL do post publicado (opcional) e confirma a data/hora
  real de publicação (pré-preenchida com "agora")
- Barra lateral do planeador com: contagem da semana (X/Y posts planeados),
  peças aprovadas ainda não agendadas (com CTA para adicionar)

Ao remover um item do planeador, o `ContentPiece` volta para status
`APPROVED` (não `DRAFT`). Ao marcar como publicado, actualizar o
`publishedAt` no `PlanItem` e o `publishedAt` no `ContentPiece` associado.
```

---

## FASE 6 — Dashboard

### [] PROMPT 6.1 — Dashboard principal

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica se existe alguma página de dashboard em `src/pages/dashboard.tsx`,
se todos os hooks estão implementados (`useArticles`, `useContentPieces`,
`useWeeklyPlan`, `useProducts`, `usePillars`), e quais os dados que cada
um expõe. Verifica se existe algum componente de stats ou card de métrica
já criado, e se o `date-fns` está disponível para calcular a semana actual.
Só depois de teres esse contexto completo, implementa o seguinte:

Implementa o dashboard principal da aplicação. Cria:

- `src/pages/dashboard.tsx` — dashboard com as seguintes secções:
  1. Header com saudação ("Bom dia, [nome]") e data actual
  2. Cards de métricas da semana: posts planeados vs publicados, artigos
     em rascunho, peças por aprovar, e percentagem de cumprimento do plano
  3. Checklist da semana actual — lista os 3 dias activos (Seg/Qua/Sex)
     com os items planeados e checkboxes de publicado/não publicado.
     Permite marcar directamente do dashboard sem ir ao planeador
  4. Peças pendentes de aprovação — lista das últimas 5 ContentPieces em
     status DRAFT com botão de aprovação rápida
  5. Artigos em rascunho — lista dos últimos 3 artigos com link para editar
  6. Distribuição por pilar — barra visual simples mostrando quantos
     artigos existem por pilar (P1/P2/P3/P4) com as cores respectivas
- `src/components/dashboard/week-checklist.tsx` — secção de checklist
  extraída como componente independente para poder ser reutilizada
- `src/components/dashboard/metric-card.tsx` — card reutilizável com:
  label, valor, ícone, e variação opcional (ex: "+2 esta semana")

Todos os dados devem ser carregados em paralelo com Promise.all para
minimizar o tempo de carregamento. Mostrar skeleton loaders enquanto
os dados estão a ser carregados. Sem gráficos complexos — apenas barras
CSS simples e contagens numéricas.
```

---

## FASE 7 — Layout & Navegação Global

### [] PROMPT 7.1 — Layout principal da aplicação

```markdown
Antes de implementar qualquer coisa, analisa o que já existe no projecto:
verifica como está actualmente configurado o router em `src/app.tsx`, se
existe algum layout wrapper ou shell da aplicação, como estão a ser usados
o `authStore` e `workspaceStore` nas páginas existentes, e se existe algum
componente de sidebar ou header já criado. Verifica também se todos os ícones
necessários estão disponíveis (Lucide React ou similar). Só depois de teres
esse contexto completo, implementa o seguinte:

Implementa o layout principal e navegação da aplicação. Cria:

- `src/components/layout/app-shell.tsx` — layout base com sidebar esquerda
  fixa (260px) e área de conteúdo principal. A sidebar contém: logo/nome
  da app no topo, `WorkspaceSelector` dropdown, navegação principal, e
  no fundo o avatar e nome do utilizador com botão de logout
- `src/components/layout/sidebar.tsx` — navegação com grupos:
  "Principal" (Dashboard, Planeador), "Conteúdo" (Artigos, Peças,
  Roteiros de Vídeo), "Configurações" (Workspace, Produtos, Pilares,
  Canais). Item activo com destaque visual. Badge com contagem em
  "Peças para aprovar" para criar urgência
- `src/components/layout/header.tsx` — header da área de conteúdo com:
  título da página actual, breadcrumb opcional, e acções contextuais
  (ex: "Novo Artigo" na página de artigos)
- Actualizar `src/app.tsx` para envolver todas as rotas protegidas no
  `app-shell`
- Layout responsivo mínimo: em mobile (<768px) a sidebar colapsa para
  um menu hamburger. Em desktop fica sempre visível

A sidebar não deve causar layout shift ao carregar. O estado
collapsed/expanded da sidebar deve ser persistido no `localStorage`.
```

---

Antes de implementar qualquer coisa, analisa com atenção o que já existe
no projecto nas seguintes áreas:

1. **Configuração de IA actual** — abre `src/lib/ai.ts` e verifica como o
   modelo está a ser referenciado (se está hardcoded como string, se já existe
   alguma variável ou constante para o nome do modelo, e se a `VITE_ANTHROPIC_API_KEY`
   já está a ser consumida correctamente). Verifica também o `.env.example` para
   ver quais as variáveis de ambiente já documentadas.

2. **Estado de geração actual** — abre `src/hooks/useAI.ts` e analisa como
   o estado `isGenerating` está implementado: se é um booleano simples ou se já
   tem alguma estrutura de fila. Verifica se existe algum mecanismo de
   cancelamento de pedidos em curso ou se a geração bloqueia a UI enquanto
   corre.

3. **Web Workers no projecto** — verifica se já existe algum ficheiro `.worker.ts`
   ou configuração de Web Worker em `vite.config.ts` (plugin `vite-plugin-worker`
   ou configuração nativa do Vite para workers). Confirma se o projecto usa Vite
   e qual a versão, pois o suporte nativo a workers difere entre versões.

4. **Stores Zustand existentes** — lista todos os ficheiros em `src/stores/` e
   entende a estrutura de cada um (especialmente `workspaceStore` e `authStore`),
   para que o novo store de geração siga o mesmo padrão já estabelecido no
   projecto.

5. **Tipos existentes** — abre `src/types/index.ts` e verifica se já existem
   tipos relacionados com jobs de geração, filas, ou estados assíncronos de IA.

Só depois de teres esse contexto completo em todas as áreas acima, implementa
o seguinte:

---

## MELHORIA 1 — Modelo configurável via variável de ambiente

Actualiza a configuração de IA para que o modelo da Anthropic seja definido
por variável de ambiente em vez de estar hardcoded no código:

- Adiciona `VITE_AI_MODEL` ao `.env.example` com o valor padrão
  `claude-sonnet-4-20250514` e um comentário a explicar que aceita qualquer
  modelo válido da Anthropic (ex: `claude-opus-4-20250514`,
  `claude-haiku-4-5-20251001`)
- Em `src/lib/ai.ts`, substitui qualquer string hardcoded do modelo por
  `import.meta.env.VITE_AI_MODEL ?? 'claude-sonnet-4-20250514'`. O fallback
  garante que a app não quebra se a variável não estiver definida
- Em `src/lib/constants.ts`, adiciona uma constante exportada `AI_MODEL` que
  lê `import.meta.env.VITE_AI_MODEL ?? 'claude-sonnet-4-20250514'` — é esta
  constante que deve ser usada em todo o código, nunca o `import.meta.env`
  directamente nos ficheiros de serviço
- Se já existir algum painel de settings de workspace, adiciona um campo
  informativo (só leitura) que mostra qual o modelo actualmente activo, para
  que o utilizador saiba o que está configurado sem ter de abrir o `.env`

---

## MELHORIA 2 — Worker de geração em background com fila de jobs

Implementa um sistema de geração assíncrona em background usando Web Worker,
com fila FIFO para múltiplos pedidos concorrentes. O utilizador deve poder
submeter N gerações e continuar a usar a aplicação normalmente enquanto os
jobs correm em background.

### 2.1 — Tipos e estrutura de dados

Cria ou expande `src/types/index.ts` com os seguintes tipos:

```typescript
type GenerationJobStatus = 'pending' | 'running' | 'completed' | 'failed'

type GenerationJobType = 'article' | 'content_pieces' | 'video_script'

interface GenerationJob {
  id: string                    // UUID gerado no cliente
  type: GenerationJobType
  status: GenerationJobStatus
  payload: GenerationPayload    // Input necessário para a geração
  result?: GenerationResult     // Output após conclusão
  error?: string                // Mensagem de erro se falhar
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  workspaceId: string
}

// Discriminated union para os diferentes tipos de payload
type GenerationPayload =
  | { type: 'article'; topic: string; pillarId: string; productId?: string; workspace: WorkspaceContext }
  | { type: 'content_pieces'; articleId: string; formats: ContentFormat[]; workspace: WorkspaceContext }
  | { type: 'video_script'; articleId: string; targetChannel: SocialChannel; workspace: WorkspaceContext }
```

### 2.2 — Web Worker

Cria `src/workers/generation.worker.ts` — este ficheiro corre numa thread
separada e é o único ponto que faz chamadas à API Anthropic:

- O worker recebe mensagens do tipo `{ type: 'START_JOB', job: GenerationJob }`
- Usa a `AI_MODEL` constante e a `VITE_ANTHROPIC_API_KEY` para fazer a chamada
  à API (as variáveis `import.meta.env` estão disponíveis dentro de workers
  no Vite — confirma isto na análise inicial)
- Durante a execução envia mensagens de progresso de volta para a thread
  principal: `{ type: 'JOB_PROGRESS', jobId, message: string }`
- Ao terminar envia: `{ type: 'JOB_COMPLETED', jobId, result: GenerationResult }`
- Em caso de erro envia: `{ type: 'JOB_FAILED', jobId, error: string }`
- O worker processa **um job de cada vez** — a gestão de fila e concorrência
  é responsabilidade do store, não do worker. O worker apenas executa o job
  que lhe é enviado e reporta o resultado

Instanciar o worker em Vite com a sintaxe nativa:

```typescript
const worker = new Worker(
  new URL('../workers/generation.worker.ts', import.meta.url),
  { type: 'module' }
)
```

### 2.3 — Generation Queue Store

Cria `src/stores/generationStore.ts` (Zustand) — este store é o orquestrador
central da fila e do ciclo de vida dos jobs:

**Estado:**

```typescript
interface GenerationState {
  jobs: GenerationJob[]           // Todos os jobs (histórico completo)
  queue: string[]                 // IDs dos jobs em 'pending', por ordem FIFO
  currentJobId: string | null     // ID do job actualmente a correr no worker
  worker: Worker | null           // Instância do Web Worker
}
```

**Acções:**

- `initWorker()` — inicializa o Web Worker uma única vez e regista os
  listeners de mensagens (`onmessage`). Deve ser chamado uma única vez no
  ponto de entrada da app (ex: `App.tsx`), não em cada componente
- `enqueue(payload: GenerationPayload): string` — cria um novo `GenerationJob`
  com status `'pending'`, adiciona ao array `jobs` e ao array `queue`,
  e retorna o `jobId`. Se não houver nenhum job a correr (`currentJobId === null`),
  dispara imediatamente `processNext()`
- `processNext()` — pega no primeiro ID da `queue`, actualiza o job para
  status `'running'`, define `currentJobId`, e envia a mensagem `START_JOB`
  ao worker. Se a `queue` estiver vazia, define `currentJobId = null`
- `handleWorkerMessage(event: MessageEvent)` — handler dos eventos vindos
  do worker: actualiza o status do job correspondente, e quando recebe
  `JOB_COMPLETED` ou `JOB_FAILED` chama `processNext()` para avançar
  para o próximo job da fila
- `cancelJob(jobId: string)` — se o job estiver `'pending'`, remove-o
  da fila. Se estiver `'running'`, não cancela (o worker não suporta
  cancelamento mid-request — apenas marca como ignorado após conclusão)
- `clearCompleted()` — remove da lista todos os jobs com status
  `'completed'` ou `'failed'`

### 2.4 — Hook de interface

Cria `src/hooks/useGeneration.ts` — interface simplificada para os
componentes usarem, sem exporem directamente o store:

- `generateArticle(params)` — chama `enqueue` com payload de artigo e
  retorna o `jobId`
- `generateContentPieces(params)` — idem para peças de conteúdo
- `generateVideoScript(params)` — idem para roteiro de vídeo
- `jobsInProgress` — array de jobs com status `'pending'` ou `'running'`
- `completedJobs` — array de jobs com status `'completed'`
- `failedJobs` — array de jobs com status `'failed'`
- `queueLength` — número de jobs em `'pending'`
- `isWorkerReady` — boolean que indica se o worker foi inicializado

### 2.5 — UI: Painel de fila de geração

Cria `src/components/ai/GenerationQueue.tsx` — componente flutuante fixo
no canto inferior direito do ecrã (acima de qualquer outro elemento flutuante),
visível apenas quando existem jobs activos ou recentemente concluídos:

- Aparece automaticamente quando `jobsInProgress.length > 0` ou quando
  há jobs concluídos nos últimos 30 segundos. Desaparece após 5 segundos
  sem actividade (com animação de saída suave)
- Mostra uma lista compacta de jobs com:
  - Job a correr: spinner animado + label do tipo ("A gerar artigo...",
    "A gerar peças de conteúdo...", "A gerar roteiro...") + mensagem de
    progresso mais recente
  - Jobs na fila: ícone de relógio + label + posição na fila ("Na fila #2")
  - Jobs concluídos: ícone de check verde + label + link directo para o
    resultado ("Ver artigo gerado →")
  - Jobs falhados: ícone de erro vermelho + mensagem de erro truncada +
    botão "Tentar novamente"
- Badge no ícone da sidebar (ou no header) com o número de jobs activos,
  para que o utilizador saiba que há geração em curso mesmo que feche o painel

### 2.6 — Migração dos pontos de chamada existentes

Actualiza todos os locais onde `useAI.ts` era chamado directamente para
passarem a usar `useGeneration.ts`:

- `src/components/articles/ArticleGeneratorModal.tsx` — em vez de bloquear
  a UI até a geração terminar, chamar `generateArticle()`, fechar o modal
  imediatamente com feedback ("Artigo adicionado à fila de geração"), e
  quando o job completar, notificar o utilizador via `GenerationQueue`
  com link para abrir o artigo no editor
- `src/components/content/ContentGeneratorPanel.tsx` — idem para peças,
  fechar o painel de geração imediatamente após submeter
- Quando um job de artigo completa, guardar automaticamente o resultado
  na BD (como DRAFT) e actualizar a lista de artigos em tempo real —
  este é o único caso em que se guarda automaticamente, porque o utilizador
  já não está no contexto do modal para confirmar

Garante retrocompatibilidade: se o `useAI.ts` ainda for necessário para
casos síncronos (ex: geração de slug), mantê-lo intacto mas sem duplicar
lógica de chamada à API.

---

## NOTAS GERAIS PARA TODOS OS PROMPTS

Aplica estas regras em todos os prompts acima:

- **TypeScript estrito** — sem `any`, sem `as unknown as`
- **Sem mock data** — tudo ligado ao Supabase real desde o início
- **Erros sempre em português** — mensagens de erro e loading visíveis ao utilizador
- **workspaceId sempre presente** — todas as queries filtradas por workspace
- **Componentes pequenos** — máx ~150 linhas por ficheiro, extrair sub-componentes
- **Sem bibliotecas desnecessárias** — preferir soluções CSS/React nativas antes de instalar nova dependência
