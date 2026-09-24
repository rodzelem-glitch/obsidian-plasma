
import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useAppContext } from 'context/AppContext';
import type { Subcontractor } from '../../types';

interface AddSubcontractorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (subcontractor: Partial<Subcontractor>) => void;
    subcontractor: Partial<Subcontractor> | null;
    onInvite?: (email: string, withDiscount: boolean) => void; // Optional invite function
}

const TRADES = ['HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General', 'Cleaning', 'Painting', 'Roofing', 'Contracting', 'Masonry', 'Telecommunications', 'Solar', 'Security', 'Pet Grooming'];

const AddSubcontractorModal: React.FC<AddSubcontractorModalProps> = ({ isOpen, onClose, onSave, subcontractor, onInvite }) => {
    const [companyName, setCompanyName] = useState('');
    const [contactName, setContactName] = useState('');
    const [trade, setTrade] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');
    const [taxId, setTaxId] = useState('');
    const [address, setAddress] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [isSubscribedToTekTrakker, setIsSubscribedToTekTrakker] = useState(false);
    const [paymentType, setPaymentType] = useState<'perJob' | 'percentage'>('perJob');
    const [paymentPercentage, setPaymentPercentage] = useState<number | undefined>(undefined);
    const [linkedOrgId, setLinkedOrgId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && subcontractor) {
            setCompanyName(subcontractor.companyName || (subcontractor as any).name || '');
            setContactName(subcontractor.contactName || '');
            setTrade(subcontractor.trade || 'HVAC');
            setEmail(subcontractor.email || '');
            setPhone(subcontractor.phone || '');
            setLicenseNumber(subcontractor.licenseNumber || '');
            setTaxId((subcontractor as any).taxId || '');
            setAddress((subcontractor as any).address || '');
            setIsInternal(!!(subcontractor as any).isInternal);
            setIsSubscribedToTekTrakker(!!(subcontractor as any).isSubscribedToTekTrakker);
            setPaymentType(subcontractor.paymentType || 'perJob');
            setPaymentPercentage(subcontractor.paymentPercentage);
            setLinkedOrgId(subcontractor.linkedOrgId || '');
        } else {
            // Reset form when opening for a new entry or closing
            setCompanyName('');
            setContactName('');
            setTrade('HVAC');
            setEmail('');
            setPhone('');
            setLicenseNumber('');
            setTaxId('');
            setAddress('');
            setIsInternal(false);
            setIsSubscribedToTekTrakker(false);
            setPaymentType('perJob');
            setPaymentPercentage(undefined);
            setLinkedOrgId('');
        }
    }, [isOpen, subcontractor]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const subData: Partial<Subcontractor> = {
            ...subcontractor,
            name: companyName || contactName || 'Subcontractor',
            companyName: companyName || contactName || 'Subcontractor',
            contactName: contactName || companyName || 'Subcontractor',
            trade: trade || 'HVAC',
            email,
            phone,
            licenseNumber,
            taxId,
            address,
            isInternal,
            isSubscribedToTekTrakker,
            type: isInternal ? 'internal' : 'external',
            paymentType,
            paymentPercentage: paymentType === 'percentage' ? paymentPercentage : null,
            linkedOrgId: linkedOrgId || null,
        };

        await onSave(subData);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={subcontractor ? "Manage Subcontractor Details" : "Add New Subcontractor"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select label="Subcontractor Classification" value={isInternal ? 'internal' : 'external'} onChange={e => setIsInternal(e.target.value === 'internal')}>
                        <option value="external">External 1099 Subcontractor / Vendor</option>
                        <option value="internal">Internal 1099 Subcontractor (Workforce)</option>
                    </Select>

                    <Select label="TekTrakker Account &amp; Subscription Status" value={isSubscribedToTekTrakker ? 'subscribed' : 'no_login'} onChange={e => setIsSubscribedToTekTrakker(e.target.value === 'subscribed')}>
                        <option value="no_login">No TekTrakker Login (Free Email &amp; Web Dispatches)</option>
                        <option value="subscribed">Subscribed TekTrakker Partner Account</option>
                    </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input label="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. AdvantiAir" required />
                    <Input label="Contact Person Name" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. John Kendrick" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select label="Trade Specialty" value={trade} onChange={e => setTrade(e.target.value)} required>
                        <option value="">Select a trade</option>
                        {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                    <Input label="License Number" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="e.g. TACLA00127179E" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input label="Tax ID / SSN / EIN" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="e.g. 12-3456789" />
                    <Input label="Phone Number" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(210) 318-4197" />
                </div>

                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Input label="Subcontractor Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    {onInvite && email && !linkedOrgId && (
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => onInvite(email, true)} 
                            className="mb-1 h-[42px] bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-bold"
                            title="Send them an email invitation to join TekTrakker natively"
                        >
                            Send Invite
                        </Button>
                    )}
                </div>

                <Input label="Business Address" value={address} onChange={e => setAddress(e.target.value)} placeholder="2618 Middleground, San Antonio, TX 78245" />

                <Input 
                    label="Handshake / Partner Org ID (Optional)"
                    value={linkedOrgId}
                    onChange={e => setLinkedOrgId(e.target.value)}
                    placeholder="Enter partner's organization ID"
                />
                
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">Payable & Payout Rules</h3>
                    <Select label="Payment Type" value={paymentType} onChange={e => setPaymentType(e.target.value as 'perJob' | 'percentage')}>
                        <option value="perJob">Per Job (Fixed Rate / NTE)</option>
                        <option value="percentage">Percentage of Job Amount</option>
                    </Select>
                    {paymentType === 'percentage' && (
                        <Input 
                            label="Payment Percentage (%)" 
                            type="number" 
                            value={paymentPercentage || ''} 
                            onChange={e => setPaymentPercentage(Number(e.target.value))} 
                            placeholder="e.g., 40"
                            required 
                        />
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Subcontractor Details'}</Button>
                </div>
            </form>
        </Modal>
    );
};

export default AddSubcontractorModal;
