import { usePlanningConfig } from '@/hooks/use-planning-config';
import { usePillars } from '@/hooks/use-pillars';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getDayName, getShortDayName } from '@/lib/date-utils';

/**
 * Configuração dos dias de planeamento.
 *
 * Um toggle por dia (1..7) e um pilar sugerido opcional.
 *
 * Desactivar um dia NÃO impede planeamento nele — a grelha mostra sempre os
 * 7 dias e todos aceitam items. Desactivar é só não o destacar. O texto
 * explica-o explicitamente para não parecer uma restrição.
 */
export function PlanningSettingsPage() {
    const {
        configs,
        isLoading,
        isSaving,
        error,
        getConfigForDay,
        updateConfig,
        activeDays,
    } = usePlanningConfig();
    const { pillars } = usePillars();
    const { currentWorkspace } = useWorkspaceStore();
    const postsPerWeek = currentWorkspace?.postsPerWeek ?? 3;

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
            </div>
        );
    }

    if (configs.length === 0) {
        return (
            <div className="text-center">
                <p className="text-gray-500">
                    A configuração de dias ainda não foi criada para este
                    workspace.
                </p>
            </div>
        );
    }

    const activeCount = activeDays().length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Dias de Planeamento
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Escolha os dias em que pretende publicar. O planeador mostra
                    sempre os sete dias e aceita conteúdo em qualquer um deles —
                    desactivar um dia serve apenas para não o destacar e para não
                    sugerir pilar, não para o bloquear.
                </p>
            </div>

            <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-blue-900">
                    <span className="font-medium">
                        {activeCount === 7
                            ? 'Todos os dias activos.'
                            : `${activeCount} ${activeCount === 1 ? 'dia activo' : 'dias activos'}.`}
                    </span>{' '}
                    Pode planear em qualquer dia da semana. A frequência-alvo de{' '}
                    <span className="font-medium">
                        {postsPerWeek} {postsPerWeek === 1 ? 'post' : 'posts'}/semana
                    </span>{' '}
                    continua independente, definida em Configurações Gerais.
                </p>
            </div>

            <div className="space-y-3">
                {Array.from({ length: 7 }, (_, i) => i + 1).map((dayOfWeek) => {
                    const config = getConfigForDay(dayOfWeek);
                    const isActive = config?.isActive ?? false;
                    const saving = isSaving === dayOfWeek;

                    return (
                        <div
                            key={dayOfWeek}
                            className={`rounded-lg border bg-white p-4 transition-colors ${
                                isActive
                                    ? 'border-blue-200'
                                    : 'border-gray-200'
                            }`}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <label className="flex cursor-pointer items-center gap-3">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isActive}
                                        onClick={() =>
                                            updateConfig(dayOfWeek, {
                                                isActive: !isActive,
                                            })
                                        }
                                        disabled={saving}
                                        className={`relative h-6 w-11 rounded-full transition-colors ${
                                            isActive
                                                ? 'bg-blue-600'
                                                : 'bg-gray-300'
                                        } ${saving ? 'opacity-50' : ''}`}
                                    >
                                        <span
                                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                                                isActive
                                                    ? 'translate-x-5'
                                                    : 'translate-x-0.5'
                                            }`}
                                        />
                                    </button>
                                    <span className="flex items-baseline gap-2">
                                        <span className="font-medium text-gray-900">
                                            {getDayName(dayOfWeek)}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {getShortDayName(dayOfWeek)}
                                        </span>
                                    </span>
                                </label>

                                <div className="flex items-center gap-2">
                                    <label
                                        htmlFor={`pillar-${dayOfWeek}`}
                                        className="text-xs text-gray-500"
                                    >
                                        Pilar sugerido
                                    </label>
                                    <select
                                        id={`pillar-${dayOfWeek}`}
                                        value={config?.suggestedPillarId ?? ''}
                                        disabled={saving}
                                        onChange={(e) =>
                                            updateConfig(dayOfWeek, {
                                                suggestedPillarId:
                                                    e.target.value || null,
                                            })
                                        }
                                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 disabled:opacity-50"
                                    >
                                        <option value="">Sem sugestão</option>
                                        {pillars
                                            .filter((p) => p.isActive)
                                            .map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            {config?.suggestedPillar && (
                                <p className="mt-3 text-xs text-gray-500">
                                    Este dia é sugerido para{' '}
                                    <span className="font-medium text-gray-700">
                                        {config.suggestedPillar.name}
                                    </span>
                                    .
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-900">
                    Como isto funciona
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
                    <li>
                        Os sete dias aparecem sempre no planeador, activos ou
                        não.
                    </li>
                    <li>
                        Pode clicar em qualquer coluna e agendar conteúdo em
                        qualquer dia.
                    </li>
                    <li>
                        Desactivar um dia não apaga nem esconde itens já
                        agendados nele.
                    </li>
                    <li>
                        O pilar sugerido é apenas uma pré-visualização no
                        cabeçalho da coluna — o pilar de cada item é escolhido
                        ao agendar.
                    </li>
                </ul>
            </div>
        </div>
    );
}