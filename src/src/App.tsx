import { ProtectedWorkspaceRoute } from '@/components/auth/protected-workspace-route';
import { DashboardLayout } from '@/layouts/dashboard-layout';
import { SettingsLayout } from '@/layouts/settings-layout';
import { ArticleEditor } from '@/pages/articles/article-editor';
import { ArticleList } from '@/pages/articles/article-list';
import { DashboardPage } from '@/pages/dashboard';
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';
import { ContentPiecesPage } from '@/pages/content/content-pieces';
import { VideoScriptsPage } from '@/pages/content/video-scripts';
import { WeeklyPlannerPage } from '@/pages/planner/weekly-planner';
import { CreateWorkspacePage } from '@/pages/onboarding/create-workspace';
import { ChannelsPage } from '@/pages/settings/channels';
import { PillarsPage } from '@/pages/settings/pillars';
import { ProductsPage } from '@/pages/settings/products';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

function PlaceholderPage({ title }: { title: string }) {
    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-2 text-gray-600">Página em desenvolvimento...</p>
        </div>
    );
}

function SettingsHome() {
    return (
        <div>
            <p className="text-gray-500">
                Selecione uma categoria de configurações no menu acima.
            </p>
        </div>
    );
}

export function App() {
    return (
        <BrowserRouter>
            <NuqsAdapter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    <Route
                        path="/onboarding"
                        element={<CreateWorkspacePage />}
                    />

                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedWorkspaceRoute>
                                <DashboardLayout>
                                    <DashboardPage />
                                </DashboardLayout>
                            </ProtectedWorkspaceRoute>
                        }
                    />

                    <Route
                        path="/dashboard/articles"
                        element={
                            <ProtectedWorkspaceRoute>
                                <DashboardLayout>
                                    <ArticleList />
                                </DashboardLayout>
                            </ProtectedWorkspaceRoute>
                        }
                    />

                    <Route
                        path="/dashboard/articles/:id/edit"
                        element={
                            <ProtectedWorkspaceRoute>
                                <DashboardLayout>
                                    <ArticleEditor />
                                </DashboardLayout>
                            </ProtectedWorkspaceRoute>
                        }
                    />

                    <Route
                        path="/dashboard/content"
                        element={
                            <ProtectedWorkspaceRoute>
                                <DashboardLayout>
                                    <ContentPiecesPage />
                                </DashboardLayout>
                            </ProtectedWorkspaceRoute>
                        }
                    />

                    <Route
                        path="/dashboard/video-scripts"
                        element={
                            <ProtectedWorkspaceRoute>
                                <DashboardLayout>
                                    <VideoScriptsPage />
                                </DashboardLayout>
                            </ProtectedWorkspaceRoute>
                        }
                    />

                    <Route
                        path="/dashboard/planning"
                        element={
                            <ProtectedWorkspaceRoute>
                                <DashboardLayout>
                                    <WeeklyPlannerPage />
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
                        path="/dashboard/settings/channels"
                        element={
                            <ProtectedWorkspaceRoute>
                                <DashboardLayout>
                                    <SettingsLayout>
                                        <ChannelsPage />
                                    </SettingsLayout>
                                </DashboardLayout>
                            </ProtectedWorkspaceRoute>
                        }
                    />

                    <Route
                        path="/dashboard/settings/products"
                        element={
                            <ProtectedWorkspaceRoute>
                                <DashboardLayout>
                                    <SettingsLayout>
                                        <ProductsPage />
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
            </NuqsAdapter>
        </BrowserRouter>
    );
}
