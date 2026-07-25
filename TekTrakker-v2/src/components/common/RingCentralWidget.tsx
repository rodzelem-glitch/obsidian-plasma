import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import { Capacitor } from '@capacitor/core';

export const RingCentralWidget: React.FC = () => {
    const { state } = useAppContext();
    const [clientId, setClientId] = useState<string | null>(null);
    const [jwtToken, setJwtToken] = useState<string | null>(null);
    const [loginFlow, setLoginFlow] = useState<string | null>(null);
    const [callMode, setCallMode] = useState<string | null>(null);

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
                    if (data.ringCentralLoginFlow) {
                        setLoginFlow(data.ringCentralLoginFlow);
                    }
                    if (data.ringCentralCallMode) {
                        setCallMode(data.ringCentralCallMode);
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

        // Catch and handle RingCentral-related unhandled promise rejections
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            if (reason) {
                const message = typeof reason === 'string' ? reason : (reason.message || '');
                if (
                    message.includes('platform.ringcentral.com') ||
                    message.includes('RingCentral') ||
                    message.includes('oauth/token') ||
                    message.includes('message channel closed') ||
                    message.includes('Unauthorized for this grant type')
                ) {
                    event.preventDefault();
                    console.warn('[RingCentral Widget] Resiliently caught and swallowed promise rejection:', message);
                }
            }
        };
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Do not load the web widget on native mobile apps (Capacitor)
        // The iframe OAuth popups are blocked by WebViews, and mobile devices have native dialers.
        if (Capacitor.isNativePlatform()) {
            return;
        }

        // Initialize RingCentral Embeddable using official fallback credentials
        const script = document.createElement('script');
        script.id = 'rc-widget-script';
        const activeCallMode = callMode || 'browser';
        let srcUrl = `https://ringcentral.github.io/ringcentral-embeddable/adapter.js?clientId=${clientId}&appServer=https://platform.ringcentral.com&defaultCallWith=${activeCallMode}`;
        if (jwtToken && loginFlow !== 'oauth') {
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
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
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
    }, [clientId, jwtToken, loginFlow, callMode]);

    return null;
};
