import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react';
import UserMenu from './UserMenu';

interface HeaderProps {
    sidebarOpen?: boolean;
    onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ sidebarOpen = true, onToggleSidebar }) => {
    const location = useLocation();
    const pathSegments = location.pathname.split('/').filter(Boolean);

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

            <div className="flex items-center gap-2">
                <UserMenu />
            </div>
        </header>
    );
};

export default Header;