import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from '../CommandPalette';

const AppShell = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
            <CommandPalette />
            <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-200 flex-shrink-0 overflow-hidden`}>
                <Sidebar />
            </div>

            <main className="flex-1 flex flex-col min-w-0">
                <Header sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

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