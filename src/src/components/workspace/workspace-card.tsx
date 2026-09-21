import type { WorkspaceWithRole } from '@/types/database';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Pencil, Users } from 'lucide-react';

interface WorkspaceCardProps {
    workspace: WorkspaceWithRole;
    isActive: boolean;
    onSelect: () => void;
    /** Quando fornecida, mostra um botão "Editar" ao lado de "Entrar". */
    onEdit?: () => void;
}

const ROLE_BADGES: Record<
    NonNullable<WorkspaceWithRole['memberRole']>,
    { label: string; className: string }
> = {
    OWNER: {
        label: 'Dono',
        className: 'bg-purple-100 text-purple-700',
    },
    EDITOR: {
        label: 'Editor',
        className: 'bg-blue-100 text-blue-700',
    },
    VIEWER: {
        label: 'Visualizador',
        className: 'bg-gray-100 text-gray-600',
    },
};

export function WorkspaceCard({
    workspace,
    isActive,
    onSelect,
    onEdit,
}: WorkspaceCardProps) {
    const role = ROLE_BADGES[workspace.memberRole ?? 'VIEWER'];
    const initial = workspace.name.charAt(0).toUpperCase();
    const memberCount = workspace.memberCount ?? 1;

    const joinedAtLabel = workspace.joinedAt
        ? format(new Date(workspace.joinedAt), 'd MMM yyyy', { locale: pt })
        : null;

    return (
        <div
            className={`
                flex flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md
                ${isActive ? 'ring-2 ring-blue-600' : 'ring-1 ring-gray-200'}
            `}
        >
            <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-blue-500 to-indigo-500">
                    {workspace.logoUrl ? (
                        <img
                            src={workspace.logoUrl}
                            alt={workspace.name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <span className="text-lg font-bold text-white">
                            {initial}
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-gray-900">
                            {workspace.name}
                        </h3>
                        {isActive && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                                Activo
                            </span>
                        )}
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500">
                        {workspace.sector ?? 'Sem sector definido'}
                    </p>
                </div>

                <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${role.className}`}
                >
                    {role.label}
                </span>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-gray-400" />
                        {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                    </span>
                    {joinedAtLabel && (
                        <span>Membro desde {joinedAtLabel}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {onEdit && (
                        <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                        >
                            <Pencil className="h-4 w-4" />
                            Editar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onSelect}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        Entrar
                    </button>
                </div>
            </div>
        </div>
    );
}