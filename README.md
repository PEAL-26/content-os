# ContentOS

## 🏗️ Estrutura do Projecto

### Visão Geral

Ferramenta de gestão de conteúdo para product houses, configurável por empresa/creator, com geração de conteúdo via IA.

---

## Stack Técnica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend | React + Vite | Rápido, simples, fácil de manter |
| Backend/DB | Supabase | Auth, DB, Storage tudo-em-um |
| IA | Anthropic API (Claude) | Geração de conteúdo, roteiros, slugs |
| Estilo | Tailwind CSS | Velocidade de desenvolvimento |
| Estado | Zustand | Simples, sem boilerplate |

---

## Base de Dados (Supabase)

### Tabelas principais

```
workspaces          → empresa/creator (multi-tenant)
  └── products      → produtos da empresa
  └── pillars       → P1/P2/P3/P4 configuráveis
  └── articles      → artigos do blog
       └── content_pieces  → derivados (carrossel, post, thread...)
       └── video_scripts   → roteiros de vídeo
  └── weekly_plans  → planeamento semanal
       └── plan_items      → posts agendados por dia
  └── settings      → configurações da empresa (tom, canais, frequência)
```

---

## Features (por módulo)

### 1. 🏢 Workspace & Configuração

- Criar workspace (nome empresa, logo, sector)
- Definir **pilares de conteúdo** (P1–P4, editáveis, com nome/objetivo/exemplos)
- Definir **canais activos** (LinkedIn, Instagram, TikTok, YouTube)
- Definir **tom de voz** (formal, directo, técnico, casual)
- Definir **produtos** (nome, descrição, landing page URL, público-alvo)
- Configurar **frequência mínima** (posts/semana, artigos/semana)
- Regra 70/30 configurável

### 2. ✍️ Criador de Artigos (Blog)

- Criar artigo com: título, tema, pilar associado, produto relacionado
- **Gerar artigo completo com IA** (baseado no pilar + produto + tom configurado)
- Editor de texto rico (simples)
- Gerar **slug SEO** automaticamente
- Status: rascunho → revisto → publicado
- Campo para URL final do artigo publicado

### 3. 🔀 Distribuição de Conteúdo

A partir de cada artigo, gerar automaticamente:

- **Post carrossel** (10 slides estruturados em texto)
- **Post LinkedIn** (opinativo, B2B)
- **Post Instagram** (curto, visual, com hashtags)
- **Thread** (se aplicável)
- **Roteiro de vídeo curto** (TikTok/Reels) — com gancho, corpo, CTA
- **CTA directo** para landing do produto
- Cada peça tem: plataforma, formato, texto gerado, status (rascunho/aprovado)

### 4. 📅 Planeador Semanal

- Vista de calendário semanal (Seg/Qua/Sex por defeito)
- Arrastar e soltar conteúdo para dias
- Template pré-definido: Segunda=P1, Quarta=P2, Sexta=P3
- Ver todas as peças pendentes (não agendadas)
- Marcar como publicado (com data/hora real)
- Visão mensal opcional

### 5. 📊 Dashboard

- Posts planeados vs publicados esta semana
- Artigos em rascunho
- Peças de conteúdo por aprovar
- Distribuição por pilar (P1/P2/P3/P4)
- Checklist da semana actual

### 6. 🤖 Geração IA (transversal)

Motor central que usa as configurações do workspace para gerar conteúdo consistente. O prompt é sempre construído com: tom de voz + pilares + produto + regras operacionais (do teu documento).

---

## Fluxo principal do utilizador

```
Configurar workspace
    ↓
Criar artigo (ou gerar com IA)
    ↓
Distribuir → gerar 4-5 peças derivadas
    ↓
Aprovar/editar peças
    ↓
Arrastar para plano semanal
    ↓
Marcar como publicado
```

---

## Estrutura de Pastas (React/Vite)

```
src/
├── pages/
│   ├── Dashboard.jsx
│   ├── Articles/
│   │   ├── ArticleList.jsx
│   │   ├── ArticleEditor.jsx
│   │   └── ArticleDetail.jsx
│   ├── Content/
│   │   ├── ContentPieces.jsx
│   │   └── VideoScripts.jsx
│   ├── Planner/
│   │   └── WeeklyPlanner.jsx
│   └── Settings/
│       ├── Workspace.jsx
│       ├── Products.jsx
│       ├── Pillars.jsx
│       └── Channels.jsx
├── components/
│   ├── ui/           → botões, cards, inputs
│   ├── content/      → ContentCard, PillarBadge, etc.
│   ├── planner/      → WeekColumn, DaySlot, etc.
│   └── ai/           → GenerateButton, AIOutput, etc.
├── lib/
│   ├── supabase.js   → cliente supabase
│   └── ai.js         → funções de geração (Claude API)
├── stores/
│   └── workspace.js  → estado global (Zustand)
└── hooks/
    ├── useArticles.js
    ├── useContent.js
    └── usePlanner.js
```

---

## Prioridade de Desenvolvimento (ordem sugerida)

| Fase | O que construir | Porquê |
|---|---|---|
| 1 | Setup Supabase + Auth + Workspace | Base de tudo |
| 2 | Configurações (pilares, produtos, canais, tom) | Alimenta a IA |
| 3 | Criador de artigos + geração IA | Core da ferramenta |
| 4 | Distribuição de conteúdo (peças derivadas) | Multiplica o trabalho |
| 5 | Planeador semanal | Organiza a execução |
| 6 | Dashboard + estatísticas | Visibilidade |

---

## Notas importantes

**Multi-tenant simples**: cada workspace é isolado por `workspace_id` em todas as tabelas — já pronto para outras empresas usarem no futuro.

**IA sempre contextualizada**: os prompts nunca são genéricos, são sempre construídos com o tom, pilares e produtos do workspace específico.

**Sem over-engineering**: sem Next.js, sem SSR, sem complexidade desnecessária — Vite + React + Supabase resolve tudo para uma equipa de 3 pessoas.
