/**
 * Escrita no clipboard com os dois flavors de texto.
 *
 * Quando copias numa página web, o clipboard não leva só texto — leva também
 * `text/html`. O destino escolhe o que sabe ler:
 *
 * - **LinkedIn, Instagram, X, Threads**: leem só `text/plain`, e mostram-no cru.
 *   Por isso a variante plain leva caracteres Unicode de negrito.
 * - **Notion, Google Docs, Gmail, Word**: leem `text/html` e mostram negrito e
 *   listas a sério.
 *
 * Escrever os dois Resolve os dois casos num clique só.
 *
 * `navigator.clipboard.write()` com `text/html` é Baseline desde Junho de 2024
 * (Chrome 76, Safari 13.1, Firefox 127). Nos browsers mais antigos cai para
 * `writeText()` — que nunca perde a formatação, porque a variante plain já vai
 * com Unicode.
 */

export interface ClipboardPayload {
    /** Texto simples. É sempre escrito. */
    text: string;
    /** HTML rico. Opcional: nem toda a peça o exige. */
    html?: string;
}

/** Mensagem de erro em português, igual à que os botões já usavam. */
export const CLIPBOARD_ERROR_MESSAGE =
    'Não foi possível copiar. O browser não deu acesso à área de transferência.';

/** O browser suporta `write()` com `text/html`? */
export function supportsHtmlClipboard(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        typeof navigator.clipboard?.write === 'function' &&
        typeof ClipboardItem !== 'undefined'
    );
}

/**
 * Escreve texto (e opcionalmente HTML) no clipboard.
 *
 * Lança um `Error` com mensagem em português quando falha — o chamador mostra-a
 * ao utilizador.
 */
export async function writeToClipboard({
    text,
    html,
}: ClipboardPayload): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
        // `navigator.clipboard` não existe em contextos não seguros (http://
        // localhost numa rede, iframe sem permissão).
        throw new Error(CLIPBOARD_ERROR_MESSAGE);
    }

    if (html && supportsHtmlClipboard()) {
        // Os `Blob`s são criados aqui, síncronamente, dentro do gesto do
        // utilizador: o Safari exige-os prontos antes de qualquer `await`, ou
        // a escrita é bloqueada.
        const item = new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
        });

        try {
            await navigator.clipboard.write([item]);
            return;
        } catch {
            // Não se regista o erro aqui: pode ser `NotAllowedError`
            // (permissão negada) ou um browser que rejeita `Blob` apesar de
            // announcear suporte. Nos dois casos o `writeText` de baixo ainda
            // pode funcionar, e é a variante plain — com Unicode — que se
            // quer perder menos.
        }
    }

    try {
        await navigator.clipboard.writeText(text);
    } catch {
        throw new Error(CLIPBOARD_ERROR_MESSAGE);
    }
}
