
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import { UserCheck, Building2, MoveRight, Search, AlertCircle, RefreshCw, Calendar, MapPin } from 'lucide-react';
import { db } from 'lib/firebase';
import type { Customer, Appointment } from 'types';
import { useNavigate } from 'react-router-dom';
import { globalConfirm } from "lib/globalConfirm";

interface CustomerWithRequest extends Customer {
    latestRequest?: string;
    requestDate?: string;
    isAppointmentOnly?: boolean;
}

const GlobalCustomers: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'limbo' | 'search'>('limbo');
    const [customers, setCustomers] = useState<CustomerWithRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Transfer State
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithRequest | null>(null);
    const [targetOrgId, setTargetOrgId] = useState('');
    const [isMoving, setIsMoving] = useState(false);

    // --- ACCESS CONTROL: Only Master Admins can view this page ---
    useEffect(() => {
        // Simple check based on role - assuming 'role' is directly on the user object or roles array
        // Adjust based on your actual user object structure in AppContext
        const user = state.currentUser;
        const isMasterAdmin = user?.role === 'master_admin'; // Fixed property access

        if (user && !isMasterAdmin) {
             navigate('/admin/dashboard'); 
             // alert("Access Denied: You must be a Master Admin to view this page."); // Optional alert
        }
    }, [state.currentUser, navigate]);

    // Initial Load - Find Limbo Customers
    useEffect(() => {
        const user = state.currentUser;
        const isMasterAdmin = user?.role === 'master_admin'; // Fixed property access
        
        if (isMasterAdmin && viewMode === 'limbo') {
            fetchLimboCustomers();
        } else if (viewMode === 'limbo' && !isMasterAdmin) {
             setCustomers([]);
        }
    }, [viewMode, state.currentUser]);

    const fetchLimboCustomers = async () => {
        const user = state.currentUser;
        const isMasterAdmin = user?.role === 'master_admin'; // Fixed property access
        
        if (!isMasterAdmin) {
             console.warn("Attempted to fetch limbo customers without master_admin role.");
             return;
        }

        setLoading(true);
        try {
            // Find customers attached to 'platform' or 'unaffiliated'
            const snapPlatform = await db.collection('customers').where('organizationId', '==', 'platform').limit(50).get();
            const snapUnaffiliated = await db.collection('customers').where('organizationId', '==', 'unaffiliated').limit(50).get();
            
            // Also fetch pending appointments for these organizations to show request details
            const apptSnapPlatform = await db.collection('appointments').where('organizationId', '==', 'platform').get();
            const apptSnapUnaffiliated = await db.collection('appointments').where('organizationId', '==', 'unaffiliated').get();
            
            const appointments = [
                ...apptSnapPlatform.docs.map(d => ({...d.data(), id: d.id}) as Appointment),
                ...apptSnapUnaffiliated.docs.map(d => ({...d.data(), id: d.id}) as Appointment)
            ];

            const existingCustomers = [
                ...snapPlatform.docs.map(d => ({...d.data(), id: d.id} as CustomerWithRequest)),
                ...snapUnaffiliated.docs.map(d => ({...d.data(), id: d.id} as CustomerWithRequest))
            ];
            
            // Map existing customers to request data
            existingCustomers.forEach(c => {
                const customerAppts = appointments.filter(a => a.customerId === c.id || a.customerPhone === c.phone || a.customerEmail === c.email);
                if (customerAppts.length > 0) {
                    customerAppts.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    const latest = customerAppts[0];
                    c.latestRequest = latest.tasks.join(', ');
                    c.requestDate = latest.appointmentTime;
                }
            });

            // Find ORPHANED appointments (where no customer record exists in the 'customers' list above)
            const orphanedAppts = appointments.filter(a => {
                return !existingCustomers.some(c => c.id === a.customerId || c.phone === a.customerPhone);
            });

            const orphanedCustomers: CustomerWithRequest[] = orphanedAppts.map(a => ({
                id: a.customerId || `temp-${a.id}`,
                organizationId: a.organizationId,
                name: a.customerName,
                email: a.customerEmail || '',
                phone: a.customerPhone,
                address: a.address,
                customerType: 'Residential',
                hvacSystem: { brand: 'Unknown', type: 'Unknown' },
                serviceHistory: [],
                latestRequest: a.tasks.join(', '),
                requestDate: a.appointmentTime,
                isAppointmentOnly: true
            }));
            
            // Combine and sort
            const list = [...existingCustomers, ...orphanedCustomers];
            list.sort((a,b) => (b.requestDate ? new Date(b.requestDate).getTime() : 0) - (a.requestDate ? new Date(a.requestDate).getTime() : 0));
            
            setCustomers(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        const user = state.currentUser;
        const isMasterAdmin = user?.role === 'master_admin'; // Fixed property access

        if (!isMasterAdmin) {
            console.warn("Attempted to search customers without master_admin role.");
            return;
        }

        if (!searchTerm) return;
        setLoading(true);
        try {
            // Simple search by phone or exact email (Firestore doesn't support full text search easily)
            let snap = await db.collection('customers').where('phone', '==', searchTerm).get();
            if (snap.empty) {
                snap = await db.collection('customers').where('email', '==', searchTerm).get();
            }
            if (snap.empty) {
                snap = await db.collection('customers').where('name', '==', searchTerm).get();
            }
            
            // Also search appointments for this term
             const snapAppt = await db.collection('appointments').where('customerPhone', '==', searchTerm).get();

            const list: CustomerWithRequest[] = snap.docs.map(d => ({...d.data(), id: d.id} as CustomerWithRequest));
            
            // Add appts if not in customer list
            snapAppt.forEach(doc => {
                const a = doc.data() as Appointment;
                if (!list.find(c => c.id === a.customerId)) {
                    list.push({
                        id: a.customerId || doc.id,
                        organizationId: a.organizationId,
                        name: a.customerName,
                        email: a.customerEmail || '',
                        phone: a.customerPhone,
                        address: a.address,
                        customerType: 'Residential',
                        hvacSystem: { brand: 'Unknown', type: 'Unknown' },
                        serviceHistory: [],
                        latestRequest: a.tasks.join(', '),
                        requestDate: a.appointmentTime,
                        isAppointmentOnly: true
                    });
                }
            });

            setCustomers(list);
            setViewMode('search');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        const user = state.currentUser;
        const isMasterAdmin = user?.role === 'master_admin'; // Fixed property access

        if (!isMasterAdmin) {
            console.warn("Attempted to transfer customers without master_admin role.");
            return;
        }

        if (!selectedCustomer || !targetOrgId) return;
        if (!await globalConfirm(`Move "${selectedCustomer.name}" and ALL their history to new Organization? This cannot be easily undone.`)) return;

        setIsMoving(true);
        const batch = db.batch();
        const cid = selectedCustomer.id;

        try {
            // 1. Move Customer Doc (if exists)
            // If it's appointment-only, we might need to CREATE the customer doc first in the new org
            if (selectedCustomer.isAppointmentOnly) {
                const newCustRef = db.collection('customers').doc(cid);
                
                // IMPORTANT: Destructure to remove UI-only fields that cause "undefined" errors in Firestore
                const { latestRequest, requestDate, isAppointmentOnly, ...cleanData } = selectedCustomer;
                
                const newCustData: Customer = {
                    ...cleanData,
                    organizationId: targetOrgId,
                };
                batch.set(newCustRef, newCustData);
            } else {
                const custRef = db.collection('customers').doc(cid);
                batch.update(custRef, { organizationId: targetOrgId });
            }

            // 2. Move Jobs
            const jobsSnap = await db.collection('jobs').where('customerId', '==', cid).get();
            jobsSnap.forEach(doc => {
                batch.update(doc.ref, { organizationId: targetOrgId });
            });

            // 3. Move Appointments
            // Try ID match
            let apptSnap = await db.collection('appointments').where('customerId', '==', cid).get();
            apptSnap.forEach(doc => batch.update(doc.ref, { organizationId: targetOrgId }));
            
            // Try Phone match (common for web leads)
            if (selectedCustomer.phone) {
                 const apptSnapPhone = await db.collection('appointments')
                    .where('customerPhone', '==', selectedCustomer.phone)
                    .where('organizationId', 'in', ['platform', 'unaffiliated']) // Only move unassigned ones
                    .get();
                 apptSnapPhone.forEach(doc => batch.update(doc.ref, { organizationId: targetOrgId, customerId: cid }));
            }

            // 4. Move User Login (if exists)
            if (selectedCustomer.email) {
                const userSnap = await db.collection('users').where('email', '==', selectedCustomer.email).get();
                userSnap.forEach(doc => {
                    batch.update(doc.ref, { organizationId: targetOrgId });
                });
            }

            await batch.commit();
            alert("Transfer Complete!");
            setCustomers(prev => prev.filter(c => c.id !== cid));
            setSelectedCustomer(null);
            setTargetOrgId('');
        } catch (e: any) {
            console.error(e);
            alert("Transfer failed: " + e.message);
        } finally {
            setIsMoving(false);
        }
    };

    const getOrgName = (id: string) => {
        const org = state.allOrganizations.find(o => o.id === id);
        return org ? org.name : (id === 'platform' ? 'Platform (Master)' : (id === 'unaffiliated' ? 'Unassigned (Find a Pro)' : id));
    };

    const user = state.currentUser;
    const isMasterAdmin = user?.role === 'master_admin'; // Fixed property access

    if (!isMasterAdmin) {
        return (
            <div className="text-center p-4 md:p-10 text-red-500 font-bold">
                Access Denied: You do not have permission to view the Global Customer Manager.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Global Customer Manager</h2>
                    <p className="text-gray-600 dark:text-gray-400">Locate and re-assign customer records across organizations.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => { setViewMode('limbo'); fetchLimboCustomers(); }} variant="secondary" className={`text-xs ${viewMode === 'limbo' ? 'bg-amber-100 text-amber-800' : ''}`}>
                        <AlertCircle size={14} className="mr-2"/> View Orphans / Limbo
                    </Button>
                </div>
            </header>

            <Card>
                <div className="flex gap-4 mb-6">
                    <Input 
                        placeholder="Search by Exact Phone, Email or Name..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="flex-1"
                    />
                    <Button onClick={handleSearch} className="w-auto" disabled={loading}>
                        <Search size={16}/> {loading ? 'Searching...' : 'Find Customer'}
                    </Button>
                </div>

                <Table headers={['Customer Name', 'Current Org', 'Request Details', 'Contact Info', 'Actions']}>
                    {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                {c.name}
                                {c.isAppointmentOnly && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1 rounded">LEAD ONLY</span>}
                                <div className="text-[10px] text-slate-400 font-normal">ID: {c.id}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    c.organizationId === 'platform' || c.organizationId === 'unaffiliated' 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-blue-50 text-blue-700'
                                }`}>
                                    {getOrgName(c.organizationId)}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {c.latestRequest ? (
                                    <div className="text-sm">
                                        <div className="font-bold text-slate-700 dark:text-slate-300">{c.latestRequest}</div>
                                        {c.requestDate && <div className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={10}/> {new Date(c.requestDate).toLocaleDateString()}</div>}
                                        <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={10}/> {c.address}</div>
                                    </div>
                                ) : <span className="text-xs text-slate-400">No recent request</span>}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                <div>{c.email}</div>
                                <div>{c.phone}</div>
                            </td>
                            <td className="px-6 py-4">
                                <Button 
                                    onClick={() => setSelectedCustomer(c)} 
                                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1"
                                >
                                    <MoveRight size={14}/> Transfer
                                </Button>
                            </td>
                        </tr>
                    ))}
                    {customers.length === 0 && !loading && (
                        <tr><td colSpan={5} className="p-4 md:p-8 text-center text-slate-400">No customers found.</td></tr>
                    )}
                </Table>
            </Card>

            <Modal isOpen={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title="Transfer Customer">
                {selectedCustomer && (
                    <div className="space-y-6">
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                            <h4 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
                                <AlertCircle size={16}/> Warning: Data Migration
                            </h4>
                            <p className="text-xs text-amber-700">
                                You are about to move <strong>{selectedCustomer.name}</strong> from <strong>{getOrgName(selectedCustomer.organizationId)}</strong>.
                                <br/><br/>
                                This will transfer ownership of the Customer Record, Job History, Appointments, and User Login (if applicable) to the new organization.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Destination Organization</label>
                            <select 
                                className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                value={targetOrgId}
                                onChange={e => setTargetOrgId(e.target.value)}
                            >
                                <option value="">-- Select Target --</option>
                                {state.allOrganizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setSelectedCustomer(null)}>Cancel</Button>
                            <Button onClick={handleTransfer} disabled={!targetOrgId || isMoving} className="bg-indigo-600 hover:bg-indigo-700">
                                {isMoving ? 'Moving Data...' : 'Confirm Transfer'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default GlobalCustomers;
