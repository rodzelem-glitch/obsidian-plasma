
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { PlatformLead } from 'types';
import { DollarSign, Search, Filter } from 'lucide-react';
import Card from 'components/ui/Card';
import { useNavigate } from 'react-router-dom';
import Toggle from 'components/ui/Toggle';

const COLUMNS = ['New', 'Contacted', 'Demo Scheduled', 'Proposal Sent', 'Negotiation', 'Closed Won'];
const COL_COLORS: Record<string, string> = {
    'New': 'border-blue-500',
    'Contacted': 'border-sky-500',
    'Demo Scheduled': 'border-purple-500',
    'Proposal Sent': 'border-orange-500',
    'Negotiation': 'border-yellow-500',
    'Closed Won': 'border-emerald-500'
};

const SalesPipelineBoard: React.FC = () => {
    const { state } = useAppContext();
    const { currentUser } = state;
    const [leads, setLeads] = useState<PlatformLead[]>([]);
    const navigate = useNavigate();
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => {
        if (!currentUser) return;
        const unsub = db.collection('platformLeads')
            .where('repId', '==', currentUser.id)
            // Removed status filter to ensure all active leads are fetched, we filter visually
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as PlatformLead));
                setLeads(data);
            });
        return () => unsub();
    }, [currentUser]);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData("text/plain", id);
    };

    const handleDrop = async (e: React.DragEvent, status: string) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (!id) return;
        
        // Optimistic Update
        const updatedLeads = leads.map(l => l.id === id ? { ...l, status: status as any } : l);
        setLeads(updatedLeads);

        try {
            await db.collection('platformLeads').doc(id).update({ status });
            // Log move
            await db.collection('salesActivities').add({
                leadId: id,
                type: 'status',
                content: `Moved to ${status}`,
                timestamp: new Date().toISOString(),
                repId: currentUser?.id
            });
        } catch (e) {
            console.error("Move failed", e);
        }
    };

    const handleCardClick = (leadId: string) => {
        // Navigate to Leads page with the ID selected
        navigate(`/sales/leads?leadId=${leadId}`);
    };
    
    const filteredLeads = useMemo(() => {
        return leads.filter(l => {
             const matchesSearch = l.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   (l.contactName && l.contactName.toLowerCase().includes(searchTerm.toLowerCase()));
             
             const isClosed = l.status === 'Closed Won' || l.status === 'Closed Lost';
             
             // If showArchived is true, show everything matching search
             // If false, hide Closed Lost (Closed Won is kept in pipeline for visibility usually, or can be archived too)
             // Standard practice: Keep Won, Archive Lost. 
             // Logic requested: "archive closed leads but not get rid of them"
             // Implementation: We will hide "Closed Lost" by default. "Closed Won" stays in the last column.
             
             if (!showArchived && l.status === 'Closed Lost') return false;
             
             return matchesSearch;
        });
    }, [leads, searchTerm, showArchived]);

    const getColumnTotal = (status: string) => {
        return filteredLeads.filter(l => l.status === status).reduce((sum, l) => sum + (l.value || 0), 0);
    };

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col pb-4">
            <header className="flex justify-between items-center mb-4 px-2">
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline</h2>
                 <div className="flex gap-4 items-center bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                     <div className="relative">
                         <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                         <input 
                             placeholder="Search deals..." 
                             className="pl-8 pr-4 py-1.5 text-sm rounded border bg-slate-50 dark:bg-slate-900 dark:border-slate-600 focus:ring-1 focus:ring-primary-500"
                             value={searchTerm}
                             onChange={e => setSearchTerm(e.target.value)}
                         />
                     </div>
                     <div className="flex items-center gap-2 border-l pl-4 border-slate-200 dark:border-slate-700">
                         <span className="text-xs font-bold text-slate-500 uppercase">Show Lost/Archived</span>
                         <Toggle label="" enabled={showArchived} onChange={setShowArchived} />
                     </div>
                 </div>
            </header>

            <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 min-w-[1400px] h-full p-2">
                    {COLUMNS.map(col => (
                        <div 
                            key={col} 
                            className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-900 rounded-xl min-w-[220px]"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, col)}
                        >
                            {/* Column Header */}
                            <div className={`p-4 border-b-4 ${COL_COLORS[col] || 'border-slate-400'} bg-white dark:bg-slate-800 rounded-t-xl`}>
                                <h3 className="font-black text-sm uppercase text-slate-600 dark:text-slate-300 flex justify-between">
                                    {col} <span className="bg-slate-100 dark:bg-slate-700 px-2 rounded-full text-xs py-0.5">{filteredLeads.filter(l => l.status === col).length}</span>
                                </h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">${getColumnTotal(col).toLocaleString()}</p>
                            </div>

                            {/* Cards Area */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {filteredLeads.filter(l => l.status === col).map(lead => (
                                    <div 
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, lead.id)}
                                        onClick={() => handleCardClick(lead.id)}
                                        className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-all hover:border-primary-400"
                                    >
                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{lead.companyName}</p>
                                        <p className="text-xs text-slate-500 truncate">{lead.contactName}</p>
                                        <div className="mt-2 flex justify-between items-center">
                                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                                                ${lead.value?.toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(lead.updatedAt || lead.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    {/* Optional: Show Closed Lost Column if Enabled */}
                    {showArchived && (
                         <div 
                            className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-900 rounded-xl min-w-[220px] opacity-70"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, 'Closed Lost')}
                        >
                            <div className={`p-4 border-b-4 border-slate-400 bg-white dark:bg-slate-800 rounded-t-xl`}>
                                <h3 className="font-black text-sm uppercase text-slate-500 dark:text-slate-400 flex justify-between">
                                    Closed Lost <span className="bg-slate-100 dark:bg-slate-700 px-2 rounded-full text-xs py-0.5">{filteredLeads.filter(l => l.status === 'Closed Lost').length}</span>
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {filteredLeads.filter(l => l.status === 'Closed Lost').map(lead => (
                                    <div key={lead.id} onClick={() => handleCardClick(lead.id)} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer opacity-60 hover:opacity-100">
                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{lead.companyName}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesPipelineBoard;
