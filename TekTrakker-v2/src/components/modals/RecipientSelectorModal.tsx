import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import { Mail, User, Plus, Check, Paperclip } from 'lucide-react';
import showToast from 'lib/toast';
import { 
    isImpactCustomer, 
    IMPACT_GENERAL_INFO, 
    IMPACT_MARICO_BETONIO, 
    resolveImpactContactsForLocation 
} from 'lib/impactDirectory';

interface RecipientSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId?: string | null;
    locationId?: string | null;
    locationName?: string | null;
    documentType?: 'invoice' | 'proposal' | 'receipt' | 'reminder' | 'report' | 'general';
    title?: string;
    showPdfOption?: boolean;
    defaultAttachPdf?: boolean;
    onConfirm: (selectedEmails: string[], attachPdf?: boolean) => void;
}

interface DisplayContact {
    id: string;
    name: string;
    email: string;
    role: string;
    type: 'billing' | 'store' | 'general' | 'custom';
}

const RecipientSelectorModal: React.FC<RecipientSelectorModalProps> = ({
    isOpen,
    onClose,
    customerId,
    locationId,
    locationName,
    documentType,
    title = 'Select Email Recipients',
    showPdfOption = true,
    defaultAttachPdf = true,
    onConfirm
}) => {
    const { state } = useAppContext();
    const { t } = useLanguage();

    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
    const [customName, setCustomName] = useState('');
    const [customEmail, setCustomEmail] = useState('');
    const [customContacts, setCustomContacts] = useState<DisplayContact[]>([]);
    const [attachPdf, setAttachPdf] = useState(defaultAttachPdf);

    const customer = useMemo(() => {
        if (!customerId) return null;
        return state.customers?.find(c => c.id === customerId) || null;
    }, [state.customers, customerId]);

    const serviceLocation = useMemo(() => {
        if (!customer) return null;
        const locKey = (locationId || locationName || '').trim().toLowerCase();
        if (!locKey) return null;
        return customer.serviceLocations?.find(loc => 
            (loc.id && loc.id.toLowerCase() === locKey) ||
            (loc.storeNumber && loc.storeNumber.toLowerCase() === locKey) ||
            (loc.name && loc.name.toLowerCase() === locKey) ||
            (loc.name && locKey.includes(loc.name.toLowerCase())) ||
            (loc.id && locKey.includes(loc.id.toLowerCase()))
        ) || null;
    }, [customer, locationId, locationName]);

    const isInvoiceDoc = useMemo(() => {
        if (documentType === 'invoice' || documentType === 'receipt') return true;
        if (documentType === 'proposal') return false;
        const lowerTitle = (title || '').toLowerCase();
        return lowerTitle.includes('invoice') || lowerTitle.includes('receipt') || (lowerTitle.includes('reminder') && !lowerTitle.includes('proposal'));
    }, [documentType, title]);

    const isImpact = useMemo(() => {
        return isImpactCustomer(customer, customer?.name);
    }, [customer]);

    const contactsList = useMemo(() => {
        const list: DisplayContact[] = [];
        if (!customer && !customerId) return list;

        // Check if McAlisters from TekAir
        const isTekAir = state.currentOrganization?.id === 'org-1765817997819' || 
                         state.currentOrganization?.name?.toLowerCase().includes('tekair');
        const isMcAlisters = customer?.name?.toLowerCase().includes('mcalister') || 
                             customer?.name?.toLowerCase().includes('best choice');

        if (isTekAir && isMcAlisters) {
            list.push({
                id: 'sunholding-submission-poc',
                name: 'Sunholding Invoice Submission',
                email: 'Mcalistersflapsun@onepayinvoices.com',
                role: t('Required AP Submission Portal'),
                type: 'billing'
            });
        }

        // Standard Impact Corporate Emails
        if (isImpact) {
            list.push({
                id: 'impact-invoicing-poc',
                name: 'Impact Invoicing (Bill Submissions)',
                email: IMPACT_GENERAL_INFO.invoicingEmail,
                role: 'Vendor Bill Submissions Only',
                type: 'billing'
            });
            list.push({
                id: 'impact-vendor-admin-poc',
                name: 'Impact Vendor Admin',
                email: IMPACT_GENERAL_INFO.vendorAdminEmail,
                role: 'Vendor Statements & Payments',
                type: 'billing'
            });
            list.push({
                id: 'impact-marico-betonio',
                name: IMPACT_MARICO_BETONIO.name,
                email: IMPACT_MARICO_BETONIO.email,
                role: 'Vendor Management / Project Coordinator',
                type: 'general'
            });
            list.push({
                id: 'impact-dispatch-poc',
                name: 'Impact Dispatch',
                email: IMPACT_GENERAL_INFO.dispatchEmail,
                role: 'Dispatch & Work Orders',
                type: 'general'
            });
        }

        // 1. Billing POCs
        if (customer?.email) {
            if (!list.some(existing => existing.email.toLowerCase() === customer.email.toLowerCase())) {
                list.push({
                    id: `billing-primary-${customer.email}`,
                    name: customer.name || t('Primary Customer'),
                    email: customer.email,
                    role: t('Primary Billing POC'),
                    type: 'billing'
                });
            }
        }
        if (customer?.billingContact?.email) {
            if (!list.some(existing => existing.email.toLowerCase() === customer.billingContact.email.toLowerCase())) {
                list.push({
                    id: `billing-contact-${customer.billingContact.email}`,
                    name: customer.billingContact.name || t('Billing Contact'),
                    email: customer.billingContact.email,
                    role: t('Billing POC'),
                    type: 'billing'
                });
            }
        }

        // 2. Store POCs
        // Resolve target location from serviceLocation or match by locationId/locationName in customer.serviceLocations
        const resolvedLocation = serviceLocation || (
            locationId || locationName ? (customer?.serviceLocations || []).find((loc: any) => 
                (locationId && (loc.id === locationId || loc.storeNumber === locationId)) ||
                (locationName && (
                    loc.name?.toLowerCase() === locationName.toLowerCase() ||
                    loc.propertyName?.toLowerCase() === locationName.toLowerCase() ||
                    loc.address?.toLowerCase().includes(locationName.toLowerCase()) ||
                    locationName.toLowerCase().includes(loc.name?.toLowerCase() || '___')
                ))
            ) : null
        );
        const activeLocationId = resolvedLocation?.id || locationId;
        const targetLoc = resolvedLocation || serviceLocation;

        // Contacts with allowedLocationIds or assignedLocationIds matching locationId
        if (customer?.contacts && Array.isArray(customer.contacts)) {
            customer.contacts.forEach((c: any) => {
                if (c.email && c.name) {
                    const isStorePoc = activeLocationId && (
                        c.allowedLocationIds?.includes(activeLocationId) ||
                        c.assignedLocationIds?.includes(activeLocationId)
                    );
                    if (isStorePoc) {
                        if (!list.some(existing => existing.email.toLowerCase() === c.email.toLowerCase())) {
                            list.push({
                                id: `store-poc-${c.id || c.email}`,
                                name: c.name,
                                email: c.email,
                                role: c.title || c.role || t('Site POC'),
                                type: 'store'
                            });
                        }
                    }
                }
            });
        }

        // Location embedded contacts
        if (targetLoc?.contacts && Array.isArray(targetLoc.contacts)) {
            targetLoc.contacts.forEach((c: any) => {
                if (c.email && c.name) {
                    if (!list.some(existing => existing.email.toLowerCase() === c.email.toLowerCase())) {
                        list.push({
                            id: `location-contact-${c.id || c.email}`,
                            name: c.name,
                            email: c.email,
                            role: c.role || c.title || t('Site POC'),
                            type: 'store'
                        });
                    }
                }
            });
        }

        // Location account manager
        const locAm = (targetLoc as any)?.accountManager;
        if (locAm?.email && locAm.name) {
            if (!list.some(existing => existing.email.toLowerCase() === locAm.email.toLowerCase())) {
                list.push({
                    id: `location-am-${locAm.email}`,
                    name: locAm.name,
                    email: locAm.email,
                    role: 'Account Manager',
                    type: 'store'
                });
            }
        }

        // Fallback matrix resolution for Impact brands
        if (isImpact && (serviceLocation || locationId || locationName)) {
            const resolved = resolveImpactContactsForLocation(
                serviceLocation?.name || locationName || locationId || '',
                serviceLocation?.storeNumber
            );
            if (resolved.accountManager?.email) {
                if (!list.some(existing => existing.email.toLowerCase() === resolved.accountManager!.email.toLowerCase())) {
                    list.push({
                        id: `resolved-am-${resolved.accountManager.email}`,
                        name: resolved.accountManager.name,
                        email: resolved.accountManager.email,
                        role: `Account Manager${resolved.matchedBrand ? ` (${resolved.matchedBrand})` : ''}`,
                        type: 'store'
                    });
                }
            }
            if (resolved.projectCoordinator?.email) {
                if (!list.some(existing => existing.email.toLowerCase() === resolved.projectCoordinator!.email.toLowerCase())) {
                    list.push({
                        id: `resolved-pc-${resolved.projectCoordinator.email}`,
                        name: resolved.projectCoordinator.name,
                        email: resolved.projectCoordinator.email,
                        role: `Project Coordinator${resolved.matchedBrand ? ` (${resolved.matchedBrand})` : ''}`,
                        type: 'store'
                    });
                }
            }
        }

        // 3. General Contacts (not matching locationId)
        if (customer?.contacts && Array.isArray(customer.contacts)) {
            customer.contacts.forEach((c: any) => {
                if (c.email && c.name) {
                    if (!list.some(existing => existing.email.toLowerCase() === c.email.toLowerCase())) {
                        list.push({
                            id: `general-poc-${c.id || c.email}`,
                            name: c.name,
                            email: c.email,
                            role: c.title || c.role || t('General Contact'),
                            type: 'general'
                        });
                    }
                }
            });
        }

        return list;
    }, [customer, customerId, serviceLocation, locationId, locationName, isImpact, t, state.currentOrganization]);

    // Initialize/Default selections
    React.useEffect(() => {
        if (isOpen) {
            // Check if McAlisters from TekAir
            const isTekAir = state.currentOrganization?.id === 'org-1765817997819' || 
                             state.currentOrganization?.name?.toLowerCase().includes('tekair');
            const isMcAlisters = customer?.name?.toLowerCase().includes('mcalister') || 
                                 customer?.name?.toLowerCase().includes('best choice');

            let defaults: string[] = [];
            if (isTekAir && isMcAlisters) {
                defaults = ['Mcalistersflapsun@onepayinvoices.com'];
            } else if (isImpact) {
                // Impact-specific default selection rules:
                // Rule 1: When sending a document related to their stores, select the correct person (store POCs) by default
                const storeEmails = contactsList
                    .filter(c => c.type === 'store')
                    .map(c => c.email.toLowerCase());
                
                storeEmails.forEach(em => {
                    if (!defaults.some(d => d.toLowerCase() === em)) {
                        defaults.push(em);
                    }
                });

                // Rule 2: Include Marico by default on all Impact documents
                const maricoEmail = IMPACT_MARICO_BETONIO.email.toLowerCase();
                if (!defaults.some(d => d.toLowerCase() === maricoEmail)) {
                    defaults.push(maricoEmail);
                }

                // Rule 3: Include invoicing email by default on all invoices
                if (isInvoiceDoc) {
                    const invEmail = IMPACT_GENERAL_INFO.invoicingEmail.toLowerCase();
                    if (!defaults.some(d => d.toLowerCase() === invEmail)) {
                        defaults.push(invEmail);
                    }
                }
            } else {
                // Universal default selection for all other customers / organizations:
                // Rule 1: When sending a document related to a store/location, select all linked store POCs by default
                const hasStoreContext = Boolean(serviceLocation || locationId || locationName);
                if (hasStoreContext) {
                    const storeEmails = contactsList
                        .filter(c => c.type === 'store')
                        .map(c => c.email.toLowerCase());
                    storeEmails.forEach(em => {
                        if (!defaults.some(d => d.toLowerCase() === em)) {
                            defaults.push(em);
                        }
                    });
                }

                // Rule 2: For invoices, also include billing contacts / primary customer email by default
                const billingEmails = contactsList
                    .filter(c => c.type === 'billing')
                    .map(c => c.email.toLowerCase());

                if (isInvoiceDoc) {
                    billingEmails.forEach(em => {
                        if (!defaults.some(d => d.toLowerCase() === em)) {
                            defaults.push(em);
                        }
                    });
                } else if (defaults.length === 0) {
                    // For non-invoices, fallback to billing contacts if no store POCs were linked
                    billingEmails.forEach(em => {
                        if (!defaults.some(d => d.toLowerCase() === em)) {
                            defaults.push(em);
                        }
                    });
                }

                // Fallback: if still empty, select first available contact
                if (defaults.length === 0 && contactsList.length > 0) {
                    defaults.push(contactsList[0].email);
                }
            }
            setSelectedEmails(defaults);
            setCustomContacts([]);
            setCustomName('');
            setCustomEmail('');
            setAttachPdf(defaultAttachPdf);
        }
    }, [isOpen, contactsList, customer, state.currentOrganization, defaultAttachPdf, isImpact, isInvoiceDoc]);

    const handleToggleSelect = (email: string) => {
        const lower = email.toLowerCase();
        setSelectedEmails(prev => 
            prev.some(e => e.toLowerCase() === lower) 
                ? prev.filter(e => e.toLowerCase() !== lower) 
                : [...prev, email]
        );
    };

    const handleAddCustom = () => {
        if (!customEmail) {
            showToast.warn(t('Please enter a valid email.'));
            return;
        }
        const trimmedEmail = customEmail.trim().toLowerCase();
        if (contactsList.some(c => c.email.toLowerCase() === trimmedEmail) || customContacts.some(c => c.email.toLowerCase() === trimmedEmail)) {
            showToast.warn(t('This email is already in the list.'));
            return;
        }
        const newContact: DisplayContact = {
            id: `custom-${Date.now()}`,
            name: customName.trim() || t('Custom Recipient'),
            email: trimmedEmail,
            role: t('Custom Recipient'),
            type: 'custom'
        };
        setCustomContacts(prev => [...prev, newContact]);
        setSelectedEmails(prev => [...prev, trimmedEmail]);
        setCustomName('');
        setCustomEmail('');
    };

    const handleConfirm = () => {
        if (selectedEmails.length === 0) {
            showToast.warn(t('Please select at least one recipient.'));
            return;
        }
        onConfirm(selectedEmails, attachPdf);
    };

    const billingContacts = contactsList.filter(c => c.type === 'billing');
    const storeContacts = contactsList.filter(c => c.type === 'store');
    const generalContacts = contactsList.filter(c => c.type === 'general');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="md" zIndex="z-[10060]">
            <div className="space-y-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('Choose who you want to send this email to. You can select multiple recipients.')}
                </p>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Billing POCs Section */}
                    {billingContacts.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                                💳 {t('Billing POCs')}
                            </h4>
                            <div className="space-y-2">
                                {billingContacts.map(c => (
                                    <ContactRow 
                                        key={c.id} 
                                        contact={c} 
                                        selected={selectedEmails.some(e => e.toLowerCase() === c.email.toLowerCase())} 
                                        onToggle={handleToggleSelect} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Store POCs Section */}
                    {storeContacts.length > 0 && (
                        <div className="pt-2">
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                                🏬 {t('Store / Location POCs')}
                            </h4>
                            <div className="space-y-2">
                                {storeContacts.map(c => (
                                    <ContactRow 
                                        key={c.id} 
                                        contact={c} 
                                        selected={selectedEmails.some(e => e.toLowerCase() === c.email.toLowerCase())} 
                                        onToggle={handleToggleSelect} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* General Contacts Section */}
                    {generalContacts.length > 0 && (
                        <div className="pt-2">
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                                👤 {t('General Contacts')}
                            </h4>
                            <div className="space-y-2">
                                {generalContacts.map(c => (
                                    <ContactRow 
                                        key={c.id} 
                                        contact={c} 
                                        selected={selectedEmails.some(e => e.toLowerCase() === c.email.toLowerCase())} 
                                        onToggle={handleToggleSelect} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Recipients Section */}
                    {customContacts.length > 0 && (
                        <div className="pt-2">
                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                                ➕ {t('Custom Recipients')}
                            </h4>
                            <div className="space-y-2">
                                {customContacts.map(c => (
                                    <ContactRow 
                                        key={c.id} 
                                        contact={c} 
                                        selected={selectedEmails.some(e => e.toLowerCase() === c.email.toLowerCase())} 
                                        onToggle={handleToggleSelect} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {billingContacts.length === 0 && storeContacts.length === 0 && generalContacts.length === 0 && (
                        <div className="text-center py-6 text-sm text-slate-400 italic">
                            {t('No saved contacts found for this customer.')}
                        </div>
                    )}
                </div>

                {/* Add Custom Input */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3">
                        ➕ {t('Add Custom Recipient')}
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                        <Input 
                            label={t('Name (Optional)')}
                            placeholder={t('e.g. John Doe')}
                            value={customName}
                            onChange={e => setCustomName(e.target.value)}
                        />
                        <Input 
                            label={t('Email Address')}
                            type="email"
                            placeholder={t('e.g. john@example.com')}
                            value={customEmail}
                            onChange={e => setCustomEmail(e.target.value)}
                        />
                    </div>
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={handleAddCustom}
                        className="text-xs w-full py-2 flex items-center justify-center gap-1.5"
                    >
                        <Plus size={14} /> {t('Add to Recipients')}
                    </Button>
                </div>

                {/* PDF Attachment Option */}
                {showPdfOption && (
                    <div className="p-3 bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Paperclip size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                            <div>
                                <span className="text-xs font-bold text-purple-900 dark:text-purple-200 block">
                                    {t("Attach Document as PDF File (Customer Request)")}
                                </span>
                                <span className="text-[10px] text-purple-700/80 dark:text-purple-300/80 block">
                                    {t("Generates and attaches printable PDF copy along with this email")}
                                </span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={attachPdf}
                            onChange={(e) => setAttachPdf(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <Button variant="secondary" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button onClick={handleConfirm} disabled={selectedEmails.length === 0}>
                        {t('Confirm & Send')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

interface ContactRowProps {
    contact: DisplayContact;
    selected: boolean;
    onToggle: (email: string) => void;
}

const ContactRow: React.FC<ContactRowProps> = ({ contact, selected, onToggle }) => {
    return (
        <label 
            onClick={() => onToggle(contact.email)}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                selected 
                    ? 'bg-primary-50/50 border-primary-500/30 dark:bg-primary-950/20 dark:border-primary-500/40 shadow-sm' 
                    : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700/50'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                    selected 
                        ? 'bg-primary-500 text-white' 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                    <User size={16} />
                </div>
                <div className="text-left">
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {contact.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {contact.email}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className={`text-[9px] uppercase px-2 py-0.5 rounded font-black tracking-wide ${
                    contact.type === 'billing' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : contact.type === 'store'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                    {contact.role}
                </span>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    selected 
                        ? 'bg-primary-600 border-primary-600 text-white' 
                        : 'border-slate-300 dark:border-slate-600'
                }`}>
                    {selected && <Check size={12} strokeWidth={3} />}
                </div>
            </div>
        </label>
    );
};

export default RecipientSelectorModal;
