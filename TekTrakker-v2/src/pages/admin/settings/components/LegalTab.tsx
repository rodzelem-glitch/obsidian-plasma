
import React from 'react';
import Card from 'components/ui/Card';
import Textarea from 'components/ui/Textarea';
import { Scale } from 'lucide-react';

interface LegalTabProps {
    termsAndConditions: string;
    setTermsAndConditions: (val: string) => void;
    proposalDisclaimer: string;
    setProposalDisclaimer: (val: string) => void;
    invoiceTerms: string;
    setInvoiceTerms: (val: string) => void;
    membershipTerms: string;
    setMembershipTerms: (val: string) => void;
    complianceFooter: string;
    setComplianceFooter: (val: string) => void;
    warrantyDisclaimer?: string;
    setWarrantyDisclaimer?: (val: string) => void;
    defaultWorkmanshipMonths?: number;
    setDefaultWorkmanshipMonths?: (val: number) => void;
    defaultPartsMonths?: number;
    setDefaultPartsMonths?: (val: number) => void;
}

const LegalTab: React.FC<LegalTabProps> = ({
    termsAndConditions, setTermsAndConditions,
    proposalDisclaimer, setProposalDisclaimer,
    invoiceTerms, setInvoiceTerms,
    membershipTerms, setMembershipTerms,
    complianceFooter, setComplianceFooter,
    warrantyDisclaimer = '', setWarrantyDisclaimer,
    defaultWorkmanshipMonths = 12, setDefaultWorkmanshipMonths,
    defaultPartsMonths = 12, setDefaultPartsMonths,
}) => {
    return (
        <Card>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300"><Scale size={20}/> Legal Documents &amp; Disclaimers</h3>
            <div className="space-y-4">
                <Textarea label="Terms &amp; Conditions (General)" value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} rows={6} placeholder="Standard terms for all services..." />
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
