
import React from 'react';
import Card from 'components/ui/Card';
import Textarea from 'components/ui/Textarea';
import { Scale, Shield, ShieldCheck } from 'lucide-react';
import SiteSealEmbed from 'components/payment/SiteSealEmbed';

interface LegalTabProps {
    termsAndConditions: string;
    setTermsAndConditions: (val: string) => void;
    customerTerms: string;
    setCustomerTerms: (val: string) => void;
    proposalTerms: string;
    setProposalTerms: (val: string) => void;
    pricingDisclaimer?: string;
    setPricingDisclaimer?: (val: string) => void;
    proposalDisclaimer: string;
    setProposalDisclaimer: (val: string) => void;
    invoiceTerms: string;
    setInvoiceTerms: (val: string) => void;
    membershipTerms: string;
    setMembershipTerms: (val: string) => void;
    complianceFooter: string;
    setComplianceFooter: (val: string) => void;
    pciComplianceSealHtml?: string;
    setPciComplianceSealHtml?: (val: string) => void;
    proposalProtectionMode: 'none' | 'summary' | 'nda';
    setProposalProtectionMode: (val: 'none' | 'summary' | 'nda') => void;
    proposalNdaContent: string;
    setProposalNdaContent: (val: string) => void;
    warrantyDisclaimer?: string;
    setWarrantyDisclaimer?: (val: string) => void;
    defaultWorkmanshipMonths?: number;
    setDefaultWorkmanshipMonths?: (val: number) => void;
    defaultPartsMonths?: number;
    setDefaultPartsMonths?: (val: number) => void;
}

