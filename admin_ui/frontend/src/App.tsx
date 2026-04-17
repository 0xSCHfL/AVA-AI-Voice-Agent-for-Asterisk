import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ConfirmDialogProvider } from './hooks/useConfirmDialog';
import { AuthProvider, RequireAuth, useAuth } from './auth/AuthContext';
import { SidebarProvider, useSidebar } from './hooks/useSidebar';

function decodeJWTPayload(token: string): Record<string, any> {
    try {
        const base64 = token.replace(/-/g, '+').replace(/_/g, '/').split('.')[1];
        return JSON.parse(atob(base64));
    } catch {
        return {};
    }
}
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import CallHistoryPage from './pages/CallHistoryPage';
import CallSchedulingPage from './pages/CallSchedulingPage';
import axios from 'axios';

// Core Configuration Pages
import ProvidersPage from './pages/ProvidersPage';
import PipelinesPage from './pages/PipelinesPage';
import ContextsPage from './pages/ContextsPage';
import ProfilesPage from './pages/ProfilesPage';
import ToolsPage from './pages/ToolsPage';
import MCPPage from './pages/MCPPage';

// Advanced Configuration Pages
import VADPage from './pages/Advanced/VADPage';
import StreamingPage from './pages/Advanced/StreamingPage';
import LLMPage from './pages/Advanced/LLMPage';
import TransportPage from './pages/Advanced/TransportPage';
import BargeInPage from './pages/Advanced/BargeInPage';

// System Pages (eagerly loaded)
import EnvPage from './pages/System/EnvPage';
import DockerPage from './pages/System/DockerPage';

// Help
import HelpPage from './pages/HelpPage';

// Settings
import SettingsPage from './pages/SettingsPage';

// User Management
import UserManagementPage from './pages/UserManagementPage';

// Auth
import LoginPage from './pages/LoginPage';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage';

// Lazy-loaded heavy pages (code-splitting for better initial load)
const Wizard = lazy(() => import('./pages/Wizard'));
const RawYamlPage = lazy(() => import('./pages/Advanced/RawYamlPage'));
const LogsPage = lazy(() => import('./pages/System/LogsPage'));
const TerminalPage = lazy(() => import('./pages/System/TerminalPage'));
const ModelsPage = lazy(() => import('./pages/System/ModelsPage'));
const UpdatesPage = lazy(() => import('./pages/System/UpdatesPage'));
const AsteriskPage = lazy(() => import('./pages/System/AsteriskPage'));

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
);

// Auth Gate — redirects to login if unauthenticated, or to force-password-change if required
const AuthGate = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login', { replace: true });
            return;
        }
        if (!loading && user) {
            const token = localStorage.getItem('token');
            if (token) {
                const payload = decodeJWTPayload(token);
                if (payload.must_change_password && location.pathname !== '/force-password-change') {
                    navigate('/force-password-change', { replace: true });
                }
            }
        }
    }, [loading, user, location.pathname, navigate]);

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return <>{children}</>;
};

// Auth/Setup Guard
const SetupGuard = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let mounted = true;

        const checkStatus = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const res = await axios.get('/api/wizard/status', {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!mounted) return;

                const data = res.data;
                if (data.completed === false && location.pathname !== '/wizard') {
                    navigate('/wizard', { replace: true });
                } else if (data.completed === true && location.pathname === '/wizard') {
                    navigate('/', { replace: true });
                }
                setLoading(false);
            } catch (err: any) {
                if (!mounted) return;
                if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
                    setError('Connection timeout - is the admin UI backend running?');
                } else if (err.response?.status === 401) {
                    setLoading(false);
                } else {
                    setError(err.message || 'Failed to check wizard status');
                }
                setLoading(false);
            }
        };

        checkStatus();

        return () => {
            mounted = false;
        };
    }, [navigate, location.pathname]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-destructive text-lg mb-2">Error</p>
                    <p className="text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

// Layout wrapper that uses sidebar context
const LayoutWrapper = () => {
    const { sidebarOpen, toggleSidebar } = useSidebar();
    return <AppShell sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />;
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <ConfirmDialogProvider>
                    <SidebarProvider>
                        <Toaster position="top-right" richColors />
                        <SetupGuard>
                            <Suspense fallback={<PageLoader />}>
                                <Routes>
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route path="/force-password-change" element={<ForcePasswordChangePage />} />
                                    <Route path="/wizard" element={<Wizard />} />

                                    <Route element={<AuthGate />}>
                                        <Route element={<LayoutWrapper />}>
                                            <Route path="/" element={<Dashboard />} />
                                            <Route path="/history" element={<CallHistoryPage />} />
                                            <Route path="/scheduling" element={<CallSchedulingPage />} />

                                            <Route path="/providers" element={<ProvidersPage />} />
                                            <Route path="/pipelines" element={<PipelinesPage />} />
                                            <Route path="/contexts" element={<ContextsPage />} />
                                            <Route path="/profiles" element={<ProfilesPage />} />
                                            <Route path="/tools" element={<ToolsPage />} />
                                            <Route path="/mcp" element={<MCPPage />} />
                                            <Route path="/users" element={<UserManagementPage />} />

                                            <Route path="/vad" element={<VADPage />} />
                                            <Route path="/streaming" element={<StreamingPage />} />
                                            <Route path="/llm" element={<LLMPage />} />
                                            <Route path="/transport" element={<TransportPage />} />
                                            <Route path="/barge-in" element={<BargeInPage />} />
                                            <Route path="/yaml" element={<RawYamlPage />} />

                                            <Route path="/env" element={<EnvPage />} />
                                            <Route path="/docker" element={<DockerPage />} />
                                            <Route path="/asterisk" element={<AsteriskPage />} />
                                            <Route path="/logs" element={<LogsPage />} />
                                            <Route path="/terminal" element={<TerminalPage />} />
                                            <Route path="/models" element={<ModelsPage />} />
                                            <Route path="/updates" element={<UpdatesPage />} />

                                            <Route path="/help" element={<HelpPage />} />

                                            <Route path="/settings" element={<SettingsPage />} />

                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Route>
                                    </Route>
                                </Routes>
                            </Suspense>
                        </SetupGuard>
                    </SidebarProvider>
                </ConfirmDialogProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;