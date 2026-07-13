
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

const TRADES = ['Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Painting', 'Roofing', 'Drywall', 'Flooring', 'Tiling'];

const AddSubcontractorModal: React.FC<AddSubcontractorModalProps> = ({ isOpen, onClose, onSave, subcontractor, onInvite }) => {
    const [companyName, setCompanyName] = useState('');
    const [contactName, setContactName] = useState('');
    const [trade, setTrade] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [paymentType, setPaymentType] = useState<'perJob' | 'percentage'>('perJob');
    const [paymentPercentage, setPaymentPercentage] = useState<number | undefined>(undefined);
    const [linkedOrgId, setLinkedOrgId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && subcontractor) {
            setCompanyName(subcontractor.companyName || '');
            setContactName(subcontractor.contactName || '');
            setTrade(subcontractor.trade || '');
            setEmail(subcontractor.email || '');
            setPhone(subcontractor.phone || '');
            setPaymentType(subcontractor.paymentType || 'perJob');
            setPaymentPercentage(subcontractor.paymentPercentage);
            setLinkedOrgId(subcontractor.linkedOrgId || '');
        } else {
            // Reset form when opening for a new entry or closing
            setCompanyName('');
            setContactName('');
            setTrade('');
            setEmail('');
            setPhone('');
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
            companyName,
            contactName,
            trade,
            email,
            phone,
            paymentType,
            paymentPercentage: paymentType === 'percentage' ? paymentPercentage : null,
            linkedOrgId: linkedOrgId || null,
        };

        await onSave(subData);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={subcontractor ? "Manage Subcontractor" : "Add New Subcontractor"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                <Input label="Contact Name" value={contactName} onChange={e => setContactName(e.target.value)} />
                <Select label="Trade" value={trade} onChange={e => setTrade(e.target.value)} required>
                    <option value="">Select a trade</option>
                    {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    {onInvite && email && !linkedOrgId && (
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => onInvite(email, true)} 
                            className="mb-1 h-[42px] bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                            title="Send them an email invitation to join TekTrakker natively"
                        >
                            Send Invite
                        </Button>
                    )}
                </div>
                <Input label="Phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                <Input 
                    label="Handshake ID (Optional)"
                    value={linkedOrgId}
                    onChange={e => setLinkedOrgId(e.target.value)}
                    placeholder="Enter partner's organization ID"
                />
                
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <h3 className="text-sm font-bold mb-2">Payable Rules</h3>
                    <Select label="Payment Type" value={paymentType} onChange={e => setPaymentType(e.target.value as 'perJob' | 'percentage')}>
                        <option value="perJob">Per Job (Fixed Rate)</option>
                        <option value="percentage">Percentage of Job</option>
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

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
                </div>
            </form>
        </Modal>
    );
};

export default AddSubcontractorModal;
