
import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import { Eye } from 'lucide-react';
import type { Applicant, Organization } from 'types';
import { useLanguage } from 'context/LanguageContext';

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
    const [showPreview, setShowPreview] = useState(false);
    const { t } = useLanguage();

    const OfferPreview = () => {
        if (!applicant || !organization) return null;
        const orgName = organization.name;
        const name = applicant.name || `${applicant.firstName} ${applicant.lastName}`;

        return (
            <div style={{ fontFamily: 'sans-serif', padding: '30px', border: '1px solid #eee', maxWidth: '600px', margin: 'auto' }}>
                {organization.logoUrl ? (
                    <img src={organization.logoUrl} style={{ maxHeight: '60px', marginBottom: '20px' }} alt={orgName} />
                ) : (
                    <h1>{orgName}</h1>
                )}
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{t("Employment Offer")}</h2>
                <p>{t("Dear")} {name},</p>
                <p>{t("We are pleased to offer you the position of")} <strong>{t(applicant.position)}</strong> {t("at")} {orgName}.</p>
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', margin: '20px 0', border: '1px solid #e5e7eb' }}>
                    <p><strong>{t("Start Date:")}</strong> {details.startDate || t('TBD')}</p>
                    <p><strong>{t("Compensation:")}</strong> ${details.rate || '[Rate]'} / {t(details.type)}</p>
                    <p><strong>{t("Reporting To:")}</strong> {details.supervisor || '[Supervisor]'}</p>
                </div>
                <p>{t("This offer is contingent upon successful completion of any background checks and verification of your employment eligibility.")}</p>
                <p>{t("Please reply to this email to accept or decline this offer.")}</p>
                <br/>
                <p>{t("Sincerely,")}<br/>{t("The Team at")} {orgName}</p>
            </div>
        );
    };

    const handlePreview = () => {
        setShowPreview(true);
    };

    const handleSend = () => {
        onSendOffer(details);
        onClose();
        setShowPreview(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t("Generate Offer for {name}", { name: applicant?.name || '...' })}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input 
                        label={t("Pay Rate")} 
                        type="number" 
                        value={details.rate} 
                        onChange={e => setDetails({...details, rate: e.target.value})} 
                        placeholder={t("e.g. 25.00")} 
                    />
                    <Select 
                        label={t("Pay Type")} 
                        value={details.type} 
                        onChange={e => setDetails({...details, type: e.target.value})}
                        className="mb-0"
                    >
                        <option value="Hourly">{t("Hourly")}</option>
                        <option value="Salary (Annual)">{t("Salary (Annual)")}</option>
                    </Select>
                </div>
                <Input 
                    label={t("Anticipated Start Date")} 
                    type="date" 
                    value={details.startDate} 
                    onChange={e => setDetails({...details, startDate: e.target.value})} 
                />
                <Input 
                    label={t("Direct Supervisor")} 
                    value={details.supervisor} 
                    onChange={e => setDetails({...details, supervisor: e.target.value})} 
                    placeholder={t("e.g. Jane Doe")}
                />
                
                {showPreview && (
                    <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 p-4 rounded-lg max-h-48 overflow-y-auto text-xs text-slate-800 dark:text-slate-200">
                        <OfferPreview />
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="secondary" onClick={handlePreview}>
                        <Eye size={16} className="mr-2"/> {t("Preview Email")}
                    </Button>
                    <Button onClick={handleSend}>{t("Send Offer")}</Button>
                </div>
            </div>
        </Modal>
    );
};

export default OfferModal;
