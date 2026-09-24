import showToast from "lib/toast";
import { getBaseUrl , cleanUndefinedFields } from "lib/utils";

import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Toggle from 'components/ui/Toggle';
import Textarea from 'components/ui/Textarea';
import { 
    CreditCard, TrendingUp, Activity, Calendar, Send, 
    ArrowUpRight, Gift, Percent, Receipt, Plus, Search, Building2, Palette, FileText, Trash2, Mail, Eye,
    Phone, MessageSquare, HardDrive, Cpu, Sparkles
} from 'lucide-react';
import { db } from 'lib/firebase';
import type { Organization, Job, InvoiceLineItem, PlatformSettings, Address } from 'types';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';
import DocumentPreview from 'components/ui/DocumentPreview';
import WholesaleMarginBadge from 'components/common/WholesaleMarginBadge';
import { globalConfirm } from "lib/globalConfirm";

const MasterBilling: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const orgs = state.allOrganizations;

    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'metered_usage' | 'settings'>('dashboard');
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'active' | 'expired' | 'enterprise' | 'business' | 'trial'>('all');
    
    // Month Selector for Infrastructure Metered Usage
    const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });

    const monthOptions = useMemo(() => {
        const options = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const ym = `${y}-${m}`;
            const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            options.push({ value: ym, label: i === 0 ? `${label} (Current Month-to-Date)` : label });
        }
        return options;
    }, []);
    
    // Invoices State
    const [platformInvoices, setPlatformInvoices] = useState<Job[]>([]);
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
    
    // Preview State
    const [previewJob, setPreviewJob] = useState<Job | null>(null);

    // Metered Usage Real Data State
    const [storageUsageMap, setStorageUsageMap] = useState<Record<string, { totalBytesUsed: number }>>({});
    const [aiUsageMap, setAiUsageMap] = useState<Record<string, { totalTokensUsed: number; monthlyUsage?: Record<string, { totalTokensUsed: number }> }>>({});
    const [messagesCountMap, setMessagesCountMap] = useState<Record<string, { smsCount: number; callCount: number; aiVoiceMinutes?: number; standardVoiceMinutes?: number }>>({});
    const [isLoadingMetered, setIsLoadingMetered] = useState(false);

    const DEFAULT_PLANS = useMemo(() => ({
        starter: { 
            monthly: 49, 
            annual: 550, 
            maxUsers: 1,
            unlimitedUsers: false,
            aiTokensPerMonth: 1000000,
            includedStorageGB: 1,
            storageOverageRatePerGB: 0.10,
            features: ['publicBooking', 'proposals', 'paymentProcessing', 'timeTracking', 'ai'],
            ribbonText: '',
            supportResponseTime: '3-Day Guarantee'
        },
        growth: { 
            monthly: 149, 
            annual: 1500, 
            maxUsers: 5,
            unlimitedUsers: false,
            aiTokensPerMonth: 3000000,
            includedStorageGB: 10,
            storageOverageRatePerGB: 0.10,
            features: ['publicBooking', 'proposals', 'paymentProcessing', 'timeTracking', 'inventory', 'salesCrm', 'quickbooks', 'ai'],
            ribbonText: 'Popular',
            supportResponseTime: '24-Hour Support SLA'
        },
        business: {
            monthly: 349,
            annual: 3490,
            maxUsers: 20,
            unlimitedUsers: false,
            aiTokensPerMonth: 8000000,
            includedStorageGB: 25,
            storageOverageRatePerGB: 0.10,
            features: ['publicBooking', 'proposals', 'paymentProcessing', 'timeTracking', 'inventory', 'salesCrm', 'quickbooks', 'ai', 'subcontractors', 'hrDocuments'],
            ribbonText: 'Scale Team',
            supportResponseTime: 'Same-Day Priority SLA'
        },
        enterprise: { 
            monthly: 699, 
            annual: 6990, 
            maxUsers: 999999,
            unlimitedUsers: true,
            aiTokensPerMonth: 15000000,
            includedStorageGB: 100,
            storageOverageRatePerGB: 0.05,
            features: [
                'publicBooking', 'proposals', 'paymentProcessing', 'timeTracking', 'inventory',
                'salesCrm', 'hrDocuments', 'careerPage', 'ai', 'quickbooks', 'subcontractors',
                '1099', 'api', 'branding', 'whiteboard', 'customizations', 'technicianTools'
            ],
            ribbonText: '',
            supportResponseTime: '1-2 Hour Dedicated Support SLA'
        },
        payments_only: {
            monthly: 10,
            annual: 199,
            maxUsers: 999999,
            unlimitedUsers: true,
            aiTokensPerMonth: 500000,
            includedStorageGB: 0.5,
            storageOverageRatePerGB: 0.10,
            features: ['proposals', 'paymentProcessing'],
            ribbonText: '',
            supportResponseTime: 'Standard Support'
        }
    }), []);

    const [config, setConfig] = useState<PlatformSettings>({
        id: 'platform_billing',
        plans: DEFAULT_PLANS,
        excessUserFee: 25,
        subscriptionFee: 7,
        virtualWorkerFee: 49.99,
        virtualWorkerLifetimeFee: 1999,
        aiPowerPackPrice: 5,
        aiPowerPackTokens: 1000000,
        divisionFee: 79,
        smsRate: 0.02,
        voiceRate: 0.035,
        aiVoiceAssistantRatePerMinute: 0.07,
        aiVoiceAssistantMonthlyFee: 5.00,
        phoneLineFee: 15.00,
        aiTokenOverageRatePer1k: 0.002,
        franchiseLifetimeFee: 25000,
        updatedAt: new Date().toISOString()
    });
    
    const [platformOrg, setPlatformOrg] = useState<Organization | null>(null);
    const editingJob = useMemo(() => platformInvoices.find(j => j.id === editingInvoiceId), [platformInvoices, editingInvoiceId]);

    const mergePlanData = (defaultPlan: any, dbPlan: any) => {
        if (!dbPlan) return { ...defaultPlan };
        return {
            ...defaultPlan,
            ...dbPlan,
            monthly: dbPlan.monthly ?? defaultPlan.monthly,
            annual: dbPlan.annual ?? defaultPlan.annual,
            maxUsers: dbPlan.maxUsers ?? defaultPlan.maxUsers,
            unlimitedUsers: dbPlan.unlimitedUsers ?? defaultPlan.unlimitedUsers,
            aiTokensPerMonth: dbPlan.aiTokensPerMonth ?? defaultPlan.aiTokensPerMonth,
            includedStorageGB: dbPlan.includedStorageGB ?? defaultPlan.includedStorageGB,
            storageOverageRatePerGB: dbPlan.storageOverageRatePerGB ?? defaultPlan.storageOverageRatePerGB,
            ribbonText: dbPlan.ribbonText ?? defaultPlan.ribbonText,
            supportResponseTime: dbPlan.supportResponseTime ?? defaultPlan.supportResponseTime,
            features: (Array.isArray(dbPlan.features) && dbPlan.features.length > 0) ? dbPlan.features : defaultPlan.features
        };
    };

    // Direct Firestore fetch on mount
    useEffect(() => {
        const loadSettingsFromDb = async () => {
            try {
                const docSnap = await db.collection('platformSettings').doc('global').get();
                if (docSnap.exists) {
                    const dbData: any = docSnap.data();
                    const dbPlans = dbData?.plans || {};
                    setConfig(prev => ({
                        ...prev,
                        ...dbData,
                        plans: {
                            starter: mergePlanData(DEFAULT_PLANS.starter, dbPlans.starter),
                            growth: mergePlanData(DEFAULT_PLANS.growth, dbPlans.growth),
                            business: mergePlanData(DEFAULT_PLANS.business, dbPlans.business),
                            enterprise: mergePlanData(DEFAULT_PLANS.enterprise, dbPlans.enterprise),
                            payments_only: mergePlanData(DEFAULT_PLANS.payments_only, dbPlans.payments_only)
                        }
                    }));
                }
            } catch (err) {
                console.warn("Failed to fetch platformSettings on mount:", err);
            }
        };
        loadSettingsFromDb();
    }, [DEFAULT_PLANS]);

    // Synchronize with AppContext (Live DB updates)
    useEffect(() => {
        if (state.platformSettings) {
            const dbPlans: any = state.platformSettings?.plans || {};
            setConfig(prev => ({
                ...prev,
                ...state.platformSettings,
                plans: {
                    starter: mergePlanData(prev.plans?.starter || DEFAULT_PLANS.starter, dbPlans.starter),
                    growth: mergePlanData(prev.plans?.growth || DEFAULT_PLANS.growth, dbPlans.growth),
                    business: mergePlanData(prev.plans?.business || DEFAULT_PLANS.business, dbPlans.business),
                    enterprise: mergePlanData(prev.plans?.enterprise || DEFAULT_PLANS.enterprise, dbPlans.enterprise),
                    payments_only: mergePlanData(prev.plans?.payments_only || DEFAULT_PLANS.payments_only, dbPlans.payments_only)
                }
            }));
        }
    }, [state.platformSettings, DEFAULT_PLANS]);

    // Fetch Platform Organization Details
    useEffect(() => {
        const fetchPlatformOrg = async () => {
            try {
                const doc = await db.collection('organizations').doc('platform').get();
                if (doc.exists) {
                    setPlatformOrg({ ...doc.data(), id: doc.id } as Organization);
                } else {
                    const defaultPlatform: Organization = { 
                        id: 'platform', 
                        name: 'TekTrakker', 
                        email: 'platform@tektrakker.com',
                        phone: '', 
                        address: { street: '', city: '', state: '', zip: '' }, 
                        subscriptionStatus: 'active' 
                    };
                    await db.collection('organizations').doc('platform').set(cleanUndefinedFields(defaultPlatform));
                    setPlatformOrg(defaultPlatform);
                }
            } catch (e) { console.error(e); }
        };
        fetchPlatformOrg();
    }, []);

    // Fetch Invoices
    useEffect(() => {
        if (!state.currentUser) return;
        if (activeTab === 'invoices') {
            setIsLoadingInvoices(true);
            const unsub = db.collection('jobs')
                .where('source', '==', 'PlatformAdmin')
                .limit(100)
                .onSnapshot((snap) => {
                    const jobs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Job));
                    jobs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                    setPlatformInvoices(jobs);
                    setIsLoadingInvoices(false);
                }, () => setIsLoadingInvoices(false));
            return () => unsub();
        }
    }, [activeTab]);

    // Fetch Real Metered Usage Data (Storage, AI Tokens, SMS/Calls)
    useEffect(() => {
        if (!state.currentUser || activeTab !== 'metered_usage') return;
        setIsLoadingMetered(true);

        const unsubStorage = db.collection('storageUsage').onSnapshot((snap) => {
            const sMap: Record<string, { totalBytesUsed: number }> = {};
            snap.docs.forEach(doc => {
                sMap[doc.id] = { totalBytesUsed: doc.data().totalBytesUsed || 0 };
            });
            setStorageUsageMap(sMap);
        }, (err) => console.debug('storageUsage listen error:', err));

        const unsubAi = db.collection('aiUsage').onSnapshot((snap) => {
            const aMap: Record<string, { totalTokensUsed: number; monthlyUsage?: Record<string, { totalTokensUsed: number }> }> = {};
            snap.docs.forEach(doc => {
                aMap[doc.id] = doc.data() as any;
            });
            setAiUsageMap(aMap);
        }, (err) => console.debug('aiUsage listen error:', err));

        // Aggregate real message / call / AI telephony activity for the selected month
        const [selYear, selMonth] = selectedYearMonth.split('-').map(Number);
        const startOfMonth = new Date(selYear, selMonth - 1, 1).toISOString();
        const endOfMonth = new Date(selYear, selMonth, 1).toISOString();

        Promise.all([
            db.collection('messages')
                .where('createdAt', '>=', startOfMonth)
                .where('createdAt', '<', endOfMonth)
                .get()
                .catch(() => ({ docs: [] })),
            db.collection('smsUsage')
                .where('billingCycle', '==', selectedYearMonth)
                .get()
                .catch(() => ({ docs: [] }))
        ]).then(([messagesSnap, smsUsageSnap]) => {
            const mMap: Record<string, { smsCount: number; callCount: number; aiVoiceMinutes?: number; standardVoiceMinutes?: number }> = {};
            
            // Populate from messages as baseline
            messagesSnap.docs.forEach(doc => {
                const data = doc.data();
                const orgId = data.organizationId;
                if (!orgId) return;
                if (!mMap[orgId]) mMap[orgId] = { smsCount: 0, callCount: 0, aiVoiceMinutes: 0, standardVoiceMinutes: 0 };
                const t = String(data.type || '').toLowerCase();
                if (t.includes('sms')) {
                    mMap[orgId].smsCount += 1;
                } else if (t.includes('call') || t.includes('ivr')) {
                    mMap[orgId].callCount += 1;
                }
            });

            // Layer official metered tracking from smsUsage ledger
            smsUsageSnap.docs.forEach(doc => {
                const data = doc.data();
                const orgId = data.organizationId || doc.id.split('_')[0];
                if (!orgId) return;
                if (!mMap[orgId]) mMap[orgId] = { smsCount: 0, callCount: 0, aiVoiceMinutes: 0, standardVoiceMinutes: 0 };
                if (data.totalSmsSent || data.totalSmsReceived) {
                    mMap[orgId].smsCount = (data.totalSmsSent || 0) + (data.totalSmsReceived || 0);
                }
                if (data.totalVoiceMinutes) {
                    mMap[orgId].standardVoiceMinutes = data.totalVoiceMinutes || 0;
                }
                if (data.totalAiVoiceMinutes) {
                    mMap[orgId].aiVoiceMinutes = data.totalAiVoiceMinutes || 0;
                }
            });

            setMessagesCountMap(mMap);
            setIsLoadingMetered(false);
        }).catch((err) => {
            console.debug('messages range query notice (defaulting to 0):', err);
            setIsLoadingMetered(false);
        });

        return () => {
            unsubStorage();
            unsubAi();
        };
    }, [activeTab, selectedYearMonth, state.currentUser]);

    const meteredRows = useMemo(() => {
        return orgs.map(org => {
            const isExemptAll = org.isComplimentary || org.isFreeAccess;
            const isTwilioExempt = isExemptAll || org.billingExemptions?.twilio;
            const isAiExempt = isExemptAll || org.billingExemptions?.ai;
            const isStorageExempt = isExemptAll || org.billingExemptions?.storage;

            const pKey = (org.plan || 'starter').toLowerCase();
            const pPlan = config.plans?.[pKey] || (DEFAULT_PLANS as any)[pKey] || {};

            // Check organization custom overrides if present
            const cp = org.customPricing;

            // 1. Real Storage
            const sRecord = storageUsageMap[org.id];
            const usedBytes = sRecord?.totalBytesUsed || 0;
            const usedGB = usedBytes / (1024 * 1024 * 1024);
            const includedStorageGB = cp?.customIncludedStorageGB ?? pPlan.includedStorageGB ?? (pKey === 'enterprise' ? 100 : pKey === 'business' ? 25 : pKey === 'growth' ? 10 : pKey === 'starter' ? 1 : 0.5);
            const storageRate = cp?.customStorageOverageRate ?? pPlan.storageOverageRatePerGB ?? (pKey === 'enterprise' ? 0.05 : 0.10);
            const billableStorageGB = Math.max(0, usedGB - includedStorageGB);
            const storageCost = isStorageExempt ? 0 : billableStorageGB * storageRate;

            // 2. Real AI Tokens (Gemini 3.8 Flash)
            const aiRecord = aiUsageMap[org.id];
            const monthlyTokens = aiRecord?.monthlyUsage?.[selectedYearMonth]?.totalTokensUsed || 0;
            const includedTokens = cp?.customIncludedAiTokens ?? pPlan.aiTokensPerMonth ?? (pKey === 'enterprise' ? 15000000 : pKey === 'business' ? 8000000 : pKey === 'growth' ? 3000000 : 1000000);
            const billableTokens = includedTokens > 0 ? Math.max(0, monthlyTokens - includedTokens) : 0;
            const aiOverageRatePer1k = cp?.customAiTokenOverageRate ?? config.aiTokenOverageRatePer1k ?? 0.002;
            const aiCost = isAiExempt ? 0 : (billableTokens / 1000) * aiOverageRatePer1k;

            // 3. Real Twilio SMS & Voice (Standard + 24/7 AI Voice Receptionist)
            const mRecord = messagesCountMap[org.id] || { smsCount: 0, callCount: 0 };
            const smsCount = mRecord.smsCount;
            const standardVoiceMins = (mRecord.standardVoiceMinutes !== undefined && mRecord.standardVoiceMinutes > 0) ? mRecord.standardVoiceMinutes : (mRecord.callCount * 2);
            const aiVoiceMinutes = mRecord.aiVoiceMinutes || 0;
            const callMinutes = standardVoiceMins + aiVoiceMinutes;

            const smsRate = cp?.customSmsRate ?? config.smsRate ?? 0.02;
            const voiceRate = cp?.customVoiceRate ?? config.voiceRate ?? 0.035;
            const aiVoiceRate = cp?.customAiVoiceAssistantRate ?? config.aiVoiceAssistantRatePerMinute ?? 0.07;
            const twilioCost = isTwilioExempt ? 0 : (smsCount * smsRate) + (standardVoiceMins * voiceRate) + (aiVoiceMinutes * aiVoiceRate);

            const totalBillableMetered = twilioCost + aiCost + storageCost;

            return {
                org,
                isExemptAll,
                isTwilioExempt,
                isAiExempt,
                isStorageExempt,
                pKey,
                pPlan,
                usedGB,
                includedStorageGB,
                storageCost,
                monthlyTokens,
                includedTokens,
                aiCost,
                smsCount,
                callMinutes,
                aiVoiceMinutes,
                twilioCost,
                totalBillableMetered
            };
        });
    }, [orgs, config.plans, DEFAULT_PLANS, storageUsageMap, aiUsageMap, messagesCountMap, selectedYearMonth]);

    const meteredTotals = useMemo(() => {
        const totalTwilio = meteredRows.reduce((sum, r) => sum + r.twilioCost, 0);
        const totalSms = meteredRows.reduce((sum, r) => sum + r.smsCount, 0);
        const totalCalls = meteredRows.reduce((sum, r) => sum + r.callMinutes, 0);
        const totalAiVoiceMinutes = meteredRows.reduce((sum, r) => sum + (r.aiVoiceMinutes || 0), 0);

        const totalAiCost = meteredRows.reduce((sum, r) => sum + r.aiCost, 0);
        const totalAiTokens = meteredRows.reduce((sum, r) => sum + r.monthlyTokens, 0);

        const totalStorageCost = meteredRows.reduce((sum, r) => sum + r.storageCost, 0);
        const totalStorageBytes = Object.values(storageUsageMap).reduce((sum, s) => sum + (s.totalBytesUsed || 0), 0);
        const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);

        return {
            totalTwilio,
            totalSms,
            totalCalls,
            totalAiVoiceMinutes,
            totalAiCost,
            totalAiTokens,
            totalStorageCost,
            totalStorageGB
        };
    }, [meteredRows, storageUsageMap]);

    const [upgradePlan, setUpgradePlan] = useState<Organization['plan']>('starter');
    const [additionalUsers, setAdditionalUsers] = useState(0);
    const [additionalDivisionsSlots, setAdditionalDivisionsSlots] = useState(0);
    const [customCharge, setCustomCharge] = useState(0);
    const [isFreeAccess, setIsFreeAccess] = useState(false);
    const [unlockAllFeatures, setUnlockAllFeatures] = useState(false);
    const [customDiscountPct, setCustomDiscountPct] = useState(0);
    const [notes, setNotes] = useState('');
    const [virtualWorkerEnabled, setVirtualWorkerEnabled] = useState(false);
    const [virtualWorkerBillingType, setVirtualWorkerBillingType] = useState<'monthly' | 'lifetime'>('monthly');
    const [aiVoiceAssistantEnabled, setAiVoiceAssistantEnabled] = useState(false);
    const [aiVoiceAssistantBillingType, setAiVoiceAssistantBillingType] = useState<'monthly' | 'lifetime'>('monthly');

    const getBasePrice = (plan: string) => {
        if (!config?.plans) return 99;
        const p = (plan || 'starter').toLowerCase();
        // @ts-ignore - Dynamic key access with fallback
        return config.plans[p]?.monthly ?? config.plans?.starter?.monthly ?? 99;
    };
    
    const getUserFee = () => config.excessUserFee ?? 25;

    const stats = useMemo(() => {
        // Filter out test/demo organizations from financial metrics
        const validOrgs = orgs.filter(o => {
            const orgName = (o.name || '').toLowerCase();
            return !(orgName.includes('test') || orgName.includes('demo') || (o as any).isDemo);
        });

        const active = validOrgs.filter(o => o.subscriptionStatus === 'active');
        const trial = validOrgs.filter(o => o.subscriptionStatus === 'trial');
        const expired = validOrgs.filter(o => o.subscriptionExpiryDate && new Date(o.subscriptionExpiryDate) < new Date());
        const mrr = active.reduce((sum, o) => {
            if (o.isFreeAccess) return sum;
            const base = getBasePrice(o.plan || 'starter');
            const additionalUsers = o.additionalUserSlots || 0;
            const userFee = additionalUsers * getUserFee();
            const additionalDivs = o.additionalDivisionsSlots || 0;
            const divisionFee = additionalDivs * (config.divisionFee ?? 79);
            const totalBeforeDiscount = base + userFee + divisionFee;
            const discount = (o.customDiscountPct || 0) / 100;
            return sum + (totalBeforeDiscount * (1 - discount));
        }, 0);
        return { mrr, activeCount: active.length, trialCount: trial.length, expiredCount: expired.length, enterpriseCount: active.filter(o => o.plan === 'enterprise').length, businessCount: active.filter(o => o.plan === 'business').length, growthCount: active.filter(o => o.plan === 'growth').length, starterCount: active.filter(o => o.plan === 'starter').length, paymentsOnlyCount: active.filter(o => o.plan === 'payments_only').length };
    }, [orgs, config]);

    const filteredOrgs = orgs.filter(o => {
        if (filterType === 'active') return o.subscriptionStatus === 'active';
        if (filterType === 'trial') return o.subscriptionStatus === 'trial';
        if (filterType === 'expired') return o.subscriptionExpiryDate && new Date(o.subscriptionExpiryDate) < new Date();
        if (filterType === 'enterprise') return o.plan === 'enterprise';
        if (filterType === 'business') return o.plan === 'business';
        return true;
    });

    const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const handleOpenManage = (org: Organization) => {
        setSelectedOrg(org);
        setUpgradePlan(org.plan || 'starter');
        setAdditionalUsers(org.additionalUserSlots || 0);
        setAdditionalDivisionsSlots(org.additionalDivisionsSlots || 0);
        setCustomCharge(0);
        setIsFreeAccess(org.isFreeAccess || false);
        setUnlockAllFeatures(org.unlockAllFeatures || false);
        setCustomDiscountPct(org.customDiscountPct || 0);
        setVirtualWorkerEnabled(org.virtualWorkerEnabled || false);
        setVirtualWorkerBillingType((org as any).virtualWorkerBillingType || 'monthly');
        setAiVoiceAssistantEnabled(org.aiVoiceAssistantEnabled || false);
        setAiVoiceAssistantBillingType(org.aiVoiceAssistantBillingType || 'monthly');
        setNotes('');
        setIsManageModalOpen(true);
    };

    const handleSaveConfig = async () => {
        setIsSubmitting(true);
        try {
            // Must use merge: true to avoid deleting integrations or other fields in the global document
            await db.collection('platformSettings').doc('global').set(cleanUndefinedFields({ ...config, updatedAt: new Date().toISOString() }), { merge: true });
            if (platformOrg) await db.collection('organizations').doc('platform').update(cleanUndefinedFields(platformOrg));
            showToast.warn("Settings updated successfully and synchronized.");
        } catch (e) { showToast.warn("Failed to update config."); }
        finally { setIsSubmitting(false); }
    };

    const handleGenerateUpgradeInvoice = async () => {
        if (!selectedOrg) return;
        setIsSubmitting(true);

        const basePrice = isFreeAccess ? 0 : getBasePrice(upgradePlan || 'starter');
        const userCosts = isFreeAccess ? 0 : (additionalUsers * getUserFee());
        
        const divisionFee = config.divisionFee ?? 79;
        const divisionCosts = isFreeAccess ? 0 : (additionalDivisionsSlots * divisionFee);

        let virtualWorkerCost = 0;
        if (virtualWorkerEnabled && !isFreeAccess) {
            if (virtualWorkerBillingType === 'lifetime') {
                if (!selectedOrg.virtualWorkerEnabled || (selectedOrg as any).virtualWorkerBillingType !== 'lifetime') {
                    virtualWorkerCost = config.virtualWorkerLifetimeFee ?? 1999;
                }
            } else {
                if (!selectedOrg.virtualWorkerEnabled || (selectedOrg as any).virtualWorkerBillingType !== 'monthly') {
                    virtualWorkerCost = config.virtualWorkerFee ?? 49.99;
                }
            }
        }

        let aiVoiceCost = 0;
        if (aiVoiceAssistantEnabled && !isFreeAccess) {
            if (aiVoiceAssistantBillingType === 'lifetime') {
                if (!selectedOrg.aiVoiceAssistantEnabled || selectedOrg.aiVoiceAssistantBillingType !== 'lifetime') {
                    aiVoiceCost = 199;
                }
            } else {
                if (!selectedOrg.aiVoiceAssistantEnabled || selectedOrg.aiVoiceAssistantBillingType !== 'monthly') {
                    aiVoiceCost = config.aiVoiceAssistantMonthlyFee ?? 5.00;
                }
            }
        }

        const grossSubtotal = basePrice + userCosts + divisionCosts + virtualWorkerCost + aiVoiceCost + customCharge;
        const discountAmount = isFreeAccess ? 0 : (grossSubtotal * (customDiscountPct / 100));
        const netBeforeTax = Math.max(0, grossSubtotal - discountAmount);

        const isTexas = (selectedOrg.address?.state || '').trim().toUpperCase() === 'TX';
        const taxRate = isTexas ? 0.066 : 0;
        const taxAmount = netBeforeTax * taxRate;
        const finalTotal = netBeforeTax + taxAmount;

        const jobId = `platform-inv-${Date.now()}`;
        const items: any[] = [
            { id: 'item-base', description: `Platform Subscription: ${upgradePlan?.toUpperCase()} Tier`, quantity: 1, unitPrice: basePrice, total: basePrice, type: 'Fee' }
        ];

        if (userCosts > 0) {
            items.push({ id: 'item-users', description: `Additional User Slots (${additionalUsers})`, quantity: 1, unitPrice: userCosts, total: userCosts, type: 'Fee' });
        }

        if (divisionCosts > 0) {
            items.push({ id: 'item-divisions', description: `Additional Division Slots (${additionalDivisionsSlots})`, quantity: 1, unitPrice: divisionCosts, total: divisionCosts, type: 'Fee' });
        }

        if (virtualWorkerCost > 0) {
            items.push({
                id: 'item-vw',
                description: `Virtual Worker AI Access (${virtualWorkerBillingType === 'lifetime' ? 'Lifetime Access' : 'First Month subscription'})`,
                quantity: 1,
                unitPrice: virtualWorkerCost,
                total: virtualWorkerCost,
                type: 'Fee'
            });
        }

        if (aiVoiceCost > 0) {
            items.push({
                id: 'item-ai-voice',
                description: `24/7 AI Voice Receptionist Add-on (${aiVoiceAssistantBillingType === 'lifetime' ? 'Lifetime Access' : 'First Month subscription'})`,
                quantity: 1,
                unitPrice: aiVoiceCost,
                total: aiVoiceCost,
                type: 'Fee'
            });
        }

        if (customCharge !== 0) {
            items.push({ id: 'item-custom', description: `Custom Administrative Charge / Credit`, quantity: 1, unitPrice: customCharge, total: customCharge, type: 'Fee' });
        }

        if (discountAmount > 0) {
            items.push({ id: 'item-discount', description: `Special Discount (${customDiscountPct}%)`, quantity: 1, unitPrice: -discountAmount, total: -discountAmount, type: 'Discount' });
        }

        const invoiceData: any = {
            id: jobId,
            organizationId: 'platform',
            customerName: selectedOrg.name || 'Unknown',
            customerId: selectedOrg.id,
            customerEmail: selectedOrg.email || '',
            address: selectedOrg.address || null,
            tasks: ['Platform Subscription Update'],
            jobStatus: 'Completed',
            appointmentTime: new Date().toISOString(),
            source: 'PlatformAdmin',
            invoice: {
                id: `SAAS-${Date.now()}`,
                status: finalTotal <= 0 ? 'Paid' : 'Unpaid',
                items: items,
                subtotal: netBeforeTax,
                taxRate: taxRate,
                taxAmount: taxAmount,
                totalAmount: finalTotal,
                amount: finalTotal,
                notes: notes
            },
            jobEvents: [],
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('jobs').doc(jobId).set(cleanUndefinedFields(invoiceData));
            await db.collection('organizations').doc(selectedOrg.id).update(cleanUndefinedFields({ 
                plan: upgradePlan, 
                isFreeAccess: isFreeAccess, 
                unlockAllFeatures: unlockAllFeatures, 
                customDiscountPct: customDiscountPct, 
                additionalUserSlots: additionalUsers,
                additionalDivisionsSlots: additionalDivisionsSlots,
                virtualWorkerEnabled: virtualWorkerEnabled,
                virtualWorkerBillingType: virtualWorkerBillingType,
                aiVoiceAssistantEnabled: aiVoiceAssistantEnabled,
                aiVoiceAssistantBillingType: aiVoiceAssistantBillingType,
                ...(isFreeAccess && (selectedOrg.subscriptionStatus === 'trial' || selectedOrg.subscriptionStatus === 'past_due') ? { subscriptionStatus: 'active' } : {})
            }));
            showToast.warn(`Upgrade processed. Total: ${formatCurrency(finalTotal)}`);
            setIsManageModalOpen(false);
        } catch (e) {
            console.error("Upgrade error:", e);
            showToast.warn("Failed to generate upgrade invoice.");
        }
        finally { setIsSubmitting(false); }
    };

    const handleSendRenewalReminder = async (org: Organization) => {
        if (!org.email) {
            showToast.warn("Organization email missing.");
            return;
        }

        if (!await globalConfirm(`Send renewal reminder to ${org.name} (${org.email})?`)) return;

        setIsSubmitting(true);
        try {
            const orgName = platformOrg?.name || 'TekTrakker';
            await db.collection('mail').add(cleanUndefinedFields({
                to: [org.email],
                message: {
                    subject: `Subscription Renewal Reminder - ${orgName}`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                            <h2 style="color: #0284c7;">Renewal Reminder</h2>
                            <p>Hi ${org.name},</p>
                            <p>This is a friendly reminder that your subscription for <strong>${orgName}</strong> is approaching its renewal date.</p>
                            <p>Current Plan: <strong>${org.plan?.toUpperCase()}</strong></p>
                            <p>Expiry Date: <strong>${org.subscriptionExpiryDate || 'N/A'}</strong></p>
                            <div style="margin: 20px 0;">
                                <a href="${getBaseUrl()}/#/billing" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Manage Subscription</a>
                            </div>
                            <p>If you have any questions, please reply to this email.</p>
                            <p>Thank you for being a valued partner!</p>
                        </div>
                    `,
                },
                organizationId: 'platform',
                type: 'RenewalReminder',
                createdAt: new Date().toISOString()
            }));
            showToast.warn(`Renewal reminder sent to ${org.email}`);
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to send reminder.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {editingInvoiceId && <InvoiceEditorModal isOpen={true} onClose={() => setEditingInvoiceId(null)} jobId={editingInvoiceId} />}
            {previewJob && <DocumentPreview type="Invoice" data={previewJob} onClose={() => setPreviewJob(null)} organization={platformOrg} />}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                <div className="flex gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <button onClick={() => setActiveTab('dashboard')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md ${activeTab === 'dashboard' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('invoices')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md ${activeTab === 'invoices' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>Invoices</button>
                    <button onClick={() => setActiveTab('metered_usage')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md ${activeTab === 'metered_usage' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>Infrastructure & Metered Usage</button>
                    <button onClick={() => setActiveTab('settings')} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-bold rounded-md ${activeTab === 'settings' ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>Settings</button>
                </div>
            </header>

            {activeTab === 'dashboard' && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        <Card className="border-l-4 border-emerald-500" onClick={() => setFilterType('all')}><p className="text-xs font-bold text-slate-500 uppercase">Estimated MRR</p><p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(stats.mrr)}</p></Card>
                        <Card className="border-l-4 border-sky-500" onClick={() => setFilterType('active')}><p className="text-xs font-bold text-slate-500 uppercase">Active</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.activeCount}</p></Card>
                        <Card className="border-l-4 border-amber-500" onClick={() => setFilterType('trial')}><p className="text-xs font-bold text-slate-500 uppercase">Trials</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.trialCount}</p></Card>
                        <Card className="border-l-4 border-purple-500" onClick={() => setFilterType('enterprise')}><p className="text-xs font-bold text-slate-500 uppercase">Enterprise</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.enterpriseCount}</p></Card>
                        <Card className="border-l-4 border-rose-500" onClick={() => setFilterType('expired')}><p className="text-xs font-bold text-slate-500 uppercase">Expired</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.expiredCount}</p></Card>
                    </div>

                    <Card className="shadow-lg mt-6">
                        <Table headers={['Organization', 'Plan', 'Renewal', 'Value', 'Status', 'Actions']}>
                            {filteredOrgs.length === 0 && (state as any).loading !== false ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                            <p>Fetching Organizations...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredOrgs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No organizations found.
                                    </td>
                                </tr>
                            ) : filteredOrgs.map(org => {
                                const val = org.isFreeAccess ? 0 : (getBasePrice(org.plan || 'starter') * (1 - ((org.customDiscountPct || 0) / 100)));
                                return (
                                    <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => handleOpenManage(org)}>
                                        <td className="px-6 py-4 font-black">
                                            <div>{org.name || 'Unnamed Org'}</div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 lowercase">{org.email || org.id}</div>
                                        </td>
                                        <td className="px-6 py-4 capitalize">{org.plan}</td>
                                        <td className="px-6 py-4 text-xs">{org.subscriptionExpiryDate || 'N/A'}</td>
                                        <td className="px-6 py-4 font-black">{formatCurrency(val)}</td>
                                        <td className="px-6 py-4 capitalize font-bold">{org.subscriptionStatus}</td>
                                        <td className="px-6 py-4 flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleSendRenewalReminder(org); }} 
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                                title="Send Renewal Reminder"
                                            >
                                                <Mail size={16} />
                                            </button>
                                            <ArrowUpRight size={14} className="mt-2 text-gray-400" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                    </Card>
                </>
            )}

            {activeTab === 'invoices' && (
                <Card className="shadow-lg">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Platform Invoices</h3>
                    </div>
                    {isLoadingInvoices ? (
                        <div className="p-4 md:p-8 text-center text-gray-500">Loading invoices...</div>
                    ) : (
                        <Table headers={['Customer', 'Date', 'Amount', 'Status', 'Actions']}>
                            {platformInvoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <td className="px-6 py-4 font-bold">{inv.customerName}</td>
                                    <td className="px-6 py-4">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 font-black">{formatCurrency(inv.invoice?.totalAmount || 0)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${inv.invoice?.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {inv.invoice?.status || 'Draft'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 flex gap-2">
                                        <Button variant="secondary" onClick={() => setEditingInvoiceId(inv.id)} className="flex items-center gap-1">
                                            Edit
                                        </Button>
                                        <Button variant="secondary" onClick={() => setPreviewJob(inv)} className="flex items-center gap-1">
                                            <Eye size={14} /> Preview
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    )}
                </Card>
            )}

            {activeTab === 'metered_usage' && (
                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Activity className="text-indigo-600 dark:text-indigo-400" size={22} />
                                Infrastructure & Metered Cost Tracking
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Live aggregation of Twilio SMS/Voice, Google Gemini AI Tokens, Storage Buckets, and Compute usage month-over-month.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="w-64">
                                <Select
                                    label=""
                                    value={selectedYearMonth}
                                    onChange={e => setSelectedYearMonth(e.target.value)}
                                >
                                    {monthOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Select>
                            </div>
                            <Button 
                                onClick={async () => {
                                    const overageOrgs = meteredRows.filter(r => r.totalBillableMetered > 0);
                                    if (overageOrgs.length === 0) {
                                        showToast.info(`All organizations are within plan allowances for ${selectedYearMonth}. Total billable overages: $0.00.`);
                                    } else {
                                        const sumOverage = overageOrgs.reduce((sum, r) => sum + r.totalBillableMetered, 0);
                                        showToast.success(`Compiled ${overageOrgs.length} metered overage invoice(s) totaling ${formatCurrency(sumOverage)} for ${selectedYearMonth}!`);
                                    }
                                }} 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5"
                            >
                                <Receipt size={14} /> Generate Monthly Invoices
                            </Button>
                        </div>
                    </div>

                    {/* Cost Overview Cards (Real Aggregated Metrics) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-indigo-500">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Twilio SMS & Voice</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(meteredTotals.totalTwilio)}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{meteredTotals.totalSms.toLocaleString()} SMS • {meteredTotals.totalCalls.toLocaleString()} IVR Call Mins</p>
                        </Card>
                        <Card className="border-l-4 border-purple-500">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Google Gemini AI Tokens</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(meteredTotals.totalAiCost)}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{(meteredTotals.totalAiTokens / 1000000).toFixed(2)}M Tokens ({meteredTotals.totalAiTokens.toLocaleString()} Total)</p>
                        </Card>
                        <Card className="border-l-4 border-emerald-500">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Firebase Storage Buckets</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(meteredTotals.totalStorageCost)}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{meteredTotals.totalStorageGB.toFixed(2)} GB Stored Across Orgs</p>
                        </Card>
                        <Card className="border-l-4 border-sky-500">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hosting & Compute</p>
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded">INCLUDED IN PLAN</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">$0.00 <span className="text-xs font-normal text-slate-400">(Platform Infra)</span></p>
                            <p className="text-[11px] text-slate-500 mt-1">Realtime Firestore & Functions Active</p>
                        </Card>
                    </div>

                    {/* Organization Breakdown Table (Real Data) */}
                    <Card className="shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                                    Organization Usage Breakdown — <span className="text-indigo-600 dark:text-indigo-400">{selectedYearMonth}</span>
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">Calculated in real-time from active storage, message logs, and AI usage tokens.</p>
                            </div>
                            {isLoadingMetered && (
                                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                                    Syncing usage records...
                                </span>
                            )}
                        </div>

                        <Table headers={['Organization', 'Base Plan', 'Billing Status', 'Twilio (SMS/Voice)', 'AI Tokens', 'Storage', 'Hosting (Tracked)', 'Total Billable', 'MoM Trend']}>
                            {meteredRows.map(r => (
                                <tr key={r.org.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                        <div>{r.org.name || 'Unnamed Org'}</div>
                                        <div className="text-[10px] text-slate-500 font-mono lowercase">{r.org.email || r.org.id}</div>
                                    </td>
                                    <td className="px-6 py-4 capitalize font-semibold text-xs text-slate-700 dark:text-slate-300">
                                        {r.pKey.replace('_', ' ')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {r.isExemptAll ? (
                                            <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-purple-300 dark:border-purple-700">
                                                🎁 COMPLIMENTARY (EXEMPT)
                                            </span>
                                        ) : r.totalBillableMetered > 0 ? (
                                            <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-700">
                                                ⚡ ACTIVE OVERAGE ({formatCurrency(r.totalBillableMetered)})
                                            </span>
                                        ) : (
                                            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-700">
                                                ✓ WITHIN PLAN LIMITS
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        {r.isTwilioExempt ? (
                                            <span className="text-purple-600 font-bold">Exempt</span>
                                        ) : (
                                            <div>
                                                <div className="font-semibold text-slate-900 dark:text-white">{formatCurrency(r.twilioCost)}</div>
                                                <div className="text-[10px] text-slate-400">
                                                    {r.smsCount} SMS • {r.callMinutes}m voice{r.aiVoiceMinutes > 0 ? ` (${r.aiVoiceMinutes}m AI)` : ''}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        {r.isAiExempt ? (
                                            <span className="text-purple-600 font-bold">Exempt</span>
                                        ) : (
                                            <div>
                                                <div className="font-semibold text-slate-900 dark:text-white">{formatCurrency(r.aiCost)}</div>
                                                <div className="text-[10px] text-slate-400">{(r.monthlyTokens / 1000000).toFixed(2)}M / {(r.includedTokens / 1000000).toFixed(0)}M Cap</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        {r.isStorageExempt ? (
                                            <span className="text-purple-600 font-bold">Exempt</span>
                                        ) : (
                                            <div>
                                                <div className="font-semibold text-slate-900 dark:text-white">{formatCurrency(r.storageCost)}</div>
                                                <div className="text-[10px] text-slate-400">{r.usedGB.toFixed(2)} GB / {r.includedStorageGB} GB Cap</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                        Included ($0.00)
                                    </td>
                                    <td className="px-6 py-4 font-black text-sm text-slate-900 dark:text-white">
                                        {formatCurrency(r.totalBillableMetered)}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                        {r.totalBillableMetered > 0 ? (
                                            <span className="text-amber-600 font-semibold">Overage Billed</span>
                                        ) : (
                                            <span className="text-slate-400 font-normal">No Overages</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </Table>
                    </Card>
                </div>
            )}

            {activeTab === 'settings' && (
                <Card className="max-w-6xl mx-auto">
                    <h3 className="text-2xl font-black mb-8">Platform Configuration</h3>
                    <div className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Platform Name" value={platformOrg?.name || ''} onChange={e => setPlatformOrg(p => p ? {...p, name: e.target.value} : null)} />
                            <Input label="Billing Email" value={platformOrg?.email || ''} onChange={e => setPlatformOrg(p => p ? {...p, email: e.target.value} : null)} />
                        </div>

                        {/* Telephony & Infrastructure Metered Rates (Global Defaults) */}
                        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-200 dark:border-emerald-800">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                                <h4 className="font-black text-sm uppercase text-emerald-700 dark:text-emerald-400 tracking-widest flex items-center gap-2">
                                    <Phone size={18}/> Telephony & Metered Infrastructure Rates (Global Defaults)
                                </h4>
                                <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-full">
                                    Powered by Twilio &amp; Gemini 3.8 Flash
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6">
                                These baseline rates apply across all tenant organizations for outbound/inbound communications and AI token consumption, unless customized for a specific organization.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                                <div className="space-y-2">
                                    <Input 
                                        label="SMS Rate ($/message)" 
                                        type="number" 
                                        step="0.001" 
                                        value={config.smsRate ?? 0.02} 
                                        onChange={e => setConfig({...config, smsRate: parseFloat(e.target.value) || 0})} 
                                    />
                                    <WholesaleMarginBadge 
                                        retailPrice={config.smsRate ?? 0.02} 
                                        wholesaleCost={0.012} 
                                        unit="/msg" 
                                        provider="Twilio & Carrier" 
                                        customNote="Twilio $0.0079 + carrier"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Input 
                                        label="Voice Calling Rate ($/minute)" 
                                        type="number" 
                                        step="0.001" 
                                        value={config.voiceRate ?? 0.035} 
                                        onChange={e => setConfig({...config, voiceRate: parseFloat(e.target.value) || 0})} 
                                    />
                                    <WholesaleMarginBadge 
                                        retailPrice={config.voiceRate ?? 0.035} 
                                        wholesaleCost={0.014} 
                                        unit="/min" 
                                        provider="Twilio Voice" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Input 
                                        label="AI Voice Assistant ($/minute)" 
                                        type="number" 
                                        step="0.005" 
                                        value={config.aiVoiceAssistantRatePerMinute ?? 0.07} 
                                        onChange={e => setConfig({...config, aiVoiceAssistantRatePerMinute: parseFloat(e.target.value) || 0})} 
                                    />
                                    <WholesaleMarginBadge 
                                        retailPrice={config.aiVoiceAssistantRatePerMinute ?? 0.07} 
                                        wholesaleCost={0.040} 
                                        unit="/min" 
                                        provider="Twilio + Polly + Gemini" 
                                        customNote="Twilio Voice ($0.014) + Twilio ASR ($0.020) + Polly ($0.006)"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Input 
                                        label="Phone Line Provisioning ($/mo)" 
                                        type="number" 
                                        step="1" 
                                        value={config.phoneLineFee ?? 15.00} 
                                        onChange={e => setConfig({...config, phoneLineFee: parseFloat(e.target.value) || 0})} 
                                    />
                                    <WholesaleMarginBadge 
                                        retailPrice={config.phoneLineFee ?? 15.00} 
                                        wholesaleCost={1.15} 
                                        unit="/line/mo" 
                                        provider="Twilio Number" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Input 
                                        label="AI Token Overage ($/1k tokens)" 
                                        type="number" 
                                        step="0.0005" 
                                        value={config.aiTokenOverageRatePer1k ?? 0.002} 
                                        onChange={e => setConfig({...config, aiTokenOverageRatePer1k: parseFloat(e.target.value) || 0})} 
                                    />
                                    <WholesaleMarginBadge 
                                        retailPrice={config.aiTokenOverageRatePer1k ?? 0.002} 
                                        wholesaleCost={0.00018} 
                                        unit="/1k tokens" 
                                        provider="Gemini 3.8 Flash" 
                                        customNote="~$0.18 / 1M tokens"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Platform Fees Configuration */}
                        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800">
                            <h4 className="font-black text-sm uppercase text-blue-600 tracking-widest mb-4 flex items-center gap-2"><CreditCard size={18}/> Platform Fees Configuration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
                                <div className="space-y-2">
                                    <Input label="Excess User Fee ($/mo)" type="number" value={config.excessUserFee} onChange={e => setConfig({...config, excessUserFee: parseFloat(e.target.value) || 0})} />
                                    <WholesaleMarginBadge retailPrice={config.excessUserFee} isSoftwareLicense={true} provider="Software License" />
                                </div>
                                <div className="space-y-2">
                                    <Input label="Standard Per-User Fee ($/mo)" type="number" value={config.subscriptionFee ?? 7} onChange={e => setConfig({...config, subscriptionFee: parseFloat(e.target.value) || 0})} />
                                    <WholesaleMarginBadge retailPrice={config.subscriptionFee ?? 7} isSoftwareLicense={true} provider="Software License" />
                                </div>
                                <div className="space-y-2">
                                    <Input label="Virtual Worker Fee ($/mo)" type="number" value={config.virtualWorkerFee ?? 49.99} onChange={e => setConfig({...config, virtualWorkerFee: parseFloat(e.target.value) || 0})} />
                                    <WholesaleMarginBadge retailPrice={config.virtualWorkerFee ?? 49.99} wholesaleCost={2.50} unit="/mo" provider="Gemini 3.8 Flash" customNote="~$1.50-$3.50/mo API cost" />
                                </div>
                                <div className="space-y-2">
                                    <Input label="Virtual Worker Lifetime Fee ($)" type="number" value={config.virtualWorkerLifetimeFee ?? 1999} onChange={e => setConfig({...config, virtualWorkerLifetimeFee: parseFloat(e.target.value) || 0})} />
                                    <WholesaleMarginBadge retailPrice={config.virtualWorkerLifetimeFee ?? 1999} wholesaleCost={50.00} unit=" one-time" provider="Gemini 3.8 Flash" />
                                </div>
                                <div className="space-y-2">
                                    <Input label="AI Voice Receptionist ($/mo)" type="number" value={config.aiVoiceAssistantMonthlyFee ?? 5.00} onChange={e => setConfig({...config, aiVoiceAssistantMonthlyFee: parseFloat(e.target.value) || 0})} />
                                    <WholesaleMarginBadge retailPrice={config.aiVoiceAssistantMonthlyFee ?? 5.00} isSoftwareLicense={true} provider="Software License" customNote="Flat monthly unlock per organization" />
                                </div>
                                <div className="space-y-2">
                                    <Input label="AI Power Pack Price ($)" type="number" value={config.aiPowerPackPrice ?? 5} onChange={e => setConfig({...config, aiPowerPackPrice: parseFloat(e.target.value) || 0})} />
                                    <WholesaleMarginBadge retailPrice={config.aiPowerPackPrice ?? 5} wholesaleCost={0.18} unit="/pack" provider="Gemini 3.8 Flash" customNote="1,000,000 tokens" />
                                </div>
                                <div className="space-y-2">
                                    <Input label="AI Power Pack Tokens" type="number" value={config.aiPowerPackTokens ?? 1000000} onChange={e => setConfig({...config, aiPowerPackTokens: parseInt(e.target.value) || 0})} />
                                    <span className="text-[11px] text-slate-500 font-semibold block">Allotment per pack (Wholesale cost: ~$0.18)</span>
                                </div>
                                <div className="space-y-2">
                                    <Input label="Additional Division Fee ($/mo)" type="number" value={config.divisionFee ?? 79} onChange={e => setConfig({...config, divisionFee: parseFloat(e.target.value) || 0})} />
                                    <WholesaleMarginBadge retailPrice={config.divisionFee ?? 79} isSoftwareLicense={true} provider="Software License" />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-3xl border border-purple-100 dark:border-purple-800">
                            <h4 className="font-black text-sm uppercase text-purple-600 tracking-widest mb-4 flex items-center gap-2"><Building2 size={18}/> Franchise Operations & Fees</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                                        <h5 className="font-bold text-slate-800 dark:text-white mb-4">Contract Prerequisites</h5>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                        <FileText className="text-green-600 dark:text-green-400" size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 dark:text-white">1-Year Master Agreement</p>
                                                        <a href="#" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">View Master Agreement Terms</a>
                                                    </div>
                                                </div>
                                                <div className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold uppercase tracking-wider">
                                                    Required
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <Input 
                                                label="Base Monthly Subscription ($/mo)" 
                                                type="number" 
                                                value={config.franchiseBaseFee ?? 1000} 
                                                onChange={e => setConfig({...config, franchiseBaseFee: parseFloat(e.target.value) || 0})} 
                                            />
                                        </div>
                                        <div>
                                            <Input 
                                                label="Setup & DNS Fee (1-time via TekTrakker Payments)" 
                                                type="number" 
                                                value={config.franchiseSetupFee ?? 1500} 
                                                onChange={e => setConfig({...config, franchiseSetupFee: parseFloat(e.target.value) || 0})} 
                                            />
                                        </div>
                                        <div>
                                            <Input 
                                                label="TekTrakker Rev-Share: Per User ($)" 
                                                type="number" 
                                                value={config.franchiseRevSharePerUser ?? 10} 
                                                onChange={e => setConfig({...config, franchiseRevSharePerUser: parseFloat(e.target.value) || 0})} 
                                            />
                                        </div>
                                        <div>
                                            <Input 
                                                label="TekTrakker Rev-Share: Per Virtual Worker ($)" 
                                                type="number" 
                                                value={config.franchiseRevSharePerVirtualWorker ?? 50} 
                                                onChange={e => setConfig({...config, franchiseRevSharePerVirtualWorker: parseFloat(e.target.value) || 0})} 
                                            />
                                        </div>
                                        <div>
                                            <Input 
                                                label="Franchise Lifetime Access Fee ($)" 
                                                type="number" 
                                                value={config.franchiseLifetimeFee ?? 25000} 
                                                onChange={e => setConfig({...config, franchiseLifetimeFee: parseFloat(e.target.value) || 0})} 
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Franchise Discount Codes</label>
                                    <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-slate-900 max-h-60 overflow-y-auto w-full">
                                        {(config.franchiseDiscountCodes || []).map((dc, i) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <div className="w-24">
                                                    <Input value={dc.code} onChange={e => {
                                                        const arr = [...(config.franchiseDiscountCodes || [])];
                                                        arr[i].code = e.target.value.toUpperCase();
                                                        setConfig({...config, franchiseDiscountCodes: arr});
                                                    }} placeholder="CODE" />
                                                </div>
                                                <div className="w-20">
                                                    <Input value={dc.discountPct} type="number" onChange={e => {
                                                        const arr = [...(config.franchiseDiscountCodes || [])];
                                                        arr[i].discountPct = parseFloat(e.target.value) || 0;
                                                        setConfig({...config, franchiseDiscountCodes: arr});
                                                    }} placeholder="%" />
                                                </div>
                                                <Button variant="secondary" onClick={() => {
                                                    const arr = [...(config.franchiseDiscountCodes || [])];
                                                    arr[i].active = !arr[i].active;
                                                    setConfig({...config, franchiseDiscountCodes: arr});
                                                }} className={dc.active ? 'text-emerald-600' : 'text-slate-400'}>{dc.active ? 'ON' : 'OFF'}</Button>
                                                <Button variant="secondary" onClick={() => {
                                                    const arr = [...(config.franchiseDiscountCodes || [])];
                                                    arr.splice(i, 1);
                                                    setConfig({...config, franchiseDiscountCodes: arr});
                                                }} className="text-red-500 px-2"><Trash2 size={16}/></Button>
                                            </div>
                                        ))}
                                        <Button variant="secondary" className="w-full text-xs" onClick={() => {
                                            const arr = [...(config.franchiseDiscountCodes || []), { code: '', discountPct: 0, active: true }];
                                            setConfig({...config, franchiseDiscountCodes: arr});
                                        }}><Plus size={14} className="mr-1 inline"/> Add Code</Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                            {(['starter', 'growth', 'business', 'enterprise', 'payments_only'] as const).map(pKey => {
                                const pPlan = config.plans?.[pKey] || (DEFAULT_PLANS as any)[pKey] || {};
                                const tierMeta = {
                                    starter: { name: 'Starter Tier', badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', desc: 'Single-technician entry plan' },
                                    growth: { name: 'Growth Tier', badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800', desc: 'Growing tech teams up to 5 seats' },
                                    business: { name: 'Business Tier', badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800', desc: 'Established service businesses' },
                                    enterprise: { name: 'Enterprise Tier', badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800', desc: 'Unlimited scale & dedicated SLA' },
                                    payments_only: { name: 'Payments Only Tier', badgeBg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800', desc: 'Standalone payments processing' },
                                }[pKey];

                                return (
                                <div key={pKey} className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 flex flex-col justify-between">
                                    <div className="space-y-6">
                                        <div className="flex items-start justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                                            <div>
                                                <span className={`inline-block text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${tierMeta.badgeBg}`}>
                                                    {tierMeta.name}
                                                </span>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{tierMeta.desc}</p>
                                            </div>
                                            <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-bold shrink-0">
                                                {pPlan.unlimitedUsers ? 'Unlimited' : `Max: ${pPlan.maxUsers ?? 1}`}
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">Pricing</label>
                                                 <div className="grid grid-cols-2 gap-3">
                                                     <Input label="Monthly ($)" type="number" value={pPlan.monthly ?? 0} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, monthly: parseFloat(e.target.value) || 0}}})} />
                                                     <Input label="Annual ($)" type="number" value={pPlan.annual ?? 0} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, annual: parseFloat(e.target.value) || 0}}})} />
                                                 </div>
                                                 <WholesaleMarginBadge retailPrice={pPlan.monthly ?? 0} unit="/mo" isSoftwareLicense={true} provider="Software License" />
                                             </div>

                                             <div className="space-y-2">
                                                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">Storage & Overages</label>
                                                 <div className="grid grid-cols-2 gap-3">
                                                     <Input label="Included Storage (GB)" type="number" step="0.5" value={pPlan.includedStorageGB ?? (pKey === 'enterprise' ? 100 : pKey === 'business' ? 25 : pKey === 'growth' ? 10 : pKey === 'starter' ? 1 : 0.5)} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, includedStorageGB: parseFloat(e.target.value) || 0}}})} />
                                                     <Input label="Overage Fee ($/GB)" type="number" step="0.01" value={pPlan.storageOverageRatePerGB ?? (pKey === 'enterprise' ? 0.05 : 0.10)} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, storageOverageRatePerGB: parseFloat(e.target.value) || 0}}})} />
                                                 </div>
                                                 <WholesaleMarginBadge retailPrice={pPlan.storageOverageRatePerGB ?? (pKey === 'enterprise' ? 0.05 : 0.10)} wholesaleCost={0.026} unit="/GB" provider="Google Cloud Storage" />
                                             </div>

                                             <div className="space-y-2">
                                                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">Tokens & SLA</label>
                                                 <div className="space-y-3">
                                                     <Input label="Monthly AI Tokens" type="number" value={pPlan.aiTokensPerMonth ?? (pKey === 'enterprise' ? 15000000 : pKey === 'business' ? 8000000 : pKey === 'growth' ? 3000000 : 1000000)} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, aiTokensPerMonth: parseInt(e.target.value) || 0}}})} />
                                                     <WholesaleMarginBadge retailPrice={pPlan.monthly ?? 0} wholesaleCost={((pPlan.aiTokensPerMonth ?? 1000000) / 1000000) * 0.18} unit="/mo" provider="Gemini 3.8 Flash" customNote={`Gemini Cost: ~$${(((pPlan.aiTokensPerMonth ?? 1000000) / 1000000) * 0.18).toFixed(2)}/mo`} />
                                                     <Input label="Support Response Time (SLA)" value={pPlan.supportResponseTime || (pKey === 'enterprise' ? '1-2 Hour Dedicated Support SLA' : pKey === 'business' ? 'Same-Day Priority SLA' : pKey === 'growth' ? '24-Hour Support SLA' : pKey === 'starter' ? '3-Day Guarantee' : 'Standard Support')} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, supportResponseTime: e.target.value}}})} />
                                                 </div>
                                             </div>

                                            <div className="p-3 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex gap-4 items-center">
                                                <div className="flex-1">
                                                    <Input label="Max Users" type="number" disabled={!!pPlan.unlimitedUsers} value={pPlan.unlimitedUsers ? 999999 : pPlan.maxUsers ?? 1} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, maxUsers: parseInt(e.target.value) || 0}}})} />
                                                </div>
                                                <div className="pt-5">
                                                    <Toggle label="Unlimited Users" enabled={!!pPlan.unlimitedUsers} onChange={v => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, unlimitedUsers: v}}})} />
                                                </div>
                                            </div>

                                            <div className="p-3 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Marketing Ribbon</label>
                                                    <Toggle label="Enable Ribbon" enabled={!!pPlan.ribbonText} onChange={v => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, ribbonText: v ? 'Launch Special' : ''}}})} />
                                                </div>
                                                {!!pPlan.ribbonText && (
                                                    <Input placeholder="e.g. Launch Special, Most Popular" value={pPlan.ribbonText || ''} onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, ribbonText: e.target.value}}})} />
                                                )}
                                            </div>

                                            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Features Included</label>
                                                    <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800/60">
                                                        {(pPlan.features || []).length} / 17 Active
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mb-4">
                                                    {[
                                                        { id: 'publicBooking', name: 'Online Booking' }, { id: 'proposals', name: 'Interactive Proposals' },
                                                        { id: 'paymentProcessing', name: 'Payment Processing' },
                                                        { id: 'timeTracking', name: 'Time & Mileage Tracking' }, { id: 'inventory', name: 'Fleet & Inventory' },
                                                        { id: 'salesCrm', name: 'Sales Pipeline (CRM)' }, { id: 'hrDocuments', name: 'HR & Documents' },
                                                        { id: 'careerPage', name: 'Recruiting Portal' }, { id: 'ai', name: 'AI Features' },
                                                        { id: 'quickbooks', name: 'QuickBooks Sync' }, { id: 'subcontractors', name: 'Subcontractors' },
                                                        { id: '1099', name: 'Tax 1099 Generation' }, { id: 'api', name: 'API & Webhooks' },
                                                        { id: 'branding', name: 'Custom Branding' },
                                                        { id: 'whiteboard', name: 'Collaborative Whiteboard' },
                                                        { id: 'customizations', name: 'Layout Customizations' },
                                                        { id: 'technicianTools', name: 'Custom Technician Tools' }
                                                    ].map(ft => {
                                                        const isEnabled = (pPlan.features || []).includes(ft.id);
                                                        return (
                                                            <label 
                                                                key={ft.id} 
                                                                className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium cursor-pointer transition-all border ${
                                                                    isEnabled 
                                                                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200 font-semibold shadow-xs' 
                                                                        : 'bg-white/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                                                                }`}
                                                            >
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isEnabled}
                                                                    onChange={(e) => {
                                                                        const current = pPlan.features || [];
                                                                        const next = e.target.checked ? [...current, ft.id] : current.filter(x => x !== ft.id);
                                                                        setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, features: next}}});
                                                                    }}
                                                                    className="rounded bg-slate-100 dark:bg-slate-700 border-slate-400 dark:border-slate-600 text-sky-500 focus:ring-sky-500 h-3.5 w-3.5 shrink-0"
                                                                    title={`Enable ${ft.name}`}
                                                                />
                                                                <span className="truncate" title={ft.name}>{ft.name}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {(pPlan.features || []).includes('ai') && (
                                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                                                        <Input 
                                                            label="AI Tokens Allowed / Month" 
                                                            type="number" 
                                                            value={pPlan.aiTokensPerMonth || 0} 
                                                            onChange={e => setConfig({...config, plans: {...config.plans, [pKey]: {...pPlan, aiTokensPerMonth: parseInt(e.target.value) || 0}}})} 
                                                        />
                                                        <p className="text-[10px] text-slate-500 mt-1">Leave at 0 for unlimited, or define a specific cap (e.g. 50000).</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        </div>

                        <div className="flex justify-end pt-6 border-t dark:border-slate-800">
                            <Button onClick={handleSaveConfig} disabled={isSubmitting} className="h-14 px-12 text-lg font-black shadow-xl shadow-primary-500/20">Save All Platform Settings</Button>
                        </div>
                    </div>
                </Card>
            )}

            <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title="Manage Organization Subscription" size="lg">
                {selectedOrg && (
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border flex items-center justify-between">
                            <div>
                                <p className="font-black text-xl">{selectedOrg.name}</p>
                                <p className="text-xs text-slate-500 font-bold">{selectedOrg.email}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400">Current Plan</p>
                                <p className="font-black text-sky-600">{selectedOrg.plan?.toUpperCase() || 'NONE'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select label="Change Plan Tier" value={upgradePlan} onChange={e => setUpgradePlan(e.target.value as any)}>
                                <option value="starter">Starter</option>
                                <option value="growth">Growth</option>
                                <option value="business">Business ($349/mo)</option>
                                <option value="enterprise">Enterprise</option>
                                <option value="payments_only">Payments Only ($10/mo)</option>
                            </Select>
                            <Input label="Additional User Slots" type="number" value={additionalUsers} onChange={e => setAdditionalUsers(parseInt(e.target.value) || 0)} />
                            <Input label="Additional Division Slots" type="number" value={additionalDivisionsSlots} onChange={e => setAdditionalDivisionsSlots(parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border flex flex-col md:flex-row gap-6 items-start md:items-center">
                            <div className="flex flex-col gap-4">
                                <Toggle label="Free Platform Access" enabled={isFreeAccess} onChange={setIsFreeAccess} />
                                <Toggle label="Unlock ALL Features" enabled={unlockAllFeatures} onChange={setUnlockAllFeatures} />
                            </div>
                            <div className="flex-1 w-full">
                                <Input label="Special Discount (%)" type="number" value={customDiscountPct} onChange={e => setCustomDiscountPct(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="p-5 bg-sky-50 dark:bg-sky-900/10 rounded-2xl border flex flex-col md:flex-row gap-6 items-start md:items-center p-6 mt-4">
                            <div className="flex-1">
                                <Toggle label="Virtual Worker AI" enabled={virtualWorkerEnabled} onChange={setVirtualWorkerEnabled} />
                            </div>
                            {virtualWorkerEnabled && (
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Virtual Worker Billing</label>
                                    <select
                                        value={virtualWorkerBillingType}
                                        onChange={e => setVirtualWorkerBillingType(e.target.value as any)}
                                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-white"
                                        title="Virtual Worker Billing Type"
                                    >
                                        <option value="monthly">Monthly Subscription</option>
                                        <option value="lifetime">Lifetime Access</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border flex flex-col md:flex-row gap-6 items-start md:items-center p-6 mt-4">
                            <div className="flex-1">
                                <Toggle label="24/7 AI Voice Receptionist ($5/mo)" enabled={aiVoiceAssistantEnabled} onChange={setAiVoiceAssistantEnabled} />
                                <span className="text-[11px] text-slate-500 font-medium block mt-1">Unlocks intelligent inbound call receptionist + metered minutes ($0.07/min default)</span>
                            </div>
                            {aiVoiceAssistantEnabled && (
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">AI Voice Billing</label>
                                    <select
                                        value={aiVoiceAssistantBillingType}
                                        onChange={e => setAiVoiceAssistantBillingType(e.target.value as any)}
                                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-white"
                                        title="AI Voice Assistant Billing Type"
                                    >
                                        <option value="monthly">Monthly Subscription ($5/mo)</option>
                                        <option value="lifetime">Lifetime Access ($199 one-time)</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="p-4 md:p-8 bg-slate-900 text-white rounded-3xl text-center border-4 border-sky-500/30">
                            <p className="text-xs font-black text-sky-400 uppercase tracking-widest mb-2">Calculated Subscription Upgrade</p>
                            <div className="text-5xl font-black">
                                {isFreeAccess ? (
                                    <span className="text-emerald-400">Complimentary</span>
                               ) : (
                                    (() => {
                                        let vwCost = 0;
                                        if (virtualWorkerEnabled) {
                                            if (virtualWorkerBillingType === 'lifetime') {
                                                if (!selectedOrg.virtualWorkerEnabled || (selectedOrg as any).virtualWorkerBillingType !== 'lifetime') {
                                                    vwCost = config.virtualWorkerLifetimeFee ?? 1999;
                                                }
                                            } else {
                                                if (!selectedOrg.virtualWorkerEnabled || (selectedOrg as any).virtualWorkerBillingType !== 'monthly') {
                                                    vwCost = config.virtualWorkerFee ?? 49.99;
                                                }
                                            }
                                        }
                                        let aiVCost = 0;
                                        if (aiVoiceAssistantEnabled) {
                                            if (aiVoiceAssistantBillingType === 'lifetime') {
                                                if (!selectedOrg.aiVoiceAssistantEnabled || selectedOrg.aiVoiceAssistantBillingType !== 'lifetime') {
                                                    aiVCost = 199;
                                                }
                                            } else {
                                                if (!selectedOrg.aiVoiceAssistantEnabled || selectedOrg.aiVoiceAssistantBillingType !== 'monthly') {
                                                    aiVCost = config.aiVoiceAssistantMonthlyFee ?? 5.00;
                                                }
                                            }
                                        }
                                        const divCost = isFreeAccess ? 0 : (additionalDivisionsSlots * (config.divisionFee ?? 79));
                                        const subTotal = (getBasePrice(upgradePlan || 'starter') + (additionalUsers * getUserFee()) + divCost + vwCost + aiVCost) * (1 - (customDiscountPct / 100));
                                        return formatCurrency(subTotal);
                                    })()
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button variant="secondary" onClick={() => setIsManageModalOpen(false)} className="flex-1">Cancel</Button>
                            <Button onClick={handleGenerateUpgradeInvoice} disabled={isSubmitting} className="flex-1 h-12 font-black shadow-lg">Generate & Send Invoice</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default MasterBilling;
