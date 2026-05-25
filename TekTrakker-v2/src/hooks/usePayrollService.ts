import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { db } from '../lib/firebase';

export type PayrollService = 'gusto' | 'quickbooks' | 'adp' | 'paychex' | 'none';

export const usePayrollService = () => {
    const { state } = useAppContext();
    const [activePayrollService, setActivePayrollService] = useState<PayrollService>('none');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkPayrollService = async () => {
            try {
                const org = state.currentOrganization;
                if (!org?.id) {
                    setActivePayrollService('none');
                    setLoading(false);
                    return;
                }

                // 1. QBO connection on org level has highest priority
                if (org.quickbooksConnected) {
                    setActivePayrollService('quickbooks');
                    setLoading(false);
                    return;
                }

                // 2. Gusto onboarding/UUID set on org level has second highest
                if (org.gustoCompanyUuid || org.gustoOnboardingUrl) {
                    setActivePayrollService('gusto');
                    setLoading(false);
                    return;
                }

                // 3. Check asynchronously if marketplace integrations has QBO, ADP or Paychex active
                const snap = await db.doc(`organizations/${org.id}/settings/marketplace_integrations`).get();
                if (snap.exists) {
                    const integrations = snap.data()?.integrations || {};
                    if (integrations.adp?.enabled) {
                        setActivePayrollService('adp');
                    } else if (integrations.paychex?.enabled) {
                        setActivePayrollService('paychex');
                    } else if (integrations.quickbooks_online?.enabled) {
                        setActivePayrollService('quickbooks');
                    } else if (integrations.gusto?.enabled) {
                        setActivePayrollService('gusto');
                    } else {
                        setActivePayrollService('none');
                    }
                } else {
                    setActivePayrollService('none');
                }
            } catch (e) {
                console.error("Error detecting payroll integration:", e);
                setActivePayrollService('none');
            } finally {
                setLoading(false);
            }
        };

        checkPayrollService();
    }, [state.currentOrganization]);

    return { activePayrollService, loading };
};
