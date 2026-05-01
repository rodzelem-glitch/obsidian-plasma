import { getBaseUrl } from 'lib/utils';
import React, { useState, useEffect } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Share2, Image as ImageIcon, Send, Sparkles, RefreshCw, BarChart3, Code, MessageSquare } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { db, storage, auth } from 'lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { TwitterAuthProvider, GoogleAuthProvider, linkWithPopup, signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const MasterSocialMediaHub: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [contentFormat, setContentFormat] = useState('feed');
    const [templates, setTemplates] = useState<any[]>([]);
    
    // Facebook Graph API State
    const [fbPages, setFbPages] = useState<any[]>([]);
    const [selectedFbPageId, setSelectedFbPageId] = useState<string>(localStorage.getItem('master_fb_page_id') || '');
    
    // Toggles for Platforms
    const [postToLI, setPostToLI] = useState(true);
    const [postToX, setPostToX] = useState(false);
    const [postToGB, setPostToGB] = useState(false);
    
    // Auth state for FB & IG
    const [isFBConnected, setIsFBConnected] = useState(localStorage.getItem('master_fb_auth') === 'true');
    const [isFBConnecting, setIsFBConnecting] = useState(false);
    const [postToFB, setPostToFB] = useState(localStorage.getItem('master_fb_auth') === 'true');
    const [postToIG, setPostToIG] = useState(localStorage.getItem('master_fb_auth') === 'true');
    
    // Auth state for X
    const [isXConnected, setIsXConnected] = useState(localStorage.getItem('master_x_auth') === 'true');
    const [isXConnecting, setIsXConnecting] = useState(false);
    
    // Auth state for GB
    const [isGBConnected, setIsGBConnected] = useState(localStorage.getItem('master_gb_auth') === 'true');
    const [isGBConnecting, setIsGBConnecting] = useState(false);

    // Auth state for TikTok
    const [postToTT, setPostToTT] = useState(localStorage.getItem('master_tt_auth') === 'true');
    const [isTTConnected, setIsTTConnected] = useState(localStorage.getItem('master_tt_auth') === 'true');
    const [isTTConnecting, setIsTTConnecting] = useState(false);

    // Auth state for LinkedIn
    const [isLIConnected, setIsLIConnected] = useState(localStorage.getItem('tenant_li_auth') === 'true');
    const [isLIConnecting, setIsLIConnecting] = useState(false);


    
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        window.scrollTo(0, 0);
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const snap = await db.collection('masterData').doc('socialMediaTemplates').collection('templates').orderBy('createdAt', 'desc').get();
            setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Failed to load templates:", error);
        }
    };

    const handleConnectX = async () => {
        if (!auth.currentUser) return setErrorMsg("Must be logged in to connect.");
        setIsXConnecting(true);
        try {
            const provider = new TwitterAuthProvider();
            let result;
            try {
                result = await linkWithPopup(auth.currentUser, provider);
            } catch (e: any) {
                if (e.code === 'auth/credential-already-in-use') {
                    throw new Error("This social account is currently tied to another TekTrakker user. Please delete the dummy account in Firebase Auth or use a different account.");
                } else throw e;
            }
            const credential = TwitterAuthProvider.credentialFromResult(result);
            if (credential?.accessToken && credential?.secret) {
                localStorage.setItem('master_x_token', credential.accessToken);
                localStorage.setItem('master_x_secret', credential.secret);
            }
            setIsXConnected(true);
            localStorage.setItem('master_x_auth', 'true');
            setPostToX(true);
            setSuccessMsg("X (Twitter) Account securely linked via OAuth!");
        } catch (error: any) {
            console.error("X Auth failed", error);
            setErrorMsg("Failed to connect to X: " + error.message);
        } finally {
            setIsXConnecting(false);
            setTimeout(() => setSuccessMsg(''), 3000);
        }
    };

    const handleDisconnectX = () => {
        localStorage.removeItem('master_x_token');
        localStorage.removeItem('master_x_secret');
        localStorage.removeItem('master_x_auth');
        setIsXConnected(false);
        setPostToX(false);
        setSuccessMsg("X (Twitter) disconnected successfully.");
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const loadGisScript = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if ((window as any).google && (window as any).google.accounts) return resolve();
            const script = document.createElement('script');
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
            document.body.appendChild(script);
        });
    };

    const handleConnectGB = async () => {
        setIsGBConnecting(true);
        try {
            await loadGisScript();
            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: '655867451194-lsfv2au0832sarq3uor8ch9tj9kmssai.apps.googleusercontent.com',
                scope: 'https://www.googleapis.com/auth/business.manage',
                callback: (response: any) => {
                    if (response.error) {
                        setErrorMsg("Google Profile authorization failed: " + response.error);
                        setIsGBConnecting(false);
                        return;
                    }
                    if (response.access_token) {
                        localStorage.setItem('master_gb_token', response.access_token);
                        setIsGBConnected(true);
                        localStorage.setItem('master_gb_auth', 'true');
                        setPostToGB(true);
                        setSuccessMsg("Google Business Profile securely linked via GIS OAuth!");
                        setIsGBConnecting(false);
                        setTimeout(() => setSuccessMsg(''), 3000);
                    }
                },
                error_callback: (err: any) => {
                    console.error("GIS Error", err);
                    setErrorMsg("Failed to connect: popup blocked or closed.");
                    setIsGBConnecting(false);
                }
            });
            client.requestAccessToken();
        } catch (error: any) {
            console.error("GB Auth load failed", error);
            setErrorMsg("Failed to initialize Google Login.");
            setIsGBConnecting(false);
        }
    };

    const handleDisconnectGB = () => {
        localStorage.removeItem('master_gb_token');
        localStorage.removeItem('master_gb_auth');
        setIsGBConnected(false);
        setPostToGB(false);
        setSuccessMsg("Google Business Profile disconnected.");
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const handleConnectTT = () => {
        setIsTTConnecting(true);
        // Replace 'YOUR_TIKTOK_CLIENT_KEY' with your approved key
        const clientKey = '7631794451085525009';
        const redirectUri = window.location.origin + '/auth/callback';
        const scope = 'user.info.basic,video.upload';

        window.location.href = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&response_type=code&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        // Note: The UI layer will listen on /auth/tiktok/callback to capture the token
    };

    const handleDisconnectTT = () => {
        localStorage.removeItem('master_tt_token');
        localStorage.removeItem('master_tt_auth');
        setIsTTConnected(false);
        setPostToTT(false);
        setSuccessMsg("TikTok Account disconnected successfully.");
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const handleConnectLI = () => {
        setIsLIConnecting(true);
        const clientId = '86fh8gh2o2gdzj'; 
        const redirectUri = window.location.origin + '/auth/callback';
        const stateStr = 'linkedin';
        const scope = 'w_member_social'; // or correct scope
        window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${stateStr}&scope=${scope}`;
    };

    const handleDisconnectLI = () => {
        localStorage.removeItem('tenant_li_token');
        localStorage.removeItem('master_li_token');
        localStorage.removeItem('tenant_li_auth');
        localStorage.removeItem('master_li_auth');
        setIsLIConnected(false);
        setPostToLI(false);
        setSuccessMsg("LinkedIn Account disconnected successfully.");
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const handleConnectFB = async () => {
        setIsFBConnecting(true);
        try {
            if (!(window as any).FB) {
                throw new Error("Facebook SDK not loaded. Please disable your adblocker or try again.");
            }
            (window as any).FB.login((response: any) => {
                if (response.authResponse) {
                    localStorage.setItem('master_fb_auth', 'true');
                    localStorage.setItem('master_fb_token', response.authResponse.accessToken);
                    setIsFBConnected(true);
                    setPostToFB(true);
                    setPostToIG(true); // Automatically unlocks IG Graph API too
                    
                    // Fetch Pages immediately upon connection
                    (window as any).FB.api('/me/accounts', { access_token: response.authResponse.accessToken }, (accountsResponse: any) => {
                        if (accountsResponse.data && accountsResponse.data.length > 0) {
                            setFbPages(accountsResponse.data);
                            if (!localStorage.getItem('master_fb_page_id')) {
                                setSelectedFbPageId(accountsResponse.data[0].id);
                                localStorage.setItem('master_fb_page_id', accountsResponse.data[0].id);
                            }
                        }
                    });

                    setSuccessMsg("Meta ecosystem (Facebook & Instagram) connected successfully!");
                } else {
                    setErrorMsg("Facebook login was cancelled or failed.");
                }
                setIsFBConnecting(false);
            }, { scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,business_management', auth_type: 'rerequest' });
        } catch (err: any) {
            console.error("FB Connect Error:", err);
            setErrorMsg(err.message || 'Failed to initialize Facebook Login.');
            setIsFBConnecting(false);
        }
    };

    const handleDisconnectFB = () => {
        localStorage.removeItem('master_fb_auth');
        localStorage.removeItem('master_fb_token');
        setIsFBConnected(false);
        setPostToFB(false);
        setPostToIG(false);
        setSuccessMsg("Meta ecosystem disconnected.");
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !state.currentOrganization?.id) return;
        setIsUploading(true);
        setErrorMsg('');
        try {
            const storageRef = storage.ref(`social_media/${state.currentOrganization.id}/${Date.now()}_${file.name}`);
            const snapshot = await storageRef.put(file);
            const url = await snapshot.ref.getDownloadURL();
            setMediaUrl(url);
        } catch (error) {
            console.error("Upload error:", error);
            setErrorMsg("Failed to upload image.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerateAI = async (isRefinement = false) => {
        setIsGenerating(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI', { timeout: 300000 });
            const orgInfo = `Business Name: Master Admin Platform. Sector: Franchising.`;
            const contextMsg = isRefinement && content ? `Refine this existing draft: "${content}"\n\nNew instructions: ` : `Create a completely new social media post.\n\nInstructions: `;
            const finalPrompt = `Act as an expert social media manager for the following business: ${orgInfo}.\n\n${contextMsg}${aiPrompt || 'Make it an engaging, organic post with popular hashtags.'}\n\nRules: Keep it under 500 characters, highly engaging, professional but conversational. Do not use quotes around the output.`;
            const result: any = await callGeminiAI({ prompt: finalPrompt });
            if (result.data?.text) {
                setContent(result.data.text.replace(/^["']|["']$/g, ''));
            }
        } catch (error) {
            console.error("AI Gen Failed:", error);
            setErrorMsg("Failed to generate AI post.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!content.trim()) return setErrorMsg("Cannot save an empty template.");
        try {
            await db.collection('masterData').doc('socialMediaTemplates').collection('templates').add({
                content,
                mediaUrl,
                name: (aiPrompt.substring(0, 30) || 'Manual Draft') + '...',
                createdAt: new Date().toISOString()
            });
            setSuccessMsg("Draft saved successfully!");
            await fetchTemplates();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            setErrorMsg("Failed to save draft.");
        }
    };

    const handlePublish = async () => {
        if (!content.trim()) return setErrorMsg("Post content cannot be empty.");
        if (!postToFB && !postToIG && !postToLI && !postToGB && !postToX && !postToTT) return setErrorMsg("Select at least one platform.");
        
        setIsPosting(true);
        setErrorMsg('');
        setSuccessMsg('');
        
        try {
            // Save the master level post log into master data namespace
            await db.collection('masterData').doc('socialMedia').collection('posts').add({
                content,
                mediaUrl,
                platforms: { facebook: postToFB, instagram: postToIG, linkedin: postToLI, googleBusiness: postToGB, x: postToX, tiktok: postToTT },
                status: 'published',
                authorId: state.currentUser?.id,
                createdAt: new Date().toISOString()
            });

            if (postToX) {
                const token = localStorage.getItem('master_x_token');
                const secret = localStorage.getItem('master_x_secret');
                if (!token || !secret) throw new Error("Missing X OAuth Tokens. Disconnect and reconnect your X account.");
                const postFn = httpsCallable(getFunctions(), 'postToX');
                await postFn({ content, accessToken: token, accessSecret: secret });
            }

            if (postToGB) {
                const gbToken = localStorage.getItem('master_gb_token');
                if (!gbToken) throw new Error("Missing Google Business OAuth Token. Please reconnect.");
                const gbFn = httpsCallable(getFunctions(), 'publishToGoogleBusiness');
                await gbFn({ content, accessToken: gbToken, organizationName: "Master Franchise Admin" });
            }

            if (postToTT) {
                if (!mediaUrl) throw new Error("TikTok requires an attached video file. Please attach media and try again.");
                const ttToken = localStorage.getItem('master_tt_token');
                if (!ttToken) throw new Error("Missing TikTok OAuth Token. Please reconnect your account.");
                const ttFn = httpsCallable(getFunctions(), 'publishToTikTok');
                await ttFn({ content, mediaUrl, accessToken: ttToken });
            }

            if (postToFB) {
                await new Promise((resolve, reject) => {
                    const FB = (window as any).FB;
                    const fbToken = localStorage.getItem('master_fb_token');
                    if (!FB || !fbToken) return reject(new Error("Facebook SDK not found or disconnected. Please reconnect."));
                    
                    FB.api('/me/accounts', { access_token: fbToken }, (accountsResponse: any) => {
                        if (accountsResponse.error) return reject(new Error(accountsResponse.error.message || "Failed to fetch Facebook Pages."));
                        
                        const pages = accountsResponse.data;
                        setFbPages(pages);
                        if (!pages || pages.length === 0) return reject(new Error("No Facebook Pages found. Make sure your account manages a Business Page."));

                        // Extract the targeted page token and post organically
                        const targetPage = pages.find((p: any) => p.id === selectedFbPageId) || pages[0];
                        
                        const targetEndpoint = mediaUrl ? `/${targetPage.id}/photos` : `/${targetPage.id}/feed`;
                        const payload = mediaUrl ? { url: mediaUrl, message: content, access_token: targetPage.access_token, published: true, no_story: false } : { message: content, access_token: targetPage.access_token };

                        FB.api(targetEndpoint, 'POST', payload, (postResponse: any) => {
                            if (postResponse.error) return reject(new Error(postResponse.error.message || "Failed to publish to Facebook Page."));
                            resolve(postResponse.id);
                        });
                    });
                });
            }

            if (postToIG) {
                if (!mediaUrl) throw new Error("Instagram strictly requires an attached photo/image to post. Please attach media and try again.");
                
                await new Promise((resolve, reject) => {
                    const FB = (window as any).FB;
                    const fbToken = localStorage.getItem('master_fb_token');
                    if (!FB || !fbToken) return reject(new Error("Facebook SDK disconnected. Instagram requires the Facebook bridge."));
                    
                    FB.api('/me/accounts', { access_token: fbToken, fields: 'instagram_business_account,id,access_token' }, (accountsResponse: any) => {
                        if (accountsResponse.error) return reject(new Error(accountsResponse.error.message || "Failed to fetch Facebook Pages for Instagram bridge."));
                        
                        const pages = accountsResponse.data;
                        if (!pages || pages.length === 0) return reject(new Error("No Facebook Pages found."));

                        const targetPage = pages.find((p: any) => p.id === selectedFbPageId) || pages[0];
                        if (!targetPage.instagram_business_account) return reject(new Error(`The selected Facebook Page (${targetPage.id}) does not have a linked Instagram Professional Account. Connect one inside Facebook Business Settings.`));

                        const igAccountId = targetPage.instagram_business_account.id;
                        
                        // Step 1: Create IG Container
                        FB.api(`/${igAccountId}/media`, 'POST', { image_url: mediaUrl, caption: content, access_token: targetPage.access_token }, (containerResponse: any) => {
                            if (containerResponse.error) return reject(new Error(containerResponse.error.message || "Failed to create Instagram asset container."));
                            
                            // Step 2: Publish IG Container
                            FB.api(`/${igAccountId}/media_publish`, 'POST', { creation_id: containerResponse.id, access_token: targetPage.access_token }, (publishResponse: any) => {
                                if (publishResponse.error) return reject(new Error(publishResponse.error.message || "Failed to publish Instagram post."));
                                resolve(publishResponse.id);
                            });
                        });
                    });
                });
            }

            if (!postToX && !postToGB && !postToFB && !postToTT) {
                // Simulate external API calls to other social platforms
                await new Promise(r => setTimeout(r, 1500));
            }
            
            setSuccessMsg("Successfully federated to selected platforms!");
            setContent('');
            setMediaUrl('');
            
        } catch (error) {
            console.error("Post Error:", error);
            setErrorMsg("Failed to broadcast post.");
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20 px-4 mt-8 md:mt-2">
            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => navigate('/master/social')}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-md transition-colors bg-white dark:bg-slate-900 text-primary-600 shadow-sm`}
                    >
                        <Share2 size={16}/> Social Media Hub
                    </button>
                </div>
            </header>

            {errorMsg && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-200">{errorMsg}</div>}
            {successMsg && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold border border-emerald-200">{successMsg}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left Column (Editor) */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="p-6">
                        {/* Format Type Selector (Visual Only for V1) */}
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Content Format</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setContentFormat('feed')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex-1 transition-colors border ${contentFormat === 'feed' ? 'bg-primary-500 text-white border-primary-500 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary-400'}`}
                                >
                                    Standard Feed
                                </button>
                                <button
                                    onClick={() => setContentFormat('reel')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex-1 transition-colors border ${contentFormat === 'reel' ? 'bg-primary-500 text-white border-primary-500 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary-400'}`}
                                >
                                    Reel / Short
                                </button>
                                <button
                                    onClick={() => setContentFormat('story')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex-1 transition-colors border ${contentFormat === 'story' ? 'bg-primary-500 text-white border-primary-500 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary-400'}`}
                                >
                                    Story
                                </button>
                            </div>
                        </div>

                        <div className="mb-4 space-y-3">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">AI Instructions</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder="E.g., Write a post about our new fall HVAC tune-up special..."
                                    className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                />
                                <button onClick={() => handleGenerateAI(false)} disabled={isGenerating} className="text-white font-bold bg-indigo-600 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-indigo-700 transition shrink-0">
                                    {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                                    {content ? "New Draft" : "Suggest"}
                                </button>
                                {content && (
                                    <button onClick={() => handleGenerateAI(true)} disabled={isGenerating} className="text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition shrink-0">
                                        <RefreshCw size={14} className={isGenerating ? "animate-spin" : ""} /> Refine
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-2 mt-4">
                            <h3 className="font-bold text-slate-900 dark:text-white">Post Content</h3>
                        </div>
                        <textarea 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-40 p-4 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 resize-none font-medium dark:text-white"
                            placeholder="What do you want to share with your audience?"
                        />
                        
                        <div className="mt-6">
                            <h3 className="font-bold mb-3 flex items-center gap-2 text-slate-900 dark:text-white"><ImageIcon size={16} /> Attached Media</h3>
                            {mediaUrl ? (
                                <div className="relative w-full md:w-1/2 h-48 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                    <img src={mediaUrl} className="w-full h-full object-cover" alt="Attached Media" />
                                    <button onClick={() => setMediaUrl('')} className="absolute top-2 right-2 bg-black/50 hover:bg-black text-white p-1.5 rounded-md text-xs font-bold">Remove</button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative">
                                    <input type="file" aria-label="Upload media" title="Upload media" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" />
                                    <div className="text-center text-slate-500 pointer-events-none">
                                        {isUploading ? <RefreshCw className="animate-spin mx-auto mb-2" /> : <ImageIcon className="mx-auto mb-2 opacity-50" />}
                                        <p className="text-sm font-bold">{isUploading ? 'Uploading...' : 'Click or drag image to attach'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Column (Networks) */}
                <div className="space-y-6">
                    <Card className="p-6 relative overflow-hidden">
                        <div>
                            <h3 className="font-bold mb-4 text-slate-900 dark:text-white">Select Networks</h3>
                            <div className="space-y-3">
                                {/* X (Twitter) Authentication Module */}
                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 ">
                                    <div className="flex items-center justify-between gap-1 mb-3">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <span className="font-bold text-sm text-slate-900 dark:text-white truncate">X (Twitter) <span className="font-normal text-xs ml-2 text-slate-500">(Coming Soon)</span></span>
                                            {isXConnected && <span className="hidden xl:inline-block text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Connected</span>}
                                        </div>
                                        {isXConnected ? (
                                            <div className="flex items-center gap-2 shrink-0 pl-1">
                                                <button onClick={handleDisconnectX} className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-500 transition-colors shrink-0">Disconnect</button>
                                                <input type="checkbox" title="Toggle X posting" aria-label="Toggle X posting" checked={postToX} onChange={() => setPostToX(!postToX)} className="w-4 h-4 text-primary-600 rounded border-slate-300 cursor-pointer shrink-0 focus:ring-primary-500" />
                                            </div>
                                        ) : (
                                            <button 
                                                disabled
                                                className="text-xs font-bold bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 px-3 py-1.5 rounded-md transition-colors shrink-0 cursor-not-allowed"
                                            >
                                                Connect
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-tight">Authorize TekTrakker to post organic updates securely via your Developer API credentials.</p>
                                </div>

                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between gap-1 mb-3">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <span className="font-bold text-sm text-[#1877F2] truncate">Facebook System</span>
                                            {isFBConnected && <span className="hidden xl:inline-block text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Connected</span>}
                                        </div>
                                        {isFBConnected ? (
                                            <div className="flex items-center gap-2 shrink-0 pl-1">
                                                <button onClick={handleDisconnectFB} className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-500 transition-colors shrink-0">Disconnect</button>
                                                <input type="checkbox" title="Toggle Facebook posting" aria-label="Toggle Facebook posting" checked={postToFB} onChange={() => setPostToFB(!postToFB)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer shrink-0" />
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={handleConnectFB}
                                                disabled={isFBConnecting}
                                                className="text-xs font-bold bg-[#1877F2] text-white hover:bg-blue-700 px-3 py-1.5 rounded-md transition-colors shrink-0"
                                            >
                                                {isFBConnecting ? "Connecting..." : "Connect"}
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-tight mb-2">Authorize TekTrakker to manage your Facebook Pages and Groups.</p>
                                    
                                    {isFBConnected && fbPages.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 block">Routing Target:</span>
                                            <select 
                                                title="Select Facebook Page"
                                                aria-label="Select Facebook Page"
                                                value={selectedFbPageId}
                                                onChange={(e) => {
                                                    setSelectedFbPageId(e.target.value);
                                                    localStorage.setItem('master_fb_page_id', e.target.value);
                                                }}
                                                className="w-full text-xs font-bold p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white form-select shadow-sm focus:ring-2 focus:ring-[#1877F2]"
                                            >
                                                {fbPages.map((page: any) => (
                                                    <option key={page.id} value={page.id}>{page.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <label className="flex items-center justify-between p-3 pl-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <span className="font-bold text-sm text-[#E4405F]">Instagram Connected Apps</span>
                                    <input type="checkbox" checked={postToIG} onChange={() => setPostToIG(!postToIG)} disabled={!isFBConnected} className="w-4 h-4 text-primary-600 rounded border-slate-300 disabled:opacity-50 cursor-pointer" />
                                </label>
                                
                                {/* LinkedIn Authentication Module */}
                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between gap-1 mb-3">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <span className="font-bold text-sm text-[#0A66C2] truncate">LinkedIn Business</span>
                                            {isLIConnected && <span className="hidden xl:inline-block text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Connected</span>}
                                        </div>
                                        {isLIConnected ? (
                                            <div className="flex items-center gap-2 shrink-0 pl-1">
                                                <button onClick={handleDisconnectLI} className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-500 transition-colors shrink-0">Disconnect</button>
                                                <input id="postToLI" title="Post to LinkedIn" aria-label="Post to LinkedIn" type="checkbox" checked={postToLI} onChange={() => setPostToLI(!postToLI)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer shrink-0" />
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={handleConnectLI}
                                                disabled={isLIConnecting}
                                                className="text-xs font-bold bg-[#0A66C2] text-white hover:bg-blue-700 px-3 py-1.5 rounded-md transition-colors shrink-0"
                                            >
                                                {isLIConnecting ? "Connecting..." : "Connect"}
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-tight">Authorize TekTrakker to manage your LinkedIn Company Pages and profile posts.</p>
                                </div>

                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between gap-1 mb-3">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <span className="font-bold text-sm text-[#EA4335] truncate">Google Business</span>
                                            {isGBConnected && <span className="hidden xl:inline-block text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Connected</span>}
                                        </div>
                                        {isGBConnected ? (
                                            <div className="flex items-center gap-2 shrink-0 pl-1">
                                                <button onClick={handleDisconnectGB} className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-500 transition-colors shrink-0">Disconnect</button>
                                                <input id="postToGBMaster" title="Post to Google Business Profile" aria-label="Post to Google Business Profile" type="checkbox" checked={postToGB} onChange={() => setPostToGB(!postToGB)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer shrink-0" />
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={handleConnectGB}
                                                disabled={isGBConnecting}
                                                className="text-xs font-bold bg-[#EA4335] text-white hover:bg-red-600 px-3 py-1.5 rounded-md transition-colors shrink-0"
                                            >
                                                {isGBConnecting ? "Connecting..." : "Connect"}
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-tight">Authorize TekTrakker to manage your Google Business locations and local posts.</p>
                                </div>

                                {/* TikTok Authentication Module */}
                                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between gap-1 mb-3">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <span className="font-bold text-sm text-[#000000] dark:text-white truncate">TikTok <span className="font-normal text-xs ml-2 text-slate-500">(Coming Soon)</span></span>
                                            {isTTConnected && <span className="hidden xl:inline-block text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Connected</span>}
                                        </div>
                                        {isTTConnected ? (
                                            <div className="flex items-center gap-2 shrink-0 pl-1">
                                                <button onClick={handleDisconnectTT} className="text-[10px] uppercase font-bold text-slate-400 hover:text-red-500 transition-colors shrink-0">Disconnect</button>
                                                <input id="postToTTMaster" title="Post to TikTok" aria-label="Post to TikTok" type="checkbox" checked={postToTT} onChange={() => setPostToTT(!postToTT)} className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer shrink-0" />
                                            </div>
                                        ) : (
                                            <button 
                                                disabled
                                                className="text-xs font-bold bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 px-3 py-1.5 rounded-md transition-colors shrink-0 cursor-not-allowed"
                                            >
                                                Connect
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 leading-tight">Authorize TekTrakker to post organic, short-form service videos directly to your feed.</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                <Button 
                                    variant="outline"
                                    onClick={handleSaveTemplate}
                                    className="w-full py-3 font-bold flex items-center justify-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    💾 Save Draft
                                </Button>
                                <Button 
                                    disabled={isPosting || (!postToFB && !postToIG && !postToLI && !postToGB && !postToX && !postToTT) || (!content.trim() && !mediaUrl)} 
                                    onClick={handlePublish}
                                    className="w-full py-3 font-black flex items-center justify-center gap-2"
                                >
                                    {isPosting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                                    {isPosting ? "Federating..." : "Publish Now"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <div className="mt-6">
                <Card className="p-6 border-indigo-100 dark:border-indigo-900 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <MessageSquare size={20} className="text-indigo-500" />
                            Unified Social Inbox
                        </h3>
                        <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">New Engine</span>
                    </div>

                    {isFBConnected ? (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-10 text-center relative z-10 transition-all">
                            <div className="bg-white dark:bg-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 dark:border-slate-700">
                                <MessageSquare size={28} className="text-indigo-400" />
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 text-lg">Inbox Online & Listening</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                                Your Facebook and Instagram Direct messaging pipeline is actively connected. Messages from your customers will funnel directly into this cross-platform console.
                            </p>
                            <Button variant="outline" className="mt-6 text-sm font-bold bg-white dark:bg-slate-800 border-slate-300 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                <RefreshCw size={14} className="mr-2" /> Sync Messages
                            </Button>
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-10 text-center flex flex-col items-center justify-center grayscale opacity-80">
                            <MessageSquare size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
                            <h4 className="font-bold text-slate-500 dark:text-slate-400">Inbox Requires Meta Authentication</h4>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm">Connect your Facebook System and authorize messenger scopes to unlock federated direct messaging.</p>
                        </div>
                    )}
                </Card>
            </div>

            {templates.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Saved Drafts & Templates</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {templates.map(t => (
                            <Card key={t.id} className="p-4 flex flex-col justify-between hover:border-primary-500 transition-colors cursor-pointer" onClick={() => { setContent(t.content); setMediaUrl(t.mediaUrl || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">{t.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">{t.content}</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 self-end">Click to load</span>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterSocialMediaHub;
