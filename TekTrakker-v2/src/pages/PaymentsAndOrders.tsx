
import React, { useState, useMemo, useEffect } from 'react';
import Card from 'components/ui/Card';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import Spinner from 'components/ui/Spinner';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { PartOrder, InvoiceLineItem, Job, Proposal, ShopOrder, Customer } from 'types';
import InvoiceEditorModal from 'components/modals/InvoiceEditorModal';
import { useNavigate } from 'react-router-dom';
import { FileText, Briefcase, Wrench, Edit, Trash2, Plus, CreditCard, Send, CheckCircle, RefreshCw, Search, User } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";

const PaymentsAndOrders: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'invoices' | 'proposals' | 'parts'>('invoices');
    const [searchTerm, setSearchTerm] = useState('');

    // --- STATE: INVOICES ---
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [showPaidInvoices, setShowPaidInvoices] = useState(false);
    
    // Customer Selection State
    const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
    const [custSearch, setCustSearch] = useState('');
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    
    // --- STATE: PARTS ---
    const [selectedJobId, setSelectedJobId] = useState<string>(state.jobs[0]?.id || '');
    const [partsList, setPartsList] = useState('');
    const [partCost, setPartCost] = useState('');
    const [fulfillmentMethod, setFulfillmentMethod] = useState<'Truck Stock' | 'Purchase' | 'Special Order'>('Truck Stock');
    const [priceChecked, setPriceChecked] = useState(false);
    const [orderStatus, setOrderStatus] = useState('');
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

    // --- FILTERED LISTS ---
    const filteredInvoices = useMemo(() => {
        return state.jobs
            .filter(j => j.invoice && (showPaidInvoices || j.invoice.status !== 'Paid'))
            .filter(j => 
                (j.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                (j.invoice.id || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a,b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime());
    }, [state.jobs, showPaidInvoices, searchTerm]);

    const filteredProposals = useMemo(() => {
        return state.proposals
            .filter(p => (p.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [state.proposals, searchTerm]);

    const filteredCustomers = useMemo(() => {
        if (!custSearch) return [];
        return state.customers.filter(c => 
            c.name.toLowerCase().includes(custSearch.toLowerCase()) || 
            c.phone.includes(custSearch)
        ).slice(0, 5);
    }, [state.customers, custSearch]);

    // --- ACTIONS: INVOICES ---
    const handleInitCreateInvoice = () => {
        setCustSearch('');
        setIsCustomerSelectOpen(true);
    };

    const handleCreateInvoice = async (customer?: Customer) => {
        if (isCreatingInvoice) return;
        setIsCreatingInvoice(true);
        setIsCustomerSelectOpen(false);

        const id = `job-inv-${Date.now()}`;
        const newJob: Job = {
            id,
            organizationId: state.currentOrganization?.id || '',
            customerName: customer ? customer.name : 'New Customer', 
            customerId: customer ? customer.id : null,
            customerEmail: customer ? customer.email : '',
            customerPhone: customer ? customer.phone : '',
            address: customer ? customer.address : '',
            tasks: ['Service Call'],
            jobStatus: 'Completed', 
            appointmentTime: new Date().toISOString(),
            specialInstructions: '',
            invoice: {
                id: `INV-${Date.now()}`,
                status: 'Unpaid',
                items: [],
                subtotal: 0,
                taxRate: (state.currentOrganization?.taxRate || 8.25) / 100,
                taxAmount: 0,
                totalAmount: 0,
                amount: 0
            },
            jobEvents: []
        };
        
        try {
            await db.collection('jobs').doc(id).set(newJob);
            setEditingInvoiceId(id);
        } catch (e) {
            console.error(e);
            alert("Failed to create invoice.");
        } finally {
            setIsCreatingInvoice(false);
        }
    };

    const handleDeleteInvoice = async (jobId: string) => {
        if (await globalConfirm("Delete this invoice record?")) {
            await db.collection('jobs').doc(jobId).delete();
        }
    };

    // --- ACTIONS: PROPOSALS ---
    const handleCreateProposal = () => {
        navigate('/proposal');
    };

    const handleEditProposal = (id: string) => {
        navigate(`/proposal?proposalId=${id}`);
    };

    const handleDeleteProposal = async (id: string) => {
        if (await globalConfirm("Delete this proposal?")) {
            await db.collection('proposals').doc(id).delete();
        }
    };

    // --- ACTIONS: PARTS ---
    const handleOrderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmittingOrder) return;
        
        const cost = parseFloat(partCost);
        if (isNaN(cost) || cost < 0) return;
        
        setIsSubmittingOrder(true);
        setOrderStatus('Submitting...');
        
        try {
            const jobToUpdate = state.jobs.find(job => job.id === selectedJobId);
            if (jobToUpdate) {
                const itemDescription = fulfillmentMethod === 'Special Order' 
                    ? `${partsList} (On Order)` 
                    : partsList;

                const newInvoiceItem: InvoiceLineItem = {
                    id: `item-${Date.now()}`,
                    name: `Parts: ${fulfillmentMethod}`,
                    description: itemDescription,
                    quantity: 1,
                    unitPrice: cost,
                    total: cost,
                    type: 'Part',
                    taxable: true
                };

                const currentItems = jobToUpdate.invoice?.items || [];
                const updatedItems = [...currentItems, newInvoiceItem];
                
                const subtotal = updatedItems.reduce((sum, item) => sum + (item.total || 0), 0);
                const taxRate = jobToUpdate.invoice?.taxRate || 0;
                const taxAmount = subtotal * taxRate;
                const totalAmount = subtotal + taxAmount;

                const updatedJob = {
                    ...jobToUpdate,
                    invoice: { 
                        ...jobToUpdate.invoice, 
                        items: updatedItems,
                        subtotal,
                        taxAmount,
                        totalAmount,
                        amount: totalAmount // keep legacy amount in sync
                    }
                };
                await db.collection('jobs').doc(jobToUpdate.id).update(updatedJob);
            }
            
            const status = fulfillmentMethod === 'Special Order' ? 'Pending Approval' : 'Fulfilled';

            const newPartOrder: any = {
                id: `order-${Date.now()}`,
                organizationId: state.currentOrganization?.id || '',
                jobId: selectedJobId,
                parts: partsList,
                cost: cost,
                status: status,
                fulfillmentMethod: fulfillmentMethod,
                orderedBy: state.currentUser?.id,
                createdAt: new Date().toISOString()
            };

            await db.collection('partOrders').doc(newPartOrder.id).set(newPartOrder);
            
            setOrderStatus(`Order submitted successfully.`);
            setPartsList('');
            setPartCost('');
            setPriceChecked(false);
            setFulfillmentMethod('Truck Stock');
            setTimeout(() => setOrderStatus(''), 5000);
        } catch (error) {
            console.error("Error submitting part order:", error);
            setOrderStatus('Failed to submit order.');
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    const handleDeletePartOrder = async (orderId: string) => {
        if (await globalConfirm("Are you sure you want to delete this part order?")) {
            try {
                await db.collection('partOrders').doc(orderId).delete();
            } catch (error) {
                console.error("Error deleting part order:", error);
                alert("Failed to delete order.");
            }
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-32">
            {/* Customer Select Modal */}
            <Modal isOpen={isCustomerSelectOpen} onClose={() => setIsCustomerSelectOpen(false)} title="Select Customer for Invoice">
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                        <Input 
                            placeholder="Search by name or phone..." 
                            value={custSearch} 
                            onChange={e => setCustSearch(e.target.value)} 
                            className="pl-10"
                            autoFocus
                        />
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto border rounded-lg bg-gray-50 dark:bg-gray-800 p-2 space-y-2">
                        <div 
                            onClick={() => handleCreateInvoice(undefined)}
                            className="p-3 bg-white dark:bg-gray-700 rounded border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3"
                        >
                            <div className="bg-blue-100 text-blue-600 p-2 rounded-full"><Plus size={16}/></div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white">Create Blank Invoice</p>
                                <p className="text-xs text-gray-500">I will enter details manually</p>
                            </div>
                        </div>

                        {filteredCustomers.map(c => (
                            <div 
                                key={c.id} 
                                onClick={() => handleCreateInvoice(c)}
                                className="p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-blue-500 transition-colors flex items-center gap-3"
                            >
                                <div className="bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 p-2 rounded-full"><User size={16}/></div>
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">{c.name}</p>
                                    <p className="text-xs text-gray-500">{c.address} • {c.phone}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex justify-end">
                        <Button variant="secondary" onClick={() => setIsCustomerSelectOpen(false)}>Cancel</Button>
                    </div>
                </div>
            </Modal>

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sales & Payments</h2>
                    <p className="text-gray-600 dark:text-gray-400">Manage invoices, estimates, and orders.</p>
                </div>
                {activeTab === 'invoices' && (
                    <Button onClick={handleInitCreateInvoice} disabled={isCreatingInvoice} className="w-auto flex items-center gap-2 text-xs">
                        {isCreatingInvoice ? <RefreshCw className="animate-spin" size={16}/> : <Plus size={16}/>} New Invoice
                    </Button>
                )}
                {activeTab === 'proposals' && (
                    <Button onClick={handleCreateProposal} className="w-auto flex items-center gap-2 text-xs bg-purple-600 hover:bg-purple-700">
                        <Plus size={16}/> New Proposal
                    </Button>
                )}
            </header>

            {/* TAB NAV */}
            <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('invoices')}
                    className={`flex-1 shrink-0 min-w-[120px] whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'invoices' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                    <FileText size={16}/> Invoices
                </button>
                <button 
                    onClick={() => setActiveTab('proposals')}
                    className={`flex-1 shrink-0 min-w-[120px] whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'proposals' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                    <Briefcase size={16}/> Proposals
                </button>
                <button 
                    onClick={() => setActiveTab('parts')}
                    className={`flex-1 shrink-0 min-w-[120px] whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${activeTab === 'parts' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                    <Wrench size={16}/> Parts
                </button>
            </div>

            {/* CONTENT */}
            {activeTab === 'invoices' && (
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <Input 
                            label="" 
                            placeholder="Search invoices..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="flex-1 dark:text-white"
                        />
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 rounded border border-gray-200 dark:border-gray-700">
                            <input type="checkbox" checked={showPaidInvoices} onChange={e => setShowPaidInvoices(e.target.checked)} id="showPaid" />
                            <label htmlFor="showPaid" className="text-sm text-gray-600 dark:text-gray-300">Show Paid</label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {filteredInvoices.map(job => (
                            <div key={job.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white text-lg">{job.customerName}</span>
                                        <span className="text-xs text-gray-500 font-mono">#{job.invoice.id}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(job.appointmentTime).toLocaleDateString()}</p>
                                    <div className="mt-1">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${job.invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {job.invoice.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2 w-full sm:w-auto">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">${(job.invoice.totalAmount || job.invoice.amount).toFixed(2)}</span>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button variant="secondary" onClick={() => handleDeleteInvoice(job.id)} className="text-red-500 px-3 py-1 text-xs border-red-200 hover:bg-red-50">
                                            <Trash2 size={14}/>
                                        </Button>
                                        <Button onClick={() => setEditingInvoiceId(job.id)} className="px-4 py-1 text-xs flex items-center justify-center gap-2 flex-1">
                                            <Edit size={14}/> Manage
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredInvoices.length === 0 && <p className="text-center text-gray-500 py-4 md:py-8">No invoices found.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'proposals' && (
                <div className="space-y-4">
                    <Input 
                        label="" 
                        placeholder="Search proposals..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="dark:text-white"
                    />
                    
                    <div className="grid grid-cols-1 gap-4">
                        {filteredProposals.map(p => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white text-lg">{p.customerName}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${p.status === 'Accepted' ? 'bg-green-100 text-green-800 border-green-200' : p.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                                            {p.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</p>
                                    <p className="text-xs text-gray-400 mt-1">Option: {p.selectedOption || 'Standard'}</p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2 w-full sm:w-auto">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">${p.total.toFixed(2)}</span>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button variant="secondary" onClick={() => handleDeleteProposal(p.id)} className="text-red-500 px-3 py-1 text-xs border-red-200 hover:bg-red-50">
                                            <Trash2 size={14}/>
                                        </Button>
                                        <Button onClick={() => handleEditProposal(p.id)} className="px-4 py-1 text-xs flex items-center justify-center gap-2 flex-1 bg-purple-600 hover:bg-purple-700">
                                            <Edit size={14}/> Edit
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredProposals.length === 0 && <p className="text-center text-gray-500 py-4 md:py-8">No proposals found.</p>}
                    </div>
                </div>
            )}

            {activeTab === 'parts' && (
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-4">Parts Action / Request</h3>
                        <form onSubmit={handleOrderSubmit} className="space-y-4">
                            <Select label="Select Job" id="job-select" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className="dark:text-white">
                                {state.jobs.map(job => (
                                <option key={job.id} value={job.id}>{job.customerName}</option>
                                ))}
                            </Select>

                            <Select label="Fulfillment Method" id="fulfillment-select" value={fulfillmentMethod} onChange={e => setFulfillmentMethod(e.target.value as any)} className="dark:text-white">
                                <option value="Truck Stock">Use Parts on Hand (Truck Stock)</option>
                                <option value="Purchase">Purchase at Supply House</option>
                                <option value="Special Order">Request Special Order (From Office)</option>
                            </Select>

                            <Textarea id="parts-list" label="Parts Description" value={partsList} onChange={e => setPartsList(e.target.value)} required placeholder="e.g. 1/2 inch copper pipe, 10ft" />
                            <Input id="part-cost" label="Charge to Customer ($)" type="number" step="0.01" value={partCost} onChange={e => setPartCost(e.target.value)} required className="dark:text-white" />
                            
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" className="h-5 w-5 rounded bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" checked={priceChecked} onChange={e => setPriceChecked(e.target.checked)} />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Customer pricing checked?</span>
                            </label>

                            <Button type="submit" disabled={!partsList || !selectedJobId || !partCost || !priceChecked || isSubmittingOrder}>
                                {isSubmittingOrder ? <Spinner size="sm" /> : 'Log Part / Submit Request'}
                            </Button>
                            {orderStatus && <p className="text-sm text-center text-green-600 dark:text-green-400 mt-2">{orderStatus}</p>}
                        </form>
                    </Card>

                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Logs & Orders</h3>
                        <div className="space-y-4">
                            {state.partOrders.map(order => (
                                <div key={order.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 flex justify-between items-center group">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold text-sm text-gray-900 dark:text-white">{order.parts}</p>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                                (order as any).fulfillmentMethod === 'Special Order' ? 'bg-purple-100 text-purple-700' :
                                                (order as any).fulfillmentMethod === 'Purchase' ? 'bg-amber-100 text-amber-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {(order as any).fulfillmentMethod || 'Order'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-center gap-2">
                                            Status: <span className={order.status === 'Pending Approval' ? 'text-amber-500 font-medium' : 'text-emerald-500 font-medium'}>{order.status}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-gray-900 dark:text-white">${order.cost.toFixed(2)}</span>
                                        <button 
                                            onClick={() => handleDeletePartOrder(order.id)} 
                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete Log"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {state.partOrders.length === 0 && <p className="text-sm text-gray-500 text-center italic py-4">No recent parts logged.</p>}
                        </div>
                    </Card>
                </div>
            )}

            {editingInvoiceId && (
                <InvoiceEditorModal 
                    isOpen={true} 
                    onClose={() => setEditingInvoiceId(null)} 
                    jobId={editingInvoiceId} 
                />
            )}
        </div>
    );
};

export default PaymentsAndOrders;
