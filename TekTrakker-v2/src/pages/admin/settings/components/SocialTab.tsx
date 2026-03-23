
import React from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import { Globe, Star, Cloud, Facebook, Instagram, Twitter, Linkedin, Youtube, CheckCircle2 } from 'lucide-react';

interface SocialTabProps {
    socialLinks: {
        facebook?: string;
        instagram?: string;
        tiktok?: string;
        linkedin?: string;
        x?: string;
        youtube?: string;
    };
    setSocialLinks: (links: any) => void;
    reviewLinks: {
        google?: string;
        yelp?: string;
        nextdoor?: string;
        angi?: string;
        bbb?: string;
        trustpilot?: string;
        homeadvisor?: string;
        houzz?: string;
    };
    setReviewLinks: (links: any) => void;
    googleApiConnected: boolean;
    googleClientId: string;
    setGoogleClientId: (val: string) => void;
    handleConnectGoogle: () => void;
    handleDisconnectGoogle: () => void;
    isConnectingGoogle: boolean;
}

const SocialTab: React.FC<SocialTabProps> = ({
    socialLinks, setSocialLinks,
    reviewLinks, setReviewLinks,
    googleApiConnected,
    googleClientId, setGoogleClientId,
    handleConnectGoogle, handleDisconnectGoogle,
    isConnectingGoogle
}) => {
    return (
        <div className="space-y-6">
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600"><Globe size={20}/> Social Media Profiles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="relative">
                            <Facebook className="absolute left-3 top-10 text-blue-600" size={18} />
                            <Input className="pl-10" label="Facebook URL" value={socialLinks.facebook || ''} onChange={e => setSocialLinks({...socialLinks, facebook: e.target.value})} placeholder="https://facebook.com/yourpage" />
                        </div>
                        <div className="relative">
                            <Instagram className="absolute left-3 top-10 text-pink-600" size={18} />
                            <Input className="pl-10" label="Instagram URL" value={socialLinks.instagram || ''} onChange={e => setSocialLinks({...socialLinks, instagram: e.target.value})} placeholder="https://instagram.com/yourhandle" />
                        </div>
                        <div className="relative">
                            <Twitter className="absolute left-3 top-10 text-slate-800 dark:text-slate-200" size={18} />
                            <Input className="pl-10" label="X (Twitter) URL" value={socialLinks.x || ''} onChange={e => setSocialLinks({...socialLinks, x: e.target.value})} placeholder="https://x.com/yourhandle" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="relative">
                            <Linkedin className="absolute left-3 top-10 text-blue-700" size={18} />
                            <Input className="pl-10" label="LinkedIn URL" value={socialLinks.linkedin || ''} onChange={e => setSocialLinks({...socialLinks, linkedin: e.target.value})} placeholder="https://linkedin.com/company/yourpage" />
                        </div>
                        <div className="relative">
                            <Youtube className="absolute left-3 top-10 text-red-600" size={18} />
                            <Input className="pl-10" label="YouTube URL" value={socialLinks.youtube || ''} onChange={e => setSocialLinks({...socialLinks, youtube: e.target.value})} placeholder="https://youtube.com/@yourchannel" />
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-10 font-bold text-black text-sm">Tik</span>
                            <Input className="pl-10" label="TikTok URL" value={socialLinks.tiktok || ''} onChange={e => setSocialLinks({...socialLinks, tiktok: e.target.value})} placeholder="https://tiktok.com/@yourhandle" />
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-yellow-600"><Star size={20}/> Review Site Profiles</h3>
                <p className="text-sm text-slate-500 mb-4">Adding these links improves the AI Review Scraper accuracy significantly.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <Input label="Google Business Profile (Maps Link)" value={reviewLinks.google || ''} onChange={e => setReviewLinks({...reviewLinks, google: e.target.value})} placeholder="https://maps.app.goo.gl/..." />
                        <Input label="Yelp Page URL" value={reviewLinks.yelp || ''} onChange={e => setReviewLinks({...reviewLinks, yelp: e.target.value})} placeholder="https://yelp.com/biz/..." />
                        <Input label="Nextdoor Business Page" value={reviewLinks.nextdoor || ''} onChange={e => setReviewLinks({...reviewLinks, nextdoor: e.target.value})} placeholder="https://nextdoor.com/pages/..." />
                        <Input label="Angi / HomeAdvisor" value={reviewLinks.angi || ''} onChange={e => setReviewLinks({...reviewLinks, angi: e.target.value})} />
                    </div>
                    <div className="space-y-4">
                        <Input label="Better Business Bureau (BBB)" value={reviewLinks.bbb || ''} onChange={e => setReviewLinks({...reviewLinks, bbb: e.target.value})} />
                        <Input label="Trustpilot URL" value={reviewLinks.trustpilot || ''} onChange={e => setReviewLinks({...reviewLinks, trustpilot: e.target.value})} />
                        <Input label="Houzz Profile" value={reviewLinks.houzz || ''} onChange={e => setReviewLinks({...reviewLinks, houzz: e.target.value})} />
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-600"><Cloud size={20}/> Google Integration</h3>
                <div className={`p-6 rounded-lg border ${googleApiConnected ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
                    <p className="text-sm font-bold mb-4 flex items-center gap-2">
                        {googleApiConnected ? <CheckCircle2 size={16} className="text-green-600"/> : <Cloud size={16}/>} 
                        Google Business Profile Connection
                    </p>
                    
                    {googleApiConnected ? (
                        <div>
                            <p className="text-xs text-green-700 dark:text-green-400 mb-3">Status: Connected</p>
                            <Button onClick={handleDisconnectGoogle} variant="secondary" className="w-full sm:w-auto text-xs text-red-600 border-red-200 bg-red-50 hover:bg-red-100">Disconnect</Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500">Connect to fetch verified reviews and manage your profile directly.</p>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Google Client ID (OAuth 2.0)</label>
                                <Input 
                                    value={googleClientId} 
                                    onChange={e => setGoogleClientId(e.target.value)} 
                                    placeholder="e.g. 123456789-abc...apps.googleusercontent.com" 
                                    className="text-xs"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Found in Google Cloud Console &gt; APIs & Services &gt; Credentials</p>
                            </div>
                            <Button onClick={handleConnectGoogle} disabled={isConnectingGoogle || !googleClientId} className="w-full sm:w-auto text-xs bg-blue-600 hover:bg-blue-700 text-white">
                                {isConnectingGoogle ? 'Connecting...' : 'Connect with Google'}
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default SocialTab;
