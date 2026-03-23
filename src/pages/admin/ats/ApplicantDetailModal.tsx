
import React from 'react';
import Modal from 'components/ui/Modal';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import Button from 'components/ui/Button';
import { Trash2, XCircle, Mail, UserPlus } from 'lucide-react';
import type { Applicant } from 'types';

interface ApplicantDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    applicant: Applicant | null;
    onUpdateStatus: (status: Applicant['status']) => void;
    onDelete: () => void;
    onSaveNotes: (notes: string) => void;
    onOffer: () => void;
    onHire: () => void;
    statusCols: string[];
}

const ApplicantDetailModal: React.FC<ApplicantDetailModalProps> = ({ 
    isOpen, onClose, applicant, onUpdateStatus, onDelete, onSaveNotes, onOffer, onHire, statusCols
}) => {
    if (!applicant) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Applicant Details" size="lg">
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{applicant.name || `${applicant.firstName} ${applicant.lastName}`}</h2>
                        <p className="text-primary-600 dark:text-primary-400 font-medium">{applicant.position}</p>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex gap-4">
                            <a href={`mailto:${applicant.email}`} className="hover:underline">{applicant.email}</a>
                            <a href={`tel:${applicant.phone}`} className="hover:underline">{applicant.phone}</a>
                        </div>
                    </div>
                    <Select 
                        value={applicant.status} 
                        onChange={e => onUpdateStatus(e.target.value as Applicant['status'])} 
                        className="w-40 mb-0"
                    >
                        {statusCols.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                </div>

                <div>
                    <h4 className="font-bold text-sm mb-2 text-gray-800 dark:text-gray-200">Notes</h4>
                    <Textarea 
                        className="min-h-[120px] bg-white dark:bg-gray-700"
                        placeholder="Add interview notes, comments, etc..."
                        defaultValue={applicant.notes || ''}
                        onBlur={e => onSaveNotes(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50" onClick={onDelete}>
                        <Trash2 size={16}/>
                    </Button>
                    <Button variant="secondary" onClick={() => onUpdateStatus('Declined')}>
                        <XCircle size={16} className="mr-2"/> Decline
                    </Button>
                    <Button onClick={onOffer}>
                        <Mail size={16} className="mr-2"/> Offer
                    </Button>
                    <Button variant="primary" onClick={onHire}>
                        <UserPlus size={16} className="mr-2"/> Hire
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ApplicantDetailModal;
