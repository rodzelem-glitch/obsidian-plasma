import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import { Capacitor } from '@capacitor/core';

export const RingCentralWidget: React.FC = () => {
    const { state } = useAppContext();
    const [clientId, setClientId] = useState<string | null>(null);
    const [jwtToken, setJwtToken] = useState<string | null>(null);

    useEffect(() => {
        if (!state.currentOrganization || state.isDemoMode) return;

        const fetchConfig = async () => {
            try {
                const configDoc = await getDoc(doc(db, 'organizations', state.currentOrganization.id, 'secrets', 'config'));
                if (configDoc.exists()) {
                    const data = configDoc.data();
                    if (data.ringCentralClientId) {
                        setClientId(data.ringCentralClientId);
                    }
                    if (data.ringCentralJwtToken) {
                        setJwtToken(data.ringCentralJwtToken);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch RingCentral config for widget", e);
            }
        };

        fetchConfig();
    }, [state.currentOrganization]);

    useEffect(() => {
        if (!clientId) return;

        // Prevent multiple scripts from being injected
        if (document.getElementById('rc-widget-script')) return;

        // Do not load the web widget on native mobile apps (Capacitor)
        // The iframe OAuth popups are blocked by WebViews, and mobile devices have native dialers.
        if (Capacitor.isNativePlatform()) {
            return;
        }

        // Initialize RingCentral Embeddable using official fallback credentials
        const script = document.createElement('script');
        script.id = 'rc-widget-script';
        let srcUrl = `https://ringcentral.github.io/ringcentral-embeddable/adapter.js?clientId=${clientId}&appServer=https://platform.ringcentral.com`;
        if (jwtToken) {
            srcUrl += `&jwt=${jwtToken}`;
        }
        script.src = srcUrl;
        script.async = true;
        
        const firstScript = document.getElementsByTagName('script')[0];
        if (firstScript && firstScript.parentNode) {
            firstScript.parentNode.insertBefore(script, firstScript);
        } else {
            document.head.appendChild(script);
        }

        return () => {
            // Cleanup on unmount
            const existingScript = document.getElementById('rc-widget-script');
            if (existingScript) {
                existingScript.remove();
            }
            // The widget also injects an iframe that needs to be removed
            const rcWidget = document.querySelector('#rc-widget');
            if (rcWidget) {
                rcWidget.remove();
            }
        };
    }, [clientId]);

    return null;
};
