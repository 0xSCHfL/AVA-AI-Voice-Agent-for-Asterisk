import { useState } from 'react';
import { 
    User, 
    Lock, 
    CreditCard, 
    Globe, 
    Bell, 
    Download, 
    LogOut, 
    Trash2, 
    Shield,
    ChevronRight,
    Loader2,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import axios from 'axios';

interface SettingsItemProps {
    icon: React.ElementType;
    title: string;
    description: string;
    action?: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
}

const SettingsItem = ({ icon: Icon, title, description, action, onClick, danger }: SettingsItemProps) => (
    <div 
        className={`flex items-center justify-between py-4 border-b border-border last:border-b-0 ${onClick ? 'cursor-pointer hover:bg-accent/50 -mx-4 px-4' : ''}`}
        onClick={onClick}
    >
        <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${danger ? 'bg-red-500/10' : 'bg-accent'}`}>
                <Icon className={`w-5 h-5 ${danger ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
                <p className={`font-medium ${danger ? 'text-red-500' : ''}`}>{title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>
        </div>
        {action && <div>{action}</div>}
        {onClick && !action && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
    </div>
);

const SettingsPage = () => {
    const { user, logout } = useAuth();
    const [givenName, setGivenName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleUpdateName = async () => {
        if (!givenName.trim()) return;
        setIsSaving(true);
        setSaveMessage(null);
        
        try {
            await axios.post('/api/auth/update-profile', { given_name: givenName });
            setSaveMessage({ type: 'success', text: 'Name updated successfully' });
        } catch (error: any) {
            setSaveMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update name' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOutAll = () => {
        if (confirm('Are you sure you want to sign out of all devices?')) {
            logout();
        }
    };

    const handleDeleteAccount = () => {
        if (confirm('Are you sure you want to delete your entire account? This action cannot be undone.')) {
            alert('Account deletion would be processed here');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Manage your profile and workspace memberships.
                </p>
            </div>

            {/* Profile Section */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Profile</h2>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between py-4 border-b border-border">
                        <div>
                            <p className="font-medium">E-Mail Address</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{user?.username || 'admin@example.com'}</p>
                        </div>
                    </div>

                    <div className="py-4 border-b border-border">
                        <p className="font-medium mb-2">Given Name</p>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={givenName}
                                onChange={(e) => setGivenName(e.target.value)}
                                placeholder="Enter your name"
                                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <button
                                onClick={handleUpdateName}
                                disabled={isSaving || !givenName.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                Update Given Name
                            </button>
                        </div>
                        {saveMessage && (
                            <div className={`mt-2 flex items-center gap-2 text-sm ${
                                saveMessage.type === 'success' ? 'text-green-500' : 'text-red-500'
                            }`}>
                                {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                {saveMessage.text}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between py-4">
                        <div>
                            <p className="font-medium">Current Plan</p>
                            <p className="text-sm text-muted-foreground mt-0.5">Free</p>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors">
                            <CreditCard className="w-4 h-4" />
                            Manage Subscription
                        </button>
                    </div>
                </div>
            </div>

            {/* Account Section */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="space-y-0">
                    <SettingsItem
                        icon={Shield}
                        title="Two-Factor Authentication"
                        description="Disabled"
                        action={
                            <button className="text-sm font-medium text-primary hover:underline">
                                Add Two-Factor Authentication
                            </button>
                        }
                    />

                    <SettingsItem
                        icon={CreditCard}
                        title="Usage & Credit Ceilings"
                        description="See Details"
                    />

                    <SettingsItem
                        icon={Bell}
                        title="Comment Notifications"
                        description="Manage your email notification preferences for comments"
                        action={
                            <button className="text-sm font-medium text-primary hover:underline">
                                Manage Notifications
                            </button>
                        }
                    />

                    <SettingsItem
                        icon={Download}
                        title="Download your data"
                        description="Request a copy of your data for export. You will receive an email when your export is ready for download."
                        action={
                            <button className="text-sm font-medium text-primary hover:underline">
                                Request Data Export
                            </button>
                        }
                    />

                    <SettingsItem
                        icon={Globe}
                        title="Application language"
                        description="English"
                    />
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-card rounded-xl border border-red-500/20 p-6">
                <div className="space-y-0">
                    <SettingsItem
                        icon={LogOut}
                        title="Sign out of all devices"
                        description="Sign out of all devices and sessions. You will need to sign in again on all devices."
                        onClick={handleSignOutAll}
                    />

                    <SettingsItem
                        icon={Trash2}
                        title="Delete Entire Account"
                        description="Permanently delete your entire account across all workspaces. You will no longer be able to create an account with this email."
                        onClick={handleDeleteAccount}
                        danger
                    />
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;