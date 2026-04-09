import { createContext, useContext, useState } from 'react';

interface TabsContextValue {
    value: string;
    onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}

export function Tabs({
    defaultValue,
    value: controlledValue,
    onValueChange,
    children,
    className = '',
}: TabsProps) {
    const [internalValue, setInternalValue] = useState(defaultValue || '');

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;

    const handleChange = (newValue: string) => {
        if (isControlled) {
            onValueChange?.(newValue);
        } else {
            setInternalValue(newValue);
        }
    };

    return (
        <TabsContext.Provider value={{ value, onValueChange: handleChange }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

interface TabsListProps {
    children: React.ReactNode;
    className?: string;
}

export function TabsList({ children, className = '' }: TabsListProps) {
    return (
        <div
            className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500 ${className}`}
            role="tablist"
        >
            {children}
        </div>
    );
}

interface TabsTriggerProps {
    value: string;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

export function TabsTrigger({
    value,
    children,
    className = '',
    disabled = false,
}: TabsTriggerProps) {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabsTrigger must be used within Tabs');

    const isActive = context.value === value;

    return (
        <button
            type="button"
            role="tab"
            disabled={disabled}
            aria-selected={isActive}
            onClick={() => context.onValueChange(value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'hover:bg-gray-200 hover:text-gray-700'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className}`}
        >
            {children}
        </button>
    );
}

interface TabsContentProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

export function TabsContent({
    value,
    children,
    className = '',
}: TabsContentProps) {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabsContent must be used within Tabs');

    if (context.value !== value) return null;

    return (
        <div role="tabpanel" className={className}>
            {children}
        </div>
    );
}
