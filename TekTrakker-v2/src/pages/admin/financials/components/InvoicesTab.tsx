import showToast from "lib/toast";
import { getBaseUrl } from "lib/utils";

import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { Trash2, Share2, Copy, Bell } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import DocumentPreview from 'components/ui/DocumentPreview';

interface InvoicesTabProps {
    jobs: any[];
    setEditingInvoiceId: (id: string) => void;
    handleDeleteInvoice: (id: string) => void;
}

const InvoicesTab: React.FC<InvoicesTabProps> = ({ jobs, setEditingInvoiceId, handleDeleteInvoice }) => {
    const { state } = useAppContext();
    const [shareModalInvoice, setShareModalInvoice] = useState<any>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [viewingInvoiceJob, setViewingInvoiceJob] = useState<any>(null);

    const [sortBy, setSortBy] = useState('date_desc');

    const handleCopyRef = (jobId: string) => {
        navigator.clipboard.writeText(`#INV-${jobId}`);
        showToast.warn("Invoice Reference Copied! Paste it anywhere to create a smart link.");
    };

    const handleShareInvoice = async () => {
        if (!shareModalInvoice || !shareTargetId) return;
        setIsSharing(true);
        try {
            const msgObj: any = {
                id: `msg-${Date.now()}`,
                senderId: state.currentUser?.id,
                senderName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                receiverId: shareTargetId,
                content: `${shareMessageText ? shareMessageText + '\n\n' : ''}Check out this invoice: #INV-${shareModalInvoice.id}`,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id,
                type: 'internal'
            };
            await db.collection('messages').doc(msgObj.id).set(msgObj);
            showToast.warn("Invoice shared successfully!");
            setShareModalInvoice(null);
            setShareMessageText('');
        } catch (e) {
            showToast.warn("Failed to share.");
        } finally {
            setIsSharing(false);
        }
    };

    const handleSendInvoiceReminder = async (job: any) => {
        let email = job.customerEmail;
        let phone = job.customerPhone;
        
        // If not in job object natively, attempt to lookup
        if (!email && job.customerId) {
            const cust = state.customers.find((c: any) => c.id === job.customerId);
            if (cust) {
                email = cust.email;
                phone = cust.phone || phone;
            }
        }

        if (!email && !phone) {
            showToast.warn("Customer requires an email or phone number for reminders.");
            return;
        }

        if (!confirm(`Send payment reminder for invoice #${job.invoice.id} to ${email || 'this customer'}?`)) return;

        try {
            const link = `${getBaseUrl()}/#/invoice/${job.id}`;
            const orgName = state.currentOrganization?.name || 'Service Provider';
            const invTotal = Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0;
            
            if (email) {
                await db.collection('mail').add({
                    to: [email],
                    message: {
                        subject: `Reminder: Invoice #${job.invoice.id} from ${orgName}`,
                        html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #fee2e2;border-radius:8px;"><h2 style="color:#dc2626;">Payment Reminder</h2><p>Hi ${job.customerName},</p><p>This is a friendly reminder that your invoice <strong>#${job.invoice.id}</strong> for <strong>$${invTotal.toFixed(2)}</strong> is currently outstanding.</p><div style="margin:20px 0;"><a href="${link}" style="background-color:#0284c7;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; Pay Invoice</a></div><p>If you have already submitted payment, please disregard this notice.</p><p style="font-size:12px;color:#666;">Link: ${link}</p></div>`,
                        text: `Reminder: Invoice #${job.invoice.id} for $${invTotal.toFixed(2)} is outstanding. Pay here: ${link}`
                    },
                    organizationId: state.currentOrganization?.id,
                    type: 'InvoiceReminder',
                    createdAt: new Date().toISOString()
                });
            }

            if (phone) {
                await db.collection('messages').add({
                    to: phone,
                    body: `Reminder from ${orgName}: Your invoice #${job.invoice.id} for $${invTotal.toFixed(2)} is outstanding. View and pay securely here: ${link}`,
                    organizationId: state.currentOrganization?.id,
                    status: 'pending',
                    type: 'sms',
                    createdAt: new Date().toISOString()
                });
            }

            showToast.warn(`Reminder sent via ${email ? 'email' : ''} ${email && phone ? 'and ' : ''}${phone ? 'SMS text' : ''}!`);
        } catch (e) {
            console.error(e);
            showToast.warn("Error sending reminder.");
        }
    };

    const sortedInvoices = [...jobs.filter((j: any) => j.invoice)].sort((a: any, b: any) => {
        const amtA = Number(a.invoice.totalAmount) || Number(a.invoice.amount) || 0;
        const amtB = Number(b.invoice.totalAmount) || Number(b.invoice.amount) || 0;
        
        switch (sortBy) {
            case 'date_asc':
                return new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime();
            case 'amount_desc':
                return amtB - amtA;
            case 'amount_asc':
                return amtA - amtB;
            case 'name_asc':
                return (a.customerName || '').localeCompare(b.customerName || '');
            case 'name_desc':
                return (b.customerName || '').localeCompare(a.customerName || '');
            case 'status':
                return (a.invoice.status || '').localeCompare(b.invoice.status || '');
            case 'date_desc':
            default:
                return new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime();
        }
    });

    return (
        <Card>
            {viewingInvoiceJob && (
                <DocumentPreview
                    type="Invoice"
                    data={viewingInvoiceJob}
                    onClose={() => setViewingInvoiceJob(null)}
                    isInternal={true}
                />
            )}
            <Modal isOpen={!!shareModalInvoice} onClose={() => setShareModalInvoice(null)} title={`Share Invoice: ${shareModalInvoice?.customerName}`}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Send this invoice reference to a staff member.</p>
                    <select 
                        aria-label="Select Share Recipient"
                        title="Select Share Recipient"
                        className="w-full border rounded-lg p-2 text-slate-900 dark:text-white dark:bg-slate-800 dark:border-slate-700 bg-white"
                        value={shareTargetId}
                        onChange={e => setShareTargetId(e.target.value)}
                    >
                        <option value="">Select Recipient...</option>
                        {state.users.filter((u: any) => 
                            u.organizationId === state.currentOrganization?.id && 
                            u.id !== state.currentUser?.id && 
                            u.role !== 'customer'
                        ).map((u: any) => (
                            <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                        ))}
                    </select>
                    <Textarea 
                        placeholder="Add an optional message..."
                        value={shareMessageText}
                        onChange={e => setShareMessageText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setShareModalInvoice(null)}>Cancel</Button>
                        <Button onClick={handleShareInvoice} disabled={!shareTargetId || isSharing}>
                            {isSharing ? 'Sending...' : 'Send Message'}
                        </Button>
                    </div>
                </div>
            </Modal>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h3 className="font-bold text-gray-800 dark:text-white">Accounts Receivable</h3>
                <div className="flex items-center gap-2 text-sm">
                    <label className="font-medium text-slate-600 dark:text-slate-300">Sort by:</label>
                    <select 
                        aria-label="Sort Invoices"
                        className="border rounded-lg p-1.5 dark:bg-slate-800 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="date_desc">Newest First</option>
                        <option value="date_asc">Oldest First</option>
                        <option value="name_asc">Customer (A-Z)</option>
                        <option value="name_desc">Customer (Z-A)</option>
                        <option value="amount_desc">Amount (High to Low)</option>
                        <option value="amount_asc">Amount (Low to High)</option>
                        <option value="status">Status</option>
                    </select>
                </div>
            </div>

            <Table headers={['Invoice #', 'Customer', 'Date', 'Amount', 'Status', 'Actions']}>
                {sortedInvoices.map((job: any) => (
                    <tr key={job.id}>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{job.invoice.id}</td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{job.customerName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">${(Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0).toFixed(2)}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${job.invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {job.invoice.status}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2 items-center">
                                {job.invoice.status !== 'Paid' && (
                                    <button aria-label="Send Reminder" title="Send Reminder" onClick={(e) => { e.stopPropagation(); handleSendInvoiceReminder(job); }} className="p-1 text-orange-500 hover:text-orange-700"><Bell size={16}/></button>
                                )}
                                <button title="View Invoice" onClick={() => setViewingInvoiceJob(job)} className="text-primary-600 hover:underline text-sm font-bold">View</button>
                                <span className="text-slate-300">|</span>
                                <button title="Manage Invoice" onClick={() => setEditingInvoiceId(job.id)} className="text-primary-600 hover:underline text-sm font-bold">Manage</button>
                                <button aria-label="Copy Reference" title="Copy Reference" onClick={(e) => { e.stopPropagation(); handleCopyRef(job.id); }} className="p-1 text-slate-400 hover:text-primary-600"><Copy size={16}/></button>
                                <button aria-label="Share Invoice" title="Share Invoice" onClick={(e) => { e.stopPropagation(); setShareModalInvoice(job); }} className="p-1 text-slate-400 hover:text-primary-600"><Share2 size={16}/></button>
                                <button title="Delete Invoice" onClick={() => handleDeleteInvoice(job.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16}/></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default InvoicesTab;
