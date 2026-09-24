import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useAppContext } from '../../context/AppContext';
import type { Customer, ServiceLocation, Job, ReplacedPartRecord } from '../../types';
import { 
    MapPin, Building2, Calendar, FileText, Wrench, ShieldCheck, 
    ExternalLink, Camera, Tag, ArrowRight, User, UserCheck, CheckCircle2, 
    Clock, DollarSign, Image as ImageIcon, Download, Search, Filter,
    Package, Plus, Sparkles, AlertCircle, Phone, Mail
} from 'lucide-react';
import DocumentPreview from '../ui/DocumentPreview';
import JobDetailModal from './JobDetailModal';
import { getJobServicedEquipment } from '../../lib/pdfHelper';
import { db } from '../../lib/firebase';
import { cleanUndefinedFields } from '../../lib/utils';
import showToast from '../../lib/toast';

interface LocationAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    location?: ServiceLocation | any;
    customerId?: string;
    locationId?: string;
    onSelectJob?: (job: Job) => void;
}

const COMMON_HVAC_PARTS = [
    'Capacitor (Dual Run)',
    'Contactor (Single/Double Pole)',
    'Condenser Fan Motor',
    'Blower Motor (ECM / PSC)',
    'Scroll Compressor',
    'TXV (Thermostatic Expansion Valve)',
    'Liquid Line Filter Drier',
    'Defrost Control Board',
    'Integrated Control Board (IFC)',
    'Evaporator Coil',
    'Condenser Coil',
    'Transformer (24V)',
    'Refrigerant R-410A (Lbs)',
    'Refrigerant R-404A (Lbs)',
    'Refrigerant R-22 (Lbs)',
    'Hard Start Kit',
    'Thermostat'
];