const LegalTab: React.FC<LegalTabProps> = ({
    termsAndConditions, setTermsAndConditions,
    customerTerms, setCustomerTerms,
    proposalTerms, setProposalTerms,
    pricingDisclaimer = '', setPricingDisclaimer,
    proposalDisclaimer, setProposalDisclaimer,
    invoiceTerms, setInvoiceTerms,
    membershipTerms, setMembershipTerms,
    complianceFooter, setComplianceFooter,
    pciComplianceSealHtml = '', setPciComplianceSealHtml,
    proposalProtectionMode, setProposalProtectionMode,
    proposalNdaContent, setProposalNdaContent,
    warrantyDisclaimer = '', setWarrantyDisclaimer,
    defaultWorkmanshipMonths = 12, setDefaultWorkmanshipMonths,
    defaultPartsMonths = 12, setDefaultPartsMonths,
}) => {
    return (
        <Card>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300"><Scale size={20}/> Legal Documents &amp; Disclaimers</h3>
            <div className="space-y-4">
                <Textarea label="Terms &amp; Conditions (General)" value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} rows={6} placeholder="Standard terms for all services..." />
                <Textarea label="Customer Terms of Agreement" value={customerTerms} onChange={e => setCustomerTerms(e.target.value)} rows={6} placeholder="Terms that new customers must agree to upon first login..." />
                <Textarea label="Proposal Terms of Agreement" value={proposalTerms} onChange={e => setProposalTerms(e.target.value)} rows={6} placeholder="Terms that customers must agree to before viewing proposals..." />

                {/* PROPOSAL SECURITY CONTROLS */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/50 mt-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-350">
                        <Shield className="text-primary-600 dark:text-primary-400" size={18} />
                        <span>Proposal Theft &amp; Bid Shopping Protections</span>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Proposal Protection Mode</label>
                        <select
                            value={proposalProtectionMode}
                            onChange={e => setProposalProtectionMode(e.target.value as any)}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                        >
                            <option value="none">None (Standard Open Proposal)</option>
                            <option value="summary">Summary Price Only (Hide detailed line item pricing until accepted)</option>
                            <option value="nda">NDA/Confidentiality Gate (Force signed agreement before viewing details)</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                            {proposalProtectionMode === 'none' && "No restriction. Customers can see all itemized parts, labor and crane costs immediately."}
                            {proposalProtectionMode === 'summary' && "Clients see total price and summary description. Line-item lists are locked/hidden until proposal is accepted."}
                            {proposalProtectionMode === 'nda' && "Clients must digitally sign a confidentiality NDA (with device security tracking) before viewing proposal contents."}
                        </p>
                    </div>

                    {proposalProtectionMode === 'nda' && (
                        <Textarea
                            label="Confidentiality NDA Legal Agreement Text"
                            value={proposalNdaContent}
                            onChange={e => setProposalNdaContent(e.target.value)}
                            rows={8}
                            placeholder="Leave blank to use the professional, legal-grade default Mutual NDA..."
                        />
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            Pricing &amp; Estimate Disclaimer (Applied to All Customer Proposals &amp; Bids)
                        </label>
                    </div>
                    <Textarea 
                        value={pricingDisclaimer || proposalDisclaimer} 
                        onChange={e => {
                            setPricingDisclaimer?.(e.target.value);
                            setProposalDisclaimer(e.target.value);
                        }} 
                        rows={4} 
                        placeholder="e.g. Quoted installation price is based on a standard installation and includes only the equipment and scope specifically listed in this proposal..." 
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center">Quick Insert:</span>
                        <button
                            type="button"
                            onClick={() => {
                                const val = "Quoted installation price is based on a standard installation and includes only the equipment and scope specifically listed in this proposal. Price does not include additional refrigerant, copper line set or additional copper piping, ductwork modifications or replacement, electrical upgrades, drain modifications, structural repairs, code-required upgrades, or other unforeseen materials or labor unless specifically stated. If additional work or materials are found to be necessary during installation, TekAir Inc. will notify the customer and obtain approval for any additional charges before proceeding whenever reasonably possible.";
                                setPricingDisclaimer?.(val);
                                setProposalDisclaimer(val);
                            }}
                            className="text-[10px] bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/60 text-primary-700 dark:text-primary-300 font-bold px-2.5 py-1 rounded-lg border border-primary-200 dark:border-primary-800 cursor-pointer transition-all"
                        >
                            + Standard Installation Scope &amp; Unforeseen Conditions (TekAir)
                        </button>
                    </div>
                </div>
                <Textarea label="Invoice Terms" value={invoiceTerms} onChange={e => setInvoiceTerms(e.target.value)} rows={4} placeholder="Payment due upon receipt..." />
                <Textarea label="Membership Terms" value={membershipTerms} onChange={e => setMembershipTerms(e.target.value)} rows={4} placeholder="Terms for recurring service plans..." />
                <Textarea label="Compliance Footer (Email/PDF)" value={complianceFooter} onChange={e => setComplianceFooter(e.target.value)} rows={2} placeholder="License info displayed on all documents..." />

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300">
                        <ShieldCheck className="text-emerald-500" size={18} />
                        <span>PCI DSS Compliance &amp; Security Site Seal</span>
                    </div>
                    <Textarea 
                        label="Site Seal Script or HTML Snippet" 
                        value={pciComplianceSealHtml} 
                        onChange={e => setPciComplianceSealHtml?.(e.target.value)} 
                        rows={3} 
                        placeholder="<script type='text/javascript' src='https://rapidscansecure.com/siteseal/siteseal.js?code=...'></script>" 
                    />
                    <p className="text-[10px] text-slate-400">
                        Paste the snippet provided by your PCI Compliance scanning vendor. This displays the verified security badge across all customer checkout portals.
                    </p>
                    {pciComplianceSealHtml && (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex justify-center">
                            <SiteSealEmbed sealHtml={pciComplianceSealHtml} />
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">🛡️ Warranty Coverage Settings</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Default Workmanship Warranty (months)</label>
                            <input
                                type="number"
                                min={0}
                                value={defaultWorkmanshipMonths}
                                onChange={e => setDefaultWorkmanshipMonths?.(parseInt(e.target.value) || 0)}
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Default Parts Warranty (months)</label>
                            <input
                                type="number"
                                min={0}
                                value={defaultPartsMonths}
                                onChange={e => setDefaultPartsMonths?.(parseInt(e.target.value) || 0)}
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                            />
                        </div>
                    </div>
                    <Textarea
                        label="Warranty Disclaimer (Customer must agree before warranty activates)"
                        value={warrantyDisclaimer}
                        onChange={e => setWarrantyDisclaimer?.(e.target.value)}
                        rows={5}
                        placeholder="This warranty covers defects in workmanship for the period stated. It does not cover damage caused by misuse, neglect, or unauthorized modifications. Parts warranty is subject to manufacturer terms..."
                    />
                </div>
            </div>
        </Card>
    );
};

export default LegalTab;
