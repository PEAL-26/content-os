import { supabase } from '@/lib/supabase';
import {
    ASSET_MIME_BY_EXTENSION,
    type AssetKind,
    type AssetTargetType,
    type ContentAsset,
} from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// CONTENT ASSETS (artefactos — vários por ARTICLE|PIECE)
// Espelha content_publications: tabela polimórfica sem FK, escrevida pelo
// cliente via supabase-js.
// =============================================================================

export const MAX_ASSET_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_ASSETS_PER_DROP = 10;

/** Tipos aceites no upload. O bucket também aceita outros, mas a grelha e o
 *  lightbox só sabem mostrar imagens, vídeos e ficheiros genéricos. */
const ALLOWED_UPLOAD_MIME_PREFIXES = ['image/', 'video/'];
const ALLOWED_UPLOAD_MIME_EXACT = new Set(['application/pdf']);

export interface CreateAssetInput {
    workspaceId: string;
    targetType: AssetTargetType;
    targetId: string;
    url: string;
    name?: string | null;
    mimeType?: string | null;
}

export interface FileValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * Valida um ficheiro antes do upload. É UX, não segurança: um utilizador pode
 * contornar no browser. Impor limites reais no bucket do Supabase continua em
 * aberto.
 *
 * Chamado por `uploadAssetFile` (e não só pelo plural) para que TODO o caminho
 * de upload passe por aqui — o "marcar publicado" do planeador carrega um
 * ficheiro sozinho e não usa o plural.
 */
export function validateAssetFile(file: File): FileValidationResult {
    const mime = file.type || '';
    const allowed =
        ALLOWED_UPLOAD_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ||
        ALLOWED_UPLOAD_MIME_EXACT.has(mime);

    if (!allowed) {
        return {
            valid: false,
            reason: mime
                ? `Tipo não suportado (${mime})`
                : 'Tipo de ficheiro não reconhecido',
        };
    }

    if (file.size > MAX_ASSET_FILE_SIZE) {
        const mb = Math.round(MAX_ASSET_FILE_SIZE / (1024 * 1024));
        return {
            valid: false,
            reason: `Excede ${mb} MB (tem ${Math.round(file.size / (1024 * 1024))} MB)`,
        };
    }

    return { valid: true };
}

/**
 * Extensão a partir do URL, ignorando query string. Ancoramos no ÚLTIMO ponto
 * para não partir o "https://" nem o host.
 */
export function extensionFromUrl(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    const lastSegment = path.split('/').pop() ?? '';
    const dot = lastSegment.lastIndexOf('.');
    if (dot <= 0 || dot === lastSegment.length - 1) return '';
    return lastSegment.slice(dot + 1).toLowerCase();
}

/**
 * MIME a partir da extensão do URL; null se não for reconhecido.
 *
 * O `Object.hasOwn` é obrigatório: sem ele, "https://x/a.constructor" devolvia
 * o construtor de `Object` (herdado da cadeia de protótipos) e
 * "https://x/a.__proto__" devolvia um objeto — `assetKind` rebentava a seguir
 * com `.startsWith is not a function`.
 */
export function sniffMimeType(url: string): string | null {
    const ext = extensionFromUrl(url);
    if (!Object.hasOwn(ASSET_MIME_BY_EXTENSION, ext)) return null;
    return ASSET_MIME_BY_EXTENSION[ext] ?? null;
}

/** Como o painel desenha o artefacto: miniatura, player, ou ficheiro. */
export function assetKind(mimeType: string | null | undefined): AssetKind {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'file';
}

/**
 * Só aceita http(s). Um link externo é renderizado como href e como src do
 * lightbox — sem esta validação, um `javascript:` seria executado ao clicar.
 */
export function isSafeExternalUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export interface AssetUploadResult {
    url: string;
    name: string;
    mimeType: string;
}

/**
 * Faz upload de um ficheiro para o bucket "assets".
 *
 * Valida o ficheiro (tipo + tamanho) e lança se não passar: este é o único
 * ponto de upload para ficheiros locais, por isso a validação vive aqui e não
 * em cada caller.
 *
 * O sufixo aleatório evita a colisão que `Date.now()` produzia: com uploads
 * paralelos (Promise.all), dois ficheiros com o mesmo nome carregados no mesmo
 * milissegundo colidiam — e o bucket está com `upsert: false`, ou seja, a
 * colisão lançava erro em vez de sobrescrever.
 */
export async function uploadAssetFile(
    file: File,
    folder: string
): Promise<AssetUploadResult> {
    const validation = validateAssetFile(file);
    if (!validation.valid) {
        throw new Error(validation.reason ?? 'Ficheiro inválido');
    }

    const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .slice(0, 80);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${folder}/${unique}-${safeName}`;

    const { error } = await supabase.storage
        .from('assets')
        .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) {
        throw new Error(`Erro ao carregar artefacto: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
        .from('assets')
        .getPublicUrl(path);

    return {
        url: publicUrlData.publicUrl,
        name: file.name,
        mimeType: file.type || sniffMimeType(publicUrlData.publicUrl) || '',
    };
}

/**
 * Upload paralelo de vários ficheiros. Um erro por ficheiro não cancela os
 * outros — cada um é reportado individualmente. A validação (tipo/tamanho) está
 * dentro de `uploadAssetFile`; aqui só se converte o erro em entrada de
 * resultado, para que um ficheiro mau não leve os restantes atrás.
 */