const LocationAuditModal: React.FC<LocationAuditModalProps> = ({
    isOpen,
    onClose,
    location: initialLocation,
    customerId,
    locationId,
    onSelectJob
}) => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'jobs' | 'documents' | 'photos' | 'equipment' | 'parts'>('jobs');
    const [searchFilter, setSearchFilter] = useState('');
    const [previewDoc, setPreviewDoc] = useState<{ type: 'Proposal' | 'Invoice' | 'Other'; data: any } | null>(null);
    const [viewingDetailJob, setViewingDetailJob] = useState<Job | null>(null);

    // Logging Replaced Part Modal State
    const [isLogPartModalOpen, setIsLogPartModalOpen] = useState(false);
    const [loggingTargetEquipment, setLoggingTargetEquipment] = useState<any | null>(null);
    const [isSubmittingPart, setIsSubmittingPart] = useState(false);
    const [newPartData, setNewPartData] = useState({
        name: '',
        partNumber: '',
        quantity: 1,
        unitPrice: 0,
        replacedAt: new Date().toISOString().split('T')[0],
        jobId: '',
        technicianName: '',
        warrantyDurationMonths: 12,
        notes: '',
        equipmentId: ''
    });

    // Resolve customer and target location
    const targetCustomer = useMemo(() => {
        const cId = customerId || initialLocation?.customerId || initialLocation?.orgId;
        if (cId) {
            return state.customers.find(c => c.id === cId) || null;
        }
        if (initialLocation) {
            return state.customers.find(c => (c.serviceLocations || []).some(l => l.id === initialLocation.id)) || null;
        }
        if (locationId && state.serviceLocations) {
            const loc = state.serviceLocations.find(l => l.id === locationId) as any;
            if (loc?.customerId) {
                return state.customers.find(c => c.id === loc.customerId) || null;
            }
        }
        return null;
    }, [customerId, initialLocation, locationId, state.customers, state.serviceLocations]);

    const targetLocation = useMemo(() => {
        if (initialLocation) return initialLocation;
        const locId = locationId || 'default';
        if (targetCustomer && targetCustomer.serviceLocations) {
            const found = targetCustomer.serviceLocations.find(l => l.id === locId);
            if (found) return found;
        }
        if (locId && state.serviceLocations) {
            const foundInState = state.serviceLocations.find(l => l.id === locId);
            if (foundInState) return foundInState;
        }
        if (targetCustomer && (locId === 'default' || locId === 'main')) {
            return {
                id: 'default',
                propertyName: `${targetCustomer.name} (Main Site)`,
                name: `${targetCustomer.name} (Main Site)`,
                address: targetCustomer.address,
                city: targetCustomer.city || '',
                state: targetCustomer.state || '',
                zip: targetCustomer.zip || ''
            };
        }
        return null;
    }, [initialLocation, locationId, targetCustomer, state.serviceLocations]);

    const effectiveLocId = targetLocation?.id || locationId || 'default';

    // All jobs at this specific location
    const locationJobs = useMemo(() => {
        const custId = targetCustomer?.id;
        const locAddress = targetLocation?.address?.toLowerCase().trim();

        return (state.jobs || []).filter(j => {
            if (j.deleted) return false;

            // Filter by Customer if known
            if (custId && j.customerId !== custId) return false;

            // Match by exact locationId
            if (j.locationId && j.locationId === effectiveLocId) return true;

            // Default location matching
            if ((effectiveLocId === 'default' || effectiveLocId === 'main') && (!j.locationId || j.locationId === 'default')) {
                return true;
            }

            // Fallback match by address string comparison
            if (locAddress && j.address) {
                const jAddr = typeof j.address === 'string' ? j.address.toLowerCase().trim() : '';
                if (jAddr && (jAddr.includes(locAddress) || locAddress.includes(jAddr))) {
                    return true;
                }
            }

            return false;
        }).sort((a, b) => new Date(b.appointmentTime || b.createdAt || 0).getTime() - new Date(a.appointmentTime || a.createdAt || 0).getTime());
    }, [state.jobs, targetCustomer, targetLocation, effectiveLocId]);

    // Resolve Point of Contact (POC) strictly assigned to this specific location.
    // If no POC is assigned to this location, returns null (left completely blank).
    // Corporate primary POCs and unassigned account managers are strictly excluded.
    const assignedLocationPoc = useMemo(() => {
        if (!targetLocation && (effectiveLocId === 'default' || effectiveLocId === 'main')) return null;

        const matchesThisLoc = (id?: string | null) => {
            if (!id) return false;
            return (
                id === effectiveLocId || 
                (targetLocation?.id && id === targetLocation.id) ||
                (targetLocation?.storeNumber && id.toLowerCase().trim() === targetLocation.storeNumber.toLowerCase().trim()) ||
                (targetLocation?.locationNumber && id.toLowerCase().trim() === targetLocation.locationNumber.toLowerCase().trim())
            );
        };

        // 1. Direct on-site contact in targetLocation.contacts
        if (targetLocation?.contacts && Array.isArray(targetLocation.contacts) && targetLocation.contacts.length > 0) {
            const direct = targetLocation.contacts.find((c: any) => c && c.name && c.name.trim() !== '');
            if (direct) {
                return {
                    name: direct.name.trim(),
                    role: direct.role || 'Site Contact',
                    phone: direct.phone || '',
                    email: direct.email || ''
                };
            }
        }

        // 2. Direct single contact fields on targetLocation (if stored as flat properties)
        if ((targetLocation as any)?.contactName && (targetLocation as any).contactName.trim() !== '') {
            return {
                name: (targetLocation as any).contactName.trim(),
                role: (targetLocation as any).contactRole || 'Site Contact',
                phone: (targetLocation as any).contactPhone || (targetLocation as any).phone || '',
                email: (targetLocation as any).contactEmail || (targetLocation as any).email || ''
            };
        }

        // 3. Customer contacts explicitly assigned or allowed for this location ID/storeNumber
        if (targetCustomer?.contacts && Array.isArray(targetCustomer.contacts)) {
            const assignedCustContact = targetCustomer.contacts.find((c: any) => {
                if (!c || !c.name || c.name.trim() === '') return false;
                const locIds = [...(c.assignedLocationIds || []), ...(c.allowedLocationIds || [])];
                return locIds.some(id => matchesThisLoc(id));
            });

            if (assignedCustContact) {
                return {
                    name: assignedCustContact.name.trim(),
                    role: assignedCustContact.title || (assignedCustContact as any).role || (assignedCustContact.isAccountManager ? 'Account Manager' : 'Location POC'),
                    phone: assignedCustContact.phone || '',
                    extension: assignedCustContact.extension || '',
                    email: assignedCustContact.email || ''
                };
            }
        }

        // 4. Job-level designated POC explicitly recorded for this location's work orders
        const jobWithPoc = locationJobs.find(j => j.pocContact && j.pocContact.name && j.pocContact.name.trim() !== '');
        if (jobWithPoc && jobWithPoc.pocContact) {
            return {
                name: jobWithPoc.pocContact.name.trim(),
                role: jobWithPoc.pocContact.title || jobWithPoc.pocContact.role || 'Site POC',
                phone: jobWithPoc.pocContact.phone || '',
                extension: jobWithPoc.pocContact.extension || '',
                email: jobWithPoc.pocContact.email || ''
            };
        }

        // Strictly do NOT fall back to corporate primary contacts or general account managers.
        // If there is no POC assigned to this location, return null (leave blank).
        return null;
    }, [targetLocation, effectiveLocId, targetCustomer, locationJobs]);

    // Filtered jobs by search query
    const filteredJobs = useMemo(() => {
        if (!searchFilter.trim()) return locationJobs;
        const q = searchFilter.toLowerCase();
        return locationJobs.filter(j => {
            const taskStr = (j.tasks || []).join(' ').toLowerCase();
            const techStr = (j.assignedTechnicianName || '').toLowerCase();
            const invId = (j.invoice?.id || '').toLowerCase();
            const notesStr = (j.specialInstructions || j.notes?.diagnosis || j.notes?.work || '').toLowerCase();
            const poStr = (j.poNumber || '').toLowerCase();
            return taskStr.includes(q) || techStr.includes(q) || invId.includes(q) || notesStr.includes(q) || poStr.includes(q) || j.id.toLowerCase().includes(q);
        });
    }, [locationJobs, searchFilter]);

    // All documents & attached files for this location
    const locationDocuments = useMemo(() => {
        const docs: { id: string; title: string; type: string; date: string; dataUrl?: string; raw: any; jobId?: string }[] = [];

        // Gather Proposals
        (state.proposals || []).forEach(p => {
            if (p.locationId === effectiveLocId || (targetCustomer && p.customerId === targetCustomer.id && (!p.locationId || p.locationId === 'default'))) {
                docs.push({
                    id: p.id,
                    title: `Proposal #${p.proposalNumber || p.id} - ${p.title || 'Service Proposal'} ($${(p.total || 0).toFixed(2)})`,
                    type: 'Proposal',
                    date: p.createdAt || (p as any).date || '',
                    raw: p
                });
            }
        });

        // Gather Invoices & Attached Job Files
        locationJobs.forEach(j => {
            if (j.invoice) {
                const total = j.invoice.totalAmount || j.invoice.amount || 0;
                docs.push({
                    id: j.invoice.id || `INV-${j.id.slice(-6)}`,
                    title: `Invoice #${j.invoice.id || j.id.slice(-6).toUpperCase()} - ${j.tasks?.[0] || 'Work Order'} ($${total.toFixed(2)})`,
                    type: 'Invoice',
                    date: j.invoice.invoiceDate || j.appointmentTime || j.createdAt || '',
                    raw: j,
                    jobId: j.id
                });
            }

            // Attached job files/PDFs
            if (j.files && j.files.length > 0) {
                j.files.forEach((f: any, idx: number) => {
                    docs.push({
                        id: f.id || `file-${j.id}-${idx}`,
                        title: f.metadata?.label || f.fileName || `Attachment (${j.tasks?.[0] || 'Job'})`,
                        type: f.fileName?.endsWith('.pdf') ? 'PDF Document' : 'Attached File',
                        date: f.createdAt || j.createdAt || '',
                        dataUrl: f.dataUrl || f.url,
                        raw: f,
                        jobId: j.id
                    });
                });
            }
        });

        return docs.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }, [state.proposals, locationJobs, effectiveLocId, targetCustomer]);

    // All photos taken on-site at this location (including workflow files, attachments, and equipment tag/plate photos)
    const locationPhotos = useMemo(() => {
        const photos: { id: string; url: string; label: string; date: string; tech: string; jobId: string }[] = [];

        locationJobs.forEach(j => {
            const techName = j.assignedTechnicianName || 'Technician';
            const dateStr = j.appointmentTime || j.createdAt || '';

            // Job workflow files
            ((j as any).workflowFiles || []).forEach((wf: any, idx: number) => {
                const url = wf.dataUrl || wf.url || wf.fileUrl;
                if (url && (url.startsWith('http') || url.startsWith('data:image'))) {
                    photos.push({
                        id: wf.id || `wf-${j.id}-${idx}`,
                        url,
                        label: wf.label || wf.fileName || 'On-Site Photo',
                        date: wf.createdAt || dateStr,
                        tech: techName,
                        jobId: j.id
                    });
                }
            });

            // Job attached image files
            (j.files || []).forEach((f: any, idx: number) => {
                const url = f.dataUrl || f.url;
                const isImg = f.fileType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.fileName || '');
                if (url && isImg && !photos.some(p => p.url === url)) {
                    photos.push({
                        id: f.id || `img-${j.id}-${idx}`,
                        url,
                        label: f.metadata?.label || f.fileName || 'Site Photo',
                        date: f.createdAt || dateStr,
                        tech: techName,
                        jobId: j.id
                    });
                }
            });

            // Equipment unit photos (Serial tag & Unit plate photos from job system profiles)
            const servicedUnits = getJobServicedEquipment(j);
            servicedUnits.forEach((unit: any, uIdx: number) => {
                const unitName = unit.name || unit.title || `Unit #${uIdx + 1}`;
                const photoCandidates = [
                    { url: unit.serialTagPhotoUrl || unit.serialTagPhoto || unit.serialTag, label: `${unitName} - Serial Tag` },
                    { url: unit.unitPlatePhotoUrl || unit.unitPlatePhoto || unit.unitPlate, label: `${unitName} - Unit Plate` },
                    ...(Array.isArray(unit.photos) ? unit.photos.map((p: any) => ({ url: typeof p === 'string' ? p : p.url, label: `${unitName} - Photo` })) : [])
                ];

                photoCandidates.forEach((cand, cIdx) => {
                    const u = cand.url;
                    if (u && typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:image')) && !photos.some(p => p.url === u)) {
                        photos.push({
                            id: `eq-photo-${j.id}-${uIdx}-${cIdx}`,
                            url: u,
                            label: cand.label,
                            date: dateStr,
                            tech: techName,
                            jobId: j.id
                        });
                    }
                });
            });
        });

        return photos;
    }, [locationJobs]);

    // All Equipment / Assets installed at this location (from master equipment pool, customer equipment, & job-level serviced equipment)
    const locationEquipment = useMemo(() => {
        const pool: any[] = [];
        const seenKeys = new Set<string>();

        // 1. From targetCustomer.equipment
        (targetCustomer?.equipment || []).forEach((eq: any) => {
            const matchesLoc = eq.propertyId === effectiveLocId || eq.locationId === effectiveLocId || 
                               (effectiveLocId === 'default' && (!eq.propertyId && !eq.locationId));
            if (matchesLoc) {
                const key = `${eq.name || ''}_${eq.model || eq.modelNumber || ''}_${eq.serial || eq.serialNumber || ''}`.toLowerCase();
                seenKeys.add(key);
                pool.push({
                    ...eq,
                    id: eq.id,
                    name: eq.name || `${eq.brand || ''} ${eq.model || 'Equipment Unit'}`.trim(),
                    brand: eq.brand || eq.make || 'HVAC',
                    modelNumber: eq.model || eq.modelNumber || '',
                    serialNumber: eq.serial || eq.serialNumber || '',
                    refrigerantType: eq.refrigerantType || eq.refrigerant || '',
                    replacedParts: Array.isArray(eq.replacedParts) ? eq.replacedParts : []
                });
            }
        });

        // 2. From global state.equipment
        (state.equipment || []).forEach((eq: any) => {
            const matchesLoc = eq.locationId === effectiveLocId || eq.propertyId === effectiveLocId || 
                               (targetCustomer && eq.customerId === targetCustomer.id && (!eq.locationId || eq.locationId === 'default'));
            if (matchesLoc) {
                const key = `${eq.name || ''}_${eq.modelNumber || eq.model || ''}_${eq.serialNumber || eq.serial || ''}`.toLowerCase();
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    pool.push({
                        ...eq,
                        id: eq.id,
                        name: eq.name || `${eq.brand || ''} ${eq.modelNumber || eq.model || 'Equipment Unit'}`.trim(),
                        brand: eq.brand || eq.make || 'HVAC',
                        modelNumber: eq.modelNumber || eq.model || '',
                        serialNumber: eq.serialNumber || eq.serial || '',
                        refrigerantType: eq.refrigerantType || eq.refrigerant || '',
                        replacedParts: Array.isArray(eq.replacedParts) ? eq.replacedParts : []
                    });
                }
            }
        });

        // 3. From Job-level serviced equipment
        locationJobs.forEach(j => {
            const jobEqList = getJobServicedEquipment(j);
            jobEqList.forEach(eq => {
                const key = `${eq.name || ''}_${eq.model || eq.modelNumber || ''}_${eq.serial || eq.serialNumber || ''}`.toLowerCase();
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    pool.push({
                        id: eq.id || `job-eq-${j.id}-${pool.length}`,
                        name: eq.name || 'Serviced Equipment Unit',
                        brand: eq.brand || eq.make || 'HVAC/Refrig',
                        modelNumber: eq.model || eq.modelNumber || '',
                        serialNumber: eq.serial || eq.serialNumber || '',
                        refrigerantType: eq.refrigerant || eq.refrigerantType || '',
                        locationId: effectiveLocId,
                        customerId: targetCustomer?.id,
                        replacedParts: []
                    });
                }
            });
        });

        return pool;
    }, [state.equipment, targetCustomer, effectiveLocId, locationJobs]);

    // Replaced parts aggregated across jobs, equipment records, and invoices
    const locationReplacedParts = useMemo(() => {
        const list: ReplacedPartRecord[] = [];
        const seenIds = new Set<string>();

        // 1. From locationJobs.partsUsed
        locationJobs.forEach(j => {
            const jobParts = Array.isArray(j.partsUsed) ? j.partsUsed : (j.partsUsed ? [j.partsUsed] : []);
            jobParts.forEach((p: any, pIdx: number) => {
                const pId = p.id || `job-part-${j.id}-${pIdx}`;
                if (!seenIds.has(pId)) {
                    seenIds.add(pId);
                    list.push({
                        id: pId,
                        name: p.name || p.desc || p.description || 'Replacement Part',
                        partNumber: p.partNumber || p.sku || '',
                        sku: p.sku || '',
                        quantity: Number(p.quantity || p.qty || 1),
                        unitPrice: Number(p.unitPrice || p.price || p.cost || 0),
                        replacedAt: p.replacedAt || p.installedAt || j.appointmentTime || j.createdAt || '',
                        jobId: j.id,
                        poNumber: j.poNumber || j.id.slice(-6),
                        technicianName: j.assignedTechnicianName || 'Technician',
                        warrantyDurationMonths: p.warrantyDurationMonths || p.warrantyMonths || 12,
                        notes: p.notes || p.reason || '',
                        equipmentId: p.equipmentId || '',
                        equipmentName: p.equipmentName || p.unitName || ''
                    });
                }
            });

            // Inspect invoice items for materials/parts replacements
            if (j.invoice && Array.isArray(j.invoice.items)) {
                j.invoice.items.forEach((item: any, iIdx: number) => {
                    const itemType = (item.type || '').toLowerCase();
                    const itemName = (item.name || '').toLowerCase();
                    const itemDesc = (item.description || '').toLowerCase();
                    const isMaterialOrPart = itemType.includes('material') || 
                                             itemType.includes('part') ||
                                             itemName.includes('replacement') ||
                                             itemName.includes('repair') ||
                                             itemDesc.includes('replacement') ||
                                             itemDesc.includes('compressor') ||
                                             itemDesc.includes('coil') ||
                                             itemDesc.includes('motor') ||
                                             itemDesc.includes('capacitor') ||
                                             itemDesc.includes('contactor');
                    if (isMaterialOrPart) {
                        const invPartId = `inv-item-${j.id}-${iIdx}`;
                        if (!seenIds.has(invPartId)) {
                            seenIds.add(invPartId);
                            list.push({
                                id: invPartId,
                                name: item.name || 'Materials / Equipment Replacement',
                                partNumber: item.sku || '',
                                sku: item.sku || '',
                                quantity: Number(item.quantity || 1),
                                unitPrice: Number(item.unitPrice || item.price || 0),
                                replacedAt: j.invoice?.invoiceDate || j.appointmentTime || j.createdAt || '',
                                jobId: j.id,
                                poNumber: j.poNumber || j.id.slice(-6),
                                technicianName: j.assignedTechnicianName || 'Service Team',
                                warrantyDurationMonths: item.warrantyDurationMonths || 12,
                                notes: item.description || '',
                                equipmentId: item.equipmentId || '',
                                equipmentName: item.equipmentName || ''
                            });
                        }
                    }
                });
            }
        });

        // 2. From Equipment records directly (eq.replacedParts)
        locationEquipment.forEach((eq: any) => {
            const eqParts = Array.isArray(eq.replacedParts) ? eq.replacedParts : [];
            eqParts.forEach((p: any, pIdx: number) => {
                const eqPId = p.id || `eq-part-${eq.id}-${pIdx}`;
                if (!seenIds.has(eqPId)) {
                    seenIds.add(eqPId);
                    list.push({
                        id: eqPId,
                        name: p.name || 'Replaced Part',
                        partNumber: p.partNumber || p.sku || '',
                        sku: p.sku || '',
                        quantity: Number(p.quantity || 1),
                        unitPrice: Number(p.unitPrice || p.cost || 0),
                        replacedAt: p.replacedAt || p.installedAt || '',
                        jobId: p.jobId || '',
                        poNumber: p.poNumber || '',
                        technicianName: p.technicianName || 'Technician',
                        warrantyDurationMonths: p.warrantyDurationMonths || 12,
                        notes: p.notes || '',
                        equipmentId: eq.id,
                        equipmentName: eq.name || eq.brand || 'Installed Unit'
                    });
                }
            });
        });

        return list.sort((a, b) => new Date(b.replacedAt || 0).getTime() - new Date(a.replacedAt || 0).getTime());
    }, [locationJobs, locationEquipment]);

    const filteredReplacedParts = useMemo(() => {
        if (!searchFilter.trim()) return locationReplacedParts;
        const q = searchFilter.toLowerCase();
        return locationReplacedParts.filter(p => {
            return (p.name || '').toLowerCase().includes(q) ||
                   (p.partNumber || '').toLowerCase().includes(q) ||
                   (p.sku || '').toLowerCase().includes(q) ||
                   (p.equipmentName || '').toLowerCase().includes(q) ||
                   (p.technicianName || '').toLowerCase().includes(q) ||
                   (p.poNumber || '').toLowerCase().includes(q) ||
                   (p.notes || '').toLowerCase().includes(q);
        });
    }, [locationReplacedParts, searchFilter]);

    const openLogPartModal = (targetEq?: any) => {
        setLoggingTargetEquipment(targetEq || null);
        setNewPartData({
            name: '',
            partNumber: '',
            quantity: 1,
            unitPrice: 0,
            replacedAt: new Date().toISOString().split('T')[0],
            jobId: locationJobs[0]?.id || '',
            technicianName: state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : 'Technician',
            warrantyDurationMonths: 12,
            notes: '',
            equipmentId: targetEq?.id || locationEquipment[0]?.id || ''
        });
        setIsLogPartModalOpen(true);
    };

    const handleSaveReplacedPart = async () => {
        if (!newPartData.name.trim()) {
            showToast.warn("Please enter a part or component name.");
            return;
        }
        setIsSubmittingPart(true);
        try {
            const selectedEq = locationEquipment.find(e => e.id === (newPartData.equipmentId || loggingTargetEquipment?.id));
            const partRecord: ReplacedPartRecord = {
                id: `part-${Date.now()}`,
                name: newPartData.name.trim(),
                partNumber: newPartData.partNumber.trim(),
                sku: newPartData.partNumber.trim(),
                quantity: Number(newPartData.quantity || 1),
                unitPrice: Number(newPartData.unitPrice || 0),
                replacedAt: newPartData.replacedAt || new Date().toISOString().split('T')[0],
                jobId: newPartData.jobId || undefined,
                poNumber: locationJobs.find(j => j.id === newPartData.jobId)?.poNumber || undefined,
                technicianName: newPartData.technicianName.trim() || 'Technician',
                warrantyDurationMonths: Number(newPartData.warrantyDurationMonths || 12),
                notes: newPartData.notes.trim(),
                equipmentId: selectedEq?.id || loggingTargetEquipment?.id || undefined,
                equipmentName: selectedEq?.name || loggingTargetEquipment?.name || undefined
            };

            // 1. If assigned to an equipment, persist to customer.equipment in Firestore
            if (targetCustomer && targetCustomer.id) {
                const currentCust = state.customers.find(c => c.id === targetCustomer.id) || targetCustomer;
                const existingEqList = [...(currentCust.equipment || [])];
                const eqIdx = existingEqList.findIndex((e: any) => e.id === partRecord.equipmentId);

                let updatedEquipment: any[];
                if (eqIdx >= 0) {
                    updatedEquipment = existingEqList.map((eq, i) => {
                        if (i === eqIdx) {
                            return {
                                ...eq,
                                replacedParts: [...(eq.replacedParts || []), partRecord]
                            };
                        }
                        return eq;
                    });
                } else if (selectedEq) {
                    // Create equipment entry in customer if it was purely job-level
                    const newEqEntry = {
                        id: selectedEq.id || `eq-${Date.now()}`,
                        brand: selectedEq.brand || 'HVAC',
                        model: selectedEq.modelNumber || selectedEq.model || 'Equipment Unit',
                        serial: selectedEq.serialNumber || selectedEq.serial || 'N/A',
                        type: selectedEq.unitType || selectedEq.type || 'System',
                        name: selectedEq.name || 'Equipment Unit',
                        propertyId: effectiveLocId,
                        locationId: effectiveLocId,
                        replacedParts: [partRecord]
                    };
                    updatedEquipment = [...existingEqList, newEqEntry];
                } else {
                    updatedEquipment = existingEqList;
                }

                await db.collection('customers').doc(targetCustomer.id).update(cleanUndefinedFields({
                    equipment: updatedEquipment
                }));
                dispatch({
                    type: 'UPDATE_CUSTOMER',
                    payload: { ...currentCust, equipment: updatedEquipment }
                });
            }

            // 2. If a specific Job was linked, also record under job.partsUsed
            if (newPartData.jobId) {
                const targetJob = locationJobs.find(j => j.id === newPartData.jobId);
                if (targetJob) {
                    const updatedPartsUsed = [
                        ...(Array.isArray(targetJob.partsUsed) ? targetJob.partsUsed : []),
                        {
                            id: partRecord.id,
                            name: partRecord.name,
                            sku: partRecord.partNumber || '',
                            partNumber: partRecord.partNumber || '',
                            quantity: partRecord.quantity,
                            unitPrice: partRecord.unitPrice,
                            equipmentId: partRecord.equipmentId,
                            equipmentName: partRecord.equipmentName,
                            notes: partRecord.notes,
                            replacedAt: partRecord.replacedAt
                        }
                    ];
                    await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({
                        partsUsed: updatedPartsUsed
                    }));
                    dispatch({
                        type: 'UPDATE_JOB',
                        payload: { ...targetJob, partsUsed: updatedPartsUsed }
                    });
                }
            }

            showToast.success(`Logged replacement part "${partRecord.name}" successfully!`);
            setIsLogPartModalOpen(false);
            setLoggingTargetEquipment(null);
        } catch (err) {
            console.error(err);
            showToast.error("Failed to log replaced part.");
        } finally {
            setIsSubmittingPart(false);
        }
    };

    // Financial KPIs
    const financialStats = useMemo(() => {
        let totalRevenue = 0;
        let paidCount = 0;
        let unpaidCount = 0;

        locationJobs.forEach(j => {
            if (j.invoice) {
                const total = j.invoice.totalAmount || j.invoice.amount || 0;
                totalRevenue += total;
                if (j.invoice.status === 'Paid') paidCount++;
                else if ((j.invoice.status as any) !== 'Void') unpaidCount++;
            }
        });

        return { totalRevenue, paidCount, unpaidCount, totalJobs: locationJobs.length };
    }, [locationJobs]);

    const mapsUrl = useMemo(() => {
        const fullAddr = [
            targetLocation?.address,
            targetLocation?.city,
            targetLocation?.state,
            targetLocation?.zip
        ].filter(Boolean).join(', ');
        if (!fullAddr) return null;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`;
    }, [targetLocation]);

    if (!isOpen) return null;

    return (
        <>
            <Modal 
                isOpen={isOpen} 
                onClose={onClose} 
                title=""
                size="xl"
            >
                <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-1">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md relative overflow-hidden">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                            <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                                        Location Audit & Work History
                                    </span>
                                    {(targetLocation?.storeNumber || targetLocation?.locationNumber) && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                            Store #{targetLocation.storeNumber || targetLocation.locationNumber}
                                        </span>
                                    )}
                                    {targetCustomer && (
                                        <span className="text-xs font-bold text-slate-300">
                                            Client: <strong className="text-white">{targetCustomer.name}</strong>
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white truncate">
                                    {targetLocation?.propertyName || targetLocation?.name || 'Site Location History'}
                                </h2>
                                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium flex-wrap">
                                    <MapPin size={15} className="text-indigo-400 shrink-0" />
                                    <span>
                                        {[
                                            targetLocation?.address,
                                            targetLocation?.unitNumber ? `Unit/Ste ${targetLocation.unitNumber}` : '',
                                            targetLocation?.city,
                                            targetLocation?.state ? `${targetLocation.state} ${targetLocation.zip || ''}` : targetLocation?.zip
                                        ].filter(Boolean).join(', ') || 'Address Not Set'}
                                    </span>
                                    {mapsUrl && (
                                        <a 
                                            href={mapsUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1 hover:underline ml-1"
                                        >
                                            Open Map <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>
                                {assignedLocationPoc && (
                                    <div className="flex items-center gap-2 text-xs text-slate-200 font-medium flex-wrap pt-0.5">
                                        <UserCheck size={14} className="text-amber-400 shrink-0" />
                                        <span>
                                            POC: <strong className="text-white">{assignedLocationPoc.name}</strong>
                                            {assignedLocationPoc.role && (
                                                <span className="text-slate-300 font-normal"> ({assignedLocationPoc.role})</span>
                                            )}
                                        </span>
                                        {assignedLocationPoc.phone && (
                                            <a 
                                                href={`tel:${assignedLocationPoc.phone}`} 
                                                className="text-emerald-300 hover:text-emerald-200 hover:underline font-bold inline-flex items-center gap-1 ml-1"
                                                title={`Call ${assignedLocationPoc.name}`}
                                            >
                                                <Phone size={11} />
                                                <span>{assignedLocationPoc.phone}{assignedLocationPoc.extension ? ` x${assignedLocationPoc.extension}` : ''}</span>
                                            </a>
                                        )}
                                        {assignedLocationPoc.email && (
                                            <a 
                                                href={`mailto:${assignedLocationPoc.email}`} 
                                                className="text-indigo-300 hover:text-indigo-200 hover:underline font-bold inline-flex items-center gap-1 ml-1"
                                                title={`Email ${assignedLocationPoc.name}`}
                                            >
                                                <Mail size={11} />
                                                <span>{assignedLocationPoc.email}</span>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* KPI Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center shrink-0">
                                <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10">
                                    <span className="block text-[9px] font-bold uppercase text-slate-300 tracking-wider">Total Jobs</span>
                                    <span className="text-lg font-black text-white">{financialStats.totalJobs}</span>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10">
                                    <span className="block text-[9px] font-bold uppercase text-slate-300 tracking-wider">Revenue</span>
                                    <span className="text-lg font-black text-emerald-400">${financialStats.totalRevenue.toFixed(0)}</span>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10">
                                    <span className="block text-[9px] font-bold uppercase text-slate-300 tracking-wider">Documents</span>
                                    <span className="text-lg font-black text-indigo-300">{locationDocuments.length}</span>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10">
                                    <span className="block text-[9px] font-bold uppercase text-slate-300 tracking-wider">Photos</span>
                                    <span className="text-lg font-black text-amber-300">{locationPhotos.length}</span>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10 col-span-2 sm:col-span-1">
                                    <span className="block text-[9px] font-bold uppercase text-slate-300 tracking-wider">Parts Replaced</span>
                                    <span className="text-lg font-black text-amber-400">{locationReplacedParts.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('jobs')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'jobs'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <Calendar size={15} />
                            Work History ({locationJobs.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('documents')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'documents'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <FileText size={15} />
                            Documents & PDFs ({locationDocuments.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('photos')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'photos'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <ImageIcon size={15} />
                            Site Photos ({locationPhotos.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('equipment')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'equipment'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <Wrench size={15} />
                            Installed Equipment ({locationEquipment.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('parts')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'parts'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <Package size={15} />
                            Replaced Parts ({locationReplacedParts.length})
                        </button>
                    </div>

                    {/* TAB 1: WORK HISTORY & JOBS */}
                    {activeTab === 'jobs' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                                    All Service Orders & Repairs Completed at Site
                                </h3>
                                <div className="relative w-full sm:w-64">
                                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Filter jobs by tech, task, diagnosis..."
                                        value={searchFilter}
                                        onChange={e => setSearchFilter(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    />
                                </div>
                            </div>

                            {filteredJobs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-xs">
                                    No service records found for this location.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredJobs.map(job => {
                                        const apptDate = job.appointmentTime 
                                            ? new Date(job.appointmentTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : (job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'No Date');
                                        const invoiceTotal = job.invoice?.totalAmount || job.invoice?.amount || 0;
                                        const isPaid = job.invoice?.status === 'Paid';

                                        return (
                                            <div 
                                                key={job.id}
                                                onClick={() => {
                                                    if (onSelectJob) onSelectJob(job);
                                                    setViewingDetailJob(job);
                                                }}
                                                className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm transition-all cursor-pointer space-y-3 group"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                                            Job #{job.id.slice(-6).toUpperCase()}
                                                        </span>
                                                        <span className="text-xs text-slate-400">• {apptDate}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                            job.jobStatus === 'Completed' 
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                                                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                                        }`}>
                                                            {job.jobStatus || 'Scheduled'}
                                                        </span>
                                                        {job.poNumber && (
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono">
                                                                PO #{job.poNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 self-end sm:self-center">
                                                        {invoiceTotal > 0 && (
                                                            <div className="text-right">
                                                                <span className="font-black text-sm text-slate-900 dark:text-white">${invoiceTotal.toFixed(2)}</span>
                                                                <span className={`block text-[9px] font-bold ${isPaid ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                    {isPaid ? 'PAID' : (job.invoice?.status || 'UNPAID')}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <ArrowRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Tasks / Scope</span>
                                                        <p className="font-bold text-slate-800 dark:text-slate-200">
                                                            {(job.tasks || ['Service Call']).join(', ')}
                                                        </p>
                                                        {job.specialInstructions && (
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                                                                {job.specialInstructions}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Assigned Technician</span>
                                                        <p className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                            <User size={13} className="text-indigo-500" />
                                                            {job.assignedTechnicianName || 'Unassigned'}
                                                        </p>
                                                        {job.techRecommendations && (
                                                            <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                                                                💡 Rec: {job.techRecommendations}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* File/Doc Indicators */}
                                                {((job.files && job.files.length > 0) || ((job as any).workflowFiles && (job as any).workflowFiles.length > 0)) && (
                                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/40 text-[10px] font-bold text-slate-400">
                                                        {job.files && job.files.length > 0 && (
                                                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                                                                <FileText size={11} /> {job.files.length} Attachments
                                                            </span>
                                                        )}
                                                        {(job as any).workflowFiles && (job as any).workflowFiles.length > 0 && (
                                                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                <Camera size={11} /> {(job as any).workflowFiles.length} Photos
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: DOCUMENTS & FILES */}
                    {activeTab === 'documents' && (
                        <div className="space-y-4">
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                                All Proposals, Invoices & Attached Work Order Files
                            </h3>

                            {locationDocuments.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-xs">
                                    No documents recorded for this site location.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {locationDocuments.map(doc => {
                                        return (
                                            <div 
                                                key={doc.id}
                                                onClick={() => {
                                                    if (doc.type === 'Proposal') {
                                                        setPreviewDoc({ type: 'Proposal', data: doc.raw });
                                                    } else if (doc.type === 'Invoice') {
                                                        if (doc.raw && doc.raw.id) {
                                                            setViewingDetailJob(doc.raw);
                                                        } else {
                                                            setPreviewDoc({ type: 'Invoice', data: doc.raw });
                                                        }
                                                    } else if (doc.dataUrl) {
                                                        window.open(doc.dataUrl, '_blank');
                                                    }
                                                }}
                                                className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 shadow-sm flex items-center justify-between gap-3 cursor-pointer group transition-all"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                        doc.type === 'Proposal' 
                                                            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400' 
                                                            : doc.type === 'Invoice'
                                                                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-indigo-600">
                                                            {doc.title}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {doc.type} • {doc.date ? new Date(doc.date).toLocaleDateString() : 'Recent'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <ExternalLink size={16} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: SITE PHOTOS */}
                    {activeTab === 'photos' && (
                        <div className="space-y-4">
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                                On-Site Photos & Work Completed Galleries
                            </h3>

                            {locationPhotos.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-xs">
                                    No photos captured at this location yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {locationPhotos.map(photo => (
                                        <div 
                                            key={photo.id}
                                            onClick={() => window.open(photo.url, '_blank')}
                                            className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-square cursor-pointer shadow-sm"
                                        >
                                            <img 
                                                src={photo.url} 
                                                alt={photo.label}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end text-white text-[10px]">
                                                <span className="font-extrabold truncate">{photo.label}</span>
                                                <span className="text-slate-300 font-medium">{photo.tech}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 4: INSTALLED EQUIPMENT */}
                    {activeTab === 'equipment' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                                        Equipment & Assets Registered to Site
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Installed units, diagnostic specs, and replaced component history
                                    </p>
                                </div>
                                <Button
                                    onClick={() => openLogPartModal()}
                                    className="w-full sm:w-auto text-xs py-1.5 px-3 !bg-indigo-600 hover:!bg-indigo-700 !text-white border-0 flex items-center gap-1.5 shadow-sm"
                                >
                                    <Plus size={14} /> Log Replaced Part
                                </Button>
                            </div>

                            {locationEquipment.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-xs">
                                    No equipment units registered under this location yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {locationEquipment.map((eq: any) => {
                                        const unitParts = locationReplacedParts.filter(p => 
                                            (p.equipmentId && p.equipmentId === eq.id) || 
                                            (p.equipmentName && (p.equipmentName.toLowerCase() === (eq.name || '').toLowerCase() || p.equipmentName.toLowerCase() === (eq.brand || '').toLowerCase())) ||
                                            (eq.serialNumber && (p.notes || '').includes(eq.serialNumber)) ||
                                            (eq.modelNumber && (p.notes || '').includes(eq.modelNumber))
                                        );

                                        return (
                                            <div 
                                                key={eq.id}
                                                className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 flex flex-col justify-between"
                                            >
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                                            {eq.name || eq.unitType || 'Equipment Asset'}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                            {eq.brand || eq.manufacturer || 'HVAC/Refrig'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 font-mono">
                                                        {eq.modelNumber && <p>Model #: <strong>{eq.modelNumber}</strong></p>}
                                                        {eq.serialNumber && <p>Serial #: <strong>{eq.serialNumber}</strong></p>}
                                                        {eq.refrigerantType && <p>Refrigerant: <strong>{eq.refrigerantType}</strong></p>}
                                                        {eq.tonnage && <p>Capacity: <strong>{eq.tonnage} Tons</strong></p>}
                                                        {eq.year && <p>Year: <strong>{eq.year}</strong></p>}
                                                    </div>
                                                </div>

                                                {/* Replaced Parts on this unit */}
                                                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                            <Package size={12} className="text-amber-500" />
                                                            Parts Replaced on Unit ({unitParts.length})
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => openLogPartModal(eq)}
                                                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
                                                        >
                                                            <Plus size={11} /> + Log Part
                                                        </button>
                                                    </div>

                                                    {unitParts.length === 0 ? (
                                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                                                            <p className="text-[10px] text-slate-400 italic">No parts replaced or logged on this unit yet.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                                            {unitParts.map((part, pIdx) => (
                                                                <div key={pIdx} className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex justify-between items-start gap-2">
                                                                    <div className="min-w-0">
                                                                        <span className="font-bold text-slate-900 dark:text-white block truncate">{part.name}</span>
                                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5 flex-wrap">
                                                                            {part.partNumber && <span>PN: {part.partNumber}</span>}
                                                                            {part.replacedAt && <span>• {new Date(part.replacedAt).toLocaleDateString()}</span>}
                                                                            {part.poNumber && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const j = locationJobs.find(item => item.id === part.jobId || item.poNumber === part.poNumber);
                                                                                        if (j) setViewingDetailJob(j);
                                                                                    }}
                                                                                    className="text-indigo-500 hover:underline font-bold"
                                                                                >
                                                                                    WO #{part.poNumber}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {part.notes && <p className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-1">{part.notes}</p>}
                                                                    </div>
                                                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold text-[9px] rounded-md shrink-0">
                                                                        Qty: {part.quantity}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 5: REPLACED PARTS & MATERIALS LOG */}
                    {activeTab === 'parts' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                                        <Package className="text-amber-500" size={18} />
                                        Replaced Parts & Materials Log
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        All components, HVAC/R replacement parts, and materials installed at this site
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:w-64">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search part name, PN, WO #, tech..."
                                            value={searchFilter}
                                            onChange={(e) => setSearchFilter(e.target.value)}
                                            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <Button
                                        onClick={() => openLogPartModal()}
                                        className="text-xs py-1.5 px-3 !bg-indigo-600 hover:!bg-indigo-700 !text-white border-0 flex items-center gap-1.5 shadow-sm shrink-0"
                                    >
                                        <Plus size={14} /> Log Part
                                    </Button>
                                </div>
                            </div>

                            {filteredReplacedParts.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-xs space-y-3">
                                    <Package size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                                    <p>No replaced parts or materials match your search.</p>
                                    <Button
                                        onClick={() => openLogPartModal()}
                                        className="mx-auto text-xs py-1.5 px-3 !bg-indigo-600 hover:!bg-indigo-700 !text-white border-0"
                                    >
                                        <Plus size={14} /> Log First Replacement Part
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                        <div className="col-span-4">Part / Component</div>
                                        <div className="col-span-3">Equipment Unit</div>
                                        <div className="col-span-2">Date & WO #</div>
                                        <div className="col-span-2">Technician / Warranty</div>
                                        <div className="col-span-1 text-right">Qty</div>
                                    </div>

                                    {filteredReplacedParts.map((part) => (
                                        <div 
                                            key={part.id}
                                            className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-600 transition-all flex flex-col md:grid md:grid-cols-12 gap-2 md:items-center text-xs"
                                        >
                                            <div className="md:col-span-4 flex items-start gap-2.5 min-w-0">
                                                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
                                                    <Package size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                                                        {part.name}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono flex-wrap">
                                                        {part.partNumber && <span className="bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded">PN: {part.partNumber}</span>}
                                                        {part.unitPrice ? <span>${part.unitPrice.toFixed(2)} ea</span> : null}
                                                    </div>
                                                    {part.notes && (
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-1">
                                                            {part.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="md:col-span-3 min-w-0">
                                                <span className="text-[10px] font-bold uppercase text-slate-400 block md:hidden">Unit:</span>
                                                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] rounded-full inline-block border border-indigo-100 dark:border-indigo-900 truncate max-w-full">
                                                    {part.equipmentName || 'Site General'}
                                                </span>
                                            </div>

                                            <div className="md:col-span-2 min-w-0">
                                                <span className="text-[10px] font-bold uppercase text-slate-400 block md:hidden">Installed:</span>
                                                <div className="font-mono text-slate-700 dark:text-slate-300">
                                                    {part.replacedAt ? new Date(part.replacedAt).toLocaleDateString() : 'N/A'}
                                                </div>
                                                {part.poNumber && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const j = locationJobs.find(item => item.id === part.jobId || item.poNumber === part.poNumber);
                                                            if (j) setViewingDetailJob(j);
                                                        }}
                                                        className="text-[10px] text-indigo-500 hover:underline font-bold inline-flex items-center gap-0.5"
                                                    >
                                                        WO #{part.poNumber} <ExternalLink size={9} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="md:col-span-2 min-w-0">
                                                <span className="text-[10px] font-bold uppercase text-slate-400 block md:hidden">Tech:</span>
                                                <div className="text-slate-800 dark:text-slate-200 font-medium truncate">
                                                    {part.technicianName || 'Service Tech'}
                                                </div>
                                                {part.warrantyDurationMonths && (
                                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                                                        {part.warrantyDurationMonths} mo warranty
                                                    </span>
                                                )}
                                            </div>

                                            <div className="md:col-span-1 text-left md:text-right">
                                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-black text-xs rounded-lg">
                                                    Qty: {part.quantity}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                        <Button variant="secondary" onClick={onClose}>Close Audit View</Button>
                    </div>
                </div>
            </Modal>

            {/* LOG REPLACED PART MODAL */}
            {isLogPartModalOpen && (
                <Modal
                    isOpen={isLogPartModalOpen}
                    onClose={() => {
                        setIsLogPartModalOpen(false);
                        setLoggingTargetEquipment(null);
                    }}
                    title="Log Replaced Part & Component"
                    size="md"
                >
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Log a replacement component or material installed at this location. This updates equipment asset history and work order records.
                        </p>

                        <div className="space-y-3">
                            <Select
                                label="Target Equipment Unit"
                                value={newPartData.equipmentId}
                                onChange={(e) => setNewPartData({ ...newPartData, equipmentId: e.target.value })}
                            >
                                <option value="">-- General Location Asset --</option>
                                {locationEquipment.map(eq => (
                                    <option key={eq.id} value={eq.id}>
                                        {eq.name || eq.brand} {eq.modelNumber ? `(${eq.modelNumber})` : ''} {eq.serialNumber ? `SN: ${eq.serialNumber}` : ''}
                                    </option>
                                ))}
                            </Select>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Quick Select Part Type
                                </label>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                                    {COMMON_HVAC_PARTS.map((pName) => (
                                        <button
                                            key={pName}
                                            type="button"
                                            onClick={() => setNewPartData({ ...newPartData, name: pName })}
                                            className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-colors text-slate-700 dark:text-slate-300"
                                        >
                                            {pName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Input
                                label="Part / Component Name *"
                                value={newPartData.name}
                                onChange={(e) => setNewPartData({ ...newPartData, name: e.target.value })}
                                placeholder="e.g. 45/5 MFD Dual Run Capacitor"
                                required
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Part # / SKU"
                                    value={newPartData.partNumber}
                                    onChange={(e) => setNewPartData({ ...newPartData, partNumber: e.target.value })}
                                    placeholder="e.g. CAP-455-RD"
                                />
                                <Input
                                    label="Quantity"
                                    type="number"
                                    min="1"
                                    value={newPartData.quantity}
                                    onChange={(e) => setNewPartData({ ...newPartData, quantity: parseInt(e.target.value, 10) || 1 })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Date Replaced"
                                    type="date"
                                    value={newPartData.replacedAt}
                                    onChange={(e) => setNewPartData({ ...newPartData, replacedAt: e.target.value })}
                                />
                                <Select
                                    label="Associated Work Order"
                                    value={newPartData.jobId}
                                    onChange={(e) => setNewPartData({ ...newPartData, jobId: e.target.value })}
                                >
                                    <option value="">-- No Linked Job --</option>
                                    {locationJobs.map(j => (
                                        <option key={j.id} value={j.id}>
                                            WO #{j.poNumber || j.id.slice(-6)} • {j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : 'Recent'}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Technician Name"
                                    value={newPartData.technicianName}
                                    onChange={(e) => setNewPartData({ ...newPartData, technicianName: e.target.value })}
                                    placeholder="e.g. Isaac M."
                                />
                                <Input
                                    label="Warranty (Months)"
                                    type="number"
                                    value={newPartData.warrantyDurationMonths}
                                    onChange={(e) => setNewPartData({ ...newPartData, warrantyDurationMonths: parseInt(e.target.value, 10) || 0 })}
                                    placeholder="12"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Notes & Reason for Replacement
                                </label>
                                <textarea
                                    value={newPartData.notes}
                                    onChange={(e) => setNewPartData({ ...newPartData, notes: e.target.value })}
                                    placeholder="e.g. Old capacitor tested weak at 12uF. Installed new turbo run capacitor and verified operating amps."
                                    rows={2}
                                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setIsLogPartModalOpen(false);
                                    setLoggingTargetEquipment(null);
                                }}
                                disabled={isSubmittingPart}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveReplacedPart}
                                disabled={isSubmittingPart || !newPartData.name.trim()}
                                className="!bg-indigo-600 hover:!bg-indigo-700 !text-white flex items-center gap-1.5"
                            >
                                <Package size={14} />
                                {isSubmittingPart ? 'Saving Part...' : 'Save Replaced Part'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {previewDoc && (
                <DocumentPreview
                    onClose={() => setPreviewDoc(null)}
                    type={previewDoc.type}
                    data={previewDoc.data}
                />
            )}

            {viewingDetailJob && (
                <JobDetailModal
                    isOpen={!!viewingDetailJob}
                    onClose={() => setViewingDetailJob(null)}
                    job={viewingDetailJob}
                />
            )}
        </>
    );
};

export default LocationAuditModal;
