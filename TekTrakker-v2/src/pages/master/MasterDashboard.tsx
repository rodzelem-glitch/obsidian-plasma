
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import DashboardHeader from './components/DashboardHeader';
import SaaSMetrics from './components/SaaSMetrics';
import DataSeedingActions from './components/DataSeedingActions';
import ApiBillingSection from './components/ApiBillingSection';

const MasterDashboard: React.FC = () => {
    const { state } = useAppContext();
    const [excludeTest, setExcludeTest] = useState(false);
    
    // Filter Orgs for Metrics
    const filteredOrgs = useMemo(() => {
        return state.allOrganizations.filter(org => {
            const orgName = (org.name || '').toLowerCase();
            if (orgName.includes('test') || orgName.includes('demo') || (org as any).isDemo) return false;
            if (excludeTest && orgName.includes('sandbox')) return false; // kept excludeTest as an option for sandbox
            return true;
        });
    }, [state.allOrganizations, excludeTest]);

    // Calculate SaaS Metrics
    const totalOrgs = filteredOrgs.length;
    const activeOrgs = filteredOrgs.filter(o => o.subscriptionStatus === 'active').length;
    
    const mrr = useMemo(() => {
        return filteredOrgs.reduce((sum, org) => {
            if (org.subscriptionStatus !== 'active' || org.isFreeAccess) return sum;
            
            const plans = state.platformSettings?.plans;
            const planKey = org.plan || 'starter';
            
            let basePrice = 49;
            if (plans && plans[planKey]) {
                basePrice = plans[planKey].monthly;
            } else {
                 if (planKey === 'enterprise') basePrice = 299;
                 else if (planKey === 'growth') basePrice = 149;
            }
                
            const discountMultiplier = 1 - ((org.customDiscountPct || 0) / 100);
            return sum + (basePrice * discountMultiplier);
        }, 0);
    }, [filteredOrgs, state.platformSettings]);

    const totalUsers = useMemo(() => {
        if (!excludeTest) return state.users.length;
        const validOrgIds = filteredOrgs.map(o => o.id);
        return state.users.filter(u => validOrgIds.includes(u.organizationId)).length;
    }, [state.users, filteredOrgs, excludeTest]);

    return (
        <div className="space-y-6">
            <DashboardHeader excludeTest={excludeTest} setExcludeTest={setExcludeTest} />
            
            {/* Header Actions (Seed Data only) */}
            <div className="flex justify-end -mt-24 mb-6">
                 <DataSeedingActions hidePromoMaker={true} />
            </div>

            <SaaSMetrics 
                totalOrgs={totalOrgs}
                mrr={mrr}
                totalUsers={totalUsers}
                activeOrgs={activeOrgs}
            />

            {/* Promo Code Management Section moved under SaaS Metrics */}
            <div className="mt-8">
                 <DataSeedingActions hidePromoMaker={false} />
            </div>

            <ApiBillingSection />
        </div>
    );
};

export default MasterDashboard;
