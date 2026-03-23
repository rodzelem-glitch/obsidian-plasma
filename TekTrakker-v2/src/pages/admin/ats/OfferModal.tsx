
import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import { Eye } from 'lucide-react';
import type { Applicant, Organization } from 'types';

interface OfferModalProps {
    isOpen: boolean;
    onClose: () => void;
    applicant: Applicant | null;
    organization: Organization | null;
    onSendOffer: (details: OfferDetails) => void;
}

export interface OfferDetails {
    rate: string;
    type: string;
    startDate: string;
    supervisor: string;
}

const OfferModal: React.FC<OfferModalProps> = ({ isOpen, onClose, applicant, organization, onSendOffer }) => {
    const [details, setDetails] = useState<OfferDetails>({ rate: '', type: 'Hourly', startDate: '', supervisor: '' });
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    const generateOfferHtml = () => {
        if (!applicant || !organization) return '';
        const orgName = organization.name;
        const logoHtml = organization.logoUrl ? `<img src="${organization.logoUrl}" style="max-height: 60px; margin-bottom: 20px;" alt="${orgName}"/>` : `<h1>${orgName}</h1>`;
        const name = applicant.name || `${applicant.firstName} ${applicant.lastName}`;

        return `
            <div style="font-family: sans-serif; padding: 30px; border: 1px solid #eee; max-width: 600px; margin: auto;">
                ${logoHtml}
                <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Employment Offer</h2>
                <p>Dear ${name},</p>
                <p>We are pleased to offer you the position of <strong>${applicant.position}</strong> at ${orgName}.</p>
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                    <p><strong>Start Date:</strong> ${details.startDate || 'TBD'}</p>
                    <p><strong>Compensation:</strong> $${details.rate || '[Rate]'} / ${details.type}</p>
                    <p><strong>Reporting To:</strong> ${details.supervisor || '[Supervisor]'}</p>
                </div>
                <p>This offer is contingent upon successful completion of any background checks and verification of your employment eligibility.</p>
                <p>Please reply to this email to accept or decline this offer.</p>
                <br/>
                <p>Sincerely,<br>The ${orgName} Team</p>
            </div>
        `;
    };

    const handlePreview = () => {
        setPreviewHtml(generateOfferHtml());
    };

    const handleSend = () => {
        onSendOffer(details);
        onClose();
        setPreviewHtml(null);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Generate Offer for ${applicant?.name || '...'}`}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                        label="Pay Rate" 
                        type="number" 
                        value={details.rate} 
                        onChange={e => setDetails({...details, rate: e.target.value})} 
                        placeholder="e.g. 25.00" 
                    />
                    <Select 
                        label="Pay Type" 
                        value={details.type} 
                        onChange={e => setDetails({...details, type: e.target.value})}
                        className="mb-0"
                    >
                        <option>Hourly</option>
                        <option>Salary (Annual)</option>
                    </Select>
                </div>
                <Input 
                    label="Anticipated Start Date" 
                    type="date" 
                    value={details.startDate} 
                    onChange={e => setDetails({...details, startDate: e.target.value})} 
                />
                <Input 
                    label="Direct Supervisor" 
                    value={details.supervisor} 
                    onChange={e => setDetails({...details, supervisor: e.target.value})} 
                    placeholder="e.g. Jane Doe"
                />
                
                {previewHtml && (
                    <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 p-4 rounded-lg max-h-48 overflow-y-auto text-xs">
                        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="secondary" onClick={handlePreview}>
                        <Eye size={16} className="mr-2"/> Preview Email
                    </Button>
                    <Button onClick={handleSend}>Send Offer</Button>
                </div>
            </div>
        </Modal>
    );
};

export default OfferModal;
