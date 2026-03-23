
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import type { Job, User, PartOrder, InvoiceLineItem, ShopOrder } from 'types';
import { formatAddress } from 'lib/utils';
import { Trash2 } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";

const BackButton = () => {
    const navigate = useNavigate();
    return (
        <button 
            onClick={() => navigate('/admin/dashboard')}
            className="mb-4 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 flex items-center font-medium"
        >
            ← Back to Dashboard
        </button>
    );
};

export const ActiveTechsView: React.FC = () => {
    const { state } = useAppContext();
    // Include supervisors in the list and filter by organization
    const employees = state.users.filter(u => 
        u.organizationId === state.currentOrganization?.id &&
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor')
    );
    
    return (
        <div>
            <BackButton />
            <header className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Active Technicians & Supervisors</h2>
                <p className="text-gray-600 dark:text-gray-400">Detailed list of all technicians and supervisors currently employed.</p>
            </header>
            <Card>
                <Table headers={['Name', 'Role', 'Contact', 'Status', 'Current Assignment']}>
                    {employees.map(tech => {
                         const currentJob = (state.jobs as Job[]).find(j => j.assignedTechnicianId === tech.id && j.invoice?.status !== 'Paid');
                         return (
                            <tr key={tech.id}>
                                <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{tech.firstName} {tech.lastName}</td>
                                <td className="px-6 py-4 text-xs font-bold uppercase text-gray-500">{tech.role}</td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                    <div>{tech.username}</div>
                                    <div className="text-xs text-gray-500">{tech.emergencyContact?.phone}</div>
                                </td>
                                <td className="px-6 py-4">
                                     <span className={`px-2 py-1 text-xs font-medium rounded-full ${currentJob ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                                        {currentJob ? 'Active' : 'Available'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">
                                    {currentJob ? (
                                        <div>
                                            <div className="text-gray-900 dark:text-white">{currentJob.customerName}</div>
                                            <div className="text-xs text-gray-500">{formatAddress(currentJob.address)}</div>
                                        </div>
                                    ) : 'No active assignment'}
                                </td>
                            </tr>
                         );
                    })}
                </Table>
            </Card>
        </div>
    );
};

export const ActiveJobsView: React.FC = () => {
    const { state } = useAppContext();
    const jobs = (state.jobs as Job[]).filter(j => j.invoice?.status !== 'Paid' && j.assignedTechnicianId);

    return (
        <div>
            <BackButton />
            <header className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Jobs in Progress</h2>
                <p className="text-gray-600 dark:text-gray-400">All jobs currently assigned and active (not yet paid).</p>
            </header>
             <Card>
                <Table headers={['Customer', 'Address', 'Technician', 'Status', 'Due']}>
                    {jobs.map(job => (
                        <tr key={job.id}>
                            <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{job.customerName}</td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">{formatAddress(job.address)}</td>
                             <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{job.assignedTechnicianName}</td>
                             <td className="px-6 py-4">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${job.jobStatus === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {job.jobStatus}
                                </span>
                             </td>
                             <td className="px-6 py-4 text-gray-900 dark:text-white font-bold">${(job.invoice?.amount || 0).toFixed(2)}</td>
                        </tr>
                    ))}
                    {jobs.length === 0 && (
                        <tr><td colSpan={5} className="p-6 text-center text-gray-500">No jobs currently in progress.</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};

export const PartOrdersView: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [viewMode, setViewMode] = useState<'internal' | 'external'>('internal');
    const [editingOrder, setEditingOrder] = useState<PartOrder | null>(null);
    const [updatingShopOrder, setUpdatingShopOrder] = useState<ShopOrder | null>(null);

    const partOrders = state.partOrders.map(order => {
        const job = (state.jobs as Job[]).find(j => j.id === order.jobId);
        return {
            ...order,
            customerName: job?.customerName || 'Unknown Customer',
            jobAddress: formatAddress(job?.address) || 'Unknown Address',
            jobInvoiceItems: job?.invoice?.items || []
        };
    });

    const handleEditOrder = (order: PartOrder) => {
        setEditingOrder(order);
    };

    const handleSaveOrder = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrder) return;
        dispatch({ type: 'UPDATE_PART_ORDER', payload: editingOrder });
        setEditingOrder(null);
    };

    const handleDeleteOrder = async (id: string) => {
        if (await globalConfirm('Are you sure you want to delete this order?')) {
            dispatch({ type: 'DELETE_PART_ORDER', payload: id });
        }
    };

    const handleFulfillOrder = async (order: PartOrder) => {
        if (!await globalConfirm('Mark order as Fulfilled? This will check if the item exists on the invoice.')) return;
        
        const updatedOrder: PartOrder = { ...order, status: 'Fulfilled' };
        dispatch({ type: 'UPDATE_PART_ORDER', payload: updatedOrder });

        const job = (state.jobs as Job[]).find(j => j.id === order.jobId);
        if (job && job.invoice) {
            const exists = job.invoice.items.some(item => 
                (item.description || '').toLowerCase().includes((order.parts || '').toLowerCase()) || 
                (order.parts || '').toLowerCase().includes((item.description || '').toLowerCase())
            );

            if (!exists) {
                if(await globalConfirm('The ordered parts do not appear to be explicitly listed on the customer invoice. Add them now?')) {
                    const newItem: InvoiceLineItem = {
                        id: `li-part-${Date.now()}`,
                        description: `Parts: ${order.parts}`,
                        quantity: 1,
                        unitPrice: order.cost, 
                        total: order.cost, 
                        type: 'Part'
                    };
                    
                    const updatedItems = [...job.invoice.items, newItem];
                    const newSubtotal = updatedItems.reduce((acc, item) => acc + (item.total || 0), 0);
                    const newTax = newSubtotal * (job.invoice.taxRate || 0.0825);
                    const newTotal = newSubtotal + newTax;

                    const updatedJob = {
                        ...job,
                        invoice: {
                            ...job.invoice,
                            items: updatedItems,
                            subtotal: newSubtotal,
                            taxAmount: newTax,
                            totalAmount: newTotal,
                            amount: newTotal
                        }
                    };
                    dispatch({ type: 'UPDATE_JOB', payload: updatedJob });
                    alert('Invoice updated with parts.');
                }
            }
        }
    };

    const handleUpdateShopOrder = (order: ShopOrder, newStatus: string) => {
        const updated = { ...order, status: newStatus };
        dispatch({ type: 'UPDATE_SHOP_ORDER', payload: updated });
        setUpdatingShopOrder(null);
    };

    const handleDeleteShopOrder = async (id: string) => {
         if (await globalConfirm('Are you sure you want to delete this Shop Order? This cannot be undone.')) {
            dispatch({ type: 'DELETE_SHOP_ORDER', payload: id });
        }
    };

    const shopOrders = state.shopOrders || [];

    return (
        <div>
             <BackButton />
             
             {editingOrder && (
                <Modal isOpen={true} onClose={() => setEditingOrder(null)} title="Edit Part Order">
                    <form onSubmit={handleSaveOrder} className="space-y-4">
                        <Textarea label="Parts List" value={editingOrder.parts} onChange={(e: any) => setEditingOrder({...editingOrder, parts: e.target.value})} />
                        <Input label="Cost ($)" type="number" value={editingOrder.cost} onChange={e => setEditingOrder({...editingOrder, cost: parseFloat(e.target.value)})} />
                        
                        <Select label="Status" value={editingOrder.status} onChange={(e: any) => setEditingOrder({...editingOrder, status: e.target.value})}>
                            <option value="Pending Approval">Pending Approval</option>
                            <option value="Ordered">Ordered (Awaiting Delivery)</option>
                            <option value="Fulfilled">Fulfilled / Picked Up</option>
                        </Select>

                        <div className="flex justify-end gap-4 pt-4">
                            <Button variant="secondary" type="button" onClick={() => setEditingOrder(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                </Modal>
             )}

             {updatingShopOrder && (
                 <Modal isOpen={true} onClose={() => setUpdatingShopOrder(null)} title="Update Order Status">
                     <div className="space-y-4">
                         <p className="text-gray-600 dark:text-gray-300 mb-4">Select new status for order placed by <span className="text-gray-900 dark:text-white font-bold">{updatingShopOrder.customer.name}</span>.</p>
                         <div className="grid grid-cols-1 gap-2">
                             {['Pending', 'Fulfilled', 'Installed', 'Order Complete (Not Fulfilled)'].map(status => (
                                 <button
                                    key={status}
                                    onClick={() => handleUpdateShopOrder(updatingShopOrder, status)}
                                    className={`p-3 rounded text-left font-medium transition-colors ${
                                        updatingShopOrder.status === status 
                                            ? 'bg-primary-600 text-white' 
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                 >
                                     {status}
                                 </button>
                             ))}
                         </div>
                         <div className="flex justify-end pt-4">
                            <Button variant="secondary" onClick={() => setUpdatingShopOrder(null)}>Cancel</Button>
                         </div>
                     </div>
                 </Modal>
             )}

            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Orders Management</h2>
                    <p className="text-gray-600 dark:text-gray-400">Parts & Shop Orders.</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 flex">
                    <button 
                        onClick={() => setViewMode('internal')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'internal' ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        Part Requests (Internal)
                    </button>
                    <button 
                        onClick={() => setViewMode('external')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'external' ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        Shop Orders (Website)
                    </button>
                </div>
            </header>
            
            {viewMode === 'internal' ? (
                 <Card>
                    <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-4">Technician Part Requests & Logs</h3>
                    <Table headers={['Status', 'Method', 'Customer / Job', 'Parts List', 'Cost', 'Actions']}>
                        {partOrders.map((order: any) => (
                            <tr key={order.id} className="group">
                                 <td className="px-6 py-4">
                                     <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${
                                        order.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 
                                        order.status === 'Pending Approval' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                        'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                                        }`}>
                                         {order.status || 'Pending'}
                                     </span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                        {order.fulfillmentMethod || 'Unknown'}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4">
                                     <div className="text-gray-900 dark:text-white font-medium">{order.customerName}</div>
                                     <div className="text-xs text-gray-500">{order.jobAddress}</div>
                                 </td>
                                 <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm whitespace-pre-wrap max-w-xs">{order.parts}</td>
                                 <td className="px-6 py-4 text-red-600 dark:text-red-400 font-bold">-${order.cost?.toFixed(2)}</td>
                                 <td className="px-6 py-4">
                                     <div className="flex items-center gap-3">
                                         {order.status !== 'Fulfilled' && (
                                             <button onClick={() => handleFulfillOrder(order)} className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-bold">Fulfill</button>
                                         )}
                                         <button onClick={() => handleEditOrder(order)} className="text-primary-600 dark:text-primary-400 hover:underline text-xs font-bold">Edit</button>
                                         <button onClick={() => handleDeleteOrder(order.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                                            <Trash2 size={16}/>
                                        </button>
                                     </div>
                                 </td>
                            </tr>
                        ))}
                         {partOrders.length === 0 && (
                            <tr><td colSpan={6} className="p-6 text-center text-gray-500">No part orders found.</td></tr>
                        )}
                    </Table>
                </Card>
            ) : (
                <Card>
                    <h3 className="text-lg font-bold text-green-600 dark:text-green-400 mb-4">Website Shop Orders</h3>
                    <Table headers={['Date', 'Customer', 'Items', 'Total', 'Status', 'Actions']}>
                        {shopOrders.map((order) => (
                            <tr key={order.id}>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">
                                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Unknown Date'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-gray-900 dark:text-white font-medium">{order.customer.name}</div>
                                    <div className="text-xs text-gray-500">{order.customer.email}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">
                                    {order.items.map((item, i) => (
                                        <div key={i}>{item.quantity}x {item.name}</div>
                                    ))}
                                </td>
                                <td className="px-6 py-4 text-green-600 dark:text-green-400 font-bold">${order.total.toFixed(2)}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full border uppercase ${
                                        order.status === 'Fulfilled' || order.status === 'Installed' 
                                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30' 
                                            : order.status?.includes('Complete')
                                                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
                                                : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30'
                                    }`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 flex gap-2">
                                     <button onClick={() => setUpdatingShopOrder(order)} className="text-primary-600 dark:text-primary-400 hover:underline text-xs">Update Status</button>
                                     <button onClick={() => handleDeleteShopOrder(order.id)} className="text-red-600 dark:text-red-400 hover:underline text-xs">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {shopOrders.length === 0 && (
                            <tr><td colSpan={6} className="p-6 text-center text-gray-500">No shop orders received yet.</td></tr>
                        )}
                    </Table>
                </Card>
            )}
        </div>
    );
};

export const UnpaidInvoicesView: React.FC = () => {
    const { state } = useAppContext();
    const invoices = (state.jobs as Job[]).filter(j => j.invoice?.status === 'Unpaid' || j.invoice?.status === 'Pending');

    return (
        <div>
            <BackButton />
            <header className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Unpaid Invoices</h2>
                <p className="text-gray-600 dark:text-gray-400">Outstanding balances requiring payment (Unpaid & Pending).</p>
            </header>
            <Card>
                <Table headers={['Invoice ID', 'Customer', 'Date Scheduled', 'Amount', 'Status']}>
                    {invoices.map(job => (
                        <tr key={job.id}>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-mono text-sm">{job.invoice?.id || 'N/A'}</td>
                            <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                                {job.customerName}
                                <div className="text-xs text-gray-500">{formatAddress(job.address)}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-yellow-600 dark:text-yellow-400 font-bold text-lg">${(job.invoice?.totalAmount || job.invoice?.amount || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 text-sm">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${job.invoice?.status === 'Pending' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                                    {job.invoice?.status || 'Unknown'}
                                </span>
                            </td>
                        </tr>
                    ))}
                     {invoices.length === 0 && (
                        <tr><td colSpan={5} className="p-6 text-center text-gray-500">No unpaid invoices. Good job!</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};
