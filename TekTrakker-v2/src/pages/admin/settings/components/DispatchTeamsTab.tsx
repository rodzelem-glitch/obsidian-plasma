import { cleanUndefinedFields } from '../../../../lib/utils';
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from 'lib/firebase';
import type { User, Customer, OrganizationTeam } from 'types';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import Modal from 'components/ui/Modal';
import { Users, Wrench, Shield, Search, Plus, Edit2, Trash2, Check, UserCheck, X } from 'lucide-react';
import showToast from 'lib/toast';

export const DispatchTeamsTab: React.FC = () => {
    const { state } = useAppContext();
    const { t } = useLanguage();
    const orgId = state.currentOrganization?.id || '';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Partial<OrganizationTeam> | null>(null);
    
    // Form fields
    const [teamName, setTeamName] = useState('');
    const [teamDesc, setTeamDesc] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

    // Search filters for lists inside modal
    const [dispatcherSearch, setDispatcherSearch] = useState('');
    const [techSearch, setTechSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    // List of active teams for current organization
    const orgTeams = useMemo(() => {
        return (state.teams || []).filter(t => t.organizationId === orgId);
    }, [state.teams, orgId]);

    // List of all employees (technicians and dispatchers)
    const employees = useMemo(() => {
        return (state.users || []).filter(u => u.organizationId === orgId);
    }, [state.users, orgId]);

    // Dispatcher candidates: Admin, Superuser, Supervisor, Platform Sales
    const dispatchers = useMemo(() => {
        const DISPATCHER_ROLES = new Set(['admin', 'master_admin', 'both', 'supervisor', 'platform_sales']);
        return employees.filter(u => DISPATCHER_ROLES.has(u.role || ''));
    }, [employees]);

    // Technician candidates: Employee, Technician, Subcontractor, both
    const technicians = useMemo(() => {
        const TECH_ROLES = new Set(['employee', 'technician', 'both', 'subcontractor', 'Technician', 'Subcontractor']);
        return employees.filter(u => TECH_ROLES.has(u.role || ''));
    }, [employees]);

    // Customers list
    const customers = useMemo(() => {
        return state.customers || [];
    }, [state.customers]);

    const handleOpenCreate = () => {
        setEditingTeam(null);
        setTeamName('');
        setTeamDesc('');
        setSelectedMemberIds([]);
        setSelectedCustomerIds([]);
        setDispatcherSearch('');
        setTechSearch('');
        setCustomerSearch('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (team: OrganizationTeam) => {
        setEditingTeam(team);
        setTeamName(team.name);
        setTeamDesc(team.description || '');
        setSelectedMemberIds(team.memberIds || []);
        setSelectedCustomerIds(team.customerIds || []);
        setDispatcherSearch('');
        setTechSearch('');
        setCustomerSearch('');
        setIsModalOpen(true);
    };

    const handleToggleMember = (userId: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleToggleCustomer = (custId: string) => {
        setSelectedCustomerIds(prev =>
            prev.includes(custId) ? prev.filter(id => id !== custId) : [...prev, custId]
        );
    };

    const handleSaveTeam = async () => {
        if (!teamName.trim()) {
            showToast.warn("Team Name is required.");
            return;
        }

        setIsSaving(true);
        const teamId = editingTeam?.id || `team-${Date.now()}`;
        try {
            const batch = db.batch();
            const teamRef = db.collection('teams').doc(teamId);

            const payload: any = {
                id: teamId,
                organizationId: orgId,
                name: teamName.trim(),
                description: teamDesc.trim(),
                memberIds: selectedMemberIds,
                customerIds: selectedCustomerIds
            };

            batch.set(cleanUndefinedFields(teamRef), payload);

            // Update users dispatchTeamIds list
            employees.forEach((user: User) => {
                const isSelected = selectedMemberIds.includes(user.id);
                const currentTeams = user.dispatchTeamIds || [];
                const hasTeam = currentTeams.includes(teamId);

                if (isSelected && !hasTeam) {
                    batch.update(db.collection('users').doc(user.id), cleanUndefinedFields({
                        dispatchTeamIds: [...currentTeams, teamId]
                    }));
                } else if (!isSelected && hasTeam) {
                    batch.update(db.collection('users').doc(user.id), cleanUndefinedFields({
                        dispatchTeamIds: currentTeams.filter(id => id !== teamId)
                    }));
                }
            });

            // Update customers dispatchTeamIds list
            customers.forEach((cust: Customer) => {
                const isSelected = selectedCustomerIds.includes(cust.id);
                const currentTeams = cust.dispatchTeamIds || [];
                const hasTeam = currentTeams.includes(teamId);

                if (isSelected && !hasTeam) {
                    batch.update(db.collection('customers').doc(cust.id), cleanUndefinedFields({
                        dispatchTeamIds: [...currentTeams, teamId]
                    }));
                } else if (!isSelected && hasTeam) {
                    batch.update(db.collection('customers').doc(cust.id), cleanUndefinedFields({
                        dispatchTeamIds: currentTeams.filter(id => id !== teamId)
                    }));
                }
            });

            await batch.commit();
            showToast.success(editingTeam ? "Dispatch Team updated successfully!" : "Dispatch Team created successfully!");
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            showToast.error("Failed to save Dispatch Team.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTeam = async (teamId: string) => {
        if (!window.confirm("Are you sure you want to delete this Dispatch Team? This will unlink all members and customers from this team.")) {
            return;
        }

        try {
            const batch = db.batch();
            batch.delete(db.collection('teams').doc(teamId));

            // Clean up users
            employees.forEach((user: User) => {
                const currentTeams = user.dispatchTeamIds || [];
                if (currentTeams.includes(teamId)) {
                    batch.update(db.collection('users').doc(user.id), cleanUndefinedFields({
                        dispatchTeamIds: currentTeams.filter(id => id !== teamId)
                    }));
                }
            });

            // Clean up customers
            customers.forEach((cust: Customer) => {
                const currentTeams = cust.dispatchTeamIds || [];
                if (currentTeams.includes(teamId)) {
                    batch.update(db.collection('customers').doc(cust.id), cleanUndefinedFields({
                        dispatchTeamIds: currentTeams.filter(id => id !== teamId)
                    }));
                }
            });

            await batch.commit();
            showToast.success("Dispatch Team deleted successfully!");
        } catch (e) {
            console.error(e);
            showToast.error("Failed to delete team.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
                        {t("Dispatch & Territory Teams")}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Group dispatchers, technicians, and customers into regional territories. Dispatchers will only handle technicians and appointments in their assigned teams.
                    </p>
                </div>
                <Button onClick={handleOpenCreate} className="flex items-center gap-1.5 px-4 py-2 font-black uppercase text-[10px] tracking-widest bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                    <Plus size={14} /> Create Team
                </Button>
            </div>

            {/* Grid of Teams */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orgTeams.map(team => {
                    const activeDispatchersCount = (team.memberIds || []).filter(id => dispatchers.some(d => d.id === id)).length;
                    const activeTechsCount = (team.memberIds || []).filter(id => technicians.some(t => t.id === id)).length;
                    const activeCustomersCount = (team.customerIds || []).length;

                    return (
                        <div key={team.id} className="relative group bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight">{team.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-450 mt-1 italic min-h-[32px] line-clamp-2">
                                        {team.description || "No description provided."}
                                    </p>
                                </div>
                                <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                    <button aria-label="Edit Dispatch Team" onClick={() => handleOpenEdit(team)} className="p-1.5 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                    <button aria-label="Delete Dispatch Team" onClick={() => handleDeleteTeam(team.id)} className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
                                <div className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                                    <Shield size={14} className="mx-auto text-indigo-500 mb-1" />
                                    <div className="text-sm font-black text-slate-900 dark:text-white">{activeDispatchersCount}</div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Office</div>
                                </div>
                                <div className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                                    <Wrench size={14} className="mx-auto text-emerald-500 mb-1" />
                                    <div className="text-sm font-black text-slate-900 dark:text-white">{activeTechsCount}</div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Techs</div>
                                </div>
                                <div className="p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
                                    <Users size={14} className="mx-auto text-amber-500 mb-1" />
                                    <div className="text-sm font-black text-slate-900 dark:text-white">{activeCustomersCount}</div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Clients</div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {orgTeams.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-450 italic">
                        No dispatch teams defined. Click "Create Team" to organize your territory routing.
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTeam ? "Edit Dispatch Team" : "Create Dispatch Team"} size="lg">
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                    <Input label="Team Name" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Dallas Central, Florida West Coast" />
                    <Textarea label="Team Description" value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="e.g. Covers the downtown business districts and primary retail clients." />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                        {/* Dispatchers Column */}
                        <div className="space-y-3">
                            <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Shield size={14} className="text-indigo-500" /> Dispatchers / Admins
                            </h5>
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={dispatcherSearch}
                                    onChange={e => setDispatcherSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-900"
                                />
                            </div>
                            <div className="h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1 custom-scrollbar">
                                {dispatchers.filter(d => `${d.firstName} ${d.lastName}`.toLowerCase().includes(dispatcherSearch.toLowerCase())).map(d => {
                                    const isSelected = selectedMemberIds.includes(d.id);
                                    return (
                                        <div 
                                            key={d.id} 
                                            role="button"
                                            onClick={() => handleToggleMember(d.id)}
                                            className={`flex items-center justify-between p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                                                isSelected 
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80' 
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                                            }`}
                                        >
                                            <span className="truncate">{d.firstName} {d.lastName}</span>
                                            {isSelected && <Check size={12} />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Technicians Column */}
                        <div className="space-y-3">
                            <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Wrench size={14} className="text-emerald-500" /> Technicians
                            </h5>
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={techSearch}
                                    onChange={e => setTechSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-900"
                                />
                            </div>
                            <div className="h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1 custom-scrollbar">
                                {technicians.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(techSearch.toLowerCase())).map(t => {
                                    const isSelected = selectedMemberIds.includes(t.id);
                                    return (
                                        <div 
                                            key={t.id} 
                                            role="button"
                                            onClick={() => handleToggleMember(t.id)}
                                            className={`flex items-center justify-between p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                                                isSelected 
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80' 
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                                            }`}
                                        >
                                            <span className="truncate">{t.firstName} {t.lastName}</span>
                                            {isSelected && <Check size={12} />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Customers Column */}
                        <div className="space-y-3">
                            <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Users size={14} className="text-amber-500" /> Customers / Clients
                            </h5>
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={customerSearch}
                                    onChange={e => setCustomerSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-900"
                                />
                            </div>
                            <div className="h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1 custom-scrollbar">
                                {customers.filter(c => (c.name || '').toLowerCase().includes(customerSearch.toLowerCase())).map(c => {
                                    const isSelected = selectedCustomerIds.includes(c.id);
                                    return (
                                        <div 
                                            key={c.id} 
                                            role="button"
                                            onClick={() => handleToggleCustomer(c.id)}
                                            className={`flex items-center justify-between p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                                                isSelected 
                                                    ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80' 
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'
                                            }`}
                                        >
                                            <span className="truncate max-w-[130px]">{c.name}</span>
                                            {isSelected && <Check size={12} />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-2 border-t border-slate-200 dark:border-slate-800">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTeam} disabled={isSaving} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black uppercase tracking-widest text-xs">
                            {isSaving ? "Saving..." : "Save Team"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
