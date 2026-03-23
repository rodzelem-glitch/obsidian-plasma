
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
}

const LegalTab: React.FC<LegalTabProps> = ({
    termsAndConditions, setTermsAndConditions,
    proposalDisclaimer, setProposalDisclaimer,
    invoiceTerms, setInvoiceTerms,
    membershipTerms, setMembershipTerms,
    complianceFooter, setComplianceFooter
}) => {
    return (
        <Card>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-300"><Scale size={20}/> Legal Documents & Disclaimers</h3>
            <div className="space-y-4">
                <Textarea label="Terms & Conditions (General)" value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} rows={6} placeholder="Standard terms for all services..." />
                <Textarea label="Proposal Disclaimer" value={proposalDisclaimer} onChange={e => setProposalDisclaimer(e.target.value)} rows={4} placeholder="Estimates are valid for 30 days..." />
                <Textarea label="Invoice Terms" value={invoiceTerms} onChange={e => setInvoiceTerms(e.target.value)} rows={4} placeholder="Payment due upon receipt..." />
                <Textarea label="Membership Terms" value={membershipTerms} onChange={e => setMembershipTerms(e.target.value)} rows={4} placeholder="Terms for recurring service plans..." />
                <Textarea label="Compliance Footer (Email/PDF)" value={complianceFooter} onChange={e => setComplianceFooter(e.target.value)} rows={2} placeholder="License info displayed on all documents..." />
            </div>
        </Card>
    );
};

export default LegalTab;
