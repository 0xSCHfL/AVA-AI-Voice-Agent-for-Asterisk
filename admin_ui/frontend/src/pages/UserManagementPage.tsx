import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useAuth } from '../auth/AuthContext';
import { Loader2, Plus, Pencil, Trash2, Shield, User as UserIcon, Mail, Key, AlertCircle, Check } from 'lucide-react';

interface User {
    username: string;
    email: string | null;
    role: 'admin' | 'user';
    disabled: boolean;
    must_change_password: boolean;
    created_at: string | null;
}

interface UserCreate {
    username: string;
    email: string | null;
    password: string;
    role: 'admin' | 'user';
}

interface UserUpdate {
    email?: string | null;
    role?: 'admin' | 'user';
    disabled?: boolean;
}

const UserManagementPage = () => {
    const { token, user: currentUser } = useAuth();
    const { confirm } = useConfirmDialog();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/auth/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch (err: any) {
            toast.error('Failed to load users', {
                description: err.response?.data?.detail || err.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (data: UserCreate) => {
        setSaving(true);
        try {
            await axios.post('/api/auth/register', data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('User created successfully');
            setIsCreateModalOpen(false);
            fetchUsers();
        } catch (err: any) {
            toast.error('Failed to create user', {
                description: err.response?.data?.detail || err.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateUser = async (username: string, data: UserUpdate) => {
        setSaving(true);
        try {
            await axios.put(`/api/auth/users/${username}`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('User updated successfully');
            setEditingUser(null);
            fetchUsers();
        } catch (err: any) {
            toast.error('Failed to update user', {
                description: err.response?.data?.detail || err.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (username: string) => {
        const confirmed = await confirm({
            title: 'Delete User',
            description: `Are you sure you want to delete user "${username}"? This action cannot be undone.`,
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (!confirmed) return;

        try {
            await axios.delete(`/api/auth/users/${username}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('User deleted successfully');
            fetchUsers();
        } catch (err: any) {
            toast.error('Failed to delete user', {
                description: err.response?.data?.detail || err.message
            });
        }
    };

    const handlePasswordReset = async () => {
        if (!resetEmail) {
            toast.error('Please enter an email address');
            return;
        }

        try {
            const res = await axios.post('/api/auth/password/reset', { email: resetEmail }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Reset token generated');
            setResetToken(res.data.reset_token || '');
            setShowPasswordReset(true);
        } catch (err: any) {
            toast.error('Failed to request password reset', {
                description: err.response?.data?.detail || err.message
            });
        }
    };

    const handlePasswordResetConfirm = async () => {
        if (!resetToken || !newPassword) {
            toast.error('Please provide both reset token and new password');
            return;
        }

        try {
            await axios.post('/api/auth/password/reset/confirm', {
                reset_token: resetToken,
                new_password: newPassword
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Password reset successfully');
            setResetEmail('');
            setResetToken('');
            setNewPassword('');
            setShowPasswordReset(false);
        } catch (err: any) {
            toast.error('Failed to reset password', {
                description: err.response?.data?.detail || err.message
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage admin users and access control.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowPasswordReset(true)}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                    >
                        <Key className="w-4 h-4 mr-2" />
                        Password Reset
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                    </button>
                </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-secondary/40 text-muted-foreground">
                        <tr>
                            <th className="text-left px-4 py-3 font-medium">User</th>
                            <th className="text-left px-4 py-3 font-medium">Email</th>
                            <th className="text-left px-4 py-3 font-medium">Role</th>
                            <th className="text-left px-4 py-3 font-medium">Status</th>
                            <th className="text-left px-4 py-3 font-medium">Created</th>
                            <th className="text-right px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {users.map((user) => (
                            <tr key={user.username} className="hover:bg-accent/50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold uppercase">
                                            {user.username.substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="font-medium">{user.username}</div>
                                            {user.username === currentUser?.username && (
                                                <span className="text-xs text-muted-foreground">(you)</span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {user.email || '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                        user.role === 'admin'
                                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                        {user.role === 'admin' ? (
                                            <Shield className="w-3 h-3" />
                                        ) : (
                                            <UserIcon className="w-3 h-3" />
                                        )}
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {user.disabled ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                <AlertCircle className="w-3 h-3" />
                                                Disabled
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                <Check className="w-3 h-3" />
                                                Active
                                            </span>
                                        )}
                                        {user.must_change_password && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                <Key className="w-3 h-3" />
                                                Must reset
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setEditingUser(user)}
                                            className="p-1.5 rounded hover:bg-accent transition-colors"
                                            title="Edit user"
                                        >
                                            <Pencil className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                        {user.username !== 'admin' && user.username !== currentUser?.username && (
                                            <button
                                                onClick={() => handleDeleteUser(user.username)}
                                                className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                                                title="Delete user"
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isCreateModalOpen && (
                <CreateUserModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSubmit={handleCreateUser}
                    saving={saving}
                />
            )}

            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSubmit={(data) => handleUpdateUser(editingUser.username, data)}
                    saving={saving}
                />
            )}

            {showPasswordReset && (
                <PasswordResetModal
                    email={resetEmail}
                    resetToken={resetToken}
                    newPassword={newPassword}
                    showConfirm={showPasswordReset && !!resetToken}
                    onEmailChange={setResetEmail}
                    onTokenChange={setResetToken}
                    onPasswordChange={setNewPassword}
                    onRequestReset={handlePasswordReset}
                    onConfirmReset={handlePasswordResetConfirm}
                    onClose={() => {
                        setShowPasswordReset(false);
                        setResetEmail('');
                        setResetToken('');
                        setNewPassword('');
                    }}
                />
            )}
        </div>
    );
};

interface ModalProps {
    onClose: () => void;
    saving?: boolean;
}

const CreateUserModal = ({ onClose, onSubmit, saving }: ModalProps & { onSubmit: (data: UserCreate) => void }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'user'>('user');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            username,
            email: email || null,
            password,
            role
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
                <h2 className="text-xl font-semibold mb-4">Create New User</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-3 py-2 rounded border border-input bg-background text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email (optional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded border border-input bg-background text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="w-full px-3 py-2 rounded border border-input bg-background text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                            className="w-full px-3 py-2 rounded border border-input bg-background text-sm"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium rounded border border-input hover:bg-accent transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditUserModal = ({ user, onClose, onSubmit, saving }: ModalProps & { user: User; onSubmit: (data: UserUpdate) => void }) => {
    const [email, setEmail] = useState(user.email || '');
    const [role, setRole] = useState<'admin' | 'user'>(user.role);
    const [disabled, setDisabled] = useState(user.disabled);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            email: email || null,
            role,
            disabled
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
                <h2 className="text-xl font-semibold mb-4">Edit User: {user.username}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Username</label>
                        <input
                            type="text"
                            value={user.username}
                            disabled
                            className="w-full px-3 py-2 rounded border border-input bg-muted text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email (optional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded border border-input bg-background text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                            disabled={user.username === 'admin'}
                            className="w-full px-3 py-2 rounded border border-input bg-background text-sm disabled:opacity-50"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="disabled"
                            checked={disabled}
                            onChange={(e) => setDisabled(e.target.checked)}
                            className="rounded"
                        />
                        <label htmlFor="disabled" className="text-sm font-medium">Account disabled</label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium rounded border border-input hover:bg-accent transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PasswordResetModal = ({
    email, resetToken, newPassword, showConfirm,
    onEmailChange, onTokenChange, onPasswordChange,
    onRequestReset, onConfirmReset, onClose
}: {
    email: string;
    resetToken: string;
    newPassword: string;
    showConfirm: boolean;
    onEmailChange: (v: string) => void;
    onTokenChange: (v: string) => void;
    onPasswordChange: (v: string) => void;
    onRequestReset: () => void;
    onConfirmReset: () => void;
    onClose: () => void;
}) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
                <h2 className="text-xl font-semibold mb-4">Password Reset</h2>

                {!showConfirm ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Enter the email address of the user who needs a password reset.
                        </p>
                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => onEmailChange(e.target.value)}
                                className="w-full px-3 py-2 rounded border border-input bg-background text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium rounded border border-input hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onRequestReset}
                                className="px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                Request Reset
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-3 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm">
                            Reset token generated. Complete the password reset below.
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Reset Token</label>
                            <input
                                type="text"
                                value={resetToken}
                                onChange={(e) => onTokenChange(e.target.value)}
                                className="w-full px-3 py-2 rounded border border-input bg-background text-sm font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => onPasswordChange(e.target.value)}
                                minLength={8}
                                className="w-full px-3 py-2 rounded border border-input bg-background text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium rounded border border-input hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirmReset}
                                className="px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                Reset Password
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagementPage;
