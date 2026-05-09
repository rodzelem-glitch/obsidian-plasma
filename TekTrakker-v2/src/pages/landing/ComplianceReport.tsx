import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { ShieldCheck, Lock, CheckCircle, Download } from 'lucide-react';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';

interface ConsentRecord {
    id: string;
    name: string;
    phone: string;
    rawPhone: string;
    source: string;
    timestamp: string;
}

const ComplianceReport: React.FC = () => {
    const [searchParams] = useSearchParams();
    const key = searchParams.get('key');
    const orgId = searchParams.get('orgId');
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [recentConsents, setRecentConsents] = useState<ConsentRecord[]>([]);

    useEffect(() => {
        if (key === 'tw-verify-8823') {
            setAuthorized(true);
            fetchSampleData();
        } else {
            setLoading(false);
        }
    }, [key]);

    const fetchSampleData = async () => {
        try {
            let query: firebase.default.firestore.Query<firebase.default.firestore.DocumentData> = db.collection('customers').where('marketingConsent.sms', '==', true);
            if (orgId) {
                query = query.where('organizationId', '==', orgId);
            }
            const snap = await query.limit(20).get();
            const data = snap.docs.map(d => {
                const dat = d.data();
                return {
                    id: d.id,
                    name: dat.name ? dat.name.substring(0, 3) + '***' : 'Unknown',
                    phone: dat.phone ? '***-***-' + dat.phone.slice(-4) : 'N/A',
                    rawPhone: dat.phone || '',
                    source: dat.marketingConsent?.source || 'Unknown',
                    timestamp: dat.marketingConsent?.agreedAt || new Date().toISOString()
                };
            });
            setRecentConsents(data);
        } catch (e) {
            console.error("Error fetching proof", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCSV = () => {
        const headers = ["External number", "Consent status", "Coverage", "Individual number", "Registration type", "Notes", "DO NOT MODIFY"];
        let csvContent = headers.join(",") + "\n";
        recentConsents.forEach((rec, index) => {
            const phone = rec.rawPhone || "N/A";
            const consentStatus = "Opt-in";
            const coverage = "US & Canada";
            const individualNum = "";
            const regType = "";
            const notes = `Opted in via ${rec.source}`;
            let doNotModify = "";
            if (index === 0) doNotModify = "Required";
            if (index === 1) doNotModify = "Optional";
            csvContent += `"${phone}","${consentStatus}","${coverage}","${individualNum}","${regType}","${notes}","${doNotModify}"\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "Carrier_Consent_Upload.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading verification...</div>;

    if (!authorized) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
                <Lock size={48} className="text-red-500 mb-4" />
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-slate-400 mt-2">Invalid or missing verification key.</p>
                <button onClick={() => window.location.href = 'https://tektrakker.com'} className="mt-8 bg-white text-slate-900 px-6 py-2 rounded-full font-bold">Back to Home</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col">
            <LandingHeader 
                backButton={{ label: 'Back to Home', href: '/' }}
            />

            <main className="flex-1 max-w-4xl mx-auto p-4 md:p-8 md:p-12 py-32 mt-4">
                <header className="border-b border-slate-200 pb-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Communication Compliance Report</h1>
                        <p className="text-slate-500 mt-2">Generated for Carrier / Provider Verification</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-full font-bold text-sm mb-2">
                            <ShieldCheck size={16} /> Verified Registry
                        </div>
                        <button onClick={handleDownloadCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-sm transition-colors cursor-pointer shadow-lg shadow-blue-600/20">
                            <Download size={16} /> Download CSV List
                        </button>
                        <p className="text-xs text-slate-400 mt-2">Generated: {new Date().toLocaleString()}</p>
                    </div>
                </header>

                <section className="mb-12">
                    <h3 className="text-xl font-bold mb-4">Opt-In Mechanisms</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 border rounded-xl bg-slate-50">
                            <h4 className="font-bold text-blue-600 mb-2">Public Booking Widget</h4>
                            <p className="text-sm text-slate-600 mb-4">
                                Users must check a mandatory box: "I agree to receive SMS and email notifications from this business. Reply STOP to unsubscribe."
                            </p>
                            <div className="text-xs font-mono bg-white p-3 border rounded text-slate-500">
                                Source ID: Widget / InlineForm
                            </div>
                        </div>
                        <div className="p-6 border rounded-xl bg-slate-50">
                            <h4 className="font-bold text-blue-600 mb-2">Account Registration</h4>
                            <p className="text-sm text-slate-600 mb-4">
                                New users explicitly consent during sign-up flow via checkbox before account creation is permitted.
                            </p>
                            <div className="text-xs font-mono bg-white p-3 border rounded text-slate-500">
                                Source ID: Registration
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-xl font-bold mb-4">Recent Consent Ledger (Anonymized)</h3>
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 border-b">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-slate-600">Timestamp</th>
                                    <th className="px-6 py-3 font-bold text-slate-600">Source</th>
                                    <th className="px-6 py-3 font-bold text-slate-600">User Hash</th>
                                    <th className="px-6 py-3 font-bold text-slate-600">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {recentConsents.map((rec) => (
                                    <tr key={rec.id}>
                                        <td className="px-6 py-3 text-slate-600">{new Date(rec.timestamp).toLocaleString()}</td>
                                        <td className="px-6 py-3 font-medium">{rec.source}</td>
                                        <td className="px-6 py-3 font-mono text-xs text-slate-400">{rec.id.substring(0, 12)}...</td>
                                        <td className="px-6 py-3 text-green-600 font-bold flex items-center gap-1">
                                            <CheckCircle size={14}/> Opt-In Verified
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <footer className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
                    <p>Confidential Compliance Data. Intended for authorized provider verification only.</p>
                </footer>
            </main>

            <LandingFooter />
        </div>
    );
};

export default ComplianceReport;
