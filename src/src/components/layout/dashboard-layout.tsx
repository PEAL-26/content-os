import { WorkspaceSelector } from '@/components/workspace/workspace-selector';
import { useAuthContext } from '@/context/use-auth-context';
import { useWorkspaceContentPieces } from '@/hooks/use-workspace-content-pieces';
import { getUserDisplayName, getUserInitial } from '@/helpers/user';
import { useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
    LayoutDashboard,
    CalendarCheck,
    Layers,
    FileText,
    Clapperboard,
    Building2,
    Package,
    Flag,
    Radio,
    Users,
    LogOut,
    Menu,
    X,
    Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'contentos-sidebar-open';

interface NavItem {
    name: string;
    href: string;
    icon: React.ElementType;
}

interface NavGroup {
    title?: string;
    items: NavItem[];
}

const navigation: NavGroup[] = [
    {
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { name: 'Planeador', href: '/dashboard/planning', icon: CalendarCheck },
        ],
    },
    {
        title: 'Conteúdo',
        items: [
            { name: 'Artigos', href: '/dashboard/articles', icon: FileText },
            { name: 'Peças', href: '/dashboard/content', icon: Layers },
            { name: 'Roteiros', href: '/dashboard/video-scripts', icon: Clapperboard },
        ],
    },
    {
        title: 'Configurações',
        items: [
            { name: 'Workspace', href: '/dashboard/settings', icon: Building2 },
            { name: 'Produtos', href: '/dashboard/settings/products', icon: Package },
            { name: 'Pilares', href: '/dashboard/settings/pillars', icon: Flag },
            { name: 'Canais', href: '/dashboard/settings/channels', icon: Radio },
            { name: 'Membros', href: '/dashboard/settings/members', icon: Users },
        ],
    },
];

function getInitialSidebarState(): boolean {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
        return stored === 'true';
    }
    return false;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const { user, signOut } = useAuthContext();
    const { pieces: pendingPieces } = useWorkspaceContentPieces({
        status: 'DRAFT',
    });

    const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarState);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(sidebarOpen));
    }, [sidebarOpen]);

    const closeSidebar = () => {
        setSidebarOpen(false);
    };

    const toggleSidebar = () => {
        setSidebarOpen((prev) => !prev);
    };

    const userName = getUserDisplayName(user);
    const userInitial = getUserInitial(user);

    return (
        <div className="flex min-h-screen bg-gray-50">
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 transition-opacity"
                    onClick={closeSidebar}
                />
            )}

            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col
                    bg-white shadow-xl transition-transform duration-300
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="group flex h-16 items-center justify-between border-b border-gray-200 px-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-indigo-600">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <h1 className="text-lg font-bold text-gray-900">
                            ContentOS
                        </h1>
                    </div>
                    {!isMobile && (
                        <button
                            onClick={closeSidebar}
                            className="rounded-md p-1.5 text-gray-500 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                            title="Ocultar sidebar"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                    {isMobile && (
                        <button
                            onClick={closeSidebar}
                            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                <div className="border-b border-gray-200 px-4 py-4">
                    <WorkspaceSelector />
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-4">
                    {navigation.map((group, groupIndex) => (
                        <div key={group.title || `group-${groupIndex}`} className="mb-6">
                            {group.title && (
                                <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    {group.title}
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.href;
                                    const Icon = item.icon;
                                    const showBadge =
                                        item.name === 'Peças' &&
                                        pendingPieces.length > 0;

                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            className={`
                                                group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                                                ${
                                                    isActive
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                }
                                            `}
                                        >
                                            <span className="flex items-center gap-3">
                                                <Icon
                                                    className={`
                                                        h-5 w-5 shrink-0
                                                        ${
                                                            isActive
                                                                ? 'text-blue-600'
                                                                : 'text-gray-400 group-hover:text-gray-600'
                                                        }
                                                    `}
                                                />
                                                {item.name}
                                            </span>
                                            {showBadge && (
                                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                                                    {pendingPieces.length > 99
                                                        ? '99+'
                                                        : pendingPieces.length}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="border-t border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-500">
                            <span className="text-sm font-semibold text-white">
                                {userInitial}
                            </span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                                {userName}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                                {user?.email}
                            </p>
                        </div>
                        <button
                            onClick={signOut}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Terminar sessão"
                        >
                            <LogOut className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </aside>

            {!isMobile && !sidebarOpen && (
                <button
                    onClick={toggleSidebar}
                    className="fixed left-0 top-20 z-50 rounded-r-lg bg-white p-2 shadow-lg transition-colors hover:bg-gray-100"
                >
                    <Menu className="h-5 w-5 text-gray-600" />
                </button>
            )}

            <main
                className={`
                    min-h-screen transition-all duration-300 w-full
                    ${sidebarOpen ? 'ml-64' : 'ml-0'}
                `}
            >
                {isMobile && (
                    <div className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-4">
                        <button
                            onClick={toggleSidebar}
                            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-indigo-600">
                                <Sparkles className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                                ContentOS
                            </span>
                        </div>
                    </div>
                )}
                <div className={isMobile ? 'pt-14' : ''}>
                    <div className="p-6">{children}</div>
                </div>
            </main>
        </div>
    );
}
