import { ChannelBadge } from '@/components/channels/channel-badge';
import type { PlanItemWithRelations } from '@/services/weekly-plan.service';
import { formatTime } from '@/lib/date-utils';
import { CONTENT_FORMAT_EMOJIS } from '@/helpers/content-format';

interface PlanItemCardProps {
    item: PlanItemWithRelations;
    onClick: () => void;
}

/**
 * Card de um item agendado, dentro da coluna de um dia.
 *
 * **Não tem acções.** Nenhum botão, nada ao hover. Clicar abre o
 * `PlanItemModal`, onde tudo o que se pode fazer a um item é feito. A versão
 * anterior mostrava Publicar/Remover/Ver/Link num hover, o que fazia o card
 * crescer ao passar o rato e obrigava a "mirar" alvos que se moviam.
 *
 * Por isso este componente é só apresentação, com altura previsível: emoji,
 * título (até 2 linhas), hora e ícone do canal.
 *
 * `min-w-0` no contentor do texto é obrigatório: sem ele, o `flex-1` não
 * encolhe e o título transborda a coluna em vez de ser truncado.
 */
export function PlanItemCard({ item, onClick }: PlanItemCardProps) {
    const isPublished = item.status === 'PUBLISHED';
    const isSkipped = item.status === 'SKIPPED';

    const getContentTitle = (): string => {
        if (item.contentPiece) {
            return (
                item.contentPiece.title ||
                `Post ${item.contentPiece.format}`
            );
        }
        if (item.article) return item.article.title;
        if (item.product) return item.product.name;
        return 'Item';
    };

    const getFormatIcon = (): string => {
        if (item.contentPiece?.format) {
            return CONTENT_FORMAT_EMOJIS[item.contentPiece.format] || '📄';
        }
        return '📄';
    };

    // Enter e Espaço abrem o modal, como qualquer elemento clicável.
    // Sem isto, um utilizador de teclado não conseguiria editar um item.
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <button
            type="button"
            onClick={onClick}
            onKeyDown={handleKeyDown}
            aria-label={`Editar ${getContentTitle()}`}
            className={`block w-full rounded-lg border p-2.5 text-left transition-colors ${
                isPublished
                    ? 'border-green-200 bg-green-50/60 opacity-70 hover:bg-green-50'
                    : isSkipped
                      ? 'border-red-200 bg-red-50/50 opacity-60 hover:bg-red-50'
                      : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
            }`}
        >
            <div className="flex items-start gap-2 relative">
                <span className="shrink-0 text-base leading-5 absolute top-0 right-0">
                    {getFormatIcon()}
                </span>

                <div className="min-w-0 flex-1">
                    <p
                        className={`line-clamp-2 text-xs font-medium leading-4 ${
                            isPublished || isSkipped
                                ? 'text-gray-500'
                                : 'text-gray-900'
                        }`}
                    >
                        {getContentTitle()}
                    </p>

                    <div className="mt-1 flex items-center gap-1.5">
                        {item.scheduledFor && (
                            <span
                                className={`text-xs font-medium ${
                                    isPublished || isSkipped
                                        ? 'text-gray-400'
                                        : 'text-gray-600'
                                }`}
                            >
                                {formatTime(new Date(item.scheduledFor))}
                            </span>
                        )}
                        {item.channel && (
                            <ChannelBadge
                                channel={item.channel.channel}
                                size="sm"
                                showLabel={false}
                            />
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}