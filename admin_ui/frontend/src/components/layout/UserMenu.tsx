import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, Settings, CreditCard, Users, FileText, BarChart3, HelpCircle, ExternalLink, LogOut, User as UserIcon, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../hooks/useTheme';

const menuGroups = [
    {
        items: [
            { label: 'Profile', icon: UserIcon },
            { label: 'Settings', icon: Settings },
        ],
    },
    {
        items: [
            { label: 'Usage Analytics', icon: BarChart3 },
            { label: 'Billing', icon: CreditCard },
            { label: 'Team', icon: Users },
        ],
    },
    {
        items: [
            { label: 'Documentation', icon: HelpCircle, external: true },
            { label: 'API Reference', icon: ExternalLink, external: true },
        ],
    },
];

const UserMenu = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { theme, cycleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleItemClick = (label: string) => {
        setIsOpen(false);
        if (label === 'Settings') {
            navigate('/settings');
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent transition-colors"
            >
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                        {user?.username?.charAt(0).toUpperCase() || 'A'}
                    </span>
                </div>
                <span className="text-sm font-medium text-foreground hidden sm:inline">
                    {user?.username || 'Admin'}
                </span>
                <ChevronUp
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64">
                    <div className="bg-[#1a1a1a] rounded-[14px] border border-white/10 overflow-hidden shadow-xl">
                        <div className="p-3.5 border-b border-white/[0.08]">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#e0e0e0]">
                                    <div className="w-4 h-4 rounded-full border-2 border-[#e0e0e0] border-r-0 border-transparent" />
                                    Credits
                                </div>
                                <button className="text-[11px] font-medium text-white bg-transparent border border-white/30 rounded-[6px] px-2 py-1 cursor-pointer hover:bg-white/[0.08]">
                                    Upgrade
                                </button>
                            </div>
                            <div className="flex justify-between text-[12px] mb-0.5">
                                <span className="text-[#888]">Total</span>
                                <span className="text-[#e0e0e0] font-medium">Unlimited</span>
                            </div>
                            <div className="flex justify-between text-[12px]">
                                <span className="text-[#888]">Remaining</span>
                                <span className="text-[#e0e0e0] font-medium">Unlimited</span>
                            </div>
                        </div>

                        <div className="p-2.5 border-b border-white/[0.08]">
                            <div className="text-[10px] text-[#666] uppercase tracking-[0.06em] mb-1.5">
                                Current workspace
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[13px] font-medium text-[#e0e0e0]">Default</div>
                                    <div className="text-[11px] text-[#888]">Admin</div>
                                </div>
                                <div className="w-7 h-7 bg-[#2a2a2a] border border-white/[0.12] rounded-[8px] flex items-center justify-center">
                                    <ChevronUp className="w-3.5 h-3.5 text-[#888]" />
                                </div>
                            </div>
                        </div>

                        {menuGroups.map((group, groupIndex) => (
                            <div
                                key={groupIndex}
                                className="py-1.5 border-b border-white/[0.08] last:border-b-0"
                            >
                                {group.items.map((item, itemIndex) => (
                                    <div
                                        key={itemIndex}
                                        onClick={() => handleItemClick(item.label)}
                                        className="flex items-center justify-between px-4 py-1.5 text-[13px] text-[#d0d0d0] cursor-pointer hover:bg-white/[0.06] rounded-sm mx-1"
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="w-4 h-4 text-[#888]" />
                                            {item.label}
                                        </div>
                                        {item.external && (
                                            <span className="text-[11px] text-[#555]">›</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}

                        <div className="py-1.5 border-b border-white/[0.08]">
                            <div className="px-4 py-1.5 text-[10px] text-[#666] uppercase tracking-[0.06em]">
                                Appearance
                            </div>
                            <div className="flex items-center justify-between px-4 py-2 mx-1">
                                <div className="flex items-center gap-3 text-[13px] text-[#d0d0d0]">
                                    {theme === 'light' && <Sun className="w-4 h-4 text-[#888]" />}
                                    {theme === 'dark' && <Moon className="w-4 h-4 text-[#888]" />}
                                    {theme === 'system' && <Monitor className="w-4 h-4 text-[#888]" />}
                                    <span className="capitalize">{theme}</span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        cycleTheme();
                                    }}
                                    className="text-[11px] text-[#888] hover:text-[#e0e0e0] underline"
                                >
                                    Switch
                                </button>
                            </div>
                        </div>

                        <div
                            onClick={logout}
                            className="flex items-center gap-1.5 px-4 py-2 text-[13px] text-[#d0d0d0] cursor-pointer hover:bg-white/[0.06] mt-1"
                        >
                            <LogOut className="w-3.5 h-3.5 text-[#888]" />
                            Sign out
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenu;