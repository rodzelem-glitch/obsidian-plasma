import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Calendar, ClipboardCheck, Truck, DollarSign, Briefcase, Zap } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';

const commands = [
    {
        category: "CRM & Customers",
        icon: Users,
        color: "bg-blue-100 text-blue-600",
        examples: [
            "Create a new customer profile for Michael Scott at 123 Paper St.",
            "Update Michael Scott's phone number to 555-0199.",
            "Add a note to Michael Scott's account saying he prefers morning visits.",
            "Text Michael Scott and tell him I'm 15 minutes away.",
            "Log this 5-ton Carrier AC unit to Michael's equipment list."
        ]
    },
    {
        category: "Dispatching & Scheduling",
        icon: Calendar,
        color: "bg-emerald-100 text-emerald-600",
        examples: [
            "Book a diagnostic job for Sarah Collins tomorrow at 2 PM.",
            "Reschedule Sarah's appointment to next Friday.",
            "Assign John Doe to Sarah's job.",
            "Smart-dispatch all my unassigned jobs for today based on location.",
            "Cancel the job for 123 Main St."
        ]
    },
    {
        category: "Work Execution & Compliance",
        icon: ClipboardCheck,
        color: "bg-orange-100 text-orange-600",
        examples: [
            "Start the labor timer for the Active Job.",
            "Stop my clock. How many hours did I just log?",
            "Record this multimeter reading: 240V running smoothly.",
            "Add the standard safety checklist to the Smith job.",
            "File a new electrical permit requirement for the Johnson project."
        ]
    },
    {
        category: "Fleet & Inventory",
        icon: Truck,
        color: "bg-purple-100 text-purple-600",
        examples: [
            "Check exactly how many 2-inch PVC pipes we have in Warehouse A.",
            "Log 45 miles driven for today in Truck 3.",
            "Report an engine light issue on Truck 3 for maintenance.",
            "Move 10 air filters from the main warehouse to Truck 2.",
            "Draft a purchase order to restock our missing copper coils."
        ]
    },
    {
        category: "Financials & Estimator",
        icon: DollarSign,
        color: "bg-green-100 text-emerald-600",
        examples: [
            "Draft a $5,000 installation proposal for Michael.",
            "Generate an invoice and email it to Sarah for the completed work.",
            "Apply a 10% military discount to Sarah's invoice.",
            "Log a $45.60 expense under the Johnson Roof Project for lumber.",
            "Update the global estimator price of Carrier AC units to $4500."
        ]
    },
    {
        category: "Admin & Operations",
        icon: Briefcase,
        color: "bg-indigo-100 text-indigo-600",
        examples: [
            "What was our total gross revenue last month?",
            "Analyze all financial metrics and generate a business health report.",
            "Design a new email marketing campaign targeting recent customers.",
            "Generate a daily operations audit for unclosed jobs, missing paperwork, timesheet errors, and overdue invoices (Admins Only).",
            "Draft a subcontractor contract document for Bob.",
            "Invite bob@contracting.com to join our subcontractor network."
        ]
    }
];

const VirtualWorkerCommands: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
            {/* Navbar */}
            <nav className="border-b border-slate-200 backdrop-blur-md fixed w-full z-50 bg-white/90">
                <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center cursor-pointer gap-4">
                        <button onClick={() => navigate('/ai-worker')} aria-label="Go back to AI Worker" title="Go back to AI Worker" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <Logo className="h-10 w-auto text-indigo-600" />
                    </div>
                </div>
            </nav>

            <header className="pt-32 pb-12 px-6 text-center">
                <div className="max-w-3xl mx-auto flex flex-col items-center">
                    <img src="/mascot.png" alt="AI Mascot" className="w-28 h-28 object-contain filter drop-shadow-xl mb-6" />
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-900">
                        Agent Command Directory
                    </h1>
                    <p className="text-lg text-slate-600 leading-relaxed font-medium">
                        The Virtual Worker uses natural language processing. You don't have to be a programmer—just talk to it like a real employee. Here are examples of exactly what it can execute for you.
                    </p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {commands.map((section, idx) => (
                        <div key={idx} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 \${section.color}`}>
                                    <section.icon size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 block">{section.category}</h2>
                            </div>
                            
                            <ul className="space-y-4">
                                {section.examples.map((example, eIdx) => (
                                    <li key={eIdx} className="flex gap-3 text-slate-600 group">
                                        <span className="text-indigo-400 mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity">›</span>
                                        <p className="text-sm font-medium italic">"{example}"</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                
                <div className="mt-16 text-center bg-indigo-600 text-white p-12 rounded-3xl shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <h3 className="text-3xl font-black mb-4 relative z-10">Just speak to it naturally.</h3>
                    <p className="text-indigo-100 max-w-2xl mx-auto relative z-10 text-lg">
                        You can chain commands together or ask follow-up questions. It remembers the context of the job you're working on.
                    </p>
                </div>
            </main>

            <footer className="mt-auto bg-slate-950 border-t border-white/5 py-12 px-6 mt-20">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all"><Logo className="h-8 w-auto" /></div>
                    <div className="flex gap-8 text-sm text-slate-500 font-medium">
                        <a href="/#/faq" className="hover:text-white transition-colors">FAQ</a>
                        <a href="/#/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="/#/terms" className="hover:text-white transition-colors">Terms of Service</a>
                        <a href="mailto:platform@tektrakker.com" className="hover:text-white transition-colors">Support</a>
                    </div>
                    <div className="text-slate-600 text-xs font-medium">&copy; {new Date().getFullYear()} TekTrakker Inc. All rights reserved.</div>
                </div>
            </footer>
        </div>
    );
};

export default VirtualWorkerCommands;
