import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ChannelBadge } from '@/components/channels/channel-badge';
import { PillarBadge } from '@/components/content/pillar-badge';
import {
    PublishForm,
    type PublishData,
} from '@/components/planner/publish-form';
import { channelService } from '@/services/channel.service';
import { pillarService } from '@/services/pillar.service';
import type { PillarConfig } from '@/types/pillar';
import type { ChannelConfig } from '@/types/database';
import type { PlanItemWithRelations } from '@/services/weekly-plan.service';
import type { ContentPillar } from '@/types/database';
import { getDayName, getPillarLabel } from '@/lib/date-utils';
import { CONTENT_FORMAT_EMOJIS } from '@/helpers/content-format';
import { Calendar, Clock, Save, Trash2 } from 'lucide-react';

export interface PlanItemUpdate {
    scheduledFor?: Date;
    channelId?: string | null;
    pillarId?: string | null;
    notes?: string | null;
}

interface PlanItemModalProps {
    isOpen: boolean;
    item: PlanItemWithRelations | null;
    workspaceId: string;
    onClose: () => void;
    onSave: (
        updates: PlanItemUpdate,
        isNew?: boolean
    ) => Promise<boolean> | boolean;
    onPublish: (data: PublishData) => Promise<boolean> | boolean;
    onRemove: () => Promise<boolean> | boolean;
    isSaving?: boolean;
    isPublishing?: boolean;
    isRemoving?: boolean;
}

function toDateInput(d: Date): string {
    return d.toISOString().split('T')[0];
}

