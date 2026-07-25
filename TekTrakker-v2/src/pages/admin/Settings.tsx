import { getBaseUrl , cleanUndefinedFields } from "lib/utils";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Button from 'components/ui/Button';
import { db, functions } from 'lib/firebase';
import {
    Building, Globe, Activity, Scale, CreditCard, Palette, Zap, Database, FileText, Wrench, AlertTriangle, Layers, Users, ShieldCheck
} from 'lucide-react';
import type { Organization, IndustryVertical, Address, Division } from 'types';
import Modal from 'components/ui/Modal';

import ProfileTab from './settings/components/ProfileTab';
import SocialTab from './settings/components/SocialTab';
import OperationsTab from './settings/components/OperationsTab';
import LegalTab from './settings/components/LegalTab';
import IntegrationsTab from './settings/components/IntegrationsTab';
import BrandingTab from './settings/components/BrandingTab';
import SubscriptionTab from './settings/components/SubscriptionTab';
import DataTab from './settings/components/DataTab';
import CapabilitiesTab from './settings/components/CapabilitiesTab';
import { DivisionsTab } from './settings/components/DivisionsTab';
import { DispatchTeamsTab } from './settings/components/DispatchTeamsTab';
import SubcontractorComplianceTab from './settings/components/SubcontractorComplianceTab';
import { globalConfirm } from "lib/globalConfirm";
import showToast from "lib/toast";
import { syncOrgAIContext } from 'lib/aiContext';

const ALL_INDUSTRIES: IndustryVertical[] = [
    'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General',
    'Cleaning', 'Painting', 'Roofing', 'Contracting', 'Masonry',
    'Telecommunications', 'Solar', 'Security', 'Pet Grooming', 'Property Management',
    'Appliance Repair', 'Garage Door'
];

const DEFAULT_GOOGLE_CLIENT_ID = "655867451194-3p9dkm7tjb15a2njggqa2jcc64i4vibh.apps.googleusercontent.com";



