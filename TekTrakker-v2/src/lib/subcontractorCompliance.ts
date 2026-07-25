import type { SubcontractorComplianceSettings, SubcontractorComplianceDoc, SubcontractorContract, Subcontractor, User } from '../types';

export interface ComplianceDocDefinition {
    key: string;
    label: string;
    category: 'tax' | 'identity' | 'insurance' | 'bond' | 'credentials' | 'agreement';
    description: string;
    defaultRequired: boolean;
    badgeColor: string;
}

export const ALL_COMPLIANCE_DOCUMENTS: ComplianceDocDefinition[] = [
    {
        key: 'w9',
        label: 'Form W-9 (US 1099 Tax ID)',
        category: 'tax',
        description: 'Required for US independent contractors to capture SSN/EIN for annual 1099-NEC tax filing.',
        defaultRequired: true,
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    },
    {
        key: 'w8ben',
        label: 'Form W-8BEN / W-8BEN-E',
        category: 'tax',
        description: 'Certificate of Foreign Status for non-US individual or corporate subcontractors.',
        defaultRequired: false,
        badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    },
    {
        key: 'i9',
        label: 'Form I-9 Work Authorization',
        category: 'tax',
        description: 'Employment Eligibility Verification (Standard for W-2 staff & internal site clearance).',
        defaultRequired: false,
        badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    },
    {
        key: 'professional_license',
        label: 'Copy of Professional / Trade License',
        category: 'identity',
        description: 'Active state/city trade license (Electrical, Plumbing, HVAC, General Contractor).',
        defaultRequired: true,
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    },
    {
        key: 'drivers_license',
        label: 'Copy of Driver\'s License / Photo ID',
        category: 'identity',
        description: 'Valid state driver\'s license or official government photo ID card.',
        defaultRequired: true,
        badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
    },
    {
        key: 'business_insurance',
        label: 'Business Insurance Certificate',
        category: 'insurance',
        description: 'Active General Liability, Commercial Auto, and Workers\' Compensation policy certificate.',
        defaultRequired: true,
        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
    },
    {
        key: 'additional_insured_coi',
        label: 'Contractor Listed as Additional Insured (COI)',
        category: 'insurance',
        description: 'Certificate of Insurance with endorsement naming Contractor organization as Additional Insured.',
        defaultRequired: true,
        badgeColor: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400'
    },
    {
        key: 'surety_bonds',
        label: 'Surety / Performance Bonds',
        category: 'bond',
        description: 'Active surety bond, license bond, or performance guarantee bond documentation.',
        defaultRequired: false,
        badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'
    },
    {
        key: 'business_references',
        label: 'Business References',
        category: 'credentials',
        description: 'List of past general contractor or commercial client reference contacts.',
        defaultRequired: false,
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400'
    },
    {
        key: 'safety_cert',
        label: 'Safety & Regulatory Certifications',
        category: 'credentials',
        description: 'OSHA 10/30 card, EPA Section 608 Universal, Lead-Safe RRP, or First Aid certs.',
        defaultRequired: false,
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
    },
    {
        key: 'signed_agreement',
        label: 'Signed Subcontractor Master Agreement',
        category: 'agreement',
        description: 'Executed Subcontractor Master Service Agreement, NDA, or Non-Compete Contract.',
        defaultRequired: true,
        badgeColor: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400'
    },
    {
        key: 'direct_deposit',
        label: 'Direct Deposit / Banking Voided Check',
        category: 'agreement',
        description: 'Direct deposit authorization form or voided check for electronic payouts.',
        defaultRequired: false,
        badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    }
];

export const getDefaultComplianceSettings = (): SubcontractorComplianceSettings => {
    const requiredDocuments: Record<string, boolean> = {};
    ALL_COMPLIANCE_DOCUMENTS.forEach(doc => {
        requiredDocuments[doc.key] = doc.defaultRequired;
    });
    return {
        enforceComplianceBeforeAssignment: true,
        notifyOnLink: true,
        expiryWarningDays: 30,
        requiredDocuments
    };
};

export interface ComplianceCheckResult {
    isCompliant: boolean;
    missingDocKeys: string[];
    missingDocLabels: string[];
    pendingDocLabels: string[];
    expiredDocLabels: string[];
    totalRequiredCount: number;
    fulfilledCount: number;
}

