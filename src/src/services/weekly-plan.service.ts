import { supabase } from '@/lib/supabase';
import type { PlanItemStatus, SocialChannel } from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import { v4 as uuidv4 } from 'uuid';
import { contentPieceService } from './content-piece.service';

export interface WeeklyPlanData {
    id: string;
    workspaceId: string;
    weekStart: string;
    weekEnd: string;
    notes: string | null;
    theme: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PlanItemData {
    id: string;
    weeklyPlanId: string;
    workspaceId: string;
    articleId: string | null;
    contentPieceId: string | null;
    productId: string | null;
    pillarId: string | null;
    channelId: string | null;
    scheduledFor: string;
    dayOfWeek: number;
    status: PlanItemStatus;
    publishedAt: string | null;
    publishedUrl: string | null;
    notes: string | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface PlanItemWithRelations extends PlanItemData {
    article?: { id: string; title: string } | null;
    contentPiece?: {
        id: string;
        title: string | null;
        format: string;
        channel?: { id: string; channel: SocialChannel } | null;
    } | null;
    product?: { id: string; name: string } | null;
    pillar?: PillarConfig | null;
    channel?: {
        id: string;
        channel: SocialChannel;
        handle: string | null;
    } | null;
}

export interface WeeklyPlanWithItems extends WeeklyPlanData {
    items: PlanItemWithRelations[];
}

export interface CreatePlanItemInput {
    weeklyPlanId: string;
    workspaceId: string;
    articleId?: string | null;
    contentPieceId?: string | null;
    productId?: string | null;
    pillarId?: string | null;
    channelId?: string | null;
    scheduledFor: Date | string;
    dayOfWeek: number;
    notes?: string | null;
    sortOrder?: number;
}

export interface UpdatePlanItemInput {
    articleId?: string | null;
    contentPieceId?: string | null;
    productId?: string | null;
    pillarId?: string | null;
    channelId?: string | null;
    scheduledFor?: Date | string;
    dayOfWeek?: number;
    status?: PlanItemStatus;
    publishedAt?: Date | string | null;
    publishedUrl?: string | null;
    notes?: string | null;
    sortOrder?: number;
}

export interface UpdateWeeklyPlanInput {
    notes?: string | null;
    theme?: string | null;
    isActive?: boolean;
}

export const weeklyPlanService = {
    async getWeekPlan(
        workspaceId: string,
        weekStart: Date
    ): Promise<WeeklyPlanData | null> {
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('weekly_plans')
            .select('*')
            .eq('workspaceId', workspaceId)
            .eq('weekStart', weekStartStr)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar plano semanal: ${error.message}`);
        }

        return data as WeeklyPlanData;
    },

    async createWeekPlan(
        workspaceId: string,
        weekStart: Date,
        weekEnd: Date
    ): Promise<WeeklyPlanData> {
        // Normalizar datas para evitar inconsistências de timezone
        const normalizeDate = (date: Date): string => {
            return date.toISOString().split('T')[0] + 'T00:00:00.000Z';
        };

        const { data, error } = await supabase
            .from('weekly_plans')
            .insert({
                id: uuidv4(),
                workspaceId,
                weekStart: normalizeDate(weekStart),
                weekEnd: weekEnd.toISOString().split('T')[0] + 'T23:59:59.999Z',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar plano semanal: ${error.message}`);
        }

        return data as WeeklyPlanData;
    },

    async getOrCreateWeekPlan(
        workspaceId: string,
        weekStart: Date,
        weekEnd: Date
    ): Promise<WeeklyPlanData> {
        // Normalizar datas para evitar inconsistências de timezone
        const normalizeDate = (date: Date): string => {
            return date.toISOString().split('T')[0] + 'T00:00:00.000Z';
        };
        const normalizedWeekStart = normalizeDate(weekStart);
        const normalizedWeekEnd =
            weekEnd.toISOString().split('T')[0] + 'T23:59:59.999Z';

        // Tentar obter primeiro
        const existing = await this.getWeekPlan(workspaceId, weekStart);
        if (existing) {
            return existing;
        }

        // Criar novo plano - usar upsert para evitar race conditions
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('weekly_plans')
            .upsert(
                {
                    id: uuidv4(),
                    workspaceId,
                    weekStart: normalizedWeekStart,
                    weekEnd: normalizedWeekEnd,
                    isActive: true,
                    createdAt: now,
                    updatedAt: now,
                },
                {
                    onConflict: 'workspaceId,weekStart',
                }
            )
            .select()
            .single();

        if (error) {
            // Se o upsert falhar por conflito, tentar obter novamente
            if (error.code === '23505') {
                const retry = await this.getWeekPlan(workspaceId, weekStart);
                if (retry) return retry;
            }
            throw new Error(`Erro ao criar plano semanal: ${error.message}`);
        }

        return data as WeeklyPlanData;
    },

