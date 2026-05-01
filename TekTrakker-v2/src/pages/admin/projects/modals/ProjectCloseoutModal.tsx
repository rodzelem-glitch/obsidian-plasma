import showToast from "lib/toast";
import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import type { Project, Customer, User, Subcontractor, BusinessDocument, Message, Expense, Job, EquipmentRental, Permit } from 'types';
import { FileText, Send, Users, Home } from 'lucide-react';
import { useAppContext } from 'context/AppContext';

interface ProjectCloseoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    financials: { expenses: Expense[], invoices: Job[], totalExpenses: number, totalBilled: number, totalCollected: number };
    rentals: EquipmentRental[];
    subs: Subcontractor[];
    customers: Customer[];
    employees: User[];
}

const ProjectCloseoutModal: React.FC<ProjectCloseoutModalProps> = ({ isOpen, onClose, project, financials, rentals, subs, customers, employees }) => {
    const { state, dispatch } = useAppContext();
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Sharing specific
    const [selectedEmails, setSelectedEmails] = useState<string>(''); // comma separated
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
    
    // Content Options
    const [includeFinancials, setIncludeFinancials] = useState(true);
    const [includeTasks, setIncludeTasks] = useState(true);
    const [includeRentals, setIncludeRentals] = useState(true);
    const [includePermits, setIncludePermits] = useState(true);
    const [customNotes, setCustomNotes] = useState('');

    const generateHTMLReport = () => {
        let html = `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">`;
        html += `<h1 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">Project Closeout Report: ${project.name}</h1>`;
        html += `<div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p><strong>Customer:</strong> ${project.customerName}</p>
                    <p><strong>Address:</strong> ${project.address || 'N/A'}</p>
                    <p><strong>Start Date:</strong> ${new Date(project.startDate).toLocaleDateString()}</p>
                    <p><strong>End Date:</strong> ${project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Status:</strong> ${project.status}</p>
                 </div>`;

        if (customNotes) {
            html += `<h2>Executive Summary / Notes</h2><p style="white-space: pre-wrap;">${customNotes}</p>`;
        }

        if (includeFinancials) {
            html += `<h2>Financial Summary</h2>
                     <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <tr style="background-color: #e2e8f0;"><th style="padding: 8px; border: 1px solid #cbd5e1;">Metric</th><th style="padding: 8px; border: 1px solid #cbd5e1;">Amount</th></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;">Total Budget</td><td style="padding: 8px; border: 1px solid #cbd5e1;">$${project.budget.toLocaleString()}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;">Total Expenses</td><td style="padding: 8px; border: 1px solid #cbd5e1;">$${financials.totalExpenses.toLocaleString()}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1;">Total Billed</td><td style="padding: 8px; border: 1px solid #cbd5e1;">$${financials.totalBilled.toLocaleString()}</td></tr>
                     </table>`;
        }

        if (includeTasks && project.projectTasks && project.projectTasks.length > 0) {
            html += `<h2>Milestones & Tasks</h2><ul style="padding-left: 20px;">`;
            project.projectTasks.forEach(task => {
                html += `<li><strong>${task.description}</strong> - ${task.status} ${task.dueDate ? `(Due: ${task.dueDate})` : ''}</li>`;
            });
            html += `</ul>`;
        }

        if (includeRentals && rentals.length > 0) {
            html += `<h2>Equipment Rentals</h2><ul style="padding-left: 20px;">`;
            rentals.forEach(r => {
                html += `<li><strong>${r.equipmentName}</strong> (${r.vendor}) - $${r.cost.toLocaleString()} - ${r.status}</li>`;
            });
            html += `</ul>`;
        }

        if (includePermits && project.permits && project.permits.length > 0) {
            html += `<h2>Permits</h2><ul style="padding-left: 20px;">`;
            project.permits.forEach(p => {
                html += `<li><strong>${p.type}</strong> (#${p.number}) - ${p.status}</li>`;
            });
            html += `</ul>`;
        }

        html += `<p style="margin-top: 40px; font-size: 12px; color: #64748b; text-align: center;">Generated automatically by TekTrakker on ${new Date().toLocaleDateString()}</p>`;
        html += `</div>`;
        return html;
    };

    const handleExecuteCloseout = async () => {
        setIsGenerating(true);
        try {
            const htmlContent = generateHTMLReport();
            
            // 1. Create BusinessDocument instance
            const docId = `doc_${Date.now()}`;
            const businessDoc: BusinessDocument = {
                id: docId,
                organizationId: state.currentOrganization?.id || '',
                title: `${project.name} - Closeout Report`,
                type: 'Project Report' as any,
                content: htmlContent,
                createdAt: new Date().toISOString(),
                createdBy: state.currentUser?.id || 'system',
                jobId: project.id // loosely tie it
            };

            await db.collection('documents').doc(businessDoc.id).set(businessDoc);
            dispatch({ type: 'ADD_DOCUMENT', payload: businessDoc });

            // 2. Dispatch Messages to all selected targets
            const dispatchMessage = async (receiverId: string, type: 'text' | 'email') => {
                const msg: Message = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    organizationId: state.currentOrganization?.id || '',
                    senderId: state.currentUser?.id || 'system',
                    senderName: state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}` : 'TekTrakker System',
                    receiverId,
                    content: `The Project Closeout Report for "${project.name}" has been generated. Please review it on your portal or dashboard. Document ID: ${businessDoc.id}`,
                    timestamp: new Date().toISOString(),
                    read: false,
                    type,
                    deliveryStatus: 'queued'
                };
                await db.collection('messages').doc(msg.id).set(msg);
                dispatch({ type: 'ADD_MESSAGE', payload: msg } as any);
            };

            // Custom Emails
            const emails = selectedEmails.split(',').map(e => e.trim()).filter(e => e);
            for (const email of emails) {
                await dispatchMessage(email, 'email');
            }

            // Users (Employees)
            for (const u of selectedUsers) {
                await dispatchMessage(u, 'text');
            }

            // Customers
            for (const c of selectedCustomers) {
                await dispatchMessage(c, 'email');
            }

            // Subcontractors
            for (const s of selectedSubs) {
                await dispatchMessage(s, 'email');
            }

            setIsGenerating(false);
            onClose();
        } catch (error) {
            console.error("Closeout failed:", error);
            showToast.warn("An error occurred while generating the report. Please try again.");
            setIsGenerating(false);
        }
    };

    const toggleSelection = (id: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        setter(list.includes(id) ? list.filter(itemId => itemId !== id) : [...list, id]);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Project Closeout & Reporting">
            <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold flex items-center gap-2 mb-2 text-slate-900 dark:text-white"><FileText size={18} /> Report Contents</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-900 dark:text-white">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={includeFinancials} onChange={(e) => setIncludeFinancials(e.target.checked)} className="rounded" />
                            Financial Summary
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={includeTasks} onChange={(e) => setIncludeTasks(e.target.checked)} className="rounded" />
                            Milestones & Tasks
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={includeRentals} onChange={(e) => setIncludeRentals(e.target.checked)} className="rounded" />
                            Equipment Rentals
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={includePermits} onChange={(e) => setIncludePermits(e.target.checked)} className="rounded" />
                            Permits
                        </label>
                    </div>
                    <div className="mt-4">
                        <Textarea label="Custom Notes (e.g. key takeaways, next steps)" value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} />
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-slate-800/50 p-4 rounded-lg border border-blue-200 dark:border-slate-700">
                    <h3 className="font-bold flex items-center gap-2 mb-4 text-blue-900 dark:text-blue-100"><Send size={18} /> Delivery & Attachments</h3>
                    
                    <div className="space-y-4">
                        <div>
                            <Input label="External Email Addresses (comma separated)" placeholder="architect@company.com, inspector@city.gov" value={selectedEmails} onChange={(e) => setSelectedEmails(e.target.value)} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Attach & Notify Customers / Properties</label>
                            <div className="max-h-24 overflow-y-auto border rounded p-2 bg-white dark:bg-slate-900 custom-scrollbar">
                                {customers.map(c => (
                                    <label key={c.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                        <input type="checkbox" checked={selectedCustomers.includes(c.id)} onChange={() => toggleSelection(c.id, selectedCustomers, setSelectedCustomers)} className="rounded" />
                                        <span className="text-sm dark:text-white">{c.name} {(c as any).companyName ? `(${(c as any).companyName})` : ''}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Notify Internal Staff / Employees</label>
                            <div className="max-h-24 overflow-y-auto border rounded p-2 bg-white dark:bg-slate-900 custom-scrollbar">
                                {employees.map(e => (
                                    <label key={e.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                        <input type="checkbox" checked={selectedUsers.includes(e.id)} onChange={() => toggleSelection(e.id, selectedUsers, setSelectedUsers)} className="rounded" />
                                        <span className="text-sm dark:text-white">{e.firstName} {e.lastName}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Notify Subcontractors</label>
                            <div className="max-h-24 overflow-y-auto border rounded p-2 bg-white dark:bg-slate-900 custom-scrollbar">
                                {subs.map(s => (
                                    <label key={s.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                        <input type="checkbox" checked={selectedSubs.includes(s.id)} onChange={() => toggleSelection(s.id, selectedSubs, setSelectedSubs)} className="rounded" />
                                        <span className="text-sm dark:text-white">{s.companyName} ({s.contactName})</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isGenerating}>Cancel</Button>
                    <Button onClick={handleExecuteCloseout} disabled={isGenerating}>
                        {isGenerating ? 'Generating & Sending...' : 'Complete Closeout'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ProjectCloseoutModal;
