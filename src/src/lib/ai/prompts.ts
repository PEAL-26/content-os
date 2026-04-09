import type { GenerateArticleParams } from './types';

export function buildArticlePrompt(params: GenerateArticleParams): string {
    const { topic, pillar, product, workspace } = params;

    const language = workspace.contentLanguage || 'pt';
    const languageLabel =
        language === 'pt'
            ? 'português'
            : language === 'en'
              ? 'inglês'
              : language;
    const voiceTone = workspace.voiceTone || 'profissional e acessível';

    let prompt = `És um copywriter especialista em criar artigos de blog otimizados para SEO e conversão.\n\n`;

    prompt += `## Contexto do Cliente\n`;
    prompt += `Idioma: ${languageLabel}\n`;
    prompt += `Tom de voz: ${voiceTone}\n`;

    if (workspace.targetAudience) {
        prompt += `Público-alvo: ${workspace.targetAudience}\n`;
    }

    if (workspace.valueProposition) {
        prompt += `Proposta de valor: ${workspace.valueProposition}\n`;
    }

    prompt += `\n## Pilar de Conteúdo\n`;
    if (pillar) {
        prompt += `Nome: ${pillar.name}\n`;
        if (pillar.objective) {
            prompt += `Objetivo: ${pillar.objective}\n`;
        }
        if (pillar.examples && pillar.examples.length > 0) {
            prompt += `Exemplos de títulos: ${pillar.examples.slice(0, 3).join('; ')}\n`;
        }
    } else {
        prompt += `Não definido (artigo genérico)\n`;
    }

    prompt += `\n## Produto Relacionado\n`;
    if (product) {
        prompt += `Nome: ${product.name}\n`;
        if (product.problemSolved) {
            prompt += `Problema que resolve: ${product.problemSolved}\n`;
        }
        if (product.targetAudience) {
            prompt += `Público do produto: ${product.targetAudience}\n`;
        }
    } else {
        prompt += `Nenhum produto selecionado\n`;
    }

    prompt += `\n## Tema do Artigo\n`;
    prompt += `${topic}\n`;

    prompt += `\n## Requisitos de Formato\n`;
    prompt += `Responde APENAS com JSON válido, sem texto adicional:\n`;
    prompt += `{\n`;
    prompt += `  "title": "Título SEO atrativo (max 60 chars)",\n`;
    prompt += `  "slug": "url-amigavel-separada-por-hifens",\n`;
    prompt += `  "summary": "Resumo atrativo (max 150 chars)",\n`;
    prompt += `  "body": "Conteúdo em Markdown estruturado com H2, H3, listas, blockquotes. Mínimo 800 palavras.",\n`;
    prompt += `  "seoTitle": "Título SEO alternativo (max 60 chars)",\n`;
    prompt += `  "seoDescription": "Descrição meta para SEO (max 160 chars)",\n`;
    prompt += `  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],\n`;
    prompt += `  "readingTimeMin": numero_estimado_minutos\n`;
    prompt += `}\n`;

    prompt += `\n## Instruções\n`;
    prompt += `- Escreve em ${languageLabel}\n`;
    prompt += `- Usa o tom: ${voiceTone}\n`;
    prompt += `- Inclui CTAs subtis relacionados com o problema/solução\n`;
    prompt += `- Estrutura o body com pelo menos 3 secções H2\n`;
    prompt += `- O slug deve ser URL-friendly em ${languageLabel}\n`;
    prompt += `- Keywords devem ser termos de pesquisa relevantes\n`;

    return prompt;
}

export function parseArticleResponse(text: string): {
    article: {
        title: string;
        slug: string;
        summary: string;
        body: string;
        seoTitle: string;
        seoDescription: string;
        keywords: string[];
        readingTimeMin: number;
    } | null;
    error?: string;
} {
    try {
        let jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return {
                article: null,
                error: 'Não consegui interpretar a resposta. Tenta novamente com um tema mais específico.',
            };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        if (!parsed.title || !parsed.body) {
            return {
                article: null,
                error: 'A resposta não contém os campos necessários (title, body).',
            };
        }

        return {
            article: {
                title: parsed.title || '',
                slug: parsed.slug || generateSlug(parsed.title || ''),
                summary: parsed.summary || '',
                body: parsed.body || '',
                seoTitle: parsed.seoTitle || parsed.title || '',
                seoDescription: parsed.seoDescription || '',
                keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
                readingTimeMin:
                    parsed.readingTimeMin ||
                    calculateReadingTime(parsed.body || ''),
            },
        };
    } catch {
        return {
            article: null,
            error: 'Erro ao processar a resposta da IA.',
        };
    }
}

export function calculateReadingTime(body: string): number {
    const wordsPerMinute = 200;
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .substring(0, 100);
}
