
import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { Building, HardHat, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const ApexDemo: React.FC = () => {
    const { startApexDemo } = useAppContext();

    const featureHighlights = [
        { icon: Building, title: 'Enterprise Scale', description: 'For businesses managing large commercial and industrial clients.' },
        { icon: HardHat, title: 'Advanced Project Management', description: 'Multi-stage projects, complex budgets, and team coordination.' },
        { icon: ShieldCheck, title: 'High-Value Service Agreements', description: 'Customizable, high-revenue membership plans for priority clients.' },
        { icon: Zap, title: 'Seamless Sales & Operations', description: 'Integrated proposals, invoicing, and scheduling for a complete workflow.' },
    ];

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col justify-center items-center p-4">
            <div className="text-center mb-8 max-w-4xl mx-auto">
                <img src="/apex-logo.png" alt="Apex Logo" className="mx-auto h-24 mb-4"/>
                <h1 className="text-5xl font-extrabold mb-2 text-indigo-400">Apex Service Solutions Demo</h1>
                <p className="text-xl text-gray-400">
                    Experience TekTrakker's most powerful features in a high-revenue, enterprise-level environment.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-10">
                {featureHighlights.map((feature, index) => (
                    <div key={index} className="bg-gray-800 p-6 rounded-lg text-center transform hover:scale-105 transition-transform duration-300">
                        <feature.icon className="h-12 w-12 text-indigo-400 mx-auto mb-4" />
                        <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                        <p className="text-sm text-gray-400">{feature.description}</p>
                    </div>
                ))}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 p-4 md:p-8 rounded-xl shadow-2xl w-full max-w-lg mx-auto">
                <h2 className="text-2xl font-bold text-center mb-6">Launch Interactive Demo</h2>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                        onClick={() => startApexDemo('admin')}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg"
                    >
                        Launch as Admin
                    </button>
                    <button 
                        onClick={() => startApexDemo('employee')}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg"
                    >
                        Launch as Employee
                    </button>
                </div>
            </div>
             <Link to="/" className="mt-8 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                Back to Main Site
            </Link>
        </div>
    );
};

export default ApexDemo;
