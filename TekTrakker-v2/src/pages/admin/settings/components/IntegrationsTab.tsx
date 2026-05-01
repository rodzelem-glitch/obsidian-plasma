import showToast from "lib/toast";
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import Toggle from 'components/ui/Toggle';
import { CreditCard, Mail, Code, Copy, Users, ChevronDown, CheckCircle2, ShieldAlert, MonitorUp, Thermometer, Wrench, Package, Square, Coins, Workflow, MessageSquare, Cpu, Home, Leaf, Truck, DollarSign, Fingerprint, PhoneCall, Database, FileText, CloudSun, CheckCircle, RefreshCw, ArrowRight, Sparkles } from 'lucide-react';


interface IntegrationsTabProps {
    paypalClientId: string;
    setPaypalClientId: (val: string) => void;
    stripePublicKey: string;
    setStripePublicKey: (val: string) => void;
    squareAppId: string;
    setSquareAppId: (val: string) => void;
    squareLocId: string;
    setSquareLocId: (val: string) => void;
    squareToken: string;
    setSquareToken: (val: string) => void;
    defaultPaymentGateway: 'stripe' | 'square' | 'paypal';
    setDefaultPaymentGateway: (val: 'stripe' | 'square' | 'paypal') => void;
    smtpHost: string;
    setSmtpHost: (val: string) => void;
    smtpPort: number;
    setSmtpPort: (val: number) => void;
    smtpUser: string;
    setSmtpUser: (val: string) => void;
    smtpPass: string;
    setSmtpPass: (val: string) => void;
    handleSendTestEmail: () => void;
    isSendingTest: boolean;
    twilioSid: string;
    setTwilioSid: (val: string) => void;
    twilioToken: string;
    setTwilioToken: (val: string) => void;
    twilioNumber: string;
    setTwilioNumber: (val: string) => void;
    bookingWidgetMode: 'inline' | 'popup';
    setBookingWidgetMode: (val: 'inline' | 'popup') => void;
    hiringWidgetMode: 'inline' | 'popup';
    setHiringWidgetMode: (val: 'inline' | 'popup') => void;
    copyWidgetCode: (type: 'booking' | 'hiring') => void;
    measureQuickApiKey: string;
    setMeasureQuickApiKey: (val: string) => void;
    seamApiKey: string;
    setSeamApiKey: (val: string) => void;
    nestProjectId: string;
    setNestProjectId: (val: string) => void;
    nestClientId: string;
    setNestClientId: (val: string) => void;
    nestClientSecret: string;
    setNestClientSecret: (val: string) => void;
    ecobeeApiKey: string;
    setEcobeeApiKey: (val: string) => void;
    honeywellApiKey: string;
    setHoneywellApiKey: (val: string) => void;
    honeywellClientSecret: string;
    setHoneywellClientSecret: (val: string) => void;
    webhookSecretKey: string;
    setWebhookSecretKey: (val: string) => void;
    samsaraApiKey: string;
    setSamsaraApiKey: (val: string) => void;
    greenSkyMerchantId: string;
    setGreenSkyMerchantId: (val: string) => void;
    greenSkyApiPw: string;
    setGreenSkyApiPw: (val: string) => void;
    goodLeapApiKey: string;
    setGoodLeapApiKey: (val: string) => void;
    checkrApiKey: string;
    setCheckrApiKey: (val: string) => void;
    ringCentralClientId: string;
    setRingCentralClientId: (val: string) => void;
    ringCentralClientSecret: string;
    setRingCentralClientSecret: (val: string) => void;
    openWeatherApiKey: string;
    setOpenWeatherApiKey: (val: string) => void;
    shovelsApiKey: string;
    setShovelsApiKey: (val: string) => void;
    shovelsUsageCount: number;
    quickbooksConnected?: boolean;
    handleConnectQuickBooks?: () => void;
    handleDisconnectQuickBooks?: () => void;
    isConnectingQuickbooks?: boolean;
    punchoutConfigs: any[];
    setPunchoutConfigs: (val: any[]) => void;
    orgId: string;
}

