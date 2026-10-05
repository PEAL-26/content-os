import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import type { MetadataField } from '@/lib/ai/generation-job-types';

interface MetadataGenerateButtonProps {
    field: MetadataField;
    /** Este campo está a ser gerado agora. */
    isGenerating: boolean;
    /** Há algum ARTICLE_METADATA activo (desliga os botões todos). */
    isBusy: boolean;
    /** Erro do último job neste campo (repetir é o clique no próprio botão). */
    error?: string | null;
    onGenerate: (field: MetadataField) => void;
    onRetry?: (field: MetadataField) => void;
    className?: string;
}

/**
 * Botão-ícone de geração por campo.
 *
 * Estado normal = `Sparkles`, a gerar = spinner, a falhar = `AlertTriangle`
 * âmbar cujo clique é o "Repetir" (mesmo contrato dos cards do painel de
 * conteúdo, onde o erro também é clicável). O texto vive no `title` para não
 * roubar largura ao campo ao lado num painel de 30%.
 */
export function MetadataGenerateButton({
    field,
    isGenerating,
    isBusy,
    error,
    onGenerate,
    onRetry,
    className,
}: MetadataGenerateButtonProps) {
    const failed = Boolean(error);

    if (failed) {
        return (
            <button
                type="button"
                onClick={() => (onRetry ? onRetry(field) : onGenerate(field))}
                disabled={isBusy}
                title={error ?? 'A geração falhou — clicar para repetir'}
                aria-label="A geração falhou — clicar para repetir"
                className={cn(
                    'flex items-center gap-1 rounded p-1 text-amber-600 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40',
                    className
                )}
            >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-[10px] font-medium">Repetir</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onGenerate(field)}
            disabled={isBusy || isGenerating}
            title="Gerar com IA"
            aria-label="Gerar este campo com IA"
            className={cn(
                'rounded p-1 text-gray-400 transition-colors hover:bg-purple-50 hover:text-purple-600 disabled:cursor-not-allowed disabled:opacity-40',
                className
            )}
        >
            {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
            ) : (
                <Sparkles className="h-3.5 w-3.5" />
            )}
        </button>
    );
}