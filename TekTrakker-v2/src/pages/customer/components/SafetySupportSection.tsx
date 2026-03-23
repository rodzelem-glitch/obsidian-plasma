
import React from 'react';
import Button from 'components/ui/Button';
import { AlertTriangle } from '@constants';

interface SafetySupportSectionProps {
    onReportConcern: () => void;
}

const SafetySupportSection: React.FC<SafetySupportSectionProps> = ({ onReportConcern }) => {
    return (
        <section>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Safety & Support</h3>
            <Button onClick={onReportConcern} variant="secondary" className="w-full flex items-center justify-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-orange-500" /> Report a Concern
            </Button>
        </section>
    );
};

export default SafetySupportSection;
