import { useAppContext } from '../context/AppContext';

export const useFeatureGating = () => {
    const { state } = useAppContext();

    const hasFeature = (featureKey: string): boolean => {
        const org = state.currentOrganization;
        if (!org) return false;
        
        // 1. Check if the organization has an active Master-Level override
        if (org.unlockAllFeatures) return true;
        
        // 2. Fetch the platform-wide billing config map
        const platformCfg = state.platformSettings;
        if (!platformCfg) return false;

        // 3. Evaluate the organization's existing subscription tier
        const planKey = org.plan || 'starter';
        
        // 4. Return boolean validating the feature token exists inside their active tier roadmap
        const activePlanFeatures = platformCfg.plans?.[planKey]?.features || [];
        return activePlanFeatures.includes(featureKey);
    };

    return { hasFeature };
};
