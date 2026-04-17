import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import axios from 'axios';

const ForcePasswordChangePage: React.FC = () => {
    const { user, changePassword, logout } = useAuth();
    const navigate = useNavigate();
    const [oldPassword] = useState(''); // Not needed for forced change
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!newPassword) {
            setError('New password is required');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await changePassword(oldPassword, newPassword);
            setSuccess(true);
            // Redirect to dashboard after short delay
            setTimeout(() => {
                navigate('/', { replace: true });
            }, 1500);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border border-border shadow-lg">
                <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-yellow-500/10 rounded-full">
                            <AlertCircle className="w-8 h-8 text-yellow-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Change Password Required</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        You must change your password before continuing.
                        Please set a new password for your account.
                    </p>
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-md flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded-md flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Password changed successfully! Redirecting...
                    </div>
                )}

                {!success && (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="new-password" className="block text-sm font-medium mb-1">
                                    New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <input
                                        id="new-password"
                                        type="password"
                                        required
                                        className="appearance-none relative block w-full px-3 py-2 pl-10 border border-input bg-background placeholder-muted-foreground text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
                                        placeholder="Enter new password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <input
                                        id="confirm-password"
                                        type="password"
                                        required
                                        className="appearance-none relative block w-full px-3 py-2 pl-10 border border-input bg-background placeholder-muted-foreground text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
                                        placeholder="Confirm new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Changing password...
                                    </>
                                ) : (
                                    'Change Password'
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="group relative w-full flex justify-center py-2 px-4 border border-input text-sm font-medium rounded-md text-muted-foreground hover:bg-accent transition-colors"
                            >
                                Sign out and use a different account
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForcePasswordChangePage;