export async function uploadAssetFiles(
    files: File[],
    folder: string
): Promise<Array<{ file: File; result?: AssetUploadResult; error?: string }>> {
    return Promise.all(
        files.map(async (file) => {
            try {
                const result = await uploadAssetFile(file, folder);
                return { file, result };
            } catch (err) {
                return {
                    file,
                    error:
                        err instanceof Error
                            ? err.message
                            : 'Erro ao carregar artefacto',
                };
            }
        })
    );
}

export const assetService = {
    /** Artefactos de uma entidade, mais recentes primeiro. */
    async getAssets(
        workspaceId: string,
        targetType: AssetTargetType,
        targetId: string
    ): Promise<ContentAsset[]> {
        const { data, error } = await supabase
            .from('content_assets')
            .select('*')
            .eq('workspaceId', workspaceId)
            .eq('targetType', targetType)
            .eq('targetId', targetId)
            .order('createdAt', { ascending: false });

        if (error) {
            throw new Error(`Erro ao buscar artefactos: ${error.message}`);
        }

        return (data ?? []) as ContentAsset[];
    },

    /** Cria um artefacto (permite vários por target). */
    async createAsset(input: CreateAssetInput): Promise<ContentAsset> {
        const { data, error } = await supabase
            .from('content_assets')
            .insert({
                id: uuidv4(),
                workspaceId: input.workspaceId,
                targetType: input.targetType,
                targetId: input.targetId,
                url: input.url,
                name: input.name ?? null,
                mimeType: input.mimeType ?? sniffMimeType(input.url),
                createdAt: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao guardar artefacto: ${error.message}`);
        }

        return data as ContentAsset;
    },

    /** Apaga um artefacto. Só dentro do próprio workspace (RLS está desligado). */
    async deleteAsset(workspaceId: string, id: string): Promise<void> {
        const { error } = await supabase
            .from('content_assets')
            .delete()
            .eq('id', id)
            .eq('workspaceId', workspaceId);

        if (error) {
            throw new Error(`Erro ao remover artefacto: ${error.message}`);
        }
    },
};

/** Pasta no bucket onde o utilizador carrega artefactos. */
const ASSETS_FOLDER = 'assets';

export interface CreateFromFilesResult {
    created: ContentAsset[];
    /** Um erro por ficheiro recusado/falhado; o resto do carregamento segue. */
    errors: { name: string; message: string }[];
}

/**
 * Orquestra um carregamento de vários ficheiros: limita ao máximo por
 * carregamento, valida, carrega em paralelo e cria uma linha em content_assets
 * por ficheiro (mimeType do upload, ou inferido do URL).
 *
 * Um ficheiro recusado não interrompe os restantes — o erro é recolhido em
 * `errors` (com o nome do ficheiro). `created` sai ordenado por createdAt DESC,
 * que é a ordem usada pela grelha de artefactos.
 */
export async function createFromFiles(
    workspaceId: string,
    targetType: AssetTargetType,
    targetId: string,
    files: File[]
): Promise<CreateFromFilesResult> {
    const errors: { name: string; message: string }[] = [];

    const accepted = files.slice(0, MAX_ASSETS_PER_DROP);
    const ignored = files.length - accepted.length;
    if (ignored > 0) {
        errors.push({
            name: 'Limite por carregamento',
            message: `Máximo de ${MAX_ASSETS_PER_DROP} ficheiros por carregamento; ${ignored} ignorado(s).`,
        });
    }

    if (accepted.length === 0) {
        return { created: [], errors };
    }

    // A validação (tipo/tamanho) e o try/catch por ficheiro estão dentro de
    // uploadAssetFiles: um ficheiro mau não leva os restantes atrás.
    const results = await uploadAssetFiles(accepted, ASSETS_FOLDER);

    const created: ContentAsset[] = [];
    await Promise.all(
        results.map(async (result) => {
            if (!result.result) {
                errors.push({
                    name: result.file.name,
                    message: result.error ?? 'Erro ao carregar artefacto',
                });
                return;
            }

            try {
                created.push(
                    await assetService.createAsset({
                        workspaceId,
                        targetType,
                        targetId,
                        url: result.result.url,
                        name: result.result.name,
                        // '' quando o browser não dá o tipo: createAsset
                        // responde com sniffMimeType(url).
                        mimeType: result.result.mimeType || null,
                    })
                );
            } catch (err) {
                errors.push({
                    name: result.file.name,
                    message:
                        err instanceof Error
                            ? err.message
                            : 'Erro ao guardar artefacto',
                });
            }
        })
    );

    created.sort(
        (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { created, errors };
}

/**
 * Apaga todos os artefactos de uma entidade. `content_assets` é polimórfica e
 * não tem FK, portanto apagar a entidade deixava as linhas órfãs — invisíveis
 * para a grelha, mas a ocupar espaço (e com o ficheiro no bucket).
 */
export async function deleteAssetsForTarget(
    workspaceId: string,
    targetType: AssetTargetType,
    targetId: string
): Promise<void> {
    const { error } = await supabase
        .from('content_assets')
        .delete()
        .eq('workspaceId', workspaceId)
        .eq('targetType', targetType)
        .eq('targetId', targetId);

    if (error) {
        throw new Error(`Erro ao remover artefactos: ${error.message}`);
    }
}