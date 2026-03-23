
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { Review, Job, User, Customer } from 'types';

export const useReviewEligibility = (userOrId: User | string | null, organizationId: string | null) => {
    const { state } = useAppContext();
    const { isDemoMode } = state;
    const [hasReviewed, setHasReviewed] = useState(false);
    const [hasCompletedJob, setHasCompletedJob] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checked, setChecked] = useState(false);

    const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;

    const checkEligibility = useCallback(() => {
        if (!userId || !organizationId) {
            setLoading(false);
            setChecked(true);
            return;
        }

        setLoading(true);

        if (isDemoMode) {
            setHasCompletedJob(true);
            setHasReviewed(false);
            setLoading(false);
            setChecked(true);
            return;
        }

        try {
            const alreadyReviewed = state.reviews.some(r => r.customerId === userId && r.organizationId === organizationId);
            setHasReviewed(alreadyReviewed);

            if (alreadyReviewed) {
                setHasCompletedJob(true);
            } else {
                const completed = state.jobs.some(j => 
                    (j.customerId === userId || j.customerName?.toLowerCase() === (userOrId as any)?.name?.toLowerCase()) && 
                    j.organizationId === organizationId && 
                    j.jobStatus === 'Completed'
                );
                setHasCompletedJob(completed);
            }
        } catch (error) {
            console.error("Error checking review eligibility:", error);
        } finally {
            setLoading(false);
            setChecked(true);
        }
    }, [userId, organizationId, isDemoMode, state.reviews, state.jobs, userOrId]);

    useEffect(() => {
        checkEligibility();
    }, [checkEligibility]);

    const canReview = useMemo(() => hasCompletedJob && !hasReviewed, [hasCompletedJob, hasReviewed]);

    return { 
        loading, 
        eligibility: {
            canReview,
            hasReviewed,
            checked,
            loading
        },
        // For backwards compatibility and simplified usage
        canReview,
        hasReviewed,
        checkEligibility 
    };
};
