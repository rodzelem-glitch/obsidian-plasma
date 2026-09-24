import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import type { Job, PartOrder, InvoiceLineItem, ShopOrder, Customer } from 'types';
import { formatAddress , cleanUndefinedFields } from 'lib/utils';
import { Trash2, Mail, Search, Calendar, Filter, ShieldCheck, Wrench, Plus, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { extractAllUpcomingMaintenance, UpcomingMaintenanceItem, calculateEquipmentMaintenanceSchedule } from 'lib/maintenanceHelper';
import { db } from 'lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { globalConfirm } from "lib/globalConfirm";
import { isNotificationRead, handleNotificationClick } from 'lib/notificationNavigator';

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
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor')
    );
    
    return (
        <div>
            <BackButton />
            
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
                    const effectiveTaxRate = typeof job.invoice.taxRate === 'number' ? job.invoice.taxRate : 0;
                    const newTax = typeof job.invoice.taxAmount === 'number' && job.invoice.taxAmount > 0 ? job.invoice.taxAmount : newSubtotal * effectiveTaxRate;
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
                    showToast.warn('Invoice updated with parts.');
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
                        <Textarea label="Parts List" value={editingOrder.parts} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingOrder({...editingOrder, parts: e.target.value})} />
                        <Input label="Cost ($)" type="number" value={editingOrder.cost} onChange={e => setEditingOrder({...editingOrder, cost: parseFloat(e.target.value)})} />
                        
                        <Select label="Status" value={editingOrder.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditingOrder({...editingOrder, status: e.target.value as PartOrder['status']})}>
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
                        {partOrders.map((order: PartOrder & { fulfillmentMethod?: string, customerName?: string, jobAddress?: string }) => (
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
                                    {(order.createdAt as any)?.toDate ? (order.createdAt as any).toDate().toLocaleDateString() : 'Unknown Date'}
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
    const navigate = useNavigate();
    const invoices = (state.jobs as Job[]).filter(j => {
        const statusStr = (j.invoice?.status as string);
        if (!j.invoice || statusStr === 'Paid' || statusStr === 'Cancelled' || statusStr === 'Void') return false;
        const total = Number(j.invoice.totalAmount) ?? Number(j.invoice.amount) ?? 0;
        const paid = Number(j.invoice.amountPaid) || 0;
        return (total - paid) > 0 || j.invoice.status === 'Unpaid' || j.invoice.status === 'Pending';
    });

    return (
        <div>
            <BackButton />
            
            <Card>
                <Table headers={['Invoice ID', 'Customer', 'Date Scheduled', 'Balance Due', 'Status', 'Actions']}>
                    {invoices.map(job => {
                        const total = Number(job.invoice?.totalAmount) ?? Number(job.invoice?.amount) ?? 0;
                        const paid = Number(job.invoice?.amountPaid) || 0;
                        const balance = paid > 0 ? Math.max(0, total - paid) : total;
                        return (
                            <tr key={job.id}>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-mono text-sm">{job.invoice?.id || 'N/A'}</td>
                                <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                                    {job.customerName}
                                    <div className="text-xs text-gray-500">{formatAddress(job.address)}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-yellow-600 dark:text-yellow-400 font-bold text-lg">
                                    ${balance.toFixed(2)}
                                    {paid > 0 && <span className="text-xs text-gray-400 font-normal block">(${total.toFixed(2)} total)</span>}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${job.invoice?.status === 'Pending' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                                        {job.invoice?.status || 'Unknown'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    <button 
                                        onClick={() => navigate(`/admin/records?tab=history&histId=${job.id}`)}
                                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-bold hover:underline"
                                    >
                                        View Job
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                     {invoices.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-500">No unpaid invoices. Good job!</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};


export const UpcomingMaintenanceView: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [timeFilter, setTimeFilter] = useState<'all' | 'overdue' | '30' | '45' | '60' | '90' | '180'>('45');
    const [searchQuery, setSearchQuery] = useState('');
    const now = new Date();

    const upcomingList = useMemo(() => {
        return extractAllUpcomingMaintenance(
            state.customers || [],
            state.serviceAgreements || [],
            now,
            timeFilter,
            searchQuery
        );
    }, [state.customers, state.serviceAgreements, timeFilter, searchQuery]);

    // Quick stats across all tracked equipment
    const stats = useMemo(() => {
        const all = extractAllUpcomingMaintenance(state.customers || [], state.serviceAgreements || [], now, 'all', '');
        const overdue = all.filter(i => i.isOverdue).length;
        const dueSoon = all.filter(i => !i.isOverdue && i.daysUntil <= 45).length;
        const total = all.length;
        return { overdue, dueSoon, total };
    }, [state.customers, state.serviceAgreements]);

    const handleSendReminder = async (item: UpcomingMaintenanceItem) => {
        if (!item.customer.email) {
            showToast.warn("No email address found for this customer.");
            return;
        }
        const confirmMsg = `Send an automated reminder email to ${item.customer.name} (${item.customer.email}) for their ${item.asset.brand ? item.asset.brand + ' ' : ''}${item.asset.type || 'equipment'}?`;
        if (await globalConfirm(confirmMsg)) {
            try {
                const orgName = state.currentOrganization?.name || 'Service Provider';
                const orgEmail = state.currentOrganization?.email || '';
                const orgLicense = state.currentOrganization?.settings?.licenseNumber || state.currentOrganization?.licenseNumber || '';
                const portalUrl = `https://tektrakker-v2.web.app/#/portal/auth?orgId=${item.customer.organizationId || state.currentOrganization?.id || ''}`;
                
                const licenseFooterText = orgLicense ? `\n\nState License: ${orgLicense}` : '';
                const licenseFooterHtml = orgLicense ? `<br/><br/><small style="color:#6b7280;font-size:12px;">State License: ${orgLicense}</small>` : '';

                const timingText = item.isOverdue 
                    ? `is overdue for routine preventative maintenance by ${Math.abs(item.daysUntil)} days`
                    : `is due for routine warranty maintenance in ${item.daysUntil} days`;

                await addDoc(collection(db, 'mail'), {
                     toUids: [item.customer.id],
                     to: item.customer.email,
                     message: {
                         from: `${orgName} <no-reply@tektrakker.com>`,
                         ...(orgEmail ? { replyTo: orgEmail } : {}),
                         subject: `Action Required: Routine Maintenance due for your ${item.asset.brand || ''} Equipment`,
                         text: `Hello ${item.customer.name || 'Valued Customer'},\n\nThis is a friendly reminder from ${orgName} that your ${item.asset.brand ? item.asset.brand + ' ' : ''}${item.asset.type || 'equipment'} ${timingText}.\n\nPlease schedule an appointment through your portal to maintain peak efficiency and warranty compliance: ${portalUrl}\n\nThank you,\n${orgName}${licenseFooterText}`,
                         html: `<p>Hello <strong>${item.customer.name || 'Valued Customer'}</strong>,</p>
                                <p>This is a friendly reminder from <strong>${orgName}</strong> that your <strong>${item.asset.brand ? item.asset.brand + ' ' : ''}${item.asset.type || 'equipment'}</strong> ${timingText}.</p>
                                <p>Routine maintenance protects equipment longevity, keeps utility bills low, and preserves warranty compliance.</p>
                                <p><a href="${portalUrl}" style="background-color:#2563eb;color:white;padding:10px 18px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px;font-weight:bold;">Access Service Portal to Schedule</a></p>
                                <p>Thank you,<br/><strong>${orgName}</strong></p>${licenseFooterHtml}`
                     }
                });
                showToast.success(`Reminder email queued for ${item.customer.name}!`);
            } catch (e: unknown) {
                console.error("Failed to queue mail docs", e);
                showToast.warn(`Failed to send: ${(e as Error).message}`);
            }
        }
    };

    return (
        <div className="space-y-4">
            <BackButton />

            {/* Header with Title and KPI Quick Counters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Wrench className="text-indigo-500" size={22} />
                        Equipment Maintenance & Repeat Service Tracker
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Track upcoming preventative maintenance across all customer equipment to drive recurring service revenue.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs">
                        <span className="text-red-700 dark:text-red-400 font-bold">{stats.overdue} Overdue</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs">
                        <span className="text-amber-700 dark:text-amber-400 font-bold">{stats.dueSoon} Due (≤45d)</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-bold">{stats.total} Total Tracked</span>
                    </div>
                </div>
            </div>

            {/* Controls Bar: Time Filter & Search */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search customer, phone, brand, model..."
                        className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                            &times;
                        </button>
                    )}
                </div>

                {/* Time Window Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto custom-scrollbar pb-1 md:pb-0">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1 shrink-0">
                        <Filter size={12} /> Window:
                    </span>
                    {[
                        { id: 'overdue', label: 'Overdue' },
                        { id: '30', label: 'Next 30d' },
                        { id: '45', label: 'Next 45d' },
                        { id: '90', label: 'Next 90d' },
                        { id: '180', label: 'Next 6mo' },
                        { id: 'all', label: 'All Tracked' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setTimeFilter(tab.id as any)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                                timeFilter === tab.id
                                    ? 'bg-primary-600 text-white font-bold shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            
            <Card>
                <Table headers={['Customer', 'Equipment', 'Last Serviced', 'Next Due', 'Status', 'Actions']}>
                    {upcomingList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="text-gray-900 dark:text-white font-semibold flex items-center gap-1.5">
                                    {item.customer.name}
                                    {item.isAgreementCovered && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="Active Service Agreement Member">
                                            {item.agreementName || 'Club Member'}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500">{item.customer.phone || 'No phone'}</div>
                                {item.customer.address && <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.customer.address}</div>}
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-semibold text-slate-800 dark:text-slate-100">
                                    {item.asset.brand || 'HVAC'} - {item.asset.type || 'System'}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                    M/N: {item.asset.model || 'Unknown'} {item.asset.serial ? `• S/N: ${item.asset.serial}` : ''}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                {item.lastServicedDate ? item.lastServicedDate.toLocaleDateString() : (
                                    <span className="text-xs italic text-slate-400">Initial Service Due</span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-bold text-gray-900 dark:text-white text-sm">
                                    {item.nextDate.toLocaleDateString()}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {item.intervalMonths} mo routine cycle
                                </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                                {item.isOverdue ? (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 inline-flex items-center gap-1 border border-red-200 dark:border-red-800">
                                        <AlertTriangle size={12} /> Overdue ({Math.abs(item.daysUntil)} days)
                                    </span>
                                ) : item.daysUntil <= 30 ? (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 inline-flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                                        <Clock size={12} /> Due in {item.daysUntil} days
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                                        <CheckCircle size={12} /> Due in {item.daysUntil} days
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleSendReminder(item)}
                                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-200 dark:border-blue-800 shadow-sm"
                                        title="Queue automated reminder email to customer"
                                    >
                                        <Mail size={13} /> Send Reminder
                                    </button>
                                    <button
                                        onClick={() => navigate(`/admin/operations?tab=scheduling&customerId=${item.customer.id}`)}
                                        className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800 shadow-sm"
                                        title="Dispatch or schedule a maintenance appointment for this customer"
                                    >
                                        <Calendar size={13} /> Book Service
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {upcomingList.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500">
                                <Wrench size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                                <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                                    No equipment due within this window.
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {searchQuery ? 'Try clearing your search query, or select' : 'Select'} &quot;All Tracked&quot; or &quot;Next 90d&quot; to inspect all equipment schedules.
                                </p>
                            </td>
                        </tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};

export const ActiveWarrantiesView: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const now = new Date();
    const addMonths = (d: Date, m: number) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };

    const warrantyRows: { customerId: string; customerName: string; phone: string; equipmentLabel: string; warrantyType: string; expiryDate: Date; nextPmDate: Date | null; pmStatus: string; daysUntilPm: number | null; }[] = [];

    state.customers.forEach(customer => {
        (customer.equipment || []).forEach(asset => {
            const w = asset.warranty;
            if (!w) return;
            const mfgStart = w.manufacturerStartDate ? new Date(w.manufacturerStartDate) : null;
            const mfgExpiry = mfgStart && w.manufacturerDurationMonths ? addMonths(mfgStart, w.manufacturerDurationMonths) : null;
            const labStart = w.laborStartDate ? new Date(w.laborStartDate) : null;
            const labExpiry = labStart && w.laborDurationMonths ? addMonths(labStart, w.laborDurationMonths) : null;
            const latestExpiry = [mfgExpiry, labExpiry].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];
            if (!latestExpiry || latestExpiry <= now) return;
            
            const calc = calculateEquipmentMaintenanceSchedule(asset, customer, now);
            let nextPmDate: Date | null = null;
            let daysUntilPm: number | null = null;
            let pmStatus = 'n/a';
            if (!calc.isOptedOut) {
                nextPmDate = calc.nextDate;
                daysUntilPm = calc.daysUntil;
                pmStatus = calc.isOverdue ? 'overdue' : calc.daysUntil <= 30 ? 'upcoming' : 'ok';
            }
            const types: string[] = [];
            if (mfgExpiry && mfgExpiry > now) types.push('Manufacturer');
            if (labExpiry && labExpiry > now) types.push('Labor');
            warrantyRows.push({ customerId: customer.id, customerName: customer.name, phone: customer.phone || '', equipmentLabel: `${asset.brand || ''} ${asset.type || 'System'}`.trim(), warrantyType: types.join(' + ') || 'Equipment', expiryDate: latestExpiry, nextPmDate, pmStatus, daysUntilPm });
        });
    });

    (state.jobs as Job[]).forEach(job => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inv = job.invoice as any;
        if (!inv || !inv.warrantyDisclaimerAgreed) return;
        const wm = inv.workmanshipWarrantyMonths || 0;
        const pm = inv.partsWarrantyMonths || 0;
        if (!wm && !pm) return;
        const issued = new Date(job.appointmentTime);
        const wExpiry = wm > 0 ? addMonths(issued, wm) : null;
        const pExpiry = pm > 0 ? addMonths(issued, pm) : null;
        const latestExpiry = [wExpiry, pExpiry].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];
        if (!latestExpiry || latestExpiry <= now) return;
        const types: string[] = [];
        if (wExpiry && wExpiry > now) types.push('Workmanship');
        if (pExpiry && pExpiry > now) types.push('Parts');
        warrantyRows.push({ customerId: job.customerId || '', customerName: job.customerName || 'Unknown', phone: '', equipmentLabel: 'Invoice Coverage', warrantyType: types.join(' + '), expiryDate: latestExpiry, nextPmDate: null, pmStatus: 'n/a', daysUntilPm: null });
    });

    warrantyRows.sort((a, b) => {
        const aPm = a.nextPmDate ? a.nextPmDate.getTime() : Infinity;
        const bPm = b.nextPmDate ? b.nextPmDate.getTime() : Infinity;
        if (aPm !== bPm) return aPm - bPm;
        return a.expiryDate.getTime() - b.expiryDate.getTime();
    });

    return (
        <div>
            <BackButton />
            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Active Warranty Customers</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{warrantyRows.length} active warranties &bull; Sorted by next PM service due</p>
            </div>
            <Card>
                <Table headers={['Customer', 'Equipment', 'Warranty Type', 'Warranty Expires', 'Next PM Due', 'PM Status']}>
                    {warrantyRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors" onClick={() => navigate(`/admin/customers?custId=${row.customerId}`)}>
                            <td className="px-6 py-4">
                                <div className="text-gray-900 dark:text-white font-medium">{row.customerName}</div>
                                {row.phone && <div className="text-xs text-gray-500">{row.phone}</div>}
                            </td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">{row.equipmentLabel}</td>
                            <td className="px-6 py-4">
                                <span className="px-2 py-1 text-xs font-bold rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">{row.warrantyType}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.expiryDate.toLocaleDateString()}</td>
                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                {row.nextPmDate ? row.nextPmDate.toLocaleDateString() : <span className="text-gray-400 font-normal text-xs">No PM required</span>}
                            </td>
                            <td className="px-6 py-4">
                                {row.pmStatus === 'overdue' && <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Overdue ({Math.abs(row.daysUntilPm!)} days)</span>}
                                {row.pmStatus === 'upcoming' && <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Due in {row.daysUntilPm} days</span>}
                                {row.pmStatus === 'ok' && <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">OK ({row.daysUntilPm} days)</span>}
                                {row.pmStatus === 'n/a' && <span className="text-xs text-gray-400">&mdash;</span>}
                            </td>
                        </tr>
                    ))}
                    {warrantyRows.length === 0 && (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-500">No active warranties found.</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};

export const AlertsCenterView: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    
    // Filter alerts to system_alert only, for the current user
    const alerts = state.notifications.filter((n: any) => {
        if (n.type !== 'system_alert') return false;
        return n.userId === state.currentUser?.id ||
               n.userId === state.currentUser?.email ||
               n.userId === 'all' ||
               (state.currentUser?.role === 'master_admin' && (n.userId === 'rodzelem@gmail.com' || n.userId === 'ryanvavrecan@gmail.com')) ||
               (n.userId === 'all_admins' && (state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both'));
    });

    const onAlertClick = (n: any) => {
        handleNotificationClick(n, {
            currentUser: state.currentUser,
            navigate,
            dispatch
        });
    };

    return (
        <div>
            <BackButton />
            <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Compliance Alerts Center</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Centralized view for your system compliance alerts and notifications.</p>
            </div>
            <Card>
                <Table headers={['Date', 'Title', 'Message', 'Status', 'Actions']}>
                    {alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(alert => (
                        <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors" onClick={() => onAlertClick(alert)}>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{new Date(alert.createdAt).toLocaleString()}</td>
                            <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold">{alert.title}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{alert.message || (alert as any).body}</td>
                            <td className="px-6 py-4">
                                {isNotificationRead(alert, state.currentUser) ? (
                                    <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Read</span>
                                ) : (
                                    <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Action Required</span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); onAlertClick(alert); }}>
                                    View
                                </Button>
                            </td>
                        </tr>
                    ))}
                    {alerts.length === 0 && (
                        <tr><td colSpan={5} className="p-6 text-center text-gray-500">No compliance alerts found.</td></tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};
