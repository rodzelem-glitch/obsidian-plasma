
import React from 'react';
import { Zap, Shield, BarChart3 } from 'lucide-react';

const FeaturesSummary: React.FC = () => {
    return (
        <section className="py-24 px-6 bg-slate-900/50">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
                {[
                    { icon: Zap, title: 'Smart Dispatching', desc: 'Auto-optimize routes and schedules.' },
                    { icon: Shield, title: 'Instant Payments', desc: 'Get paid on-site with zero friction.' },
                    { icon: BarChart3, title: 'Customer Portal', desc: 'Self-service history and bookings.' }
                ].map((f, i) => (
                    <div key={i} className="p-4 md:p-8 rounded-3xl bg-slate-900 border border-white/5">
                        <f.icon className="text-primary-400 mb-6" size={40} />
                        <h3 className="text-2xl font-bold mb-2">{f.title}</h3>
                        <p className="text-slate-400">{f.desc}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default FeaturesSummary;
