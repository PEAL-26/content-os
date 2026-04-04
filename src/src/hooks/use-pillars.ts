import { useState, useEffect, useCallback, useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { pillarService } from '@/services/pillar.service'
import { workspaceInitService } from '@/services/workspace-init.service'
import type { PillarConfig, PillarConfigInput } from '@/types/pillar'
import type { ContentPillar } from '@/types/pillar'

interface UpdateState {
    isLoading: boolean
    isSuccess: boolean
    error: string | null
}

export function usePillars() {
    const { currentWorkspace } = useWorkspaceStore()
    const [pillars, setPillars] = useState<PillarConfig[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isInitializing, setIsInitializing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [initMessage, setInitMessage] = useState<string | null>(null)
    const [updateStates, setUpdateStates] = useState<Record<string, UpdateState>>({})
    const hasFetchedRef = useRef(false)

    const workspaceId = currentWorkspace?.id

    const fetchPillars = useCallback(async () => {
        if (!workspaceId) return

        setIsLoading(true)
        setError(null)
        setInitMessage(null)

        try {
            const data = await pillarService.getPillars(workspaceId)

            if (data.length === 0) {
                setIsInitializing(true)
                setInitMessage('A criar pilares padrão...')

                await workspaceInitService.ensureDefaultConfigs(workspaceId)

                const refreshed = await pillarService.getPillars(workspaceId)
                setPillars(refreshed)
                setInitMessage('Pilares padrão criados com sucesso!')

                setTimeout(() => setInitMessage(null), 3000)
            } else {
                setPillars(data)
            }

            hasFetchedRef.current = true
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar pilares')
        } finally {
            setIsLoading(false)
            setIsInitializing(false)
        }
    }, [workspaceId])

    useEffect(() => {
        if (workspaceId && !hasFetchedRef.current) {
            fetchPillars()
        }

        return () => {
            if (!workspaceId) {
                hasFetchedRef.current = false
                setPillars([])
            }
        }
    }, [workspaceId, fetchPillars])

    const updatePillar = useCallback(
        async (pillar: ContentPillar, input: PillarConfigInput) => {
            if (!workspaceId) {
                return { success: false, error: 'Sem workspace selecionado' }
            }

            setUpdateStates((prev) => ({
                ...prev,
                [pillar]: {
                    isLoading: true,
                    isSuccess: false,
                    error: null,
                },
            }))

            try {
                const updated = await pillarService.updatePillar(
                    workspaceId,
                    pillar,
                    input
                )

                setPillars((prev) =>
                    prev.map((p) => (p.pillar === pillar ? updated : p))
                )

                setUpdateStates((prev) => ({
                    ...prev,
                    [pillar]: {
                        isLoading: false,
                        isSuccess: true,
                        error: null,
                    },
                }))

                setTimeout(() => {
                    setUpdateStates((prev) => ({
                        ...prev,
                        [pillar]: {
                            ...prev[pillar],
                            isSuccess: false,
                        },
                    }))
                }, 2000)

                return { success: true }
            } catch (err) {
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : 'Erro ao guardar alterações'

                setUpdateStates((prev) => ({
                    ...prev,
                    [pillar]: {
                        isLoading: false,
                        isSuccess: false,
                        error: errorMessage,
                    },
                }))

                return { success: false, error: errorMessage }
            }
        },
        [workspaceId]
    )

    const getUpdateState = useCallback(
        (pillar: ContentPillar): UpdateState => {
            return (
                updateStates[pillar] || {
                    isLoading: false,
                    isSuccess: false,
                    error: null,
                }
            )
        },
        [updateStates]
    )

    return {
        pillars,
        isLoading,
        isInitializing,
        error,
        initMessage,
        updatePillar,
        getUpdateState,
        refetch: fetchPillars,
    }
}
