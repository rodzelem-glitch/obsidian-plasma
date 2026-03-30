
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
        trustpilot?: string;
        angi?: string;
        thumbtack?: string;
    };
    setReviewLinks: (links: any) => void;
}

const SocialTab: React.FC<SocialTabProps> = ({
    socialLinks, setSocialLinks,
    reviewLinks, setReviewLinks
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
                <div className="flex items-center gap-3 mb-4">
                    <Star size={24} className="text-yellow-500" />
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">External Review Sync</h3>
                        <p className="text-xs text-slate-500">We automatically ingest your public reviews so you can use TekTrakker's AI to draft responses natively.</p>
                    </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 mb-6">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Link Your Profiles:</strong> Paste the exact public URLs for your business profiles below. Your reviews will automatically sync to your Review Hub.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                    <div className="space-y-4">
                        <Input label="Google Maps (Places URL)" value={reviewLinks.google || ''} onChange={e => setReviewLinks({...reviewLinks, google: e.target.value})} placeholder="https://maps.app.goo.gl/..." />
                        <Input label="Yelp Business Page" value={reviewLinks.yelp || ''} onChange={e => setReviewLinks({...reviewLinks, yelp: e.target.value})} placeholder="https://yelp.com/biz/..." />
                    </div>
                    <div className="space-y-4">
                        <Input label="Nextdoor Business Page" value={reviewLinks.nextdoor || ''} onChange={e => setReviewLinks({...reviewLinks, nextdoor: e.target.value})} placeholder="https://nextdoor.com/pages/..." />
                        <Input label="Trustpilot URL" value={reviewLinks.trustpilot || ''} onChange={e => setReviewLinks({...reviewLinks, trustpilot: e.target.value})} placeholder="https://trustpilot.com/review/..." />
                    </div>
                    <div className="space-y-4">
                        <Input label="Angi (Angie's List) URL" value={reviewLinks.angi || ''} onChange={e => setReviewLinks({...reviewLinks, angi: e.target.value})} placeholder="https://www.angi.com/companylist/..." />
                        <Input label="Thumbtack Pro Profile" value={reviewLinks.thumbtack || ''} onChange={e => setReviewLinks({...reviewLinks, thumbtack: e.target.value})} placeholder="https://www.thumbtack.com/..." />
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default SocialTab;
