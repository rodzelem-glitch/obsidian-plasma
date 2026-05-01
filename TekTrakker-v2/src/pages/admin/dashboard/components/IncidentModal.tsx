import React from 'react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { AlertTriangle, X, Check } from 'lucide-react';

const IncidentModal: React.FC<{ incident: any | null, onClose: () => void, onResolve: () => void }> = ({ incident, onClose, onResolve }) => {
    if (!incident) return null;

    return (
        <Modal isOpen={!!incident} onClose={onClose} title="Incident Details">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className='flex-grow'>
                        <div className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                            <p><strong className='dark:text-white'>Type:</strong> {incident.type}</p>
                            <p><strong className='dark:text-white'>Technician:</strong> {incident.technicianName}</p>
                            <p><strong className='dark:text-white'>Job ID:</strong> {incident.jobId}</p>
                            <p><strong className='dark:text-white'>Time:</strong> {new Date(incident.timestamp).toLocaleString()}</p>
                            <p><strong className='dark:text-white'>Description:</strong></p>
                            <p className='p-2 bg-gray-100 dark:bg-gray-700 rounded'>{incident.description}</p>
                            
                            {incident.attachmentUrls && incident.attachmentUrls.length > 0 && (
                                <div className="mt-4">
                                    <p className='text-xs font-black uppercase text-slate-400 mb-2'>Attached Evidence / Photos</p>
                                    <div className="flex flex-wrap gap-2">
                                        {incident.attachmentUrls.map((url: string, idx: number) => (
                                            <img 
                                                key={idx} 
                                                src={url} 
                                                alt="Evidence" 
                                                className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-105 transition-transform" 
                                                onClick={() => window.open(url, '_blank')}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <Button onClick={onResolve} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white">
                    <Check size={16} className="mr-2"/> Acknowledge & Resolve
                </Button>
                <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto mt-2 sm:mt-0">
                   <X size={16} className="mr-2"/> Close
                </Button>
            </div>
        </Modal>
    );
};

export default IncidentModal;
