import { useState } from 'react';
import { Settings, Lock, User, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import axios from 'axios';

const SettingsPage = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Manage your account settings and preferences
                </p>
            </div>

            <div className="flex gap-6">
                <div className="w-48 shrink-0">
                    <nav className="space-y-1">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === 'profile'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                        >
                            <User className="w-4 h-4" />
                            Profile
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === 'security'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                        >
                            <Lock className="w-4 h-4" />
                            Security
                        </button>
                    </nav>
                </div>

                <div className="flex-1">
                    {activeTab === 'profile' && <ProfileTab user={user} />}
                    {activeTab === 'security' && <SecurityTab />}
                </div>
            </div>
        </div>
    );
};

const ProfileTab = ({ user }: { user: any }) => {
    return (
        <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold uppercase">
                        {user?.username?.substring(0, 2) || 'AD'}
                    </div>
                    <div>
                        <p className="font-medium text-lg">{user?.username || 'Admin'}</p>
                        <p className="text-sm text-muted-foreground capitalize">{user?.role || 'user'}</p>
                    </div>
                </div>
                <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                        Account details are managed by the administrator.
                    </p>
                </div>
            </div>
        </div>
    );
};

const SecurityTab = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setIsLoading(true);
        try {
            await axios.post('/api/auth/change-password', {
                old_password: currentPassword,
                new_password: newPassword
            });
            setMessage({ type: 'success', text: 'Password changed successfully' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.detail || 'Failed to change password'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Change Password</h2>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                {message && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                        message.type === 'success' 
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}>
                        {message.type === 'success' ? (
                            <CheckCircle className="w-4 h-4" />
                        ) : (
                            <AlertCircle className="w-4 h-4" />
                        )}
                        {message.text}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium mb-1.5">Current Password</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5">New Password</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                        minLength={6}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                        minLength={6}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Change Password
                </button>
            </form>
        </div>
    );
};

export default SettingsPage;
