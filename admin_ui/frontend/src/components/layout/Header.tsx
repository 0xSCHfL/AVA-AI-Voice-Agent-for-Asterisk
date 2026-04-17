import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, PanelLeftClose, PanelLeft, ChevronDown, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import UserMenu from './UserMenu';

interface Provider {
    name: string;
    type: string;
    is_full_agent: boolean;
    contexts: {
        name: string;
        description: string;
    }[];
}

interface ProvidersSummary {
    current: {
        provider: string | null;
        context: string | null;
    };
    available_providers: Provider[];
}

interface HeaderProps {
    sidebarOpen?: boolean;
    onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ sidebarOpen = true, onToggleSidebar }) => {
    const location = useLocation();
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const [providersSummary, setProvidersSummary] = useState<ProvidersSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const res = await axios.get('/api/config/providers-summary');
                setProvidersSummary(res.data);
            } catch (err) {
                console.error('Failed to fetch providers:', err);
            }
        };
        fetchProviders();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleProviderSwitch = async (providerName: string, contextName: string | null) => {
        setIsLoading(true);
        setIsDropdownOpen(false);
        try {
            const res = await axios.post('/api/config/switch-provider', {
                provider: providerName,
                context: contextName || '',
            });
            toast.success(res.data.message || `Switched to ${providerName}`);
            // Refresh providers summary
            const res2 = await axios.get('/api/config/providers-summary');
            setProvidersSummary(res2.data);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to switch provider');
        } finally {
            setIsLoading(false);
        }
    };

    const getBreadcrumbName = (segment: string) => {
        const map: Record<string, string> = {
            'providers': 'Providers',
            'pipelines': 'Pipelines',
            'contexts': 'Contexts',
            'tools': 'Tools',
            'vad': 'Voice Activity Detection',
            'streaming': 'Streaming',
            'llm': 'LLM Defaults',
            'env': 'Environment',
            'docker': 'Docker Services',
            'logs': 'System Logs',
            'yaml': 'Raw Configuration',
            'settings': 'Settings',
            'help': 'Help',
            'users': 'User Management',
            'users-new': 'Add User'
        };
        return map[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    };

    const currentProvider = providersSummary?.current?.provider || 'None';
    const currentContext = providersSummary?.current?.context || '';

    return (
        <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 z-10 sticky top-0">
            <div className="flex items-center gap-3">
                {onToggleSidebar && (
                    <button
                        onClick={onToggleSidebar}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                    >
                        {sidebarOpen ? (
                            <PanelLeftClose className="w-5 h-5 text-muted-foreground" />
                        ) : (
                            <PanelLeft className="w-5 h-5 text-muted-foreground" />
                        )}
                    </button>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Admin</span>
                    {pathSegments.length > 0 && <ChevronRight className="w-4 h-4" />}
                    {pathSegments.map((segment, index) => (
                        <React.Fragment key={segment}>
                            <span className={index === pathSegments.length - 1 ? 'font-medium text-foreground' : ''}>
                                {getBreadcrumbName(segment)}
                            </span>
                            {index < pathSegments.length - 1 && <ChevronRight className="w-4 h-4" />}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Provider Switcher */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
                    >
                        <Zap className="w-4 h-4 text-yellow-500" />
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <span className="font-medium">
                                    {currentProvider}
                                    {currentContext && ` - ${currentContext}`}
                                </span>
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </>
                        )}
                    </button>

                    {isDropdownOpen && providersSummary && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                            <div className="px-3 py-2 border-b border-border bg-muted/50">
                                <p className="text-xs font-medium text-muted-foreground">Switch Provider</p>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {providersSummary.available_providers.map((provider) => (
                                    <div key={provider.name} className="border-b border-border last:border-b-0">
                                        <div className="px-3 py-2 bg-muted/30">
                                            <p className="text-sm font-medium">{provider.name}</p>
                                            <p className="text-xs text-muted-foreground">{provider.type}</p>
                                        </div>
                                        {provider.contexts.length > 0 && (
                                            <div className="bg-muted/10">
                                                {provider.contexts.map((ctx) => (
                                                    <button
                                                        key={ctx.name}
                                                        onClick={() => handleProviderSwitch(provider.name, ctx.name)}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                                                    >
                                                        <span>{ctx.name}</span>
                                                        {providersSummary.current.provider === provider.name && 
                                                         providersSummary.current.context === ctx.name && (
                                                            <span className="text-xs text-green-500">✓</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {provider.contexts.length === 0 && (
                                            <button
                                                onClick={() => handleProviderSwitch(provider.name, null)}
                                                className="w-full px-4 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                                            >
                                                Use default context
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <UserMenu />
            </div>
        </header>
    );
};

export default Header;
