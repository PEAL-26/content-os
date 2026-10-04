// =============================================================================
// Canal partilhado de `generation_jobs` — registry com ref-count.
//
// Existe por causa de um crash real: o `supabase.channel(topic)` NÃO cria um
// canal novo quando o topic já existe, devolve o existente (ver
// `RealtimeClient.channel` no realtime-js). Com o topic derivado dos targetIds,
// dois subscritores do mesmo alvo partilhavam o canal e a segunda chamada a
// `.on()` corria sobre um canal já *joined* — que o realtime-js recusa com
// "cannot add `postgres_changes` callbacks … after `subscribe()`". Na página de
// peças isso acontecia sempre (o job de CONTENT_PROMPT do artigo subscrito pelo
// `content-pieces.tsx` e outra vez pelo `ContentPromptsPanel`), o throw subia de
// um `useEffect` e derrubava a app inteira.
//
// Aqui o canal é um só, com UM `.on()` sem filtro, e cada subscritor declara o
// que lhe interessa. O canal só sai quando o último listener se desconecta, e
// mesmo assim no fim do tick: um unmount seguido de mount inmediato (StrictMode,
// troca de alvo) não paga um ciclo de teardown.
//
// Não conhece o Supabase: recebe a fábrica do canal. É o que permite testar o
// registry em Node (`scripts/probe-generation-jobs-channel.ts`).
// =============================================================================

/** Topic único e constante: deixa de depender dos ids, logo não pode colidir. */
export const GENERATION_JOBS_TOPIC = 'generation-jobs';

/** Estados de subscrição que o realtime-js reporta (ver REALTIME_SUBSCRIBE_STATES). */
type SubscribeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

/** O pedaço de `RealtimeChannel` que usamos (bivariante por ser método). */
export interface JobsChannel {
    on(
        type: 'postgres_changes',
        filter: { event: string; schema: string; table: string },
        callback: (payload: { new: unknown }) => void
    ): JobsChannel;
    subscribe(onStatus?: (status: SubscribeStatus) => void): JobsChannel;
}

export interface JobsChannelFactory {
    /**
     * Devolve um `JobsChannel`. Tipado como `unknown` de propósito: o
     * `RealtimeChannel` do supabase-js tem `on` sobrecarregado (presence /
     * postgres_changes / broadcast) e não é structuralmente compatível com a
     * nossa interface. A única conversão está em `ensureChannel`, num sítio só.
     */
    channel(topic: string): unknown;
    removeChannel(channel: unknown): unknown;
}

export type JobChangeListener<T> = (row: T) => void;

export interface JobsChannelRegistry<T> {
    /** Subscrição com match próprio; devolve a função de unsubscribe. */
    subscribe(
        matches: (row: T) => boolean,
        onChange: JobChangeListener<T>
    ): () => void;
    /** Nº de listeners activos (diagnóstico/probe). */
    listenerCount(): number;
    /** Há canal vivo neste momento? (diagnóstico/probe). */
    isSubscribed(): boolean;
}

interface RegistryState<T> {
    channel: JobsChannel | null;
    subscriptions: Set<{
        matches: (row: T) => boolean;
        onChange: JobChangeListener<T>;
    }>;
    pendingRemoval: ReturnType<typeof setTimeout> | null;
}

export function createJobsChannelRegistry<T>(
    factory: JobsChannelFactory,
    options?: { onWarning?: (message: string, err?: unknown) => void }
): JobsChannelRegistry<T> {
    const warn =
        options?.onWarning ??
        ((message, err) => console.warn(message, err ?? ''));
    const state: RegistryState<T> = {
        channel: null,
        subscriptions: new Set(),
        pendingRemoval: null,
    };

    /** Cria (ou reutiliza) o canal. `null` = Realtime indisponível (o poll cobre). */
    function ensureChannel(): JobsChannel | null {
        if (state.channel) {
            // Havia um unsubscribe à espera: um listener voltou, cancela o teardown.
            if (state.pendingRemoval) {
                clearTimeout(state.pendingRemoval);
                state.pendingRemoval = null;
            }
            return state.channel;
        }

        try {
            // Única conversão do canal real para a nossa interface (ver
            // `JobsChannelFactory.channel`).
            const channel = factory.channel(
                GENERATION_JOBS_TOPIC
            ) as JobsChannel;
            channel
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'generation_jobs' },
                    (payload) => {
                        const row = payload.new as T;
                        // Snapshot: um listener pode cancelar-se a si próprio
                        // (ou a outro) enquanto despachamos.
                        for (const sub of [...state.subscriptions]) {
                            if (!sub.matches(row)) continue;
                            try {
                                sub.onChange(row);
                            } catch (err) {
                                warn(
                                    '[generation-jobs] listener de realtime falhou:',
                                    err
                                );
                            }
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        // Não é fatal: o poll de ~10s traz o mesmo estado.
                        warn(
                            '[generation-jobs] realtime não subscrito; a usar o poll:',
                            status
                        );
                    }
                });
            state.channel = channel;
            return channel;
        } catch (err) {
            warn(
                '[generation-jobs] subscrição realtime falhou; a UI continua com o poll:',
                err
            );
            return null;
        }
    }

    function release(sub: {
        matches: (row: T) => boolean;
        onChange: JobChangeListener<T>;
    }): void {
        state.subscriptions.delete(sub);
        if (state.subscriptions.size > 0) return;

        state.pendingRemoval = setTimeout(() => {
            // Um listener pode ter voltado entre o unsubscribe e este timer.
            if (state.subscriptions.size === 0 && state.channel) {
                const channel = state.channel;
                state.channel = null;
                try {
                    factory.removeChannel(channel);
                } catch (err) {
                    warn('[generation-jobs] remover o canal falhou:', err);
                }
            }
            state.pendingRemoval = null;
        }, 0);
    }

    return {
        subscribe(matches, onChange) {
            if (!ensureChannel()) {
                // Sem Realtime: devolve um no-op e deixa o poll fazer o trabalho.
                return () => undefined;
            }
            const sub = { matches, onChange };
            state.subscriptions.add(sub);
            return () => release(sub);
        },
        listenerCount() {
            return state.subscriptions.size;
        },
        isSubscribed() {
            return state.channel !== null;
        },
    };
}
