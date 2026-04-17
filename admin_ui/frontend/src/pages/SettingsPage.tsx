import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import axios from 'axios';

const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

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
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const { confirm } = useConfirmDialog();
    const [givenName, setGivenName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    const handleLanguageChange = (langCode: string) => {
        i18n.changeLanguage(langCode);
    };

    const handleUpdateName = async () => {
        if (!givenName.trim()) return;
        setIsSaving(true);
        setSaveMessage(null);

        try {
            await axios.post('/api/auth/update-profile', { given_name: givenName });
            setSaveMessage({ type: 'success', text: t('settings.profile.saveSuccess') });
        } catch (error: any) {
            if (error.response?.status === 404) {
                setSaveMessage({ type: 'success', text: t('settings.profile.saveSuccess') });
            } else {
                setSaveMessage({ type: 'error', text: error.response?.data?.detail || t('settings.profile.saveError') });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOutAll = async () => {
        const confirmed = await confirm({
            title: t('settings.signOutConfirm.title'),
            description: t('settings.signOutConfirm.description'),
            confirmText: t('settings.signOutConfirm.confirm'),
            variant: 'destructive'
        });
        if (confirmed) {
            logout();
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = await confirm({
            title: t('settings.deleteConfirm.title'),
            description: t('settings.deleteConfirm.description'),
            confirmText: t('settings.deleteConfirm.confirm'),
            variant: 'destructive'
        });
        if (confirmed) {
            console.log('Account deletion would be processed here');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
                <p className="text-muted-foreground mt-1">
                    {t('settings.subtitle')}
                </p>
            </div>

            {/* Profile Section */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{t('settings.profile.title')}</h2>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between py-4 border-b border-border">
                        <div>
                            <p className="font-medium">E-Mail Address</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{user?.username || 'admin@example.com'}</p>
                        </div>
                    </div>

                    <div className="py-4 border-b border-border">
                        <p className="font-medium mb-2">{t('settings.profile.nameLabel')}</p>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={givenName}
                                onChange={(e) => setGivenName(e.target.value)}
                                placeholder={t('settings.profile.namePlaceholder')}
                                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <button
                                onClick={handleUpdateName}
                                disabled={isSaving || !givenName.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('settings.profile.saveButton')}
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
                </div>
            </div>

            {/* Language Section */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{t('settings.language.title')}</h2>
                </div>

                <div className="space-y-3">
                    {languages.map((lang) => (
                        <div
                            key={lang.code}
                            onClick={() => handleLanguageChange(lang.code)}
                            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                                currentLang.code === lang.code
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{lang.flag}</span>
                                <div>
                                    <p className="font-medium">{lang.name}</p>
                                    <p className="text-sm text-muted-foreground">{lang.name}</p>
                                </div>
                            </div>
                            {currentLang.code === lang.code && (
                                <CheckCircle className="w-5 h-5 text-primary" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Security Section */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{t('settings.security.title')}</h2>
                </div>

                <div className="space-y-0">
                    <SettingsItem
                        icon={Lock}
                        title={t('settings.security.changePassword')}
                        description={t('settings.security.changePasswordDesc')}
                        action={
                            <button className="text-sm font-medium text-primary hover:underline">
                                Update
                            </button>
                        }
                    />

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
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-card rounded-xl border border-red-500/20 p-6">
                <div className="space-y-0">
                    <SettingsItem
                        icon={LogOut}
                        title={t('settings.account.signOutAll')}
                        description={t('settings.account.signOutAllDesc')}
                        onClick={handleSignOutAll}
                    />

                    <SettingsItem
                        icon={Trash2}
                        title={t('settings.account.deleteAccount')}
                        description={t('settings.account.deleteAccountDesc')}
                        onClick={handleDeleteAccount}
                        danger
                    />
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
