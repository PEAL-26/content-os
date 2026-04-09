import { useWorkspace } from '@/hooks/use-workspace';
import { useEffect, useRef, useState } from 'react';

export function WorkspaceSelector() {
    const { currentWorkspace, workspaces, setWorkspace } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    if (workspaces.length <= 1) {
        return (
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                </svg>
                <span>{currentWorkspace?.name || 'Workspace'}</span>
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
                <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                </svg>
                <span>{currentWorkspace?.name}</span>
                <svg
                    className={`h-4 w-4 text-gray-400 transition-transform ${
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
                <div className="ring-opacity-5 absolute top-full left-0 z-50 mt-1 w-56 rounded-md bg-white shadow-lg ring-1 ring-black">
                    <div className="py-1">
                        <div className="px-3 py-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                            Workspaces
                        </div>
                        {workspaces.map((workspace) => (
                            <button
                                key={workspace.id}
                                type="button"
                                onClick={() => {
                                    setWorkspace(workspace);
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center justify-between px-3 py-2 text-sm ${
                                    workspace.id === currentWorkspace?.id
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                <span className="truncate">
                                    {workspace.name}
                                </span>
                                {workspace.memberRole === 'OWNER' && (
                                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                                        Owner
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
