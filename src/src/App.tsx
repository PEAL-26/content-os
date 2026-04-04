import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/auth/protected-route'
import { useAuthContext } from './context/auth-context'
import { LoginPage } from './pages/auth/login'
import { RegisterPage } from './pages/auth/register'

function DashboardPlaceholder() {
    const { signOut } = useAuthContext()
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="mt-2 text-gray-600">Bem-vindo ao ContentOS!</p>
                <button
                    onClick={signOut}
                    className="mt-4 rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
                >
                    Logout
                </button>
            </div>
        </div>
    )
}

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <DashboardPlaceholder />
                        </ProtectedRoute>
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
