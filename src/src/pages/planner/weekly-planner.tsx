import {
    AddPlanItemModal,
    type AddItemData,
} from '@/components/planner/add-plan-item-modal';
import {
    PlanItemModal,
    type PlanItemUpdate,
} from '@/components/planner/plan-item-modal';
import { PlannerSidebar } from '@/components/planner/planner-sidebar';
import type { PublishData } from '@/components/planner/publish-form';
import { WeekColumn } from '@/components/planner/week-column';
import { Button } from '@/components/ui/button';
import { usePlanningConfig } from '@/hooks/use-planning-config';
import { useWeeklyPlan } from '@/hooks/use-weekly-plan';
import {
    createDateAtTime,
    formatWeekRange,
    getDayOfWeekNumber,
    isToday,
} from '@/lib/date-utils';
import { workspacePath } from '@/lib/workspace-paths';
import type { PlanItemWithRelations } from '@/services/weekly-plan.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { ContentPillar } from '@/types/database';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    PanelLeftOpen,
    Settings2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SIDEBAR_STORAGE_KEY = 'planner-sidebar-collapsed';

function getInitialSidebarState(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function WeeklyPlannerPage() {
    const { currentWorkspace } = useWorkspaceStore();
    const navigate = useNavigate();
    const {
        currentWeek,
        weekDays,
        isLoading,
        error,
        stats,
        goToNextWeek,
        goToPreviousWeek,
        goToCurrentWeek,
        getItemsForDay,
        addPlanItem,
        updatePlanItem,
        removePlanItem,
        markAsPublished,
    } = useWeeklyPlan();
    const {
        activeDaysLabel,
        isActiveDay: isConfiguredActiveDay,
        getSuggestedPillarForDay,
    } = usePlanningConfig();

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    const [selectedItem, setSelectedItem] =
        useState<PlanItemWithRelations | null>(null);
    const [itemModalOpen, setItemModalOpen] = useState(false);

    const [isAddingItem, setIsAddingItem] = useState(false);
    const [isSavingItem, setIsSavingItem] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isRemovingItem, setIsRemovingItem] = useState(false);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
        getInitialSidebarState
    );

    useEffect(() => {
        try {
            localStorage.setItem(
                SIDEBAR_STORAGE_KEY,
                String(isSidebarCollapsed)
            );
        } catch {
            // localStorage indisponível (modo privado) — a preferência é
            // só de conveniência, não vale a pena chatear o utilizador.
        }
    }, [isSidebarCollapsed]);

    const targetPostsPerWeek = currentWorkspace?.postsPerWeek || 3;

    const handleOpenAddModal = (date: Date) => {
        setSelectedDay(date);
        setAddModalOpen(true);
    };

    const handleOpenItemModal = (item: PlanItemWithRelations) => {
        setSelectedItem(item);
        setItemModalOpen(true);
    };

    const handleAddItem = async (itemData: AddItemData) => {
        if (!selectedDay || !currentWorkspace) return;

        setIsAddingItem(true);
        try {
            const [hours, minutes] = itemData.scheduledTime
                .split(':')
                .map(Number);
            const scheduledFor = createDateAtTime(selectedDay, hours, minutes);

            // dayOfWeek não é enviado: o serviço deriva-o de scheduledFor.
            const success = await addPlanItem({
                articleId:
                    itemData.type === 'article'
                        ? itemData.articleId
                        : undefined,
                contentPieceId:
                    itemData.type === 'content_piece'
                        ? itemData.contentPieceId
                        : undefined,
                pillarId: itemData.pillarId || undefined,
                channelId: itemData.channelId || undefined,
                scheduledFor,
                notes: itemData.notes || null,
            });

            if (success) {
                setAddModalOpen(false);
                setSelectedDay(null);
            }
        } finally {
            setIsAddingItem(false);
        }
    };

    const handleSaveItem = async (updates: PlanItemUpdate) => {
        if (!selectedItem) return false;

        setIsSavingItem(true);
        try {
            const ok = await updatePlanItem(selectedItem.id, updates);
            if (ok) {
                setItemModalOpen(false);
                setSelectedItem(null);
            }
            return ok;
        } finally {
            setIsSavingItem(false);
        }
    };

    const handlePublishItem = async (data: PublishData) => {
        if (!selectedItem) return false;

        setIsPublishing(true);
        try {
            const ok = await markAsPublished(selectedItem.id, {
                platform: data.platform,
                publishedUrl: data.publishedUrl,
                publishedAt: data.publishedAt,
                assetFile: data.assetFile,
            });
            if (ok) {
                setItemModalOpen(false);
                setSelectedItem(null);
            }
            return ok;
        } finally {
            setIsPublishing(false);
        }
    };

    const handleRemoveItem = async () => {
        if (!selectedItem) return false;

        setIsRemovingItem(true);
        try {
            return await removePlanItem(selectedItem.id);
        } finally {
            setIsRemovingItem(false);
        }
    };

    const isCurrentWeek = weekDays.some((day) => isToday(day));

    /**
     * Dia a abrir quando o utilizador entra pela barra lateral em vez de
     * clicar numa coluna.
     *
     * Antes era sempre `new Date()` — o item era agendado para hoje
     * independentemente da semana visível e, se hoje não pertencesse a essa
     * semana, nunca aparecia na grelha. Agora: hoje se estiver na semana,
     * senão o primeiro dia activo dela.
     */
    const getDefaultDayForSidebar = (): Date => {
        const today = new Date();
        const todayInWeek = weekDays.some(
            (day) =>
                day.getFullYear() === today.getFullYear() &&
                day.getMonth() === today.getMonth() &&
                day.getDate() === today.getDate()
        );

        if (todayInWeek) return today;

        const firstActiveDay = weekDays.find((day) =>
            isConfiguredActiveDay(getDayOfWeekNumber(day))
        );

        return firstActiveDay ?? weekDays[0] ?? today;
    };

    return (
        /*
         * Cadeia de altura explícita.
         *
         * O `DashboardLayout` dá `min-h-screen` ao `<main>` — altura MÍNIMA,
         * não a altura restante depois do header. Por isso subtraímos o `p-6`
         * (48px) ao viewport para o plano tocar o fundo da janela.
         *
         * É SÓ o `p-6`. Uma versão anterior descontava também o título e a
         * barra de navegação, o que era uma dupla contagem: esses elementos
         * estão DENTRO deste contentor e o `flex-1 min-h-0` do contentor dos
         * dias já os desconta. O resultado era 378px de plano num espaço de
         * 522px — faltavam 144px e a grelha ficava a meio da página.
         *
         * O `min-h-0` nos elementos de flex é obrigatório: sem ele o flex item
         * não encolhe abaixo do conteúdo e a cadeia transborda.
         */
        <div className="flex h-[calc(100vh-3rem)] gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex shrink-0 items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Planeador Semanal
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            {formatWeekRange(currentWeek)}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousWeek}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextWeek}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        {!isCurrentWeek && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={goToCurrentWeek}
                            >
                                <Calendar className="h-4 w-4" />
                                Esta semana
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-blue-100" />
                            {activeDaysLabel()}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>Dias activos</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() =>
                                navigate(
                                    workspacePath(
                                        currentWorkspace?.id ?? '',
                                        'settings/planning'
                                    )
                                )
                            }
                        >
                            <Settings2 className="h-3 w-3" />
                            Configurar dias
                        </Button>
                        {isSidebarCollapsed && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsSidebarCollapsed(false)}
                                title="Mostrar painel lateral"
                                className="h-5 w-5 border-0 p-0"
                            >
                                <PanelLeftOpen className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="shrink-0 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Contentor dos dias: o unico ponto com scroll.

                    flex-1 + min-h-0 deixa-o ocupar a altura restante em vez
                    de a esticar; min-w-0 deixa-o encolher para a largura
                    disponivel.

                    O scrollbar-gutter: stable reserva a gutter da scrollbar
                    horizontal em vez de a fazer aparecer e desaparecer — sem
                    isso a largura do contentor saltava quando a scrollbar
                    surgia. Nao e o que resolve a altura; para a altura e
                    preciso o calc na grelha filha.

                    A grelha filha tem min-w fixo (1360px = 7 x ~180px +
                    gaps): sem ele, o grid-cols-7 divide a largura sem limite e
                    o conteudo transborda. Com a sidebar aberta (320px) os
                    1360px nao cabem, e e este contentor — nao a pagina — que
                    rola. */}
                <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable]">
                    {/* Ver nota acima: `calc(100% + 1rem)` em vez de `h-full`
                        compensa a scrollbar horizontal (~15px), que o
                        `height: 100%` não desconta. Sem isto a grelha fica
                        15px mais curta que o contentor e deixa uma faixa morta
                        no fundo das colunas. */}
                    <div className="grid h-full min-w-[1360px] grid-cols-7 gap-4">
                        {weekDays.map((day) => {
                            const dayOfWeek = getDayOfWeekNumber(day);
                            const dayItems = getItemsForDay(dayOfWeek);
                            const pillarSuggestion = getSuggestedPillarForDay(
                                dayOfWeek
                            ) as ContentPillar | null;

                            return (
                                <WeekColumn
                                    key={day.toISOString()}
                                    date={day}
                                    dayOfWeek={dayOfWeek}
                                    items={dayItems}
                                    isActiveDay={isConfiguredActiveDay(
                                        dayOfWeek
                                    )}
                                    suggestedPillar={pillarSuggestion}
                                    onAddItem={() => handleOpenAddModal(day)}
                                    onItemClick={handleOpenItemModal}
                                    isLoading={isLoading}
                                />
                            );
                        })}
                    </div>
                </div>

                {currentWorkspace && selectedDay && (
                    <AddPlanItemModal
                        isOpen={addModalOpen}
                        onClose={() => {
                            setAddModalOpen(false);
                            setSelectedDay(null);
                        }}
                        onAdd={handleAddItem}
                        workspaceId={currentWorkspace.id}
                        selectedDate={selectedDay}
                        dayOfWeek={getDayOfWeekNumber(selectedDay)}
                        pillarSuggestion={getSuggestedPillarForDay(
                            getDayOfWeekNumber(selectedDay)
                        )}
                        isLoading={isAddingItem}
                    />
                )}

                {currentWorkspace && selectedItem && (
                    <PlanItemModal
                        isOpen={itemModalOpen}
                        item={selectedItem}
                        workspaceId={currentWorkspace.id}
                        onClose={() => {
                            setItemModalOpen(false);
                            setSelectedItem(null);
                        }}
                        onSave={handleSaveItem}
                        onPublish={handlePublishItem}
                        onRemove={handleRemoveItem}
                        isSaving={isSavingItem}
                        isPublishing={isPublishing}
                        isRemoving={isRemovingItem}
                    />
                )}
            </div>

            {!isSidebarCollapsed && (
                <PlannerSidebar
                    currentWeek={currentWeek}
                    stats={stats}
                    targetPostsPerWeek={targetPostsPerWeek}
                    onAddPiece={() => {
                        setSelectedDay(getDefaultDayForSidebar());
                        setAddModalOpen(true);
                    }}
                    onCollapse={() => setIsSidebarCollapsed(true)}
                />
            )}
        </div>
    );
}
