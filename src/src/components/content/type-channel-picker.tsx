import {
    ALL_CONTENT_FORMATS,
    getFormatEmoji,
} from '@/helpers/content-format';
import {
    CHANNEL_LABELS,
    CONTENT_FORMAT_LABELS,
    type ChannelConfig,
    type ContentFormat,
    type MediaModality,
} from '@/types/database';
import {
    channelSupportsType,
    sortTypesByFit,
} from '@/lib/platform-rules';
import { MEDIA_MODALITIES, MEDIA_MODALITY_LABELS } from '@/types/database';

interface TypeChannelPickerProps {
    /** Canais do workspace. Só os activos são mostrados (Decisão 15). */
    channels: ChannelConfig[];
    selectedChannelIds: string[];
    onToggleChannel: (channelId: string) => void;
    selectedFormats: Set<ContentFormat>;
    onToggleFormat: (format: ContentFormat) => void;
    /** Modalidades com prompt de media gerado automaticamente. */
    selectedModalities: string[];
    onToggleModality: (modality: string) => void;
    disabled?: boolean;
}

/**
 * Picker canal → tipo.
 *
 * A ordem é deliberadamente o inverso do que existia. Antes era "marca o
 * formato, e o select de canal aparece ao lado" — e como o prompt era escolhido
 * pelo formato, com a plataforma escrita à mão dentro dele, essa ordem era
 * exactamente o que permitia pedir "Post LinkedIn" e escolher Instagram como
 * canal, recebendo conteúdo de LinkedIn.
 *
 * Escolhendo o canal primeiro, os tipos ficam ordenados por adequação real
 * (`sortTypesByFit`) e o aviso aparece antes de gerar. Nada é bloqueado: um
 * tipo não nativo aparece no fim, com aviso, e o bloco de plataforma diz à IA
 * como adaptar.
 */
export function TypeChannelPicker({
    channels,
    selectedChannelIds,
    onToggleChannel,
    selectedFormats,
    onToggleFormat,
    selectedModalities,
    onToggleModality,
    disabled = false,
}: TypeChannelPickerProps) {
    const activeChannels = channels.filter((c) => c.isActive);

    /**
     * Um só canal é o caso comum: os tipos podem ser ordenados por ele. Com
     * vários canais, usa-se o primeiro escolhido como referência da ordenação —
     * a ordem é cosmeticamente para o tipo aparecer primeiro.
     */
    const referenceChannel =
        activeChannels.find((c) => c.id === selectedChannelIds[0]) ??
        activeChannels[0];

    const orderedTypes = referenceChannel
        ? sortTypesByFit(referenceChannel.channel, ALL_CONTENT_FORMATS)
        : [...ALL_CONTENT_FORMATS];

    const totalPieces = selectedFormats.size * Math.max(selectedChannelIds.length, 0);

    if (activeChannels.length === 0) {
        return (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Não tens canais <strong>activos</strong>. Activa um canal em{' '}
                <strong>Definições → Canais</strong> para poderes gerar peças.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Passo 1 — canais */}
            <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                    1. Onde vai ser publicado?
                </h3>
                <div className="flex flex-wrap gap-2">
                    {activeChannels.map((channel) => {
                        const isSelected = selectedChannelIds.includes(channel.id);
                        return (
                            <label
                                key={channel.id}
                                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    isSelected
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onToggleChannel(channel.id)}
                                    disabled={disabled}
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                {channel.isPrimary && <span title="Canal principal">★</span>}
                                {CHANNEL_LABELS[channel.channel]}
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Passo 2 — tipos */}
            <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                    2. Que tipo de peça?
                </h3>
                <div className="space-y-2">
                    {orderedTypes.map((format) => {
                        const isSelected = selectedFormats.has(format);
                        // `true` quando não há canal escolhido: o aviso faria
                        // sentido falso para todos os tipos.
                        const isNative =
                            !referenceChannel ||
                            channelSupportsType(referenceChannel.channel, format);

                        return (
                            <div
                                key={format}
                                className="flex min-h-10 items-center gap-3 rounded-md border border-gray-200 p-3"
                            >
                                <input
                                    type="checkbox"
                                    id={`format-${format}`}
                                    checked={isSelected}
                                    onChange={() => onToggleFormat(format)}
                                    disabled={disabled}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label
                                    htmlFor={`format-${format}`}
                                    className="flex flex-1 cursor-pointer items-center text-sm"
                                >
                                    <span className="mr-2">{getFormatEmoji(format)}</span>
                                    {CONTENT_FORMAT_LABELS[format]}
                                    {!isNative && (
                                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                            não nativo neste canal — a IA vai adaptar
                                        </span>
                                    )}
                                </label>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Passo 3 — modalidades (opcional) */}
            <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                    3. Gerar também prompts de media?{' '}
                    <span className="font-normal text-gray-500">(opcional)</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                    {MEDIA_MODALITIES.map((modality: MediaModality) => {
                        const isSelected = selectedModalities.includes(modality);
                        return (
                            <label
                                key={modality}
                                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    isSelected
                                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onToggleModality(modality)}
                                    disabled={disabled}
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                {MEDIA_MODALITY_LABELS[modality]}
                            </label>
                        );
                    })}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                    Os prompts são portáteis e podes usá-los em qualquer
                    ferramenta. O ficheiro em si só é gerado depois, com o custo
                    estimado à vista.
                </p>
            </div>

            {totalPieces > 0 && (
                <p className="text-xs text-gray-500">
                    {totalPieces} peça{totalPieces === 1 ? '' : 's'} a gerar (
                    {selectedFormats.size} tipo{selectedFormats.size === 1 ? '' : 's'} ×{' '}
                    {selectedChannelIds.length} canal
                    {selectedChannelIds.length === 1 ? '' : 'is'}).
                </p>
            )}
        </div>
    );
}