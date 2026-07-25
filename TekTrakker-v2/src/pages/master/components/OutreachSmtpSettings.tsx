import React, { useState, useEffect } from 'react';
import { db } from 'lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import showToast from 'lib/toast';
import { Mail, Shield, Save, Send, AlertCircle, CheckCircle } from 'lucide-react';

interface SmtpConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
    secure: boolean;
}

const OutreachSmtpSettings: React.FC = () => {
    const { state } = useAppContext();
    const currentUser = state.currentUser;

    const [host, setHost] = useState('');
    const [port, setPort] = useState(587);
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [fromName, setFromName] = useState('');
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [hasConfig, setHasConfig] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                // Fetch from the platform secrets document
                const docRef = doc(db, 'organizations', 'platform', 'secrets', 'config');
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.campaignSmtpConfig) {
                        const cfg: SmtpConfig = data.campaignSmtpConfig;
                        setHost(cfg.host || '');
                        setPort(cfg.port || 587);
                        setUser(cfg.user || '');
                        setPass(cfg.pass || '');
                        setFromEmail(cfg.fromEmail || '');
                        setFromName(cfg.fromName || '');
                        setHasConfig(true);
                    }
                } else {
                    // Try fallback to the platform organization document
                    const orgRef = doc(db, 'organizations', 'platform');
                    const orgSnap = await getDoc(orgRef);
                    if (orgSnap.exists()) {
                        const data = orgSnap.data();
                        if (data.campaignSmtpConfig) {
                            const cfg: SmtpConfig = data.campaignSmtpConfig;
                            setHost(cfg.host || '');
                            setPort(cfg.port || 587);
                            setUser(cfg.user || '');
                            setPass(cfg.pass || '');
                            setFromEmail(cfg.fromEmail || '');
                            setFromName(cfg.fromName || '');
                            setHasConfig(true);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load outreach SMTP config:', err);
                showToast.error('Could not load SMTP configurations.');
            } finally {
                setIsLoading(false);
            }
        };

        loadConfig();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!host.trim() || !user.trim() || !pass.trim() || !fromEmail.trim() || !fromName.trim()) {
            showToast.warn('Please fill out all required fields.');
            return;
        }

        setIsSaving(true);
        try {
            const configPayload: SmtpConfig = {
                host: host.trim(),
                port: Number(port),
                user: user.trim(),
                pass: pass.trim(),
                fromEmail: fromEmail.trim().toLowerCase(),
                fromName: fromName.trim(),
                secure: Number(port) === 465
            };

            const docRef = doc(db, 'organizations', 'platform', 'secrets', 'config');
            await setDoc(docRef, { campaignSmtpConfig: configPayload }, { merge: true });
            
            setHasConfig(true);
            showToast.success('Outreach SMTP settings saved successfully!');
        } catch (err: any) {
            console.error('Failed to save outreach SMTP settings:', err);
            showToast.error(err.message || 'Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendTest = async () => {
        const testTarget = currentUser?.email;
        if (!testTarget) {
            showToast.error('Could not determine your email address to send a test.');
            return;
        }

        if (!host.trim() || !user.trim() || !pass.trim() || !fromEmail.trim() || !fromName.trim()) {
            showToast.warn('Please fill out all SMTP fields before sending a test.');
            return;
        }

        setIsTesting(true);
        try {
            // Queue a test message in mail_queue with custom transport settings override
            await setDoc(doc(db, 'mail_queue', `test-${Date.now()}`), {
                to: [testTarget],
                replyTo: fromEmail.trim().toLowerCase(),
                message: {
                    subject: `[OUTREACH SMTP TEST] Connection Verification`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <h2 style="color: #4f46e5; margin-bottom: 16px;">Connection Verification Successful!</h2>
                            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                                This is a test email sent from your newly configured outreach SMTP domain.
                            </p>
                            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px 0; font-weight: bold; color: #64748b; font-size: 13px;">SMTP Host</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px;">${host}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px 0; font-weight: bold; color: #64748b; font-size: 13px;">SMTP Port</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px;">${port}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 8px 0; font-weight: bold; color: #64748b; font-size: 13px;">Sender Identity</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-size: 13px;">"${fromName}" &lt;${fromEmail}&gt;</td>
                                </tr>
                            </table>
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;">
                            <p style="color: #94a3b8; font-size: 11px; text-align: center;">
                                Sent securely via TekTrakker Outreach Platform Settings
                            </p>
                        </div>
                    `,
                    replyTo: fromEmail.trim().toLowerCase()
                },
                status: 'pending',
                organizationId: 'platform',
                type: 'PlatformCampaignStudio',
                transport: {
                    host: host.trim(),
                    port: Number(port),
                    user: user.trim(),
                    pass: pass.trim(),
                    fromEmail: fromEmail.trim().toLowerCase(),
                    fromName: fromName.trim(),
                    secure: Number(port) === 465
                },
                createdAt: new Date().toISOString()
            });

            showToast.success('Test email queued! Check your inbox in a minute.');
        } catch (err: any) {
            console.error('Failed to queue test email:', err);
            showToast.error(err.message || 'Failed to queue test email.');
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) {
        return (
            <Card className="p-8 flex items-center justify-center min-h-[300px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-semibold text-slate-500">Loading configurations...</span>
                </div>
            </Card>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <Card className="p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Mail className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Dedicated Outreach SMTP Server</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Configure a dedicated SMTP server for your sales broadcasts and drip sequences. 
                            This completely separates cold outreach traffic (e.g. from <code>tektrakker.info</code>) from your platform's core transactional alerts.
                        </p>
                    </div>
                </div>

                {hasConfig ? (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl mb-6 text-emerald-800 dark:text-emerald-300">
                        <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                        <span className="text-xs font-semibold">Active: Campaign-specific SMTP override is currently configured.</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl mb-6 text-amber-800 dark:text-amber-300">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                        <span className="text-xs font-semibold">Inactive: Broadcasts currently default to Sendgrid. Fill settings below to activate.</span>
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <Input
                                label="SMTP Host"
                                placeholder="e.g. smtp.gmail.com"
                                value={host}
                                onChange={(e: any) => setHost(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Input
                                label="SMTP Port"
                                type="number"
                                placeholder="e.g. 587 or 465"
                                value={port}
                                onChange={(e: any) => setPort(Number(e.target.value))}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Username (SMTP Email)"
                            placeholder="e.g. sales@tektrakker.info"
                            type="email"
                            value={user}
                            onChange={(e: any) => setUser(e.target.value)}
                            required
                        />
                        <Input
                            label="Password or App Password"
                            type="password"
                            placeholder="••••••••••••••••"
                            value={pass}
                            onChange={(e: any) => setPass(e.target.value)}
                            required
                        />
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 my-4 pt-4">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Sender Identity (Displayed header info)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Sender Display Name"
                                placeholder="e.g. TekTrakker Sales"
                                value={fromName}
                                onChange={(e: any) => setFromName(e.target.value)}
                                required
                            />
                            <Input
                                label="Sender Email Address"
                                placeholder="e.g. sales@tektrakker.info"
                                type="email"
                                value={fromEmail}
                                onChange={(e: any) => setFromEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleSendTest}
                            disabled={isTesting || isSaving}
                            className="flex items-center justify-center gap-2"
                        >
                            <Send className="w-4 h-4" />
                            {isTesting ? 'Sending Test...' : 'Send Test Email'}
                        </Button>
                        
                        <Button
                            type="submit"
                            disabled={isSaving || isTesting}
                            className="flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </form>
            </Card>

            <Card className="p-4 bg-slate-50 dark:bg-slate-800/40 border-0 flex items-start gap-3">
                <Shield className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-500 leading-relaxed">
                    <strong>Encryption & Security note:</strong> Passwords are saved in 
                    <code> organizations/platform/secrets/config</code> which is governed by Firestore security rules. 
                    Only platform owners and authenticated administrators have access to read or modify this configuration. 
                    For Google Workspace (Gmail), we recommend creating an <strong>App Password</strong> in your Google Account security panel rather than saving your primary account password here.
                </div>
            </Card>
        </div>
    );
};

export default OutreachSmtpSettings;
