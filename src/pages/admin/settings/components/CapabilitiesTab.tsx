
import React from 'react';
import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';
import { Home, Briefcase, Plus, X } from 'lucide-react';

interface CapabilitiesTabProps {
    serviceTypes: ('Residential' | 'Commercial')[];
    setServiceTypes: (types: ('Residential' | 'Commercial')[]) => void;
    specializations: string[];
    setSpecializations: (specs: string[]) => void;
}

const CapabilitiesTab: React.FC<CapabilitiesTabProps> = ({ 
    serviceTypes, setServiceTypes, specializations, setSpecializations 
}) => {
    const [newSpec, setNewSpec] = React.useState('');

    const handleServiceTypeToggle = (type: 'Residential' | 'Commercial') => {
        if (serviceTypes.includes(type)) {
            setServiceTypes(serviceTypes.filter(t => t !== type));
        } else {
            setServiceTypes([...serviceTypes, type]);
        }
    };

    const handleAddSpecialization = () => {
        if (newSpec && !specializations.includes(newSpec)) {
            setSpecializations([...specializations, newSpec]);
            setNewSpec('');
        }
    };

    const handleRemoveSpecialization = (specToRemove: string) => {
        setSpecializations(specializations.filter(spec => spec !== specToRemove));
    };

    return (
        <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Service Types</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select the types of clients you serve. This helps customers find you.</p>
                <div className="flex gap-4">
                    <Button 
                        variant={serviceTypes.includes('Residential') ? 'solid' : 'outline'}
                        onClick={() => handleServiceTypeToggle('Residential')} 
                        className="flex-1 flex items-center justify-center gap-2"
                    >
                        <Home size={18}/> Residential
                    </Button>
                    <Button 
                        variant={serviceTypes.includes('Commercial') ? 'solid' : 'outline'}
                        onClick={() => handleServiceTypeToggle('Commercial')} 
                        className="flex-1 flex items-center justify-center gap-2"
                    >
                        <Briefcase size={18}/> Commercial
                    </Button>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Specializations</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">List your areas of expertise (e.g., "Rooftop Units", "Emergency Repairs").</p>
                <div className="flex gap-2 mb-4">
                    <Input 
                        value={newSpec}
                        onChange={e => setNewSpec(e.target.value)}
                        placeholder="Add a specialization..."
                        onKeyPress={e => e.key === 'Enter' && handleAddSpecialization()}
                    />
                    <Button onClick={handleAddSpecialization}><Plus size={16}/></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {specializations.map(spec => (
                        <span key={spec} className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 text-sm px-3 py-1 rounded-full">
                            {spec}
                            <button onClick={() => handleRemoveSpecialization(spec)} className="hover:text-red-500">
                                <X size={14} />
                            </button>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CapabilitiesTab;
