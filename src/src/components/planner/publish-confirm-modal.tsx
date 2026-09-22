import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink, Calendar, Upload } from 'lucide-react';

const PLATFORM_OPTIONS = [
    { value: 'LINKEDIN', label: 'LinkedIn' },
    { value: 'INSTAGRAM', label: 'Instagram' },
    { value: 'TIKTOK', label: 'TikTok' },
    { value: 'YOUTUBE', label: 'YouTube' },
    { value: 'X_TWITTER', label: 'X (Twitter)' },
    { value: 'FACEBOOK', label: 'Facebook' },
    { value: 'outros', label: 'Outros' },
];

export interface PublishData {
    platform: string;
    publishedUrl?: string;
    publishedAt: Date;
    /** Ficheiro do artefacto publicado (upload para Storage feito pelo chamador). */
    assetFile?: File | null;
}

interface PublishConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: PublishData) => void;
    itemTitle: string;
    scheduledTime: Date;
    isLoading?: boolean;
    disableAssetUpload?: boolean;
}

export function PublishConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    itemTitle,
    isLoading = false,
    disableAssetUpload = false,
}: PublishConfirmModalProps) {
    const [platform, setPlatform] = useState('LINKEDIN');
    const [publishedUrl, setPublishedUrl] = useState('');
    const [publishedDate, setPublishedDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [publishedTime, setPublishedTime] = useState(
        new Date().toTimeString().slice(0, 5)
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Confirmar publicação"
            size="md"
        >
            <div className="space-y-4">
                <div className="rounded-lg bg-green-50 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                            <Check className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">
                                Publicar conteúdo
                            </h4>
                            <p className="mt-1 text-sm text-gray-600">
                                {itemTitle}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Plataforma *
                        </label>
                        <select
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
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
                                onChange={(e) =>
                                    setPublishedDate(e.target.value)
                                }
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <input
                                type="time"
                                value={publishedTime}
                                onChange={(e) =>
                                    setPublishedTime(e.target.value)
                                }
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Pré-preenchido com a data/hora actual. Ajuste se a
                            publicação foi feita noutro momento.
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
                            Link directo para o post publicado. Útil para
                            tracking.
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
                                (screenshot, PDF, ficheiro de imagem). É
                                carregado para o Storage do projeto.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                A publicar...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" />
                                Confirmar publicação
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}