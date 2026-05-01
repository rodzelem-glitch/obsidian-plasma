import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const OAuthCallback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('Identifying authorization code...');
    const [error, setError] = useState('');

    useEffect(() => {
        const code = searchParams.get('code');
        const stateParam = searchParams.get('state'); // 'tiktok' or 'linkedin'

        if (!code) {
            setError('No authorization code found in URL.');
            return;
        }

        const redirect_uri = 'https://app.tektrakker.com/auth/callback';

        const exchangeTikTok = async () => {
            setStatus('Exchanging authorization code with TikTok...');
            try {
                const client_key = import.meta.env.VITE_TIKTOK_CLIENT_KEY || '';
                const client_secret = import.meta.env.VITE_TIKTOK_CLIENT_SECRET || '';
                const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
                
                const params = new URLSearchParams();
                params.append('client_key', client_key);
                params.append('client_secret', client_secret);
                params.append('code', code);
                params.append('grant_type', 'authorization_code');
                params.append('redirect_uri', redirect_uri);

                const response = await fetch(tokenUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cache-Control': 'no-cache'
                    },
                    body: params
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error('TikTok API rejected the token exchange: ' + errText);
                }

                const data = await response.json();
                
                if (data.error) throw new Error(data.error_description || 'Unknown TikTok Error');

                localStorage.setItem('tenant_tt_token', data.access_token);
                localStorage.setItem('tenant_tt_auth', 'true');
                if (data.refresh_token) localStorage.setItem('tenant_tt_refresh', data.refresh_token);
                if (data.open_id) localStorage.setItem('tenant_tt_open_id', data.open_id);

                setStatus('Success! TikTok linked. Redirecting...');
                setTimeout(() => navigate('/admin/dashboard?tab=social'), 1500);

            } catch (err: any) {
                console.error("TikTok Exchange Error", err);
                if (err.message === 'Failed to fetch' || err.message.includes('CORS')) {
                    setError('CORS Blocked: TikTok requires a backend proxy for this token exchange.');
                } else {
                    setError(err.message || 'An error occurred during TikTok token exchange.');
                }
            }
        };

        const exchangeLinkedIn = async () => {
            setStatus('Exchanging authorization code with LinkedIn...');
            try {
                const client_id = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';
                const client_secret = import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || '';
                const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';

                const params = new URLSearchParams();
                params.append('grant_type', 'authorization_code');
                params.append('code', code);
                params.append('client_id', client_id);
                params.append('client_secret', client_secret);
                params.append('redirect_uri', redirect_uri);

                const response = await fetch(tokenUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: params
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error('LinkedIn API rejected the token exchange: ' + errText);
                }

                const data = await response.json();
                
                if (data.error) throw new Error(data.error_description || 'Unknown LinkedIn Error');

                localStorage.setItem('tenant_li_token', data.access_token);
                localStorage.setItem('tenant_li_auth', 'true');
                if (data.refresh_token) localStorage.setItem('tenant_li_refresh', data.refresh_token);

                setStatus('Success! LinkedIn linked. Redirecting...');
                setTimeout(() => navigate('/admin/dashboard?tab=social'), 1500);

            } catch (err: any) {
                console.error("LinkedIn Exchange Error", err);
                if (err.message === 'Failed to fetch' || err.message.includes('CORS')) {
                    setError('CORS Blocked: LinkedIn requires a backend proxy for this token exchange.');
                } else {
                    setError(err.message || 'An error occurred during LinkedIn token exchange.');
                }
            }
        };

        if (stateParam === 'tiktok') {
            exchangeTikTok();
        } else if (stateParam === 'linkedin') {
            exchangeLinkedIn();
        } else {
            setError('Invalid OAuth State Provider.');
        }

    }, [searchParams, navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 text-center">
            <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Social Media Authorization</h1>
            
            {!error ? (
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">{status}</p>
                </div>
            ) : (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-6 rounded-xl max-w-md w-full">
                    <h2 className="text-red-700 dark:text-red-400 font-bold mb-2">Connection Failed</h2>
                    <p className="text-sm text-red-600 dark:text-red-300 mb-6">{error}</p>
                    <button 
                        onClick={() => navigate('/admin/dashboard')}
                        className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 font-bold text-sm w-full"
                    >
                        Return to Dashboard
                    </button>
                </div>
            )}
        </div>
    );
};

export default OAuthCallback;
