
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import { 
    Building, Globe, Activity, Scale, CreditCard, Palette, Zap, Database, FileText, Wrench
} from 'lucide-react';
import type { Organization, IndustryVertical, Address } from 'types';
import Modal from 'components/ui/Modal';

import ProfileTab from './settings/components/ProfileTab';
import SocialTab from './settings/components/SocialTab';
import OperationsTab from './settings/components/OperationsTab';
import LegalTab from './settings/components/LegalTab';
import IntegrationsTab from './settings/components/IntegrationsTab';
import BrandingTab from './settings/components/BrandingTab';
import SubscriptionTab from './settings/components/SubscriptionTab';
import DataTab from './settings/components/DataTab';
import AccountingTab from './settings/components/AccountingTab';
import CapabilitiesTab from './settings/components/CapabilitiesTab';
import { globalConfirm } from "lib/globalConfirm";

const ALL_INDUSTRIES: IndustryVertical[] = [
    'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General', 
    'Cleaning', 'Painting', 'Roofing', 'Contracting', 'Masonry',
    'Telecommunications', 'Solar', 'Security', 'Pet Grooming'
];

const DEFAULT_GOOGLE_CLIENT_ID = "655867451194-3p9dkm7tjb15a2njggqa2jcc64i4vibh.apps.googleusercontent.com";

const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            if (file.type.startsWith('image/')) {
                const img = new window.Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX = 1200;
                    if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } } 
                    else { if (height > MAX) { width *= MAX / height; height = MAX; } }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); 
                };
                img.onerror = () => resolve(event.target?.result as string);
            } else {
                resolve(event.target?.result as string);
            }
        };
        reader.onerror = reject;
    });
};

