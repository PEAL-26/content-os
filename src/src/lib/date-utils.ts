import {
    addDays,
    addWeeks,
    endOfWeek,
    format,
    startOfWeek,
    subWeeks,
} from 'date-fns';
import { pt } from 'date-fns/locale';

export function getWeekStart(date: Date): Date {
    return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekEnd(date: Date): Date {
    return endOfWeek(date, { weekStartsOn: 1 });
}

export function getDaysOfWeek(weekStart: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function addWeeksToDate(date: Date, weeks: number): Date {
    return addWeeks(date, weeks);
}

export function subtractWeeksFromDate(date: Date, weeks: number): Date {
    return subWeeks(date, weeks);
}

export function isToday(date: Date): boolean {
    const today = new Date();
    return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    );
}

export function formatDayOfWeek(date: Date): string {
    return format(date, 'EEE', { locale: pt });
}

export function formatDayNumber(date: Date): string {
    return format(date, 'd');
}

export function formatMonth(date: Date): string {
    return format(date, 'MMM', { locale: pt });
}

export function formatFullDate(date: Date): string {
    return format(date, 'd MMM', { locale: pt });
}

export function formatWeekRange(weekStart: Date): string {
    const weekEnd = getWeekEnd(weekStart);
    const startMonth = format(weekStart, 'd MMM', { locale: pt });
    const endMonth = format(weekEnd, 'd MMM yyyy', { locale: pt });
    return `${startMonth} - ${endMonth}`;
}

export function formatTime(date: Date): string {
    return format(date, 'HH:mm');
}

export function formatDateTime(date: Date): string {
    return format(date, 'd MMM, HH:mm', { locale: pt });
}

export function formatISODate(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

export function getDayOfWeekNumber(date: Date): number {
    const day = date.getDay();
    return day === 0 ? 7 : day;
}

export function getSuggestedPillarForDay(dayOfWeek: number): string | null {
    const pillarMap: Record<number, string | null> = {
        1: 'P1_EDUCATION',
        3: 'P2_USE_CASES',
        5: 'P3_CONVERSION',
    };
    return pillarMap[dayOfWeek] || null;
}

export function isActiveDay(dayOfWeek: number): boolean {
    return [1, 3, 5].includes(dayOfWeek);
}

export function getPillarLabel(pillar: string | null): string {
    if (!pillar) return '';
    const labels: Record<string, string> = {
        P1_EDUCATION: 'P1 - Educação',
        P2_USE_CASES: 'P2 - Casos de Uso',
        P3_CONVERSION: 'P3 - Conversão',
        P4_AUTHORITY: 'P4 - Autoridade',
    };
    return labels[pillar] || pillar;
}

export function getDayName(dayOfWeek: number): string {
    const names: Record<number, string> = {
        1: 'Segunda-feira',
        2: 'Terça-feira',
        3: 'Quarta-feira',
        4: 'Quinta-feira',
        5: 'Sexta-feira',
        6: 'Sábado',
        7: 'Domingo',
    };
    return names[dayOfWeek] || '';
}

export function getShortDayName(dayOfWeek: number): string {
    const names: Record<number, string> = {
        1: 'Seg',
        2: 'Ter',
        3: 'Qua',
        4: 'Qui',
        5: 'Sex',
        6: 'Sáb',
        7: 'Dom',
    };
    return names[dayOfWeek] || '';
}

export function normalizeToUTCStartOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
}

export function createDateAtTime(date: Date, hours: number, minutes: number = 0): Date {
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
}
