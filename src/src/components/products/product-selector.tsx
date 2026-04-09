import { useProducts } from '@/hooks/use-products';
import { useEffect, useRef, useState } from 'react';

interface ProductSelectorProps {
    value: string | null;
    onChange: (productId: string | null) => void;
    excludeId?: string;
    placeholder?: string;
    className?: string;
}

export function ProductSelector({
    value,
    onChange,
    excludeId,
    placeholder = 'Selecionar produto',
    className = '',
}: ProductSelectorProps) {
    const { activeProducts } = useProducts();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const products = excludeId
        ? activeProducts.filter((p) => p.id !== excludeId)
        : activeProducts;

    const selectedProduct = products.find((p) => p.id === value);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
                <span
                    className={`truncate ${
                        selectedProduct ? 'text-gray-900' : 'text-gray-500'
                    }`}
                >
                    {selectedProduct?.name || placeholder}
                </span>
                <svg
                    className={`ml-2 h-4 w-4 text-gray-400 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {isOpen && (
                <div className="ring-opacity-5 absolute z-50 mt-1 w-full rounded-md bg-white py-1 shadow-lg ring-1 ring-black">
                    {products.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-gray-500">
                            Nenhum produto disponível
                        </div>
                    ) : (
                        <ul className="max-h-60 overflow-auto py-1">
                            <li>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(null);
                                        setIsOpen(false);
                                    }}
                                    className={`flex w-full items-center px-4 py-2 text-sm ${
                                        !value
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    Nenhum produto
                                </button>
                            </li>
                            {products.map((product) => (
                                <li key={product.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(product.id);
                                            setIsOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                                            product.id === value
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {product.name}
                                            </p>
                                            {product.tagline && (
                                                <p className="truncate text-xs text-gray-500">
                                                    {product.tagline}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
