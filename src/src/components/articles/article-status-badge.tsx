import type { ArticleStatus } from '@/types/database'
import { ARTICLE_STATUS_COLORS, ARTICLE_STATUS_LABELS } from '@/types/database'

interface ArticleStatusBadgeProps {
    status: ArticleStatus
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
}

export function ArticleStatusBadge({
    status,
    size = 'md',
    className = '',
}: ArticleStatusBadgeProps) {
    const colors = ARTICLE_STATUS_COLORS[status]
    const label = ARTICLE_STATUS_LABELS[status]

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full font-medium ${colors.bg} ${colors.text} ${sizeClasses[size]} ${className}`}
        >
            {label}
        </span>
    )
}
