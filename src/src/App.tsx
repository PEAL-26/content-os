import { lazy, Suspense } from 'react';
import { ProtectedWorkspaceRoute } from '@/components/auth/protected-workspace-route';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { WorkspaceRedirect } from '@/components/auth/workspace-redirect';
import { LoadingScreen } from '@/components/auth/workspace-loading';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { SettingsLayout } from '@/components/layout/settings-layout';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
    useParams,
} from 'react-router-dom';

const LoginPage = lazy(() => import('@/pages/auth/login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/register').then((m) => ({ default: m.RegisterPage })));
const CreateWorkspacePage = lazy(() =>
    import('@/pages/onboarding/create-workspace').then((m) => ({ default: m.CreateWorkspacePage }))
);
const DashboardPage = lazy(() =>
    import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage }))
);
const ArticleList = lazy(() =>
    import('@/pages/articles/article-list').then((m) => ({ default: m.ArticleList }))
);
const ArticleEditor = lazy(() =>
    import('@/pages/articles/article-editor').then((m) => ({ default: m.ArticleEditor }))
);
const ContentPiecesPage = lazy(() =>
    import('@/pages/content/content-pieces').then((m) => ({ default: m.ContentPiecesPage }))
);
const VideoScriptsPage = lazy(() =>
    import('@/pages/content/video-scripts').then((m) => ({ default: m.VideoScriptsPage }))
);
const WeeklyPlannerPage = lazy(() =>
    import('@/pages/planner/weekly-planner').then((m) => ({ default: m.WeeklyPlannerPage }))
);
const ChannelsPage = lazy(() =>
    import('@/pages/settings/channels').then((m) => ({ default: m.ChannelsPage }))
);
const PillarsPage = lazy(() => import('@/pages/settings/Pillars').then((m) => ({ default: m.PillarsPage })));
const ProductsPage = lazy(() =>
    import('@/pages/settings/products').then((m) => ({ default: m.ProductsPage }))
);
const WorkspaceSettingsPage = lazy(() =>
    import('@/pages/settings/workspace-settings').then((m) => ({ default: m.WorkspaceSettingsPage }))
);
const AISettingsPage = lazy(() =>
    import('@/pages/settings/ai-settings').then((m) => ({ default: m.AISettingsPage }))
);

function PlaceholderPage({ title }: { title: string }) {
    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-2 text-gray-600">Página em desenvolvimento...</p>
        </div>
    );
}

/**
 * Redirecciona /:workspaceId para /:workspaceId/dashboard depois de o guard
 * validar e sincronizar o workspace. O guard corre primeiro porque envolve
 * este componente na rota.
 */
function NavigateWorkspaceToDashboard() {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    return <Navigate to={`/${workspaceId}/dashboard`} replace />;
}

export function App() {
    return (
        <BrowserRouter>
            <NuqsAdapter>
                <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />

                        <Route
                            path="/onboarding"
                            element={
                                <ProtectedRoute>
                                    <CreateWorkspacePage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Rota de workspace: /:workspaceId/settings/ai — mesma layout de
                        configurações; os dados de IA continuam globais (conta) */}
                        <Route
                            path="/:workspaceId/settings/ai"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <SettingsLayout>
                                            <AISettingsPage />
                                        </SettingsLayout>
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/settings"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <SettingsLayout>
                                            <WorkspaceSettingsPage />
                                        </SettingsLayout>
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        {/* Landing */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <WorkspaceRedirect />
                                </ProtectedRoute>
                            }
                        />

                        {/* Rotas com workspace na URL: /:workspaceId/rota */}
                        <Route
                            path="/:workspaceId"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <NavigateWorkspaceToDashboard />
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/dashboard"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <DashboardPage />
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/articles"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <ArticleList />
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/articles/:id/edit"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <ArticleEditor />
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/content"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <ContentPiecesPage />
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/video-scripts"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <VideoScriptsPage />
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/planning"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <WeeklyPlannerPage />
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/settings/pillars"
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
                            path="/:workspaceId/settings/channels"
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
                            path="/:workspaceId/settings/products"
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
                            path="/:workspaceId/settings/members"
                            element={
                                <ProtectedWorkspaceRoute>
                                    <DashboardLayout>
                                        <SettingsLayout>
                                            <PlaceholderPage title="Membros" />
                                        </SettingsLayout>
                                    </DashboardLayout>
                                </ProtectedWorkspaceRoute>
                            }
                        />

                        <Route
                            path="/:workspaceId/settings/:section"
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
                            path="*"
                            element={<Navigate to="/" replace />}
                        />
                    </Routes>
                </Suspense>
            </NuqsAdapter>
        </BrowserRouter>
    );
}