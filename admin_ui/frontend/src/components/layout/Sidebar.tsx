import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    History,
    CalendarClock,
    Zap,
    Server,
    Workflow,
    MessageSquare,
    Wrench,
    Plug,
    Sliders,
    Activity,
    Zap,
    Brain,
    Radio,
    Globe,
    Container,
    FileText,
    Terminal,
    AlertTriangle,
    Code,
    HelpCircle,
    ExternalLink,
    HardDrive,
    ArrowUpCircle,
    Phone,
    CalendarClock,
    Lock,
    Users,
    GitBranch,
    Settings,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface SidebarItemProps {
    to: string;
    icon: React.ElementType;
    label: string;
    isCollapsed?: boolean;
    end?: boolean;
}

const SidebarItem = ({ to, icon: Icon, label, isCollapsed, end }: SidebarItemProps) => (
    <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            } ${isCollapsed ? 'justify-center px-0' : ''}`
        }
        title={isCollapsed ? label : undefined}
    >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {!isCollapsed && <span className="truncate">{label}</span>}
    </NavLink>
);

interface SidebarGroupProps {
    title: string;
    children: React.ReactNode;
    isCollapsed?: boolean;
}

const SidebarGroup = ({ title, children, isCollapsed }: SidebarGroupProps) => (
    <div className={`mb-6 ${isCollapsed ? 'px-0' : ''}`}>
        {!isCollapsed && (
            <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {title}
            </h3>
        )}
        <div className={`space-y-1 ${isCollapsed ? 'space-y-0' : ''}`}>
            {children}
        </div>
    </div>
);

interface SidebarProps {
    isCollapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed = false }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <aside className={`${isCollapsed ? 'w-16' : 'w-64'} border-r border-border bg-card/50 backdrop-blur flex flex-col h-full overflow-y-auto scrollbar-hide`}>
            {!isCollapsed && (
                <div className="p-6 border-b border-border/50">
                    <div className="flex items-center gap-3 font-bold text-xl tracking-tight">
                        <img
                            src="/mascot_transparent.png"
                            alt="AVA Mascot"
                            className="w-11 h-11 object-contain"
                        />
                        <div className="flex flex-col leading-none">
                            <span>AVA</span>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">AI Voice Agent for Asterisk</span>
                        </div>
                    </div>
                </div>
            )}

            {isCollapsed && (
                <div className="p-4 border-b border-border/50 flex justify-center">
                    <img
                        src="/mascot_transparent.png"
                        alt="AVA Mascot"
                        className="w-8 h-8 object-contain"
                    />
                </div>
            )}

            <div className={`flex-1 py-6 ${isCollapsed ? 'px-2 space-y-1' : 'px-3'}`}>
                <SidebarGroup title="Overview" isCollapsed={isCollapsed}>
                    <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" end isCollapsed={isCollapsed} />
                    <SidebarItem to="/history" icon={History} label="Call History" isCollapsed={isCollapsed} />
                    <SidebarItem to="/scheduling" icon={CalendarClock} label="Call Scheduling" isCollapsed={isCollapsed} />
                    <SidebarItem to="/wizard" icon={Zap} label="Setup Wizard" isCollapsed={isCollapsed} />
                </SidebarGroup>

                <SidebarGroup title="Configuration" isCollapsed={isCollapsed}>
                    <SidebarItem to="/providers" icon={Server} label="Providers" isCollapsed={isCollapsed} />
                    <SidebarItem to="/pipelines" icon={Workflow} label="Pipelines" isCollapsed={isCollapsed} />
                    <SidebarItem to="/contexts" icon={MessageSquare} label="Contexts" isCollapsed={isCollapsed} />
                    <SidebarItem to="/workflows" icon={GitBranch} label="Workflows" isCollapsed={isCollapsed} />
             <SidebarItem to="/workflows" icon={GitBranch} label="Workflows" isCollapsed={isCollapsed} />
                    <SidebarItem to="/profiles" icon={Sliders} label="Profiles" isCollapsed={isCollapsed} />
                    <SidebarItem to="/tools" icon={Wrench} label="Tools" isCollapsed={isCollapsed} />
                    <SidebarItem to="/mcp" icon={Plug} label="MCP Servers" isCollapsed={isCollapsed} />
                </SidebarGroup>

                <SidebarGroup title="Advanced" isCollapsed={isCollapsed}>
                    <SidebarItem to="/vad" icon={Activity} label="VAD" isCollapsed={isCollapsed} />
                    <SidebarItem to="/streaming" icon={Zap} label="Streaming" isCollapsed={isCollapsed} />
                    <SidebarItem to="/llm" icon={Brain} label="LLM Defaults" isCollapsed={isCollapsed} />
                    <SidebarItem to="/transport" icon={Radio} label="Transport" isCollapsed={isCollapsed} />
                    <SidebarItem to="/barge-in" icon={Globe} label="Barge-In" isCollapsed={isCollapsed} />
                    <SidebarItem to="/yaml" icon={Code} label="Raw YAML" isCollapsed={isCollapsed} />
                </SidebarGroup>

                <SidebarGroup title="System" isCollapsed={isCollapsed}>
                    <SidebarItem to="/env" icon={Container} label="Environment" isCollapsed={isCollapsed} />
                    <SidebarItem to="/docker" icon={HardDrive} label="Docker Services" isCollapsed={isCollapsed} />
                    <SidebarItem to="/asterisk" icon={Phone} label="Asterisk" isCollapsed={isCollapsed} />
                    <SidebarItem to="/logs" icon={FileText} label="System Logs" isCollapsed={isCollapsed} />
                    <SidebarItem to="/terminal" icon={Terminal} label="Terminal" isCollapsed={isCollapsed} />
                    <SidebarItem to="/models" icon={ArrowUpCircle} label="Models" isCollapsed={isCollapsed} />
                    <SidebarItem to="/updates" icon={AlertTriangle} label="Updates" isCollapsed={isCollapsed} />
                </SidebarGroup>

                <SidebarGroup title="Support" isCollapsed={isCollapsed}>
                    {isAdmin && (
                        <SidebarItem to="/users" icon={Users} label="User Management" isCollapsed={isCollapsed} />
                    )}
                    <SidebarItem to="/settings" icon={Settings} label="Settings" isCollapsed={isCollapsed} />
                    <SidebarItem to="/help" icon={HelpCircle} label="Help" isCollapsed={isCollapsed} />
                    <a
                        href="/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ${isCollapsed ? 'justify-center px-0' : ''}`}
                        title={isCollapsed ? 'API Docs' : undefined}
                    >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                        {!isCollapsed && 'API Docs'}
                    </a>
                </SidebarGroup>
            </div>
        </aside>
    );
};

export default Sidebar;