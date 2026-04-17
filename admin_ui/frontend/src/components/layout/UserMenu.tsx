import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronRight, Settings, CreditCard, Users, FileText, BarChart3, HelpCircle, ExternalLink, LogOut, User as UserIcon, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../hooks/useTheme';

interface MenuItem {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    link?: string;
    subItems?: { label: string; link?: string; external?: boolean }[];
}

const menuGroups: { items: MenuItem[] }[] = [
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
            { label: 'Theme', icon: Sun, subItems: [
                { label: 'Light', link: 'light' },
                { label: 'Dark', link: 'dark' },
                { label: 'System', link: 'system' },
            ]},
            { label: 'Docs and resources', icon: HelpCircle, subItems: [
                { label: 'Documentation', link: '/help' },
                { label: 'Changelog', link: 'https://github.com/hkjarral/AVA-AI-Voice-Agent-for-Asterisk/releases', external: true },
                { label: 'Help center', link: '/help' },
            ]},
            { label: 'Terms and privacy', icon: FileText, subItems: [
                { label: 'Terms of service', link: '#', external: true },
                { label: 'Privacy policy', link: '#', external: true },
            ]},
        ],
    },
];

const UserMenu = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setHoveredItem(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleItemClick = (item: MenuItem) => {
        setIsOpen(false);
        setHoveredItem(null);
        if (item.label === 'Settings') {
            navigate('/settings');
        } else if (item.link && !item.subItems) {
            if (item.link.startsWith('/')) {
                navigate(item.link);
            } else {
                window.open(item.link, '_blank');
            }
        }
    };

    const handleSubItemClick = (subItem: { label: string; link?: string; external?: boolean }, parentLabel: string) => {
        setIsOpen(false);
        setHoveredItem(null);
        
        if (parentLabel === 'Theme') {
            setTheme(subItem.link as 'light' | 'dark' | 'system');
            return;
        }
        
        if (subItem.link) {
            if (subItem.link.startsWith('/')) {
                navigate(subItem.link);
            } else if (subItem.external) {
                window.open(subItem.link, '_blank');
            }
        }
    };

    const renderMenuItem = (item: MenuItem, index: number) => {
        const hasFlyout = item.subItems && item.subItems.length > 0;
        
        return (
            <div
                key={index}
                className={`relative ${hasFlyout ? 'has-flyout' : ''}`}
                onMouseEnter={() => hasFlyout && setHoveredItem(item.label)}
                onMouseLeave={() => hasFlyout && setHoveredItem(null)}
                onClick={() => !hasFlyout && handleItemClick(item)}
            >
                <div className={`flex items-center justify-between px-4 py-1.5 text-[13px] text-popover-foreground cursor-pointer hover:bg-accent dark:hover:bg-white/[0.06] rounded-sm mx-1`}>
                    <div className="flex items-center gap-3">
                        {item.icon && <item.icon className="w-4 h-4 text-muted-foreground" />}
                        {item.label}
                    </div>
                    {hasFlyout && <span className="text-[11px] text-muted-foreground">›</span>}
                </div>
                
                {hasFlyout && hoveredItem === item.label && (
                    <div className="absolute right-[calc(100%+6px)] top-[-6px] w-44 bg-popover border border-border rounded-[10px] py-1.5 z-20 shadow-xl">
                        {item.subItems?.map((subItem, subIndex) => (
                            <div
                                key={subIndex}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSubItemClick(subItem, item.label);
                                }}
                                className="flex items-center justify-between px-3.5 py-2 text-[13px] text-popover-foreground cursor-pointer hover:bg-accent"
                            >
                                <span>{subItem.label}</span>
                                <span className="flex items-center gap-2">
                                    {item.label === 'Theme' && subItem.link === theme && (
                                        <span className="text-primary">✓</span>
                                    )}
                                    {subItem.external && <span className="text-muted-foreground text-[12px]">↗</span>}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
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
                    <div className="bg-popover rounded-[14px] border border-border shadow-xl overflow-visible">
                        <div className="p-3.5 border-b border-border">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-[13px] font-medium text-popover-foreground">
                                    <div className="w-[15px] h-[15px] rounded-full border-2 border-popover-foreground border-r-0 border-transparent" />
                                    Balance
                                </div>
                                <button className="text-[11px] font-medium text-primary-foreground bg-transparent border border-border rounded-[6px] px-2 py-1 cursor-pointer hover:bg-accent">
                                    Upgrade
                                </button>
                            </div>
                            <div className="flex justify-between text-[12px] mb-0.5">
                                <span className="text-muted-foreground">Total</span>
                                <span className="text-popover-foreground font-medium">Unlimited</span>
                            </div>
                            <div className="flex justify-between text-[12px]">
                                <span className="text-muted-foreground">Remaining</span>
                                <span className="text-popover-foreground font-medium">Unlimited</span>
                            </div>
                        </div>

                        <div className="p-2.5 border-b border-border bg-muted">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] mb-1.5">
                                Current workspace
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[13px] font-semibold text-popover-foreground">Default</div>
                                    <div className="text-[11px] text-muted-foreground">Admin</div>
                                </div>
                                <div className="w-7 h-7 bg-muted rounded-[8px] flex items-center justify-center text-[13px] text-muted-foreground">
                                    ⇄
                                </div>
                            </div>
                        </div>

                        {menuGroups.map((group, groupIndex) => (
                            <div
                                key={groupIndex}
                                className="py-1.5 border-b border-border last:border-b-0"
                            >
                                {group.items.map((item, itemIndex) => renderMenuItem(item, itemIndex))}
                            </div>
                        ))}

                        <div
                            onClick={logout}
                            className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-popover-foreground cursor-pointer hover:bg-accent rounded-b-[14px]"
                        >
                            <LogOut className="w-4 h-4 text-muted-foreground" />
                            Sign out
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenu;