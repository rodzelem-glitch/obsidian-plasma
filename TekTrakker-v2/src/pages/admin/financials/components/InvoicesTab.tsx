
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { Trash2 } from 'lucide-react';

interface InvoicesTabProps {
    jobs: any[];
    setEditingInvoiceId: (id: string) => void;
    handleDeleteInvoice: (id: string) => void;
}

const InvoicesTab: React.FC<InvoicesTabProps> = ({ jobs, setEditingInvoiceId, handleDeleteInvoice }) => {
    return (
        <Card>
            <h3 className="font-bold mb-4 text-gray-800 dark:text-white">Accounts Receivable</h3>
            <Table headers={['Invoice #', 'Customer', 'Date', 'Amount', 'Status', 'Actions']}>
                {jobs.filter((j: any) => j.invoice).map((job: any) => (
                    <tr key={job.id}>
                        <td className="px-6 py-4 font-mono text-xs">{job.invoice.id}</td>
                        <td className="px-6 py-4 font-medium">{job.customerName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-bold">${(Number(job.invoice.totalAmount) || Number(job.invoice.amount) || 0).toFixed(2)}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${job.invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {job.invoice.status}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex gap-2">
                                <button onClick={() => setEditingInvoiceId(job.id)} className="text-primary-600 hover:underline text-sm font-bold">Manage</button>
                                <button onClick={() => handleDeleteInvoice(job.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 size={16}/></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default InvoicesTab;
