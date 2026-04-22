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
const WorkflowsPage = lazy(() => import("./pages/WorkflowsPage"));
const IVRPage = lazy(() => import("./pages/IVRPage"));
const IVREditorPage = lazy(() => import("./pages/IVREditorPage"));

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
);

// Auth Gate — redirects to login if unauthenticated
const AuthGate = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Don't redirect on login page
        if (location.pathname === '/login') return;
        
        if (!loading && !user) {
            navigate('/login', { replace: true });
        }
    }, [loading, user, navigate, location.pathname]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return <>{children}</>;
};

// Admin Gate — redirects to home if not admin
const AdminGate = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    if (user && user.role !== 'admin') {
        navigate('/', { replace: true });
        return null;
    }

    return <>{children}</>;
};

// Page Gate — redirects to home if user doesn't have access to this page
const PageGate = ({ children, path }: { children: React.ReactNode; path: string }) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const canAccess = () => {
        if (user?.role === 'admin') return true;
        if (!user?.pages) return false;
        return user.pages.includes(path);
    };

    useEffect(() => {
        if (!loading && user && !canAccess()) {
            navigate('/', { replace: true });
        }
    }, [loading, user, navigate]);

    if (!loading && user && !canAccess()) {
        return null;
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
                            <AuthGate>
                                <Suspense fallback={<PageLoader />}>
                                    <Routes>
                                        <Route path="/login" element={<LoginPage />} />
                                        <Route path="/wizard" element={<Wizard />} />
                                        <Route element={<LayoutWrapper />}>
                                        <Route path="/" element={<PageGate path="/"><Dashboard /></PageGate>} />
                                        <Route path="/history" element={<PageGate path="/history"><CallHistoryPage /></PageGate>} />
                                        <Route path="/scheduling" element={<PageGate path="/scheduling"><CallSchedulingPage /></PageGate>} />
                                        <Route path="/providers" element={<PageGate path="/providers"><ProvidersPage /></PageGate>} />
                                        <Route path="/pipelines" element={<PageGate path="/pipelines"><PipelinesPage /></PageGate>} />
                                        <Route path="/contexts" element={<PageGate path="/contexts"><ContextsPage /></PageGate>} />
                                        <Route path="/workflows" element={<PageGate path="/workflows"><WorkflowsPage /></PageGate>} />
                                        <Route path="/ivrs" element={<PageGate path="/ivrs"><IVRPage /></PageGate>} />
                                        <Route path="/ivrs/:name" element={<IVREditorPage />} />
                                        <Route path="/profiles" element={<PageGate path="/profiles"><ProfilesPage /></PageGate>} />
                                        <Route path="/tools" element={<PageGate path="/tools"><ToolsPage /></PageGate>} />
                                        <Route path="/mcp" element={<PageGate path="/mcp"><MCPPage /></PageGate>} />
                                        <Route path="/users" element={<AdminGate><UserManagementPage /></AdminGate>} />
                                        <Route path="/vad" element={<PageGate path="/vad"><VADPage /></PageGate>} />
                                        <Route path="/streaming" element={<PageGate path="/streaming"><StreamingPage /></PageGate>} />
                                        <Route path="/llm" element={<PageGate path="/llm"><LLMPage /></PageGate>} />
                                        <Route path="/transport" element={<PageGate path="/transport"><TransportPage /></PageGate>} />
                                        <Route path="/barge-in" element={<PageGate path="/barge-in"><BargeInPage /></PageGate>} />
                                        <Route path="/yaml" element={<PageGate path="/yaml"><RawYamlPage /></PageGate>} />
                                        <Route path="/env" element={<PageGate path="/env"><EnvPage /></PageGate>} />
                                        <Route path="/docker" element={<PageGate path="/docker"><DockerPage /></PageGate>} />
                                        <Route path="/asterisk" element={<PageGate path="/asterisk"><AsteriskPage /></PageGate>} />
                                        <Route path="/logs" element={<PageGate path="/logs"><LogsPage /></PageGate>} />
                                        <Route path="/terminal" element={<PageGate path="/terminal"><TerminalPage /></PageGate>} />
                                        <Route path="/models" element={<PageGate path="/models"><ModelsPage /></PageGate>} />
                                        <Route path="/updates" element={<PageGate path="/updates"><UpdatesPage /></PageGate>} />
                                        <Route path="/help" element={<PageGate path="/help"><HelpPage /></PageGate>} />
                                        <Route path="/settings" element={<PageGate path="/settings"><SettingsPage /></PageGate>} />
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </Route>
                                </Routes>
                            </Suspense>
                            </AuthGate>
                        </SetupGuard>
                    </SidebarProvider>
                </ConfirmDialogProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;