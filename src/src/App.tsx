import { ProtectedWorkspaceRoute } from '@/components/auth/protected-workspace-route'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { SettingsLayout } from '@/layouts/settings-layout'
import { LoginPage } from '@/pages/auth/login'
import { RegisterPage } from '@/pages/auth/register'
import { CreateWorkspacePage } from '@/pages/onboarding/create-workspace'
import { PillarsPage } from '@/pages/settings/Pillars'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

function DashboardHome() {
    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">
                Bem-vindo ao ContentOS! Selecione uma opção no menu lateral.
            </p>
        </div>
    )
}

function PlaceholderPage({ title }: { title: string }) {
    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-2 text-gray-600">Página em desenvolvimento...</p>
        </div>
    )
}

function SettingsHome() {
    return (
        <div>
            <p className="text-gray-500">
                Selecione uma categoria de configurações no menu acima.
            </p>
        </div>
    )
}

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route path="/onboarding" element={<CreateWorkspacePage />} />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedWorkspaceRoute>
                            <DashboardLayout>
                                <DashboardHome />
                            </DashboardLayout>
                        </ProtectedWorkspaceRoute>
                    }
                />

                <Route
                    path="/dashboard/articles"
                    element={
                        <ProtectedWorkspaceRoute>
                            <DashboardLayout>
                                <PlaceholderPage title="Artigos" />
                            </DashboardLayout>
                        </ProtectedWorkspaceRoute>
                    }
                />

                <Route
                    path="/dashboard/content"
                    element={
                        <ProtectedWorkspaceRoute>
                            <DashboardLayout>
                                <PlaceholderPage title="Conteúdo" />
                            </DashboardLayout>
                        </ProtectedWorkspaceRoute>
                    }
                />

                <Route
                    path="/dashboard/planning"
                    element={
                        <ProtectedWorkspaceRoute>
                            <DashboardLayout>
                                <PlaceholderPage title="Planeamento" />
                            </DashboardLayout>
                        </ProtectedWorkspaceRoute>
                    }
                />

                <Route
                    path="/dashboard/settings"
                    element={
                        <ProtectedWorkspaceRoute>
                            <DashboardLayout>
                                <SettingsLayout>
                                    <SettingsHome />
                                </SettingsLayout>
                            </DashboardLayout>
                        </ProtectedWorkspaceRoute>
                    }
                />

                <Route
                    path="/dashboard/settings/pillars"
                    element={
                        <ProtectedWorkspaceRoute>
                            <DashboardLayout>
                                <SettingsLayout>
                                    <PillarsPage />
                                </SettingsLayout>
                            </DashboardLayout>
                        </ProtectedWorkspaceRoute>
                    }
                />

                <Route
                    path="/dashboard/settings/:section"
                    element={
                        <ProtectedWorkspaceRoute>
                            <DashboardLayout>
                                <SettingsLayout>
                                    <PlaceholderPage title="Configurações" />
                                </SettingsLayout>
                            </DashboardLayout>
                        </ProtectedWorkspaceRoute>
                    }
                />

                <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                />

                <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                />
            </Routes>
        </BrowserRouter>
    )
}
