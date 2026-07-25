import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState } from 'react';
import type { User } from 'types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';
import { db } from '../../lib/firebase';
import showToast from '../../lib/toast';
import { ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

interface SubcontractorAgreementsGateProps {
    user: User;
    children: React.ReactNode;
}

const NDA_CONTENT = `NON-DISCLOSURE AGREEMENT (NDA)

1. Purpose and Scope
This Non-Disclosure Agreement ("Agreement") is entered into by and between the Hiring Organization ("Company") and the undersigned Subcontractor. The Subcontractor agrees that during their contract engagement, they will have access to proprietary, technical, operational, and customer information.

2. Confidential Information
Confidential Information includes, but is not limited to, customer contact details, customer service history, pricing schemas, engineering schematics, trade secrets, software designs, business strategy, and internal employee directories.

3. Restrictive Obligations
The Subcontractor agrees:
a) To hold all Confidential Information in the strictest confidence and not disclose it to any third party.
b) Not to copy, distribute, or duplicate any proprietary workflows or customer directories.
c) Not to use the Hiring Organization's customer list for direct marketing or personal enrichment.
d) To return or delete all digital copies of customer records immediately upon completion of assigned jobs.

4. Duration of Obligation
Confidentiality obligations under this Agreement shall survive the termination of the Subcontractor's association with the Hiring Organization and remain in effect indefinitely.`;

const NON_COMPETE_CONTENT = `NON-COMPETE & NON-SOLICITATION AGREEMENT

1. Protective Covenant
This Non-Compete & Non-Solicitation Agreement ("Agreement") is established to safeguard the legitimate business interests and goodwill of the Hiring Organization ("Company").

2. Restrictive Covenants
The Subcontractor agrees that during their contract engagement and for a period of one (1) year following the date on which their slot, contract, or access is revoked:
a) They shall not directly or indirectly solicit, contract with, perform services for, or accept payments from any client, customer, or property owner to whom they were dispatched by the Company.
b) They shall not bypass the Company to offer direct pricing or services to any customer obtained via Company dispatches.
c) They shall not encourage or entice other employees or contractors of the Company to leave their roles.

3. Remedy for Breach
The Subcontractor acknowledges that any breach of these covenants will cause irreparable harm to the Company, entitling the Company to seek immediate injunctive relief in addition to monetary damages and legal fees.`;

const SubcontractorAgreementsGate: React.FC<SubcontractorAgreementsGateProps> = ({ user, children }) => {
    const { dispatch } = useAppContext();
    const [signatureName, setSignatureName] = useState('');
    const [ndaAgreed, setNdaAgreed] = useState(false);
    const [nonCompeteAgreed, setNonCompeteAgreed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isSubcontractor = user && user.role === 'Subcontractor';
    const hasSigned = user && (user as any).signedAgreements === true;

    // If not a subcontractor or already signed, proceed
    if (!isSubcontractor || hasSigned) {
        return <>{children}</>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!ndaAgreed || !nonCompeteAgreed) {
            showToast.error("You must agree to both the NDA and Non-Compete agreements to proceed.");
            return;
        }

        const trimmedSig = signatureName.trim();
        const expectedName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();

        if (!trimmedSig) {
            showToast.error("Please enter your full legal name to sign the agreements.");
            return;
        }

        // Allow loose matches, but enforce input matching first/last names
        if (expectedName && !trimmedSig.toLowerCase().includes(user.firstName?.toLowerCase() || '')) {
            showToast.warn(`Signature should match your registered name: ${user.firstName || ''} ${user.lastName || ''}`);
        }

        try {
            setIsSubmitting(true);

            const timestamp = new Date().toISOString();
            const docId = `sub-agreement-${user.id || user.email}-${Date.now()}`;

            // 1. Create a permanent agreement document in the organization's documents collection.
            // This ensures data retention even if the user slot is revoked.
            const agreementDoc = {
                id: docId,
                organizationId: user.organizationId || 'unaffiliated',
                subcontractorId: user.id || user.email,
                subcontractorName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                subcontractorEmail: user.email,
                title: 'Signed Subcontractor Onboarding Agreements',
                type: 'Agreement',
                createdAt: timestamp,
                signedAt: timestamp,
                signatureText: trimmedSig,
                ndaText: NDA_CONTENT,
                nonCompeteText: NON_COMPETE_CONTENT
            };

            try {
                console.log("SubcontractorAgreementsGate: Writing to documents collection:", docId, agreementDoc);
                await db.collection('documents').doc(docId).set(cleanUndefinedFields(agreementDoc));
                console.log("SubcontractorAgreementsGate: Successfully wrote to documents collection");
            } catch (docErr: any) {
                console.error("SubcontractorAgreementsGate: Documents collection write failed:", docErr);
                throw new Error("Failed to write to documents: " + docErr.message);
            }

            try {
                console.log("SubcontractorAgreementsGate: Updating user document:", user.id);
                const updateFields = {
                    signedAgreements: true,
                    signedAgreementsAt: timestamp,
                    signedAgreementsSignature: trimmedSig
                };
                await db.collection('users').doc(user.id).update(cleanUndefinedFields(updateFields));
                console.log("SubcontractorAgreementsGate: Successfully updated user document");
                dispatch({
                    type: 'SET_CURRENT_USER',
                    payload: {
                        ...user,
                        ...updateFields
                    }
                });
            } catch (userErr: any) {
                console.error("SubcontractorAgreementsGate: User document update failed:", userErr);
                throw new Error("Failed to update user profile: " + userErr.message);
            }

            showToast.success("Agreements signed successfully! Welcome to the team.");
        } catch (error: any) {
            console.error("Failed to submit agreements:", error);
            showToast.error("Failed to register signed agreements: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden my-8">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-6 text-white flex items-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-indigo-200" />
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Onboarding Compliance Required</h2>
                        <p className="text-xs text-indigo-100 font-medium">Please review and sign the required subcontractor agreements.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                    {/* NDA Box */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            1. Non-Disclosure Agreement
                        </label>
                        <div className="h-44 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-medium font-mono text-slate-650 dark:text-slate-400 whitespace-pre-line leading-relaxed shadow-inner">
                            {NDA_CONTENT}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                            <input 
                                type="checkbox" 
                                checked={ndaAgreed} 
                                onChange={(e) => setNdaAgreed(e.target.checked)} 
                                className="w-4 h-4 rounded text-indigo-600 border-slate-350 focus:ring-indigo-500"
                            />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">I have read, understood, and agree to the Non-Disclosure Agreement.</span>
                        </label>
                    </div>

                    {/* Non Compete Box */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            2. Non-Compete & Non-Solicitation Agreement
                        </label>
                        <div className="h-44 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-medium font-mono text-slate-650 dark:text-slate-400 whitespace-pre-line leading-relaxed shadow-inner">
                            {NON_COMPETE_CONTENT}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                            <input 
                                type="checkbox" 
                                checked={nonCompeteAgreed} 
                                onChange={(e) => setNonCompeteAgreed(e.target.checked)} 
                                className="w-4 h-4 rounded text-indigo-600 border-slate-350 focus:ring-indigo-500"
                            />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">I have read, understood, and agree to the Non-Compete Agreement.</span>
                        </label>
                    </div>

                    {/* Signature Input */}
                    <div className="border-t border-slate-100 dark:border-slate-700/50 pt-4">
                        <Input 
                            label="E-Signature (Type Full Legal Name)"
                            placeholder={`${user.firstName || ''} ${user.lastName || ''}`}
                            value={signatureName}
                            onChange={(e) => setSignatureName(e.target.value)}
                            required
                        />
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium italic mt-1">
                            By typing your name above and clicking submit, you acknowledge that you are electronically signing these legally binding documents.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <Button 
                        type="submit" 
                        variant="primary" 
                        size="lg"
                        className="w-full text-sm font-black flex items-center justify-center gap-2 mt-2 h-12 shadow-lg"
                        disabled={isSubmitting || !ndaAgreed || !nonCompeteAgreed}
                    >
                        {isSubmitting ? (
                            <>
                                <Spinner size="sm" />
                                Processing Compliance Signature...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                Execute Agreements & Enter Dashboard
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default SubcontractorAgreementsGate;
