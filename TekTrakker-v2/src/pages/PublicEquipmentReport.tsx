import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import type { Customer, EquipmentAsset } from '../types';
import { ShieldCheck, Calendar, Hash, Printer, Cog } from 'lucide-react';
import Button from '../components/ui/Button';

const PublicEquipmentReport: React.FC = () => {
    const { customerId } = useParams<{ customerId: string }>();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    const qs = new URLSearchParams(window.location.search);
    const unitsParam = qs.get('units');
    const selectedUnitIds = unitsParam ? unitsParam.split(',') : null;

    useEffect(() => {
        const fetchCust = async () => {
            if (!customerId) return;
            try {
                const doc = await db.collection('customers').doc(customerId).get();
                if (doc.exists) {
                    setCustomer({ id: doc.id, ...doc.data() } as Customer);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchCust();
    }, [customerId]);

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500 font-bold">Loading Report...</p></div>;
    if (!customer) return <div className="h-screen flex items-center justify-center bg-gray-50"><p className="text-red-500 font-bold">Report not found.</p></div>;

    let assets = customer.equipment || [];
    if (selectedUnitIds) {
        assets = assets.filter(a => selectedUnitIds.includes(a.id));
    }

    const printReport = () => window.print();

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 md:p-12 selection:bg-blue-500 selection:text-white">
            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden print:shadow-none print:border-none print:w-full print:max-w-none">
                
                {/* Header */}
                <div className="bg-slate-900 p-8 pb-12 relative overflow-hidden text-white flex justify-between items-start print:bg-white print:text-black print:p-0 print:border-b print:border-gray-300 print:mb-8">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-black mb-2 flex items-center gap-2"><Cog className="text-blue-500 print:hidden" /> Comprehensive Equipment Health Report</h1>
                        <p className="text-slate-400 print:text-gray-600 font-medium text-sm">Prepared for: <span className="text-white print:text-black font-bold">{customer.name}</span></p>
                        <p className="text-slate-400 print:text-gray-600 font-medium text-sm">Address: {customer.address}</p>
                        <p className="text-slate-400 print:text-gray-600 font-medium text-sm">Date Generated: {new Date().toLocaleDateString()}</p>
                    </div>
                    <Button variant="secondary" onClick={printReport} className="relative z-10 print:hidden text-white border-white/20 hover:bg-white/10 flex items-center gap-2">
                        <Printer size={16} /> Print / Save PDF
                    </Button>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/30 blur-3xl rounded-full print:hidden"></div>
                </div>

                {/* Body */}
                <div className="p-8 -mt-8 relative z-20 print:p-0 print:m-0">
                    <div className="mb-8">
                        <h2 className="text-xl font-black mb-2 text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                            <ShieldCheck className="text-emerald-500" /> Executive Summary
                        </h2>
                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-slate-600">
                            <p>This report contains a documented baseline of the mechanical property condition for <strong>{customer.name}</strong> encompassing <strong>{assets.length}</strong> registered systems.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {assets.length === 0 ? (
                            <p className="text-gray-500 italic">No equipment recorded.</p>
                        ) : (
                            assets.map((asset, idx) => (
                                <div key={asset.id} className="border-2 border-gray-100 rounded-2xl p-6 relative hover:border-blue-100 transition-colors bg-white page-break-inside-avoid">
                                    <div className="absolute top-0 right-0 bg-blue-50 text-blue-700 text-xs font-black uppercase px-4 py-1 rounded-bl-xl rounded-tr-xl border-l border-b border-blue-100 print:border-gray-500 print:text-gray-800 print:bg-white">
                                        Unit {idx + 1}
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">{asset.name ? `${asset.name} (${asset.brand})` : asset.brand}</h3>
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">{asset.type} • {asset.location || 'Unknown Loc'}</p>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 print:border-gray-300">
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center gap-1"><Hash size={12}/> Model</p>
                                            <p className="font-mono text-xs font-bold text-gray-800 break-words">{asset.model}</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 print:border-gray-300">
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center gap-1"><Hash size={12}/> Serial</p>
                                            <p className="font-mono text-xs font-bold text-gray-800 break-words">{asset.serial}</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 print:border-gray-300">
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 flex items-center gap-1"><Calendar size={12}/> Install Date</p>
                                            <p className="text-xs font-bold text-gray-800">{asset.installDate ? new Date(asset.installDate).toLocaleDateString() : 'Unknown'}</p>
                                        </div>
                                        <div className={`p-3 rounded-lg border print:border-gray-300 ${asset.condition === 'Excellent' || asset.condition === 'Good' ? 'bg-green-50 border-green-100 text-green-800' : asset.condition === 'Fair' ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : asset.condition === 'Poor' || asset.condition === 'Critical' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-gray-50 border-gray-100 text-gray-800'}`}>
                                            <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Condition</p>
                                            <p className="text-sm font-black uppercase tracking-widest">{asset.condition || 'Not Rated'}</p>
                                        </div>
                                    </div>

                                    {/* Asset Photos */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                                        {asset.serialPhotoUrl && (
                                            <div className="relative border rounded-xl overflow-hidden shadow-sm h-48 bg-gray-100 group">
                                                <img src={asset.serialPhotoUrl} alt="Serial Number Evidence" className="w-full h-full object-cover" />
                                                <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] font-bold uppercase py-1 text-center backdrop-blur-sm">Serial Verification</div>
                                            </div>
                                        )}
                                        {asset.unitTagPhotoUrl && (
                                            <div className="relative border rounded-xl overflow-hidden shadow-sm h-48 bg-gray-100 group">
                                                <img src={asset.unitTagPhotoUrl} alt="Unit Tag Data" className="w-full h-full object-cover" />
                                                <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] font-bold uppercase py-1 text-center backdrop-blur-sm">Equipment Tag</div>
                                            </div>
                                        )}
                                        {asset.conditionPhotoUrl && (
                                            <div className="relative border rounded-xl overflow-hidden shadow-sm h-48 bg-gray-100 group">
                                                <img src={asset.conditionPhotoUrl} alt="Visual Condition" className="w-full h-full object-cover" />
                                                <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] font-bold uppercase py-1 text-center backdrop-blur-sm">State of Wear</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 border-t border-gray-200 p-8 text-center text-gray-500 text-xs print:mt-12 print:border-none print:pt-4">
                    <p>Generated securely on the TekTrakker Platform</p>
                </div>
            </div>
        </div>
    );
};

export default PublicEquipmentReport;
