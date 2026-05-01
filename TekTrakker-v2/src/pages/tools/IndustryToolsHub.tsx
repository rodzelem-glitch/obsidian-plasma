import React from 'react';
import { useAppContext } from '../../context/AppContext';
import HvacTools from './HvacTools';
import ElectricalTools from './ElectricalTools';
import PlumbingTools from './PlumbingTools';
import LandscapingTools from './LandscapingTools';
import PaintingTools from './PaintingTools';
import GeneralContractingTools from './GeneralContractingTools';
import RoofingTools from './RoofingTools';
import CleaningTools from './CleaningTools';
import MasonryTools from './MasonryTools';
import SolarTools from './SolarTools';
import SecurityTools from './SecurityTools';
import TelecomTools from './TelecomTools';
import PetGroomingTools from './PetGroomingTools';
import Card from '../../components/ui/Card';
import { Wrench } from 'lucide-react';

const IndustryToolsHub: React.FC = () => {
    const { state } = useAppContext();
    const industry = state.currentOrganization?.industry || 'General';

    // Industry mapping logic
    const renderIndustrySpecificTools = () => {
        const ind = industry.toLowerCase();

        if (ind.includes('hvac') || ind.includes('refrigeration') || ind.includes('cooling') || ind.includes('heating')) {
            return <HvacTools />;
        }
        
        if (ind.includes('electric')) {
            return <ElectricalTools />;
        }

        if (ind.includes('plumbing') || ind.includes('drain') || ind.includes('pipe')) {
            return <PlumbingTools />;
        }

        if (ind.includes('landscaping') || ind.includes('garden') || ind.includes('lawn')) {
            return <LandscapingTools />;
        }

        if (ind.includes('painting') || ind.includes('decor')) {
            return <PaintingTools />;
        }

        if (ind.includes('general contracting') || ind.includes('construction') || ind.includes('remodel') || ind.includes('builder') || ind.includes('contracting')) {
            return <GeneralContractingTools />;
        }

        if (ind.includes('roofing')) {
            return <RoofingTools />;
        }

        if (ind.includes('cleaning') || ind.includes('janitorial') || ind.includes('maid')) {
            return <CleaningTools />;
        }

        if (ind.includes('masonry') || ind.includes('concrete') || ind.includes('brick') || ind.includes('stone')) {
            return <MasonryTools />;
        }

        if (ind.includes('solar') || ind.includes('energy') || ind.includes('photovoltaic')) {
            return <SolarTools />;
        }

        if (ind.includes('security') || ind.includes('alarm') || ind.includes('surveillance')) {
            return <SecurityTools />;
        }

        if (ind.includes('telecom') || ind.includes('network') || ind.includes('cable') || ind.includes('internet')) {
            return <TelecomTools />;
        }

        if (ind.includes('grooming') || ind.includes('pet') || ind.includes('dog') || ind.includes('cat')) {
            return <PetGroomingTools />;
        }

        // Default / Fallback
        return (
            <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
                <Card className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <Wrench size={48} className="text-slate-300 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Generic Tools Hub</h2>
                    <p className="text-slate-500 max-w-md mx-auto">
                        We haven't found specific technical tools for the <span className="font-bold text-primary-600">"{industry}"</span> industry yet. 
                        In the meantime, you can use the standard field proposal and diagnostic tools.
                    </p>
                </Card>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {renderIndustrySpecificTools()}
        </div>
    );
};

export default IndustryToolsHub;