    async getWeekPlanWithItems(
        workspaceId: string,
        weekStart: Date
    ): Promise<WeeklyPlanWithItems | null> {
        const plan = await this.getWeekPlan(workspaceId, weekStart);
        if (!plan) {
            return null;
        }

        const { data: items, error } = await supabase
            .from('plan_items')
            .select(
                `
                *,
                article:articles(id, title),
                contentPiece:content_pieces(id, title, format, channel:channel_configs(id, channel)),
                product:products(id, name),
                pillar:pillar_configs(id, pillar, name, objective),
                channel:channel_configs(id, channel, handle)
            `
            )
            .eq('weeklyPlanId', plan.id)
            .order('scheduledFor', { ascending: true });

        if (error) {
            throw new Error(`Erro ao buscar items do plano: ${error.message}`);
        }

        return {
            ...plan,
            items: (items || []) as PlanItemWithRelations[],
        };
    },

    async getOrCreateWeekPlanWithItems(
        workspaceId: string,
        weekStart: Date,
        weekEnd: Date
    ): Promise<WeeklyPlanWithItems> {
        const plan = await this.getOrCreateWeekPlan(
            workspaceId,
            weekStart,
            weekEnd
        );

        const { data: items, error } = await supabase
            .from('plan_items')
            .select(
                `
                *,
                article:articles(id, title),
                contentPiece:content_pieces(id, title, format, channel:channel_configs(id, channel)),
                product:products(id, name),
                pillar:pillar_configs(id, pillar, name, objective),
                channel:channel_configs(id, channel, handle)
            `
            )
            .eq('weeklyPlanId', plan.id)
            .order('scheduledFor', { ascending: true });

        if (error) {
            throw new Error(`Erro ao buscar items do plano: ${error.message}`);
        }

        return {
            ...plan,
            items: (items || []) as PlanItemWithRelations[],
        };
    },

    async updateWeekPlan(
        id: string,
        data: UpdateWeeklyPlanInput
    ): Promise<WeeklyPlanData> {
        const { data: result, error } = await supabase
            .from('weekly_plans')
            .update({
                ...data,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao atualizar plano semanal: ${error.message}`
            );
        }

        return result as WeeklyPlanData;
    },

    async createPlanItem(data: CreatePlanItemInput): Promise<PlanItemData> {
        const { data: result, error } = await supabase
            .from('plan_items')
            .insert({
                id: uuidv4(),
                workspaceId: data.workspaceId,
                weeklyPlanId: data.weeklyPlanId,
                articleId: data.articleId || null,
                contentPieceId: data.contentPieceId || null,
                productId: data.productId || null,
                pillarId: data.pillarId || null,
                channelId: data.channelId || null,
                scheduledFor:
                    data.scheduledFor instanceof Date
                        ? data.scheduledFor.toISOString()
                        : data.scheduledFor,
                dayOfWeek: data.dayOfWeek,
                status: 'PLANNED',
                notes: data.notes || null,
                sortOrder: data.sortOrder || 0,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar item do plano: ${error.message}`);
        }

        return result as PlanItemData;
    },

