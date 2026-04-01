
import React, { useMemo } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Shield, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import type { Job } from 'types';

interface WarrantySectionProps {
    jobs: Job[];
    onAcceptWarranty: (job: Job) => void;
}

interface WarrantyRecord {
    jobId: string;
    jobDate: string;
    jobLabel: string;
    workmanshipMonths: number;
    partsMonths: number;
    issuedDate: string;
    notes: string;
    disclaimerAgreed: boolean;
    workmanshipExpiry: Date | null;
    partsExpiry: Date | null;
}

const WarrantySection: React.FC<WarrantySectionProps> = ({ jobs, onAcceptWarranty }) => {
    const warranties = useMemo<WarrantyRecord[]>(() => {
        const now = new Date();
        const records: WarrantyRecord[] = [];

        jobs.forEach(job => {
            const inv = job.invoice as any;
            if (!inv) return;
            const wm = inv.workmanshipWarrantyMonths || 0;
            const pm = inv.partsWarrantyMonths || 0;
            if (!wm && !pm) return;

            const issued = new Date(job.appointmentTime);

            const addMonths = (d: Date, m: number) => {
                const r = new Date(d);
                r.setMonth(r.getMonth() + m);
                return r;
            };

            records.push({
                jobId: job.id,
                jobDate: job.appointmentTime,
                jobLabel: job.tasks?.[0] || 'Service',
                workmanshipMonths: wm,
                partsMonths: pm,
                issuedDate: issued.toISOString(),
                notes: inv.warrantyNotes || '',
                disclaimerAgreed: !!inv.warrantyDisclaimerAgreed,
                workmanshipExpiry: wm > 0 ? addMonths(issued, wm) : null,
                partsExpiry: pm > 0 ? addMonths(issued, pm) : null,
            });
        });

        return records.sort((a, b) => new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime());
    }, [jobs]);

    if (warranties.length === 0) return null;

    const now = new Date();

    const monthsLeft = (expiry: Date | null) => {
        if (!expiry) return -1;
        const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        return Math.max(0, Math.round(diff));
    };

    const daysLeft = (expiry: Date | null) => {
        if (!expiry) return -1;
        const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.ceil(diff));
    };

    const isActive = (expiry: Date | null, agreed: boolean) => agreed && expiry !== null && expiry > now;

    return (
        <section className="space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                <Shield className="text-primary-600" size={20} /> Warranty Coverage
            </h3>

            {warranties.map(w => {
                const wmActive = isActive(w.workmanshipExpiry, w.disclaimerAgreed);
                const pmActive = isActive(w.partsExpiry, w.disclaimerAgreed);
                const anyActive = wmActive || pmActive;

                return (
                    <Card key={w.jobId} className={`p-0 overflow-hidden border-2 ${anyActive ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-700'}`}>
                        {/* Header */}
                        <div className={`px-6 py-4 flex justify-between items-center ${anyActive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                            <div>
                                <p className="font-black text-slate-900 dark:text-white">{w.jobLabel}</p>
                                <p className="text-xs text-slate-400 mt-0.5">Service date: {new Date(w.jobDate).toLocaleDateString()} · Issued: {new Date(w.issuedDate).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!w.disclaimerAgreed ? (
                                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-black bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                        <AlertTriangle size={12} /> Disclaimer Pending
                                    </span>
                                ) : anyActive ? (
                                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                        <CheckCircle size={12} /> Active
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-black bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                        <Clock size={12} /> Expired
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Coverage Cards */}
                        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                            {/* Workmanship */}
                            {w.workmanshipMonths > 0 && (
                                <div className="p-5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Workmanship</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                                        {wmActive ? monthsLeft(w.workmanshipExpiry) : '—'}
                                        {wmActive && <span className="text-sm font-bold text-slate-400 ml-1">mo left</span>}
                                    </p>
                                    {w.workmanshipExpiry && (
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {wmActive ? `Expires ${w.workmanshipExpiry.toLocaleDateString()} (${daysLeft(w.workmanshipExpiry)} days)` : `Expired ${w.workmanshipExpiry.toLocaleDateString()}`}
                                        </p>
                                    )}
                                    <div className={`mt-2 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800`}>
                                        <div
                                            className={`h-full rounded-full transition-all ${wmActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                            style={{ width: `${wmActive ? Math.min(100, (monthsLeft(w.workmanshipExpiry) / w.workmanshipMonths) * 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Parts */}
                            {w.partsMonths > 0 && (
                                <div className="p-5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Parts</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                                        {pmActive ? monthsLeft(w.partsExpiry) : '—'}
                                        {pmActive && <span className="text-sm font-bold text-slate-400 ml-1">mo left</span>}
                                    </p>
                                    {w.partsExpiry && (
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {pmActive ? `Expires ${w.partsExpiry.toLocaleDateString()} (${daysLeft(w.partsExpiry)} days)` : `Expired ${w.partsExpiry.toLocaleDateString()}`}
                                        </p>
                                    )}
                                    <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                        <div
                                            className={`h-full rounded-full transition-all ${pmActive ? 'bg-blue-500' : 'bg-slate-300'}`}
                                            style={{ width: `${pmActive ? Math.min(100, (monthsLeft(w.partsExpiry) / w.partsMonths) * 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {w.notes && (
                            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coverage Notes</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{w.notes}</p>
                            </div>
                        )}

                        {/* Disclaimer not agreed warning */}
                        {!w.disclaimerAgreed && (
                            <div className="px-6 py-4 border-t border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 flex flex-col md:flex-row justify-between items-center gap-4">
                                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                                    ⚠️ Warranty activation pending disclaimer agreement.
                                </p>
                                <Button 
                                    size="sm" 
                                    onClick={() => {
                                        const job = jobs.find(j => j.id === w.jobId);
                                        if (job) onAcceptWarranty(job);
                                    }}
                                    className="bg-amber-600 hover:bg-amber-700 text-[10px] uppercase font-black"
                                >
                                    Review & Accept Disclaimer
                                </Button>
                            </div>
                        )}
                    </Card>
                );
            })}
        </section>
    );
};

export default WarrantySection;
