import React, { useState, useMemo, useEffect } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import { 
    Wrench, Building, AlertTriangle, FileText, DollarSign, 
    Clock, Calendar, UserCheck, ShieldCheck, Zap, Snowflake, 
    Flame, Plus, CheckCircle2, ChevronRight, Lock, Key, 
    Tag, Sparkles, Phone, Mail, User, Shield, Info, ArrowRight,
    MapPin, Check
} from 'lucide-react';
import type { Customer, ServiceLocation, EquipmentAsset, CustomerContact, Job, Organization } from 'types';
import { formatFullAddress } from 'lib/utils';

export interface CreateWorkOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer;
    locations?: ServiceLocation[];
    assets?: EquipmentAsset[];
    organization?: Organization | null;
    initialLocationId?: string | null;
    initialUnitId?: string | null;
    initialVisitType?: string | null;
    initialReason?: string | null;
    onSubmitWorkOrder: (workOrderPayload: {
        job: Partial<Job>;
        appointmentPayload: any;
    }) => Promise<void> | void;
}

const VISIT_TYPES = [
    {
        id: 'Diagnostic & Troubleshooting',
        label: '🔍 Diagnostic & Troubleshooting',
        desc: 'Technician dispatches to test, trace error codes, inspect unit, and diagnose root cause.'
    },
    {
        id: 'Emergency Repair (No Heat / No AC / Leak)',
        label: '🚨 Emergency Repair (No Heat / No Cool / Active Leak)',
        desc: 'Urgent immediate response for downtime, water damage risk, or severe temperature extremes.'
    },
    {
        id: 'Request for Proposal (RFP) / Capital Quote',
        label: '📋 Request for Proposal / Capital Equipment Quote',
        desc: 'Sales engineer visit for equipment sizing, system replacement options, and formal bid.'
    },
    {
        id: 'Scheduled Component Repair',
        label: '🛠️ Scheduled Component Repair & Part Replacement',
        desc: 'Perform authorized mechanical repair, motor/compressor replacement, or valve overhaul.'
    },
    {
        id: 'Seasonal Maintenance & Comprehensive Tune-Up',
        label: '❄️ Seasonal Maintenance & Comprehensive Tune-Up',
        desc: '28-point commercial coil cleaning, electrical amp test, belt check, and filter renewal.'
    },
    {
        id: 'System Installation & Retrofit',
        label: '🏗️ System Installation & Retrofit Project',
        desc: 'Turnkey equipment installation, roof curb adapter set, duct transition, or crane set.'
    },
    {
        id: 'Warranty Recall & Follow-Up Service',
        label: '🛡️ Warranty Follow-Up / Warranty Service Call',
        desc: 'Service under existing labor/parts warranty coverage or post-service follow-up check.'
    },
    {
        id: 'Safety & Code Compliance Inspection',
        label: '📑 Safety, Gas Pressure & Code Compliance Audit',
        desc: 'Comprehensive safety sign-off, gas leak verification, flue draft test, and compliance audit.'
    }
];

const COMMON_SYMPTOM_TAGS = [
    'No Cooling / High Temp',
    'No Heat / Cold Supply',
    'Active Water Leak / Drain Pan Overflow',
    'Strange Noise / Screeching Belt',
    'Thermostat Blank / No Power',
    'Tripping Circuit Breaker',
    'Low Airflow / Frozen Coil',
    'Smell of Burning / Odor',
    'Need Replacement Estimate',
    'Routine Filter & Coil Service'
];

const NTE_PRESETS = [
    { label: 'Diagnostic Fee Only ($129)', value: 129, desc: 'Authorize dispatch fee only; quote required for repairs' },
    { label: '$500 NTE Limit', value: 500, desc: 'Pre-authorized for minor part replacements & drain clearing' },
    { label: '$1,000 NTE Limit', value: 1000, desc: 'Standard commercial repair authorization limit' },
    { label: '$2,500 NTE Limit', value: 2500, desc: 'High-NTE authorization for major motors & multi-unit calls' },
    { label: '$5,000 NTE Limit', value: 5000, desc: 'Commercial capital threshold for critical emergency restoration' },
    { label: 'No NTE / Free Proposal ($0)', value: 0, desc: 'For sales estimates, warranty recalls, or formal bids' },
    { label: 'Custom Dollar Amount', value: -1, desc: 'Specify exact purchase order NTE limit' }
];

