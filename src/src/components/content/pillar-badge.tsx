import type { ContentPillar } from '@/types/pillar';
import { PILLAR_COLORS, PILLAR_LABELS } from '@/types/pillar';

interface PillarBadgeProps {
    pillar: ContentPillar;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function PillarBadge({
    pillar,
    size = 'md',
    className = '',
}: PillarBadgeProps) {
    const colors = PILLAR_COLORS[pillar];
    const label = PILLAR_LABELS[pillar];

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base',
    };

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full font-medium ${colors.bg} ${colors.text} ${sizeClasses[size]} ${className}`}
        >
            <span>{label}</span>
        </span>
    );
}

interface PillarDotProps {
    pillar: ContentPillar;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function PillarDot({
    pillar,
    size = 'md',
    className = '',
}: PillarDotProps) {
    const sizeClasses = {
        sm: 'h-2 w-2',
        md: 'h-3 w-3',
        lg: 'h-4 w-4',
    };

    const bgClasses = {
        P1_EDUCATION: 'bg-blue-500',
        P2_USE_CASES: 'bg-green-500',
        P3_CONVERSION: 'bg-orange-500',
        P4_AUTHORITY: 'bg-purple-500',
    };

    return (
        <span
            className={`inline-block rounded-full ${bgClasses[pillar]} ${sizeClasses[size]} ${className}`}
        />
    );
}

interface PillarChipProps {
    pillar: ContentPillar;
    className?: string;
}

export function PillarChip({ pillar, className = '' }: PillarChipProps) {
    const colors = PILLAR_COLORS[pillar];
    const label = PILLAR_LABELS[pillar];

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors.bg} ${colors.border} ${colors.text} ${className}`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${colors.text.replace('text-', 'bg-')}`}
            />
            <span>{label}</span>
        </span>
    );
}
