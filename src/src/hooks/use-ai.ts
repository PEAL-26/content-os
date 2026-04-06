import { useAuthContext } from '@/context/auth-context'
import {
    generateArticle,
    type AIGeneratedArticle,
    type AIProviderId,
} from '@/lib/ai'
import { articleService } from '@/services/article.service'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { Product } from '@/types/database'
import type { PillarConfig } from '@/types/pillar'
import { useCallback, useState } from 'react'

interface GenerateArticleInput {
    topic: string
    pillar?: PillarConfig
    product?: Product
}

interface GenerateArticleResult {
    success: boolean
    articleId?: string
    article?: AIGeneratedArticle
    provider?: AIProviderId
    error?: string
}

export function useAI() {
    const { currentWorkspace } = useWorkspaceStore()
    const { user } = useAuthContext()
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentProvider, setCurrentProvider] = useState<string | null>(null)

    const generateNewArticle = useCallback(
        async (input: GenerateArticleInput): Promise<GenerateArticleResult> => {
            if (!currentWorkspace) {
                return { success: false, error: 'Workspace não carregado' }
            }

            if (!input.topic.trim()) {
                return { success: false, error: 'O tema é obrigatório' }
            }

            setIsGenerating(true)
            setError(null)
            setCurrentProvider(null)

            try {
                const preArticle = await articleService.createArticle(
                    currentWorkspace.id,
                    {
                        title: 'A gerar...',
                        slug: 'a-gerar-' + Date.now(),
                        body: '',
                        aiGenerated: true,
                    },
                    user?.id
                )

                try {
                    const result = await generateArticle({
                        topic: input.topic,
                        pillar: input.pillar,
                        product: input.product,
                        workspace: currentWorkspace,
                    })

                    if (!result.success) {
                        await articleService.deleteArticle(preArticle.id)
                        setError(result.error)
                        return { success: false, error: result.error }
                    }

                    setCurrentProvider(result.provider || null)

                    const updated = await articleService.updateArticle(
                        preArticle.id,
                        {
                            title: result.article.title,
                            slug: result.article.slug,
                            summary: result.article.summary,
                            body: result.article.body,
                            seoTitle: result.article.seoTitle,
                            seoDescription: result.article.seoDescription,
                            keywords: result.article.keywords,
                            readingTimeMin: result.article.readingTimeMin,
                            pillarId: input.pillar?.id,
                            productId: input.product?.id,
                            aiPromptUsed: result.prompt,
                        }
                    )

                    return {
                        success: true,
                        articleId: updated.id,
                        article: result.article,
                        provider: result.provider,
                    }
                } catch (aiError) {
                    await articleService.deleteArticle(preArticle.id)

                    if (aiError instanceof Error) {
                        setError(`Erro ao gerar conteúdo: ${aiError.message}`)
                        return {
                            success: false,
                            error: `Erro ao gerar conteúdo: ${aiError.message}`,
                        }
                    }

                    setError('Erro desconhecido ao gerar artigo')
                    return {
                        success: false,
                        error: 'Erro desconhecido ao gerar artigo',
                    }
                }
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Erro ao criar artigo'
                setError(message)
                return { success: false, error: message }
            } finally {
                setIsGenerating(false)
            }
        },
        [currentWorkspace, user?.id]
    )

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    return {
        isGenerating,
        error,
        currentProvider,
        generateArticle: generateNewArticle,
        clearError,
    }
}
