// =============================================================================
// Sonda ao registry do canal de `generation_jobs`, sem browser e sem websocket.
//
// Reproduz a regra que matava a página de peças: o `supabase.channel(topic)`
// devolve o canal já existente quando o topic repete, e o realtime-js recusa um
// `.on()` em cima de um canal já *subscribed*:
//
//   cannot add `postgres_changes` callbacks for realtime:generation-jobs-<id>
//   after `subscribe()`.
//
// O `FakeChannel` abaixo implementa essa regra (e o `FakeFactory` o reuso por
// topic), pelo que a implementação antiga — um canal por conjunto de targets —
// rebentava aqui, e a actual (um canal só, com ref-count) passa.
//
// Uso: npx tsx scripts/probe-generation-jobs-channel.ts
// =============================================================================

import {
    createJobsChannelRegistry,
    GENERATION_JOBS_TOPIC,
    type JobsChannel,
    type SubscribeStatus,
} from '../src/services/generation-jobs-channel.js';

type Row = { id: string; targetId: string | null; status: string };

/** Espelho do `RealtimeChannel.on` + `subscribe` nas duas regras que importam. */
class FakeChannel implements JobsChannel {
    joined = false;
    private bindings: Array<(payload: { new: unknown }) => void> = [];

    constructor(public topic: string) {}

    on(
        type: 'postgres_changes',
        _filter: { event: string; schema: string; table: string },
        callback: (payload: { new: unknown }) => void
    ): JobsChannel {
        if (this.joined) {
            // A mesma mensagem (e a mesma excepção) do realtime-js.
            throw new Error(
                `cannot add \`${type}\` callbacks for realtime:${this.topic} after \`subscribe()\`.`
            );
        }
        this.bindings.push(callback);
        return this;
    }

    subscribe(onStatus?: (status: SubscribeStatus) => void): JobsChannel {
        this.joined = true;
        onStatus?.('SUBSCRIBED');
        return this;
    }

    /** Simula um evento do Postgres (o `payload.new` de um UPDATE/INSERT). */
    emit(row: Row): void {
        for (const binding of [...this.bindings]) binding({ new: row });
    }
}

/** Espelho do `RealtimeClient`: cria uma vez por topic, reutiliza depois. */
class FakeFactory {
    created: FakeChannel[] = [];
    removed: FakeChannel[] = [];
    private byTopic = new Map<string, FakeChannel>();
    /** Quando true, o `channel()` atira (realtime indisponível/hostil). */
    failOnChannel = false;

    channel(topic: string): unknown {
        if (this.failOnChannel) throw new Error('realtime indisponível');
        const existing = this.byTopic.get(topic);
        if (existing) return existing;
        const channel = new FakeChannel(topic);
        this.byTopic.set(topic, channel);
        this.created.push(channel);
        return channel;
    }

    removeChannel(channel: unknown): unknown {
        if (channel instanceof FakeChannel) {
            this.byTopic.delete(channel.topic);
            this.removed.push(channel);
        }
        return undefined;
    }
}

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures += 1;
    console.log(
        `  ${ok ? 'OK  ' : 'FALHA'} ${label}: ${JSON.stringify(actual)}`
    );
    if (!ok) console.log(`       esperado: ${JSON.stringify(expected)}`);
}

/** O registry adia a remoção para o fim do tick — damos-lhe esse tempo. */
function tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

// -----------------------------------------------------------------------------
// 1. Dois subscritores do MESMO conjunto de targets (o caso da página de peças)
// -----------------------------------------------------------------------------
console.log('1. dois subscritores do mesmo alvo, em simultâneo');
{
    const factory = new FakeFactory();
    const registry = createJobsChannelRegistry<Row>(factory);

    const receivedA: Row[] = [];
    const receivedB: Row[] = [];
    const articleId = 'article-1';

    // O primeiro não pode rebentar: subscreve primeiro e fica joined.
    const unsubA = registry.subscribe(
        (row) => row.targetId === articleId,
        (row) => receivedA.push(row)
    );
    const unsubB = registry.subscribe(
        (row) => row.targetId === articleId,
        (row) => receivedB.push(row)
    );

    check(
        'topic único e constante',
        factory.created.map((c) => c.topic),
        [GENERATION_JOBS_TOPIC]
    );
    check('apenas um canal criado', factory.created.length, 1);
    check('dois listeners activos', registry.listenerCount(), 2);

    factory.created[0]!.emit({
        id: 'job-1',
        targetId: articleId,
        status: 'RUNNING',
    });
    check(
        'ambos receberam o job',
        [receivedA.length, receivedB.length],
        [1, 1]
    );

    unsubA();
    check('ainda subscrito (ref-count 1)', registry.isSubscribed(), true);
    check('canal não removido', factory.removed.length, 0);

    unsubB();
    await tick();
    check('último listener remove o canal', factory.removed.length, 1);
    check('registry sem canal', registry.isSubscribed(), false);
}

