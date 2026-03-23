
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import type { Applicant } from 'types';

interface ListViewProps {
    applicants: Applicant[];
    onSelectApplicant: (applicant: Applicant) => void;
    statusColors: Record<string, string>;
}

const ListView: React.FC<ListViewProps> = ({ applicants, onSelectApplicant, statusColors }) => {
    return (
        <Card className="flex-1 overflow-hidden p-0">
            <Table headers={['Name', 'Position', 'Applied', 'Status', 'Action']}>
                {applicants.map(app => (
                    <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-6 py-3 font-bold text-gray-900 dark:text-white">{app.name || `${app.firstName} ${app.lastName}`}</td>
                        <td className="px-6 py-3 text-gray-600 dark:text-gray-300">{app.position}</td>
                        <td className="px-6 py-3 text-gray-500 text-sm">{app.applicationDate ? new Date(app.applicationDate).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-6 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${statusColors[app.status]}`}>
                                {app.status}
                            </span>
                        </td>
                        <td className="px-6 py-3">
                            <button onClick={() => onSelectApplicant(app)} className="text-primary-600 hover:underline text-sm font-medium">View Details</button>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default ListView;
