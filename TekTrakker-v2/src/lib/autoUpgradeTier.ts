import { db } from './firebase';
import showToast from './toast';

/**
 * Checks an organization's current active user count against its plan tier.
 * If adding a user causes the organization to exceed its plan limit, it automatically
 * rolls the organization into the next tier (Starter -> Growth -> Enterprise).
 */
export const checkAndAutoUpgradeOrgTier = async (orgId: string, currentPlan: string | undefined, currentUsersCount: number): Promise<string | null> => {
    if (!orgId) return null;

    const plan = (currentPlan || 'starter').toLowerCase();

    let targetPlan: string | null = null;
    let targetPrice = 0;

    // Plan limits:
    // starter: max 1 user -> adding user #2 rolls into 'growth' ($149/mo)
    // growth: max 5 users -> adding user #6 rolls into 'enterprise' ($350/mo)
    // enterprise / payments_only: unlimited
    if (plan === 'starter' && currentUsersCount >= 1) {
        targetPlan = 'growth';
        targetPrice = 149;
    } else if (plan === 'growth' && currentUsersCount >= 5) {
        targetPlan = 'enterprise';
        targetPrice = 350;
    }

    if (targetPlan) {
        try {
            await db.collection('organizations').doc(orgId).update({
                plan: targetPlan,
                subscriptionTier: targetPlan,
                updatedAt: new Date().toISOString()
            });

            showToast.success(
                `User limit reached for ${plan.toUpperCase()} plan. Your organization has been automatically upgraded to the ${targetPlan.toUpperCase()} plan ($${targetPrice}/mo)!`
            );
            return targetPlan;
        } catch (err) {
            console.error("Failed to auto-upgrade organization tier:", err);
        }
    }

    return null;
};
