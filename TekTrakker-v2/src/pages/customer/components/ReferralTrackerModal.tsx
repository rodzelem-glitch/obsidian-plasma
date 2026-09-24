import React, { useState, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Card from 'components/ui/Card';
import showToast from 'lib/toast';
import { db } from 'lib/firebase';
import { 
    Users, DollarSign, TrendingUp, Send, Copy, Check, Share2, 
    Mail, MessageSquare, Sparkles, Building2, Phone, Briefcase, 
    Info, ArrowRight, ShieldCheck, CheckCircle2, Clock, XCircle 
} from 'lucide-react';
import type { CustomerReferral } from 'types';

interface ReferralTrackerModalProps {
    isOpen: boolean;
    onClose: () => void;
    referrals: CustomerReferral[];
    currentUser: any;
    onReferralCreated?: (newRef: CustomerReferral) => void;
}

const SUPPORTED_TRADES = [
    'HVAC & Commercial Refrigeration',
    'Electrical & Solar Power',
    'Plumbing & Mechanical Piping',
    'Roofing & Exterior Services',
    'General Contracting & Remodeling',
    'Facilities & Property Management',
    'Landscaping & Groundskeeping',
    'Appliance Repair & Maintenance',
    'Cleaning & Commercial Janitorial',
    'Pest Control & Extermination',
    'Security, Fire & Low Voltage',
    'Painting & Surface Restoration',
    'Other Field Service Business'
];

const ReferralTrackerModal: React.FC<ReferralTrackerModalProps> = ({
    isOpen,
    onClose,
    referrals,
    currentUser,
    onReferralCreated
}) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'invite' | 'rules'>('dashboard');
    const [copied, setCopied] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state for sending new referral invite
    const [inviteForm, setInviteForm] = useState({
        businessName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        trade: 'HVAC & Commercial Refrigeration',
        notes: "I've been using TekTrakker for our facility operations and thought it would be an excellent fit for streamlining your scheduling, dispatching, and field billing!"
    });

    const referralCode = useMemo(() => {
        const uid = currentUser?.uid || currentUser?.id || 'USER';
        const namePart = (currentUser?.firstName || currentUser?.email?.split('@')[0] || 'TEK').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        const uidPart = uid.slice(0, 4).toUpperCase();
        return `${namePart}-${uidPart}`;
    }, [currentUser]);

    const referralLink = useMemo(() => {
        const uid = currentUser?.uid || currentUser?.id || '';
        return `https://app.tektrakker.com/#/signup?ref=${encodeURIComponent(referralCode)}&referrer=${encodeURIComponent(uid)}`;
    }, [referralCode, currentUser]);

    // Financial Metrics
    const metrics = useMemo(() => {
        const totalInvited = referrals.length;
        const activeSubscribers = referrals.filter(r => r.status === 'Active Customer');
        const monthlyRecurring = activeSubscribers.reduce((acc, curr) => acc + (curr.estimatedMonthlyCommission || 59.80), 0);
        const lifetimeEarned = referrals.reduce((acc, curr) => acc + (curr.totalEarnedCommission || (curr.status === 'Active Customer' ? 179.40 : 0)), 0);

        return {
            totalInvited,
            activeSubscribers: activeSubscribers.length,
            monthlyRecurring,
            lifetimeEarned
        };
    }, [referrals]);

    const filteredReferrals = useMemo(() => {
        return referrals.filter(ref => {
            const matchesQuery = 
                ref.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ref.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ref.trade.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ref.contactEmail.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesQuery) return false;

            if (statusFilter === 'active') return ref.status === 'Active Customer';
            if (statusFilter === 'pending') return ref.status !== 'Active Customer' && ref.status !== 'Closed Lost';
            return true;
        });
    }, [referrals, searchQuery, statusFilter]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        showToast.success('Referral link copied to clipboard!');
        setTimeout(() => setCopied(false), 3000);
    };

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteForm.businessName.trim() || !inviteForm.contactEmail.trim() || !inviteForm.contactName.trim()) {
            showToast.error('Please provide Business Name, Contact Name, and Email.');
            return;
        }

        setIsSubmitting(true);
        try {
            const newRefId = `ref-${Date.now()}`;
            const refData: CustomerReferral = {
                id: newRefId,
                referrerUserId: currentUser.uid,
                referrerEmail: currentUser.email,
                referrerName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email,
                businessName: inviteForm.businessName.trim(),
                contactName: inviteForm.contactName.trim(),
                contactEmail: inviteForm.contactEmail.trim().toLowerCase(),
                contactPhone: inviteForm.contactPhone.trim(),
                trade: inviteForm.trade,
                notes: inviteForm.notes.trim(),
                status: 'Invited',
                estimatedMonthlyCommission: 59.80, // Average 20% on Pro Tier ($299/mo)
                totalEarnedCommission: 0,
                lastStatusUpdate: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };

            await db.collection('referrals').doc(newRefId).set(refData);
            if (onReferralCreated) onReferralCreated(refData);

            showToast.success(`Referral invitation created for ${inviteForm.businessName}!`);
            
            // Reset form and switch to dashboard
            setInviteForm({
                businessName: '',
                contactName: '',
                contactEmail: '',
                contactPhone: '',
                trade: 'HVAC & Commercial Refrigeration',
                notes: "I've been using TekTrakker for our facility operations and thought it would be an excellent fit for streamlining your scheduling, dispatching, and field billing!"
            });
            setActiveTab('dashboard');
        } catch (err: any) {
            console.error('Error saving referral:', err);
            showToast.error('Failed to create referral invite: ' + (err.message || 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: CustomerReferral['status']) => {
        switch (status) {
            case 'Active Customer':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 size={12} /> Active (Earning 20%)
                    </span>
                );
            case 'Trial Active':
            case 'Demo Scheduled':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                        <Clock size={12} /> {status}
                    </span>
                );
            case 'Invited':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        <Send size={12} /> Invite Sent
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <XCircle size={12} /> {status}
                    </span>
                );
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="TekTrakker Business Referral & Affiliate Hub" size="xl">
            <div className="space-y-6">
                {/* Header Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-primary-900 to-slate-900 text-white p-6 shadow-xl border border-indigo-700/50">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-wider mb-2">
                                <Sparkles size={14} className="text-emerald-400" /> 20% First-Year Commission Program
                            </div>
                            <h2 className="text-2xl font-black tracking-tight text-white">Earn Passive Income on Every Referral</h2>
                            <p className="text-sm text-slate-300 max-w-xl mt-1">
                                Refer businesses, vendors, or contractors to TekTrakker and receive up to <strong>20% monthly commission</strong> for the first year (12 months) of their active subscription.
                            </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button 
                                onClick={() => setActiveTab('invite')} 
                                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black shadow-lg shadow-emerald-500/20 text-xs py-2 px-4"
                            >
                                <Send size={14} className="mr-1.5" /> Invite a Business
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`pb-3 text-sm font-black transition-colors relative flex items-center gap-2 ${
                            activeTab === 'dashboard'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <TrendingUp size={16} /> My Referrals & Earnings
                    </button>
                    <button
                        onClick={() => setActiveTab('invite')}
                        className={`pb-3 text-sm font-black transition-colors relative flex items-center gap-2 ${
                            activeTab === 'invite'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Send size={16} /> Send Direct Invite
                    </button>
                    <button
                        onClick={() => setActiveTab('rules')}
                        className={`pb-3 text-sm font-black transition-colors relative flex items-center gap-2 ${
                            activeTab === 'rules'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Info size={16} /> Program Details & Supported Industries
                    </button>
                </div>

                {/* TAB 1: DASHBOARD & PIPELINE */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Financial Metrics Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Card className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users size={14} className="text-primary-500" /> Total Referrals
                                </p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{metrics.totalInvited}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Invited businesses</p>
                            </Card>

                            <Card className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="text-emerald-500" /> Converted Sales
                                </p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{metrics.activeSubscribers}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Active subscribers</p>
                            </Card>

                            <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <DollarSign size={14} className="text-emerald-600" /> Monthly Payout
                                </p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                                    ${metrics.monthlyRecurring.toFixed(2)}<span className="text-xs font-bold">/mo</span>
                                </p>
                                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Recurring 20% cut</p>
                            </Card>

                            <Card className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50">
                                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <TrendingUp size={14} className="text-indigo-600" /> Lifetime Earned
                                </p>
                                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                                    ${metrics.lifetimeEarned.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">Cumulative earnings</p>
                            </Card>
                        </div>

                        {/* Quick Share Link Box */}
                        <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <Share2 size={13} className="text-primary-500" /> Your Exclusive Referral Link & Code
                                </span>
                                <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 break-all bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {referralLink}
                                </p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                <Button 
                                    size="sm" 
                                    onClick={handleCopyLink} 
                                    className="flex-1 sm:flex-initial text-xs flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700 font-bold"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy Link'}
                                </Button>
                                <a
                                    href={`mailto:?subject=${encodeURIComponent("Streamline your business operations with TekTrakker")}&body=${encodeURIComponent(`Hi,\n\nI wanted to share TekTrakker with you—it's a comprehensive platform for scheduling, dispatching, invoicing, and facility operations.\n\nYou can learn more and start here: ${referralLink}\n\nBest regards!`)}`}
                                    className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs flex items-center justify-center transition-colors"
                                    title="Share via Email"
                                >
                                    <Mail size={16} />
                                </a>
                                <a
                                    href={`sms:?&body=${encodeURIComponent(`Hey! Check out TekTrakker for field service and business management: ${referralLink}`)}`}
                                    className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs flex items-center justify-center transition-colors"
                                    title="Share via SMS"
                                >
                                    <MessageSquare size={16} />
                                </a>
                            </div>
                        </div>

                        {/* Referrals List & Search */}
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                                    <Briefcase size={16} className="text-primary-500" /> Referred Business Pipeline ({filteredReferrals.length})
                                </h4>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                                        <button
                                            onClick={() => setStatusFilter('all')}
                                            className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'all' ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('active')}
                                            className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'active' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            Active Sales
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('pending')}
                                            className={`px-3 py-1 rounded-md transition-colors ${statusFilter === 'pending' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            In Pipeline
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search referrals..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>

                            {filteredReferrals.length === 0 ? (
                                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                                    <Users size={32} className="mx-auto text-slate-400" />
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No referrals found</p>
                                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                        Send your first referral invitation to start earning up to 20% recurring monthly commission!
                                    </p>
                                    <Button size="sm" onClick={() => setActiveTab('invite')} className="text-xs font-bold">
                                        <Send size={14} className="mr-1" /> Invite a Business Now
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                    {filteredReferrals.map((ref) => (
                                        <div 
                                            key={ref.id} 
                                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary-300 dark:hover:border-primary-700 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-900 dark:text-white text-base">{ref.businessName}</span>
                                                    {getStatusBadge(ref.status)}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="flex items-center gap-1 font-medium">
                                                        <Building2 size={12} className="text-slate-400" /> {ref.contactName} ({ref.contactEmail})
                                                    </span>
                                                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                        {ref.trade}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        Invited: {new Date(ref.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 sm:self-center">
                                                {ref.status === 'Active Customer' ? (
                                                    <div className="bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 text-right">
                                                        <p className="text-[10px] uppercase font-black text-emerald-700 dark:text-emerald-400">Your Commission</p>
                                                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                            +${(ref.estimatedMonthlyCommission || 59.80).toFixed(2)}<span className="text-[10px]">/mo</span>
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-400 italic">
                                                        Est. +${(ref.estimatedMonthlyCommission || 59.80).toFixed(2)}/mo on signup
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: SEND DIRECT INVITE FORM */}
                {activeTab === 'invite' && (
                    <form onSubmit={handleSendInvite} className="space-y-4 max-w-xl mx-auto">
                        <div className="bg-primary-50 dark:bg-primary-950/30 p-4 rounded-xl border border-primary-200 dark:border-primary-800/40 text-xs text-primary-900 dark:text-primary-200 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                <Sparkles size={14} className="text-primary-600 dark:text-primary-400" /> Send an Invitation Direct to a Business Owner
                            </p>
                            <p className="text-primary-700 dark:text-primary-300 text-[11px]">
                                When this business activates a subscription, our automated billing engine credits 20% of their subscription fees directly to your account each month for their first full year.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="Business / Company Name *"
                                placeholder="e.g. Apex Electrical Contractors"
                                value={inviteForm.businessName}
                                onChange={(e) => setInviteForm({ ...inviteForm, businessName: e.target.value })}
                                required
                            />
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                    Industry / Trade Sector *
                                </label>
                                <select
                                    value={inviteForm.trade}
                                    onChange={(e) => setInviteForm({ ...inviteForm, trade: e.target.value })}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                >
                                    {SUPPORTED_TRADES.map((trade) => (
                                        <option key={trade} value={trade}>{trade}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                                label="Contact Person Name *"
                                placeholder="e.g. John Doe"
                                value={inviteForm.contactName}
                                onChange={(e) => setInviteForm({ ...inviteForm, contactName: e.target.value })}
                                required
                            />
                            <Input
                                label="Contact Email Address *"
                                type="email"
                                placeholder="e.g. john@apexelectrical.com"
                                value={inviteForm.contactEmail}
                                onChange={(e) => setInviteForm({ ...inviteForm, contactEmail: e.target.value })}
                                required
                            />
                        </div>

                        <Input
                            label="Phone Number (Optional)"
                            placeholder="e.g. (512) 555-0199"
                            value={inviteForm.contactPhone}
                            onChange={(e) => setInviteForm({ ...inviteForm, contactPhone: e.target.value })}
                        />

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                Personal Endorsement Message
                            </label>
                            <textarea
                                rows={3}
                                value={inviteForm.notes}
                                onChange={(e) => setInviteForm({ ...inviteForm, notes: e.target.value })}
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="secondary" onClick={() => setActiveTab('dashboard')}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="font-bold">
                                {isSubmitting ? 'Submitting Invite...' : 'Send Referral Invitation'}
                            </Button>
                        </div>
                    </form>
                )}

                {/* TAB 3: PROGRAM DETAILS & SUPPORTED INDUSTRIES */}
                {activeTab === 'rules' && (
                    <div className="space-y-6 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-black">
                                    1
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white">Share Your Link</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Send your unique link or enter business contacts in the invite form. We track leads globally under your account.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-black">
                                    2
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white">They Onboard & Subscribe</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Our dedicated product team conducts demos, handles data onboarding, and activates their team.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center font-black">
                                    3
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white">Earn 20% for the First Year</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Enjoy monthly direct deposits of 20% on all subscription fees for the first full year (12 months) of their active subscription.
                                </p>
                            </div>
                        </div>

                        {/* Supported Trade Badges Grid */}
                        <div className="space-y-3 pt-2">
                            <h4 className="font-black uppercase tracking-wider text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                <ShieldCheck size={16} className="text-primary-600" /> Supported Organization Types & Trades:
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {SUPPORTED_TRADES.map((trade) => (
                                    <div key={trade} className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"></div>
                                        <span className="truncate">{trade}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ReferralTrackerModal;
