
import React from 'react';
import Card from 'components/ui/Card';

interface RosterTableProps {
    stats: any[];
}

const RosterTable: React.FC<RosterTableProps> = ({ stats }) => {
    return (
        <Card>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Full Roster</h3>
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <table className="min-w-full border-separate border-spacing-0 divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-xs border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Rank</th>
                            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Technician</th>
                            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Jobs</th>
                            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Avg Ticket</th>
                            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Avg Time on Site</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {stats.map((tech, i) => (
                            <tr key={tech.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-6 py-4 text-gray-500">{i + 1}</td>
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{tech.firstName} {tech.lastName}</td>
                                <td className="px-6 py-4 text-green-600 dark:text-green-400 font-bold">${tech.revenue.toLocaleString()}</td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{tech.completed}</td>
                                <td className="px-6 py-4 text-blue-600 dark:text-blue-400 font-bold">${tech.avgTicket.toFixed(0)}</td>
                                <td className="px-6 py-4 text-purple-600 dark:text-purple-400 font-bold">
                                    {tech.avgTimeOnSite > 0 
                                        ? tech.avgTimeOnSite >= 60 
                                            ? `${Math.floor(tech.avgTimeOnSite / 60)}h ${Math.round(tech.avgTimeOnSite % 60)}m`
                                            : `${Math.round(tech.avgTimeOnSite)}m`
                                        : 'N/A'
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default RosterTable;