const Settings: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'profile' | 'divisions' | 'social' | 'operations' | 'legal' | 'integrations' | 'branding' | 'subscription' | 'data' | 'capabilities' | 'dispatchTeams' | 'subcontractorCompliance'>('profile');
    const location = useLocation();

    // Support deep-linking via ?tab= query parameter
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab && ['profile', 'divisions', 'social', 'operations', 'legal', 'integrations', 'branding', 'subscription', 'data', 'capabilities', 'dispatchTeams', 'subcontractorCompliance'].includes(tab)) {
            setActiveTab(tab as typeof activeTab);
        }
    }, [location.search]);

    // Core Identity
    const [orgName, setOrgName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notificationEmails, setNotificationEmails] = useState('');
    const [website, setWebsite] = useState('');
    const [industry, setIndustry] = useState<IndustryVertical>('HVAC');
    const [supportedTrades, setSupportedTrades] = useState<IndustryVertical[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [taxId, setTaxId] = useState('');
    const [ein, setEin] = useState('');
    const [businessType, setBusinessType] = useState('');
    const [incorporationState, setIncorporationState] = useState('');
    const [formationDate, setFormationDate] = useState('');
    const [businessDocuments, setBusinessDocuments] = useState<Array<{ id: string; name: string; url: string; uploadedAt: string }>>([]);

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
    const [virtualWorkerEnabled, setVirtualWorkerEnabled] = useState(false);
    const [invoicePrefix, setInvoicePrefix] = useState('INV-');
    const [invoiceStartNumber, setInvoiceStartNumber] = useState('1000');
    const [proposalPrefix, setProposalPrefix] = useState('PROP-');
    const [proposalStartNumber, setProposalStartNumber] = useState('1000');
    const [allowPartialPayments, setAllowPartialPayments] = useState(false);
    const [cardProcessingFeeEnabled, setCardProcessingFeeEnabled] = useState(false);
    const [cardProcessingFeePercent, setCardProcessingFeePercent] = useState('2.9');
    const [cardProcessingFeeFlat, setCardProcessingFeeFlat] = useState('0.30');
    const [achProcessingFeeEnabled, setAchProcessingFeeEnabled] = useState(false);
    const [achProcessingFeePercent, setAchProcessingFeePercent] = useState('1.0');
    const [achProcessingFeeFlat, setAchProcessingFeeFlat] = useState('0.00');

    // Late Fees
    const [lateFeeEnabled, setLateFeeEnabled] = useState(false);
    const [autoSendMonthlyStatements, setAutoSendMonthlyStatements] = useState(false);
    const [lateFeeType, setLateFeeType] = useState<'flat' | 'percent'>('percent');
    const [lateFeeValue, setLateFeeValue] = useState('1.5');
    const [lateFeeInterestRate, setLateFeeInterestRate] = useState('1.5');
    const [lateFeeGracePeriod, setLateFeeGracePeriod] = useState('0');

    // HR
    const [customPositions, setCustomPositions] = useState<string[]>([]);
    const [requiredCerts, setRequiredCerts] = useState<string[]>([]);
    const [newPosition, setNewPosition] = useState('');
    const [newCert, setNewCert] = useState('');

    // Legal
    const [termsAndConditions, setTermsAndConditions] = useState('');
    const [customerTerms, setCustomerTerms] = useState('');
    const [proposalTerms, setProposalTerms] = useState('');
    const [proposalDisclaimer, setProposalDisclaimer] = useState('');
    const [invoiceTerms, setInvoiceTerms] = useState('');
    const [membershipTerms, setMembershipTerms] = useState('');
    const [complianceFooter, setComplianceFooter] = useState('');
    const [warrantyDisclaimer, setWarrantyDisclaimer] = useState('');
    const [defaultWorkmanshipMonths, setDefaultWorkmanshipMonths] = useState(12);
    const [defaultPartsMonths, setDefaultPartsMonths] = useState(12);
    const [proposalProtectionMode, setProposalProtectionMode] = useState<'none' | 'summary' | 'nda'>('none');
    const [proposalNdaContent, setProposalNdaContent] = useState('');

    // Integrations
    const [stripePublicKey, setStripePublicKey] = useState('');
    const [squareAppId, setSquareAppId] = useState('');
    const [squareLocId, setSquareLocId] = useState('');
    const [squareToken, setSquareToken] = useState('');
    const [defaultPaymentGateway, setDefaultPaymentGateway] = useState<'stripe' | 'square' | 'kort'>('kort');
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
    const [kortAccountId, setKortAccountId] = useState('');

    // B2B Supplier Integrations (cXML PunchOut)
    const [punchoutConfigs, setPunchoutConfigs] = useState<any[]>([{
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        supplierName: '',
        setupUrl: '',
        fromDomain: 'NetworkId',
        fromIdentity: '',
        toDomain: 'NetworkId',
        toIdentity: '',
        sharedSecret: ''
    }]);

    // Accounting Integrations
    const [quickbooksConnected, setQuickbooksConnected] = useState(false);
    const [isConnectingQuickbooks, setIsConnectingQuickbooks] = useState(false);
    const [isConnectingRingCentral, setIsConnectingRingCentral] = useState(false);

    // IoT Integrations
    const [seamApiKey, setSeamApiKey] = useState('');
    const [nestProjectId, setNestProjectId] = useState('');
    const [nestClientId, setNestClientId] = useState('');
    const [nestClientSecret, setNestClientSecret] = useState('');
    const [ecobeeApiKey, setEcobeeApiKey] = useState('');
    const [honeywellApiKey, setHoneywellApiKey] = useState('');
    const [honeywellClientSecret, setHoneywellClientSecret] = useState('');

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
    const [acceptsSubcontracting, setAcceptsSubcontracting] = useState(false);

    // Fleet & GPS
    const [samsaraApiKey, setSamsaraApiKey] = useState('');

    // Consumer Financing
    const [greenSkyMerchantId, setGreenSkyMerchantId] = useState('');
    const [greenSkyApiPw, setGreenSkyApiPw] = useState('');
    const [goodLeapApiKey, setGoodLeapApiKey] = useState('');

    // HR Compliance
    const [checkrApiKey, setCheckrApiKey] = useState('');

    // Communications
    const [ringCentralClientId, setRingCentralClientId] = useState('');
    const [rcBackendClientId, setRcBackendClientId] = useState('');
    const [ringCentralClientSecret, setRingCentralClientSecret] = useState('');
    const [ringCentralJwtToken, setRingCentralJwtToken] = useState('');
    const [ringCentralLoginFlow, setRingCentralLoginFlow] = useState<'jwt' | 'oauth'>('jwt');
    const [ringCentralCallMode, setRingCentralCallMode] = useState<'browser' | 'ringout'>('browser');
    const [rcPrimarySms, setRcPrimarySms] = useState(false);
    const [rcEnableVoiceAi, setRcEnableVoiceAi] = useState(false);
    const [rcRingsBeforeAi, setRcRingsBeforeAi] = useState('');
    const [rcSmsOnMissed, setRcSmsOnMissed] = useState(false);
    const [rcSmsTemplate, setRcSmsTemplate] = useState('');
    const [rcMappings, setRcMappings] = useState<{ phoneNumber: string, assignedUserId: string, forwardToUserId: string }[]>([]);

    // Widgets & Extras
    const [openWeatherApiKey, setOpenWeatherApiKey] = useState('');
    const [shovelsApiKey, setShovelsApiKey] = useState('');
    const [shovelsUsageCount, setShovelsUsageCount] = useState(240); // Mock usage count for trial limit demonstration

    // Capabilities
    const [serviceTypes, setServiceTypes] = useState<('Residential' | 'Commercial')[]>([]);
    const [specializations, setSpecializations] = useState<string[]>([]);

    // Webhook Secuity Key
    const [webhookSecretKey, setWebhookSecretKey] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [isBillingHelpOpen, setIsBillingHelpOpen] = useState(false);
    const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
    const [duplicateResults, setDuplicateResults] = useState<{ name: string, count: number }[]>([]);

    const initializedOrgId = useRef<string | null>(null);

    useEffect(() => {
        if (state.currentOrganization) {
            if (initializedOrgId.current === state.currentOrganization.id) {
                return; // Already initialized, don't overwrite local edits when a snapshot comes in
            }
            initializedOrgId.current = state.currentOrganization.id;

            const org = state.currentOrganization;
            const settings = org.settings || {};

            setOrgName(org.name || '');
            setPhone(org.phone || '');
            setEmail(org.email || '');
            setNotificationEmails(org.notificationEmails?.join(', ') || '');
            setWebsite(org.website || '');
            setIndustry(org.industry || 'HVAC');
            setSupportedTrades(org.supportedTrades || []);
            setDivisions(org.divisions || []);
            setTaxId(org.taxId || '');
            setEin((org as any).ein || '');
            setBusinessType((org as any).businessType || '');
            setIncorporationState((org as any).incorporationState || '');
            setFormationDate((org as any).formationDate || '');
            setBusinessDocuments((org as any).businessDocuments || []);
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
            setOpenWeatherApiKey(settings.openWeatherApiKey || '');
            setShovelsApiKey(settings.shovelsApiKey || '1mKV5CywapTgTqEx3cD5v_h5jLZd9A0CYMU2YEsFx60');
            setShovelsUsageCount(settings.shovelsUsageCount ?? 200);
            setAcceptsSubcontracting(org.acceptsSubcontracting || false);

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
            setVirtualWorkerEnabled(org.virtualWorkerEnabled || false);
            setAllowPartialPayments(org.allowPartialPayments || false);
            setCardProcessingFeeEnabled(org.cardProcessingFeeEnabled || false);
            setCardProcessingFeePercent(org.cardProcessingFeePercent?.toString() ?? '2.9');
            setCardProcessingFeeFlat(org.cardProcessingFeeFlat?.toString() ?? '0.30');
            setAchProcessingFeeEnabled(org.achProcessingFeeEnabled || false);
            setAchProcessingFeePercent(org.achProcessingFeePercent?.toString() ?? '1.0');
            setAchProcessingFeeFlat(org.achProcessingFeeFlat?.toString() ?? '0.00');
            setLateFeeEnabled((org as any).lateFeeEnabled || false);
            setLateFeeType((org as any).lateFeeType || 'percent');
            setLateFeeValue((org as any).lateFeeValue?.toString() ?? '1.5');
            setLateFeeInterestRate((org as any).lateFeeInterestRate?.toString() ?? '1.5');
            setLateFeeGracePeriod((org as any).lateFeeGracePeriod?.toString() ?? '0');
            setAutoSendMonthlyStatements((org as any).autoSendMonthlyStatements || false);
            setCustomPositions(org.customPositions || []);
            setRequiredCerts(org.requiredCertifications || []);
            setTermsAndConditions(org.termsAndConditions || '');
            setCustomerTerms(org.customerTerms || '');
            setProposalTerms(org.proposalTerms || '');
            setProposalDisclaimer(org.proposalDisclaimer || '');
            setInvoiceTerms(org.invoiceTerms || '');
            setMembershipTerms(org.membershipTerms || '');
            setComplianceFooter(org.complianceFooter || '');
            setWarrantyDisclaimer((org as any).warrantyDisclaimer || '');
            setDefaultWorkmanshipMonths((org as any).defaultWorkmanshipMonths ?? 12);
            setDefaultPartsMonths((org as any).defaultPartsMonths ?? 12);
            setProposalProtectionMode((org as any).proposalProtectionMode || 'none');
            setProposalNdaContent((org as any).proposalNdaContent || '');
            setStripePublicKey(org.stripePublicKey || '');
            setSquareAppId(org.squareApplicationId || '');
            setSquareLocId(org.squareLocationId || '');
            setKortAccountId((org as any).kortAccountId || '');
            setDefaultPaymentGateway((org as any).defaultPaymentGateway || 'kort');
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
                        if (sec.seamApiKey) setSeamApiKey(sec.seamApiKey);
                        if (sec.nestProjectId) setNestProjectId(sec.nestProjectId);
                        if (sec.nestClientId) setNestClientId(sec.nestClientId);
                        if (sec.nestClientSecret) setNestClientSecret(sec.nestClientSecret);
                        if (sec.ecobeeApiKey) setEcobeeApiKey(sec.ecobeeApiKey);
                        if (sec.honeywellApiKey) setHoneywellApiKey(sec.honeywellApiKey);
                        if (sec.honeywellClientSecret) setHoneywellClientSecret(sec.honeywellClientSecret);
                        if (sec.samsaraApiKey) setSamsaraApiKey(sec.samsaraApiKey);
                        if (sec.greenSkyMerchantId) setGreenSkyMerchantId(sec.greenSkyMerchantId);
                        if (sec.greenSkyApiPw) setGreenSkyApiPw(sec.greenSkyApiPw);
                        if (sec.goodLeapApiKey) setGoodLeapApiKey(sec.goodLeapApiKey);
                        if (sec.checkrApiKey) setCheckrApiKey(sec.checkrApiKey);
                        if (sec.ringCentralClientId) setRingCentralClientId(sec.ringCentralClientId);
                        if (sec.rcBackendClientId) setRcBackendClientId(sec.rcBackendClientId);
                        if (sec.ringCentralClientSecret) setRingCentralClientSecret(sec.ringCentralClientSecret);
                        if (sec.ringCentralJwtToken) setRingCentralJwtToken(sec.ringCentralJwtToken);
                        if (sec.ringCentralLoginFlow) setRingCentralLoginFlow(sec.ringCentralLoginFlow);
                        if (sec.ringCentralCallMode) setRingCentralCallMode(sec.ringCentralCallMode);
                        if (sec.rcPrimarySms !== undefined) setRcPrimarySms(sec.rcPrimarySms);
                        if (sec.rcEnableVoiceAi !== undefined) setRcEnableVoiceAi(sec.rcEnableVoiceAi);
                        if (sec.rcRingsBeforeAi) setRcRingsBeforeAi(sec.rcRingsBeforeAi);
                        if (sec.rcSmsOnMissed !== undefined) setRcSmsOnMissed(sec.rcSmsOnMissed);
                        if (sec.rcSmsTemplate) setRcSmsTemplate(sec.rcSmsTemplate);
                        if (sec.rcMappings && Array.isArray(sec.rcMappings)) setRcMappings(sec.rcMappings);

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
                        if (sec.punchoutConfigs && Array.isArray(sec.punchoutConfigs)) {
                            setPunchoutConfigs(sec.punchoutConfigs);
                        } else if (sec.punchoutConfig) {
                            // Migration from single to array
                            setPunchoutConfigs([{
                                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
                                supplierName: sec.punchoutConfig.supplierName || '',
                                setupUrl: sec.punchoutConfig.setupUrl || '',
                                fromDomain: sec.punchoutConfig.fromDomain || 'NetworkId',
                                fromIdentity: sec.punchoutConfig.fromIdentity || '',
                                toDomain: sec.punchoutConfig.toDomain || 'NetworkId',
                                toIdentity: sec.punchoutConfig.toIdentity || '',
                                sharedSecret: sec.punchoutConfig.sharedSecret || ''
                            }]);
                        }
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
        
        // Sync fallbacks with MasterBilling values (99, 249, 499)
        const baseMonthlyCost = planConfig?.monthly || (currentPlan === 'enterprise' ? 499 : currentPlan === 'growth' ? 249 : currentPlan === 'payments_only' ? 10 : 99);
        const userFee = state.platformSettings?.excessUserFee ?? 25;
        const additionalSlotsCost = (org.additionalUserSlots || 0) * userFee;
        
        const divisionFee = state.platformSettings?.divisionFee ?? 79;
        const additionalDivisionsCost = (org.additionalDivisionsSlots || 0) * divisionFee;
        
        const totalMonthlyCost = baseMonthlyCost + additionalSlotsCost + additionalDivisionsCost;
        const maxUsers = org.additionalUserSlots ? (planConfig?.maxUsers || 1) + org.additionalUserSlots : (planConfig?.maxUsers || 1);
        const discountPct = org.customDiscountPct || 0;
        
        const finalCost = org.isFreeAccess ? 0 : (totalMonthlyCost * (1 - (discountPct / 100)));
        
        return {
            planName: currentPlan,
            monthlyCost: finalCost,
            maxUsers: maxUsers,
            activeUsers: activeUsers,
            isExpired: org.subscriptionExpiryDate ? new Date(org.subscriptionExpiryDate) < new Date() : false,
            isTrial: org.subscriptionStatus === 'trial',
            isFree: org.isFreeAccess,
            isPaused: org.subscriptionStatus === 'paused',
            isCancelled: org.subscriptionStatus === 'cancelled' || (org.subscriptionStatus as any) === 'canceled'
        };
    }, [state.currentOrganization, state.platformSettings, state.users]);

    const handleSave = async () => {
        if (!state.currentOrganization) return;
        setIsSaving(true);
        const prevInvoiceStartNumber = (state.currentOrganization as any).invoiceStartNumber;
        const prevProposalStartNumber = (state.currentOrganization as any).proposalStartNumber;
        const newInvoiceStart = parseInt(invoiceStartNumber) || 1000;
        const newProposalStart = parseInt(proposalStartNumber) || 1000;
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
            divisions,
            taxId, ein, businessType, incorporationState, formationDate, businessDocuments,
            primaryColor: brandingColor, logoUrl, letterheadDataUrl: letterheadUrl, footerImage: footerImageUrl, bannerUrl,
            financingLink,
            serviceTypes, specializations,
            address: newAddress,
            taxRate: parseFloat(taxRate) || 0,
            licenseNumber, ueid, cageCode, primaryNaics, customPositions, requiredCertifications: requiredCerts,
            termsAndConditions, customerTerms, proposalTerms, proposalDisclaimer, invoiceTerms, membershipTerms, complianceFooter,
            warrantyDisclaimer, defaultWorkmanshipMonths, defaultPartsMonths,
            proposalProtectionMode, proposalNdaContent,
            stripePublicKey, squareApplicationId: squareAppId, squareLocationId: squareLocId,
            kortAccountId,
            defaultPaymentGateway,
            marketMultiplier: parseFloat(marketMultiplier) || 1.0,
            aiPricebookEnabled,
            virtualWorkerEnabled,
            invoicePrefix,
            invoiceStartNumber: newInvoiceStart,
            proposalPrefix,
            proposalStartNumber: newProposalStart,
            quickbooksConnected,
            allowPartialPayments,
            settings: {
                ...(state.currentOrganization.settings || {}),
                publicProfile: publicProfileEnabled,
                publicDescription: publicDescription,
                publicCredentials: publicCredentials,
                publicServices: publicServices,
                publicLogoUrl: publicLogoUrl,
                openWeatherApiKey: openWeatherApiKey,
                shovelsApiKey: shovelsApiKey,
                shovelsUsageCount: shovelsUsageCount
            },
            acceptsSubcontracting,
            cardProcessingFeeEnabled,
            cardProcessingFeePercent: parseFloat(cardProcessingFeePercent) || 0,
            cardProcessingFeeFlat: parseFloat(cardProcessingFeeFlat) || 0,
            achProcessingFeeEnabled,
            achProcessingFeePercent: parseFloat(achProcessingFeePercent) || 0,
            achProcessingFeeFlat: parseFloat(achProcessingFeeFlat) || 0,
            lateFeeEnabled,
            lateFeeType,
            lateFeeValue: parseFloat(lateFeeValue) || 0,
            lateFeeInterestRate: parseFloat(lateFeeInterestRate) || 0,
            lateFeeGracePeriod: parseInt(lateFeeGracePeriod) || 0,
            autoSendMonthlyStatements
        };

        const secretsData = {
            measureQuickApiKey,
            webhookSecretKey,
            seamApiKey,
            nestProjectId,
            nestClientId,
            nestClientSecret,
            ecobeeApiKey,
            honeywellApiKey,
            honeywellClientSecret,
            samsaraApiKey,
            greenSkyMerchantId,
            greenSkyApiPw,
            goodLeapApiKey,
            checkrApiKey,
            ringCentralClientId,
            rcBackendClientId,
            ringCentralClientSecret,
            ringCentralJwtToken,
            ringCentralLoginFlow,
            ringCentralCallMode,
            rcPrimarySms,
            rcEnableVoiceAi,
            rcRingsBeforeAi,
            rcSmsOnMissed,
            rcSmsTemplate,
            rcMappings,
            squareToken,
            squareLocId,
            squareAppId,
            smtpConfig: {
                host: smtpHost, port: Number(smtpPort), user: smtpUser, pass: smtpPass,
                fromEmail: email, fromName: orgName, secure: Number(smtpPort) === 465
            },
            twilioConfig: { accountSid: twilioSid, authToken: twilioToken, phoneNumber: twilioNumber },
            punchoutConfigs: punchoutConfigs
        };

        try {
            const orgRef = db.collection('organizations').doc(state.currentOrganization.id);
            const batch = db.batch();

            // If start numbers are modified, adjust the next sequence pointers
            if (prevInvoiceStartNumber === undefined || prevInvoiceStartNumber !== newInvoiceStart) {
                (updatedOrgData as any).nextInvoiceNum = newInvoiceStart;
            }
            if (prevProposalStartNumber === undefined || prevProposalStartNumber !== newProposalStart) {
                (updatedOrgData as any).nextProposalNum = newProposalStart;
            }

            // Scrub undefined values to prevent Firebase errors
            const cleanOrgData = JSON.parse(JSON.stringify(updatedOrgData));
            const cleanSecretsData = JSON.parse(JSON.stringify(secretsData));

            // Update public profile (removing exposed secrets over time as they are nullified by the backend)
            batch.set(orgRef, cleanUndefinedFields(cleanOrgData), { merge: true });

            // Upsert Secrets Document
            const secretsRef = orgRef.collection('secrets').doc('config');
            batch.set(secretsRef, cleanUndefinedFields(cleanSecretsData), { merge: true });

            await batch.commit();

            const finalOrgState = { ...state.currentOrganization, ...updatedOrgData };
            delete (finalOrgState as any).publicProfileEnabled;
            delete (finalOrgState as any).publicDescription;

            // Auto-sync AI training context so all AI features see latest org settings
            syncOrgAIContext(finalOrgState as any).catch(err => console.warn('AI context sync failed:', err));

            dispatch({ type: 'UPDATE_ORGANIZATION', payload: finalOrgState });
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3500);
        } catch (error) {
            console.error("Error saving settings:", error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleConnectGoogle = async () => {
        if (!state.currentOrganization || !googleClientId) {
            showToast.warn("Please enter Google Client ID in Integrations first.");
            return;
        }
        setIsConnectingGoogle(true);
        try {
            // @ts-ignore
            if (typeof google === 'undefined' || !google.accounts) {
                showToast.error("Google Identity Services not loaded.");
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
                                await db.collection('organizations').doc(state.currentOrganization!.id).update(cleanUndefinedFields({
                                    googleApiConnected: true, googleClientId: googleClientId
                                }));
                                setGoogleApiConnected(true);
                                dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization!, googleApiConnected: true, googleClientId } });
                                showToast.success("Authenticated with Google!");
                            } else {
                                showToast.warn("Auth successful but failed to fetch accounts.");
                            }
                        } catch (apiErr) { showToast.error("API Verification Failed."); }
                    } else { showToast.error("Authentication failed."); }
                    setIsConnectingGoogle(false);
                },
            });
            client.requestAccessToken();
        } catch (e) { showToast.error("OAuth failed."); setIsConnectingGoogle(false); }
    };

    const handleDisconnectGoogle = async () => {
        if (!state.currentOrganization) return;
        if (await globalConfirm("Disconnect Google Business Profile?")) {
            try {
                await db.collection('organizations').doc(state.currentOrganization.id).update(cleanUndefinedFields({ googleApiConnected: false }));
                setGoogleApiConnected(false);
                dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization, googleApiConnected: false } });
            } catch (e) { showToast.error("Failed to disconnect."); }
        }
    };

    const handleConnectRingCentral = async () => {
        if (!state.currentOrganization) return;
        if (!ringCentralClientId || !ringCentralJwtToken) {
            showToast.error("Please enter both Client ID and JWT Token first.");
            return;
        }

        setIsConnectingRingCentral(true);
        try {
            const registerWebhook = functions.httpsCallable('registerRingCentralWebhook');
            // Hardcode the webhook URL since it's known
            const webhookUrl = `https://us-central1-tektrakker.cloudfunctions.net/ringCentralWebhook`;
            await registerWebhook({
                orgId: state.currentOrganization.id,
                clientId: rcBackendClientId || ringCentralClientId,
                clientSecret: ringCentralClientSecret || '', // Some apps don't need a secret if using JWT
                jwtToken: ringCentralJwtToken,
                webhookUrl
            });

            // Also instantly save the configuration block
            await db.collection('organizations').doc(state.currentOrganization.id).collection('secrets').doc('config').set(cleanUndefinedFields({
                ringCentralClientId,
                ringCentralClientSecret: ringCentralClientSecret || '',
                ringCentralJwtToken,
                ringCentralLoginFlow,
                ringCentralCallMode,
                rcEnableVoiceAi,
                rcRingsBeforeAi,
                rcSmsOnMissed,
                rcSmsTemplate
            }), { merge: true });

            showToast.success("Successfully registered RingCentral webhook and saved settings!");
        } catch (error: any) {
            console.error("RingCentral connection error:", error);
            showToast.error(error.message || "Failed to connect to RingCentral.");
        } finally {
            setIsConnectingRingCentral(false);
        }
    };

    const handleConnectQuickBooks = async () => {
        if (!state.currentOrganization) return;
        setIsConnectingQuickbooks(true);
        try {
            const connectQuickBooks = functions.httpsCallable('connectQuickBooks');
            const result: any = await connectQuickBooks({ orgId: state.currentOrganization.id });
            if (result.data && result.data.authUri) {
                window.location.href = result.data.authUri;
            } else {
                throw new Error("Did not receive Auth URI from Intuit");
            }
        } catch (e: any) {
            console.error("QuickBooks OAuth Error:", e);
            showToast.error("Failed to initiate QuickBooks connection.");
            setIsConnectingQuickbooks(false);
        }
    };

    const handleDisconnectQuickBooks = async () => {
        if (!state.currentOrganization) return;
        if (await globalConfirm("Disconnect QuickBooks Online? Syncing will stop.")) {
            try {
                await db.collection('organizations').doc(state.currentOrganization.id).update(cleanUndefinedFields({ quickbooksConnected: false }));
                setQuickbooksConnected(false);
                dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization, quickbooksConnected: false } });
            } catch (e) { showToast.error("Failed to disconnect."); }
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
        if (file && state.currentOrganization) {
            try {
                const { uploadFileToStorage } = await import('lib/storageService');
                const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'upload.jpg';
                const path = `organizations/${state.currentOrganization.id}/branding/${Date.now()}_${safeName}`;
                const downloadUrl = await uploadFileToStorage(path, file);
                setter(downloadUrl);
            } catch (err) { showToast.error("Upload failed."); }
        }
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && state.currentOrganization) {
            try {
                const { uploadFileToStorage } = await import('lib/storageService');
                const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'document.pdf';
                const path = `organizations/${state.currentOrganization.id}/business_documents/${Date.now()}_${safeName}`;
                const downloadUrl = await uploadFileToStorage(path, file);
                const newDoc = {
                    id: Math.random().toString(36).substring(2, 9),
                    name: file.name || safeName,
                    url: downloadUrl,
                    uploadedAt: new Date().toISOString()
                };
                setBusinessDocuments(prev => [...prev, newDoc]);
                showToast.success("Document uploaded successfully. Remember to commit changes.");
            } catch (err) { showToast.error("Upload failed."); }
        }
    };

    const handleDeleteDocument = (id: string) => {
        setBusinessDocuments(prev => prev.filter(doc => doc.id !== id));
        showToast.success("Document removed. Remember to commit changes.");
    };

    const handleSendTestEmail = async () => {
        if (!email || !smtpHost || !smtpUser || !smtpPass) { showToast.warn("Incomplete SMTP config."); return; }
        setIsSendingTest(true);
        try {
            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: [email],
                replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com',
                message: {
                    subject: `[SMTP TEST] ${orgName}`,
                    html: `<h2>SMTP Connection Successful</h2>`,
                    replyTo: state.currentOrganization?.email || state.currentUser?.email || 'noreply@tektrakker.com'
                },
                status: 'pending',
                organizationId: state.currentOrganization?.id,
                transport: { host: smtpHost, port: Number(smtpPort), secure: Number(smtpPort) === 465, auth: { user: smtpUser, pass: smtpPass }, from: `"${orgName}" <${email}>` }
            }));
            showToast.success("Test message queued!");
        } catch (e) { showToast.error("Failed to queue test."); } finally { setIsSendingTest(false); }
    };

    const handleExportData = (type: 'customers' | 'jobs' | 'inventory', format: 'csv' | 'json') => {
        let data = type === 'customers' ? state.customers : type === 'jobs' ? state.jobs : state.inventory;
        if (data.length === 0) { showToast.info(`No ${type} records to export.`); return; }
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

    const handleResetOverlays = () => {
        localStorage.removeItem('virtual-worker-hidden');
        localStorage.removeItem('virtual-worker-pos');
        localStorage.removeItem('live-support-hidden');
        localStorage.removeItem('live-support-pos');
        showToast.success("UI bubbles reset. Please navigate to another page to see changes.");
    };

    const handleMergeCustomer = async (name: string) => {
        if (!await globalConfirm(`Merge customers named "${name}"?`)) return;
        setIsSaving(true);
        try {
            const targets = state.customers.filter(c => c.name.trim().toLowerCase() === name.toLowerCase());
            if (targets.length <= 1) return;

            // Sort targets to select the best master record:
            // 1. Has userId (active portal user link)
            // 2. Has more service locations, equipment, or files
            // 3. Oldest record (createdAt)
            const sortedTargets = [...targets].sort((a: any, b: any) => {
                const aHasUser = a.userId && a.userId.length > 0 && !a.userId.includes('@');
                const bHasUser = b.userId && b.userId.length > 0 && !b.userId.includes('@');
                if (aHasUser && !bHasUser) return -1;
                if (!aHasUser && bHasUser) return 1;

                const aScore = (a.serviceLocations?.length || 0) + (a.equipment?.length || 0) + (a.files?.length || 0);
                const bScore = (b.serviceLocations?.length || 0) + (b.equipment?.length || 0) + (b.files?.length || 0);
                if (aScore !== bScore) return bScore - aScore;

                const aTime = new Date(a.createdAt || 0).getTime();
                const bTime = new Date(b.createdAt || 0).getTime();
                return aTime - bTime;
            });

            const master = sortedTargets[0];
            const duplicates = sortedTargets.slice(1);
            const duplicateIds = duplicates.map(d => d.id);

            const batch = db.batch();

            // Merge arrays into master
            const mergedEquipment = [...(master.equipment || [])];
            const mergedLocations = [...(master.serviceLocations || [])];
            const mergedFiles = [...(master.files || [])];
            const mergedHistory = [...(master.serviceHistory || [])];

            duplicates.forEach(dup => {
                (dup.equipment || []).forEach(eq => {
                    if (!mergedEquipment.some(e => e.id === eq.id)) mergedEquipment.push(eq);
                });
                (dup.serviceLocations || []).forEach(loc => {
                    if (!mergedLocations.some(l => l.id === loc.id)) mergedLocations.push(loc);
                });
                (dup.files || []).forEach(f => {
                    if (!mergedFiles.some(mf => mf.id === f.id)) mergedFiles.push(f);
                });
                (dup.serviceHistory || []).forEach(h => {
                    mergedHistory.push(h);
                });
            });

            const masterUpdates: any = {
                equipment: mergedEquipment,
                serviceLocations: mergedLocations,
                files: mergedFiles,
                serviceHistory: mergedHistory
            };

            // Pull missing basic fields from duplicates if master lacks them
            if (!master.phone) {
                const firstWithPhone = duplicates.find(d => d.phone);
                if (firstWithPhone) masterUpdates.phone = firstWithPhone.phone;
            }
            if (!master.email) {
                const firstWithEmail = duplicates.find(d => d.email);
                if (firstWithEmail) masterUpdates.email = firstWithEmail.email;
            }

            // Update master in Firestore
            batch.update(db.collection('customers').doc(master.id), cleanUndefinedFields(masterUpdates as any));

            // Delete duplicates
            duplicates.forEach(dup => {
                batch.delete(db.collection('customers').doc(dup.id));
            });

            // Re-link jobs
            const jobsToUpdate = (state.jobs || []).filter(j => duplicateIds.includes(j.customerId));
            jobsToUpdate.forEach(job => {
                batch.update(db.collection('jobs').doc(job.id), cleanUndefinedFields({ customerId: master.id }));
            });

            // Re-link proposals
            const proposalsToUpdate = (state.proposals || []).filter(p => duplicateIds.includes(p.customerId));
            proposalsToUpdate.forEach(prop => {
                batch.update(db.collection('proposals').doc(prop.id), cleanUndefinedFields({ customerId: master.id }));
            });

            // Re-link service agreements
            const agreementsToUpdate = (state.serviceAgreements || []).filter(sa => duplicateIds.includes(sa.customerId));
            agreementsToUpdate.forEach(sa => {
                batch.update(db.collection('serviceAgreements').doc(sa.id), cleanUndefinedFields({ customerId: master.id }));
            });

            await batch.commit();
            setDuplicateResults(prev => prev.filter(p => p.name !== name));
            showToast.success(`Merged duplicates into customer ${master.id}.`);
        } catch (e) {
            console.error("Customer merge failed:", e);
            showToast.error("Merge failed.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFlushCache = async () => { if (await globalConfirm("Clear local storage? You may need to sign in again.")) { localStorage.clear(); showToast.success("Cache cleared."); } };
    const handleCleanupRecords = async () => {
        if (!await globalConfirm("Wipe archived records?")) return;
        setIsSaving(true);
        try {
            const archived = state.users.filter(u => u.status === 'archived');
            const batch = db.batch(); archived.forEach(u => batch.delete(db.collection('users').doc(u.id)));
            await batch.commit(); showToast.success(`Cleaned ${archived.length} records.`);
        } catch (e) { showToast.error("Cleanup error."); } finally { setIsSaving(false); }
    };
    const handleDownloadTemplate = () => {
        const blob = new window.Blob(["Name,Email,Phone,Address,City,State,Zip,Type,Notes\nJohn Doe,john@example.com,555-123-4567,123 Main St,Anytown,TX,78701,Residential,Gate code 1234"], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = "template.csv"; a.click(); window.URL.revokeObjectURL(url);
    };

    const handleModifyBilling = () => setIsBillingHelpOpen(true);
    const copyWidgetCode = (type: 'booking' | 'hiring') => {
        const functionUrl = "https://us-central1-tektrakker.cloudfunctions.net/submitWidgetForm";
        const code = `<script src="${getBaseUrl()}/${type === 'booking' ? 'widget.js' : 'hiring-widget.js'}" data-org-id="${state.currentOrganization?.id}" data-function-url="${functionUrl}"></script>`;
        navigator.clipboard.writeText(code);
        showToast.success(`${type} code copied!`);
    };

    const handleReactivate = async () => {
        if (!state.currentOrganization) return;
        if (await globalConfirm("Are you sure you want to reactivate your subscription?")) {
            setIsSaving(true);
            try {
                await db.collection('organizations').doc(state.currentOrganization.id).update(cleanUndefinedFields({
                    subscriptionStatus: 'active'
                }));
                dispatch({
                    type: 'UPDATE_ORGANIZATION',
                    payload: { ...state.currentOrganization, subscriptionStatus: 'active' }
                });
                showToast.success("Subscription reactivated!");
            } catch (error) {
                console.error(error);
                showToast.error("Failed to reactivate. Please contact support.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    return (
        <div className="space-y-6 pb-24">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start gap-3 max-w-xl">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-xl mt-0.5 animate-pulse">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            {t("Unsaved Changes Warning")}
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {t("You must click")} <strong className="text-amber-600 dark:text-amber-400">{t("Commit All Settings")}</strong> {t("to save any changes made across all tabs. Navigating away or changing tabs without committing will result in loss of changes.")}
                        </p>
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={isSaving || saveStatus !== 'idle'}
                    className={`shadow-xl shadow-amber-500/10 px-10 py-4 font-black uppercase text-xs tracking-widest transition-all duration-300 ring-2 ring-amber-500/50 hover:ring-amber-500 hover:scale-105 active:scale-95 ${
                        saveStatus === 'success' ? '!bg-green-500 hover:!bg-green-600 !text-white ring-0 shadow-green-500/20' :
                        saveStatus === 'error' ? '!bg-red-500 !text-white ring-0 shadow-red-500/20' :
                        '!bg-gradient-to-r !from-amber-500 !to-orange-500 hover:!from-amber-600 hover:!to-orange-600 !text-white animate-pulse'
                    }`}
                >
                    {saveStatus === 'success' ? `✓ ${t('SETTINGS SAVED')}` :
                        saveStatus === 'error' ? t('ERROR SAVING') :
                            isSaving ? t('SAVING...') : t('Commit All Settings')}
                </Button>
            </header>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2 mb-6">
                {[
                    { id: 'profile', label: t('Identity'), icon: Building },
                    { id: 'social', label: t('Social & Reviews'), icon: Globe },
                    { id: 'divisions', label: t('Divisions'), icon: Layers },
                    { id: 'operations', label: t('Operations'), icon: Activity },
                    { id: 'capabilities', label: t('Capabilities'), icon: Wrench },
                    { id: 'subcontractorCompliance', label: t('Subcontractor Compliance'), icon: ShieldCheck },
                    { id: 'dispatchTeams', label: t('Dispatch Teams'), icon: Users },
                    { id: 'legal', label: t('Legal/Docs'), icon: Scale },
                    { id: 'integrations', label: t('Integrations'), icon: CreditCard },
                    { id: 'branding', label: t('Branding'), icon: Palette },
                    { id: 'subscription', label: t('Plan & Billing'), icon: Zap },
                    { id: 'data', label: t('Data Mgmt'), icon: Database },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap rounded-t-xl transition-all ${activeTab === tab.id ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border border-b-0 border-gray-200 dark:border-gray-700 translate-y-[1px]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="animate-fade-in">
                {activeTab === 'profile' && <ProfileTab {...{ orgName, setOrgName, email, setEmail, phone, setPhone, website, setWebsite, notificationEmails, setNotificationEmails, industry, setIndustry, supportedTrades, handleTradeToggle, allIndustries: ALL_INDUSTRIES, taxId, setTaxId, ein, setEin, businessType, setBusinessType, incorporationState, setIncorporationState, formationDate, setFormationDate, businessDocuments, handleDocumentUpload, handleDeleteDocument }} />}
                {activeTab === 'divisions' && <DivisionsTab {...{ divisions, setDivisions, supportedTrades, additionalDivisionsSlots: state.currentOrganization?.additionalDivisionsSlots }} />}
                {activeTab === 'social' && <SocialTab {...{ socialLinks, setSocialLinks, reviewLinks, setReviewLinks }} />}
                {activeTab === 'operations' && <OperationsTab {...{ address: addressStreet, setAddress: setAddressStreet, city, setCity, stateName, setStateName, zip, setZip, taxRate, setTaxRate, licenseNumber, setLicenseNumber, primaryNaics, setPrimaryNaics, ueid, setUeid, cageCode, setCageCode, customPositions, newPosition, setNewPosition, handleAddItem, handleRemoveItem, requiredCerts, newCert, setNewCert, marketMultiplier, setMarketMultiplier, aiPricebookEnabled, setAiPricebookEnabled, virtualWorkerEnabled, setVirtualWorkerEnabled, cardProcessingFeeEnabled, setCardProcessingFeeEnabled, cardProcessingFeePercent, setCardProcessingFeePercent, cardProcessingFeeFlat, setCardProcessingFeeFlat, achProcessingFeeEnabled, setAchProcessingFeeEnabled, achProcessingFeePercent, setAchProcessingFeePercent, achProcessingFeeFlat, setAchProcessingFeeFlat, invoicePrefix, setInvoicePrefix, invoiceStartNumber, setInvoiceStartNumber, proposalPrefix, setProposalPrefix, proposalStartNumber, setProposalStartNumber, allowPartialPayments, setAllowPartialPayments, lateFeeEnabled, setLateFeeEnabled, lateFeeType, setLateFeeType, lateFeeValue, setLateFeeValue, lateFeeInterestRate, setLateFeeInterestRate, lateFeeGracePeriod, setLateFeeGracePeriod, autoSendMonthlyStatements, setAutoSendMonthlyStatements }} />}
                {activeTab === 'capabilities' && <CapabilitiesTab {...{ serviceTypes, setServiceTypes, specializations, setSpecializations }} />}
                {activeTab === 'subcontractorCompliance' && <SubcontractorComplianceTab />}
                {activeTab === 'legal' && <LegalTab {...{ termsAndConditions, setTermsAndConditions, customerTerms, setCustomerTerms, proposalTerms, setProposalTerms, proposalDisclaimer, setProposalDisclaimer, invoiceTerms, setInvoiceTerms, membershipTerms, setMembershipTerms, complianceFooter, setComplianceFooter, warrantyDisclaimer, setWarrantyDisclaimer, defaultWorkmanshipMonths, setDefaultWorkmanshipMonths, defaultPartsMonths, setDefaultPartsMonths, proposalProtectionMode, setProposalProtectionMode, proposalNdaContent, setProposalNdaContent }} />}
                {activeTab === 'integrations' && <IntegrationsTab {...{ stripePublicKey, setStripePublicKey, squareAppId, setSquareAppId, squareLocId, setSquareLocId, squareToken, setSquareToken, kortAccountId, setKortAccountId, defaultPaymentGateway, setDefaultPaymentGateway, smtpHost, setSmtpHost, smtpPort, setSmtpPort, smtpUser, setSmtpUser, smtpPass, setSmtpPass, handleSendTestEmail, isSendingTest, twilioSid, setTwilioSid, twilioToken, setTwilioToken, twilioNumber, setTwilioNumber, bookingWidgetMode, setBookingWidgetMode, hiringWidgetMode, setHiringWidgetMode, copyWidgetCode, measureQuickApiKey, setMeasureQuickApiKey, seamApiKey, setSeamApiKey, nestProjectId, setNestProjectId, nestClientId, setNestClientId, nestClientSecret, setNestClientSecret, ecobeeApiKey, setEcobeeApiKey, honeywellApiKey, setHoneywellApiKey, honeywellClientSecret, setHoneywellClientSecret, samsaraApiKey, setSamsaraApiKey, greenSkyMerchantId, setGreenSkyMerchantId, greenSkyApiPw, setGreenSkyApiPw, goodLeapApiKey, setGoodLeapApiKey, checkrApiKey, setCheckrApiKey, ringCentralClientId, setRingCentralClientId, rcBackendClientId, setRcBackendClientId, ringCentralClientSecret, setRingCentralClientSecret, ringCentralJwtToken, setRingCentralJwtToken, ringCentralLoginFlow, setRingCentralLoginFlow, ringCentralCallMode, setRingCentralCallMode, rcPrimarySms, setRcPrimarySms, rcEnableVoiceAi, setRcEnableVoiceAi, rcRingsBeforeAi, setRcRingsBeforeAi, rcSmsOnMissed, setRcSmsOnMissed, rcSmsTemplate, setRcSmsTemplate, rcMappings, setRcMappings, openWeatherApiKey, setOpenWeatherApiKey, shovelsApiKey, setShovelsApiKey, shovelsUsageCount, quickbooksConnected, handleConnectQuickBooks, handleDisconnectQuickBooks, isConnectingQuickbooks, handleConnectRingCentral, isConnectingRingCentral, webhookSecretKey, setWebhookSecretKey, punchoutConfigs, setPunchoutConfigs, orgId: state.currentOrganization?.id || '' }} />}
                {activeTab === 'branding' && <BrandingTab {...{ brandingColor, setBrandingColor, financingLink, setFinancingLink, logoUrl, setLogoUrl, publicLogoUrl, setPublicLogoUrl, letterheadUrl, setLetterheadUrl, footerImageUrl, setFooterImageUrl, bannerUrl, setBannerUrl, handleFileUpload, publicProfileEnabled, setPublicProfileEnabled, publicDescription, setPublicDescription, publicCredentials, setPublicCredentials, publicServices, setPublicServices, acceptsSubcontracting, setAcceptsSubcontracting }} />}
                {activeTab === 'dispatchTeams' && <DispatchTeamsTab />}
                {activeTab === 'subscription' && <SubscriptionTab {...{ billingDetails, handleModifyBilling, handleReactivate }} />}
                {activeTab === 'data' && <DataTab {...{ handleExportData, handleDetectDuplicates, handleCleanupRecords, handleFlushCache, handleResetOverlays, handleImportFile: (e) => { e.target.value = ''; showToast.info('Bulk import is currently disabled. Contact support to migrate data.'); }, handleDownloadTemplate }} />}
            </div>

            <Modal isOpen={isBillingHelpOpen} onClose={() => setIsBillingHelpOpen(false)} title="Upgrade Your Plan">
                {(() => {
                    const org = state.currentOrganization;
                    const currentPlan = org?.plan || 'starter';
                    const ps = state.platformSettings?.plans;
                    const featureLabels: Record<string, string> = {
                        publicBooking: 'Online Booking', proposals: 'Proposals', paymentProcessing: 'Payment Processing',
                        timeTracking: 'Time Tracking', inventory: 'Inventory', salesCrm: 'Sales CRM',
                        hrDocuments: 'HR & Docs', careerPage: 'Recruiting', ai: 'AI Features',
                        quickbooks: 'QuickBooks', subcontractors: 'Subcontractors', '1099': '1099 Tax',
                        api: 'API Access', branding: 'Custom Branding',
                        whiteboard: 'Collaborative Whiteboard',
                        customizations: 'Layout Customizations',
                        technicianTools: 'Custom Technician Tools'
                    };
                    const planOptions: { key: 'payments_only' | 'starter' | 'growth' | 'enterprise'; label: string; price: number; annual: number; users: number; features: string[]; ribbon: string }[] = [
                        { key: 'payments_only', label: 'Payments Only', price: ps?.payments_only?.monthly ?? 10, annual: ps?.payments_only?.annual ?? 199, users: ps?.payments_only?.unlimitedUsers ? 999999 : (ps?.payments_only?.maxUsers ?? 1), features: ps?.payments_only?.features || [], ribbon: ps?.payments_only?.ribbonText || '' },
                        { key: 'starter', label: 'Starter', price: ps?.starter?.monthly ?? 99, annual: ps?.starter?.annual ?? 999, users: ps?.starter?.maxUsers ?? 3, features: ps?.starter?.features || [], ribbon: ps?.starter?.ribbonText || '' },
                        { key: 'growth', label: 'Growth', price: ps?.growth?.monthly ?? 249, annual: ps?.growth?.annual ?? 2499, users: ps?.growth?.maxUsers ?? 10, features: ps?.growth?.features || [], ribbon: ps?.growth?.ribbonText || '' },
                        { key: 'enterprise', label: 'Enterprise', price: ps?.enterprise?.monthly ?? 499, annual: ps?.enterprise?.annual ?? 4999, users: ps?.enterprise?.maxUsers ?? 50, features: ps?.enterprise?.features || [], ribbon: ps?.enterprise?.ribbonText || '' },
                    ];
                    const currentPrice = planOptions.find(p => p.key === currentPlan)?.price || 99;
                    const userFee = state.platformSettings?.excessUserFee ?? 25;

                    // Proration: calculate remaining days in billing cycle
                    const expiryDate = org?.subscriptionExpiryDate ? new Date(org.subscriptionExpiryDate) : null;
                    const today = new Date();
                    const daysRemaining = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : 0;
                    const cycleDays = 30; // Standard monthly cycle
                    const prorationFraction = daysRemaining > 0 ? Math.min(daysRemaining / cycleDays, 1) : 0;

                    return (
                        <div className="space-y-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                You are currently on the <strong className="text-slate-800 dark:text-white capitalize">{currentPlan.replace('_', ' ')}</strong> plan at <strong>${currentPrice}/mo</strong>.
                                {daysRemaining > 0 && <> You have <strong>{daysRemaining} days</strong> remaining in your current billing cycle.</>}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {planOptions.map(plan => {
                                    const isCurrent = plan.key === currentPlan;
                                    const isUpgrade = plan.price > currentPrice;
                                    const isDowngrade = plan.price < currentPrice;
                                    const priceDiff = plan.price - currentPrice;
                                    const proratedCharge = isUpgrade ? Math.max(0, priceDiff * prorationFraction) : 0;
                                    const proratedCredit = isDowngrade ? Math.abs(priceDiff * prorationFraction) : 0;

                                    return (
                                        <button
                                            key={plan.key}
                                            type="button"
                                            disabled={isCurrent}
                                            onClick={async () => {
                                                if (!org) return;
                                                const action = isUpgrade ? 'upgrade' : 'switch';
                                                const chargeMsg = isUpgrade && proratedCharge > 0
                                                    ? `\n\nProrated charge for remaining ${daysRemaining} days: $${proratedCharge.toFixed(2)}`
                                                    : isDowngrade && proratedCredit > 0
                                                    ? `\n\nProrated credit for remaining ${daysRemaining} days: $${proratedCredit.toFixed(2)} (applied to next cycle)`
                                                    : '';
                                                const confirmed = window.confirm(
                                                    `${action === 'upgrade' ? 'Upgrade' : 'Switch'} to ${plan.label} plan at $${plan.price}/mo?${chargeMsg}\n\nYour new rate will apply starting now.`
                                                );
                                                if (!confirmed) return;
                                                try {
                                                    const newExpiry = new Date();
                                                    newExpiry.setDate(newExpiry.getDate() + 30);
                                                    await db.collection('organizations').doc(org.id).update(cleanUndefinedFields({
                                                        plan: plan.key,
                                                        subscriptionStatus: 'active',
                                                        subscriptionExpiryDate: newExpiry.toISOString().split('T')[0],
                                                        lastPlanChange: new Date().toISOString(),
                                                        previousPlan: currentPlan,
                                                        proratedChargeApplied: isUpgrade ? proratedCharge : 0,
                                                        proratedCreditApplied: isDowngrade ? proratedCredit : 0,
                                                    }));
                                                    dispatch({
                                                        type: 'UPDATE_ORGANIZATION',
                                                        payload: {
                                                            ...org,
                                                            plan: plan.key,
                                                            subscriptionStatus: 'active',
                                                            subscriptionExpiryDate: newExpiry.toISOString().split('T')[0],
                                                        }
                                                    });
                                                    showToast.success(`Successfully ${action === 'upgrade' ? 'upgraded' : 'switched'} to ${plan.label}!`);
                                                    setIsBillingHelpOpen(false);
                                                } catch (err) {
                                                    console.error('Plan change failed:', err);
                                                    showToast.error('Failed to update plan. Please try again.');
                                                }
                                            }}
                                            className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200
                                                ${isCurrent 
                                                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600 cursor-default opacity-80' 
                                                    : isUpgrade 
                                                        ? 'border-blue-200 dark:border-blue-800 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 bg-white dark:bg-slate-800 cursor-pointer' 
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-800 cursor-pointer'
                                                }`}
                                        >
                                            {plan.ribbon && (
                                                <span className="absolute -top-2 left-3 text-[8px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-full shadow">{plan.ribbon}</span>
                                            )}
                                            {isCurrent && (
                                                <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5 rounded">Current</span>
                                            )}
                                            {isUpgrade && !isCurrent && (
                                                <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest bg-blue-500 text-white px-2 py-0.5 rounded">Upgrade</span>
                                            )}
                                            <h4 className="font-black text-sm text-slate-800 dark:text-white">{plan.label}</h4>
                                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">${plan.price}<span className="text-xs font-medium text-slate-400">/mo</span></p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{plan.annual > 0 && <>${plan.annual}/yr · </>}{plan.users >= 999999 ? 'Unlimited' : `Up to ${plan.users}`} users</p>
                                            {plan.features.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {plan.features.slice(0, 5).map(f => (
                                                        <span key={f} className="text-[8px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium">{featureLabels[f] || f}</span>
                                                    ))}
                                                    {plan.features.length > 5 && <span className="text-[8px] text-slate-400">+{plan.features.length - 5} more</span>}
                                                </div>
                                            )}
                                            {userFee > 0 && plan.key !== 'payments_only' && (
                                                <p className="text-[9px] text-slate-400 mt-1">+${userFee}/mo per extra user</p>
                                            )}
                                            {isUpgrade && !isCurrent && proratedCharge > 0 && (
                                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                                                    Prorated today: +${proratedCharge.toFixed(2)}
                                                </p>
                                            )}
                                            {isDowngrade && !isCurrent && proratedCredit > 0 && (
                                                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                                                    Credit applied: -${proratedCredit.toFixed(2)}
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 text-center pt-2">
                                Plan changes take effect immediately. Upgrades are prorated for the remaining billing cycle. Downgrades credit the difference to your next invoice.
                            </p>
                        </div>
                    );
                })()}
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
