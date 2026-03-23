
import React from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import { Briefcase, Mail, CheckSquare } from 'lucide-react';
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
}

const ProfileTab: React.FC<ProfileTabProps> = ({
    orgName, setOrgName,
    email, setEmail,
    phone, setPhone,
    website, setWebsite,
    notificationEmails, setNotificationEmails,
    industry, setIndustry,
    supportedTrades, handleTradeToggle,
    allIndustries
}) => {
    return (
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
    );
};

export default ProfileTab;
