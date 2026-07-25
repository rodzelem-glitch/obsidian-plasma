import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppContext } from '../../context/AppContext';
import { Building2, Search, Briefcase, Filter, ArrowRight, Loader2, DollarSign, Calendar, MapPin, Globe, Bell } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import showToast from '../../lib/toast';
import { db } from '../../lib/firebase';

interface GovOpportunity {
    noticeId: string;
    title: string;
    solicitationNumber: string;
    department: string;
    subTier: string;
    office: string;
    postedDate: string;
    type: string;
    baseType: string;
    archiveType: string;
    archiveDate: string;
    typeOfSetAsideDescription: string;
    typeOfSetAside: string;
    responseDeadLine: string;
    naicsCode: string;
    naicsCodes: string[];
    classificationCode: string;
    active: 'Yes' | 'No';
    pointOfContact: unknown[];
    description: string;
    uiLink: string;
}

const GovContracts: React.FC = () => {
    const { state } = useAppContext();
    const [opportunities, setOpportunities] = useState<GovOpportunity[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingAlert, setSavingAlert] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // Filters
    const [naicsCode, setNaicsCode] = useState(state.currentOrganization?.primaryNaics || '');
    const [keyword, setKeyword] = useState('');
    const [targetState, setTargetState] = useState(state.currentOrganization?.address?.state || '');
    const [targetCity, setTargetCity] = useState(state.currentOrganization?.address?.city || '');
    const [targetZip, setTargetZip] = useState(state.currentOrganization?.address?.zip || '');

    const fetchContracts = async () => {
        setLoading(true);
        setError(null);
        try {
            const functions = getFunctions();
            const fetchFederalContracts = httpsCallable(functions, 'fetchFederalContracts');
            
            const toDate = new Date();
            const fromDate = new Date();
            fromDate.setDate(toDate.getDate() - 30);
            
            const formatDateForApi = (date: Date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${mm}/${dd}/${yyyy}`;
            };
            
            const result = await fetchFederalContracts({
                naicsCode: naicsCode.trim(),
                keyword: keyword.trim(),
                state: targetState.trim(),
                city: targetCity.trim(),
                zip: targetZip.trim(),
                postedFrom: formatDateForApi(fromDate),
                postedTo: formatDateForApi(toDate),
                limit: 50
            });
            
            const data = result.data as Record<string, unknown>;
            if (data.success) {
                setOpportunities(data.opportunities as GovOpportunity[]);
            } else {
                throw new Error((data.error as string) || "Failed to load federal contracts.");
            }
        } catch (err: unknown) {
            console.error("Failed to fetch SAM.gov contracts", err);
            setError((err as Error).message || "Failed to load federal contracts.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []); // Auto load on mount

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString();
    };

    const handleSaveAlert = async () => {
        if (!state.currentOrganization) return;
        setSavingAlert(true);
        try {
            await db.collection('organizations').doc(state.currentOrganization.id).collection('sam_alerts').add(cleanUndefinedFields({
                naicsCode,
                keyword,
                targetState,
                targetCity,
                targetZip,
                email: state.currentUser?.email || '',
                createdAt: new Date().toISOString()
            }));
            showToast.success("Search alert saved! You will receive notifications when new matches appear.");
        } catch (e) {
            console.error("Failed to save alert", e);
            showToast.error("Failed to save search alert.");
        } finally {
            setSavingAlert(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-gradient-to-r from-blue-900 to-indigo-800 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                    <Globe size={300} />
                </div>
                <div className="relative z-10">
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <Building2 className="text-blue-300" size={32} />
                        Federal Contract Exchange
                    </h1>
                    <p className="text-blue-100 mt-2 text-lg max-w-2xl">
                        Discover and bid on active government solicitations from SAM.gov matched to your business profile.
                    </p>
                </div>
                <div className="relative z-10 flex gap-3">
                    <Button variant="secondary" className="bg-white/10 hover:bg-white/20 border-white/20 text-white backdrop-blur-md font-bold">
                        Learn about Gov Bidding
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-blue-100 dark:border-blue-900 shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
                    <div className="xl:col-span-2">
                        <label htmlFor="keyword-input" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Keywords / Title</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                id="keyword-input"
                                type="text"
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                placeholder="e.g. HVAC Repair, Electrical..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="naics-input" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">NAICS Code</label>
                        <input 
                            id="naics-input"
                            type="text"
                            value={naicsCode}
                            onChange={e => setNaicsCode(e.target.value)}
                            placeholder="e.g. 238220"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="state-input" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">State</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                id="state-input"
                                type="text"
                                value={targetState}
                                onChange={e => setTargetState(e.target.value.toUpperCase())}
                                placeholder="TX, CA..."
                                maxLength={2}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="city-input" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">City</label>
                        <input 
                            id="city-input"
                            type="text"
                            value={targetCity}
                            onChange={e => setTargetCity(e.target.value)}
                            placeholder="e.g. Dallas"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="zip-input" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Zip</label>
                        <input 
                            id="zip-input"
                            type="text"
                            value={targetZip}
                            onChange={e => setTargetZip(e.target.value)}
                            placeholder="e.g. 75001"
                            maxLength={10}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="xl:col-span-6 flex flex-col md:flex-row justify-between items-start md:items-center mt-2 gap-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                            <span className="font-bold text-blue-500">Pro Tip:</span> SAM.gov treats all filled fields as strict requirements. If you aren't getting enough results, try searching with just one location field at a time (e.g., just State, or just Zip).
                        </p>
                        <Button 
                            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-8"
                            onClick={fetchContracts}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Search Solicitations'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl font-medium">
                    {error}
                </div>
            )}

            {/* Results */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Briefcase className="text-blue-500" />
                        Active Solicitations <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 py-0.5 px-2 rounded-full text-sm">{opportunities.length}</span>
                    </h2>
                    {opportunities.length > 0 && (
                        <Button 
                            variant="secondary" 
                            onClick={handleSaveAlert} 
                            disabled={savingAlert}
                            className="text-sm font-semibold flex items-center gap-2"
                        >
                            <Bell size={16} />
                            {savingAlert ? 'Saving...' : 'Save Search Alert'}
                        </Button>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20 text-slate-400">
                        <Loader2 className="animate-spin" size={48} />
                    </div>
                ) : opportunities.length === 0 ? (
                    <Card className={error ? "text-center py-20 border-dashed border-2 border-red-200 dark:border-red-900/50" : "text-center py-20 border-dashed border-2"}>
                        <Filter className={error ? "mx-auto text-red-300 dark:text-red-800/50 mb-4" : "mx-auto text-slate-300 mb-4"} size={48} />
                        <h3 className={error ? "text-lg font-bold text-red-700 dark:text-red-400" : "text-lg font-bold text-slate-700 dark:text-slate-300"}>
                            {error ? "Search Unavailable" : "No opportunities found"}
                        </h3>
                        <p className="text-slate-500 mt-2">
                            {error ? "We could not fetch data due to SAM.gov API gateway stability issues. Please try again later." : "Try adjusting your NAICS code or state filter to find more contracts."}
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {opportunities.map((opp, idx) => (
                            <Card key={opp.noticeId || idx} className="hover:shadow-lg transition-all border border-slate-200 dark:border-slate-700 group hover:border-blue-300 dark:hover:border-blue-700">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-md uppercase tracking-wider">
                                                {opp.type}
                                            </span>
                                            {opp.typeOfSetAsideDescription && (
                                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-md flex items-center gap-1">
                                                    <DollarSign size={12} /> {opp.typeOfSetAsideDescription}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {opp.title}
                                        </h3>
                                        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 space-y-1">
                                            <p className="font-medium text-slate-700 dark:text-slate-300"><Building2 size={14} className="inline mr-1"/> {opp.department} {opp.subTier ? `> ${opp.subTier}` : ''}</p>
                                            <p><span className="font-semibold">Notice ID:</span> {opp.noticeId}</p>
                                            <p><span className="font-semibold">NAICS:</span> {opp.naicsCode}</p>
                                        </div>
                                    </div>

                                    <div className="md:w-64 flex flex-col justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase">Posted Date</p>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                    <Calendar size={14} className="text-blue-500" />
                                                    {formatDate(opp.postedDate)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase">Response Deadline</p>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                    <Calendar size={14} className="text-red-500" />
                                                    {formatDate(opp.responseDeadLine)}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 mt-4">
                                            <Button 
                                                className="flex-1 bg-slate-900 dark:bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
                                                onClick={() => navigate(`/admin/contracts?noticeId=${opp.noticeId}&title=${encodeURIComponent(opp.title)}`)}
                                            >
                                                Draft Bid
                                            </Button>
                                            <a 
                                                href={opp.uiLink} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold px-4 rounded-lg transition-colors"
                                                title="View on SAM.gov"
                                            >
                                                <ArrowRight size={16} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GovContracts;
