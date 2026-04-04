import { Link, useLocation } from 'react-router-dom'

interface SettingsLayoutProps {
    children: React.ReactNode
}

const settingsNav = [
    { name: 'Geral', href: '/dashboard/settings' },
    { name: 'Pilares', href: '/dashboard/settings/pillars' },
    { name: 'Canais', href: '/dashboard/settings/channels' },
    { name: 'Produtos', href: '/dashboard/settings/products' },
    { name: 'Membros', href: '/dashboard/settings/members' },
]

export function SettingsLayout({ children }: SettingsLayoutProps) {
    const location = useLocation()

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
                        const isActive = location.pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium ${
                                    isActive
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }`}
                            >
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            <div>{children}</div>
        </div>
    )
}
