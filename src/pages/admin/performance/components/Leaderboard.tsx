
import React from 'react';
import Card from 'components/ui/Card';
import { Award } from 'lucide-react';

interface LeaderboardProps {
    topTechs: any[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ topTechs }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topTechs.map((tech, i) => (
                <Card key={tech.id} className={`border-t-4 ${i === 0 ? 'border-yellow-400' : i === 1 ? 'border-gray-400' : 'border-orange-400'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-gray-400">#{i + 1}</div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{tech.firstName} {tech.lastName}</h3>
                                <p className="text-xs text-gray-500">{tech.username}</p>
                            </div>
                        </div>
                        {i === 0 && <Award className="w-8 h-8 text-yellow-400" />}
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Revenue</span>
                            <span className="font-bold text-green-600 dark:text-green-400">${tech.revenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Jobs Completed</span>
                            <span className="font-bold text-gray-900 dark:text-white">{tech.completed}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Avg Ticket</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">${tech.avgTicket.toFixed(0)}</span>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};

export default Leaderboard;
