import { workspacePath } from '@/lib/workspace-paths';
import { Link, useLocation, useParams } from 'react-router-dom';

interface SettingsLayoutProps {
    children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
    const location = useLocation();
    const { workspaceId } = useParams<{ workspaceId: string }>();

    const settingsNav = workspaceId
        ? [
              {
                  name: 'Geral',
                  href: workspacePath(workspaceId, 'settings'),
              },
              {
                  name: 'IA',
                  href: workspacePath(workspaceId, 'settings/ai'),
              },
              {
                  name: 'Pilares',
                  href: workspacePath(workspaceId, 'settings/pillars'),
              },
              {
                  name: 'Canais',
                  href: workspacePath(workspaceId, 'settings/channels'),
              },
              {
                  name: 'Produtos',
                  href: workspacePath(workspaceId, 'settings/products'),
              },
              {
                  name: 'Membros',
                  href: workspacePath(workspaceId, 'settings/members'),
              },
          ]
        : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Configurações
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Gerir as configurações do workspace
                </p>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {settingsNav.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`border-b-2 px-1 pb-4 text-sm font-medium whitespace-nowrap ${
                                    isActive
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }`}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div>{children}</div>
        </div>
    );
}