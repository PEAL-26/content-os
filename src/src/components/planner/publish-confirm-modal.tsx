import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink, Calendar } from 'lucide-react';

interface PublishConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { publishedUrl?: string; publishedAt: Date }) => void;
    itemTitle: string;
    scheduledTime: Date;
    isLoading?: boolean;
}

export function PublishConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    itemTitle,
    isLoading = false,
}: PublishConfirmModalProps) {
    const [publishedUrl, setPublishedUrl] = useState('');
    const [publishedDate, setPublishedDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [publishedTime, setPublishedTime] = useState(
        new Date().toTimeString().slice(0, 5)
    );

    const handleConfirm = () => {
        const publishedAt = new Date(`${publishedDate}T${publishedTime}`);
        onConfirm({
            publishedUrl: publishedUrl || undefined,
            publishedAt,
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
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} isLoading={isLoading}>
                        <Check className="h-4 w-4" />
                        Confirmar publicação
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
