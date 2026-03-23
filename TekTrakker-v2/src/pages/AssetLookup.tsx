
import React, { useMemo, useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Wrench, CalendarIcon, FileText, ArrowLeft } from 'lucide-react';

const AssetLookup: React.FC = () => {
    const { customerId } = useParams<{ customerId: string }>();
    const [searchParams] = useSearchParams();
    const assetId = searchParams.get('assetId');
    const { state } = useAppContext();
    const navigate = useNavigate();

    const customer = useMemo(() => 
        state.customers.find(c => c.id === customerId), 
    [state.customers, customerId]);

    const asset = useMemo(() => 
        customer?.equipment?.find(e => e.id === assetId), 
    [customer, assetId]);

    const history = useMemo(() => {
        if (!customer) return [];
        return state.jobs
            .filter(j => j.customerId === customer.id)
            .sort((a,b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [state.jobs, customer]);

    if (!customer) {
        return (
            <div className="p-4 md:p-8 text-center">
                <h2 className="text-xl font-bold text-red-600">Asset Not Found</h2>
                <p className="text-gray-500">The scanned code does not match a known customer record.</p>
                <Button onClick={() => navigate('/')} className="mt-4 w-auto">Go Home</Button>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-2xl mx-auto space-y-6">
            <header className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                    <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Asset Details</h1>
                    <p className="text-sm text-gray-500">{customer.name}</p>
                </div>
            </header>

            {asset ? (
                <Card className="border-t-4 border-primary-500">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{asset.brand} {asset.type}</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-mono mb-2">S/N: {asset.serial}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Wrench size={12} /> {asset.model}
                            </p>
                        </div>
                        {asset.location && (
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded font-bold uppercase">
                                {asset.location}
                            </span>
                        )}
                    </div>
                    {asset.installDate && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                            Installed: {new Date(asset.installDate).toLocaleDateString()}
                        </div>
                    )}
                </Card>
            ) : (
                <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium">Specific asset ID not found.</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">Showing general customer history.</p>
                </Card>
            )}

            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <CalendarIcon size={18} /> Service History
                </h3>
                <div className="space-y-3">
                    {history.length > 0 ? history.map(job => (
                        <div key={job.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-gray-900 dark:text-white">{new Date(job.appointmentTime).toLocaleDateString()}</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${job.jobStatus === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {job.jobStatus}
                                </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                <span className="font-medium text-gray-800 dark:text-gray-200">Tasks:</span> {job.tasks.join(', ')}
                            </div>
                            {job.notes?.employeeFeedback && (
                                <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                                    <FileText size={10} className="inline mr-1"/>
                                    {job.notes.employeeFeedback}
                                </div>
                            )}
                        </div>
                    )) : (
                        <p className="text-gray-500 text-sm italic">No service history recorded.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssetLookup;
