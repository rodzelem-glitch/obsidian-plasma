import showToast from "lib/toast";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import { Link as LinkIcon, Copy, ArrowLeft, Share2, ExternalLink, Calculator } from 'lucide-react';
import { db } from 'lib/firebase';
import type { CommissionSettings } from 'types';
import { DEFAULT_COMMISSION_RULES } from '../../utils/salesContractGenerator';
import SalesScenarioCalculator from 'components/sales/SalesScenarioCalculator';

const SalesTools: React.FC = () => {
    const navigate = useNavigate();
    const { state } = useAppContext();
    const { currentUser } = state;
    const [commissionRules, setCommissionRules] = useState<CommissionSettings>(DEFAULT_COMMISSION_RULES);
    const [utmParams, setUtmParams] = useState({
        baseUrl: 'https://tektrakker.com',
        source: '',
        medium: '',
        campaign: '',
        term: '',
        content: ''
    });
    const [generatedLink, setGeneratedLink] = useState('');

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.customCommissionSettings) {
            setCommissionRules(currentUser.customCommissionSettings);
            return;
        }
        db.collection('settings').doc('commission_rules').get().then(doc => {
            if (doc.exists) {
                setCommissionRules(doc.data() as CommissionSettings);
            }
        });
    }, [currentUser]);

    const generateLink = () => {
        try {
            const url = new URL(utmParams.baseUrl);
            if (utmParams.source) url.searchParams.set('utm_source', utmParams.source);
            if (utmParams.medium) url.searchParams.set('utm_medium', utmParams.medium);
            if (utmParams.campaign) url.searchParams.set('utm_campaign', utmParams.campaign);
            if (utmParams.term) url.searchParams.set('utm_term', utmParams.term);
            if (utmParams.content) url.searchParams.set('utm_content', utmParams.content);
            setGeneratedLink(url.toString());
        } catch (e) {
            setGeneratedLink(utmParams.baseUrl);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedLink);
        showToast.warn("Link copied!");
    };

    const personalReferralLink = `${window.location.origin}/#/login?view=register_business&rep=${currentUser?.id || ''}`;

    const copyPersonalLink = () => {
        navigator.clipboard.writeText(personalReferralLink);
        showToast.success("Personal referral link copied to clipboard!");
    };

    return (
        <div className="space-y-6">
            <header className="flex items-start gap-4">
                <button onClick={() => navigate(-1)} className="mt-1 p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <ArrowLeft size={24} />
                </button>
                <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Sales Tools</h2>
                <p className="text-slate-500">Utilities to track, distribute, and optimize your client outreach.</p>
                </div>
            </header>

            {/* Personal Sales Representative Referral Link */}
            <Card className="max-w-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center justify-center">
                        <Share2 size={22} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Your Direct Client Signup Link</h3>
                        <p className="text-xs text-slate-500">Share this link with prospective business owners. Organizations registering through this link are automatically attributed to you for commission.</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-2 items-center">
                    <code className="flex-1 text-xs break-all font-mono text-emerald-700 dark:text-emerald-300 select-all">{personalReferralLink}</code>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={copyPersonalLink} className="flex-1 sm:flex-initial text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
                            <Copy size={14}/> Copy Link
                        </Button>
                        <a href={personalReferralLink} target="_blank" rel="noopener noreferrer" className="p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 flex items-center justify-center">
                            <ExternalLink size={16}/>
                        </a>
                    </div>
                </div>
            </Card>

            <Card className="max-w-2xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-600"><LinkIcon size={24}/> UTM Link Builder</h3>
                <div className="space-y-4">
                    <Input label="Website URL" value={utmParams.baseUrl} onChange={e => setUtmParams({...utmParams, baseUrl: e.target.value})} placeholder="https://tektrakker.com" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Campaign Source (utm_source)" value={utmParams.source} onChange={e => setUtmParams({...utmParams, source: e.target.value})} placeholder="e.g. linkedin, newsletter" />
                        <Input label="Campaign Medium (utm_medium)" value={utmParams.medium} onChange={e => setUtmParams({...utmParams, medium: e.target.value})} placeholder="e.g. cpc, email, social" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input label="Campaign Name" value={utmParams.campaign} onChange={e => setUtmParams({...utmParams, campaign: e.target.value})} placeholder="spring_sale" />
                        <Input label="Term (Keywords)" value={utmParams.term} onChange={e => setUtmParams({...utmParams, term: e.target.value})} placeholder="hvac_software" />
                        <Input label="Content" value={utmParams.content} onChange={e => setUtmParams({...utmParams, content: e.target.value})} placeholder="text_link_a" />
                    </div>

                    <div className="pt-4 border-t dark:border-slate-700">
                        <Button onClick={generateLink} className="w-full mb-4">Generate Tracking Link</Button>
                        
                        {generatedLink && (
                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg flex gap-2 items-center">
                                <code className="flex-1 text-sm break-all font-mono text-slate-600 dark:text-slate-300">{generatedLink}</code>
                                <Button onClick={copyToClipboard} variant="secondary" className="w-auto px-3"><Copy size={16}/></Button>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Interactive Sales Scenario & Earnings Calculator */}
            <Card className="max-w-4xl p-6">
                <SalesScenarioCalculator 
                    rules={currentUser?.customCommissionSettings || commissionRules} 
                    repName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}
                />
            </Card>
        </div>
    );
};

export default SalesTools;