export const checkSubcontractorCompliance = (
    subcontractor: Partial<Subcontractor> | null | undefined,
    settings?: SubcontractorComplianceSettings
): ComplianceCheckResult => {
    const effectiveSettings = settings || getDefaultComplianceSettings();
    const reqMap = effectiveSettings.requiredDocuments || getDefaultComplianceSettings().requiredDocuments!;
    
    const requiredDefs = ALL_COMPLIANCE_DOCUMENTS.filter(d => reqMap[d.key] === true);
    
    const missingDocKeys: string[] = [];
    const missingDocLabels: string[] = [];
    const pendingDocLabels: string[] = [];
    const expiredDocLabels: string[] = [];

    let fulfilledCount = 0;
    const docs = subcontractor?.complianceDocs || [];

    requiredDefs.forEach(def => {
        const matchingDoc = docs.find(d => d.docKey === def.key);
        if (!matchingDoc || matchingDoc.status === 'missing') {
            missingDocKeys.push(def.key);
            missingDocLabels.push(def.label);
        } else if (matchingDoc.status === 'pending') {
            pendingDocLabels.push(def.label);
            missingDocKeys.push(def.key);
        } else if (matchingDoc.status === 'expired') {
            expiredDocLabels.push(def.label);
            missingDocKeys.push(def.key);
        } else if (matchingDoc.status === 'verified') {
            // Check if document has an expiration date that passed
            if (matchingDoc.expiresAt && new Date(matchingDoc.expiresAt) < new Date()) {
                expiredDocLabels.push(def.label);
                missingDocKeys.push(def.key);
            } else {
                fulfilledCount++;
            }
        }
    });

    const isCompliant = missingDocKeys.length === 0;

    return {
        isCompliant,
        missingDocKeys,
        missingDocLabels,
        pendingDocLabels,
        expiredDocLabels,
        totalRequiredCount: requiredDefs.length,
        fulfilledCount
    };
};

export const checkUserCompliance = (
    user: Partial<User> | null | undefined,
    settings?: SubcontractorComplianceSettings
): ComplianceCheckResult => {
    const effectiveSettings = settings || getDefaultComplianceSettings();
    const reqMap = effectiveSettings.requiredDocuments || getDefaultComplianceSettings().requiredDocuments!;
    const requiredDefs = ALL_COMPLIANCE_DOCUMENTS.filter(d => reqMap[d.key] === true);

    const missingDocKeys: string[] = [];
    const missingDocLabels: string[] = [];
    const pendingDocLabels: string[] = [];
    const expiredDocLabels: string[] = [];

    let fulfilledCount = 0;

    // Check user's hiring packet status and compliance docs
    const statusObj = (user as any)?.hiringPacketStatus || {};
    const docs: SubcontractorComplianceDoc[] = (user as any)?.complianceDocs || [];

    requiredDefs.forEach(def => {
        let isDone = false;
        
        // Map legacy W4/I-9/ID toggles if matching
        if (def.key === 'w9' && (statusObj.w4Completed || statusObj.w9Completed)) isDone = true;
        if (def.key === 'i9' && statusObj.i9Completed) isDone = true;
        if (def.key === 'drivers_license' && statusObj.idUploaded) isDone = true;
        if (def.key === 'direct_deposit' && statusObj.directDepositCompleted) isDone = true;
        if (def.key === 'signed_agreement' && ((user as any)?.signedAgreements || statusObj.handbookSigned)) isDone = true;

        if (!isDone) {
            const matchingDoc = docs.find(d => d.docKey === def.key);
            if (matchingDoc && matchingDoc.status === 'verified') {
                if (matchingDoc.expiresAt && new Date(matchingDoc.expiresAt) < new Date()) {
                    expiredDocLabels.push(def.label);
                    missingDocKeys.push(def.key);
                } else {
                    fulfilledCount++;
                }
            } else if (matchingDoc && matchingDoc.status === 'pending') {
                pendingDocLabels.push(def.label);
                missingDocKeys.push(def.key);
            } else {
                missingDocKeys.push(def.key);
                missingDocLabels.push(def.label);
            }
        } else {
            fulfilledCount++;
        }
    });

    return {
        isCompliant: missingDocKeys.length === 0,
        missingDocKeys,
        missingDocLabels,
        pendingDocLabels,
        expiredDocLabels,
        totalRequiredCount: requiredDefs.length,
        fulfilledCount
    };
};
