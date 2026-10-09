// =============================================================================
// Placeholders de ilustração de um ARTIGO.
//
// O formato `[IMAGEM SUGERIDA — <descrição>]` NÃO foi inventado aqui: é o que já
// existe nos artigos do utilizador. Adotá-lo tal e qual é o que evita ter de
// migrar conteúdo.
//
// A descrição dentro do marcador é a SEMENTE do prompt de media: é dela que sai
// a instrução visual. Por isso o gerador de artigos passa a emitir marcadores
// com uma descrição concreta, e não um rótulo vazio do tipo "imagem aqui".
// =============================================================================

/**
 * Captura `[IMAGEM SUGERIDA — ...]` numa linha isolada.
 *
 * O travessão longo é aceite em qualquer das três formas (— em dash, – en dash,
 * - hífen) porque o que decide é o texto, não o caractere. Também aceita `:` por
 * causa de marcadores escritos à mão no editor.
 */
export const ILLUSTRATION_MARKER_RE = /^\s*\[IMAGEM SUGERIDA\s*[—–:-]\s*(.+?)\s*\]\s*$/i;

export interface IllustrationMarker {
    /** 1-based, pela ordem em que aparece no corpo. */
    index: number;
    /** A descrição visual — é a semente do prompt de media. */
    description: string;
    /** `ilustracao-N`, a chave que liga o marcador ao prompt e ao artefacto. */
    itemKey: string;
    /** A linha completa, para substituir ou remover. */
    raw: string;
}

/**
 * Extrai os marcadores do corpo de um artigo, por ordem.
 *
 * Devolve também as linhas sem marcador, para que o caller consiga reconstruir
 * o corpo substituindo apenas as linhas que interessam (`buildArticleExport`).
 */
export function extractIllustrationMarkers(body: string): {
    markers: IllustrationMarker[];
    lines: string[];
} {
    const lines = (body ?? '').split('\n');
    const markers: IllustrationMarker[] = [];

    lines.forEach((line) => {
        const match = ILLUSTRATION_MARKER_RE.exec(line);
        if (!match) return;
        const description = match[1].trim();
        if (!description) return;
        const index = markers.length + 1;
        markers.push({
            index,
            description,
            itemKey: `ilustracao-${index}`,
            raw: line,
        });
    });

    return { markers, lines };
}

/** Só a lista de marcadores — a forma mais comum. */
export function illustrationMarkers(body: string): IllustrationMarker[] {
    return extractIllustrationMarkers(body).markers;
}

/** Um artefacto já gerado para um marcador. */
export interface IllustrationAsset {
    itemKey: string;
    url: string;
    name?: string | null;
}

/**
 * Constrói o corpo do artigo pronto a publicar/copiar.
 *
 * Um marcador com imagem vira `![descrição](url)` — que é o que o utilizador
 * quer no blog. Um marcador sem imagem é REMOVIDO: o `[IMAGEM SUGERIDA — ...]`
 * é uma nota interna e nunca deve sair da aplicação (não há renderer público,
 * o corpo é copiado à mão).
 */
export function buildArticleExport(
    body: string,
    assets: IllustrationAsset[]
): string {
    const byKey = new Map(assets.map((asset) => [asset.itemKey, asset]));
    const { lines } = extractIllustrationMarkers(body);

    const out: string[] = [];
    let nextIndex = 0;

    for (const line of lines) {
        const match = ILLUSTRATION_MARKER_RE.exec(line);
        if (!match) {
            out.push(line);
            continue;
        }
        const description = match[1].trim();
        if (!description) continue;

        const asset = byKey.get(`ilustracao-${nextIndex + 1}`);
        nextIndex += 1;

        if (asset) {
            const alt = asset.name?.trim() || description;
            out.push(`![${escapeAlt(alt)}](${asset.url})`);
        }
        // Sem imagem: o marcador desaparece em silêncio.
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** `]` e `[` num texto alternativo quebram o Markdown de imagem. */
function escapeAlt(text: string): string {
    return text.replace(/[[\]]/g, '');
}

/**
 * Instrução para o prompt de artigo: onde e como emitir marcadores.
 *
 * Fica aqui, e não no prompt, porque é a mesma regra para qualquer workspace —
 * e assim fica testável sem chamar um modelo.
 */
export const ARTICLE_ILLUSTRATION_INSTRUCTIONS = `- A cada 2 ou 3 secções, insere uma linha isolada com um placeholder de ilustração, exactamente neste formato:
  [IMAGEM SUGERIDA — descrição visual concreta do que a imagem mostra]
- A descrição tem de ser visual e específica (sujeito, acção, cenário, luz), nunca um rótulo do tipo "imagem aqui". Máximo 30 palavras.
- A descrição é usada para gerar a imagem por IA, por isso escreve-a como quem descreve uma fotografia.
- Nunca escrevas Markdown de imagem (\`![...](...)\`): quem insere a imagem é outra etapa.
- A linha do placeholder fica sozinha, com uma linha em branco antes e depois.`;

/** Verificação de que o corpo tem marcadores — para activar o painel. */
export function hasIllustrationMarkers(body: string): boolean {
    return illustrationMarkers(body).length > 0;
}