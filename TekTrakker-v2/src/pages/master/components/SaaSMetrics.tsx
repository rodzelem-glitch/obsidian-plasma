
import React from 'react';
import Card from '../../../components/ui/Card';
import { Building2, Users, DollarSign, TrendingUp } from 'lucide-react';

interface SaaSMetricsProps {
    totalOrgs: number;
    mrr: number;
    totalUsers: number;
    activeOrgs: number;
}

const SaaSMetrics: React.FC<SaaSMetricsProps> = ({ totalOrgs, mrr, totalUsers, activeOrgs }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="flex items-center p-6 border-l-4 border-blue-500">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                    <Building2 size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Total Organizations</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalOrgs}</p>
                </div>
            </Card>
            
            <Card className="flex items-center p-6 border-l-4 border-green-500">
                <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                    <DollarSign size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Monthly Recurring Revenue</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${mrr.toLocaleString()}</p>
                </div>
            </Card>

            <Card className="flex items-center p-6 border-l-4 border-purple-500">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
                    <Users size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
                </div>
            </Card>

            <Card className="flex items-center p-6 border-l-4 border-yellow-500">
                <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
                    <TrendingUp size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Active Subscriptions</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeOrgs}</p>
                </div>
            </Card>
        </div>
    );
};

export default SaaSMetrics;