const Settings: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'profile' | 'social' | 'operations' | 'legal' | 'integrations' | 'branding' | 'subscription' | 'data' | 'accounting' | 'capabilities'>('profile');
    
    // Core Identity
    const [orgName, setOrgName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notificationEmails, setNotificationEmails] = useState('');
    const [website, setWebsite] = useState('');
    const [industry, setIndustry] = useState<IndustryVertical>('HVAC');
    const [supportedTrades, setSupportedTrades] = useState<IndustryVertical[]>([]);
    
    // Social & Reviews
    const [socialLinks, setSocialLinks] = useState<any>({});
    const [reviewLinks, setReviewLinks] = useState<any>({});
    const [googleApiConnected, setGoogleApiConnected] = useState(false);
    const [googleClientId, setGoogleClientId] = useState('');
    const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
    
    // Operations
    const [addressStreet, setAddressStreet] = useState('');
    const [city, setCity] = useState('');
    const [stateName, setStateName] = useState('');
    const [zip, setZip] = useState('');
    const [taxRate, setTaxRate] = useState('8.25');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [ueid, setUeid] = useState('');
    const [cageCode, setCageCode] = useState('');
    const [primaryNaics, setPrimaryNaics] = useState('');
    const [marketMultiplier, setMarketMultiplier] = useState('1.0');
    const [aiPricebookEnabled, setAiPricebookEnabled] = useState(true);
    
    // HR
    const [customPositions, setCustomPositions] = useState<string[]>([]);
    const [requiredCerts, setRequiredCerts] = useState<string[]>([]);
    const [newPosition, setNewPosition] = useState('');
    const [newCert, setNewCert] = useState('');

    // Legal
    const [termsAndConditions, setTermsAndConditions] = useState('');
    const [proposalDisclaimer, setProposalDisclaimer] = useState('');
    const [invoiceTerms, setInvoiceTerms] = useState('');
    const [membershipTerms, setMembershipTerms] = useState('');
    const [complianceFooter, setComplianceFooter] = useState('');
    const [warrantyDisclaimer, setWarrantyDisclaimer] = useState('');
    const [defaultWorkmanshipMonths, setDefaultWorkmanshipMonths] = useState(12);
    const [defaultPartsMonths, setDefaultPartsMonths] = useState(12);

    // Integrations
    const [paypalClientId, setPaypalClientId] = useState('');
    const [stripePublicKey, setStripePublicKey] = useState('');
    const [squareAppId, setSquareAppId] = useState('');
    const [squareLocId, setSquareLocId] = useState('');
    const [squareToken, setSquareToken] = useState('');
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [twilioSid, setTwilioSid] = useState('');
    const [twilioToken, setTwilioToken] = useState('');
    const [twilioNumber, setTwilioNumber] = useState('');
    const [bookingWidgetMode, setBookingWidgetMode] = useState<'popup' | 'inline'>('popup');
    const [hiringWidgetMode, setHiringWidgetMode] = useState<'popup' | 'inline'>('popup');
    const [measureQuickApiKey, setMeasureQuickApiKey] = useState('');
    
    // Accounting Integrations
    const [quickbooksConnected, setQuickbooksConnected] = useState(false);
    const [isConnectingQuickbooks, setIsConnectingQuickbooks] = useState(false);

    // Branding & Marketplace
    const [brandingColor, setBrandingColor] = useState('#0284c7');
    const [logoUrl, setLogoUrl] = useState('');
    const [publicLogoUrl, setPublicLogoUrl] = useState('');
    const [letterheadUrl, setLetterheadUrl] = useState('');
    const [footerImageUrl, setFooterImageUrl] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [financingLink, setFinancingLink] = useState('');
    const [publicProfileEnabled, setPublicProfileEnabled] = useState(false);
    const [publicDescription, setPublicDescription] = useState('');
    const [publicCredentials, setPublicCredentials] = useState<string[]>([]);
    const [publicServices, setPublicServices] = useState<string[]>([]);

    // Capabilities
    const [serviceTypes, setServiceTypes] = useState<('Residential' | 'Commercial')[]>([]);
    const [specializations, setSpecializations] = useState<string[]>([]);
    
    // Webhook Secuity Key
    const [webhookSecretKey, setWebhookSecretKey] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [isBillingHelpOpen, setIsBillingHelpOpen] = useState(false);
    const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
    const [duplicateResults, setDuplicateResults] = useState<{name: string, count: number}[]>([]);

    useEffect(() => {
        if (state.currentOrganization) {
            const org = state.currentOrganization;
            const settings = org.settings || {};

            setOrgName(org.name || '');
            setPhone(org.phone || '');
            setEmail(org.email || '');
            setNotificationEmails(org.notificationEmails?.join(', ') || '');
            setWebsite(org.website || '');
            setIndustry(org.industry || 'HVAC');
            setSupportedTrades(org.supportedTrades || []);
            setBrandingColor(org.primaryColor || '#0284c7');
            setLogoUrl(org.logoUrl || '');
            setLetterheadUrl(org.letterheadDataUrl || '');
            setFooterImageUrl(org.footerImage || '');
            setBannerUrl(org.bannerUrl || '');
            setFinancingLink(org.financingLink || '');
            setServiceTypes(org.serviceTypes || []);
            setSpecializations(org.specializations || []);
            
            setPublicProfileEnabled(settings.publicProfile || false);
            setPublicDescription(settings.publicDescription || '');
            setPublicCredentials(settings.publicCredentials || []);
            setPublicServices(settings.publicServices || []);
            setPublicLogoUrl(settings.publicLogoUrl || '');

            if (org.address) {
                setAddressStreet(org.address.street || '');
                setCity(org.address.city || '');
                setStateName(org.address.state || '');
                setZip(org.address.zip || '');
            } else {
                setAddressStreet('');
                setCity('');
                setStateName('');
                setZip('');
            }
            
            setTaxRate(org.taxRate?.toString() || '8.25');
            setLicenseNumber(org.licenseNumber || '');
            setUeid(org.ueid || '');
            setCageCode(org.cageCode || '');
            setPrimaryNaics(org.primaryNaics || '');
            setMarketMultiplier(org.marketMultiplier?.toString() || '1.0');
            setAiPricebookEnabled(org.aiPricebookEnabled !== false);
            setCustomPositions(org.customPositions || []);
            setRequiredCerts(org.requiredCertifications || []);
            setTermsAndConditions(org.termsAndConditions || '');
            setProposalDisclaimer(org.proposalDisclaimer || '');
            setInvoiceTerms(org.invoiceTerms || '');
            setMembershipTerms(org.membershipTerms || '');
            setComplianceFooter(org.complianceFooter || '');
            setWarrantyDisclaimer((org as any).warrantyDisclaimer || '');
            setDefaultWorkmanshipMonths((org as any).defaultWorkmanshipMonths ?? 12);
            setDefaultPartsMonths((org as any).defaultPartsMonths ?? 12);
            setPaypalClientId(org.paypalClientId || '');
            setStripePublicKey(org.stripePublicKey || '');
            setSquareAppId(org.squareApplicationId || '');
            setSquareLocId(org.squareLocationId || '');
            // Prevent clearing the token out locally if the public map naturally doesn't have it
            if ((org as any).squareToken) setSquareToken((org as any).squareToken);
            setSocialLinks(org.socialLinks || {});
            setReviewLinks(org.reviewLinks || {});
            setGoogleApiConnected(org.googleApiConnected || false);
            setGoogleClientId(org.googleClientId || DEFAULT_GOOGLE_CLIENT_ID);
            setQuickbooksConnected(org.quickbooksConnected || false);
            
            // Fetch Protected Secrets
            db.collection('organizations').doc(org.id).collection('secrets').doc('config').get()
                .then(doc => {
                    if (doc.exists) {
                        const sec = doc.data() as any;
                        setMeasureQuickApiKey(sec.measureQuickApiKey || '');
                        if (sec.webhookSecretKey) setWebhookSecretKey(sec.webhookSecretKey);
                        if (sec.smtpConfig) {
                            setSmtpHost(sec.smtpConfig.host || '');
                            setSmtpPort(sec.smtpConfig.port || 587);
                            setSmtpUser(sec.smtpConfig.user || '');
                            setSmtpPass(sec.smtpConfig.pass || '');
                        }
                        if (sec.twilioConfig) {
                            setTwilioSid(sec.twilioConfig.accountSid || '');
                            setTwilioToken(sec.twilioConfig.authToken || '');
                            setTwilioNumber(sec.twilioConfig.phoneNumber || '');
                        }
                        if (sec.squareToken) setSquareToken(sec.squareToken);
                        if (sec.squareAppId) setSquareAppId(sec.squareAppId);
                        if (sec.squareLocId) setSquareLocId(sec.squareLocId);
                    } else {
                        // Fallback if migration hasn't run yet
                        setMeasureQuickApiKey((org as any).measureQuickApiKey || '');
                        if (org.smtpConfig) {
                            setSmtpHost(org.smtpConfig.host || '');
                            setSmtpPort(org.smtpConfig.port || 587);
                            setSmtpUser(org.smtpConfig.user || '');
                            setSmtpPass(org.smtpConfig.pass || '');
                        }
                        if (org.twilioConfig) {
                            setTwilioSid(org.twilioConfig.accountSid || '');
                            setTwilioToken(org.twilioConfig.authToken || '');
                            setTwilioNumber(org.twilioConfig.phoneNumber || '');
                        }
                    }
                }).catch(err => console.error("Failed to load secure API keys", err));
        }
    }, [state.currentOrganization]);

    const billingDetails = useMemo(() => {
        const org = state.currentOrganization;
        if (!org) return null;
        const currentPlan = org.plan || 'starter';
        const planConfig = state.platformSettings?.plans?.[currentPlan];
        const activeUsers = state.users.filter(u => u.organizationId === org.id && u.status !== 'archived' && u.hasAppAccess !== false).length;
        const monthlyCost = planConfig?.monthly || (currentPlan === 'enterprise' ? 299 : currentPlan === 'growth' ? 149 : 49);
        const maxUsers = org.additionalUserSlots ? (planConfig?.maxUsers || 5) + org.additionalUserSlots : (planConfig?.maxUsers || 5);
        const discountPct = org.customDiscountPct || 0;
        const finalCost = org.isFreeAccess ? 0 : (monthlyCost * (1 - (discountPct / 100)));
        return {
            planName: currentPlan,
            monthlyCost: finalCost,
            maxUsers: maxUsers,
            activeUsers: activeUsers,
            isExpired: org.subscriptionExpiryDate ? new Date(org.subscriptionExpiryDate) < new Date() : false,
            isTrial: org.subscriptionStatus === 'trial',
            isFree: org.isFreeAccess
        };
    }, [state.currentOrganization, state.platformSettings, state.users]);

    const handleSave = async () => {
        if (!state.currentOrganization) return;
        setIsSaving(true);
        const notifyArray = notificationEmails.split(',').map(e => e.trim()).filter(e => e.length > 0);
        
        const newAddress: Address = {
            street: addressStreet,
            city,
            state: stateName,
            zip
        };

        const updatedOrgData = {
            name: orgName, phone, email, notificationEmails: notifyArray, website,
            socialLinks, reviewLinks, googleApiConnected, googleClientId, industry, supportedTrades,
            primaryColor: brandingColor, logoUrl, letterheadDataUrl: letterheadUrl, footerImage: footerImageUrl, bannerUrl,
            financingLink, 
            serviceTypes, specializations,
            address: newAddress,
            taxRate: parseFloat(taxRate) || 0,
            licenseNumber, ueid, cageCode, primaryNaics, customPositions, requiredCertifications: requiredCerts,
            termsAndConditions, proposalDisclaimer, invoiceTerms, membershipTerms, complianceFooter,
            warrantyDisclaimer, defaultWorkmanshipMonths, defaultPartsMonths,
            paypalClientId, stripePublicKey, squareApplicationId: squareAppId, squareLocationId: squareLocId,
            marketMultiplier: parseFloat(marketMultiplier) || 1.0,
            aiPricebookEnabled,
            quickbooksConnected,
            settings: {
                ...(state.currentOrganization.settings || {}),
                publicProfile: publicProfileEnabled,
                publicDescription: publicDescription,
                publicCredentials: publicCredentials,
                publicServices: publicServices,
                publicLogoUrl: publicLogoUrl
            }
        };

        const secretsData = {
            measureQuickApiKey,
            webhookSecretKey,
            squareToken,
            squareLocId,
            squareAppId,
            smtpConfig: {
                host: smtpHost, port: Number(smtpPort), user: smtpUser, pass: smtpPass,
                fromEmail: email, fromName: orgName, secure: Number(smtpPort) === 465
            },
            twilioConfig: { accountSid: twilioSid, authToken: twilioToken, phoneNumber: twilioNumber }
        };

        try {
            const orgRef = db.collection('organizations').doc(state.currentOrganization.id);
            const batch = db.batch();
            
            // Update public profile (removing exposed secrets over time as they are nullified by the backend)
            batch.set(orgRef, updatedOrgData, { merge: true });
            
            // Upsert Secrets Document
            const secretsRef = orgRef.collection('secrets').doc('config');
            batch.set(secretsRef, secretsData, { merge: true });

            await batch.commit();
            
            const finalOrgState = { ...state.currentOrganization, ...updatedOrgData };
            delete (finalOrgState as any).publicProfileEnabled;
            delete (finalOrgState as any).publicDescription;
            
            dispatch({ type: 'UPDATE_ORGANIZATION', payload: finalOrgState });
            alert('Settings saved!');
        } catch (error) { 
            console.error("Error saving settings:", error);
            alert("Error saving settings. Check console for details."); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleConnectGoogle = async () => {
        if (!state.currentOrganization || !googleClientId) {
            alert("Please enter Google Client ID in Integrations first.");
            return;
        }
        setIsConnectingGoogle(true);
        try {
            // @ts-ignore
            if (typeof google === 'undefined' || !google.accounts) {
                alert("Google Identity Services not loaded.");
                setIsConnectingGoogle(false);
                return;
            }
            // @ts-ignore
            const client = google.accounts.oauth2.initTokenClient({
                client_id: googleClientId,
                scope: 'https://www.googleapis.com/auth/business.manage',
                callback: async (tokenResponse: any) => {
                    if (tokenResponse.access_token) {
                        try {
                            const res = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
                                headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
                            });
                            if (res.ok) {
                                await db.collection('organizations').doc(state.currentOrganization!.id).update({
                                    googleApiConnected: true, googleClientId: googleClientId 
                                });
                                setGoogleApiConnected(true);
                                dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization!, googleApiConnected: true, googleClientId } });
                                alert("Authenticated with Google!");
                            } else {
                                alert("Auth successful but failed to fetch accounts.");
                            }
                        } catch (apiErr) { alert("API Verification Failed."); }
                    } else { alert("Authentication failed."); }
                    setIsConnectingGoogle(false);
                },
            });
            client.requestAccessToken();
        } catch (e) { alert("OAuth failed."); setIsConnectingGoogle(false); }
    };

    const handleDisconnectGoogle = async () => {
        if (!state.currentOrganization) return;
        if (await globalConfirm("Disconnect Google Business Profile?")) {
            try {
                await db.collection('organizations').doc(state.currentOrganization.id).update({ googleApiConnected: false });
                setGoogleApiConnected(false);
                dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization, googleApiConnected: false } });
            } catch (e) { alert("Failed to disconnect."); }
        }
    };
    
    const handleConnectQuickBooks = async () => {
        if (!state.currentOrganization) return;
        setIsConnectingQuickbooks(true);
        setTimeout(async () => {
            const success = await globalConfirm("Simulate successful QuickBooks connection?");
            if (success) {
                await db.collection('organizations').doc(state.currentOrganization!.id).update({ quickbooksConnected: true });
                setQuickbooksConnected(true);
                dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization!, quickbooksConnected: true } });
                alert("Connected to QuickBooks Online!");
            }
            setIsConnectingQuickbooks(false);
        }, 1500);
    };

    const handleDisconnectQuickBooks = async () => {
        if (!state.currentOrganization) return;
        if (await globalConfirm("Disconnect QuickBooks Online? Syncing will stop.")) {
            try {
                await db.collection('organizations').doc(state.currentOrganization.id).update({ quickbooksConnected: false });
                setQuickbooksConnected(false);
                dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization, quickbooksConnected: false } });
            } catch (e) { alert("Failed to disconnect."); }
        }
    };

    const handleTradeToggle = (trade: IndustryVertical) => {
        setSupportedTrades(prev => prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]);
    };

    const handleAddItem = (type: 'position' | 'cert') => {
        if (type === 'position' && newPosition) { setCustomPositions([...customPositions, newPosition]); setNewPosition(''); }
        else if (type === 'cert' && newCert) { setRequiredCerts([...requiredCerts, newCert]); setNewCert(''); }
    };

    const handleRemoveItem = (type: 'position' | 'cert', index: number) => {
        if (type === 'position') setCustomPositions(customPositions.filter((_, i) => i !== index));
        else setRequiredCerts(requiredCerts.filter((_, i) => i !== index));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
        const file = e.target.files?.[0];
        if (file) { try { const base64 = await compressFile(file); setter(base64); } catch (err) { alert("Upload error"); } }
    };

    const handleSendTestEmail = async () => {
        if (!email || !smtpHost || !smtpUser || !smtpPass) { alert("Incomplete SMTP config."); return; }
        setIsSendingTest(true);
        try {
            await db.collection('mail').add({
                to: [email],
                message: {
                    subject: `[SMTP TEST] ${orgName}`,
                    html: `<h2>SMTP Connection Successful</h2>`
                },
                status: 'pending',
                organizationId: state.currentOrganization?.id,
                transport: { host: smtpHost, port: Number(smtpPort), secure: Number(smtpPort) === 465, auth: { user: smtpUser, pass: smtpPass }, from: `"${orgName}" <${email}>` }
            });
            alert(`Test message queued!`);
        } catch (e) { alert("Failed to queue test."); } finally { setIsSendingTest(false); }
    };

    const handleExportData = (type: 'customers' | 'jobs' | 'inventory', format: 'csv' | 'json') => {
        let data = type === 'customers' ? state.customers : type === 'jobs' ? state.jobs : state.inventory;
        if (data.length === 0) { alert(`No ${type} records.`); return; }
        const fileName = `${type}_export_${new Date().toISOString().split('T')[0]}`;
        const content = format === 'json' ? JSON.stringify(data, null, 2) : 
            [Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object').join(','), ...data.map(row => Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object').map(f => JSON.stringify(row[f] || '')).join(','))].join('\n');
        const blob = new window.Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${fileName}.${format}`; a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleDetectDuplicates = () => {
        const nameMap: any = {};
        state.customers.forEach(c => { const n = c.name.trim().toLowerCase(); nameMap[n] = (nameMap[n] || 0) + 1; });
        const duplicates = Object.entries(nameMap).filter(([_, c]: any) => c > 1).map(([n, c]: any) => ({ name: n, count: c }));
        setDuplicateResults(duplicates); setIsDuplicatesModalOpen(true);
    };

    const handleMergeCustomer = async (name: string) => {
        if (!await globalConfirm(`Merge customers named "${name}"?`)) return;
        setIsSaving(true);
        try {
            const targets = state.customers.filter(c => c.name.trim().toLowerCase() === name.toLowerCase());
            const master = targets[0];
            const batch = db.batch();
            targets.slice(1).forEach(dup => { batch.delete(db.collection('customers').doc(dup.id)); });
            await batch.commit();
            setDuplicateResults(prev => prev.filter(p => p.name !== name));
            alert(`Merged into ${master.id}.`);
        } catch (e) { alert("Merge failed."); } finally { setIsSaving(false); }
    };

    const handleFlushCache = async () => { if (await globalConfirm("Clear local storage and refresh?")) { localStorage.clear(); window.location.reload(); } };
    const handleCleanupRecords = async () => {
        if (!await globalConfirm("Wipe archived records?")) return;
        setIsSaving(true);
        try {
            const archived = state.users.filter(u => u.status === 'archived');
            const batch = db.batch(); archived.forEach(u => batch.delete(db.collection('users').doc(u.id)));
            await batch.commit(); alert(`Cleaned ${archived.length} records.`);
        } catch (e) { alert("Cleanup error."); } finally { setIsSaving(false); }
    };
    const handleDownloadTemplate = () => {
        const blob = new window.Blob(["Name,Email,Phone,Address,City,State,Zip,Type,Notes\nJohn Doe,john@example.com,555-123-4567,123 Main St,Anytown,TX,78701,Residential,Gate code 1234"], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = "template.csv"; a.click(); window.URL.revokeObjectURL(url);
    };

    const handleModifyBilling = () => setIsBillingHelpOpen(true);
    const copyWidgetCode = (type: 'booking' | 'hiring') => {
        const functionUrl = "https://us-central1-tektrakker.cloudfunctions.net/submitWidgetForm";
        const code = `<script src="${window.location.origin}/${type === 'booking' ? 'widget.js' : 'hiring-widget.js'}" data-org-id="${state.currentOrganization?.id}" data-function-url="${functionUrl}"></script>`;
        navigator.clipboard.writeText(code);
        alert(`${type} code copied!`);
    };

    return (
        <div className="space-y-6 pb-24">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Company Settings</h2>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Configure <span className="text-primary-600 dark:text-primary-400">{orgName}</span></p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="shadow-xl px-10 py-3 font-black uppercase text-xs tracking-widest">
                    {isSaving ? 'Saving...' : 'Commit All Changes'}
                </Button>
            </header>

            <div className="flex overflow-x-auto gap-1 border-b border-gray-200 dark:border-gray-700 pb-1 mb-6 scrollbar-hide">
                {[
                    { id: 'profile', label: 'Identity', icon: Building },
                    { id: 'social', label: 'Social & Reviews', icon: Globe },
                    { id: 'operations', label: 'Operations', icon: Activity },
                    { id: 'capabilities', label: 'Capabilities', icon: Wrench },
                    { id: 'legal', label: 'Legal/Docs', icon: Scale },
                    { id: 'integrations', label: 'Integrations', icon: CreditCard },
                    { id: 'accounting', label: 'Accounting', icon: FileText },
                    { id: 'branding', label: 'Branding', icon: Palette },
                    { id: 'subscription', label: 'Plan & Billing', icon: Zap },
                    { id: 'data', label: 'Data Mgmt', icon: Database },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap rounded-t-xl transition-all ${activeTab === tab.id ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border border-b-0 border-gray-200 dark:border-gray-700 translate-y-[1px]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="animate-fade-in">
                {activeTab === 'profile' && <ProfileTab {...{ orgName, setOrgName, email, setEmail, phone, setPhone, website, setWebsite, notificationEmails, setNotificationEmails, industry, setIndustry, supportedTrades, handleTradeToggle, allIndustries: ALL_INDUSTRIES }} />}
                {activeTab === 'social' && <SocialTab {...{ socialLinks, setSocialLinks, reviewLinks, setReviewLinks }} />}
                {activeTab === 'operations' && <OperationsTab {...{ address: addressStreet, setAddress: setAddressStreet, city, setCity, stateName, setStateName, zip, setZip, taxRate, setTaxRate, licenseNumber, setLicenseNumber, primaryNaics, setPrimaryNaics, ueid, setUeid, cageCode, setCageCode, customPositions, newPosition, setNewPosition, handleAddItem, handleRemoveItem, requiredCerts, newCert, setNewCert, marketMultiplier, setMarketMultiplier, aiPricebookEnabled, setAiPricebookEnabled }} />}
                {activeTab === 'capabilities' && <CapabilitiesTab {...{ serviceTypes, setServiceTypes, specializations, setSpecializations }} />}
                {activeTab === 'legal' && <LegalTab {...{ termsAndConditions, setTermsAndConditions, proposalDisclaimer, setProposalDisclaimer, invoiceTerms, setInvoiceTerms, membershipTerms, setMembershipTerms, complianceFooter, setComplianceFooter, warrantyDisclaimer, setWarrantyDisclaimer, defaultWorkmanshipMonths, setDefaultWorkmanshipMonths, defaultPartsMonths, setDefaultPartsMonths }} />}
                {activeTab === 'integrations' && <IntegrationsTab {...{ paypalClientId, setPaypalClientId, stripePublicKey, setStripePublicKey, squareAppId, setSquareAppId, squareLocId, setSquareLocId, squareToken, setSquareToken, smtpHost, setSmtpHost, smtpPort, setSmtpPort, smtpUser, setSmtpUser, smtpPass, setSmtpPass, handleSendTestEmail, isSendingTest, twilioSid, setTwilioSid, twilioToken, setTwilioToken, twilioNumber, setTwilioNumber, bookingWidgetMode, setBookingWidgetMode, hiringWidgetMode, setHiringWidgetMode, copyWidgetCode, measureQuickApiKey, setMeasureQuickApiKey, webhookSecretKey, setWebhookSecretKey, orgId: state.currentOrganization?.id || '' }} />}
                {activeTab === 'accounting' && <AccountingTab {...{ quickbooksConnected, handleConnectQuickBooks, handleDisconnectQuickBooks, isConnectingQuickbooks }} />}
                {activeTab === 'branding' && <BrandingTab {...{ brandingColor, setBrandingColor, financingLink, setFinancingLink, logoUrl, setLogoUrl, publicLogoUrl, setPublicLogoUrl, letterheadUrl, setLetterheadUrl, footerImageUrl, setFooterImageUrl, bannerUrl, setBannerUrl, handleFileUpload, publicProfileEnabled, setPublicProfileEnabled, publicDescription, setPublicDescription, publicCredentials, setPublicCredentials, publicServices, setPublicServices }} />}
                {activeTab === 'subscription' && <SubscriptionTab {...{ billingDetails, handleModifyBilling }} />}
                {activeTab === 'data' && <DataTab {...{ handleExportData, handleDetectDuplicates, handleCleanupRecords, handleFlushCache, handleImportFile: () => {}, handleDownloadTemplate }} />}
            </div>

            <Modal isOpen={isBillingHelpOpen} onClose={() => setIsBillingHelpOpen(false)} title="Manage Subscription">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Contact support to upgrade your plan or add user seats.</p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsBillingHelpOpen(false)}>Close</Button>
                        <Button onClick={() => {}}>Request Update Link</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isDuplicatesModalOpen} onClose={() => setIsDuplicatesModalOpen(false)} title="Duplicate Resolution">
                <div className="space-y-4 max-h-60 overflow-y-auto">
                    {duplicateResults.map((dup, i) => (
                        <div key={i} className="p-3 flex justify-between items-center bg-white dark:bg-gray-800 border-b">
                            <div><p className="font-bold text-sm">{dup.name}</p><p className="text-xs text-red-500">{dup.count} Records</p></div>
                            <Button onClick={() => handleMergeCustomer(dup.name)} className="text-xs h-7">Merge All</Button>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

export default Settings;
