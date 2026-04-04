# Development Guideline — ContentOS

Guia de boas práticas focado em React + TypeScript para componentização, reutilização e qualidade de código.

Este documento prioriza:

- Componentização e composição sobre replicação de código.
- Reutilização via componentes, hooks e helpers bem tipados.
- Preferência pelo ecossistema shadcn (quando aplicável) em vez de criar componentes UI do zero.

## ⚡ Regra de Ouro — Analisa Antes de Implementar

Antes de qualquer implementação, procura o que já existe e reusa:

```bash
# mapear componentes e hooks existentes
Get-ChildItem -Path src -Recurse -Include "*.tsx","*.ts" | Select-Object FullName | Sort-Object

# abrir ficheiro antes de duplicar lógica
cat src/components/nome-componente.tsx
```

Não dupliques lógica; prefira extrair para um hook, helper ou componente partilhado.

---

## Estrutura recomendada de pastas

Mantém responsabilidades separadas. Exemplo adaptado para este projecto:

```
src/
├── components/        # componentes reutilizáveis (ui/, primitives/, shared/)
│   ├── ui/            # pequenos átomos e wrappers (usar shadcn se possível)
│   ├── primitives/    # primitives locais baseadas em shadcn/tailwind
│   └── sections/      # composições de página (organismos)
├── layouts/
├── pages/
├── hooks/             # hooks reutilizáveis e bem tipados
├── helpers/           # funções puras e utilitárias
├── types/             # tipos e interfaces globais
├── data/              # dados estáticos
└── styles/            # tokens e utilitários CSS
```

Princípio: o diretório `components/ui` deve conter adaptações/combinações dos componentes do shadcn — não reescrevas botões, inputs e modals básicos sem necessidade.

---

## Preferir shadcn quando aplicável

shadcn/ui (ou componente equivalente do design system) deve ser a primeira escolha para componentes UI comuns (Button, Input, Select, Modal, Tooltip, etc.). Vantagens:

- Consistência visual e de comportamento
- Menos manutenção
- Acessibilidade e tokens já implementados

Quando criar uma variante específica do projeto:

- Estende o componente shadcn via composição (wrappers) em `components/primitives/`.
- Evita copiar/colar markup — extrai variantes em utilitários ou CSS utilities.

Exemplo: criar `components/primitives/Button.tsx` que importa e expõe o `Button` do shadcn com variantes do projeto.

---

## Componentização e Reutilização (contrato curto)

- Inputs: props explícitas e tipos claros (required/optional).
- Outputs: render previsível e eventos bem documentados.
- Error modes: fallback UI, mensagens amigáveis, logs quando necessário.

Boas práticas:

- 1 componente por ficheiro; nome PascalCase.
- Componentes controlados (props) + uncontrolled internals quando necessário.
- Se um componente exceder ~150 linhas, extrai subcomponentes.
- Favor composition over inheritance; use slots/children e props de renderização.

Edge cases a cobrir: props nulas/undefined, listas vazias, states de loading/error, tamanhos/responsividade.

---

## TypeScript — regras práticas

- Sempre tipar props com `interface`.
- Exportar tipos globais em `src/types/index.ts`.
- Tipar retorno de hooks e funções assíncronas.
- Evitar `any`; se necessário, documentar a razão.

Exemplo de hook:

```ts
interface UseFetchResult<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

function useFetch<T>(url: string): UseFetchResult<T> { /* ... */ }
```

---

## Hooks — reuso de comportamento

- Extrair lógica acoplada (fetching, validação, form handling, toggles) para hooks.
- Hooks devem ser puros quanto possível: input -> output, side-effects explícitos.
- Nomear com `use` e documentar efeitos colaterais.

Exemplo: `useForm`, `usePagination`, `useDebouncedValue`, `useCurrentWorkspace`.

---

## Performance

- Lazy load para componentes não essenciais abaixo do fold.
- Code-splitting por rota e por seção pesada.
- Memoizar apenas onde há ganho comprovado com profiler.
- Evitar rerenders desnecessários: passar funções memorizadas e props estáveis para componentes memoizados.

---

## Testes

- Testes unitários para hooks e utilitários (Jest / Vitest).
- Testes de integração/visual para componentes críticos (Testing Library + Storybook/VRT).
- Cobertura mínima sugerida para módulos de negócio críticos; priorizar qualidade sobre %.

---

## Acessibilidade (a11y)

- Usar componentes shadcn que já incorporam práticas de acessibilidade quando possível.
- TEste de contraste, navegação por teclado, roles/aria onde aplicável.
- Sempre `alt` em imagens, labels em inputs.

---

## Estado

- Estado local: `useState`.
- Múltiplas ações relacionadas: `useReducer`.
- Estado partilhado: Context API ou soluções como Zustand (quando necessário).
- Evitar Redux salvo necessidade justificada.

---

## Nomenclatura e convenções

| Tipo | Convenção | Exemplo |
|---|---|---|
| Componentes | PascalCase | `ProductCard` |
| Hooks | camelCase com `use` | `useModal` |
| Utilitários | camelCase | `formatDate` |
| Tipos | PascalCase | `BlogPost` |
| Arquivos | kebab-case | `product-card.tsx` |

---

## Exemplos rápidos

- Criar `components/ui/button.tsx` que reexporta o Button do shadcn com variantes do projecto.
- `hooks/use-current-workspace.ts` -> encapsula fetch + cache do workspace atual e retorna id/tokens.

---

## Checklist antes do PR

- [ ] Procure por componente/hook existente para reutilizar.
- [ ] Tipar todos os props e retornos.
- [ ] Testes unitários para lógica crítica.
- [ ] Verificar acessibilidade básica.
- [ ] Documentar novos componentes (Storybook/README curto).

---

Se quiser, atualizo exemplos concretos no repositório (ex.: criar `components/ui/button.tsx` usando shadcn e um hook `use-current-workspace`).

Fim.
