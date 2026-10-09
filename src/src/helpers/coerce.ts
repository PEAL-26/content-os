/**
 * Normalização de campos TEXT[] vindos do PostgREST e de respostas de IA.
 *
 * Antes vivia em `video-script.service.ts`, que deixou de existir com a fusão de
 * `video_scripts` em `content_pieces`. Passou para aqui porque `scenes` (a
 * decomposição em cenas, agora em `content_pieces.scenes`) e qualquer outra
 * lista textual precisam da mesma tolerância — e duplicar o helper seria
 * exactamente o que esta mudança veio eliminar.
 */

/**
 * Converte um valor desconhecido numa `string[]`, nunca lançando.
 *
 * A tolerância existe por causa de três fronteiras que discordam do mesmo campo:
 *   · `NULL` na coluna → `[]`
 *   · o texto JSON que os escritores antigos gravavam (`'["a","b"]'`)
 *   · texto simples de uma resposta da IA (`'a\nb'`)
 *
 * Com isto, `list.length` é sempre o número de ITENS (o `.length` de uma string
 * dava o número de caracteres, e o `.map()` seguinte rebentava).
 */
export function toStringList(value: unknown): string[] {
    // `null`/`undefined`/chave em falta: lista vazia, nunca um crash.
    if (value === null || value === undefined) return [];

    // Já é um array: fica só o que é string não vazio — `null` e números de uma
    // resposta da IA caem fora.
    if (Array.isArray(value)) {
        return value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item !== '');
    }

    // Qualquer outra coisa (número, booleano, objecto) não é uma lista.
    if (typeof value !== 'string') return [];

    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null') return [];

    // Primeiro `JSON.parse`: é o formato gravado historicamente.
    try {
        const parsed: unknown = JSON.parse(trimmed);
        // Array (o caso normal) ou string (o `'"texto"'` duplamente
        // codificado, ou um JSON válido que é só texto) → recurso.
        if (Array.isArray(parsed) || typeof parsed === 'string') {
            return toStringList(parsed);
        }
        // Número/objeto/`true`: JSON válido que não é lista → cai na partilha
        // por linhas abaixo.
    } catch {
        // Texto simples (`'a\nb'`) ou lixo: idem.
    }

    // Fallback: uma linha por item, sem linhas vazias nas pontas.
    return trimmed
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
}