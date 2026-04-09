import { WorkspaceSelector } from '@/components/workspace/workspace-selector';
import { useAuthContext } from '@/context/auth-context';
import { Link, useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Artigos', href: '/dashboard/articles' },
    { name: 'Conteúdo', href: '/dashboard/content' },
    { name: 'Planeamento', href: '/dashboard/planning' },
    { name: 'Configurações', href: '/dashboard/settings' },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const location = useLocation();
    const { user, signOut } = useAuthContext();

    return (
        <div className="flex min-h-screen bg-gray-50">
            <aside className="w-64 bg-white shadow-sm ring-1 ring-gray-900/5">
                <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
                    <h1 className="text-xl font-bold text-gray-900">
                        ContentOS
                    </h1>
                </div>

                <div className="border-b border-gray-200 px-4 py-4">
                    <WorkspaceSelector />
                </div>

                <nav className="mt-4 px-2">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`mb-1 block rounded-md px-3 py-2 text-sm font-medium ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="absolute bottom-0 w-64 border-t border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200">
                            <span className="text-sm font-medium text-gray-600">
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="flex-1 truncate">
                            <p className="text-sm font-medium text-gray-900">
                                {user?.user_metadata?.full_name ||
                                    user?.email?.split('@')[0] ||
                                    'User'}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                                {user?.email}
                            </p>
                        </div>
                        <button
                            onClick={signOut}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Terminar sessão"
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-auto">
                <div className="p-8">{children}</div>
            </main>
        </div>
    );
}
