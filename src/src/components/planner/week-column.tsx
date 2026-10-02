import { Button } from '@/components/ui/button';
import { PillarBadge } from '@/components/content/pillar-badge';
import { PlanItemCard } from '@/components/planner/plan-item-card';
import type { PlanItemWithRelations } from '@/services/weekly-plan.service';
import type { ContentPillar } from '@/types/database';
import {
    formatDayOfWeek,
    formatDayNumber,
    getDayName,
} from '@/lib/date-utils';
import { Plus } from 'lucide-react';

interface WeekColumnProps {
    date: Date;
    dayOfWeek: number;
    items: PlanItemWithRelations[];
    /** Destaca o dia na grelha. Não bloqueia — todos os dias aceitam items. */
    isActiveDay?: boolean;
    suggestedPillar?: ContentPillar | null;
    onAddItem: () => void;
    onItemClick: (item: PlanItemWithRelations) => void;
    isLoading?: boolean;
}

/**
 * Uma coluna = um dia da semana.
 *
 * A estrutura é deliberadamente rígida para as linhas de separação alinham
 * entre colunas:
 *
 *   1. cabeçalho — dia + data, com **altura fixa** (min-h), independente de
 *      ter ou não badge;
 *   2. barra do badge — só existe se houver pilar sugerido;
 *   3. área de items — cresce, com scroll interno;
 *   4. rodapé — botão de adicionar.
 *
 * O badge fica **abaixo** do `border-b` de propósito. Se ficasse dentro do
 * cabeçalho, os dias sem badge (inactivos, ou sem pilar configurado) teriam
 * um cabeçalho mais baixo e as linhas não alinhavam entre colunas.
 */
export function WeekColumn({
    date,
    dayOfWeek,
    items,
    isActiveDay = false,
    suggestedPillar,
    onAddItem,
    onItemClick,
    isLoading = false,
}: WeekColumnProps) {
    const dayName = formatDayOfWeek(date);
    const dayNumber = formatDayNumber(date);
    const pillarSuggestion = suggestedPillar ?? null;

    return (
        <div
            aria-label={`${getDayName(dayOfWeek)}, ${dayNumber}`}
            className={`flex h-full min-w-0 flex-col overflow-hidden rounded-lg border ${
                isActiveDay
                    ? 'border-blue-200 bg-white'
                    : 'border-gray-200 bg-gray-50/50'
            }`}
        >
            {/* 1. Cabeçalho — altura fixa, para as linhas alinhar */}
            <div
                className={`flex min-h-[76px] flex-col items-center justify-center border-b px-2 py-2 ${
                    isActiveDay ? 'border-blue-200' : 'border-gray-200'
                }`}
            >
                <span
                    className={`text-xs font-medium uppercase ${
                        isActiveDay ? 'text-blue-600' : 'text-gray-400'
                    }`}
                >
                    {dayName}
                </span>
                <span
                    className={`text-2xl font-bold leading-8 ${
                        isActiveDay ? 'text-gray-900' : 'text-gray-400'
                    }`}
                >
                    {dayNumber}
                </span>
            </div>

            {/* 2. Badge do pilar sugerido — abaixo da linha de separação */}
            {pillarSuggestion && isActiveDay && (
                <div className="flex min-h-[32px] items-center justify-center border-b border-gray-100 px-2 py-1.5">
                    <PillarBadge pillar={pillarSuggestion} size="sm" />
                </div>
            )}

            {/*
             * 3. Área de items — flex-1 + min-h-0 é o que permite ao scroll
             * interno funcionar: sem min-h-0 o item não encolhe abaixo do
             * conteúdo e transborda em vez de rolar.
             */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {items.length === 0 ? (
                    <button
                        type="button"
                        onClick={onAddItem}
                        className="flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-md text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                    </button>
                ) : (
                    items.map((item) => (
                        <PlanItemCard
                            key={item.id}
                            item={item}
                            onClick={() => onItemClick(item)}
                        />
                    ))
                )}
            </div>

            {/* 4. Rodapé — shrink-0 para a área de items não o esmagar */}
            <div className="shrink-0 border-t border-gray-200 p-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddItem}
                    className="w-full"
                    disabled={isLoading}
                >
                    <Plus className="h-4 w-4" />
                    Adicionar
                </Button>
            </div>
        </div>
    );
}