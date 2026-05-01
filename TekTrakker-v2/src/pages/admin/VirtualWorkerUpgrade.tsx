import React from 'react';
import { Bot, Zap, Clock, ShieldCheck, ArrowRight, BrainCircuit, Users, MessageSquareText } from 'lucide-react';
import Button from '../../components/ui/Button';

const VirtualWorkerUpgrade: React.FC = () => {

    const features = [
        {
            title: "Automated Dispatching",
            description: "Your Virtual Worker reads the schedule, calculates drive times, and perfectly slots in new jobs to the nearest available technician—all without human input.",
            icon: <Clock size={24} className="text-blue-500" />
        },
        {
            title: "Hands-Free CRM",
            description: "Technicians can just talk to the app in the field to log notes, create customer profiles, or append photos. The AI formats everything perfectly into your database.",
            icon: <MessageSquareText size={24} className="text-purple-500" />
        },
        {
            title: "Instant Invoicing",
            description: "Tell the AI what parts you used and how long you worked, and it will instantly draft a professional invoice, sync it to the accounting ledger, and securely text it to the customer.",
            icon: <Zap size={24} className="text-emerald-500" />
        },
        {
            title: "24/7 Autonomy",
            description: "Never miss a late-night service request again. The agent can respond to customer texts 24/7, booking them in for the next available emergency slot.",
            icon: <BrainCircuit size={24} className="text-orange-500" />
        }
    ];

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
            
            {/* Hero Section */}
            <div className="max-w-4xl w-full text-center space-y-6 mb-16">
                <div className="flex justify-center mb-4 relative">
                    <div className="absolute inset-0 bg-primary-500 blur-3xl opacity-20 rounded-full w-48 h-48 mx-auto -z-10"></div>
                    <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl text-white transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                        <Bot size={48} />
                    </div>
                </div>
                
                <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                    Hire a <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-indigo-600">Super-Employee</span><br className="hidden md:block"/> for $199 a month.
                </h1>
                
                <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
                    Unlock the Virtual Worker AI to automate your dispatching, handle customer communications, and securely invoice clients entirely hands-free.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                    <Button size="lg" className="text-lg px-8 py-4 shadow-xl whitespace-nowrap bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500" onClick={() => alert('Contacting Sales/Billing support...')}>
                        Add to Subscription <ArrowRight className="ml-2 inline" size={20} />
                    </Button>
                </div>
                <p className="text-sm text-slate-500 mt-4 flex items-center justify-center gap-1">
                    <ShieldCheck size={16} className="text-emerald-500" /> Includes 10,000,000 AI Operations Actions every month.
                </p>
            </div>

            {/* Feature Bento Grid */}
            <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                {features.map((feature, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-slate-100 dark:border-slate-700">
                            {feature.icon}
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                            {feature.title}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            {feature.description}
                        </p>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default VirtualWorkerUpgrade;