function toTimeInput(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
    ).padStart(2, '0')}`;
}

/**
 * Modal único para editar **e** publicar um item do plano.
 *
 * Existe porque o card é demasiado compacto para ter acções: clicar nele abre
 * isto, e tudo o que se pode fazer a um item faz-se aqui.
 *
 * Só há uma coisa que este modal NÃO deixa fazer — trocar o conteúdo
 * subjacente (o artigo ou peça ligado). Isso mudaria a natureza do item; para
 * o fazer, remove-se e agenda-se de novo.
 *
 * O `dayOfWeek` não é editável: deriva de `scheduledFor`. Mudar a data aqui
 * move o item para outra coluna da grelha sem risco de drift.
 */
export function PlanItemModal({
    isOpen,
    item,
    workspaceId,
    onClose,
    onSave,
    onPublish,
    onRemove,
    isSaving = false,
    isPublishing = false,
    isRemoving = false,
}: PlanItemModalProps) {
    const [channels, setChannels] = useState<ChannelConfig[]>([]);
    const [pillars, setPillars] = useState<PillarConfig[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [channelId, setChannelId] = useState('');
    const [pillarId, setPillarId] = useState('');
    const [notes, setNotes] = useState('');

    const [showConfirmRemove, setShowConfirmRemove] = useState(false);

    // Ao abrir (ou mudar de item), sincroniza o formulário com o item.
    useEffect(() => {
        if (!isOpen || !item) return;

        const scheduled = new Date(item.scheduledFor);
        setDate(toDateInput(scheduled));
        setTime(toTimeInput(scheduled));
        setChannelId(item.channelId ?? '');
        setPillarId(item.pillarId ?? '');
        setNotes(item.notes ?? '');
        setShowConfirmRemove(false);
    }, [isOpen, item]);

    const loadData = useCallback(async () => {
        if (!workspaceId) return;
        setIsLoadingData(true);
        try {
            const [channelsData, pillarsData] = await Promise.all([
                channelService.getChannels(workspaceId),
                pillarService.getPillars(workspaceId),
            ]);
            setChannels(channelsData.filter((c) => c.isActive));
            setPillars(pillarsData.filter((p) => p.isActive));
        } catch (error) {
            console.error('Erro ao carregar canais/pilares:', error);
        } finally {
            setIsLoadingData(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, loadData]);

    if (!item) return null;

    const isPublished = item.status === 'PUBLISHED';
    const isSkipped = item.status === 'SKIPPED';

    const scheduled = new Date(item.scheduledFor);
    const dayOfWeek = scheduled.getDay() === 0 ? 7 : scheduled.getDay();

    const title = item.contentPiece
        ? item.contentPiece.title || `Post ${item.contentPiece.format}`
        : item.article
          ? item.article.title
          : item.product
            ? item.product.name
            : 'Item';

    const formatIcon = item.contentPiece?.format
        ? CONTENT_FORMAT_EMOJIS[item.contentPiece.format] || '📄'
        : '📄';

    const handleSave = async () => {
        const scheduledFor = new Date(`${date}T${time}`);
        if (Number.isNaN(scheduledFor.getTime())) return;

        await onSave({
            scheduledFor,
            channelId: channelId || null,
            pillarId: pillarId || null,
            notes: notes || null,
        });
    };

    const handleRemove = async () => {
        const ok = await onRemove();
        if (ok) {
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Item agendado"
            size="lg"
        >
            <div className="space-y-5">
                {/* Cabeçalho: o que é este item */}
                <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-4">
                    <span className="text-2xl">{formatIcon}</span>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {item.channel && (
                                <ChannelBadge
                                    channel={item.channel.channel}
                                    size="sm"
                                    showLabel={true}
                                />
                            )}
                            {item.pillar?.pillar && (
                                <PillarBadge
                                    pillar={
                                        item.pillar.pillar as ContentPillar
                                    }
                                    size="sm"
                                />
                            )}
                        </div>
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            {getDayName(dayOfWeek)},{' '}
                            {scheduled.toLocaleDateString('pt-PT', {
                                day: '2-digit',
                                month: 'long',
                            })}
                        </p>
                    </div>
                    {isPublished && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                            Publicado
                        </span>
                    )}
                    {isSkipped && (
                        <span className="shrink-0 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
                            Ignorado
                        </span>
                    )}
                </div>

                {/* Agendamento */}
                <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                        Agendamento
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                                Data
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                                <Clock className="mr-1 inline h-3 w-3" />
                                Hora
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <p className="text-xs text-gray-500">
                        Mudar a data move o item para outra coluna da grelha.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                                Canal alvo
                            </label>
                            <select
                                value={channelId}
                                onChange={(e) =>
                                    setChannelId(e.target.value)
                                }
                                disabled={isLoadingData}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                            >
                                <option value="">Sem canal</option>
                                {channels.map((channel) => (
                                    <option
                                        key={channel.id}
                                        value={channel.id}
                                    >
                                        {channel.channel}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                                Pilar
                            </label>
                            <select
                                value={pillarId}
                                onChange={(e) => setPillarId(e.target.value)}
                                disabled={isLoadingData}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                            >
                                <option value="">Sem pilar</option>
                                {pillars.map((pillar) => (
                                    <option key={pillar.id} value={pillar.id}>
                                        {getPillarLabel(pillar.pillar)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                            Notas
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas internas sobre este agendamento..."
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </section>

                {/* Publicação */}
                <section className="space-y-3 border-t border-gray-200 pt-5">
                    <h3 className="text-sm font-semibold text-gray-900">
                        Publicação
                    </h3>
                    {isPublished && item.publishedAt ? (
                        <div className="space-y-3">
                            <div className="rounded-lg bg-green-50 p-3">
                                <p className="text-sm text-green-800">
                                    Publicado a{' '}
                                    {new Date(
                                        item.publishedAt
                                    ).toLocaleString('pt-PT', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                    .
                                </p>
                                {item.publishedUrl && (
                                    <a
                                        href={item.publishedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1 inline-block text-xs text-green-700 underline hover:text-green-800"
                                    >
                                        {item.publishedUrl}
                                    </a>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">
                                Podes registar outra publicação (outra
                                plataforma) sem perder esta.
                            </p>
                            <PublishForm
                                onConfirm={onPublish}
                                isLoading={isPublishing}
                                confirmLabel="Registar outra publicação"
                                initialDate={new Date(item.publishedAt)}
                            />
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-gray-500">
                                Marca o item como publicado quando o conteúdo
                                sair. Podes indicar a plataforma, o link e
                                anexar o artefacto.
                            </p>
                            <PublishForm
                                onConfirm={onPublish}
                                isLoading={isPublishing}
                                disableAssetUpload={
                                    !item.contentPieceId && !item.articleId
                                }
                                confirmLabel="Marcar como publicado"
                            />
                        </>
                    )}
                </section>

                {/* Acções */}
                <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
                    {showConfirmRemove ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-red-700">
                                Remover do planeamento?
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowConfirmRemove(false)}
                                disabled={isRemoving}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleRemove}
                                disabled={isRemoving}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {isRemoving
                                    ? 'A remover...'
                                    : 'Remover mesmo'}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowConfirmRemove(true)}
                            className="text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            {isPublished ? 'Arquivar' : 'Remover'}
                        </Button>
                    )}

                    <Button
                        onClick={handleSave}
                        disabled={isSaving || isLoadingData}
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? 'A guardar...' : 'Guardar alterações'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}