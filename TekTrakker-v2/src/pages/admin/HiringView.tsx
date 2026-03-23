
import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';

interface Applicant {
    id: string;
    name: string;
    role: string;
    phone: string;
    status: 'New' | 'Phone Screen' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';
    appliedDate: string;
}

const HiringView: React.FC = () => {
    // Local state for demo purposes as schema update wasn't requested for Applicants
    const [applicants, setApplicants] = useState<Applicant[]>([
        { id: '1', name: 'John Doe', role: 'HVAC Tech', phone: '555-0101', status: 'New', appliedDate: new Date().toISOString() },
        { id: '2', name: 'Jane Smith', role: 'Installer', phone: '555-0102', status: 'Phone Screen', appliedDate: new Date().toISOString() },
        { id: '3', name: 'Bob Johnson', role: 'Plumber', phone: '555-0103', status: 'Interview', appliedDate: new Date().toISOString() }
    ]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newApplicant, setNewApplicant] = useState({ name: '', role: '', phone: '' });

    const columns: Applicant['status'][] = ['New', 'Phone Screen', 'Interview', 'Offer', 'Hired', 'Rejected'];

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const applicant: Applicant = {
            id: Date.now().toString(),
            name: newApplicant.name,
            role: newApplicant.role,
            phone: newApplicant.phone,
            status: 'New',
            appliedDate: new Date().toISOString()
        };
        setApplicants([...applicants, applicant]);
        setIsModalOpen(false);
        setNewApplicant({ name: '', role: '', phone: '' });
    };

    const moveApplicant = (id: string, newStatus: Applicant['status']) => {
        setApplicants(applicants.map(a => a.id === id ? { ...a, status: newStatus } : a));
    };

    return (
        <div className="h-full flex flex-col">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Applicant Tracking</h2>
                    <p className="text-gray-600 dark:text-gray-400">Manage recruitment pipeline.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="w-auto">+ Add Candidate</Button>
            </header>

            <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 min-w-[1200px] h-full pb-4">
                    {columns.map(col => (
                        <div key={col} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 flex flex-col min-w-[200px]">
                            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase text-xs tracking-wider flex justify-between">
                                {col} <span className="bg-gray-300 dark:bg-gray-700 px-2 rounded-full text-[10px] flex items-center">{applicants.filter(a => a.status === col).length}</span>
                            </h3>
                            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                {applicants.filter(a => a.status === col).map(app => (
                                    <div key={app.id} className="bg-white dark:bg-gray-700 p-3 rounded shadow-sm border border-gray-200 dark:border-gray-600">
                                        <p className="font-bold text-gray-900 dark:text-white">{app.name}</p>
                                        <p className="text-xs text-gray-500">{app.role}</p>
                                        <p className="text-xs text-gray-500">{app.phone}</p>
                                        
                                        <div className="mt-3 flex gap-1 flex-wrap">
                                            {col !== 'New' && <button onClick={() => moveApplicant(app.id, columns[columns.indexOf(col) - 1])} className="text-[10px] bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">←</button>}
                                            {col !== 'Rejected' && col !== 'Hired' && <button onClick={() => moveApplicant(app.id, columns[columns.indexOf(col) + 1])} className="text-[10px] bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 px-2 py-1 rounded flex-1">Advance →</button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Candidate">
                <form onSubmit={handleAdd} className="space-y-4">
                    <Input label="Name" value={newApplicant.name} onChange={e => setNewApplicant({...newApplicant, name: e.target.value})} required />
                    <Input label="Role Applied For" value={newApplicant.role} onChange={e => setNewApplicant({...newApplicant, role: e.target.value})} required />
                    <Input label="Phone" value={newApplicant.phone} onChange={e => setNewApplicant({...newApplicant, phone: e.target.value})} required />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Add</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default HiringView;
