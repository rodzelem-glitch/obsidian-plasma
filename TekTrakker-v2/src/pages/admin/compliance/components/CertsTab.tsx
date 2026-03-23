
import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { User, IndustryVertical } from 'types';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface CertsTabProps {
    employees: User[];
    requiredCerts: string[];
    setSelectedUserForCert: (user: User) => void;
    setIsCertUploadOpen: (val: boolean) => void;
}

const CertsTab: React.FC<CertsTabProps> = ({
    employees,
    requiredCerts,
    setSelectedUserForCert,
    setIsCertUploadOpen
}) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {employees.map(emp => {
                    const userCerts = (emp.certifications || []).map(c => c.name.toLowerCase());
                    const missingCerts = requiredCerts.filter(rc => !userCerts.some(uc => uc.includes(rc.toLowerCase())));
                    const isCompliant = missingCerts.length === 0;

                    return (
                        <Card key={emp.id} className={`border-l-4 ${isCompliant ? 'border-green-500' : 'border-orange-500'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white">{emp.firstName} {emp.lastName}</h4>
                                    <p className="text-xs text-gray-500">{emp.role}</p>
                                </div>
                                {isCompliant ? <CheckCircle className="text-green-500" size={20}/> : <AlertTriangle className="text-orange-500" size={20}/>}
                            </div>
                            
                            <div className="space-y-2 mb-4">
                                <p className="text-xs font-bold text-gray-500 uppercase">Uploaded Certs</p>
                                {emp.certifications && emp.certifications.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {emp.certifications.map((cert, i) => (
                                            <span key={i} className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded border border-gray-200 dark:border-gray-600">
                                                {cert.name}
                                                {cert.expiryDate && <span className="ml-1 text-[10px] text-gray-500">({cert.expiryDate})</span>}
                                            </span>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-gray-400 italic">None uploaded</p>}
                            </div>

                            {!isCompliant && requiredCerts.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-xs font-bold text-red-500 uppercase">Missing Requirements</p>
                                    <ul className="text-xs text-red-400 list-disc list-inside">
                                        {missingCerts.map(c => <li key={c}>{c}</li>)}
                                    </ul>
                                </div>
                            )}

                            <Button 
                                variant="secondary" 
                                onClick={() => { setSelectedUserForCert(emp); setIsCertUploadOpen(true); }}
                                className="w-full text-xs"
                            >
                                Upload Certification
                            </Button>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default CertsTab;
