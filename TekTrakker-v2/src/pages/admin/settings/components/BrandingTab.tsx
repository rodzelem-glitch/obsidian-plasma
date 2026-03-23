
import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Toggle from 'components/ui/Toggle';
import Textarea from 'components/ui/Textarea';
import Button from 'components/ui/Button';
import { Palette, Store, X, BadgeCheck, Wrench } from 'lucide-react';

interface BrandingTabProps {
    brandingColor: string;
    setBrandingColor: (val: string) => void;
    financingLink: string;
    setFinancingLink: (val: string) => void;
    logoUrl: string;
    setLogoUrl: (val: string) => void;
    publicLogoUrl: string;
    setPublicLogoUrl: (val: string) => void;
    letterheadUrl: string;
    setLetterheadUrl: (val: string) => void;
    footerImageUrl: string;
    setFooterImageUrl: (val: string) => void;
    bannerUrl: string;
    setBannerUrl: (val: string) => void;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => void;
    publicProfileEnabled: boolean;
    setPublicProfileEnabled: (val: boolean) => void;
    publicDescription: string;
    setPublicDescription: (val: string) => void;
    publicCredentials: string[];
    setPublicCredentials: (creds: string[]) => void;
    publicServices: string[];
    setPublicServices: (services: string[]) => void;
}

const BrandingTab: React.FC<BrandingTabProps> = ({
    brandingColor, setBrandingColor,
    financingLink, setFinancingLink,
    logoUrl, setLogoUrl,
    publicLogoUrl, setPublicLogoUrl,
    letterheadUrl, setLetterheadUrl,
    footerImageUrl, setFooterImageUrl,
    bannerUrl, setBannerUrl,
    handleFileUpload,
    publicProfileEnabled, setPublicProfileEnabled,
    publicDescription, setPublicDescription,
    publicCredentials, setPublicCredentials,
    publicServices, setPublicServices
}) => {
    const [newCredential, setNewCredential] = useState('');
    const [newService, setNewService] = useState('');

    const handleAddCredential = () => {
        if (newCredential.trim() && !publicCredentials.includes(newCredential.trim())) {
            setPublicCredentials([...publicCredentials, newCredential.trim()]);
            setNewCredential('');
        }
    };

    const handleRemoveCredential = (index: number) => {
        const updatedCredentials = publicCredentials.filter((_, i) => i !== index);
        setPublicCredentials(updatedCredentials);
    };

    const handleAddService = () => {
        if (newService.trim() && !publicServices.includes(newService.trim())) {
            setPublicServices([...publicServices, newService.trim()]);
            setNewService('');
        }
    };

    const handleRemoveService = (index: number) => {
        const updatedServices = publicServices.filter((_, i) => i !== index);
        setPublicServices(updatedServices);
    };

    return (
        <div className="space-y-6">
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-pink-600"><Palette size={20}/> Brand Customization</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Primary Brand Color</label>
                            <div className="flex gap-2">
                                <input type="color" className="h-10 w-10 rounded cursor-pointer border-0" value={brandingColor} onChange={e => setBrandingColor(e.target.value)} />
                                <Input value={brandingColor} onChange={e => setBrandingColor(e.target.value)} className="flex-1" />
                            </div>
                        </div>
                        <Input label="Financing Link URL" value={financingLink} onChange={e => setFinancingLink(e.target.value)} placeholder="https://wisetack.com/..." />
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Company Logo (Internal)</label>
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded border flex items-center justify-center overflow-hidden">
                                    {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">No Logo</span>}
                                </div>
                                <label className="cursor-pointer bg-white dark:bg-slate-700 border px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                                    Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setLogoUrl)} />
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Document Letterhead</label>
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-32 bg-slate-100 dark:bg-slate-800 rounded border flex items-center justify-center overflow-hidden">
                                    {letterheadUrl ? <img src={letterheadUrl} alt="Header" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">No Header</span>}
                                </div>
                                <label className="cursor-pointer bg-white dark:bg-slate-700 border px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                                    Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setLetterheadUrl)} />
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Footer Image (Invoice)</label>
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-32 bg-slate-100 dark:bg-slate-800 rounded border flex items-center justify-center overflow-hidden">
                                    {footerImageUrl ? <img src={footerImageUrl} alt="Footer" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">No Footer</span>}
                                </div>
                                <label className="cursor-pointer bg-white dark:bg-slate-700 border px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                                    Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setFooterImageUrl)} />
                                </label>
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Profile Banner Image</label>
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-32 bg-slate-100 dark:bg-slate-800 rounded border flex items-center justify-center overflow-hidden">
                                    {bannerUrl ? <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">No Banner</span>}
                                </div>
                                <label className="cursor-pointer bg-white dark:bg-slate-700 border px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                                    Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setBannerUrl)} />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-cyan-600"><Store size={20}/> Public Marketplace Profile</h3>
                <div className="space-y-6">
                    <Toggle 
                        label="Enable Public Profile"
                        enabled={publicProfileEnabled}
                        onChange={setPublicProfileEnabled}
                        description="Allow your business to be listed in the public contractor marketplace."
                    />

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Public Profile Logo</label>
                         <div className="flex items-center gap-4">
                            <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded border flex items-center justify-center overflow-hidden">
                                {publicLogoUrl ? <img src={publicLogoUrl} alt="Public Logo" className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400">No Logo</span>}
                            </div>
                            <label className="cursor-pointer bg-white dark:bg-slate-700 border px-3 py-1.5 rounded text-sm hover:bg-gray-50">
                                Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, setPublicLogoUrl)} />
                            </label>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Optional. Use a square format for best results. If not provided, the internal logo will be used.</p>
                    </div>

                    <Textarea 
                        label="Public Business Description"
                        value={publicDescription}
                        onChange={e => setPublicDescription(e.target.value)}
                        placeholder="Describe your company's history, values, and the services you specialize in. This will be visible on your public profile."
                        rows={4}
                        disabled={!publicProfileEnabled}
                    />

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Public Services</label>
                        <p className="text-sm text-slate-500 mb-4">List the key services you offer (e.g., \"AC Repair\", \"Duct Cleaning\"). These will be displayed on your profile.</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {publicServices?.map((service, index) => (
                                <div key={index} className="flex items-center bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300 text-xs font-semibold px-2 py-1 rounded-full">
                                    <Wrench size={14} className="mr-1.5" />
                                    <span>{service}</span>
                                    <button onClick={() => handleRemoveService(index)} className="ml-2 text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newService}
                                onChange={e => setNewService(e.target.value)}
                                placeholder="e.g., AC Repair"
                                disabled={!publicProfileEnabled}
                            />
                            <Button onClick={handleAddService} disabled={!publicProfileEnabled || !newService.trim()}>Add</Button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Public Credentials</label>
                        <p className="text-sm text-slate-500 mb-4">Add credentials that build trust, like \"Licensed & Insured\" or \"20+ Years Experience\". These will be displayed as badges on your profile.</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {publicCredentials?.map((cred, index) => (
                                <div key={index} className="flex items-center bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-xs font-semibold px-2 py-1 rounded-full">
                                    <BadgeCheck size={14} className="mr-1.5" />
                                    <span>{cred}</span>
                                    <button onClick={() => handleRemoveCredential(index)} className="ml-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200">
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newCredential}
                                onChange={e => setNewCredential(e.target.value)}
                                placeholder="e.g., Licensed & Insured"
                                disabled={!publicProfileEnabled}
                            />
                            <Button onClick={handleAddCredential} disabled={!publicProfileEnabled || !newCredential.trim()}>Add</Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default BrandingTab;
