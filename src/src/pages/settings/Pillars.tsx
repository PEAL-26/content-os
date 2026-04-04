import { usePillars } from '@/hooks/use-pillars'
import { PillarCard } from '@/components/content/pillar-card'
import { PILLAR_LABELS } from '@/types/pillar'

export function PillarsPage() {
    const { pillars, isLoading, isInitializing, error, initMessage, updatePillar, getUpdateState } = usePillars()

    if (isLoading || isInitializing) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                {initMessage && (
                    <p className="text-sm text-gray-500 animate-pulse">{initMessage}</p>
                )}
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
            </div>
        )
    }

    if (pillars.length === 0) {
        return (
            <div className="text-center">
                <p className="text-gray-500">
                    Ainda não existem pilares configurados.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Pilares de Conteúdo
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Configure os 4 pilares estratégicos para a sua estratégia de
                    conteúdo. Cada pilar representa uma categoria de conteúdo com
                    um objetivo específico no funil de vendas.
                </p>
            </div>

            {initMessage && (
                <div className="rounded-md bg-green-50 p-3">
                    <p className="text-sm text-green-700 flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {initMessage}
                    </p>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {pillars.map((pillar) => {
                    const state = getUpdateState(pillar.pillar)
                    return (
                        <PillarCard
                            key={pillar.pillar}
                            pillar={pillar}
                            onUpdate={updatePillar}
                            isSaving={state.isLoading}
                            isSuccess={state.isSuccess}
                            error={state.error}
                        />
                    )
                })}
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-900">
                    Legenda dos Pilares
                </h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {pillars.map((pillar) => (
                        <div key={pillar.pillar} className="flex items-start gap-2">
                            <div
                                className={`mt-0.5 h-3 w-3 rounded-full ${
                                    pillar.pillar === 'P1_EDUCATION'
                                        ? 'bg-blue-500'
                                        : pillar.pillar === 'P2_USE_CASES'
                                          ? 'bg-green-500'
                                          : pillar.pillar === 'P3_CONVERSION'
                                            ? 'bg-orange-500'
                                            : 'bg-purple-500'
                                }`}
                            />
                            <div>
                                <p className="text-xs font-medium text-gray-900">
                                    {PILLAR_LABELS[pillar.pillar]}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {pillar.isActive ? 'Ativo' : 'Inativo'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
