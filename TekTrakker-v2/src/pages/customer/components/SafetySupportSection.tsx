import React from 'react';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import { AlertTriangle, ShieldCheck, Headphones } from 'lucide-react';

interface SafetySupportSectionProps {
    onReportConcern: () => void;
}

const SafetySupportSection: React.FC<SafetySupportSectionProps> = ({ onReportConcern }) => {
    return (
        <Card className="p-6 rounded-2xl border-2 border-orange-400/60 dark:border-orange-500/50 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white shadow-lg shadow-orange-500/10 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-white/20 rounded-xl text-white border border-white/30 shrink-0 shadow-inner">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h4 className="font-black text-base text-white">Safety, Quality Assurance & Support</h4>
                        <p className="text-xs text-orange-100 mt-0.5 max-w-xl font-medium">
                            Have an urgent site safety question, property access note, technician feedback, or warranty concern? Our customer care team is on standby.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                    <button 
                        type="button"
                        onClick={onReportConcern} 
                        className="bg-white hover:bg-slate-100 text-slate-900 font-black text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-black/10 w-full sm:w-auto justify-center cursor-pointer transition-all active:scale-95 border border-white/80 focus:outline-none focus:ring-2 focus:ring-white"
                    >
                        <AlertTriangle size={15} className="text-orange-600 shrink-0" />
                        <span className="text-slate-900 font-black tracking-wide">Report a Concern</span>
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default SafetySupportSection;