const IntegrationModule = ({ 
    id, title, category, icon: Icon, iconColor, isConnected, children, expandedId, setExpandedId 
}: { 
    id: string, title: string, category: string, icon: any, iconColor?: string, isConnected: boolean, children: React.ReactNode, expandedId: string | null, setExpandedId: (id: string | null) => void 
}) => {
    const isExpanded = expandedId === id;
    
    return (
        <div className={`transition-all duration-300 border-2 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 ${isExpanded ? 'border-primary-500 shadow-md ring-2 ring-primary-500/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'}`}>
            <div 
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(isExpanded ? null : id)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(isExpanded ? null : id);
                    }
                }}
                className="w-full relative text-left p-4 sm:p-5 flex items-center justify-between group cursor-pointer"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                        <Icon size={28} className={iconColor || "text-slate-500"} />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 dark:text-white text-base tracking-tight">{title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{category}</span>
                            {isConnected ? (
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Enabled
                                </span>
                            ) : (
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span> Disabled
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0 text-slate-300">
                    <Button variant={isConnected ? "primary" : "secondary"} size="sm" className="hidden sm:flex text-[10px] uppercase font-black tracking-widest pointer-events-none" tabIndex={-1}>
                        {isExpanded ? 'Configure' : isConnected ? 'Manage' : 'Connect'}
                    </Button>
                    <ChevronDown size={20} className={`sm:hidden transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isExpanded && (
                <div className="p-6 border-t-2 border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="space-y-4">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    paypalClientId, setPaypalClientId, stripePublicKey, setStripePublicKey,
    squareAppId, setSquareAppId, squareLocId, setSquareLocId, squareToken, setSquareToken,
    defaultPaymentGateway, setDefaultPaymentGateway,
    smtpHost, setSmtpHost, smtpPort, setSmtpPort, smtpUser, setSmtpUser, smtpPass, setSmtpPass, handleSendTestEmail, isSendingTest,
    twilioSid, setTwilioSid, twilioToken, setTwilioToken, twilioNumber, setTwilioNumber,
    bookingWidgetMode, setBookingWidgetMode, hiringWidgetMode, setHiringWidgetMode, copyWidgetCode,
    measureQuickApiKey, setMeasureQuickApiKey, 
    seamApiKey, setSeamApiKey, nestProjectId, setNestProjectId, nestClientId, setNestClientId, nestClientSecret, setNestClientSecret,
    ecobeeApiKey, setEcobeeApiKey, honeywellApiKey, setHoneywellApiKey, honeywellClientSecret, setHoneywellClientSecret,
    samsaraApiKey, setSamsaraApiKey, greenSkyMerchantId, setGreenSkyMerchantId, greenSkyApiPw, setGreenSkyApiPw,
    goodLeapApiKey, setGoodLeapApiKey, checkrApiKey, setCheckrApiKey, ringCentralClientId, setRingCentralClientId,
    ringCentralClientSecret, setRingCentralClientSecret,
    openWeatherApiKey, setOpenWeatherApiKey, shovelsApiKey, setShovelsApiKey, shovelsUsageCount,
    quickbooksConnected, handleConnectQuickBooks, handleDisconnectQuickBooks, isConnectingQuickbooks,
    webhookSecretKey, setWebhookSecretKey, punchoutConfigs, setPunchoutConfigs, orgId
}) => {
    const [expandedGridId, setExpandedGridId] = useState<string | null>(null);
    const navigate = useNavigate();
    const mqWebhookUrl = `https://us-central1-tektrakker.cloudfunctions.net/measureQuickWebhook?orgId=${orgId || 'ERROR_NO_ORG'}`;

    return (
        <form onSubmit={e => e.preventDefault()} className="space-y-8">
            {/* Marketplace CTA Banner */}
            <button
                type="button"
                onClick={() => navigate('/admin/integrations-marketplace')}
                className="w-full group relative overflow-hidden rounded-2xl border-2 border-dashed border-primary-300 dark:border-primary-700 bg-gradient-to-r from-primary-50 via-indigo-50 to-violet-50 dark:from-primary-950/30 dark:via-indigo-950/20 dark:to-violet-950/30 p-5 text-left hover:border-primary-500 hover:shadow-lg hover:shadow-primary-500/10 transition-all duration-300"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center border border-primary-200 dark:border-primary-800">
                            <Sparkles size={24} className="text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-800 dark:text-white text-sm tracking-tight">Browse Integrations Marketplace</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Discover 26+ additional third-party integrations — Fleet GPS, CRM, Reviews, Financing, BI & more</p>
                        </div>
                    </div>
                    <ArrowRight size={20} className="text-primary-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                </div>
            </button>
            {(!!stripePublicKey || !!squareAppId || !!paypalClientId) && (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white"><CreditCard size={20}/> Payment Gateways</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Default Gateway:</span>
                        <select 
                            aria-label="Default Payment Gateway"
                            title="Default Payment Gateway"
                            value={defaultPaymentGateway} 
                            onChange={e => setDefaultPaymentGateway(e.target.value as any)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="stripe">Stripe</option>
                            <option value="square">Square</option>
                            <option value="paypal">PayPal</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {!!stripePublicKey && (
                    <IntegrationModule 
                        id="stripe" 
                        title="Stripe" 
                        category="Credit Cards" 
                        icon={CreditCard}
                        iconColor="text-indigo-500"
                        isConnected={!!stripePublicKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Connect Stripe to process credit card payments natively inside invoices. Accept all major credit cards securely.</p>
                        <Input label="Publishable Key" value={stripePublicKey} onChange={e => setStripePublicKey(e.target.value)} placeholder="pk_live_..." />
                    </IntegrationModule>
                    )}

                    {(!!squareAppId && !!squareLocId) && (
                    <IntegrationModule 
                        id="square" 
                        title="Square" 
                        category="Credit Cards & POS" 
                        icon={Square}
                        iconColor="text-slate-800 dark:text-slate-200"
                        isConnected={!!squareAppId && !!squareLocId}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Connect Square to process card payments or sync transactions.</p>
                        <div className="grid grid-cols-1 gap-4">
                            <Input label="Application ID" value={squareAppId} onChange={e => setSquareAppId(e.target.value)} placeholder="sq0idp-..." />
                            <Input label="Location ID" value={squareLocId} onChange={e => setSquareLocId(e.target.value)} placeholder="L..." />
                        </div>
                        <div className="mt-4">
                             <Input label="Square Personal Access Token" type="password" value={squareToken} onChange={e => setSquareToken(e.target.value)} placeholder={squareToken ? "••••••••••••..." : "EAAAE..."} />
                             {squareToken && <p className="text-[10px] font-bold text-blue-600 uppercase mt-2 text-center">Token securely loaded</p>}
                        </div>
                    </IntegrationModule>
                    )}

                    {!!paypalClientId && (
                    <IntegrationModule 
                        id="paypal" 
                        title="PayPal" 
                        category="Digital Wallets" 
                        icon={Coins}
                        iconColor="text-blue-500"
                        isConnected={!!paypalClientId}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Accept payments directly via PayPal.</p>
                        <Input label="Client ID" value={paypalClientId} onChange={e => setPaypalClientId(e.target.value)} placeholder="Enter Live Client ID" />
                    </IntegrationModule>
                    )}
                </div>
            </div>
            )}

            {!!quickbooksConnected && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><FileText size={20}/> Accounting</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    <IntegrationModule 
                        id="quickbooks" 
                        title="QuickBooks Online" 
                        category="Accounting & ERP" 
                        icon={FileText}
                        iconColor="text-green-600"
                        isConnected={!!quickbooksConnected}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Two-way sync your invoices, customers, and payments directly into QuickBooks online to keep your ledger accurate.</p>
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 border p-4 rounded-xl">
                            <div>
                                <span className="font-bold block text-sm">QBO Native Auth</span>
                                <span className="text-xs text-slate-500">OAuth 2.0 Integration</span>
                            </div>
                            {quickbooksConnected ? (
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                                        <CheckCircle size={12} /> Connected
                                    </span>
                                    <Button onClick={handleDisconnectQuickBooks} variant="secondary" className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100">
                                        Disconnect
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={handleConnectQuickBooks} disabled={isConnectingQuickbooks} className="bg-green-600 hover:bg-green-700 text-xs font-bold uppercase tracking-wide">
                                    {isConnectingQuickbooks ? <RefreshCw className="animate-spin" size={14} /> : 'Connect to QBO'}
                                </Button>
                            )}
                        </div>
                    </IntegrationModule>
                </div>
            </div>
            )}

            {(!!webhookSecretKey || (punchoutConfigs && punchoutConfigs.length > 0 && !!punchoutConfigs[0].setupUrl)) && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><MonitorUp size={20}/> Automations & APIS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {!!webhookSecretKey && (
                    <IntegrationModule 
                        id="webhook" 
                        title="Zapier / Webhooks" 
                        category="Workflow Automation" 
                        icon={Workflow}
                        iconColor="text-orange-500"
                        isConnected={!!webhookSecretKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Use this secure Webhook Endpoint to automatically inject Leads into your Dispatch Board. Any POST request sent here will bypass manual data entry, create the Customer Profile, and put the Unassigned Job onto the calendar instantly.</p>
                        
                        <div className="flex gap-2 items-end mb-4">
                            <div className="flex-1">
                                <Input label="Webhook API Key" type="password" value={webhookSecretKey} onChange={e => setWebhookSecretKey(e.target.value)} placeholder="Enter a secure key..." />
                            </div>
                            <Button variant="secondary" className="mb-[2px] text-[10px] uppercase font-black" onClick={() => {
                                const array = new Uint8Array(32);
                                window.crypto.getRandomValues(array);
                                const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
                                setWebhookSecretKey('tk_' + hex);
                            }}>
                                Gen
                            </Button>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                           <h5 className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400 mb-2">Universal Webhook URL:</h5>
                           <code className="block text-[10px] p-2 bg-white dark:bg-slate-900 rounded border border-emerald-200 dark:border-emerald-800 text-slate-500 font-mono select-all overflow-x-auto whitespace-nowrap mb-2">
                               {`https://us-central1-tektrakker.cloudfunctions.net/incomingLeadWebhook?orgId=${orgId || 'ERROR'}&apiKey=${webhookSecretKey}`}
                           </code>
                           <Button size="sm" onClick={() => navigator.clipboard.writeText(`https://us-central1-tektrakker.cloudfunctions.net/incomingLeadWebhook?orgId=${orgId || 'ERROR'}&apiKey=${webhookSecretKey}`).then(() => showToast.warn("Copied!"))} className="w-full !bg-emerald-600 !text-white hover:!bg-emerald-700 text-[10px] tracking-widest uppercase font-black">
                               <Copy size={12} className="mr-1" /> Copy Setup URL
                           </Button>
                        </div>
                    </IntegrationModule>
                    )}
                    
                    {(punchoutConfigs && punchoutConfigs.length > 0 && !!punchoutConfigs[0].setupUrl) && (
                    <IntegrationModule 
                        id="punchout" 
                        title="B2B cXML PunchOut" 
                        category="Supply Procurement" 
                        icon={Package}
                        iconColor="text-amber-500"
                        isConnected={punchoutConfigs && punchoutConfigs.length > 0 && !!punchoutConfigs[0].setupUrl}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Connect to major distributors (Johnstone, Trane, Ferguson, Grainger) that support cXML PunchOut. Allows mechanics to order direct from the field.</p>
                        
                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 text-xs text-slate-600 dark:text-slate-300">
                            <h5 className="font-black text-[10px] uppercase tracking-widest text-slate-500 mb-2">How to Setup:</h5>
                            <ol className="list-decimal list-outside ml-4 space-y-1">
                                <li>Contact your local B2B Account Representative (e.g. at Ferguson or Johnstone).</li>
                                <li>Request to activate <strong>cXML e-Procurement / PunchOut</strong> on your commercial account.</li>
                                <li>Give them the <strong>Callback URL</strong> below.</li>
                                <li>They will provide you with an Identity token, Shared Secret, and a Setup URL to enter below.</li>
                            </ol>
                        </div>
                        
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800/40 mb-4">
                           <h5 className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 mb-2">Your cXML Callback URL:</h5>
                           <code className="block text-[10px] p-2 bg-white dark:bg-slate-900 rounded border border-amber-200 dark:border-amber-800 text-slate-500 font-mono select-all overflow-x-auto whitespace-nowrap text-center">
                               {`https://us-central1-tektrakker.cloudfunctions.net/punchoutWebhook?orgId=${orgId}`}
                           </code>
                        </div>
                        {punchoutConfigs?.map((config, index) => (
                            <div key={config.id || index} className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0 last:mb-0">
                                <div className="flex justify-between items-center mb-4">
                                    <h5 className="font-bold text-[11px] uppercase tracking-widest text-slate-500">Supplier #{index + 1}</h5>
                                    {punchoutConfigs.length > 1 && (
                                        <Button variant="danger" size="sm" className="text-[8px] py-1 h-auto" onClick={() => { const newConfigs = [...punchoutConfigs]; newConfigs.splice(index, 1); setPunchoutConfigs(newConfigs); }}>Remove</Button>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <Input label="Supplier Name (e.g. Trane)" value={config.supplierName || ''} onChange={e => { const newConfigs = [...punchoutConfigs]; newConfigs[index].supplierName = e.target.value; setPunchoutConfigs(newConfigs); }} />
                                    <Input label="Supplier Setup URL" value={config.setupUrl || ''} onChange={e => { const newConfigs = [...punchoutConfigs]; newConfigs[index].setupUrl = e.target.value; setPunchoutConfigs(newConfigs); }} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input label="From Domain" value={config.fromDomain || 'NetworkId'} onChange={e => { const newConfigs = [...punchoutConfigs]; newConfigs[index].fromDomain = e.target.value; setPunchoutConfigs(newConfigs); }} />
                                        <Input label="From Identity" value={config.fromIdentity || ''} onChange={e => { const newConfigs = [...punchoutConfigs]; newConfigs[index].fromIdentity = e.target.value; setPunchoutConfigs(newConfigs); }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input label="To Domain" value={config.toDomain || 'NetworkId'} onChange={e => { const newConfigs = [...punchoutConfigs]; newConfigs[index].toDomain = e.target.value; setPunchoutConfigs(newConfigs); }} />
                                        <Input label="To Identity" value={config.toIdentity || ''} onChange={e => { const newConfigs = [...punchoutConfigs]; newConfigs[index].toIdentity = e.target.value; setPunchoutConfigs(newConfigs); }} />
                                    </div>
                                    <Input label="Shared Secret Password" value={config.sharedSecret || ''} onChange={e => { const newConfigs = [...punchoutConfigs]; newConfigs[index].sharedSecret = e.target.value; setPunchoutConfigs(newConfigs); }} type="password" />
                                </div>
                            </div>
                        ))}
                        <Button variant="secondary" className="w-full mt-2 text-[10px] font-black uppercase tracking-widest" onClick={() => { setPunchoutConfigs([...(punchoutConfigs || []), { id: Math.random().toString(), supplierName: '', setupUrl: '', fromDomain: 'NetworkId', fromIdentity: '', toDomain: 'NetworkId', toIdentity: '', sharedSecret: '' }]); }}>+ Add Supplier</Button>
                    </IntegrationModule>
                    )}
                </div>
            </div>
            )}

            {(!!twilioSid || !!smtpHost) && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><Mail size={20}/> Email & SMS Delivery</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {!!twilioSid && (
                    <IntegrationModule 
                        id="twilio" 
                        title="Twilio" 
                        category="SMS Messaging" 
                        icon={MessageSquare}
                        iconColor="text-red-500"
                        isConnected={!!twilioSid}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Provide Twilio credentials to send "On My Way" texts and appointment reminders.</p>
                        <div className="space-y-4">
                            <Input label="Account SID" value={twilioSid} onChange={e => setTwilioSid(e.target.value)} />
                            <Input label="Auth Token" type="password" value={twilioToken} onChange={e => setTwilioToken(e.target.value)} />
                            <Input label="Origin Phone Number" value={twilioNumber} onChange={e => setTwilioNumber(e.target.value)} placeholder="+15551234567" />
                        </div>
                    </IntegrationModule>
                    )}
                    
                    {!!smtpHost && (
                    <IntegrationModule 
                        id="smtp" 
                        title="Custom SMTP Server" 
                        category="Email Delivery" 
                        icon={Mail}
                        iconColor="text-slate-500"
                        isConnected={!!smtpHost}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Ensure maximum inbox deliverability for invoices and proposals by sending from your own email servers (e.g. Outlook, Google Workspace).</p>
                        <div className="space-y-4">
                            <Input label="SMTP Host" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                            <Input label="SMTP Port" type="number" value={smtpPort} onChange={e => setSmtpPort(parseInt(e.target.value))} placeholder="587" />
                            <Input label="Username (Email)" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
                            <Input label="Password or App Password" type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} />
                            <Button onClick={handleSendTestEmail} disabled={isSendingTest} variant="secondary" className="text-xs w-full mt-2 font-black uppercase tracking-widest text-[10px]" type="button">
                                {isSendingTest ? 'Sending...' : 'Test Connection'}
                            </Button>
                        </div>
                    </IntegrationModule>
                    )}
                </div>
            </div>
            )}

            {(!!seamApiKey || !!nestProjectId || !!ecobeeApiKey || !!honeywellApiKey || !!measureQuickApiKey) && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><MonitorUp size={20}/> Smart Home & IoT Hardware</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {!!seamApiKey && (
                    <IntegrationModule 
                        id="seam" 
                        title="Seam API" 
                        category="Unified IoT Core" 
                        icon={Cpu}
                        iconColor="text-emerald-500"
                        isConnected={!!seamApiKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Connect once to the Seam API Gateway to bypass individual approvals and instantly unlock telemetry access for <strong>Nest, Ecobee, Honeywell, Resideo, Samsung SmartThings</strong> and more.</p>
                        <Input label="Seam Workspace API Key" value={seamApiKey} onChange={e => setSeamApiKey(e.target.value)} placeholder="seam_live_..." type="password" />
                    </IntegrationModule>
                    )}
                    
                    {!!nestProjectId && (
                    <IntegrationModule 
                        id="nest" 
                        title="Google Nest" 
                        category="Direct API" 
                        icon={Home}
                        iconColor="text-blue-500"
                        isConnected={!!nestProjectId}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Bring your own Google Device Access Console keys for a direct, free connection to Nest Thermostats.</p>
                        <div className="space-y-4">
                            <Input label="Device Access Project ID" value={nestProjectId} onChange={e => setNestProjectId(e.target.value)} />
                            <Input label="Google Cloud Client ID" value={nestClientId} onChange={e => setNestClientId(e.target.value)} />
                            <Input label="Google Cloud Client Secret" value={nestClientSecret} onChange={e => setNestClientSecret(e.target.value)} type="password" />
                        </div>
                    </IntegrationModule>
                    )}

                    {!!ecobeeApiKey && (
                    <IntegrationModule 
                        id="ecobee" 
                        title="Ecobee" 
                        category="Direct API" 
                        icon={Leaf}
                        iconColor="text-green-500"
                        isConnected={!!ecobeeApiKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Bring your own Ecobee App Developer key.</p>
                        <Input label="Ecobee Application Secret Key" value={ecobeeApiKey} onChange={e => setEcobeeApiKey(e.target.value)} type="password" />
                    </IntegrationModule>
                    )}

                    {!!honeywellApiKey && (
                    <IntegrationModule 
                        id="honeywell" 
                        title="Honeywell Home" 
                        category="Direct API" 
                        icon={Thermometer}
                        iconColor="text-red-500"
                        isConnected={!!honeywellApiKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Bring your own Resideo API keys.</p>
                        <div className="space-y-4">
                            <Input label="Consumer App Key" value={honeywellApiKey} onChange={e => setHoneywellApiKey(e.target.value)} type="password" />
                            <Input label="Consumer Secret" value={honeywellClientSecret} onChange={e => setHoneywellClientSecret(e.target.value)} type="password" />
                        </div>
                    </IntegrationModule>
                    )}

                    {!!measureQuickApiKey && (
                    <IntegrationModule 
                        id="mq" 
                        title="measureQuick" 
                        category="Tool Telemetry" 
                        icon={Wrench}
                        iconColor="text-blue-500"
                        isConnected={!!measureQuickApiKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Stream real-time diagnostic reports from technician field tools (Testo, Fieldpiece, Appion) straight onto the job invoice.</p>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
                           <h5 className="text-[10px] font-black uppercase text-slate-500 mb-2">MeasureQuick Webhook Address:</h5>
                           <code className="block text-[10px] p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-slate-500 font-mono select-all overflow-x-auto whitespace-nowrap text-center">
                               {mqWebhookUrl}
                           </code>
                        </div>
                        <Input label="measureQuick Cloud API Key" value={measureQuickApiKey} onChange={e => setMeasureQuickApiKey(e.target.value)} placeholder="mq_live_..." type="password" />
                    </IntegrationModule>
                    )}
                </div>
            </div>
            )}

            {(!!samsaraApiKey || !!checkrApiKey || !!greenSkyMerchantId || !!goodLeapApiKey || !!ringCentralClientId) && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-8 pb-12">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><Database size={20}/> Enterprise Integrations (BYOK)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {!!samsaraApiKey && (
                    <IntegrationModule 
                        id="samsara" 
                        title="Samsara Fleet Tracking" 
                        category="Telematics & GPS" 
                        icon={Truck}
                        iconColor="text-blue-600"
                        isConnected={!!samsaraApiKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Connect Samsara to enable real-time fleet visibility on the dispatch board and automate technician arrival times.</p>
                        <Input label="Samsara API Token" value={samsaraApiKey} onChange={e => setSamsaraApiKey(e.target.value)} placeholder="Enter Samsara Token..." type="password" />
                    </IntegrationModule>
                    )}

                    {!!checkrApiKey && (
                    <IntegrationModule 
                        id="checkr" 
                        title="Checkr Background Checks" 
                        category="HR Compliance" 
                        icon={Fingerprint}
                        iconColor="text-purple-600"
                        isConnected={!!checkrApiKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Continuously screen your workforce. Run MVRs and criminal background checks effortlessly before dispatching to a home.</p>
                        <Input label="Checkr API Key" value={checkrApiKey} onChange={e => setCheckrApiKey(e.target.value)} placeholder="sk_live_..." type="password" />
                    </IntegrationModule>
                    )}

                    {!!greenSkyMerchantId && (
                    <IntegrationModule 
                        id="greensky" 
                        title="GreenSky Financing" 
                        category="Consumer Finance" 
                        icon={DollarSign}
                        iconColor="text-green-600"
                        isConnected={!!greenSkyMerchantId}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Let customers apply for GreenSky financing directly from their digital proposals with instant credit decisions.</p>
                        <Input label="Merchant ID" value={greenSkyMerchantId} onChange={e => setGreenSkyMerchantId(e.target.value)} placeholder="0000000" />
                        <Input label="API Password" value={greenSkyApiPw} onChange={e => setGreenSkyApiPw(e.target.value)} placeholder="Enter secure password" type="password" />
                    </IntegrationModule>
                    )}

                    {!!goodLeapApiKey && (
                    <IntegrationModule 
                        id="goodleap" 
                        title="GoodLeap Financing" 
                        category="Consumer Finance" 
                        icon={DollarSign}
                        iconColor="text-emerald-500"
                        isConnected={!!goodLeapApiKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Provide flexible payment options for expensive installations directly on the invoice through GoodLeap.</p>
                        <Input label="GoodLeap API Key" value={goodLeapApiKey} onChange={e => setGoodLeapApiKey(e.target.value)} placeholder="Enter API Key" type="password" />
                    </IntegrationModule>
                    )}

                    {!!ringCentralClientId && (
                    <IntegrationModule 
                        id="ringcentral" 
                        title="RingCentral VoIP" 
                        category="Communications" 
                        icon={PhoneCall}
                        iconColor="text-orange-500"
                        isConnected={!!ringCentralClientId && !!ringCentralClientSecret}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Enable screen-pops. When a customer calls your RingCentral numbers, their profile pops up instantly on the dashboard.</p>
                        <Input label="Client ID" value={ringCentralClientId} onChange={e => setRingCentralClientId(e.target.value)} placeholder="Enter RingCentral Client ID" />
                        <Input label="Client Secret" value={ringCentralClientSecret} onChange={e => setRingCentralClientSecret(e.target.value)} placeholder="Enter RingCentral Client Secret" type="password" />
                    </IntegrationModule>
                    )}
                </div>
            </div>
            )}

            {true && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-8 pb-12">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><CloudSun size={20}/> Extensibility & Widgets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {true && (
                    <IntegrationModule 
                        id="openweather" 
                        title="OpenWeather Map Viewer" 
                        category="Geospatial API" 
                        icon={CloudSun}
                        iconColor="text-sky-500"
                        isConnected={true}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Provide technicians with real-time job site temperatures, UV index warnings, and storm reports before they dispatch.</p>
                        
                        <div className="bg-sky-50 dark:bg-sky-900/10 p-4 border border-sky-200 dark:border-sky-800 rounded-xl mb-4">
                             <div className="flex items-center gap-2 mb-1 text-sky-700 dark:text-sky-400 font-bold text-sm">
                                 <CheckCircle size={16} /> Platform Connected
                             </div>
                             <p className="text-[10px] text-sky-600 dark:text-sky-500">Your SaaS master account is currently subsidizing this feature platform-wide.</p>
                        </div>
                        
                        <Input label="Custom API Key Override (Optional)" value={openWeatherApiKey} onChange={e => setOpenWeatherApiKey(e.target.value)} placeholder="Only needed if you exceed the global platform limits..." type="password" />
                    </IntegrationModule>
                    )}

                    {!!shovelsApiKey && (
                    <IntegrationModule 
                        id="shovels" 
                        title="Shovels.ai Permit Tracking" 
                        category="GovTech API" 
                        icon={CloudSun}
                        iconColor="text-amber-500"
                        isConnected={!!shovelsApiKey}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Automatically track US municipal building permits nationwide for all jobs without calling the town hall.</p>
                        
                        {(shovelsUsageCount >= 200 && (!shovelsApiKey || shovelsApiKey === '1mKV5CywapTgTqEx3cD5v_h5jLZd9A0CYMU2YEsFx60')) && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800 rounded-xl mb-4 animate-pulse">
                                <p className="text-[10px] text-amber-600 dark:text-amber-500 font-bold mb-1 flex items-center gap-2">⚠️ Trial Limit Warning (Cost: $599/mo)</p>
                                <p className="text-[10px] text-amber-600 dark:text-amber-500">You have used {shovelsUsageCount}/250 of your free Shovels Sandbox requests. Reaching the limit will bounce future requests until you enroll in their paid tier.</p>
                            </div>
                        )}
                        
                        <Input label="Shovels.ai API Key" value={shovelsApiKey} onChange={e => setShovelsApiKey(e.target.value)} placeholder="Enter your sandbox API key" type="password" />
                    </IntegrationModule>
                    )}

                    {true && (
                    <IntegrationModule 
                        id="bookingwidget" 
                        title="Service Booking Form" 
                        category="Javascript Embed" 
                        icon={Code}
                        iconColor="text-purple-500"
                        isConnected={true}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Place this powerful widget onto your public website to instantly inject online bookings into the dispatcher calendar.</p>
                        <div className="flex gap-4 items-center mb-4">
                            <Toggle label="Inline Container Mode" enabled={bookingWidgetMode === 'inline'} onChange={(val) => setBookingWidgetMode(val ? 'inline' : 'popup')} />
                        </div>
                        <Button onClick={() => copyWidgetCode('booking')} variant="primary" className="text-[10px] uppercase tracking-widest font-black w-full" type="button">
                            <Copy size={14} className="mr-2"/> Auto-Copy Script Tag
                        </Button>
                    </IntegrationModule>
                    )}

                    {true && (
                    <IntegrationModule 
                        id="hiringwidget" 
                        title="Career Application Form" 
                        category="Javascript Embed" 
                        icon={Code}
                        iconColor="text-purple-500"
                        isConnected={true}
                        expandedId={expandedGridId} setExpandedId={setExpandedGridId}
                    >
                        <p className="text-xs text-slate-500 mb-4 block leading-relaxed">Place this widget on your careers page to instantly route new mechanic or office applicants natively into HR queue.</p>
                        <div className="flex gap-4 items-center mb-4">
                            <Toggle label="Inline Container Mode" enabled={hiringWidgetMode === 'inline'} onChange={(val) => setHiringWidgetMode(val ? 'inline' : 'popup')} />
                        </div>
                        <Button onClick={() => copyWidgetCode('hiring')} variant="primary" className="text-[10px] uppercase tracking-widest font-black w-full" type="button">
                            <Copy size={14} className="mr-2"/> Auto-Copy Script Tag
                        </Button>
                    </IntegrationModule>
                    )}
                </div>
            </div>
            )}

        </form>
    );
};

export default IntegrationsTab;

