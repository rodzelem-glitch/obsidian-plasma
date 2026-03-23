
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import { db } from 'lib/firebase';
import type { Customer, User, Organization } from 'types';
import { ShieldCheck, Search, Download, ExternalLink, CheckCircle, Clock } from 'lucide-react';

const ComplianceRegistry: React.FC = () => {
    const { state } = useAppContext();
    const [optInRecords, setOptInRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSource, setFilterSource] = useState('All');
    const [orgFilter, setOrgFilter] = useState('All');
    
    // For Verification Link Generation
    const [isLinkGenerated, setIsLinkGenerated] = useState(false);
    const [verificationLink, setVerificationLink] = useState('');

    useEffect(() => {
        const fetchConsents = async () => {
            setLoading(true);
            try {
                // Fetch Customers with Consent
                const custSnap = await db.collection('customers').get();
                const customers = custSnap.docs
                    .map(d => ({ ...d.data(), id: d.id, type: 'Customer' } as any))
                    .filter(c => c.marketingConsent?.sms || c.marketingConsent?.email);

                // Fetch Users with Consent
                const userSnap = await db.collection('users').get();
                const users = userSnap.docs
                    .map(d => ({ ...d.data(), id: d.id, type: 'User' } as any))
                    .filter(u => u.marketingConsent?.sms || u.marketingConsent?.email);
                
                // Fetch Applicants with Consent
                const appSnap = await db.collection('applicants').get();
                const applicants = appSnap.docs
                    .map(d => ({ ...d.data(), id: d.id, type: 'Applicant', name: d.data().firstName + ' ' + d.data().lastName } as any))
                    .filter(a => a.marketingConsent?.sms || a.marketingConsent?.email);

                // Combine
                const allRecords = [...customers, ...users, ...applicants].sort((a,b) => 
                    new Date(b.marketingConsent.agreedAt).getTime() - new Date(a.marketingConsent.agreedAt).getTime()
                );
                
                setOptInRecords(allRecords);
            } catch (e) {
                console.error("Failed to fetch consents", e);
            } finally {
                setLoading(false);
            }
        };
        fetchConsents();
    }, []);

    const getOrgName = (orgId: string) => {
        const org = state.allOrganizations.find(o => o.id === orgId);
        return org ? org.name : (orgId === 'platform' ? 'Platform' : orgId);
    };

    const filteredRecords = useMemo(() => {
        return optInRecords.filter(r => {
            const name = r.name || (r.firstName + ' ' + r.lastName) || '';
            const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (r.phone || '').includes(searchTerm) || 
                                  (r.email || '').includes(searchTerm);
            
            const matchesSource = filterSource === 'All' || r.marketingConsent.source === filterSource;
            const matchesOrg = orgFilter === 'All' || r.organizationId === orgFilter;

            return matchesSearch && matchesSource && matchesOrg;
        });
    }, [optInRecords, searchTerm, filterSource, orgFilter]);

    const handleExport = () => {
        const csvRows = [
            ['Name', 'Email', 'Phone', 'Type', 'Organization', 'Consent Date', 'Source', 'SMS Opt-in', 'Email Opt-in', 'IP Address'],
            ...filteredRecords.map(r => [
                JSON.stringify(r.name || (r.firstName + ' ' + r.lastName)),
                JSON.stringify(r.email || ''),
                JSON.stringify(r.phone || ''),
                JSON.stringify(r.type),
                JSON.stringify(getOrgName(r.organizationId)),
                JSON.stringify(new Date(r.marketingConsent.agreedAt).toLocaleString()),
                JSON.stringify(r.marketingConsent.source),
                JSON.stringify(r.marketingConsent.sms ? 'Yes' : 'No'),
                JSON.stringify(r.marketingConsent.email ? 'Yes' : 'No'),
                JSON.stringify(r.marketingConsent.ip || 'N/A')
            ])
        ];
        
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `compliance_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateVerificationLink = () => {
        // In a real scenario, generate a secure token. For now, use a static key.
        // The secure route is '/compliance-view?key=tw-verify-8823'
        const link = `${window.location.origin}/#/compliance-view?key=tw-verify-8823`;
        setVerificationLink(link);
        setIsLinkGenerated(true);
    };

    return (
        <div className="space-y-6 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="text-blue-600"/> Compliance Registry
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">Database of users who have explicitly opted-in to communications.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExport} variant="secondary" className="flex items-center gap-2">
                        <Download size={16}/> Export CSV
                    </Button>
                    <Button onClick={generateVerificationLink} className="flex items-center gap-2">
                        <ExternalLink size={16}/> Generate Provider Link
                    </Button>
                </div>
            </header>

            {isLinkGenerated && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in">
                    <div>
                        <h4 className="font-bold text-blue-800 text-sm">Provider Verification Link Active</h4>
                        <p className="text-xs text-blue-600">Share this secure link with Twilio or carriers to prove consent collection mechanisms.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <input readOnly value={verificationLink} className="flex-1 text-xs p-2 rounded border bg-white min-w-[300px]" />
                        <Button onClick={() => window.open(verificationLink, '_blank')} className="text-xs">View</Button>
                    </div>
                </div>
            )}

            <Card>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <Input 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            placeholder="Search name, phone, or email..." 
                            className="pl-10"
                        />
                    </div>
                    <Select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="w-40">
                        <option value="All">All Sources</option>
                        <option value="Widget">Booking Widget</option>
                        <option value="HiringWidget">Hiring Widget</option>
                        <option value="Registration">Registration</option>
                        <option value="Portal">Customer Portal</option>
                    </Select>
                    <Select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className="w-48">
                        <option value="All">All Organizations</option>
                        {state.allOrganizations.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </Select>
                </div>

                <Table headers={['Identity', 'Organization', 'Consent Details', 'Source', 'Timestamp', 'Status']}>
                    {loading ? (
                         <tr><td colSpan={6} className="p-4 md:p-8 text-center text-gray-400">Loading registry...</td></tr>
                    ) : filteredRecords.map((rec, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4">
                                <div className="font-bold text-slate-900 dark:text-white">{rec.name || rec.firstName + ' ' + rec.lastName}</div>
                                <div className="text-xs text-slate-500">{rec.phone || rec.email}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                {getOrgName(rec.organizationId)}
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex gap-2">
                                    {rec.marketingConsent.sms && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">SMS</span>}
                                    {rec.marketingConsent.email && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase">Email</span>}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium">{rec.marketingConsent.source}</td>
                            <td className="px-6 py-4 text-xs text-slate-500 flex items-center gap-1">
                                <Clock size={12}/> {new Date(rec.marketingConsent.agreedAt).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                                <span className="flex items-center gap-1 text-green-600 text-xs font-bold uppercase">
                                    <CheckCircle size={14}/> Opted-In
                                </span>
                            </td>
                        </tr>
                    ))}
                    {filteredRecords.length === 0 && !loading && (
                        <tr><td colSpan={6} className="p-4 md:p-8 text-center text-gray-400">No records found matching filters.</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};

export default ComplianceRegistry;
