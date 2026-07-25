import React from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import { Briefcase, Mail, CheckSquare, ShieldCheck, FileText, Upload, Trash2, Download, Landmark, Calendar, File } from 'lucide-react';
import { IndustryVertical } from 'types';

interface ProfileTabProps {
    orgName: string;
    setOrgName: (val: string) => void;
    email: string;
    setEmail: (val: string) => void;
    phone: string;
    setPhone: (val: string) => void;
    website: string;
    setWebsite: (val: string) => void;
    notificationEmails: string;
    setNotificationEmails: (val: string) => void;
    industry: IndustryVertical;
    setIndustry: (val: IndustryVertical) => void;
    supportedTrades: IndustryVertical[];
    handleTradeToggle: (trade: IndustryVertical) => void;
    allIndustries: IndustryVertical[];
    
    // Business Registry Fields
    taxId: string;
    setTaxId: (val: string) => void;
    ein: string;
    setEin: (val: string) => void;
    businessType: string;
    setBusinessType: (val: string) => void;
    incorporationState: string;
    setIncorporationState: (val: string) => void;
    formationDate: string;
    setFormationDate: (val: string) => void;
    
    // Document Uploads
    businessDocuments: Array<{ id: string; name: string; url: string; uploadedAt: string }>;
    handleDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDeleteDocument: (id: string) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({
    orgName, setOrgName,
    email, setEmail,
    phone, setPhone,
    website, setWebsite,
    notificationEmails, setNotificationEmails,
    industry, setIndustry,
    supportedTrades, handleTradeToggle,
    allIndustries,
    taxId, setTaxId,
    ein, setEin,
    businessType, setBusinessType,
    incorporationState, setIncorporationState,
    formationDate, setFormationDate,
    businessDocuments,
    handleDocumentUpload,
    handleDeleteDocument
}) => {
    return (
        <div className="space-y-6">
            {/* Card 1: Core Contact Details */}
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-primary-600"><Briefcase size={20}/> Core Identity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input id="org-name" label="Official Business Name" value={orgName} onChange={e => setOrgName(e.target.value)} />
                    <Input id="org-email" label="Public Email (Main Contact)" value={email} onChange={e => setEmail(e.target.value)} />
                    <Input id="org-phone" label="Office Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                    <Input id="org-web" label="Corporate Website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
                    
                    <div className="md:col-span-2">
                        <Input 
                            id="org-notif-emails" 
                            label="Notification Emails (Admins)" 
                            value={notificationEmails} 
                            onChange={e => setNotificationEmails(e.target.value)} 
                            placeholder="admin@example.com, dispatch@example.com" 
                        />
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold flex items-center gap-1">
                            <Mail size={10} /> Receive alerts for new bookings and leads at these addresses (comma separated).
                        </p>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <Select id="org-industry" label="Primary Industry" value={industry} onChange={e => setIndustry(e.target.value as any)}>
                            {allIndustries.map(ind => (
                                <option key={ind} value={ind}>{ind}</option>
                            ))}
                        </Select>

                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-3">Additional Trade Capabilities</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {allIndustries.filter(ind => ind !== industry).map(trade => (
                                    <button 
                                        key={trade}
                                        type="button"
                                        onClick={() => handleTradeToggle(trade)}
                                        className={`text-xs px-3 py-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                                            supportedTrades.includes(trade) 
                                                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold' 
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                                        }`}
                                    >
                                        {supportedTrades.includes(trade) ? <CheckSquare size={14}/> : <div className="w-3.5 h-3.5 border rounded-sm"></div>}
                                        {trade}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 italic">
                                Select all services your company offers to enable relevant pricebooks and features.
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Card 2: Business Identification & Registry */}
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><ShieldCheck size={20}/> Business Registry & Identification</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input id="org-tax-id" label="Tax ID" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="XX-XXXXXXX" />
                    <Input id="org-ein" label="EIN" value={ein} onChange={e => setEin(e.target.value)} placeholder="XX-XXXXXXX" />
                    
                    <Select id="org-business-type" label="Business Structure / Type" value={businessType} onChange={e => setBusinessType(e.target.value)}>
                        <option value="">Select Structure...</option>
                        <option value="LLC">Limited Liability Company (LLC)</option>
                        <option value="S-Corp">S-Corporation</option>
                        <option value="C-Corp">C-Corporation</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Sole Proprietorship">Sole Proprietorship</option>
                        <option value="Other">Other</option>
                    </Select>

                    <Input id="org-inc-state" label="State of Incorporation / Registration" value={incorporationState} onChange={e => setIncorporationState(e.target.value)} placeholder="e.g. Delaware" />
                    
                    <div className="md:col-span-2">
                        <Input id="org-formation-date" type="date" label="Date of Formation" value={formationDate} onChange={e => setFormationDate(e.target.value)} />
                    </div>
                </div>
            </Card>

            {/* Card 3: Corporate & Business Documents */}
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><Landmark size={20}/> Corporate & Business Documents</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Upload area */}
                    <div className="lg:col-span-1">
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-primary-500 dark:hover:border-primary-400 transition-all duration-200 bg-slate-50/50 dark:bg-slate-900/30">
                            <Upload className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                            <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Upload Document</span>
                            <span className="block text-[10px] text-slate-400 dark:text-slate-500 mb-4">Operating Agreement, Minutes, Bylaws, etc.</span>
                            <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg cursor-pointer shadow-sm hover:shadow transition-all duration-150 uppercase tracking-wider">
                                <span>Select File</span>
                                <input type="file" className="hidden" onChange={handleDocumentUpload} />
                            </label>
                        </div>
                    </div>

                    {/* Right: Uploaded documents list */}
                    <div className="lg:col-span-2 space-y-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Uploaded Documents</p>
                        
                        {businessDocuments && businessDocuments.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {businessDocuments.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-all duration-150 group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                <FileText size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">{doc.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Uploaded on {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a href={doc.url} download={doc.name} target="_blank" rel="noreferrer" title="Download Document" className="p-2 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                                <Download size={16} />
                                            </a>
                                            <button type="button" onClick={() => handleDeleteDocument(doc.id)} title="Delete Document" className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/20 dark:bg-slate-900/10">
                                <File size={32} className="text-slate-300 dark:text-slate-700 mb-2" />
                                <p className="text-xs text-slate-400">No business documents uploaded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ProfileTab;
