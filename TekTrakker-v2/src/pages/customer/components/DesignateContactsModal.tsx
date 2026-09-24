import React, { useState, useMemo } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import { 
    Users, UserCheck, ShieldCheck, MapPin, Wrench, 
    Phone, Mail, Plus, Edit2, Trash2, CheckCircle2, 
    Star, Search, Building, Shield, FileText, AlertCircle, Check, Inbox
} from 'lucide-react';
import type { Customer, ServiceLocation, Job, CustomerContact } from 'types';
import { formatFullAddress } from 'lib/utils';
import { globalConfirm } from 'lib/globalConfirm';

interface DesignateContactsModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer;
    locations: ServiceLocation[];
    jobs: Job[];
    onSaveContacts: (updatedContacts: CustomerContact[], updatedJobs?: Job[], updatedLocations?: ServiceLocation[]) => void;
    initialSelectedLocationId?: string | null;
    initialSelectedJobId?: string | null;
}

const DEFAULT_TITLES = [
    'Account Manager',
    'Regional Facilities Director',
    'General Manager',
    'Property Manager',
    'Chief Operating Engineer',
    'On-Site Maintenance Lead',
    'Billing & AP Contact',
    'Store / Branch Manager',
    'Executive Point of Contact'
];

export const DesignateContactsModal: React.FC<DesignateContactsModalProps> = ({
    isOpen,
    onClose,
    customer,
    locations = [],
    jobs = [],
    onSaveContacts,
    initialSelectedLocationId,
    initialSelectedJobId
}) => {
    // Complete locations including primary / default facility
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

    // Active Target context
    const activeTargetLocation = useMemo(() => {
        if (!initialSelectedLocationId) return null;
        return allLocations.find(l => l.id === initialSelectedLocationId) || (initialSelectedLocationId === 'default' ? allLocations[0] : null);
    }, [initialSelectedLocationId, allLocations]);

    const activeTargetJob = useMemo(() => {
        if (!initialSelectedJobId) return null;
        return jobs.find(j => j.id === initialSelectedJobId) || null;
    }, [initialSelectedJobId, jobs]);

    // Current contacts list
    const currentContacts = useMemo<CustomerContact[]>(() => {
        const raw = (customer.contacts || []) as any[];
        if (raw.length === 0) {
            // Provide initial realistic default contacts for commercial demo if none exist
            return [
                {
                    id: 'poc-1',
                    name: 'Marcus Vance',
                    title: 'Regional Account & Facility Manager',
                    email: 'marcus.vance@rodtestlogistics.com',
                    phone: '(512) 555-0199',
                    extension: '104',
                    isAccountManager: true,
                    isPrimary: true,
                    assignedLocationIds: ['default', ...allLocations.slice(1, 2).map(l => l.id)],
                    assignedJobIds: jobs.slice(0, 2).map(j => j.id),
                    canApproveProposals: true,
                    canAuthorizeWorkOrders: true,
                    isBillingContact: true,
                    isEmergencyContact: true,
                    notes: 'Primary point of contact for all commercial capital projects and HVAC overhauls.'
                },
                {
                    id: 'poc-2',
                    name: 'Elena Rostova',
                    title: 'On-Site Operations Lead',
                    email: 'elena.r@rodtestlogistics.com',
                    phone: '(512) 555-0244',
                    isAccountManager: false,
                    assignedLocationIds: allLocations.length > 2 ? [allLocations[2].id] : (allLocations[0] ? [allLocations[0].id] : []),
                    assignedJobIds: jobs.length > 2 ? [jobs[2].id] : [],
                    canApproveProposals: false,
                    canAuthorizeWorkOrders: true,
                    isEmergencyContact: true,
                    notes: 'On-site contact for retail center roof access and emergency drain issues.'
                },
                {
                    id: 'poc-3',
                    name: 'David Sterling',
                    title: 'Director of Property & Facilities',
                    email: 'd.sterling@rodtestlogistics.com',
                    phone: '(512) 555-0381',
                    extension: '210',
                    isAccountManager: true,
                    assignedLocationIds: allLocations.length > 3 ? [allLocations[3].id] : [],
                    assignedJobIds: [],
                    canApproveProposals: true,
                    canAuthorizeWorkOrders: true,
                    isBillingContact: true,
                    notes: 'Authorizes high-NTE work orders and seasonal start-up maintenance agreements.'
                }
            ];
        }
        return raw.map((c, i) => ({
            id: c.id || `contact-${i}-${Date.now()}`,
            name: c.name || '',
            title: c.title || c.role || 'Contact',
            email: c.email || '',
            phone: c.phone || '',
            extension: c.extension || '',
            isPrimary: !!c.isPrimary,
            isAccountManager: !!c.isAccountManager || c.title?.toLowerCase().includes('account manager'),
            isIncomingWorkOrderContact: !!c.isIncomingWorkOrderContact || (c.contactRoles || []).includes('incoming_workorders') || c.title?.toLowerCase().includes('incoming work order') || c.title?.toLowerCase().includes('incoming workorder'),
            contactRoles: c.contactRoles || [],
            assignedLocationIds: c.assignedLocationIds || c.allowedLocationIds || [],
            assignedJobIds: c.assignedJobIds || [],
            canApproveProposals: c.canApproveProposals !== false,
            canAuthorizeWorkOrders: c.canAuthorizeWorkOrders !== false,
            isBillingContact: !!c.isBillingContact,
            isEmergencyContact: !!c.isEmergencyContact,
            notes: c.notes || ''
        }));
    }, [customer.contacts, allLocations, jobs]);

    const [contactsList, setContactsList] = useState<CustomerContact[]>(currentContacts);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<'all' | 'account_managers' | 'incoming_workorders' | 'location_pocs' | 'wo_leads'>('all');
    
    // Edit/Create state
    const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    // If initial location or job was provided, start by editing or highlighting
    React.useEffect(() => {
        setContactsList(currentContacts);
    }, [currentContacts]);

    const filteredContacts = useMemo(() => {
        return contactsList.filter(contact => {
            const matchesQuery = 
                contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (contact.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contact.phone.includes(searchQuery);

            if (!matchesQuery) return false;

            if (filterCategory === 'account_managers') {
                return contact.isAccountManager;
            }
            if (filterCategory === 'incoming_workorders') {
                return !!contact.isIncomingWorkOrderContact || (contact.contactRoles || []).includes('incoming_workorders');
            }
            if (filterCategory === 'location_pocs') {
                return (contact.assignedLocationIds || []).length > 0;
            }
            if (filterCategory === 'wo_leads') {
                return (contact.assignedJobIds || []).length > 0;
            }
            return true;
        });
    }, [contactsList, searchQuery, filterCategory]);

    const handleStartNewContact = () => {
        const newContact: CustomerContact = {
            id: `poc-${Date.now()}`,
            name: '',
            title: 'Account Manager',
            email: '',
            phone: '',
            extension: '',
            isPrimary: contactsList.length === 0,
            isAccountManager: true,
            isIncomingWorkOrderContact: false,
            contactRoles: [],
            assignedLocationIds: initialSelectedLocationId ? [initialSelectedLocationId] : [],
            assignedJobIds: initialSelectedJobId ? [initialSelectedJobId] : [],
            canApproveProposals: true,
            canAuthorizeWorkOrders: true,
            isBillingContact: false,
            isEmergencyContact: false,
            notes: ''
        };
        setEditingContact(newContact);
        setIsCreatingNew(true);
    };

    const handleSaveContactForm = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingContact || !editingContact.name.trim()) return;

        let updatedList: CustomerContact[];
        if (isCreatingNew) {
            updatedList = [...contactsList, editingContact];
        } else {
            updatedList = contactsList.map(c => c.id === editingContact.id ? editingContact : c);
        }

        // If marked primary, ensure other contacts are not primary
        if (editingContact.isPrimary) {
            updatedList = updatedList.map(c => c.id === editingContact.id ? c : { ...c, isPrimary: false });
        }

        setContactsList(updatedList);
        setEditingContact(null);
        setIsCreatingNew(false);

        // Sync with jobs & locations
        syncAndPersist(updatedList);
    };

    const handleDeleteContact = async (id: string) => {
        if (!(await globalConfirm('Are you sure you want to remove this designated contact?', 'Remove Contact', 'Remove Contact', 'Cancel'))) return;
        const updatedList = contactsList.filter(c => c.id !== id);
        setContactsList(updatedList);
        syncAndPersist(updatedList);
    };

    const syncAndPersist = (updatedList: CustomerContact[]) => {
        // Sync Work Orders
        const updatedJobs = jobs.map(job => {
            const matchingContact = updatedList.find(c => (c.assignedJobIds || []).includes(job.id));
            if (matchingContact) {
                return {
                    ...job,
                    accountManagerContact: matchingContact.isAccountManager ? {
                        name: matchingContact.name,
                        phone: matchingContact.phone,
                        extension: matchingContact.extension,
                        email: matchingContact.email,
                        title: matchingContact.title,
                        role: 'Account Manager'
                    } : job.accountManagerContact,
                    pocContact: {
                        name: matchingContact.name,
                        phone: matchingContact.phone,
                        extension: matchingContact.extension,
                        email: matchingContact.email,
                        title: matchingContact.title,
                        role: matchingContact.isAccountManager ? 'Account Manager' : (matchingContact.title || 'On-Site POC')
                    }
                };
            }
            return job;
        });

        // Sync Locations (both real serviceLocations and primary location)
        const updatedLocations = (locations || []).map(loc => {
            const locContacts = updatedList.filter(c => {
                const locIds = c.assignedLocationIds || [];
                return loc.id === 'default' ? (locIds.length === 0 || locIds.includes('default')) : locIds.includes(loc.id);
            });
            const primaryAm = locContacts.find(c => c.isAccountManager) || locContacts[0];
            return {
                ...loc,
                contacts: locContacts.map(c => ({
                    name: c.name,
                    phone: c.phone,
                    email: c.email,
                    role: c.title || (c.isAccountManager ? 'Account Manager' : 'On-Site POC')
                })),
                accountManager: primaryAm ? {
                    name: primaryAm.name,
                    phone: primaryAm.phone,
                    email: primaryAm.email,
                    title: primaryAm.title
                } : undefined
            };
        });

        onSaveContacts(updatedList, updatedJobs, updatedLocations);
    };

    // Quick 1-click toggle for assigning/removing a contact from a location
    const handleQuickToggleLocation = (contactId: string, locId: string) => {
        const updatedList = contactsList.map(c => {
            if (c.id !== contactId) return c;
            const currentLocs = c.assignedLocationIds || [];
            const isCurrentlyAssigned = currentLocs.includes(locId) || (locId === 'default' && (currentLocs.length === 0 || currentLocs.includes('default')));
            
            let nextLocs: string[];
            if (isCurrentlyAssigned) {
                // Remove assignment
                nextLocs = currentLocs.filter(id => id !== locId && id !== 'default');
                if (locId === 'default' && currentLocs.length === 0) {
                    nextLocs = allLocations.filter(l => l.id !== 'default').map(l => l.id);
                }
            } else {
                // Add assignment
                nextLocs = [...currentLocs.filter(id => id !== 'default'), locId];
            }
            return {
                ...c,
                assignedLocationIds: nextLocs
            };
        });

        setContactsList(updatedList);
        syncAndPersist(updatedList);
    };

    // Quick 1-click toggle for assigning/removing a contact from a work order
    const handleQuickToggleJob = (contactId: string, jobId: string) => {
        const updatedList = contactsList.map(c => {
            if (c.id !== contactId) return c;
            const currentJobs = c.assignedJobIds || [];
            const isAssigned = currentJobs.includes(jobId);
            const nextJobs = isAssigned 
                ? currentJobs.filter(id => id !== jobId)
                : [...currentJobs, jobId];
            return {
                ...c,
                assignedJobIds: nextJobs
            };
        });

        setContactsList(updatedList);
        syncAndPersist(updatedList);
    };

    const toggleLocationAssignment = (locId: string) => {
        if (!editingContact) return;
        const currentLocs = editingContact.assignedLocationIds || [];
        const nextLocs = currentLocs.includes(locId)
            ? currentLocs.filter(id => id !== locId)
            : [...currentLocs, locId];
        setEditingContact({ ...editingContact, assignedLocationIds: nextLocs });
    };

    const toggleJobAssignment = (jobId: string) => {
        if (!editingContact) return;
        const currentJobIds = editingContact.assignedJobIds || [];
        const nextJobIds = currentJobIds.includes(jobId)
            ? currentJobIds.filter(id => id !== jobId)
            : [...currentJobIds, jobId];
        setEditingContact({ ...editingContact, assignedJobIds: nextJobIds });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Authorized Company Contacts, Managers & POCs" size="xl">
            <div className="space-y-6">
                {/* Active Context Banner when opened for a specific Location or Work Order */}
                {activeTargetLocation && (
                    <div className="bg-gradient-to-r from-primary-950 via-slate-900 to-indigo-950 border-2 border-primary-500/50 rounded-2xl p-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-primary-500/20 text-primary-300 rounded-xl border border-primary-400/30 shrink-0">
                                <Building size={22} />
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-primary-400 block">
                                    Assigning Points of Contact for Facility:
                                </span>
                                <h4 className="font-black text-base text-white">
                                    {activeTargetLocation.propertyName || activeTargetLocation.name}
                                </h4>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    Click any contact card or click the button to assign or remove authorized POCs for this facility.
                                </p>
                            </div>
                        </div>
                        <Button 
                            onClick={handleStartNewContact}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm"
                        >
                            <Plus size={14} /> Add New Contact
                        </Button>
                    </div>
                )}

                {activeTargetJob && !activeTargetLocation && (
                    <div className="bg-gradient-to-r from-primary-950 via-slate-900 to-indigo-950 border-2 border-primary-500/50 rounded-2xl p-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-primary-500/20 text-primary-300 rounded-xl border border-primary-400/30 shrink-0">
                                <Wrench size={22} />
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-primary-400 block">
                                    Designating Point of Contact for Work Order:
                                </span>
                                <h4 className="font-black text-base text-white">
                                    {(activeTargetJob.tasks || [])[0] || `Work Order #${activeTargetJob.id.slice(-6).toUpperCase()}`}
                                </h4>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    Click any contact card or click the button to designate an on-site lead for this service job.
                                </p>
                            </div>
                        </div>
                        <Button 
                            onClick={handleStartNewContact}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm"
                        >
                            <Plus size={14} /> Add New Contact
                        </Button>
                    </div>
                )}

                {!activeTargetLocation && !activeTargetJob && (
                    <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden border border-primary-500/20">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-primary-500/20 rounded-xl text-primary-300 border border-primary-400/30">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-base">Authorized Points of Contact & Account Managers</h4>
                                    <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                                        Designate company personnel authorized to request service, approve field quotes, authorize site access, and act as facility leads.
                                    </p>
                                </div>
                            </div>
                            <Button 
                                onClick={handleStartNewContact}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm"
                            >
                                <Plus size={16} /> Add Authorized POC
                            </Button>
                        </div>
                    </div>
                )}

                {/* Edit / Create Form Modal Form */}
                {editingContact ? (
                    <form onSubmit={handleSaveContactForm} className="bg-white dark:bg-slate-900 border-2 border-primary-500/40 rounded-3xl p-6 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <span className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-xl">
                                    <UserCheck size={20} />
                                </span>
                                <div>
                                    <h4 className="font-black text-base text-slate-900 dark:text-white">
                                        {isCreatingNew ? 'Add New Authorized POC / Manager' : `Edit Contact: ${editingContact.name}`}
                                    </h4>
                                    <p className="text-xs text-slate-400">Configure role, contact methods, assigned locations, and work orders.</p>
                                </div>
                            </div>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => { setEditingContact(null); setIsCreatingNew(false); }}
                            >
                                Cancel
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                                <input 
                                    type="text"
                                    required
                                    value={editingContact.name}
                                    onChange={e => setEditingContact({ ...editingContact, name: e.target.value })}
                                    placeholder="e.g. Marcus Vance"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Title / Role *</label>
                                <input 
                                    type="text"
                                    required
                                    list="title-options"
                                    value={editingContact.title || ''}
                                    onChange={e => setEditingContact({ ...editingContact, title: e.target.value })}
                                    placeholder="e.g. Account Manager, Facility Director"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                                <datalist id="title-options">
                                    {DEFAULT_TITLES.map(t => <option key={t} value={t} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                                <input 
                                    type="email"
                                    required
                                    value={editingContact.email}
                                    onChange={e => setEditingContact({ ...editingContact, email: e.target.value })}
                                    placeholder="m.vance@company.com"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Direct Phone *</label>
                                    <input 
                                        type="tel"
                                        required
                                        value={editingContact.phone}
                                        onChange={e => setEditingContact({ ...editingContact, phone: e.target.value })}
                                        placeholder="(512) 555-0199"
                                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ext.</label>
                                    <input 
                                        type="text"
                                        value={editingContact.extension || ''}
                                        onChange={e => setEditingContact({ ...editingContact, extension: e.target.value })}
                                        placeholder="104"
                                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Special Role Designations */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Designation Badges</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400">
                                    <input 
                                        type="checkbox"
                                        checked={!!editingContact.isIncomingWorkOrderContact}
                                        onChange={e => setEditingContact({ 
                                            ...editingContact, 
                                            isIncomingWorkOrderContact: e.target.checked,
                                            contactRoles: e.target.checked
                                                ? Array.from(new Set([...(editingContact.contactRoles || []), 'incoming_workorders']))
                                                : (editingContact.contactRoles || []).filter((r: string) => r !== 'incoming_workorders')
                                        })}
                                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                    />
                                    <Inbox size={16} className="text-amber-500" />
                                    <span>Incoming Work Orders</span>
                                </label>

                                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-400">
                                    <input 
                                        type="checkbox"
                                        checked={editingContact.isAccountManager}
                                        onChange={e => setEditingContact({ ...editingContact, isAccountManager: e.target.checked })}
                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <Star size={16} className="text-amber-500" />
                                    <span>Lead Account Manager</span>
                                </label>

                                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-400">
                                    <input 
                                        type="checkbox"
                                        checked={editingContact.isPrimary}
                                        onChange={e => setEditingContact({ ...editingContact, isPrimary: e.target.checked })}
                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <ShieldCheck size={16} className="text-emerald-500" />
                                    <span>Primary Corporate Signer</span>
                                </label>
                            </div>
                        </div>

                        {/* Designated Locations Multi-Select */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Building size={14} className="text-primary-600" /> Designated Properties & Locations
                                </label>
                                <span className="text-[11px] text-slate-400 font-bold">
                                    {(editingContact.assignedLocationIds || []).length} of {allLocations.length} selected
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                                {allLocations.map(loc => {
                                    const isAssigned = (editingContact.assignedLocationIds || []).includes(loc.id) || (loc.id === 'default' && (editingContact.assignedLocationIds || []).includes('default'));
                                    return (
                                        <div 
                                            key={loc.id}
                                            onClick={() => toggleLocationAssignment(loc.id)}
                                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                                isAssigned 
                                                    ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-900 dark:text-primary-200 shadow-sm' 
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="font-bold text-xs truncate">{loc.propertyName || loc.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{typeof loc.address === 'string' ? loc.address : ''}</p>
                                            </div>
                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                                isAssigned ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                            }`}>
                                                {isAssigned && <Check size={12} strokeWidth={3} />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Designated Work Orders Multi-Select */}
                        {jobs.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Wrench size={14} className="text-emerald-600" /> Designated Work Orders & Projects
                                    </label>
                                    <span className="text-[11px] text-slate-400 font-bold">
                                        {(editingContact.assignedJobIds || []).length} of {jobs.length} selected
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                                    {jobs.map(job => {
                                        const isAssigned = (editingContact.assignedJobIds || []).includes(job.id);
                                        return (
                                            <div 
                                                key={job.id}
                                                onClick={() => toggleJobAssignment(job.id)}
                                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                                    isAssigned 
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm' 
                                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <p className="font-bold text-xs truncate">{(job.tasks || [])[0] || 'Service Visit'}</p>
                                                    <p className="text-[10px] text-slate-400">📅 {new Date(job.appointmentTime).toLocaleDateString()} · {job.jobStatus}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                                    isAssigned ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                                                }`}>
                                                    {isAssigned && <Check size={12} strokeWidth={3} />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Custom Notes */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Authorization Notes & Responsibilities</label>
                            <textarea 
                                rows={2}
                                value={editingContact.notes || ''}
                                onChange={e => setEditingContact({ ...editingContact, notes: e.target.value })}
                                placeholder="e.g. Primary contact for HVAC system roof access, NTE approvals up to $2,500."
                                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                            />
                        </div>

                        {/* Save Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={() => { setEditingContact(null); setIsCreatingNew(false); }}
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                className="bg-primary-600 hover:bg-primary-700 font-black px-6"
                            >
                                {isCreatingNew ? 'Save New Contact' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <>
                        {/* Directory Controls */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            {/* Filter category tabs */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 w-full sm:w-auto">
                                {[
                                    { id: 'all', label: 'All Contacts', count: contactsList.length },
                                    { id: 'incoming_workorders', label: 'Incoming Work Orders', count: contactsList.filter(c => c.isIncomingWorkOrderContact || (c.contactRoles || []).includes('incoming_workorders')).length },
                                    { id: 'account_managers', label: 'Account Managers', count: contactsList.filter(c => c.isAccountManager).length },
                                    { id: 'location_pocs', label: 'Location POCs', count: contactsList.filter(c => (c.assignedLocationIds || []).length > 0).length },
                                    { id: 'wo_leads', label: 'WO Leads', count: contactsList.filter(c => (c.assignedJobIds || []).length > 0).length },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setFilterCategory(tab.id as any)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                            filterCategory === tab.id
                                                ? 'bg-primary-600 text-white shadow-sm'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${filterCategory === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Search bar */}
                            <div className="relative w-full sm:w-60">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search contacts, roles..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Contacts Directory Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto p-1">
                            {filteredContacts.map(contact => {
                                const assignedLocations = allLocations.filter(l => (contact.assignedLocationIds || []).includes(l.id) || (l.id === 'default' && (contact.assignedLocationIds || []).includes('default')));
                                const assignedWOs = jobs.filter(j => (contact.assignedJobIds || []).includes(j.id));

                                const isAssignedToActiveLoc = activeTargetLocation ? (
                                    (contact.assignedLocationIds || []).includes(activeTargetLocation.id) ||
                                    (activeTargetLocation.id === 'default' && ((contact.assignedLocationIds || []).length === 0 || (contact.assignedLocationIds || []).includes('default')))
                                ) : false;

                                const isAssignedToActiveWO = activeTargetJob ? (
                                    (contact.assignedJobIds || []).includes(activeTargetJob.id)
                                ) : false;

                                return (
                                    <Card 
                                        key={contact.id}
                                        onClick={() => {
                                            if (activeTargetLocation) {
                                                handleQuickToggleLocation(contact.id, activeTargetLocation.id);
                                            } else if (activeTargetJob) {
                                                handleQuickToggleJob(contact.id, activeTargetJob.id);
                                            }
                                        }}
                                        className={`p-5 border-2 transition-all space-y-3.5 relative select-none ${
                                            activeTargetLocation 
                                                ? (isAssignedToActiveLoc 
                                                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md cursor-pointer ring-2 ring-emerald-500/20' 
                                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary-500 hover:shadow-md cursor-pointer')
                                                : activeTargetJob
                                                    ? (isAssignedToActiveWO
                                                        ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md cursor-pointer ring-2 ring-emerald-500/20'
                                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary-500 hover:shadow-md cursor-pointer')
                                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary-400'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center font-black text-sm shadow-md shrink-0 ${
                                                    isAssignedToActiveLoc || isAssignedToActiveWO
                                                        ? 'bg-gradient-to-br from-emerald-600 to-teal-700'
                                                        : 'bg-gradient-to-br from-primary-600 to-indigo-700'
                                                }`}>
                                                    {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'POC'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <h4 className="font-black text-sm text-slate-900 dark:text-white">{contact.name}</h4>
                                                        {contact.isPrimary && (
                                                             <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                                                 Primary
                                                             </span>
                                                        )}
                                                        {(contact.isIncomingWorkOrderContact || (contact.contactRoles || []).includes('incoming_workorders')) && (
                                                             <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5 border border-amber-300 dark:border-amber-800">
                                                                 <Inbox size={9} /> Incoming Work Orders
                                                             </span>
                                                        )}
                                                        {contact.isAccountManager && (
                                                             <span className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5">
                                                                 <Star size={9} /> AM
                                                             </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-bold mt-0.5">{contact.title || 'Designated Contact'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    type="button"
                                                    onClick={() => { setEditingContact(contact); setIsCreatingNew(false); }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                    title="Edit Contact Details"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleDeleteContact(contact.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                    title="Remove Contact"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Contact Methods */}
                                        <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl" onClick={e => e.stopPropagation()}>
                                            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-primary-600 transition-colors font-medium">
                                                <Phone size={12} className="text-primary-500 shrink-0" />
                                                <span>{contact.phone} {contact.extension && `(Ext: ${contact.extension})`}</span>
                                            </a>
                                            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-primary-600 transition-colors font-medium truncate">
                                                <Mail size={12} className="text-primary-500 shrink-0" />
                                                <span className="truncate">{contact.email}</span>
                                            </a>
                                        </div>

                                        {/* Quick Assign / Toggle Button when in Location Context */}
                                        {activeTargetLocation && (
                                            <div className="pt-1">
                                                {isAssignedToActiveLoc ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickToggleLocation(contact.id, activeTargetLocation.id);
                                                        }}
                                                        className="w-full bg-emerald-600 hover:bg-rose-600 text-white font-black text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all group/btn cursor-pointer"
                                                    >
                                                        <CheckCircle2 size={14} className="group-hover/btn:hidden" />
                                                        <Trash2 size={14} className="hidden group-hover/btn:inline" />
                                                        <span className="group-hover/btn:hidden">✓ Designated for {activeTargetLocation.propertyName || activeTargetLocation.name}</span>
                                                        <span className="hidden group-hover/btn:inline">Remove from {activeTargetLocation.propertyName || activeTargetLocation.name}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickToggleLocation(contact.id, activeTargetLocation.id);
                                                        }}
                                                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                                    >
                                                        <Plus size={14} />
                                                        <span>Assign to {activeTargetLocation.propertyName || activeTargetLocation.name}</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Quick Assign / Toggle Button when in Work Order Context */}
                                        {activeTargetJob && !activeTargetLocation && (
                                            <div className="pt-1">
                                                {isAssignedToActiveWO ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickToggleJob(contact.id, activeTargetJob.id);
                                                        }}
                                                        className="w-full bg-emerald-600 hover:bg-rose-600 text-white font-black text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all group/btn cursor-pointer"
                                                    >
                                                        <CheckCircle2 size={14} className="group-hover/btn:hidden" />
                                                        <Trash2 size={14} className="hidden group-hover/btn:inline" />
                                                        <span className="group-hover/btn:hidden">✓ Designated for this Work Order</span>
                                                        <span className="hidden group-hover/btn:inline">Remove from this Work Order</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickToggleJob(contact.id, activeTargetJob.id);
                                                        }}
                                                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                                    >
                                                        <Plus size={14} />
                                                        <span>Designate for this Work Order</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Assigned Locations & WOs Tags */}
                                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                                            <div className="flex items-start gap-1.5">
                                                <MapPin size={12} className="text-primary-500 shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <span className="font-bold text-slate-500">Locations: </span>
                                                    {assignedLocations.length > 0 ? (
                                                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                                                            {assignedLocations.map(l => l.propertyName || l.name).join(', ')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Unassigned (Click to Assign)</span>
                                                    )}
                                                </div>
                                            </div>

                                            {assignedWOs.length > 0 && (
                                                <div className="flex items-start gap-1.5">
                                                    <Wrench size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <span className="font-bold text-slate-500">Assigned WOs: </span>
                                                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                                                            {assignedWOs.map(j => (j.tasks || [])[0] || 'WO').join(', ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        {filteredContacts.length === 0 && (
                            <div className="p-8 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                No contacts found matching "{searchQuery}".
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};

export default DesignateContactsModal;
