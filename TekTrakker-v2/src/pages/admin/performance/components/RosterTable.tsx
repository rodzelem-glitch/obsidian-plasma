
import React from 'react';
import Card from 'components/ui/Card';

interface RosterTableProps {
    stats: any[];
}

const RosterTable: React.FC<RosterTableProps> = ({ stats }) => {
    return (
        <Card>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Full Roster</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Technician</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Revenue</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Jobs</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Avg Ticket</th>
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
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default RosterTable;
