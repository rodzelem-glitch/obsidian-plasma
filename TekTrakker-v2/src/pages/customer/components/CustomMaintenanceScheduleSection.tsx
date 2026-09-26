import React, { useState, useMemo } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { 
    Wrench, 
    Calendar, 
    CheckCircle2, 
    Clock, 
    Download, 
    ChevronDown, 
    ShieldCheck, 
    Layers, 
    PackageCheck, 
    FileText, 
    AlertCircle,
    CalendarCheck,
    Cpu,
    Zap,
    Flame,
    Droplets,
    Wind,
    Eye
} from 'lucide-react';
import type { Customer, MaintenanceAgreement, Job, Organization, EquipmentAsset } from 'types';
import Modal from 'components/ui/Modal';
import { formatAddress } from 'lib/utils';

interface CustomMaintenanceScheduleSectionProps {
    customer: Customer | null;
    organization?: Organization | null;
    completedJobs?: Job[];
    onViewReport?: (job: Job) => void;
    onRequestService?: (unitId?: string, locationId?: string) => void;
}

export const CustomMaintenanceScheduleSection: React.FC<CustomMaintenanceScheduleSectionProps> = ({
    customer,
    organization,
    completedJobs = [],
    onViewReport,
    onRequestService
}) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [activeTab, setActiveTab] = useState<'manifest' | 'timeline' | 'coverage'>('manifest');
    const [selectedUnitForModal, setSelectedUnitForModal] = useState<EquipmentAsset | null>(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const agreement = customer?.maintenanceAgreement;
    const equipmentList = customer?.equipment || [];

    // Derive covered units
    const coveredEquipment = useMemo(() => {
        if (!agreement) return [];
        const coveredIds = agreement.coveredEquipmentIds || [];
        if (coveredIds.length === 0) return equipmentList; // fallback to all customer units if not specified
        return equipmentList.filter(eq => coveredIds.includes(eq.id));
    }, [agreement, equipmentList]);

    if (!customer) return null;

    // Compute visit stats
    const visits = agreement?.visits || [];
    const completedVisits = visits.filter(v => v.status === 'Completed');
    const upcomingVisits = visits.filter(v => v.status !== 'Completed');

    // Trade Icon resolver
    const getTradeIcon = (trade?: string) => {
        const t = (trade || '').toLowerCase();
        if (t.includes('plumb')) return <Droplets size={16} className="text-cyan-500" />;
        if (t.includes('elect')) return <Zap size={16} className="text-amber-500" />;
        if (t.includes('heat') || t.includes('gas')) return <Flame size={16} className="text-red-500" />;
        if (t.includes('refrig')) return <Droplets size={16} className="text-blue-500" />;
        return <Wind size={16} className="text-indigo-500" />;
    };

    // Export Supplies & Equipment Manifest PDF
    const handleExportManifest = async () => {
        setIsExportingPdf(true);
        try {
            const fileName = `${customer.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Supplies_Manifest.pdf`;

            const unitsHtml = coveredEquipment.map(eq => {
                const rule = agreement?.coveredUnitRules?.find(r => r.unitId === eq.id);
                const consumables = rule?.consumables || [];
                return `
                    <div class="pdf-card pdf-avoid-break" style="margin-bottom: 14px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff; page-break-inside: avoid !important;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 8px;">
                            <div>
                                <strong style="font-size: 13px; color: #0f172a;">${eq.brand} ${eq.model} (${eq.type || 'Equipment'})</strong>
                                <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">Serial: ${eq.serial || 'N/A'} · Location: ${eq.physicalLocation || 'Main Facility'}</p>
                            </div>
                            <span style="font-size: 10px; font-weight: bold; background: #f1f5f9; padding: 3px 6px; border-radius: 4px;">
                                ${rule?.serviceFrequency || agreement?.frequency || 'Quarterly'} Service
                            </span>
                        </div>
                        <p style="margin: 0 0 4px 0; font-size: 10px; font-weight: bold; color: #334155; text-transform: uppercase;">Required Consumables &amp; Supplies:</p>
                        ${consumables.length > 0 ? `
                            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                                <thead>
                                    <tr style="background: #f8fafc; text-align: left; color: #64748b;">
                                        <th style="padding: 5px; border: 1px solid #e2e8f0;">Item</th>
                                        <th style="padding: 5px; border: 1px solid #e2e8f0;">Size / Part #</th>
                                        <th style="padding: 5px; border: 1px solid #e2e8f0;">Qty</th>
                                        <th style="padding: 5px; border: 1px solid #e2e8f0;">Interval</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${consumables.map(c => `
                                        <tr class="pdf-avoid-break" style="page-break-inside: avoid !important;">
                                            <td style="padding: 5px; border: 1px solid #e2e8f0;">${c.name}</td>
                                            <td style="padding: 5px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${c.sizeOrPartNo}</td>
                                            <td style="padding: 5px; border: 1px solid #e2e8f0;">${c.quantity}</td>
                                            <td style="padding: 5px; border: 1px solid #e2e8f0;">Every ${c.intervalMonths || 3} Months</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : `
                            <p style="margin: 0; font-size: 10px; color: #64748b;">Filter Specs: ${eq.filterType || '16x25x1'} · Standard maintenance tune-up included.</p>
                        `}
                    </div>
                `;
            }).join('');

            const manifestHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0f172a; line-height: 1.5;">
                    <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h2 style="font-size: 18px; font-weight: 900; margin: 0; color: #0f172a;">${organization?.name || 'TekTrakker Services'}</h2>
                            <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0; text-transform: uppercase; font-weight: 700;">Equipment Maintenance &amp; Consumables Manifest</p>
                        </div>
                        <div style="text-align: right;">
                            <span style="display: inline-block; padding: 4px 10px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 11px; font-weight: 800;">Active Agreement</span>
                        </div>
                    </div>
                    <div style="margin-bottom: 20px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 11px;">
                        <p style="margin: 0 0 3px 0;"><strong>Client:</strong> ${customer.name}</p>
                        <p style="margin: 0 0 3px 0;"><strong>Service Facility:</strong> ${formatAddress(customer.address)}</p>
                        <p style="margin: 0;"><strong>Agreement Term:</strong> ${agreement?.startDate || '2026-01-01'} through ${agreement?.endDate || '2026-12-31'}</p>
                    </div>
                    <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; margin: 0 0 12px 0; color: #334155;">Registered Covered Units &amp; Supplies Specs</h3>
                    ${unitsHtml}
                </div>
            `;

            const { renderHtmlToSmartPdf } = await import('../../../lib/pdfHelper');
            const result = await renderHtmlToSmartPdf(manifestHtml, {
                filename: fileName,
                margin: [0.25, 0.25, 0.25, 0.25],
                windowWidth: 780,
                pdfFormat: 'letter',
                pdfOrientation: 'portrait',
                scale: 2,
                quality: 0.98
            });
            const { downloadFile } = await import('../../../lib/downloadHelper');
            await downloadFile(result.dataUri, fileName);
        } catch (e) {
            console.error('Failed to export manifest PDF:', e);
            alert('Failed to export supplies manifest.');
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <section className="space-y-4">
            {/* Header Accordion Bar */}
            <div 
                onClick={() => setIsCollapsed(!isCollapsed)} 
                className="flex items-center justify-between cursor-pointer p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary-400 dark:hover:border-primary-600 transition-all select-none"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
                        <Wrench size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                Custom Maintenance Schedule &amp; Supplies Manifest
                            </h3>
                            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                                {agreement?.status || 'Active Plan'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>Covered Units: <strong className="text-slate-700 dark:text-slate-300">{coveredEquipment.length} Assets Registered</strong></span>
                            <span>•</span>
                            <span>Visits: <strong className="text-emerald-600 dark:text-emerald-400">{completedVisits.length} Done / {visits.length || 2} Scheduled</strong></span>
                            <span>•</span>
                            <span>Term: <strong className="text-slate-700 dark:text-slate-300">Through {agreement?.endDate ? new Date(agreement.endDate).toLocaleDateString() : 'Annual Renewal'}</strong></span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown size={18} />
                    </div>
                </div>
            </div>

            {/* Expanded Accordion Body */}
            {!isCollapsed && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Navigation Sub-Tabs & Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setActiveTab('manifest')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    activeTab === 'manifest'
                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                <Layers size={14} />
                                <span>Covered Units &amp; Supplies ({coveredEquipment.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('timeline')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    activeTab === 'timeline'
                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                <CalendarCheck size={14} />
                                <span>Maintenance Visits Timeline ({visits.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('coverage')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    activeTab === 'coverage'
                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                <ShieldCheck size={14} />
                                <span>Parts &amp; Labor Coverage Rules</span>
                            </button>
                        </div>

                        {/* Export Manifest Action */}
                        <Button
                            variant="secondary"
                            disabled={isExportingPdf}
                            onClick={handleExportManifest}
                            className="h-8 text-xs font-bold px-3 flex items-center gap-1.5 rounded-xl cursor-pointer"
                            title="Download Equipment & Supplies Manifest"
                        >
                            <Download size={13} />
                            <span>{isExportingPdf ? 'Exporting...' : 'Export Manifest PDF'}</span>
                        </Button>
                    </div>

                    {/* TAB 1: Covered Equipment & Consumables Manifest */}
                    {activeTab === 'manifest' && (
                        <div className="space-y-4">
                            {coveredEquipment.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <Cpu className="mx-auto text-slate-400 mb-2" size={32} />
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Equipment Assigned to Agreement</h4>
                                    <p className="text-xs text-slate-500 mt-1">Contact your account manager to link facility equipment to this maintenance schedule.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {coveredEquipment.map(eq => {
                                        const rule = agreement?.coveredUnitRules?.find(r => r.unitId === eq.id);
                                        const consumables = rule?.consumables || [];
                                        return (
                                            <Card key={eq.id} className="p-5 border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                                                {getTradeIcon(agreement?.tradeType || eq.type)}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                                                                    {eq.brand} {eq.model}
                                                                </h4>
                                                                <p className="text-xs text-slate-400 font-medium">
                                                                    {eq.type || 'Equipment'} • {eq.physicalLocation || 'Main Facility'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded-md">
                                                            {rule?.serviceFrequency || agreement?.frequency || 'Quarterly'}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60">
                                                        <div>
                                                            <span className="text-slate-400 font-bold uppercase text-[10px]">Serial Number</span>
                                                            <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">{eq.serial || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 font-bold uppercase text-[10px]">Area Served</span>
                                                            <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{eq.servesArea || 'Building'}</p>
                                                        </div>
                                                    </div>

                                                    {/* Consumables Specs Sub-panel */}
                                                    <div className="mt-3 space-y-1.5">
                                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                                                            <PackageCheck size={12} className="text-emerald-500" /> Required Supplies &amp; Consumables
                                                        </span>
                                                        {consumables.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {consumables.map(c => (
                                                                    <div key={c.id} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="font-bold text-slate-800 dark:text-slate-200">{c.name}</span>
                                                                            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                                                                                {c.sizeOrPartNo}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right text-[11px] font-semibold text-slate-500">
                                                                            <span>Qty: <strong>{c.quantity}</strong></span>
                                                                            <span className="text-slate-300 dark:text-slate-600 mx-1">|</span>
                                                                            <span>Every {c.intervalMonths || 3} mo</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex justify-between items-center">
                                                                <span>Filter: <strong className="text-slate-700 dark:text-slate-300">{eq.filterType || '16x25x1 Standard'}</strong></span>
                                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold">Standard Supply</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                        <CheckCircle2 size={13} /> Active Coverage
                                                    </span>
                                                    {onRequestService && (
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => onRequestService(eq.id, eq.locationId)}
                                                            className="text-xs font-bold py-1 px-2.5 rounded-lg hover:border-primary-500 cursor-pointer"
                                                        >
                                                            Request Unit Service
                                                        </Button>
                                                    )}
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: Scheduled Maintenance Timeline */}
                    {activeTab === 'timeline' && (
                        <div className="space-y-4">
                            {visits.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <Calendar className="mx-auto text-slate-400 mb-2" size={32} />
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Scheduled Visit Slots</h4>
                                    <p className="text-xs text-slate-500 mt-1">Upcoming tune-up visit slots will appear here once generated.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {visits.map((visit, idx) => {
                                        const isCompleted = visit.status === 'Completed';
                                        const isOverdue = visit.status === 'Overdue';
                                        const isScheduled = visit.status === 'Scheduled';
                                        const linkedJob = visit.jobId ? completedJobs.find(j => j.id === visit.jobId) : null;

                                        return (
                                            <div 
                                                key={visit.id || idx}
                                                className={`p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                                                    isCompleted 
                                                        ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40' 
                                                        : isOverdue 
                                                            ? 'bg-red-50/40 border-red-200 dark:bg-red-950/20 dark:border-red-900/40'
                                                            : isScheduled 
                                                                ? 'bg-blue-50/40 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40'
                                                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2.5 rounded-xl mt-0.5 ${
                                                        isCompleted ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                                                        : isOverdue ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                                                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        {isCompleted ? <CheckCircle2 size={20} /> : <Calendar size={20} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                                {visit.title || `Scheduled Maintenance Inspection — Target: ${visit.targetMonth}`}
                                                            </h4>
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                                                isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800'
                                                                : isOverdue ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800'
                                                                : isScheduled ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800'
                                                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                                            }`}>
                                                                {visit.status}
                                                            </span>
                                                        </div>

                                                        <p className="text-xs text-slate-500 mt-1 font-medium">
                                                            Target Window: <strong className="text-slate-700 dark:text-slate-300">{visit.targetMonth}</strong>
                                                            {visit.assignedTechName && ` • Assigned Tech: ${visit.assignedTechName}`}
                                                            {visit.notes && ` • ${visit.notes}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                                    {isCompleted && linkedJob && onViewReport && (
                                                        <Button
                                                            onClick={() => onViewReport(linkedJob)}
                                                            className="text-xs font-bold py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 rounded-xl cursor-pointer"
                                                        >
                                                            <Eye size={13} /> View Service Report
                                                        </Button>
                                                    )}
                                                    {!isCompleted && onRequestService && (
                                                        <Button
                                                            onClick={() => onRequestService(undefined, undefined)}
                                                            className="text-xs font-bold py-1.5 px-3 bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-1.5 rounded-xl cursor-pointer"
                                                        >
                                                            <CalendarCheck size={13} /> Confirm Preferred Date
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: Coverage Rules & Allowances */}
                    {activeTab === 'coverage' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="p-4 border-2 border-emerald-100 dark:border-emerald-900/30">
                                    <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Parts Discount Guarantee</span>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                        {agreement?.partsDiscountPercentage || 15}% OFF
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Applies to all non-routine replacement parts, coils, valves, and controls.
                                    </p>
                                </Card>

                                <Card className="p-4 border-2 border-slate-200 dark:border-slate-800">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Annual Parts Credit</span>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                        ${agreement?.partsAllowanceRemaining ?? agreement?.partsAllowanceTotal ?? 250.00}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Remaining allowance for covered consumable replacements and hardware.
                                    </p>
                                </Card>

                                <Card className="p-4 border-2 border-slate-200 dark:border-slate-800">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Emergency Dispatch SLA</span>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                        2-Hour SLA
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Priority front-of-line dispatch with zero diagnostic truck roll fees.
                                    </p>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default CustomMaintenanceScheduleSection;
