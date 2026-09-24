import React, { useState, useMemo } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { 
    Shield, 
    CheckCircle, 
    Clock, 
    AlertTriangle, 
    MapPin, 
    ChevronDown, 
    Download, 
    FileText, 
    DollarSign, 
    Wrench,
    CheckCircle2,
    ShieldCheck,
    Sparkles,
    ArrowRight
} from 'lucide-react';
import type { Job, ServiceLocation, Customer, Organization, WarrantyContract, EquipmentAsset } from 'types';
import { generateWarrantyContractPdfAttachment } from 'lib/pdfHelper';
import { getCorrelatedWarrantyPlans } from 'lib/pricebooks/jbWarranties';
import CustomerWarrantyPurchaseModal from './CustomerWarrantyPurchaseModal';
import showToast from 'lib/toast';

interface WarrantySectionProps {
    jobs: Job[];
    locations?: ServiceLocation[];
    customer?: Customer | null;
    organization?: Organization | null;
    onAcceptWarranty: (job: Job) => void;
    onIssueNewWarranty?: () => void;
    onPurchaseWarranty?: (equipment?: EquipmentAsset) => void;
}

interface WarrantyRecord {
    jobId: string;
    jobDate: string;
    jobLabel: string;
    locationName?: string;
    workmanshipMonths: number;
    partsMonths: number;
    issuedDate: string;
    notes: string;
    disclaimerAgreed: boolean;
    workmanshipExpiry: Date | null;
    partsExpiry: Date | null;
}

