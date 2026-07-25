
import React from 'react';
import Card from 'components/ui/Card';
import Textarea from 'components/ui/Textarea';
import { Scale, Shield } from 'lucide-react';

interface LegalTabProps {
    termsAndConditions: string;
    setTermsAndConditions: (val: string) => void;
    customerTerms: string;
    setCustomerTerms: (val: string) => void;
    proposalTerms: string;
    setProposalTerms: (val: string) => void;
    proposalDisclaimer: string;
    setProposalDisclaimer: (val: string) => void;
    invoiceTerms: string;
    setInvoiceTerms: (val: string) => void;
    membershipTerms: string;
    setMembershipTerms: (val: string) => void;
    complianceFooter: string;
    setComplianceFooter: (val: string) => void;
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
    proposalDisclaimer, setProposalDisclaimer,
    invoiceTerms, setInvoiceTerms,
    membershipTerms, setMembershipTerms,
    complianceFooter, setComplianceFooter,
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

                <Textarea label="Proposal Disclaimer" value={proposalDisclaimer} onChange={e => setProposalDisclaimer(e.target.value)} rows={4} placeholder="Estimates are valid for 30 days..." />
                <Textarea label="Invoice Terms" value={invoiceTerms} onChange={e => setInvoiceTerms(e.target.value)} rows={4} placeholder="Payment due upon receipt..." />
                <Textarea label="Membership Terms" value={membershipTerms} onChange={e => setMembershipTerms(e.target.value)} rows={4} placeholder="Terms for recurring service plans..." />
                <Textarea label="Compliance Footer (Email/PDF)" value={complianceFooter} onChange={e => setComplianceFooter(e.target.value)} rows={2} placeholder="License info displayed on all documents..." />

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
