import React from 'react';
import Modal from 'components/ui/Modal';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import Button from 'components/ui/Button';
import { 
    Trash2, 
    XCircle, 
    Mail, 
    UserPlus, 
    FileText, 
    Download,
    Briefcase,
    DollarSign,
    User,
    Award,
    MapPin,
    CheckCircle
} from 'lucide-react';
import type { Applicant } from 'types';
import { useLanguage } from 'context/LanguageContext';

const AVAILABILITY_MAP: Record<string, string> = {
    WeekdayMorning: "Weekday Mornings (M-F)",
    WeekdayAfternoon: "Weekday Afternoons (M-F)",
    WeekdayEvening: "Weekday Evenings (M-F)",
    WeekendMorning: "Weekend Mornings",
    WeekendAfternoon: "Weekend Afternoons",
    WeekendEvening: "Weekend Evenings"
};

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
    const { t } = useLanguage();
    if (!applicant) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t("Applicant Details")} size="lg">
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{applicant.name || `${applicant.firstName} ${applicant.lastName}`}</h2>
                        <p className="text-primary-600 dark:text-primary-400 font-medium">{t(applicant.position)}</p>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex gap-4">
                            <a href={`mailto:${applicant.email}`} className="hover:underline">{applicant.email}</a>
                            <a href={`tel:${applicant.phone}`} className="hover:underline">{applicant.phone}</a>
                        </div>
                        
                        {(applicant.resumeUrl || applicant.resumeDataUrl) && (
                            <a 
                                href={applicant.resumeUrl || applicant.resumeDataUrl} 
                                download={applicant.resumeFileName || `${applicant.firstName || 'Applicant'}_Resume`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <FileText size={16} />
                                <span className="truncate max-w-[200px]">{applicant.resumeFileName || t('View Uploaded Resume')}</span>
                                <Download size={16} className="ml-1" />
                            </a>
                        )}
                    </div>
                    <Select 
                        value={applicant.status} 
                        onChange={e => onUpdateStatus(e.target.value as Applicant['status'])} 
                        className="w-40 mb-0"
                    >
                        {statusCols.map(s => <option key={s} value={s}>{t(s)}</option>)}
                    </Select>
                </div>

                {/* Application Overview */}
                <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-4">
                    <h3 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-250 dark:border-gray-700/80 pb-2">
                        {t("Application Details")}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex items-start gap-2.5">
                            <Briefcase className="text-gray-400 dark:text-gray-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("Experience")}</span>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {applicant.experienceYears ? `${applicant.experienceYears} ${t("Years")}` : t("Not specified")}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <DollarSign className="text-gray-400 dark:text-gray-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("Desired Salary")}</span>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {applicant.desiredSalary ? (
                                        typeof applicant.desiredSalary === 'number' 
                                            ? `$${applicant.desiredSalary.toLocaleString()}` 
                                            : applicant.desiredSalary
                                    ) : t("Not specified")}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <User className="text-gray-400 dark:text-gray-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("Referred By")}</span>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {applicant.referredBy || t("Direct / None")}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <CheckCircle className="text-gray-400 dark:text-gray-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("Work Authorized")}</span>
                                <span className={`text-sm font-semibold ${
                                    applicant.workAuthorized === true 
                                        ? 'text-emerald-600 dark:text-emerald-400' 
                                        : applicant.workAuthorized === false 
                                            ? 'text-red-600 dark:text-red-400' 
                                            : 'text-gray-800 dark:text-gray-200'
                                }`}>
                                    {applicant.workAuthorized === true ? t("Yes") : applicant.workAuthorized === false ? t("No") : t("Not specified")}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <Award className="text-gray-400 dark:text-gray-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("Driver's License")}</span>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {applicant.driversLicense || t("Not specified")}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <Award className="text-gray-400 dark:text-gray-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("Licenses/Cert.")}</span>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {applicant.license || t("None")}
                                </span>
                            </div>
                        </div>
                    </div>

                    {applicant.address && (
                        <div className="flex items-start gap-2.5 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                            <MapPin className="text-gray-400 dark:text-gray-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t("Address")}</span>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {applicant.address}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Skills tags */}
                {applicant.skills && applicant.skills.length > 0 && (
                    <div>
                        <h4 className="font-bold text-sm mb-2 text-gray-800 dark:text-gray-200">{t("Skills & Qualifications")}</h4>
                        <div className="flex flex-wrap gap-2">
                            {applicant.skills.map((skill, idx) => (
                                <span key={idx} className="px-2.5 py-1 text-xs font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800/40">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Availability Section */}
                {applicant.availability && applicant.availability.length > 0 && (
                    <div>
                        <h4 className="font-bold text-sm mb-2 text-gray-800 dark:text-gray-200">{t("Availability")}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(AVAILABILITY_MAP).map(([key, label]) => {
                                const isAvailable = applicant.availability?.includes(key);
                                return (
                                    <div 
                                        key={key} 
                                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-colors ${
                                            isAvailable 
                                                ? 'bg-emerald-50 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40' 
                                                : 'bg-gray-50/50 dark:bg-gray-900/10 text-gray-450 dark:text-gray-550 border-gray-200 dark:border-gray-800/20'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
                                        {t(label)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* SMS Consent status */}
                {applicant.smsOptIn !== undefined && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${applicant.smsOptIn ? 'text-primary-600 dark:text-primary-400' : 'text-gray-350 dark:text-gray-650'}`} />
                        <span>
                            {applicant.smsOptIn 
                                ? t("Applicant consented to receive SMS updates regarding their application.") 
                                : t("Applicant did not opt-in for SMS notifications.")}
                        </span>
                    </div>
                )}

                <div>
                    <h4 className="font-bold text-sm mb-2 text-gray-800 dark:text-gray-200">{t("Notes")}</h4>
                    <Textarea 
                        className="min-h-[120px] bg-white dark:bg-gray-700"
                        placeholder={t("Add interview notes, comments, etc...")}
                        defaultValue={applicant.notes || ''}
                        onBlur={e => onSaveNotes(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50" onClick={onDelete}>
                        <Trash2 size={16}/>
                    </Button>
                    <Button variant="secondary" onClick={() => onUpdateStatus('Declined')}>
                        <XCircle size={16} className="mr-2"/> {t("Decline")}
                    </Button>
                    <Button onClick={onOffer}>
                        <Mail size={16} className="mr-2"/> {t("Offer")}
                    </Button>
                    <Button variant="primary" onClick={onHire}>
                        <UserPlus size={16} className="mr-2"/> {t("Hire")}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ApplicantDetailModal;
