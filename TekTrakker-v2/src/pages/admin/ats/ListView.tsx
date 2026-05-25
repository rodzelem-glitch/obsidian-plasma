
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import type { Applicant } from 'types';
import { FileText } from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';

interface ListViewProps {
    applicants: Applicant[];
    onSelectApplicant: (applicant: Applicant) => void;
    statusColors: Record<string, string>;
}

const ListView: React.FC<ListViewProps> = ({ applicants, onSelectApplicant, statusColors }) => {
    const { t } = useLanguage();
    return (
        <Card className="flex-1 overflow-hidden p-0">
            <Table headers={['Name', 'Position', 'Applied', 'Status', 'Action'].map(h => t(h))}>
                {applicants.map(app => (
                    <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-6 py-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {app.name || `${app.firstName} ${app.lastName}`}
                            {(app.resumeUrl || app.resumeDataUrl) && <div title={t("Resume Attached")} className="p-1 bg-blue-100 text-blue-600 rounded-full"><FileText size={12}/></div>}
                        </td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{t(app.position)}</td>
                        <td className="px-6 py-3 text-gray-500 text-sm">{(app.applicationDate || app.appliedDate) ? new Date(app.applicationDate || app.appliedDate).toLocaleDateString() : t('N/A')}</td>
                        <td className="px-6 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${statusColors[app.status]}`}>
                                {t(app.status)}
                            </span>
                        </td>
                        <td className="px-6 py-3">
                            <button onClick={() => onSelectApplicant(app)} className="text-primary-600 hover:underline text-sm font-medium">{t("View Details")}</button>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default ListView;