export const CreateWorkOrderModal: React.FC<CreateWorkOrderModalProps> = ({
    isOpen,
    onClose,
    customer,
    locations = [],
    assets = [],
    organization,
    initialLocationId,
    initialUnitId,
    initialVisitType,
    initialReason,
    onSubmitWorkOrder
}) => {
    // Synthesize all locations including Main HQ
    const allLocations = useMemo<ServiceLocation[]>(() => {
        const primaryLocation: ServiceLocation = {
            id: 'default',
            name: customer.customerType === 'Commercial' ? 'Main Corporate Headquarters' : 'Primary Residence',
            propertyName: customer.customerType === 'Commercial' ? 'Main Corporate Headquarters' : 'Primary Residence',
            address: typeof customer.address === 'string' ? customer.address : (formatFullAddress(customer.address) || 'Primary Address on file'),
            locationType: customer.customerType === 'Commercial' ? 'Commercial' : 'Residential',
        };
        const existing = (locations || []).filter(l => l.id !== 'default');
        return [primaryLocation, ...existing];
    }, [customer, locations]);

    // Active form states
    const [locationId, setLocationId] = useState<string>(initialLocationId || 'default');
    const [selectedUnitId, setSelectedUnitId] = useState<string>(initialUnitId || '');
    const [visitType, setVisitType] = useState<string>(initialVisitType || 'Diagnostic & Troubleshooting');
    const [priority, setPriority] = useState<'Routine' | 'Standard' | 'High' | 'Critical Emergency'>('Standard');
    const [reason, setReason] = useState<string>(initialReason || '');
    
    // Financials
    const [poNumber, setPoNumber] = useState<string>('');
    const [nteSelection, setNteSelection] = useState<number>(1000);
    const [customNte, setCustomNte] = useState<string>('1500');
    const [paymentTerms, setPaymentTerms] = useState<string>('Net 30 Terms on File');

    // Contacts
    const existingContacts = useMemo<CustomerContact[]>(() => {
        return (customer.contacts || []) as unknown as CustomerContact[];
    }, [customer.contacts]);

    const [selectedContactMode, setSelectedContactMode] = useState<string>('preset');
    const [selectedPresetContactId, setSelectedPresetContactId] = useState<string>(existingContacts[0]?.id || 'custom');
    const [contactName, setContactName] = useState<string>(existingContacts[0]?.name || customer.name || '');
    const [contactTitle, setContactTitle] = useState<string>(existingContacts[0]?.title || 'On-Site Facility Lead');
    const [contactPhone, setContactPhone] = useState<string>(existingContacts[0]?.phone || customer.phone || '');
    const [contactExtension, setContactExtension] = useState<string>(existingContacts[0]?.extension || '');
    const [contactEmail, setContactEmail] = useState<string>(existingContacts[0]?.email || customer.email || '');

    // Logistics & Instructions
    const [gateCode, setGateCode] = useState<string>('');
    const [roofAccessNotes, setRoofAccessNotes] = useState<string>('');
    const [specialInstructions, setSpecialInstructions] = useState<string>('');

    // Scheduling
    const [preferredDate, setPreferredDate] = useState<string>(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [timeWindow, setTimeWindow] = useState<string>('Morning (8:00 AM - 12:00 PM)');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Sync initial changes if modal is reopened with new props
    useEffect(() => {
        if (isOpen) {
            if (initialLocationId) setLocationId(initialLocationId);
            if (initialUnitId) setSelectedUnitId(initialUnitId);
            if (initialVisitType) setVisitType(initialVisitType);
            if (initialReason) setReason(initialReason);
        }
    }, [isOpen, initialLocationId, initialUnitId, initialVisitType, initialReason]);

    // Filter available assets based on selected location
    const availableAssets = useMemo(() => {
        if (!assets || assets.length === 0) return [];
        if (!locationId || locationId === 'all') return assets;
        if (locationId === 'default') {
            return assets.filter(a => !a.locationId || a.locationId === 'default' || (a as any).propertyId === 'default');
        }
        return assets.filter(a => a.locationId === locationId || (a as any).propertyId === locationId);
    }, [assets, locationId]);

    // Active selected location object
    const activeLocation = useMemo(() => {
        return allLocations.find(l => l.id === locationId) || allLocations[0];
    }, [allLocations, locationId]);

    // Handle Contact Selection Change
    const handlePresetContactChange = (contactId: string) => {
        setSelectedPresetContactId(contactId);
        if (contactId === 'custom') {
            setSelectedContactMode('custom');
            setContactName('');
            setContactTitle('On-Site Lead');
            setContactPhone('');
            setContactExtension('');
            setContactEmail('');
        } else {
            const found = existingContacts.find(c => c.id === contactId);
            if (found) {
                setSelectedContactMode('preset');
                setContactName(found.name);
                setContactTitle(found.title || (found.isAccountManager ? 'Account Manager' : 'On-Site POC'));
                setContactPhone(found.phone);
                setContactExtension(found.extension || '');
                setContactEmail(found.email);
            }
        }
    };

    // Add Symptom Tag to Reason
    const handleAddSymptomTag = (tag: string) => {
        if (!reason) {
            setReason(tag);
        } else if (!reason.includes(tag)) {
            setReason(prev => `${prev.trim()}\n• ${tag}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            alert('Please provide a brief reason or problem description for the work order.');
            return;
        }

        setIsSubmitting(true);
        try {
            const finalNte = nteSelection === -1 ? (parseFloat(customNte) || 0) : nteSelection;
            const targetAddress = typeof activeLocation?.address === 'string' 
                ? activeLocation.address 
                : formatFullAddress(activeLocation?.address) || formatFullAddress(customer.address) || 'Site Address on file';
            const locationName = activeLocation?.propertyName || activeLocation?.name || 'Main Property';

            const apptDate = preferredDate ? new Date(preferredDate + 'T09:00:00') : new Date();
            const generatedWorkOrderNumber = `WO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
            const jobId = `job-wo-${Date.now()}`;

            const selectedAsset = assets.find(a => a.id === selectedUnitId);

            const combinedInstructions = [
                specialInstructions ? `Special Instructions: ${specialInstructions}` : '',
                gateCode ? `Gate / Lockbox Code: ${gateCode}` : '',
                roofAccessNotes ? `Roof / Ladder Access: ${roofAccessNotes}` : '',
                poNumber ? `Client PO Number: ${poNumber}` : '',
                `Authorized NTE: $${finalNte.toLocaleString()}`
            ].filter(Boolean).join(' | ');

            const jobPayload: Partial<Job> = {
                id: jobId,
                workOrderNumber: generatedWorkOrderNumber,
                poNumber: poNumber || null,
                nteLimit: finalNte,
                tasks: [
                    visitType,
                    ...(selectedAsset ? [`Target Unit: ${selectedAsset.brand} ${selectedAsset.model} (${selectedAsset.type || 'HVAC'})`] : []),
                    reason
                ],
                visitType: visitType as any,
                serviceType: visitType,
                customerId: customer.id,
                customerName: customer.name,
                customerPhone: customer.phone,
                customerEmail: customer.email,
                address: targetAddress,
                locationId: locationId || null,
                locationName: locationName,
                includedUnitIds: selectedUnitId ? [selectedUnitId] : [],
                specialInstructions: combinedInstructions,
                notes: {
                    diagnosis: reason,
                    internalNotes: combinedInstructions
                },
                pocContact: {
                    name: contactName,
                    title: contactTitle,
                    phone: contactPhone,
                    extension: contactExtension,
                    email: contactEmail,
                    role: 'On-Site Point of Contact'
                },
                appointmentTime: apptDate.toISOString(),
                jobStatus: 'Scheduled',
                source: 'CustomerPortal',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const appointmentPayload = {
                organizationId: organization?.id || customer.organizationId,
                customerId: customer.id,
                customerName: customer.name,
                customerPhone: customer.phone,
                customerEmail: customer.email,
                address: targetAddress,
                locationId: locationId || null,
                locationName,
                tasks: [visitType, reason],
                timeWindow,
                notes: `${reason}\n\n[Logistics]: ${combinedInstructions}\n[POC]: ${contactName} (${contactPhone})`,
                appointmentTime: apptDate.toISOString(),
                status: 'Pending',
                source: 'CustomerPortal',
                createdAt: new Date().toISOString()
            };

            await onSubmitWorkOrder({
                job: jobPayload,
                appointmentPayload
            });

            onClose();
        } catch (err: any) {
            console.error('Work order submission failed:', err);
            alert('Failed to submit work order: ' + (err.message || String(err)));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Work Order & Service Request" size="xl">
            <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
                
                {/* Top Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 p-5 rounded-3xl text-white border border-primary-500/30 shadow-lg relative overflow-hidden">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 bg-primary-500/20 text-primary-300 rounded-2xl border border-primary-400/30 shrink-0">
                            <Wrench size={26} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-primary-400 block">
                                Commercial Field Dispatch & Work Order Creation
                            </span>
                            <h3 className="font-black text-lg text-white">
                                {(customer as any).companyName || customer.name}
                            </h3>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Set target facility, specify visit scope, pre-authorize NTE spending limits, and assign on-site point of contact.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 1: Facility Location & Target Equipment Asset */}
                <Card className="p-5 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Building className="text-primary-600" size={18} />
                            <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                                1. Facility Location & Target Equipment
                            </h4>
                        </div>
                        <span className="text-[10px] font-bold bg-primary-50 dark:bg-primary-950 text-primary-600 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800">
                            Required
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <MapPin size={13} className="text-primary-500" /> Service Facility / Property *
                            </label>
                            <select
                                value={locationId}
                                onChange={e => setLocationId(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                {allLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.propertyName || loc.name} ({typeof loc.address === 'string' ? loc.address.split(',')[0] : 'Main Site'})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-500 mt-1 truncate">
                                📍 {typeof activeLocation?.address === 'string' ? activeLocation.address : 'Address on file'}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <Snowflake size={13} className="text-teal-500" /> Target Equipment / Unit
                            </label>
                            <select
                                value={selectedUnitId}
                                onChange={e => setSelectedUnitId(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                <option value="">Entire Facility / Multiple Units / General Call</option>
                                {availableAssets.map(asset => (
                                    <option key={asset.id} value={asset.id}>
                                        {asset.brand} {asset.model} ({asset.type || 'Unit'}) - S/N: {asset.serial || 'N/A'} {asset.exactPlacement ? `[${asset.exactPlacement}]` : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-500 mt-1">
                                {selectedUnitId ? '✓ Linked to specific registered equipment asset' : 'Optional: Link directly to equipment for serial tracking'}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Section 2: Visit Type & Priority Urgency */}
                <Card className="p-5 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Zap className="text-amber-500" size={18} />
                            <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                                2. Visit Type & Priority Level
                            </h4>
                        </div>
                        <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                            Required
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Visit Intent / Service Type *
                            </label>
                            <select
                                value={visitType}
                                onChange={e => setVisitType(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                {VISIT_TYPES.map(vt => (
                                    <option key={vt.id} value={vt.id}>
                                        {vt.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-500 mt-1">
                                {VISIT_TYPES.find(v => v.id === visitType)?.desc}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Urgency / Priority Level *
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'Routine', label: '🟢 Routine (3-5 Days)', color: 'border-slate-200 text-slate-700' },
                                    { id: 'Standard', label: '🔵 Standard (24-48h)', color: 'border-blue-300 text-blue-700' },
                                    { id: 'High', label: '🟠 High (Same-Day)', color: 'border-orange-300 text-orange-700' },
                                    { id: 'Critical Emergency', label: '🔴 2-4 Hr Emergency', color: 'border-rose-400 text-rose-700' },
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setPriority(p.id as any)}
                                        className={`p-2 rounded-xl text-xs font-black border transition-all text-left flex items-center justify-between cursor-pointer ${
                                            priority === p.id 
                                                ? 'bg-primary-600 text-white border-primary-600 shadow-sm ring-2 ring-primary-500/20' 
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                        }`}
                                    >
                                        <span className="truncate">{p.label}</span>
                                        {priority === p.id && <Check size={12} strokeWidth={3} className="shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Section 3: Reason for Work Order & Symptoms */}
                <Card className="p-5 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <FileText className="text-emerald-600" size={18} />
                            <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                                3. Reason for Work Order & Symptom Description
                            </h4>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            Required
                        </span>
                    </div>

                    {/* Quick Symptom Tags */}
                    <div>
                        <span className="text-[11px] font-bold text-slate-500 block mb-1.5">
                            ⚡ Click common symptoms to auto-append to work order:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {COMMON_SYMPTOM_TAGS.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => handleAddSymptomTag(tag)}
                                    className="text-[11px] font-bold bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                >
                                    + {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Detailed Issue, Error Codes & Scope of Work *
                        </label>
                        <textarea
                            rows={3}
                            required
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Describe in detail: what symptoms are occurring, rooms or zones affected, tenant reports, or specific tasks requested for our technician..."
                            className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        />
                    </div>
                </Card>

                {/* Section 4: Financial Controls, NTE & PO Number */}
                <Card className="p-5 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <DollarSign className="text-emerald-500" size={18} />
                            <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                                4. Financial Controls, PO Number & NTE Limit
                            </h4>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            Commercial Controls
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <Tag size={13} className="text-primary-500" /> Customer Internal PO / Tracking Number
                            </label>
                            <input
                                type="text"
                                value={poNumber}
                                onChange={e => setPoNumber(e.target.value)}
                                placeholder="e.g. PO-88492 or PRJ-2026-X"
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Will be printed on work order reports and final billing invoices.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <DollarSign size={13} className="text-emerald-500" /> Pre-Authorized NTE (Not-To-Exceed) Limit *
                            </label>
                            <select
                                value={nteSelection}
                                onChange={e => setNteSelection(Number(e.target.value))}
                                className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                {NTE_PRESETS.map(preset => (
                                    <option key={preset.value} value={preset.value}>
                                        {preset.label}
                                    </option>
                                ))}
                            </select>
                            
                            {nteSelection === -1 && (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="50"
                                        value={customNte}
                                        onChange={e => setCustomNte(e.target.value)}
                                        placeholder="Enter custom NTE limit"
                                        className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                            )}
                            <p className="text-[11px] text-slate-500 mt-1">
                                {NTE_PRESETS.find(p => p.value === nteSelection)?.desc}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Section 5: On-Site Point of Contact Delegation */}
                <Card className="p-5 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <UserCheck className="text-primary-600" size={18} />
                            <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                                5. On-Site Point of Contact (POC) for Field Technician
                            </h4>
                        </div>
                        <span className="text-[10px] font-bold bg-primary-50 dark:bg-primary-950 text-primary-600 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800">
                            Required
                        </span>
                    </div>

                    {existingContacts.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Select from Designated Company POCs & Account Managers
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {existingContacts.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => handlePresetContactChange(c.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                            selectedPresetContactId === c.id 
                                                ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 shadow-sm' 
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-black text-xs text-slate-900 dark:text-white truncate">{c.name}</p>
                                            {selectedPresetContactId === c.id && <Check size={13} className="text-primary-600" />}
                                        </div>
                                        <p className="text-[10px] text-slate-500 truncate">{c.title || 'Contact'}</p>
                                        <p className="text-[10px] text-primary-600 dark:text-primary-400 font-bold truncate mt-0.5">{c.phone}</p>
                                    </div>
                                ))}
                                <div
                                    onClick={() => handlePresetContactChange('custom')}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-center text-center ${
                                        selectedPresetContactId === 'custom'
                                            ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 shadow-sm'
                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                                >
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">+ Enter Different Contact</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Name *</label>
                            <input
                                type="text"
                                required
                                value={contactName}
                                onChange={e => setContactName(e.target.value)}
                                placeholder="Marcus Vance"
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Direct Phone *</label>
                            <input
                                type="tel"
                                required
                                value={contactPhone}
                                onChange={e => setContactPhone(e.target.value)}
                                placeholder="(512) 555-0199"
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ext. / Title</label>
                            <input
                                type="text"
                                value={contactExtension ? `Ext: ${contactExtension} (${contactTitle})` : contactTitle}
                                onChange={e => setContactTitle(e.target.value)}
                                placeholder="Ext 104 · Facility Director"
                                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                    </div>
                </Card>

                {/* Section 6: Site Logistics & Custom Access Instructions */}
                <Card className="p-5 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Lock className="text-indigo-600" size={18} />
                            <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                                6. Site Access, Gate Codes & Custom Instructions
                            </h4>
                        </div>
                        <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                            Logistics
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <Key size={13} className="text-amber-500" /> Gate / Lockbox / Keypad Code
                            </label>
                            <input
                                type="text"
                                value={gateCode}
                                onChange={e => setGateCode(e.target.value)}
                                placeholder="e.g. Gate #4920, Lockbox code 5512 on east door"
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                <ShieldCheck size={13} className="text-emerald-500" /> Roof & Ladder Access Instructions
                            </label>
                            <input
                                type="text"
                                value={roofAccessNotes}
                                onChange={e => setRoofAccessNotes(e.target.value)}
                                placeholder="e.g. Interior roof hatch located in utility closet B-12"
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Tenant Check-in, Safety & Parking Instructions
                        </label>
                        <textarea
                            rows={2}
                            value={specialInstructions}
                            onChange={e => setSpecialInstructions(e.target.value)}
                            placeholder="e.g. Check in with property management at Suite 100 before cutting power. Service vehicle parking available at loading dock 2."
                            className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        />
                    </div>
                </Card>

                {/* Section 7: Preferred Scheduling & Time Window */}
                <Card className="p-5 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="text-primary-600" size={18} />
                            <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                                7. Preferred Service Schedule & Time Window
                            </h4>
                        </div>
                        <span className="text-[10px] font-bold bg-primary-50 dark:bg-primary-950 text-primary-600 px-2 py-0.5 rounded-full border border-primary-200 dark:border-primary-800">
                            Scheduling
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Preferred Date *
                            </label>
                            <input
                                type="date"
                                required
                                value={preferredDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setPreferredDate(e.target.value)}
                                className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Preferred Arrival Window *
                            </label>
                            <select
                                value={timeWindow}
                                onChange={e => setTimeWindow(e.target.value)}
                                className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                <option value="Morning (8:00 AM - 12:00 PM)">Morning (8:00 AM - 12:00 PM)</option>
                                <option value="Afternoon (12:00 PM - 4:00 PM)">Afternoon (12:00 PM - 4:00 PM)</option>
                                <option value="Evening (4:00 PM - 7:00 PM)">Evening (4:00 PM - 7:00 PM)</option>
                                <option value="After-Hours / Night Shift (7:00 PM - 6:00 AM)">After-Hours / Night Shift (7:00 PM - 6:00 AM)</option>
                                <option value="First Available Tech (Emergency Response)">🚨 First Available Tech (Emergency Response)</option>
                            </select>
                        </div>
                    </div>
                </Card>

                {/* Submit Actions */}
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 py-3 z-10">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        className="font-bold text-xs py-3 px-5"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-primary-600 hover:bg-primary-700 text-white font-black text-xs sm:text-sm px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 cursor-pointer"
                    >
                        {isSubmitting ? 'Dispatching...' : 'Submit & Dispatch Work Order'}
                        <ArrowRight size={16} />
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default CreateWorkOrderModal;
