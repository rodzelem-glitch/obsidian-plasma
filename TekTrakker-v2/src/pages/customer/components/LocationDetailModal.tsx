import React, { useState, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import { 
    Building, Home, MapPin, Cog, Wrench, ShieldCheck, 
    Calendar, CheckCircle, Clock, FileText, PlusCircle, 
    ChevronRight, ArrowRight, Sparkles, AlertTriangle, 
    Layers, Search, CheckCircle2, Shield, Info,
    Users, Phone, Mail, Star, UserCheck, Plus,
    CreditCard, Receipt, FileSearch, AlertCircle,
    Camera, Image as ImageIcon, Maximize2, ExternalLink,
    CalendarCheck, CheckSquare, Split, Tag, Activity,
    CalendarClock, X, Download, Inbox
} from 'lucide-react';
import type { ServiceLocation, EquipmentAsset, Job, Customer, Proposal, Organization, ServiceAgreement } from 'types';
import { formatAddress, formatFullAddress } from 'lib/utils';
import { computeCanonicalFinancials, formatCurrency } from 'lib/financialCalculator';
import { formatAgreementDate } from 'lib/membershipHelper';

interface LocationDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    location: ServiceLocation | null;
    customer: Customer;
    organization?: Organization | null;
    membership?: ServiceAgreement | null;
    allAssets: EquipmentAsset[];
    allJobs: Job[];
    allProposals?: Proposal[];
    onSelectUnit: (unit: EquipmentAsset) => void;
    onViewJobReport?: (job: Job) => void;
    onViewInvoice?: (job: Job) => void;
    onPayInvoice?: (job: Job) => void;
    onViewProposal?: (proposal: Proposal) => void;
    onAcceptWarranty?: (job: Job) => void;
    onRequestService: (location: ServiceLocation, unit?: EquipmentAsset) => void;
    onOpenDesignateContacts?: (locationId?: string) => void;
}

export interface FacilityPhotoItem {
    id: string;
    url: string;
    title: string;
    subtitle?: string;
    category: 'site' | 'equipment' | 'service';
    date?: string;
    assetId?: string;
    jobId?: string;
}

