import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from '../CommandPalette';

interface AppShellProps {
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
}

const AppShell: React.FC<AppShellProps> = ({ sidebarOpen, onToggleSidebar }) => {
    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
            <CommandPalette />
            <div className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-200 flex-shrink-0`}>
                <Sidebar isCollapsed={!sidebarOpen} />
            </div>

            <main className="flex-1 flex flex-col min-w-0">
                <Header sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} />

                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-6xl mx-auto">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AppShell;