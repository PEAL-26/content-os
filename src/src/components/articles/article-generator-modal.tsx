import { Modal } from '@/components/ui/modal';
import { useAI } from '@/hooks/use-ai';
import { usePillars } from '@/hooks/use-pillars';
import { useProducts } from '@/hooks/use-products';
import { useEffect, useState } from 'react';

interface ArticleGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerated: (articleId: string) => void;
}

export function ArticleGeneratorModal({
    isOpen,
    onClose,
    onGenerated,
}: ArticleGeneratorModalProps) {
    const { pillars } = usePillars();
    const { activeProducts } = useProducts();
    const { isGenerating, error, generateArticle, clearError } = useAI();

    const [topic, setTopic] = useState('');
    const [pillarId, setPillarId] = useState<string | null>(null);
    const [productId, setProductId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTopic('');
            setPillarId(null);
            setProductId(null);
            setErrorMessage(null);
            clearError();
        }
    }, [isOpen, clearError]);

    const handleGenerate = async () => {
        if (!topic.trim()) {
            setErrorMessage('O tema é obrigatório');
            return;
        }

        setErrorMessage(null);

        const selectedPillar = pillars.find((p) => p.id === pillarId);
        const selectedProduct = activeProducts.find((p) => p.id === productId);

        try {
            const result = await generateArticle({
                topic: topic.trim(),
                pillar: selectedPillar,
                product: selectedProduct || undefined,
            });

            if (result.success && result.articleId) {
                onGenerated(result.articleId);
                onClose();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleClose = () => {
        if (!isGenerating) {
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Gerar artigo com IA"
            size="lg"
        >
            <div className="space-y-5">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Tema / Ideia <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={topic}
                        onChange={(e) => {
                            setTopic(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                        }}
                        placeholder="Ex: Como automatizar a gestão de pedidos no teu e-commerce usando IA"
                        rows={4}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        disabled={isGenerating}
                    />
                    {errorMessage && (
                        <p className="mt-1 text-xs text-red-600">
                            {errorMessage}
                        </p>
                    )}
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Pilar de conteúdo
                    </label>
                    <select
                        value={pillarId || ''}
                        onChange={(e) => setPillarId(e.target.value || null)}
                        disabled={isGenerating}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="">Selecionar pilar (opcional)</option>
                        {pillars.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Produto relacionado
                    </label>
                    <select
                        value={productId || ''}
                        onChange={(e) => setProductId(e.target.value || null)}
                        disabled={isGenerating}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="">Selecionar produto (opcional)</option>
                        {activeProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="rounded-md bg-red-50 p-3">
                        <div className="flex gap-2">
                            <svg
                                className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                        {error.includes('VITE_ANTHROPIC_API_KEY') && (
                            <p className="mt-2 text-xs text-red-600">
                                Adiciona a tua chave API no ficheiro{' '}
                                <code className="rounded bg-red-100 px-1">
                                    .env
                                </code>
                                :
                                <br />
                                <code className="rounded bg-red-100 px-1">
                                    VITE_ANTHROPIC_API_KEY=sk-ant-...
                                </code>
                            </p>
                        )}
                    </div>
                )}

                {isGenerating && (
                    <div className="rounded-md bg-blue-50 p-3">
                        <div className="flex gap-2">
                            <svg
                                className="mt-0.5 h-5 w-5 animate-spin text-blue-500"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                            </svg>
                            <p className="text-sm text-blue-700">
                                A gerar artigo com IA. Isto pode demorar alguns
                                segundos...
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 border-t pt-4">
                    <button
                        onClick={handleClose}
                        disabled={isGenerating}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !topic.trim()}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {isGenerating ? (
                            <>
                                <svg
                                    className="h-4 w-4 animate-spin"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                </svg>
                                A gerar...
                            </>
                        ) : (
                            <>
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                    />
                                </svg>
                                Gerar artigo
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
