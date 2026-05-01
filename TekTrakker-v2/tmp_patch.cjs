const fs = require('fs');
let c = fs.readFileSync('src/components/modals/invoice-editor/useInvoiceLogic.ts', 'utf8');

c = c.replace(/const \[warrantyDisclaimerAgreed, setWarrantyDisclaimerAgreed\] = useState\<boolean\>\(false\);\r?\n\r?\n    const sigPadRef/g, 
`const [warrantyDisclaimerAgreed, setWarrantyDisclaimerAgreed] = useState<boolean>(false);
    const [membershipEnrollment, setMembershipEnrollment] = useState<any>(null);

    const sigPadRef`);

c = c.replace(/setWarrantyDisclaimerAgreed\(\(job\.invoice as any\)\?\.warrantyDisclaimerAgreed \|\| false\);\r?\n\r?\n                if \(job\.source === 'PlatformAdmin'\)/g, 
`setWarrantyDisclaimerAgreed((job.invoice as any)?.warrantyDisclaimerAgreed || false);
                setMembershipEnrollment((job.invoice as any)?.membershipEnrollment || null);

                if (job.source === 'PlatformAdmin')`);

c = c.replace(/warrantyIssuedDate: \(currentJob\.invoice as any\)\?\.warrantyIssuedDate \|\| \(workmanshipWarrantyMonths > 0 \|\| partsWarrantyMonths > 0 \? new Date\(\)\.toISOString\(\) : null\),\r?\n            },\r?\n            updatedAt/g, 
`warrantyIssuedDate: (currentJob.invoice as any)?.warrantyIssuedDate || (workmanshipWarrantyMonths > 0 || partsWarrantyMonths > 0 ? new Date().toISOString() : null),
                membershipEnrollment: membershipEnrollment || null,
            },
            updatedAt`);

c = c.replace(/            if \(paymentMethod === 'Cash'\) \{([\s\S]*?)await db.collection\('jobs'\).doc\(currentJob.id\).update\(updatedJob\);\r?\n            dispatch\(\{ type: 'UPDATE_JOB', payload: updatedJob \}\);/g, 
`            if (paymentMethod === 'Cash') {$1if (updatedJob.invoice.membershipEnrollment && currentJob.customerId) {
                const enrollment = updatedJob.invoice.membershipEnrollment;
                const newId = 'm-' + Date.now();
                const agreement = {
                    id: newId,
                    organizationId: currentOrganization?.id || '',
                    customerId: currentJob.customerId,
                    customerName: currentJob.customerName,
                    planName: enrollment.planName,
                    price: enrollment.price,
                    billingCycle: enrollment.billingCycle,
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + (enrollment.billingCycle === 'Annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'Active',
                    systemCount: enrollment.systemCount,
                    createdAt: new Date().toISOString()
                };
                try {
                    await db.collection('serviceAgreements').doc(newId).set(agreement);
                } catch(e) { console.error("Error creating service agreement", e); }
            }

            await db.collection('jobs').doc(currentJob.id).update(updatedJob);
            dispatch({ type: 'UPDATE_JOB', payload: updatedJob });`);

c = c.replace(/warrantyDisclaimerAgreed, setWarrantyDisclaimerAgreed,([\s]*)\};([\s]*)\};/g, 
`warrantyDisclaimerAgreed, setWarrantyDisclaimerAgreed,
        membershipEnrollment, setMembershipEnrollment,
    };
};`);

fs.writeFileSync('src/components/modals/invoice-editor/useInvoiceLogic.ts', c);
