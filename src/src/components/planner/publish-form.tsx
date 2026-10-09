import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink, Calendar, Upload } from 'lucide-react';
import {
    DEFAULT_PUBLICATION_PLATFORM,
    PUBLICATION_PLATFORMS,
    toPublicationPlatform,
} from '@/services/publication-platforms';
import type { SocialChannel } from '@/types/database';

const PLATFORM_OPTIONS = PUBLICATION_PLATFORMS;

export interface PublishData {
    /**
     * O enum `SocialChannel`, não `string`: a coluna `platform` deixou de ser
     * texto livre (Decisão 34) e um `string` aqui deixava passar um valor fora
     * do enum até ao insert.
     */
    platform: SocialChannel;
    publishedUrl?: string;
    publishedAt: Date;
    /** Ficheiro do artefacto publicado (upload para Storage feito pelo chamador). */
    assetFile?: File | null;
}

interface PublishFormProps {
    onConfirm: (data: PublishData) => void;
    isLoading?: boolean;
    disableAssetUpload?: boolean;
    /** Acção do botão principal. Oculta o botão em modo "já publicado". */
    confirmLabel?: string;
    /** Pre-preenche a data/hora real. Por omissão, agora. */
    initialDate?: Date;
}

/**
 * Campos de confirmação de publicação, **sem** o wrapper `Modal`.
 *
 * Vivem dentro do `PlanItemModal` para que editar e publicar sejam um só
 * passo, sem modal sobre modal (que trazia problemas de z-index, foco e
 * scroll). O `Modal` original foi eliminado: o dashboard nunca o usou, chama
 * `markItemPublished` directamente.
 */
export function PublishForm({
    onConfirm,
    isLoading = false,
    disableAssetUpload = false,
    confirmLabel = 'Confirmar publicação',
    initialDate,
}: PublishFormProps) {
    const base = initialDate ?? new Date();
    const [platform, setPlatform] =
        useState<SocialChannel>(DEFAULT_PUBLICATION_PLATFORM);
    const [publishedUrl, setPublishedUrl] = useState('');
    const [publishedDate, setPublishedDate] = useState(
        base.toISOString().split('T')[0]
    );
    const [publishedTime, setPublishedTime] = useState(
        base.toTimeString().slice(0, 5)
    );
    const [assetFile, setAssetFile] = useState<File | null>(null);

    const handleConfirm = () => {
        const publishedAt = new Date(`${publishedDate}T${publishedTime}`);
        onConfirm({
            platform,
            publishedUrl: publishedUrl || undefined,
            publishedAt,
            assetFile,
        });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Plataforma *
                </label>
                <select
                    value={platform}
                    onChange={(e) =>
                            setPlatform(toPublicationPlatform(e.target.value))
                        }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {PLATFORM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                    Podes marcar a mesma peça como publicada em várias
                    plataformas — cada confirmação cria uma publicação.
                </p>
            </div>

            <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    <Calendar className="mr-1 inline h-4 w-4" />
                    Data e hora real de publicação
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <input
                        type="date"
                        value={publishedDate}
                        onChange={(e) => setPublishedDate(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                        type="time"
                        value={publishedTime}
                        onChange={(e) => setPublishedTime(e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                    Pré-preenchido com a data/hora actual. Ajuste se a publicação
                    foi feita noutro momento.
                </p>
            </div>

            <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    <ExternalLink className="mr-1 inline h-4 w-4" />
                    URL do post (opcional)
                </label>
                <input
                    type="url"
                    value={publishedUrl}
                    onChange={(e) => setPublishedUrl(e.target.value)}
                    placeholder="https://linkedin.com/posts/..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Link directo para o post publicado. Útil para tracking.
                </p>
            </div>

            {!disableAssetUpload && (
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        <Upload className="mr-1 inline h-4 w-4" />
                        Artefacto (opcional)
                    </label>
                    <input
                        type="file"
                        onChange={(e) =>
                            setAssetFile(e.target.files?.[0] ?? null)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Aponta para o ficheiro do artefacto publicado
                        (screenshot, PDF, ficheiro de imagem). É carregado para
                        o Storage do projecto.
                    </p>
                </div>
            )}

            <div className="flex justify-end">
                <Button onClick={handleConfirm} disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            A publicar...
                        </>
                    ) : (
                        <>
                            <Check className="h-4 w-4" />
                            {confirmLabel}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}