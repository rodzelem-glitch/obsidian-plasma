
import React from 'react';
import Card from 'components/ui/Card';
import { CreditCard, ExternalLink } from 'lucide-react';

const ApiBillingSection: React.FC = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card className="bg-gradient-to-r from-gray-800 to-gray-900 text-white border-0 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <CreditCard size={120} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <CreditCard size={24} className="text-white" />
                        </div>
                        <h3 className="text-xl font-bold">API Billing & Usage</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-white/20 pb-3">
                            <span className="text-gray-300">API Monitoring</span>
                             <span className="font-mono bg-black/30 px-2 py-1 rounded text-xs text-green-400">
                                Enabled
                            </span>
                        </div>
                        
                        <div className="bg-white/10 p-4 rounded-lg">
                            <p className="text-sm text-gray-300 mb-2">
                                Track Gemini API costs, quota usage, and billing details directly in the Google Cloud Console.
                            </p>
                            <a 
                                href="https://console.cloud.google.com/billing" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 font-bold text-sm transition-colors"
                            >
                                View Billing Dashboard <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ApiBillingSection;
