
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Select from 'components/ui/Select';
import { Search, User, Building2, Shield, Activity, Mail, Users, Edit, Trash2, AlertTriangle, RefreshCw, Key } from 'lucide-react';
import type { User as AppUser, Organization } from 'types';
import { db, auth } from 'lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { globalConfirm } from "lib/globalConfirm";

const GlobalUsers: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    
    // Management State
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncingClaims, setIsSyncingClaims] = useState<string | null>(null);

    const users = state.users || [];
    const orgs = state.allOrganizations || [];

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (!u) return false;
            const hasName = (u.firstName && u.firstName.trim().length > 0) || (u.lastName && u.lastName.trim().length > 0);
            const hasEmail = u.email && u.email.trim().length > 0;
            if (!hasName && !hasEmail) return false;
            
            const term = (searchTerm || '').toLowerCase();
            const fName = (u.firstName || '').toLowerCase();
            const lName = (u.lastName || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            
            const matchesSearch = fName.includes(term) || lName.includes(term) || email.includes(term);
            const userRole = u.role || '';
            const matchesRole = roleFilter === 'All' || userRole === roleFilter;
            
            return matchesSearch && matchesRole;
        }).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
    }, [users, searchTerm, roleFilter]);

    const getOrgName = (orgId: string) => {
        if (!orgId) return 'Unknown';
        const org = orgs.find(o => o.id === orgId);
        return org ? org.name : 'Unknown Organization';
    };

    const stats = useMemo(() => {
        const validUsers = users.filter(u => (u.firstName || u.lastName || u.email));
        const active = validUsers.filter(u => u && u.status === 'active').length;
        const admins = validUsers.filter(u => u && (u.role === 'admin' || u.role === 'master_admin')).length;
        return { total: validUsers.length, active, admins };
    }, [users]);

    // --- ACTIONS ---

    const handleEditUser = (user: AppUser) => {
        setEditingUser({ ...user });
    };

    const handleDeleteUser = async (user: AppUser) => {
        if (!await globalConfirm(`PERMANENTLY DELETE user "${user.firstName} ${user.lastName}" (${user.email})?\n\nThis will remove their profile from the system completely. This action cannot be undone.`)) return;
        try {
            await db.collection('users').doc(user.id).delete();
            alert("User deleted successfully.");
        } catch (e: any) {
            console.error(e);
            alert("Failed to delete user: " + e.message);
        }
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsSaving(true);
        try {
            await db.collection('users').doc(editingUser.id).update({
                firstName: editingUser.firstName || '',
                lastName: editingUser.lastName || '',
                email: editingUser.email || '',
                organizationId: editingUser.organizationId || 'unaffiliated',
                role: editingUser.role || 'employee',
                status: editingUser.status || 'active'
            });
            setEditingUser(null);
            alert("User record updated.");
        } catch (e: any) {
            console.error(e);
            alert("Failed to update user: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Calls the Cloud Function via Firebase SDK (Fixes CORS)
     */
    const handleSyncAuthClaims = async (user: AppUser) => {
        setIsSyncingClaims(user.id);
        try {
            const functions = getFunctions();
            const setUserRoleFn = httpsCallable(functions, 'setUserRole');
            const result = await setUserRoleFn({ uid: user.id, role: user.role });
            
            const data = result.data as any;
            if (data.success) {
                alert(`Success! Auth claims for ${user.firstName} updated to '${user.role}'. The user must log out and back in to see the changes.`);
            } else {
                throw new Error("Function returned failure status.");
            }
        } catch (e: any) {
            console.error(e);
            alert("Failed to sync auth claims: " + e.message);
        } finally {
            setIsSyncingClaims(null);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <header>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Global User Registry</h2>
                <p className="text-gray-600 dark:text-gray-400">Total platform user base and activity monitoring.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="flex items-center p-6 bg-blue-50 dark:bg-blue-900/10 border-blue-200">
                    <div className="p-3 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 mr-4">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Total Accounts</p>
                        <p className="text-2xl font-black dark:text-white">{stats.total}</p>
                    </div>
                </Card>
                <Card className="flex items-center p-6 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200">
                    <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-700 mr-4">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Active Status</p>
                        <p className="text-2xl font-black dark:text-white">{stats.active}</p>
                    </div>
                </Card>
                <Card className="flex items-center p-6 bg-purple-50 dark:bg-purple-900/10 border-purple-200">
                    <div className="p-3 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 mr-4">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-purple-700 uppercase tracking-widest">Privileged Roles</p>
                        <p className="text-2xl font-black dark:text-white">{stats.admins}</p>
                    </div>
                </Card>
            </div>

            <Card className="shadow-lg">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            id="search-users"
                            name="search-users"
                            className="pl-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {['All', 'admin', 'employee', 'supervisor', 'customer', 'platform_sales', 'master_admin'].map(role => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role)}
                                className={`px-4 py-2 text-xs font-black uppercase rounded-lg border transition-all ${
                                    roleFilter === role 
                                        ? 'bg-sky-600 text-white border-sky-600 shadow-md' 
                                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                {role.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                <Table headers={['User Identity', 'Organization', 'Access Role', 'Status', 'Actions']}>
                    {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                        <User size={20}/>
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-900 dark:text-white">{u.firstName || 'Unknown'} {u.lastName || 'User'}</div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1"><Mail size={10}/> {u.email || 'No Email'}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className={`flex items-center gap-2 text-sm font-bold ${u.organizationId === 'unaffiliated' ? 'text-rose-500 italic' : 'text-slate-600 dark:text-slate-400'}`}>
                                    <Building2 size={14}/>
                                    {getOrgName(u.organizationId)}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                    (u.role || '').includes('admin') ? 'bg-purple-100 text-purple-700' : 
                                    u.role === 'customer' ? 'bg-emerald-100 text-emerald-700' :
                                    u.role === 'platform_sales' ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {(u.role || 'Unknown').replace('_', ' ')}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`flex items-center gap-1 text-[10px] font-black uppercase ${u.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    {u.status}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleSyncAuthClaims(u)} 
                                        className={`p-2 rounded-lg transition-colors ${isSyncingClaims === u.id ? 'text-slate-400 cursor-wait' : 'text-amber-600 hover:bg-amber-50'}`}
                                        title="Sync Auth Claims (Set Role)"
                                        disabled={isSyncingClaims !== null}
                                    >
                                        {isSyncingClaims === u.id ? <RefreshCw size={16} className="animate-spin"/> : <Key size={16}/>}
                                    </button>
                                    <button 
                                        onClick={() => handleEditUser(u)} 
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Modify User"
                                    >
                                        <Edit size={16}/>
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteUser(u)} 
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete User Record"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                        <tr><td colSpan={5} className="p-6 md:p-12 text-center text-slate-400">No users found.</td></tr>
                    )}
                </Table>
            </Card>

            <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Manage Global User Profile">
                {editingUser && (
                    <form onSubmit={handleSaveUser} className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800 flex gap-3 mb-2">
                            <AlertTriangle className="text-amber-600 shrink-0" size={20}/>
                            <div>
                                <p className="text-xs text-amber-800 dark:text-amber-300 font-bold mb-1">Master Admin Note</p>
                                <p className="text-xs text-amber-800 dark:text-amber-300">
                                    Changing a user's role here only updates their Firestore profile. To update their actual <b>Login Permissions</b> (Auth Claims), use the 'Sync Claims' button in the user list.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="First Name" value={editingUser.firstName || ''} onChange={e => setEditingUser({...editingUser, firstName: e.target.value})} required />
                            <Input label="Last Name" value={editingUser.lastName || ''} onChange={e => setEditingUser({...editingUser, lastName: e.target.value})} required />
                        </div>
                        <Input label="Email Address" type="email" value={editingUser.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} required />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Assigned Organization" value={editingUser.organizationId || 'unaffiliated'} onChange={e => setEditingUser({...editingUser, organizationId: e.target.value})}>
                                <option value="unaffiliated">-- Unaffiliated / Orphaned --</option>
                                <option value="platform">TekTrakker Platform (Internal)</option>
                                {orgs.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </Select>
                            <Select label="System Role" value={editingUser.role || 'employee'} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                                <option value="employee">Employee / Tech</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="admin">Admin</option>
                                <option value="both">Superuser (Both)</option>
                                <option value="customer">Customer / Client</option>
                                <option value="platform_sales">Platform Sales Rep</option>
                                <option value="master_admin">Master Admin</option>
                            </Select>
                        </div>

                        <Select label="Status" value={editingUser.status || 'active'} onChange={e => setEditingUser({...editingUser, status: e.target.value as any})}>
                            <option value="active">Active</option>
                            <option value="archived">Archived / Disabled</option>
                        </Select>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" type="button" onClick={() => setEditingUser(null)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Updating...' : 'Apply Changes'}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default GlobalUsers;
