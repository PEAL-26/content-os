import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
    label: string;
    value: number | string;
    icon?: ReactNode;
    variant?: 'up' | 'down' | 'neutral';
    change?: number | string;
    changeLabel?: string;
    loading?: boolean;
    className?: string;
}

export function MetricCard({
    label,
    value,
    icon,
    variant = 'neutral',
    change,
    changeLabel,
    loading = false,
    className = '',
}: MetricCardProps) {
    const variantColors = {
        up: 'text-green-600',
        down: 'text-red-600',
        neutral: 'text-gray-600',
    };

    const variantBg = {
        up: 'bg-green-50',
        down: 'bg-red-50',
        neutral: 'bg-gray-50',
    };

    if (loading) {
        return (
            <div
                className={`rounded-lg bg-white p-4 shadow-sm ${className}`}
            >
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                        <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
                        <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                    </div>
                    <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
                </div>
            </div>
        );
    }

    return (
        <div
            className={`rounded-lg bg-white p-4 shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{label}</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                        {value}
                    </p>
                    {change !== undefined && (
                        <div className="mt-2 flex items-center gap-1">
                            {variant === 'up' && (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            )}
                            {variant === 'down' && (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            {variant === 'neutral' && (
                                <Minus className="h-4 w-4 text-gray-400" />
                            )}
                            <span
                                className={`text-sm font-medium ${variantColors[variant]}`}
                            >
                                {change}
                            </span>
                            {changeLabel && (
                                <span className="text-sm text-gray-500">
                                    {changeLabel}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {icon && (
                    <div
                        className={`rounded-lg p-2 ${variantBg[variant]}`}
                    >
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}

interface SkeletonCardProps {
    className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
    return (
        <div
            className={`rounded-lg bg-white p-4 shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
            </div>
        </div>
    );
}
