
import React, { useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from './ui/Card';
import Button from './ui/Button';
import { CreditCard, ShieldCheck, AlertCircle, Ban, Clock, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BillingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { state } = useAppContext();
    const [hasKey, setHasKey] = useState<boolean | null>(null);
    const navigate = useNavigate();

    const org = state.currentOrganization;
    const isMasterAdmin = state.currentUser?.role === 'master_admin';

    // Rigid Access Control Logic
    const isExpired = org?.subscriptionExpiryDate && new Date(org.subscriptionExpiryDate) < new Date();
    const isCancelled = org?.subscriptionStatus === 'cancelled';
    const isPastDue = org?.subscriptionStatus === 'past_due';
    
    // Master Admin can bypass billing locks to manage the platform
    const isBlocked = !isMasterAdmin && (isExpired || isCancelled || isPastDue);

    useEffect(() => {
        let mounted = true;
        const checkKey = async () => {
            try {
                // @ts-ignore
                if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                     // @ts-ignore
                    const selected = await window.aistudio.hasSelectedApiKey();
                    if (mounted) setHasKey(selected);
                } else {
                    // If not in the AI Studio environment, allow bypass
                    if (mounted) setHasKey(true);
                }
            } catch (e) {
                console.warn("Failed to check API key:", e);
                if (mounted) setHasKey(true);
            }
        };
        checkKey();
        return () => { mounted = false; };
    }, []);

    const handleSelectKey = async () => {
        try {
             // @ts-ignore
            if (window.aistudio && window.aistudio.openSelectKey) {
                 // @ts-ignore
                await window.aistudio.openSelectKey();
                setHasKey(true);
            }
        } catch (e) {
            console.error("Failed to open select key:", e);
        }
    };

    if (hasKey === null) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 mt-4 font-bold uppercase tracking-widest text-xs">Verifying Access...</p>
                </div>
            </div>
        );
    }

    // --- ACCESS BLOCKED SCREEN ---
    if (isBlocked) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -bottom-[20%] -right-[10%] w-[70vw] h-[70vw] bg-rose-600/10 rounded-full blur-[120px]" />
                </div>

                <Card className="max-w-md w-full relative z-10 border-0 shadow-2xl bg-slate-900 ring-1 ring-rose-500/20 p-4 md:p-8 text-center rounded-[2.5rem]">
                    <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 text-rose-500 mb-6">
                        <Ban size={40} />
                    </div>
                    
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Access Suspended</h2>
                    <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                        The subscription for <strong>{org?.name}</strong> has {isExpired ? 'expired' : 'been cancelled or is past due'}. 
                        <br/><br/>
                        All platform tools, dispatching, and field services are currently locked. Please contact your platform administrator or renew your plan to restore access.
                    </p>

                    <div className="space-y-4">
                        <Button 
                            onClick={() => navigate('/admin/settings')} 
                            className="w-full h-14 text-lg font-black bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-500/20"
                        >
                            View Billing Settings
                        </Button>
                        
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                            Support ID: {org?.id}
                        </p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-slate-500">
                        <Clock size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">
                            Last Expiry: {org?.subscriptionExpiryDate}
                        </span>
                    </div>
                </Card>
            </div>
        );
    }

    // --- API KEY REQUIREMENT ---
    if (!hasKey) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-primary-600/10 rounded-full blur-[120px]" />
                </div>

                <Card className="max-w-md w-full relative z-10 border-0 shadow-2xl bg-slate-900 ring-1 ring-white/10 p-4 md:p-8 text-center rounded-[2.5rem]">
                    <div className="inline-flex p-4 rounded-2xl bg-primary-500/10 text-primary-500 mb-6">
                        <CreditCard size={40} />
                    </div>
                    
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">API Billing Required</h2>
                    <p className="text-slate-400 mb-8 text-sm leading-relaxed">
                        This platform utilizes high-performance AI models for visual diagnostics, video troubleshooting, and advanced technical automation. 
                        <br/><br/>
                        To continue, you must select an API key associated with a <strong>Paid Google Cloud Project</strong>.
                    </p>

                    <div className="space-y-4">
                        <Button onClick={handleSelectKey} className="w-full h-14 text-lg font-black shadow-xl shadow-primary-500/20">
                            Select Project API Key
                        </Button>
                        
                        <div className="flex flex-col gap-2">
                            <a 
                                href="https://ai.google.dev/gemini-api/docs/billing" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-primary-400 hover:text-primary-300 flex items-center justify-center gap-1 transition-colors"
                            >
                                <ShieldCheck size={14} /> Documentation: API Billing & Tiers
                            </a>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-slate-500">
                        <AlertTriangle size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">Secure Enterprise Gateway</span>
                    </div>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
};

export default BillingGate;