    async updatePlanItem(
        id: string,
        data: UpdatePlanItemInput
    ): Promise<PlanItemData> {
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (data.articleId !== undefined) updateData.articleId = data.articleId;
        if (data.contentPieceId !== undefined)
            updateData.contentPieceId = data.contentPieceId;
        if (data.productId !== undefined) updateData.productId = data.productId;
        if (data.pillarId !== undefined) updateData.pillarId = data.pillarId;
        if (data.channelId !== undefined) updateData.channelId = data.channelId;
        if (data.scheduledFor !== undefined) {
            updateData.scheduledFor =
                data.scheduledFor instanceof Date
                    ? data.scheduledFor.toISOString()
                    : data.scheduledFor;
        }
        if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.publishedAt !== undefined) {
            updateData.publishedAt =
                data.publishedAt instanceof Date
                    ? data.publishedAt.toISOString()
                    : data.publishedAt;
        }
        if (data.publishedUrl !== undefined)
            updateData.publishedUrl = data.publishedUrl;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

        const { data: result, error } = await supabase
            .from('plan_items')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao atualizar item do plano: ${error.message}`
            );
        }

        return result as PlanItemData;
    },

    async updatePlanItemStatus(
        id: string,
        status: PlanItemStatus
    ): Promise<PlanItemData> {
        const updateData: Record<string, unknown> = {
            status,
            updatedAt: new Date().toISOString(),
        };

        if (status === 'PUBLISHED') {
            updateData.publishedAt = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('plan_items')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao atualizar status do item: ${error.message}`
            );
        }

        return data as PlanItemData;
    },

    async deletePlanItem(id: string): Promise<void> {
        const { error } = await supabase
            .from('plan_items')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Erro ao eliminar item do plano: ${error.message}`);
        }
    },

    async getItemsByDayOfWeek(
        weeklyPlanId: string,
        dayOfWeek: number
    ): Promise<PlanItemWithRelations[]> {
        const { data, error } = await supabase
            .from('plan_items')
            .select(
                `
                *,
                article:articles(id, title),
                contentPiece:content_pieces(id, title, format, channel:channel_configs(id, channel)),
                product:products(id, name),
                pillar:pillar_configs(id, pillar, name, objective),
                channel:channel_configs(id, channel, handle)
            `
            )
            .eq('weeklyPlanId', weeklyPlanId)
            .eq('dayOfWeek', dayOfWeek)
            .order('sortOrder', { ascending: true });

        if (error) {
            throw new Error(`Erro ao buscar items por dia: ${error.message}`);
        }

        return (data || []) as PlanItemWithRelations[];
    },

    async getPlanItemWithRelations(
        id: string
    ): Promise<PlanItemWithRelations | null> {
        const { data, error } = await supabase
            .from('plan_items')
            .select(
                `
                *,
                article:articles(id, title),
                contentPiece:content_pieces(id, title, format, channel:channel_configs(id, channel)),
                product:products(id, name),
                pillar:pillar_configs(id, pillar, name, objective),
                channel:channel_configs(id, channel, handle)
            `
            )
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar item: ${error.message}`);
        }

        return data as PlanItemWithRelations;
    },

    async markAsPublished(
        planItemId: string,
        data: { publishedUrl?: string; publishedAt: Date }
    ): Promise<PlanItemData> {
        const item = await this.getPlanItemWithRelations(planItemId);
        if (!item) {
            throw new Error('Item não encontrado');
        }

        const updateData: Record<string, unknown> = {
            status: 'PUBLISHED',
            publishedAt: data.publishedAt.toISOString(),
            publishedUrl: data.publishedUrl || null,
            updatedAt: new Date().toISOString(),
        };

        const { data: result, error } = await supabase
            .from('plan_items')
            .update(updateData)
            .eq('id', planItemId)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao marcar como publicado: ${error.message}`);
        }

        if (item.contentPieceId) {
            await contentPieceService.updateStatus(
                item.contentPieceId,
                'PUBLISHED'
            );
            await contentPieceService.updateContentPiece(item.contentPieceId, {
                publishedAt: data.publishedAt.toISOString(),
            });
        }

        return result as PlanItemData;
    },

    async removePlanItemAndRevertPiece(planItemId: string): Promise<void> {
        const item = await this.getPlanItemWithRelations(planItemId);

        if (item?.contentPieceId) {
            await contentPieceService.updateStatus(
                item.contentPieceId,
                'APPROVED'
            );
        }

        await this.deletePlanItem(planItemId);
    },
};