// -----------------------------------------------------------------------------
// 2. Match por jobId e por targetIds não se misturam
// -----------------------------------------------------------------------------
console.log('\n2. dispatch só vai a quem corresponde');
{
    const factory = new FakeFactory();
    const registry = createJobsChannelRegistry<Row>(factory);

    const byId: Row[] = [];
    const byTarget: Row[] = [];
    registry.subscribe(
        (row) => row.id === 'job-1',
        (row) => byId.push(row)
    );
    registry.subscribe(
        (row) => row.targetId === 'piece-9',
        (row) => byTarget.push(row)
    );

    const channel = factory.created[0]!;
    channel.emit({ id: 'job-1', targetId: 'article-1', status: 'QUEUED' });
    check('match por id recebeu', byId.length, 1);
    check('match por target NÃO recebeu', byTarget.length, 0);

    channel.emit({ id: 'job-2', targetId: 'piece-9', status: 'COMPLETED' });
    check('match por target recebeu', byTarget.length, 1);
    check('match por id continua com 1', byId.length, 1);
}

// -----------------------------------------------------------------------------
// 3. Remount no mesmo tick não paga um ciclo de teardown (StrictMode)
// -----------------------------------------------------------------------------
console.log('\n3. unmount + mount no mesmo tick');
{
    const factory = new FakeFactory();
    const registry = createJobsChannelRegistry<Row>(factory);

    const first = registry.subscribe(
        () => true,
        () => undefined
    );
    first();
    const second = registry.subscribe(
        () => true,
        () => undefined
    );
    await tick();

    check('continua subscrito', registry.isSubscribed(), true);
    check('nenhum canal removido', factory.removed.length, 0);
    check('apenas um canal em todo o tempo', factory.created.length, 1);

    second();
    await tick();
    check('agora sim remove', factory.removed.length, 1);
}

// -----------------------------------------------------------------------------
// 4. Realtime indisponível não pode rebentar a subscrição
// -----------------------------------------------------------------------------
console.log('4. realtime indisponível');
{
    const factory = new FakeFactory();
    factory.failOnChannel = true;
    const warnings: string[] = [];
    const registry = createJobsChannelRegistry<Row>(factory, {
        onWarning: (message) => warnings.push(message),
    });

    let unsubOk = false;
    try {
        const unsub = registry.subscribe(
            () => true,
            () => undefined
        );
        unsubOk = typeof unsub === 'function';
        unsub();
        check('subscribe devolveu no-op', unsubOk, true);
        check('não subscreveu nada', registry.isSubscribed(), false);
        check('aviso emitido', warnings.length > 0, true);
    } catch (err) {
        check('subscribe NÃO devia rebentar', String(err), 'sem throw');
    }
}

// -----------------------------------------------------------------------------
// 5. Um listener que rebenta não leva os outros (nem a app) com ele
// -----------------------------------------------------------------------------
console.log('\n5. listener que rebenta');
{
    const factory = new FakeFactory();
    const warnings: string[] = [];
    const registry = createJobsChannelRegistry<Row>(factory, {
        onWarning: (message) => warnings.push(message),
    });

    const survived: Row[] = [];
    registry.subscribe(
        () => true,
        () => {
            throw new Error('listener rebentou');
        }
    );
    registry.subscribe(
        () => true,
        (row) => survived.push(row)
    );

    factory.created[0]!.emit({
        id: 'job-1',
        targetId: null,
        status: 'RUNNING',
    });
    check('o outro listener recebeu na mesma', survived.length, 1);
    check('aviso emitido', warnings.length, 1);
}

console.log(
    failures === 0
        ? '\n[probe] OK — o canal único com ref-count não tem colisões nem furos.'
        : `\n[probe] ${failures} verificação(ões) falharam.`
);
process.exit(failures === 0 ? 0 : 1);