const WarrantySection: React.FC<WarrantySectionProps> = ({ 
    jobs, 
    locations = [], 
    customer,
    organization,
    onAcceptWarranty,
    onIssueNewWarranty,
    onPurchaseWarranty
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isDownloadingPdfId, setIsDownloadingPdfId] = useState<string | null>(null);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [selectedEquipForPurchase, setSelectedEquipForPurchase] = useState<EquipmentAsset | null>(null);

    // 12-Month Limited Repair Warranty Contracts
    const activeContracts: WarrantyContract[] = useMemo(() => {
        return (customer?.warrantyContracts || []).filter(c => c.status !== 'Cancelled');
    }, [customer?.warrantyContracts]);

    // Job-based Workmanship & Parts warranties
    const jobWarranties = useMemo<WarrantyRecord[]>(() => {
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

            let locName = job.locationName;
            if (!locName && job.locationId) {
                const found = locations.find(l => l.id === job.locationId);
                if (found) locName = found.propertyName || found.name;
            }

            records.push({
                jobId: job.id,
                jobDate: job.appointmentTime,
                jobLabel: job.tasks?.[0] || 'Service',
                locationName: locName,
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
    }, [jobs, locations]);

    const customerEquipment = (customer?.equipment || []) as EquipmentAsset[];
    const portalPurchasesEnabled = organization?.jbWarrantySettings?.enableCustomerPortalPurchases !== false;
    const totalWarrantyItems = activeContracts.length + jobWarranties.length;
    if (totalWarrantyItems === 0 && !onIssueNewWarranty && !portalPurchasesEnabled) return null;

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

    const handleDownloadContract = async (contract: WarrantyContract) => {
        setIsDownloadingPdfId(contract.id);
        try {
            const attachment = await generateWarrantyContractPdfAttachment(contract, organization);
            if (attachment.path) {
                window.open(attachment.path, '_blank');
            } else if (attachment.content) {
                const link = document.createElement('a');
                link.href = `data:application/pdf;base64,${attachment.content}`;
                link.download = attachment.filename;
                link.click();
            }
            showToast.success(`Downloaded Warranty Agreement #${contract.contractNumber}`);
        } catch (e) {
            console.error("Error downloading warranty PDF:", e);
            showToast.error("Failed to generate PDF download.");
        } finally {
            setIsDownloadingPdfId(null);
        }
    };

    return (
        <section className="space-y-4">
            <div 
                onClick={() => setIsCollapsed(prev => !prev)}
                className="flex items-center justify-between cursor-pointer group select-none bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-400 transition-all"
            >
                <div className="flex items-center gap-2">
                    <Shield className="text-emerald-600" size={20} />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Warranty &amp; Protection Plans
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
                        {totalWarrantyItems}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {portalPurchasesEnabled && (
                        <Button 
                            size="sm" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEquipForPurchase(null);
                                setIsPurchaseModalOpen(true);
                                onPurchaseWarranty?.();
                            }}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[10px] uppercase font-black tracking-wider h-7 flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                            <ShieldCheck size={12} />
                            <span>+ Get Protection</span>
                        </Button>
                    )}
                    {onIssueNewWarranty && (
                        <Button 
                            size="sm" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onIssueNewWarranty();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-[10px] uppercase font-black tracking-wider h-7"
                        >
                            + Issue Warranty
                        </Button>
                    )}
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-500 group-hover:text-emerald-600 transition-colors">
                        <span>{isCollapsed ? 'Show' : 'Hide'}</span>
                        <ChevronDown size={18} className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                    </div>
                </div>
            </div>

            {!isCollapsed && (
                <div className="space-y-4">
                    {/* Available Extended Warranty Plans Showcase */}
                    {portalPurchasesEnabled && (
                        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent dark:bg-emerald-950/20 border-2 border-dashed border-emerald-300 dark:border-emerald-800 rounded-2xl p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs">
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                            <span>Extended Protection Plans Available</span>
                                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold px-2 py-0.5 rounded-full">
                                                Zero Deductible
                                            </span>
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Factory-backed 5 &amp; 10-year coverage for parts and 100% certified technician labor.
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setSelectedEquipForPurchase(null);
                                        setIsPurchaseModalOpen(true);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                    <Sparkles size={13} />
                                    <span>Explore All Plans</span>
                                </Button>
                            </div>

                            {customerEquipment.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                                    {customerEquipment.map(eq => {
                                        const isCovered = activeContracts.some(c => 
                                            (c.equipmentId && c.equipmentId === eq.id) ||
                                            (c.outdoorSerial && eq.serial && c.outdoorSerial === eq.serial)
                                        );
                                        const correlated = getCorrelatedWarrantyPlans(eq, {
                                            contractorLaborRateTier: organization?.jbWarrantySettings?.contractorLaborRateTier || 175,
                                            defaultMarkupPercentage: organization?.jbWarrantySettings?.defaultMarkupPercentage ?? 40,
                                            minimumMarkupDollars: organization?.jbWarrantySettings?.minimumMarkupDollars ?? 150
                                        });
                                        const recommendedPlan = correlated?.plans?.find(p => p.isRecommended || p.recommended) || correlated?.plans?.[0];

                                        return (
                                            <div 
                                                key={eq.id}
                                                className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col justify-between shadow-xs"
                                            >
                                                <div>
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                                            {eq.brand} {eq.model}
                                                        </span>
                                                        {isCovered ? (
                                                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                                                                Covered
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full shrink-0">
                                                                Eligible
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                                                        <div>{eq.type || 'HVAC System'} &bull; S/N: {eq.serial || 'N/A'}</div>
                                                        {recommendedPlan && !isCovered && (
                                                            <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                                Recommended: <strong>{recommendedPlan.planName}</strong>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                                                    {isCovered ? (
                                                        <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                                            <CheckCircle2 size={13} /> Active Protection
                                                        </span>
                                                    ) : recommendedPlan ? (
                                                        <>
                                                            <div>
                                                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                                                    ${recommendedPlan.retailPrice.toFixed(0)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 ml-1">full term</span>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedEquipForPurchase(eq);
                                                                    setIsPurchaseModalOpen(true);
                                                                    onPurchaseWarranty?.(eq);
                                                                }}
                                                                className="h-6 text-[10px] font-black px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                                                            >
                                                                Get Coverage
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedEquipForPurchase(eq);
                                                                setIsPurchaseModalOpen(true);
                                                                onPurchaseWarranty?.(eq);
                                                            }}
                                                            className="h-6 text-[10px] font-black px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
                                                        >
                                                            View Plans
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
                    
                    {/* 1. Active Limited Repair Warranty Contracts */}
                    {activeContracts.map(contract => {
                        const expiryDate = contract.expirationDate ? new Date(contract.expirationDate) : null;
                        const effectiveDate = contract.effectiveDate ? new Date(contract.effectiveDate) : null;
                        const isContractActive = expiryDate ? expiryDate > now : true;
                        const isWaitingPeriod = effectiveDate ? effectiveDate > now : false;

                        const totalCap = contract.annualAggregateLimit || 2500;
                        const remaining = contract.remainingBenefitLimit ?? totalCap;
                        const benefitUsedPercent = Math.max(0, Math.min(100, ((totalCap - remaining) / totalCap) * 100));

                        return (
                            <Card key={contract.id} className="p-0 overflow-hidden border-2 border-emerald-300 dark:border-emerald-800 shadow-sm">
                                {/* Contract Header */}
                                <div className="px-5 py-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent dark:bg-emerald-950/20 flex flex-wrap justify-between items-center gap-2 border-b border-emerald-200 dark:border-emerald-800">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                                                {contract.trade || 'HVAC'} Protection Plan
                                            </span>
                                            <strong className="text-sm font-bold text-slate-900 dark:text-white">
                                                #{contract.contractNumber}
                                            </strong>
                                        </div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                                            <span>System: <strong>{contract.systemType} ({contract.nominalTons} Ton)</strong></span>
                                            <span>&bull;</span>
                                            <span>Service Fee: <strong>${contract.serviceFee || 125}</strong></span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isWaitingPeriod ? (
                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                                <Clock size={12} /> Day 1–30 Waiting Period
                                            </span>
                                        ) : isContractActive ? (
                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                <CheckCircle2 size={12} /> Active Coverage
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                <Clock size={12} /> Expired
                                            </span>
                                        )}

                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            onClick={() => handleDownloadContract(contract)}
                                            disabled={isDownloadingPdfId === contract.id}
                                            className="text-xs h-8 flex items-center gap-1.5"
                                        >
                                            <Download size={13} />
                                            <span>{isDownloadingPdfId === contract.id ? 'Generating...' : '3-Page PDF'}</span>
                                        </Button>
                                    </div>
                                </div>

                                {/* Contract Body */}
                                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
                                    {/* Equipment & Serial Specs */}
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Equipment Specifications</span>
                                        <div>Outdoor: <strong>{contract.outdoorModel || 'N/A'}</strong> (S/N: {contract.outdoorSerial || 'N/A'})</div>
                                        <div>Indoor: <strong>{contract.indoorModel || 'N/A'}</strong> (S/N: {contract.indoorSerial || 'N/A'})</div>
                                        <div>Refrigerant: <strong>{contract.refrigerant || 'R-410A'}</strong> &bull; Age: <strong>~{contract.approxAgeYears || 5} yrs</strong></div>
                                    </div>

                                    {/* Benefit Limit Meter */}
                                    <div className="space-y-1.5 md:pl-4">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Annual Aggregate Benefit</span>
                                        <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                            ${remaining.toFixed(2)} <span className="text-xs font-normal text-slate-400">/ ${totalCap} remaining</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${100 - benefitUsedPercent}%` }} />
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            Replacement Credit Allowance: Up to ${contract.replacementCreditLimit || 1500}
                                        </div>
                                    </div>

                                    {/* Validity & Expiration */}
                                    <div className="space-y-1.5 md:pl-4">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Agreement Dates</span>
                                        <div>Agreement Date: <strong>{contract.agreementDate}</strong></div>
                                        <div>Coverage Starts: <strong>{contract.effectiveDate}</strong></div>
                                        <div>Expires: <strong>{contract.expirationDate}</strong> ({daysLeft(expiryDate)} days left)</div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}

                    {/* 2. Job-based Workmanship & Parts warranties */}
                    {jobWarranties.map(w => {
                        const wmActive = isActive(w.workmanshipExpiry, w.disclaimerAgreed);
                        const pmActive = isActive(w.partsExpiry, w.disclaimerAgreed);
                        const anyActive = wmActive || pmActive;

                        return (
                            <Card key={w.jobId} className={`p-0 overflow-hidden border-2 ${anyActive ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-700'}`}>
                                <div className={`px-5 py-3.5 flex justify-between items-center ${anyActive ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{w.jobLabel}</p>
                                            {w.locationName && (
                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-primary-600 dark:text-primary-400 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                                    <MapPin size={10} /> {w.locationName}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">Service date: {new Date(w.jobDate).toLocaleDateString()} &bull; Issued: {new Date(w.issuedDate).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!w.disclaimerAgreed ? (
                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                                <AlertTriangle size={12} /> Disclaimer Pending
                                            </span>
                                        ) : anyActive ? (
                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                                <CheckCircle size={12} /> Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                <Clock size={12} /> Expired
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
                                    {w.workmanshipMonths > 0 && (
                                        <div className="p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Workmanship</p>
                                            <p className="text-xl font-black text-slate-900 dark:text-white">
                                                {wmActive ? monthsLeft(w.workmanshipExpiry) : '—'}
                                                {wmActive && <span className="text-sm font-bold text-slate-400 ml-1">mo left</span>}
                                            </p>
                                            {w.workmanshipExpiry && (
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    {wmActive ? `Expires ${w.workmanshipExpiry.toLocaleDateString()} (${daysLeft(w.workmanshipExpiry)} days)` : `Expired ${w.workmanshipExpiry.toLocaleDateString()}`}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {w.partsMonths > 0 && (
                                        <div className="p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Parts</p>
                                            <p className="text-xl font-black text-slate-900 dark:text-white">
                                                {pmActive ? monthsLeft(w.partsExpiry) : '—'}
                                                {pmActive && <span className="text-sm font-bold text-slate-400 ml-1">mo left</span>}
                                            </p>
                                            {w.partsExpiry && (
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    {pmActive ? `Expires ${w.partsExpiry.toLocaleDateString()} (${daysLeft(w.partsExpiry)} days)` : `Expired ${w.partsExpiry.toLocaleDateString()}`}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {!w.disclaimerAgreed && (
                                    <div className="px-5 py-3 border-t border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 flex justify-between items-center">
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
                                            Review Disclaimer
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}

                </div>
            )}

            {isPurchaseModalOpen && (
                <CustomerWarrantyPurchaseModal
                    isOpen={isPurchaseModalOpen}
                    onClose={() => {
                        setIsPurchaseModalOpen(false);
                        setSelectedEquipForPurchase(null);
                    }}
                    customer={customer}
                    organization={organization}
                    initialEquipment={selectedEquipForPurchase}
                    onProceedToCheckout={(jobId) => {
                        window.location.href = `#/invoice/${jobId}`;
                    }}
                />
            )}
        </section>
    );
};

export default WarrantySection;