const LocationDetailModal: React.FC<LocationDetailModalProps> = ({
    isOpen,
    onClose,
    location,
    customer,
    organization,
    membership,
    allAssets = [],
    allJobs = [],
    allProposals = [],
    onSelectUnit,
    onViewJobReport,
    onViewInvoice,
    onPayInvoice,
    onViewProposal,
    onAcceptWarranty,
    onRequestService,
    onOpenDesignateContacts
}) => {
    const [activeTab, setActiveTab] = useState<'units' | 'workOrders' | 'invoices' | 'maintenance' | 'photos' | 'sublocations' | 'warranties' | 'contacts'>('units');
    const [searchQuery, setSearchQuery] = useState('');
    const [woFilter, setWoFilter] = useState<'all' | 'active' | 'completed' | 'scheduled'>('all');
    const [photoFilter, setPhotoFilter] = useState<'all' | 'site' | 'equipment' | 'service'>('all');
    const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<FacilityPhotoItem | null>(null);

    const isDefaultLocation = location?.id === 'default';

    // 1. Filter equipment belonging to this specific location
    const locationAssets = useMemo(() => {
        if (!location) return [];
        return allAssets.filter(asset => {
            if (isDefaultLocation) {
                return !asset.locationId || asset.locationId === 'default' || (asset as any).propertyId === 'default';
            }
            return asset.locationId === location.id || (asset as any).propertyId === location.id;
        });
    }, [allAssets, location, isDefaultLocation]);

    // 2. Filter jobs belonging to this specific location
    const locationJobs = useMemo(() => {
        if (!location) return [];
        return allJobs.filter(job => {
            if (isDefaultLocation) {
                return !job.locationId || job.locationId === 'default';
            }
            const locAddr = typeof location.address === 'string' ? location.address : formatFullAddress(location.address);
            const jobAddr = typeof job.address === 'string' ? job.address : formatFullAddress(job.address);
            return job.locationId === location.id || (jobAddr && locAddr && jobAddr.toLowerCase().includes(locAddr.toLowerCase().slice(0, 15)));
        });
    }, [allJobs, location, isDefaultLocation]);

    // 3. Location Invoices & Financials
    const locationInvoices = useMemo(() => {
        const list: {
            id: string;
            jobId: string;
            workOrderNumber: string;
            amount: number;
            balanceDue: number;
            amountPaid: number;
            status: 'Paid' | 'Unpaid' | 'Draft' | 'Sent' | 'Partially Paid' | string;
            date: string;
            paidDate?: string;
            tasks: string[];
            job: Job;
            isPaid: boolean;
        }[] = [];

        locationJobs.forEach(job => {
            if (job.invoice) {
                const inv = job.invoice;
                const canonical = computeCanonicalFinancials({
                    items: inv.items || [],
                    subtotal: inv.subtotal,
                    taxRate: inv.taxRate,
                    taxAmount: inv.taxAmount,
                    totalAmount: inv.totalAmount ?? inv.amount,
                    amountPaid: inv.amountPaid,
                    depositPaid: inv.depositPaid,
                    depositPaidAmount: inv.depositPaidAmount,
                    status: inv.status
                });
                const isPaid = String(inv.status).toLowerCase() === 'paid' || canonical.financialStatus === 'PAID' || canonical.balanceDue <= 0;
                const hasBillable = canonical.grandTotal > 0 || (Array.isArray(inv.items) && inv.items.length > 0);
                if (!hasBillable && canonical.grandTotal <= 0) return;

                list.push({
                    id: inv.id || (job.jobNumber && String(job.jobNumber).startsWith('job-') ? job.jobNumber.toUpperCase() : (job.jobNumber || `INV-${job.id.slice(-6).toUpperCase()}`)),
                    jobId: job.id,
                    workOrderNumber: job.workOrderNumber || job.poNumber || `WO-${job.id.slice(-6).toUpperCase()}`,
                    amount: canonical.grandTotal,
                    balanceDue: canonical.balanceDue,
                    amountPaid: canonical.amountPaid,
                    status: isPaid ? 'Paid' : (inv.status || 'Sent'),
                    date: inv.invoiceDate || inv.date || (inv as any).createdAt || (inv as any).sentAt || job.appointmentTime || '',
                    paidDate: inv.paidDate,
                    tasks: job.tasks || [],
                    job,
                    isPaid
                });
            }
        });

        // Sort latest first
        return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }, [locationJobs]);

    const financialTotals = useMemo(() => {
        let totalBilled = 0;
        let totalPaid = 0;
        let totalUnpaid = 0;

        locationInvoices.forEach(inv => {
            totalBilled += inv.amount;
            totalPaid += inv.amountPaid || (inv.isPaid ? inv.amount : 0);
            totalUnpaid += inv.balanceDue !== undefined ? inv.balanceDue : (inv.isPaid ? 0 : inv.amount);
        });

        return { totalBilled, totalPaid, totalUnpaid };
    }, [locationInvoices]);

    // 4. Filter warranties tied to jobs/invoices at this location
    const locationWarranties = useMemo(() => {
        const list: {
            id: string;
            jobId: string;
            jobType?: string;
            invoiceId?: string;
            workmanshipMonths: number;
            partsMonths: number;
            serviceDate: string;
            notes?: string;
            tasks: string[];
        }[] = [];

        locationJobs.forEach(j => {
            const inv = j.invoice;
            if (inv && ((inv.workmanshipWarrantyMonths && inv.workmanshipWarrantyMonths > 0) || (inv.partsWarrantyMonths && inv.partsWarrantyMonths > 0))) {
                list.push({
                    id: `warr-${j.id}`,
                    jobId: j.id,
                    jobType: (j as any).jobType || j.visitType || 'Service & Repair',
                    invoiceId: inv.id,
                    workmanshipMonths: inv.workmanshipWarrantyMonths || 0,
                    partsMonths: inv.partsWarrantyMonths || 0,
                    serviceDate: j.appointmentTime || inv.paidDate || inv.sentAt || '',
                    notes: inv.warrantyNotes || '',
                    tasks: j.tasks || []
                });
            }
        });

        return list;
    }, [locationJobs]);

    // 5. Filter contacts designated for this location
    const locationContacts = useMemo(() => {
        if (!location) return [];
        const rawContacts = (customer.contacts || []) as any[];
        return rawContacts.filter(c => {
            const locIds = c.assignedLocationIds || c.allowedLocationIds || [];
            if (isDefaultLocation) {
                return locIds.length === 0 || locIds.includes('default');
            }
            return locIds.includes(location.id);
        });
    }, [customer.contacts, location, isDefaultLocation]);

    // 6. Comprehensive Photo Stream for this Location
    const allFacilityPhotos = useMemo<FacilityPhotoItem[]>(() => {
        const photos: FacilityPhotoItem[] = [];

        // A. Property & Site Photos
        if (location?.photos && Array.isArray(location.photos)) {
            location.photos.forEach((url, idx) => {
                if (url && typeof url === 'string') {
                    photos.push({
                        id: `loc-photo-${idx}`,
                        url,
                        title: `${location.propertyName || location.name || 'Facility'} Property Photo`,
                        subtitle: location.building ? `Building ${location.building}` : undefined,
                        category: 'site'
                    });
                }
            });
        }
        if (location?.layoutPhotoUrl) {
            photos.push({
                id: 'loc-layout-photo',
                url: location.layoutPhotoUrl,
                title: 'Facility Layout & Equipment Floorplan',
                subtitle: 'Site map and spatial unit placement',
                category: 'site'
            });
        }

        // B. Equipment Unit Photos
        locationAssets.forEach((asset) => {
            const assetLabel = `${asset.brand} ${asset.model} (${asset.type || 'Unit'})`;
            const placement = asset.physicalLocation || asset.exactPlacement || 'On Site';

            if (asset.serialPhotoUrl) {
                photos.push({
                    id: `asset-serial-${asset.id}`,
                    url: asset.serialPhotoUrl,
                    title: `${assetLabel} — Serial Nameplate`,
                    subtitle: `S/N: ${asset.serial || 'N/A'} · ${placement}`,
                    category: 'equipment',
                    assetId: asset.id
                });
            }
            if (asset.conditionPhotoUrl) {
                photos.push({
                    id: `asset-condition-${asset.id}`,
                    url: asset.conditionPhotoUrl,
                    title: `${assetLabel} — Condition Photo`,
                    subtitle: `Condition: ${asset.condition || 'Good'} · ${placement}`,
                    category: 'equipment',
                    assetId: asset.id
                });
            }
            if (asset.unitTagPhotoUrl) {
                photos.push({
                    id: `asset-tag-${asset.id}`,
                    url: asset.unitTagPhotoUrl,
                    title: `${assetLabel} — Asset Tag Photo`,
                    subtitle: `Tag: ${asset.assetTag || 'N/A'} · ${placement}`,
                    category: 'equipment',
                    assetId: asset.id
                });
            }
            if (asset.wideLocationPhotoUrl) {
                photos.push({
                    id: `asset-wide-${asset.id}`,
                    url: asset.wideLocationPhotoUrl,
                    title: `${assetLabel} — Surrounding Context & Placement`,
                    subtitle: placement,
                    category: 'equipment',
                    assetId: asset.id
                });
            }
            if (asset.accessPointPhotoUrl) {
                photos.push({
                    id: `asset-access-${asset.id}`,
                    url: asset.accessPointPhotoUrl,
                    title: `${assetLabel} — Service Access Point`,
                    subtitle: `Access: ${placement}`,
                    category: 'equipment',
                    assetId: asset.id
                });
            }
            if (asset.qrCodePhotoUrl) {
                photos.push({
                    id: `asset-qr-${asset.id}`,
                    url: asset.qrCodePhotoUrl,
                    title: `${assetLabel} — Digital Passport QR Code`,
                    subtitle: `S/N: ${asset.serial || 'N/A'}`,
                    category: 'equipment',
                    assetId: asset.id
                });
            }
        });

        // C. Work Order Inspection Photos & QC Media
        locationJobs.forEach((job) => {
            const woNum = job.workOrderNumber || job.poNumber || `WO-${job.id.slice(-6).toUpperCase()}`;
            const jobDate = job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : undefined;

            if (job.files && Array.isArray(job.files)) {
                job.files.forEach((file, idx) => {
                    const fileUrl = file.url || (file as any).dataUrl;
                    const fileName = (file as any).fileName || (file as any).name || 'Inspection Photo';
                    const fileType = (file as any).fileType || (file as any).type || '';
                    const isImg = fileType.startsWith('image/') || 
                        fileUrl?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) || 
                        fileName?.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                    
                    if (isImg && fileUrl) {
                        photos.push({
                            id: `job-file-${job.id}-${idx}`,
                            url: fileUrl,
                            title: fileName || `${woNum} Inspection Photo`,
                            subtitle: `${woNum} · Tech: ${job.assignedTechnicianName || 'Field Technician'}`,
                            category: 'service',
                            date: jobDate,
                            jobId: job.id
                        });
                    }
                });
            }

            if (job.qcAudits && Array.isArray(job.qcAudits)) {
                job.qcAudits.forEach((qc, idx) => {
                    if (qc.imageUrl) {
                        photos.push({
                            id: `job-qc-${job.id}-${idx}`,
                            url: qc.imageUrl,
                            title: `Quality Audit: ${qc.status.toUpperCase()}`,
                            subtitle: `${woNum} · ${qc.comments || 'Inspection Verification'}`,
                            category: 'service',
                            date: qc.timestamp ? new Date(qc.timestamp).toLocaleDateString() : jobDate,
                            jobId: job.id
                        });
                    }
                });
            }
        });

        return photos;
    }, [location, locationAssets, locationJobs]);

    // 7. Sublocations & Zones Directory
    const sublocationsList = useMemo(() => {
        const map = new Map<string, {
            name: string;
            type: string;
            building?: string;
            notes?: string;
            assets: EquipmentAsset[];
            activeJobs: Job[];
        }>();

        // Check if location has explicit sublocations
        if (location && (location as any).subLocations && Array.isArray((location as any).subLocations)) {
            (location as any).subLocations.forEach((sub: any) => {
                const key = sub.name || sub.id;
                map.set(key, {
                    name: sub.name || 'Sublocation',
                    type: sub.type || 'Facility Subzone',
                    building: sub.building || (location as any).building,
                    notes: sub.notes,
                    assets: [],
                    activeJobs: []
                });
            });
        }

        // Add zones / physical locations from assets
        locationAssets.forEach((asset) => {
            const zoneName = asset.physicalLocation || asset.zone || asset.servesArea || 'Main Area';
            if (!map.has(zoneName)) {
                map.set(zoneName, {
                    name: zoneName,
                    type: asset.physicalLocation?.toLowerCase().includes('roof') ? 'Rooftop Zone' : 
                          asset.physicalLocation?.toLowerCase().includes('mech') ? 'Mechanical Room' : 'Facility Area',
                    building: (location as any)?.building,
                    notes: asset.exactPlacement,
                    assets: [],
                    activeJobs: []
                });
            }
            map.get(zoneName)?.assets.push(asset);
        });

        // Add open jobs if tagged with placement
        const openList = locationJobs.filter(j => j.jobStatus !== 'Completed');
        openList.forEach(j => {
            const taskStr = (j.tasks || []).join(' ');
            map.forEach((sub, key) => {
                if (taskStr.toLowerCase().includes(key.toLowerCase())) {
                    sub.activeJobs.push(j);
                }
            });
        });

        return Array.from(map.values());
    }, [location, locationAssets, locationJobs]);

    if (!location) return null;

    const openJobs = locationJobs.filter(j => j.jobStatus !== 'Completed');
    const completedJobs = locationJobs.filter(j => j.jobStatus === 'Completed');
    const scheduledJobs = locationJobs.filter(j => j.jobStatus === 'Scheduled');

    // Filter work orders by status
    const filteredJobs = locationJobs.filter(job => {
        if (woFilter === 'active') return job.jobStatus !== 'Completed';
        if (woFilter === 'completed') return job.jobStatus === 'Completed';
        if (woFilter === 'scheduled') return job.jobStatus === 'Scheduled';
        return true;
    });

    // Filter photos by category
    const filteredPhotos = allFacilityPhotos.filter(p => {
        if (photoFilter === 'site') return p.category === 'site';
        if (photoFilter === 'equipment') return p.category === 'equipment';
        if (photoFilter === 'service') return p.category === 'service';
        return true;
    });

    const filteredAssets = locationAssets.filter(a => {
        const query = searchQuery.toLowerCase();
        return (
            (a.name || '').toLowerCase().includes(query) ||
            (a.brand || '').toLowerCase().includes(query) ||
            (a.model || '').toLowerCase().includes(query) ||
            (a.serial || '').toLowerCase().includes(query) ||
            (a.type || '').toLowerCase().includes(query) ||
            (a.physicalLocation || '').toLowerCase().includes(query) ||
            (a.exactPlacement || '').toLowerCase().includes(query)
        );
    });

    const formattedAddress = typeof location.address === 'string' 
        ? location.address 
        : (formatFullAddress(location.address) || 'Address on file');

    const getHealthBadge = (health?: string) => {
        const h = (health || 'Good').toLowerCase();
        if (h.includes('good') || h.includes('optimum') || h.includes('pass') || h.includes('excellent')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={11} /> Good Condition
                </span>
            );
        }
        if (h.includes('fair') || h.includes('monitor') || h.includes('warn')) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Clock size={11} /> Monitor / Fair
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                <AlertTriangle size={11} /> Needs Attention
            </span>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${location.propertyName || location.name || 'Property'} Facility Hub`} size="xl">
            <div className="space-y-6">
                {/* Hero Facility Banner */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-start sm:items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shrink-0">
                                {location.locationType === 'Commercial' ? <Building size={32} /> : <Home size={32} />}
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-xl sm:text-2xl font-black text-white">
                                        {location.propertyName || location.name || 'Facility Property'}
                                    </h3>
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-bold uppercase">
                                        {location.locationType || 'Commercial Site'}
                                    </span>
                                    {membership && (
                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                                            <Sparkles size={10} /> Active Service Agreement
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-1.5">
                                    <MapPin size={14} className="text-indigo-400 shrink-0" />
                                    <span>{formattedAddress} {location.city ? `· ${location.city}, ${location.state || ''}` : ''}</span>
                                </p>
                                {((location as any).building || (location as any).subLocationName || (location as any).accessNotes || (location as any).notes || (location as any).accessInstructions) && (
                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                                        {(location as any).building && <span className="font-semibold text-slate-300">🏢 Bldg: {(location as any).building}</span>}
                                        {(location as any).subLocationName && <span className="font-semibold text-slate-300">📍 Sub: {(location as any).subLocationName}</span>}
                                        {((location as any).accessNotes || (location as any).notes || (location as any).accessInstructions) && (
                                            <span className="font-semibold text-indigo-300 italic">
                                                🔑 {(location as any).accessNotes || (location as any).notes || (location as any).accessInstructions}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Action */}
                        <div className="shrink-0 flex gap-2 w-full sm:w-auto">
                            <Button
                                onClick={() => {
                                    onClose();
                                    onRequestService(location);
                                }}
                                className="w-full sm:w-auto text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <PlusCircle size={15} /> Book Service at Property
                            </Button>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 mt-6 pt-5 border-t border-indigo-900/60">
                        <div 
                            onClick={() => setActiveTab('units')}
                            className="bg-slate-900/70 p-2.5 rounded-xl border border-indigo-900/40 cursor-pointer hover:border-indigo-400/50 transition-all"
                        >
                            <p className="text-[9px] font-black uppercase text-indigo-300">Equipment Units</p>
                            <p className="text-lg font-black text-white mt-0.5">{locationAssets.length}</p>
                        </div>
                        <div 
                            onClick={() => setActiveTab('workOrders')}
                            className="bg-slate-900/70 p-2.5 rounded-xl border border-indigo-900/40 cursor-pointer hover:border-amber-400/50 transition-all"
                        >
                            <p className="text-[9px] font-black uppercase text-amber-300">Active WOs</p>
                            <p className="text-lg font-black text-amber-400 mt-0.5">{openJobs.length}</p>
                        </div>
                        <div 
                            onClick={() => setActiveTab('invoices')}
                            className="bg-slate-900/70 p-2.5 rounded-xl border border-indigo-900/40 cursor-pointer hover:border-rose-400/50 transition-all"
                        >
                            <p className="text-[9px] font-black uppercase text-slate-300">Unpaid Balance</p>
                            <p className={`text-lg font-black mt-0.5 ${financialTotals.totalUnpaid > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                ${financialTotals.totalUnpaid.toFixed(2)}
                            </p>
                        </div>
                        <div 
                            onClick={() => setActiveTab('maintenance')}
                            className="bg-slate-900/70 p-2.5 rounded-xl border border-indigo-900/40 cursor-pointer hover:border-emerald-400/50 transition-all"
                        >
                            <p className="text-[9px] font-black uppercase text-emerald-300">Maintenance Plan</p>
                            <p className="text-sm font-black text-white mt-0.5 truncate">
                                {membership ? `${membership.visitsRemaining || 0} Visits Left` : 'Active Coverage'}
                            </p>
                        </div>
                        <div 
                            onClick={() => setActiveTab('photos')}
                            className="bg-slate-900/70 p-2.5 rounded-xl border border-indigo-900/40 cursor-pointer hover:border-sky-400/50 transition-all"
                        >
                            <p className="text-[9px] font-black uppercase text-sky-300">Photos &amp; Media</p>
                            <p className="text-lg font-black text-sky-400 mt-0.5">{allFacilityPhotos.length}</p>
                        </div>
                        <div 
                            onClick={() => setActiveTab('sublocations')}
                            className="bg-slate-900/70 p-2.5 rounded-xl border border-indigo-900/40 cursor-pointer hover:border-purple-400/50 transition-all"
                        >
                            <p className="text-[9px] font-black uppercase text-purple-300">Zones / Sublocs</p>
                            <p className="text-lg font-black text-purple-400 mt-0.5">{sublocationsList.length}</p>
                        </div>
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 gap-3 sm:gap-5 overflow-x-auto no-scrollbar pb-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('units')}
                        className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'units'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Cog size={15} /> Equipment &amp; Units ({locationAssets.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('workOrders')}
                        className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'workOrders'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Wrench size={15} /> Work Orders ({locationJobs.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('invoices')}
                        className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'invoices'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Receipt size={15} /> Invoices &amp; Receipts ({locationInvoices.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('maintenance')}
                        className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'maintenance'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <CalendarClock size={15} /> Maintenance Plan &amp; Schedule
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('photos')}
                        className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'photos'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Camera size={15} /> Photos &amp; Inspection Gallery ({allFacilityPhotos.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('sublocations')}
                        className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'sublocations'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Split size={15} /> Sublocations &amp; Zones ({sublocationsList.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('warranties')}
                        className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'warranties'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <ShieldCheck size={15} /> Warranties ({locationWarranties.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('contacts')}
                        className={`pb-2.5 text-xs sm:text-sm font-black transition-colors relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            activeTab === 'contacts'
                                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Users size={15} /> Designated POCs ({locationContacts.length})
                    </button>
                </div>

                {/* TAB 1: EQUIPMENT & UNITS */}
                {activeTab === 'units' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Click any unit below to view complete specifications, photos, refrigerant charge logs, and service history.
                            </p>
                            <div className="w-full sm:w-64">
                                <input
                                    type="text"
                                    placeholder="Search units at this property..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>

                        {filteredAssets.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                                <Cog size={32} className="mx-auto text-slate-400" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No equipment units found at this location</p>
                                <p className="text-xs text-slate-400">Our technicians will log newly serviced equipment on their next visit.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                                {filteredAssets.map((asset) => (
                                    <div
                                        key={asset.id}
                                        onClick={() => {
                                            onSelectUnit(asset);
                                        }}
                                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                                        <Cog size={16} />
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-slate-900 dark:text-white text-sm group-hover:text-primary-600 transition-colors">
                                                            {asset.brand} {asset.model}
                                                        </h5>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                            {asset.type || 'Equipment Unit'} {asset.tonnage ? `· ${asset.tonnage} Ton` : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                {getHealthBadge(asset.condition)}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 uppercase block font-bold">Serial Number</span>
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                                                        {asset.serial || 'N/A'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 uppercase block font-bold">Placement / Zone</span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                                                        {asset.physicalLocation || asset.exactPlacement || asset.zone || 'On Site'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-primary-600 group-hover:translate-x-0.5 transition-transform">
                                            <span>View Unit Specs &amp; Photos</span>
                                            <ChevronRight size={14} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: WORK ORDERS & SERVICE HISTORY */}
                {activeTab === 'workOrders' && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setWoFilter('all')}
                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                                        woFilter === 'all' 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    All ({locationJobs.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWoFilter('active')}
                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                                        woFilter === 'active' 
                                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Active / In Progress ({openJobs.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWoFilter('completed')}
                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                                        woFilter === 'completed' 
                                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Completed ({completedJobs.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWoFilter('scheduled')}
                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                                        woFilter === 'scheduled' 
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Scheduled ({scheduledJobs.length})
                                </button>
                            </div>

                            <Button
                                size="sm"
                                onClick={() => {
                                    onClose();
                                    onRequestService(location);
                                }}
                                className="text-xs font-black bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-1.5"
                            >
                                <Plus size={14} /> Request New Work Order
                            </Button>
                        </div>

                        {filteredJobs.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                                <Wrench size={32} className="mx-auto text-slate-400" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No work orders matching this filter</p>
                                <p className="text-xs text-slate-400">All service history and maintenance requests appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                                {filteredJobs.map((job) => {
                                    const isCompleted = job.jobStatus === 'Completed';
                                    const invoice = job.invoice;
                                    const canonical = invoice ? computeCanonicalFinancials({
                                        items: invoice.items || [],
                                        subtotal: invoice.subtotal,
                                        taxRate: invoice.taxRate,
                                        taxAmount: invoice.taxAmount,
                                        totalAmount: invoice.totalAmount ?? invoice.amount,
                                        amountPaid: invoice.amountPaid,
                                        depositPaid: invoice.depositPaid,
                                        depositPaidAmount: invoice.depositPaidAmount,
                                        status: invoice.status
                                    }) : null;
                                    const hasInvoice = !!invoice && (canonical ? (canonical.grandTotal > 0 || (Array.isArray(invoice.items) && invoice.items.length > 0)) : (invoice.totalAmount || invoice.amount || 0) > 0);
                                    const isInvoicePaid = String(invoice?.status).toLowerCase() === 'paid' || canonical?.financialStatus === 'PAID' || (canonical ? canonical.balanceDue <= 0 : false);
                                    const invoiceAmount = canonical ? canonical.balanceDue : (invoice?.totalAmount || invoice?.amount || 0);
                                    const matchingProposal = (allProposals || []).find(p => p.jobId === job.id || (job.linkedProposalIds && job.linkedProposalIds.includes(p.id)) || p.id === job.proposalId);
                                    const hasProposal = !!matchingProposal;
                                    const isProposalAccepted = matchingProposal?.status === 'Accepted';
                                    const wm = (invoice as any)?.workmanshipWarrantyMonths || 0;
                                    const pm = (invoice as any)?.partsWarrantyMonths || 0;
                                    const hasWarranty = wm > 0 || pm > 0;

                                    return (
                                        <div
                                            key={job.id}
                                            className={`p-4 rounded-2xl border-2 transition-all hover:shadow-md bg-white dark:bg-slate-900 space-y-3 ${
                                                !isCompleted 
                                                    ? 'border-blue-200 dark:border-blue-900/40' 
                                                    : (hasInvoice && !isInvoicePaid) 
                                                    ? 'border-rose-200 dark:border-rose-900/40' 
                                                    : 'border-slate-200 dark:border-slate-700'
                                            }`}
                                        >
                                            {/* Header */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-900 dark:text-white text-sm">
                                                        {job.workOrderNumber || job.poNumber || `WO-${job.id.slice(-6).toUpperCase()}`}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                        isCompleted 
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                    }`}>
                                                        {job.jobStatus}
                                                    </span>
                                                    {job.poNumber && (
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                                                            PO: {job.poNumber}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {hasInvoice && (
                                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg font-mono ${
                                                            isInvoicePaid 
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                                        }`}>
                                                            {isInvoicePaid ? 'PAID' : 'UNPAID'}: ${invoiceAmount.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Details */}
                                            <div className="space-y-1">
                                                <h5 className="font-black text-slate-900 dark:text-white text-sm">
                                                    {(job.tasks || []).join(', ') || (job as any).jobType || job.visitType || 'General Service Visit'}
                                                </h5>
                                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                                    <span>📅 {new Date(job.appointmentTime).toLocaleDateString()}</span>
                                                    {job.assignedTechnicianName && <span>👤 Tech: {job.assignedTechnicianName}</span>}
                                                    {job.notes?.diagnosis && <span className="text-slate-500 dark:text-slate-400">🔍 {job.notes.diagnosis.slice(0, 60)}...</span>}
                                                    {hasWarranty && (
                                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                            🛡️ Warranty: {wm || pm} Mo
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {/* Pay Invoice / View Receipt */}
                                                    {hasInvoice && (
                                                        !isInvoicePaid ? (
                                                            <>
                                                                {onPayInvoice && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onPayInvoice(job)}
                                                                        className="text-xs font-black bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
                                                                    >
                                                                        <CreditCard size={12} /> Pay Invoice (${invoiceAmount.toFixed(2)})
                                                                    </button>
                                                                )}
                                                                {onViewInvoice && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onViewInvoice(job)}
                                                                        className="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                                                                    >
                                                                        <FileText size={12} /> View Invoice
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            onViewInvoice && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onViewInvoice(job)}
                                                                    className="text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Receipt size={12} /> View Receipt
                                                                </button>
                                                            )
                                                        )
                                                    )}

                                                    {/* Proposal */}
                                                    {hasProposal && onViewProposal && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onViewProposal(matchingProposal)}
                                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer ${
                                                                isProposalAccepted 
                                                                    ? 'bg-purple-50 text-purple-800 border border-purple-200' 
                                                                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                                                            }`}
                                                        >
                                                            <FileSearch size={12} />
                                                            {isProposalAccepted ? 'Accepted Quote' : `Review Proposal ($${matchingProposal.total.toFixed(0)})`}
                                                        </button>
                                                    )}

                                                    {/* Warranty */}
                                                    {hasWarranty && onAcceptWarranty && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onAcceptWarranty(job)}
                                                            className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <ShieldCheck size={12} /> View Warranty
                                                        </button>
                                                    )}
                                                </div>

                                                {onViewJobReport && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onViewJobReport(job)}
                                                        className="text-xs font-black bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer ml-auto"
                                                    >
                                                        <FileText size={12} /> Full Report <ChevronRight size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: INVOICES & RECEIPTS */}
                {activeTab === 'invoices' && (
                    <div className="space-y-4">
                        {/* Financial Ledger Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Invoiced to Property</span>
                                <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                    ${financialTotals.totalBilled.toFixed(2)}
                                </p>
                            </div>
                            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60">
                                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Total Settled / Receipts</span>
                                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                                    ${financialTotals.totalPaid.toFixed(2)}
                                </p>
                            </div>
                            <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-200 dark:border-rose-800/60">
                                <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 block">Outstanding Balance</span>
                                <p className={`text-xl font-black mt-1 ${financialTotals.totalUnpaid > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                    ${financialTotals.totalUnpaid.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {locationInvoices.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                                <Receipt size={32} className="mx-auto text-slate-400" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No invoices or receipts on record for this property</p>
                                <p className="text-xs text-slate-400">Invoices and payment receipts will populate automatically following completed service visits.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                                {locationInvoices.map((inv) => (
                                    <div
                                        key={inv.id}
                                        className={`p-4 rounded-2xl border transition-all bg-white dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                                            inv.isPaid 
                                                ? 'border-slate-200 dark:border-slate-800' 
                                                : 'border-rose-300 dark:border-rose-900/60 shadow-sm'
                                        }`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                                    Invoice #{inv.id}
                                                </span>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                    inv.isPaid
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                                }`}>
                                                    {inv.status}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    WO: {inv.workOrderNumber}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {inv.tasks.join(', ') || 'Service Visit'}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                                                <span>Issued: {inv.date ? new Date(inv.date).toLocaleDateString() : 'On File'}</span>
                                                {inv.paidDate && <span className="text-emerald-600 font-bold">Paid: {new Date(inv.paidDate).toLocaleDateString()}</span>}
                                            </div>
                                        </div>

                                        <div className="flex sm:flex-col items-end justify-between w-full sm:w-auto gap-2">
                                            <span className="text-base font-mono font-black text-slate-900 dark:text-white">
                                                ${inv.amount.toFixed(2)}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {!inv.isPaid && onPayInvoice && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onPayInvoice(inv.job)}
                                                        className="text-xs font-black bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
                                                    >
                                                        <CreditCard size={12} /> Pay Now
                                                    </button>
                                                )}
                                                {onViewInvoice && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onViewInvoice(inv.job)}
                                                        className="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                                                    >
                                                        {inv.isPaid ? <Receipt size={12} /> : <FileText size={12} />}
                                                        <span>{inv.isPaid ? 'View Receipt' : 'View Invoice'}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 4: MAINTENANCE PLAN & SCHEDULE */}
                {activeTab === 'maintenance' && (
                    <div className="space-y-4">
                        {membership ? (
                            <div className="space-y-4">
                                {/* Plan Card */}
                                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg space-y-4">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Sparkles size={18} className="text-amber-300" />
                                                <h4 className="text-lg font-black">{membership.planName} Plan</h4>
                                                <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-white/30">
                                                    Active Coverage
                                                </span>
                                            </div>
                                            <p className="text-xs text-emerald-100 mt-1">
                                                Property is enrolled in active recurring preventative maintenance with priority dispatch.
                                            </p>
                                        </div>

                                        <div className="text-right sm:text-right w-full sm:w-auto">
                                            <span className="text-[10px] uppercase font-bold text-emerald-200 block">Renews</span>
                                            <span className="text-sm font-black font-mono">
                                                {formatAgreementDate(membership)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Visits Progress */}
                                    <div className="bg-black/20 p-3.5 rounded-xl border border-white/10 space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span>Annual Comprehensive Tune-Ups</span>
                                            <span>
                                                {membership.visitsRemaining} of {membership.visitsTotal} Visits Remaining
                                            </span>
                                        </div>
                                        <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-amber-300 h-full rounded-full transition-all"
                                                style={{ 
                                                    width: `${membership.visitsTotal > 0 ? ((membership.visitsTotal - membership.visitsRemaining) / membership.visitsTotal) * 100 : 0}%` 
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Scheduled Seasons & Checkup Intervals */}
                                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                                    <h5 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <CalendarClock size={16} className="text-emerald-600" />
                                        <span>Recommended Maintenance Inspection Schedule</span>
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                                            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                                                <span>🌸 Spring Precision Cooling Tune-Up</span>
                                                <span className="text-emerald-600 font-bold">March - May</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                                Refrigerant charge validation, condenser coil wash, contactor inspect, capacitor testing, and static pressure checks.
                                            </p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                                            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                                                <span>🍂 Fall Heating Safety &amp; Combustion</span>
                                                <span className="text-amber-600 font-bold">Sept - Nov</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                                Heat exchanger inspection, burner cleaning, flame sensor verification, carbon monoxide testing, and safety limit checks.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Plan Benefits Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <ShieldCheck size={18} className="text-emerald-600 mb-1" />
                                        <p className="text-xs font-black text-slate-900 dark:text-white">15% Off All Repairs</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Discount applied automatically to replacement parts and labor.</p>
                                    </div>
                                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <Clock size={18} className="text-indigo-600 mb-1" />
                                        <p className="text-xs font-black text-slate-900 dark:text-white">VIP Priority Dispatch</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Emergency front-of-the-line queue jump for heating and cooling outages.</p>
                                    </div>
                                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <CheckCircle size={18} className="text-teal-600 mb-1" />
                                        <p className="text-xs font-black text-slate-900 dark:text-white">Zero Diagnostic Fees</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Service trip fee waived on all covered preventative maintenance appointments.</p>
                                    </div>
                                </div>

                                {/* Schedule CTA */}
                                <Button
                                    onClick={() => {
                                        onClose();
                                        onRequestService(location);
                                    }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-md"
                                >
                                    <CalendarCheck size={16} />
                                    <span>Schedule Seasonal Maintenance Visit for this Property</span>
                                    <ArrowRight size={14} />
                                </Button>
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-indigo-900/60 space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-400/30">
                                        <CalendarClock size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-base font-black">Facility Preventative Maintenance Agreement</h4>
                                        <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                                            Keep this facility running at peak efficiency, extend equipment lifespan, and guarantee compliance with scheduled semi-annual tune-ups, filter rotations, and discounted repair rates.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-indigo-900/60 text-xs">
                                    <div className="p-3 bg-slate-900/60 rounded-xl border border-indigo-900/40 space-y-1">
                                        <span className="font-black text-indigo-300">🏢 Multi-Unit Property Coverage</span>
                                        <p className="text-[11px] text-slate-400">Covers all {locationAssets.length} registered equipment units at this site.</p>
                                    </div>
                                    <div className="p-3 bg-slate-900/60 rounded-xl border border-indigo-900/40 space-y-1">
                                        <span className="font-black text-emerald-300">⚡ Energy &amp; System Health Protection</span>
                                        <p className="text-[11px] text-slate-400">Reduces breakdown risks during extreme summer heat and winter freezes.</p>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => {
                                        onClose();
                                        onRequestService(location);
                                    }}
                                    className="w-full bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2"
                                >
                                    <PlusCircle size={15} />
                                    <span>Request Maintenance Plan Enrollment for this Property</span>
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 5: PHOTOS & INSPECTION GALLERY */}
                {activeTab === 'photos' && (
                    <div className="space-y-4">
                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setPhotoFilter('all')}
                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                                        photoFilter === 'all' 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    All Photos ({allFacilityPhotos.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPhotoFilter('site')}
                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                                        photoFilter === 'site' 
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Site &amp; Layout
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPhotoFilter('equipment')}
                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                                        photoFilter === 'equipment' 
                                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Equipment Units
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPhotoFilter('service')}
                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                                        photoFilter === 'service' 
                                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    Service Inspections
                                </button>
                            </div>
                        </div>

                        {filteredPhotos.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                                <Camera size={32} className="mx-auto text-slate-400" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No photos found in this category</p>
                                <p className="text-xs text-slate-400">Photos uploaded by technicians during inspections or unit installations will appear here.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto pr-1">
                                {filteredPhotos.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => setActiveLightboxPhoto(item)}
                                        className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-square cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                                    >
                                        <img
                                            src={item.url}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:opacity-85 transition-opacity"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 p-2.5 flex flex-col justify-between">
                                            <div className="flex justify-between items-start">
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                    item.category === 'site' ? 'bg-indigo-600/80 text-white' :
                                                    item.category === 'equipment' ? 'bg-emerald-600/80 text-white' :
                                                    'bg-blue-600/80 text-white'
                                                }`}>
                                                    {item.category}
                                                </span>
                                                <div className="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Maximize2 size={11} />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-white truncate drop-shadow-sm">
                                                    {item.title}
                                                </p>
                                                {item.subtitle && (
                                                    <p className="text-[10px] text-slate-300 truncate drop-shadow-sm">
                                                        {item.subtitle}
                                                    </p>
                                                )}
                                                {item.date && (
                                                    <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                                                        {item.date}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 6: SUBLOCATIONS & ZONES */}
                {activeTab === 'sublocations' && (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Facility structural breakdown of distinct zones, suites, rooftops, and mechanical rooms at <strong>{location.propertyName || location.name}</strong>.
                        </p>

                        {/* Floorplan Layout Graphic if present */}
                        {location.layoutPhotoUrl && (
                            <div className="p-4 bg-slate-900 rounded-2xl border border-indigo-900/50 space-y-2">
                                <div className="flex justify-between items-center text-white">
                                    <span className="text-xs font-black flex items-center gap-1.5">
                                        <Layers size={14} className="text-indigo-400" />
                                        <span>Property Floorplan &amp; Equipment Placement Blueprint</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveLightboxPhoto({
                                            id: 'floorplan',
                                            url: location.layoutPhotoUrl!,
                                            title: 'Facility Layout & Floorplan Blueprint',
                                            category: 'site'
                                        })}
                                        className="text-xs text-indigo-300 font-bold hover:underline flex items-center gap-1"
                                    >
                                        <Maximize2 size={12} /> Expand Blueprint
                                    </button>
                                </div>
                                <div className="h-44 rounded-xl overflow-hidden bg-black/40 border border-white/10">
                                    <img
                                        src={location.layoutPhotoUrl}
                                        alt="Facility Blueprint"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>
                        )}

                        {sublocationsList.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                                <Split size={32} className="mx-auto text-slate-400" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Single Zone Facility</p>
                                <p className="text-xs text-slate-400">All equipment units are assigned to the primary property zone.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {sublocationsList.map((sub, idx) => (
                                    <Card
                                        key={idx}
                                        className="p-4 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-primary-500" />
                                                    <h5 className="font-black text-sm text-slate-900 dark:text-white">
                                                        {sub.name}
                                                    </h5>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                                                    {sub.type} {sub.building ? `· Bldg ${sub.building}` : ''}
                                                </span>
                                            </div>
                                            <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                {sub.assets.length} Units Assigned
                                            </span>
                                        </div>

                                        {sub.notes && (
                                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg italic">
                                                "{sub.notes}"
                                            </p>
                                        )}

                                        {/* Assigned Assets */}
                                        {sub.assets.length > 0 && (
                                            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] font-black uppercase text-slate-400 block">
                                                    Equipment in this Zone:
                                                </span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {sub.assets.map(a => (
                                                        <button
                                                            key={a.id}
                                                            type="button"
                                                            onClick={() => onSelectUnit(a)}
                                                            className="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 hover:text-primary-600 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Cog size={11} className="text-slate-400" />
                                                            <span>{a.brand} {a.model}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {sub.activeJobs.length > 0 && (
                                            <div className="pt-2 border-t border-amber-100 dark:border-amber-900/40 text-[11px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                <span>{sub.activeJobs.length} active service visit(s) currently open in this zone.</span>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 7: WARRANTIES & COVERAGE */}
                {activeTab === 'warranties' && (
                    <div className="space-y-4">
                        {locationWarranties.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                                <ShieldCheck size={32} className="mx-auto text-slate-400" />
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No active warranties recorded for this property</p>
                                <p className="text-xs text-slate-400">Warranties are registered automatically on eligible parts and labor invoices.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                                {locationWarranties.map((warr) => (
                                    <div
                                        key={warr.id}
                                        className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                    <Shield size={12} /> Active Service Warranty
                                                </span>
                                                <h5 className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                                                    {warr.tasks.join(', ') || warr.jobType}
                                                </h5>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-mono font-bold text-slate-500">
                                                    Invoice: {warr.invoiceId}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                                            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200/40">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Labor / Workmanship</span>
                                                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                                    {warr.workmanshipMonths} Months Coverage
                                                </span>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-200/40">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Replacement Parts</span>
                                                <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                                    {warr.partsMonths} Months Coverage
                                                </span>
                                            </div>
                                        </div>

                                        {warr.notes && (
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium italic">
                                                "{warr.notes}"
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 8: DESIGNATED POCS & ACCOUNT MANAGERS */}
                {activeTab === 'contacts' && (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div>
                                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Users size={16} className="text-primary-600" />
                                    <span>Authorized Property Managers &amp; Contacts</span>
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Individuals designated to receive service dispatches, authorize on-site access, and approve work orders for this property.
                                </p>
                            </div>

                            {onOpenDesignateContacts && (
                                <Button 
                                    size="sm"
                                    onClick={() => onOpenDesignateContacts(location.id)}
                                    className="bg-primary-600 hover:bg-primary-700 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm"
                                >
                                    <Plus size={14} /> Assign / Edit POCs
                                </Button>
                            )}
                        </div>

                        {locationContacts.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                                <Users size={36} className="mx-auto text-slate-400" />
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No designated contacts assigned to this property yet</p>
                                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                                        Designate an Account Manager or On-Site POC to receive technician arrival alerts, work order authorization requests, and reports for this property.
                                    </p>
                                </div>
                                {onOpenDesignateContacts && (
                                    <Button 
                                        size="sm" 
                                        onClick={() => onOpenDesignateContacts(location.id)}
                                        className="bg-emerald-600 hover:bg-emerald-700 font-black text-xs"
                                    >
                                        <Plus size={14} className="mr-1" /> Designate First Contact
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {locationContacts.map((c: any) => (
                                    <Card 
                                        key={c.id || c.email} 
                                        className="p-4 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-indigo-700 text-white flex items-center justify-center font-black text-xs shadow-md">
                                                    {(c.name || 'POC').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className="font-black text-sm text-slate-900 dark:text-white">{c.name}</p>
                                                        {(c.isIncomingWorkOrderContact || (c.contactRoles && c.contactRoles.includes('incoming_workorders'))) && (
                                                            <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5 border border-amber-300 dark:border-amber-800">
                                                                <Inbox size={9} /> Incoming Work Orders
                                                            </span>
                                                        )}
                                                        {c.isAccountManager && (
                                                            <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5">
                                                                <Star size={9} /> AM
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-bold">{c.title || c.role || 'Designated POC'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                                            {c.phone && (
                                                <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-primary-600 font-medium">
                                                    <Phone size={12} className="text-primary-500 shrink-0" />
                                                    <span>{c.phone} {c.extension && `(Ext: ${c.extension})`}</span>
                                                </a>
                                            )}
                                            {c.email && (
                                                <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-primary-600 font-medium truncate">
                                                    <Mail size={12} className="text-primary-500 shrink-0" />
                                                    <span className="truncate">{c.email}</span>
                                                </a>
                                            )}
                                        </div>

                                        {c.notes && (
                                            <p className="text-[11px] text-slate-500 italic">
                                                "{c.notes}"
                                            </p>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* LIGHTBOX PHOTO MODAL */}
            {activeLightboxPhoto && (
                <div 
                    className="fixed inset-0 z-[150] bg-black/90 flex flex-col justify-between p-4 sm:p-6 animate-fade-in"
                    onClick={() => setActiveLightboxPhoto(null)}
                >
                    <div className="flex justify-between items-center text-white max-w-5xl mx-auto w-full z-10">
                        <div>
                            <h4 className="text-base font-black">{activeLightboxPhoto.title}</h4>
                            {activeLightboxPhoto.subtitle && (
                                <p className="text-xs text-slate-300">{activeLightboxPhoto.subtitle}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={activeLightboxPhoto.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors"
                                title="Open in new tab"
                            >
                                <ExternalLink size={16} />
                            </a>
                            <button
                                type="button"
                                onClick={() => setActiveLightboxPhoto(null)}
                                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div 
                        className="flex-1 flex items-center justify-center p-2 max-w-5xl mx-auto w-full max-h-[75vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={activeLightboxPhoto.url}
                            alt={activeLightboxPhoto.title}
                            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                        />
                    </div>

                    <div className="text-center text-xs text-slate-400 max-w-md mx-auto">
                        <span>Click anywhere outside to close this preview.</span>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default LocationDetailModal;
