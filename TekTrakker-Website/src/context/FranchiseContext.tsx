import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { Franchise } from '../types';
import { generateColorShades } from '../lib/colorUtils';

interface FranchiseContextType {
    activeFranchise: Franchise | null;
    loadingFranchise: boolean;
}

const FranchiseContext = createContext<FranchiseContextType>({
    activeFranchise: null,
    loadingFranchise: true
});

export const useFranchise = () => useContext(FranchiseContext);

export const FranchiseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeFranchise, setActiveFranchise] = useState<Franchise | null>(null);
    const [loadingFranchise, setLoadingFranchise] = useState(true);

    useEffect(() => {
        const hostname = window.location.hostname;
        
        // Skip if standard TekTrakker domain or localhost testing (unless testing custom domain locally)
        if (hostname.includes('tektrakker.com') || hostname === 'localhost') {
            setLoadingFranchise(false);
            return;
        }

        const fetchFranchiseRecord = async () => {
            try {
                // Determine layout via custom domain routing
                const franchiseQuery = await db.collection('franchises').where('branding.customDomain', '==', hostname).limit(1).get();
                if (!franchiseQuery.empty) {
                    const franchise = { id: franchiseQuery.docs[0].id, ...franchiseQuery.docs[0].data() } as Franchise;
                    setActiveFranchise(franchise);

                    // Inject White-Label Colors 
                    if (franchise.branding?.primaryColor) {
                        const shades = generateColorShades(franchise.branding.primaryColor);
                        Object.entries(shades).forEach(([weight, hex]) => {
                            document.documentElement.style.setProperty(`--color-primary-${weight}`, hex);
                        });
                    }
                    
                    // Inject White-Label Document Title
                    if (franchise.branding?.appName) {
                        document.title = franchise.branding.appName;
                    }
                }
            } catch (err) {
                console.error("DNS Franchise Resolution Failed:", err);
            } finally {
                setLoadingFranchise(false);
            }
        };

        fetchFranchiseRecord();
    }, []);

    return (
        <FranchiseContext.Provider value={{ activeFranchise, loadingFranchise }}>
            {loadingFranchise ? null : children}
        </FranchiseContext.Provider>
    );
};
