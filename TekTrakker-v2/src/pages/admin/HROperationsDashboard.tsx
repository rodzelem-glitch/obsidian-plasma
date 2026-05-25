import React, { useState } from 'react';
import { Users, FileSignature, DollarSign, Umbrella, ArrowRight, Clock, Award, ShieldCheck, Settings, Search, Filter, Plus, Minus, X, Info, Calendar } from 'lucide-react';
import { usePayrollService } from 'hooks/usePayrollService';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';

import type { User } from 'types';
import { db } from '../../lib/firebase';
import showToast from 'lib/toast';

import TimeSheetReview from './TimeSheetReview';
import EmployeeScheduling from './EmployeeScheduling';
import EmployeeProfileModal from 'components/modals/EmployeeProfileModal';

const HROperationsDashboard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { activePayrollService } = usePayrollService();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'roster' | 'payroll' | 'benefits' | 'scheduling'>('roster');
    
    // Roster search and filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'supervisor' | 'technician' | 'subcontractor'>('all');
    const [configFilter, setConfigFilter] = useState<'all' | 'configured' | 'pending'>('all');
    const [selectedProfileEmployee, setSelectedProfileEmployee] = useState<any | null>(null);
    
    // Comprehensive compensation editor state
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [editPayRate, setEditPayRate] = useState('');
    const [editPayType, setEditPayType] = useState<'hour' | 'salary'>('hour');
    const [editW4Status, setEditW4Status] = useState<string>('Missing');
    const [editPtoBalance, setEditPtoBalance] = useState<string>('0');
    const [editWeeklyHours, setEditWeeklyHours] = useState<string>('40');
    const [isSaving, setIsSaving] = useState(false);
    
    const WORKFORCE_ROLES = new Set(['employee', 'both', 'supervisor', 'technician', 'Technician', 'subcontractor', 'Subcontractor', 'admin', 'master_admin', 'platform_sales']);
    
    // Merge standard users and explicitly typed subcontractors into a single unified array
    const combinedUsers: any[] = [...(state.users || []), ...(state.subcontractors || [])];
    
    // Deduplicate in case a subcontractor also exists in the users array
    const uniqueUsers = Array.from(new Map(combinedUsers.map(u => [u.id, u])).values());
    
    const usersList: User[] = uniqueUsers.filter(u => WORKFORCE_ROLES.has(u.role) || u.companyName);

    // Apply real-time search & filters
    const filteredUsers = usersList.filter((usr: any) => {
        const name = `${usr.firstName || usr.name || ''} ${usr.lastName || ''}`.toLowerCase();
        const email = (usr.email || '').toLowerCase();
        const matchesSearch = name.includes(searchQuery.toLowerCase()) || email.includes(searchQuery.toLowerCase());
        
        const matchesRole = roleFilter === 'all' || usr.role?.toLowerCase() === roleFilter.toLowerCase();
        
        const isConfigured = !!usr.payRate;
        const matchesConfig = configFilter === 'all' || 
            (configFilter === 'configured' && isConfigured) || 
            (configFilter === 'pending' && !isConfigured);
            
        return matchesSearch && matchesRole && matchesConfig;
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20 px-4">
            
            {/* Gusto Core Banner Actions */}
            {activePayrollService === 'gusto' && state.currentOrganization?.gustoOnboardingUrl && (
                <div className="flex justify-end mb-4 gap-4">
                    <button 
                        onClick={async () => {
                            if (!window.confirm("Are you sure you want to completely unlink Gusto? This will remove the UUID and Employee syncs.")) return;
                            try {
                                const orgId = state.currentOrganization?.id;
                                if (!orgId) return;
                                
                                await db.collection('organizations').doc(orgId).update({
                                    gustoCompanyUuid: null,
                                    gustoOnboardingUrl: null
                                });
                                
                                const usersSnap = await db.collection('users').where('organizationId', '==', orgId).get();
                                const subSnap = await db.collection('subcontractors').where('organizationId', '==', orgId).get();
                                const batch = db.batch();
                                
                                usersSnap.forEach(uDoc => {
                                    if (uDoc.data().gustoEmployeeId || uDoc.data().gustoOnboardingUrl) {
                                        batch.update(uDoc.ref, { gustoEmployeeId: null, gustoOnboardingUrl: null });
                                    }
                                });
                                
                                subSnap.forEach(sDoc => {
                                    if (sDoc.data().gustoEmployeeId || sDoc.data().gustoOnboardingUrl) {
                                        batch.update(sDoc.ref, { gustoEmployeeId: null, gustoOnboardingUrl: null });
                                    }
                                });
                                
                                await batch.commit();
                                
                                dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization, gustoCompanyUuid: undefined, gustoOnboardingUrl: undefined } });
                                showToast.success("Gusto sandbox successfully unlinked!");
                            } catch (e: any) {
                                console.error(e);
                                showToast.error("Failed to unlink Gusto: " + e.message);
                            }
                        }}
                        className="shrink-0 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 hover:dark:bg-rose-900/40 px-4 py-3 rounded-xl font-extrabold flex items-center gap-2 transition-colors border border-rose-200 dark:border-rose-900/40 shadow-sm"
                    >
                        {t('Unlink Gusto')}
                    </button>
                    <button 
                        onClick={() => window.open(state.currentOrganization?.gustoOnboardingUrl, '_blank')}
                        className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-extrabold flex items-center gap-3 transition-colors shadow-md group"
                    >
                        {t('Open Native Gusto')}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            )}

            {/* General Integration Alerts (ADP, Paychex, QBO) */}
            {activePayrollService === 'quickbooks' && (
                <div className="flex flex-col sm:flex-row justify-between items-center bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 p-4 px-6 rounded-3xl mb-4 gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{t('QuickBooks Online Active')}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('Syncing customers, invoices, and pushing employee timesheets directly to QuickBooks.')}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.open('https://qbo.intuit.com', '_blank')}
                        className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm active:scale-95"
                    >
                        {t('Open QBO Portal')} <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {activePayrollService === 'adp' && (
                <div className="flex flex-col sm:flex-row justify-between items-center bg-rose-500/10 backdrop-blur-xl border border-rose-500/20 p-4 px-6 rounded-3xl mb-4 gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{t('ADP Workforce Connected')}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('ADP integration active. Push employee hours and staging logs effortlessly.')}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.open('https://workforcenow.adp.com', '_blank')}
                        className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm active:scale-95"
                    >
                        {t('Open ADP Workforce')} <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {activePayrollService === 'paychex' && (
                <div className="flex flex-col sm:flex-row justify-between items-center bg-blue-500/10 backdrop-blur-xl border border-blue-500/20 p-4 px-6 rounded-3xl mb-4 gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{t('Paychex Connected')}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('Paychex active. Hours and commission data mapped and synced.')}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.open('https://paychex.com', '_blank')}
                        className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm active:scale-95"
                    >
                        {t('Open Paychex')} <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Offline manual payroll staging banner */}
            {activePayrollService === 'none' && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-100/70 to-indigo-100/30 dark:from-slate-900/40 dark:to-indigo-950/10 border border-slate-200 dark:border-indigo-900/30 p-5 px-6 rounded-[2rem] mb-4 gap-4 shadow-sm relative overflow-hidden backdrop-blur-xl">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl relative shrink-0">
                            <Settings className="w-6 h-6 animate-[spin_10s_linear_infinite]" />
                            <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full animate-ping"></div>
                            <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-extrabold text-slate-950 dark:text-white text-sm tracking-tight">{t('Offline Mode: Strategy 1 Direct Bank Export')}</h4>
                                <span className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/20">{t('Active Staging')}</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                                {t('No payroll provider connected. System has activated manual bank staging.')} 
                                {t('You can configure employee compensation rates locally and export standardized .ach direct deposit records completely out of money transmitter regulatory scope.')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Dynamic Bento Console Navigation Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                
                {/* Stat 1: Active Team Members */}
                <div 
                    onClick={() => {
                        setActiveTab('roster');
                        setConfigFilter('all');
                        setRoleFilter('all');
                    }}
                    className={`p-6 rounded-[2.2rem] flex flex-col justify-between hover:scale-[1.03] hover:shadow-lg transition-all duration-300 relative overflow-hidden group cursor-pointer active:scale-[0.97] border ${
                        activeTab === 'roster' && configFilter === 'all'
                        ? 'bg-indigo-500/10 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10'
                        : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <Users className="w-6 h-6" />
                        </div>
                        {activeTab === 'roster' && configFilter === 'all' ? (
                            <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm">Active</span>
                        ) : (
                            <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-405 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/20">{usersList.length > 0 ? t('Live') : t('Empty')}</span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-955 dark:text-white leading-none tracking-tight">{usersList.length}</h3>
                        <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest mt-2">{t('Team Roster')}</p>
                    </div>
                </div>

                {/* Stat 2: Pending Rates */}
                <div 
                    onClick={() => {
                        setActiveTab('roster');
                        setConfigFilter('pending');
                        setRoleFilter('all');
                    }}
                    className={`p-6 rounded-[2.2rem] flex flex-col justify-between hover:scale-[1.03] hover:shadow-lg transition-all duration-300 relative overflow-hidden group cursor-pointer active:scale-[0.97] border ${
                        activeTab === 'roster' && configFilter === 'pending'
                        ? 'bg-indigo-500/10 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10'
                        : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 dark:bg-amber-400/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-550 rounded-2xl">
                            <FileSignature className="w-6 h-6" />
                        </div>
                        {activeTab === 'roster' && configFilter === 'pending' ? (
                            <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm">Active</span>
                        ) : (
                            usersList.filter((u: any) => !u.payRate).length > 0 && (
                                <span className="bg-amber-500/10 text-amber-705 dark:text-amber-400 animate-pulse text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-amber-500/20">
                                    {t('Action Req')}
                                </span>
                            )
                        )}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-955 dark:text-white leading-none tracking-tight">
                            {usersList.filter((u: any) => !u.payRate).length}
                        </h3>
                        <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest mt-2">{t('Pending Setup')}</p>
                    </div>
                </div>

                {/* Stat 3: Payroll Engine */}
                <div 
                    onClick={() => {
                        setActiveTab('payroll');
                    }}
                    className={`p-6 rounded-[2.2rem] flex flex-col justify-between hover:scale-[1.03] hover:shadow-lg transition-all duration-300 relative overflow-hidden group cursor-pointer active:scale-[0.97] border ${
                        activeTab === 'payroll'
                        ? 'bg-indigo-500/10 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10'
                        : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        {activeTab === 'payroll' ? (
                            <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm">Active</span>
                        ) : (
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                                activePayrollService !== 'none' 
                                ? 'bg-emerald-500/10 text-emerald-705 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-slate-500/10 text-slate-700 dark:text-slate-350 border-slate-500/20'
                            }`}>
                                {activePayrollService !== 'none' ? t('Active') : t('Offline')}
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-955 dark:text-white leading-none tracking-tight capitalize">
                            {activePayrollService === 'none' ? t('Local Direct') : activePayrollService === 'quickbooks' ? t('QuickBooks') : activePayrollService}
                        </h3>
                        <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest mt-2">{t('Payroll Engine')}</p>
                    </div>
                </div>

                {/* Stat 4: Shift Schedules */}
                <div 
                    onClick={() => {
                        setActiveTab('scheduling');
                    }}
                    className={`p-6 rounded-[2.2rem] flex flex-col justify-between hover:scale-[1.03] hover:shadow-lg transition-all duration-300 relative overflow-hidden group cursor-pointer active:scale-[0.97] border ${
                        activeTab === 'scheduling'
                        ? 'bg-indigo-500/10 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10'
                        : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 dark:bg-purple-400/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-405 rounded-2xl">
                            <Calendar className="w-6 h-6" />
                        </div>
                        {activeTab === 'scheduling' ? (
                            <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm">Active</span>
                        ) : (
                            <span className="bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-purple-500/20">{t('Shift Staging')}</span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-955 dark:text-white leading-none tracking-tight">
                            {(state.schedules || []).filter((s: any) => !s.isOff).length}
                        </h3>
                        <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest mt-2">{t('Active Shifts')}</p>
                    </div>
                </div>

                {/* Stat 5: Benefits & Taxes */}
                <div 
                    onClick={() => {
                        setActiveTab('benefits');
                    }}
                    className={`p-6 rounded-[2.2rem] flex flex-col justify-between hover:scale-[1.03] hover:shadow-lg transition-all duration-300 relative overflow-hidden group cursor-pointer active:scale-[0.97] border ${
                        activeTab === 'benefits'
                        ? 'bg-indigo-500/10 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10'
                        : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                    }`}
                >
                    <div className="absolute right-0 top-0 w-24 h-24 bg-pink-500/5 dark:bg-pink-400/5 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-2xl">
                            <Umbrella className="w-6 h-6" />
                        </div>
                        {activeTab === 'benefits' ? (
                            <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm">Active</span>
                        ) : (
                            <span className="bg-slate-500/10 text-slate-655 dark:text-slate-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-slate-500/20">{t('W-4 Checked')}</span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-955 dark:text-white leading-none tracking-tight">
                            {usersList.length > 0 ? Math.round((usersList.filter((u: any) => u.w4Status).length / usersList.length) * 100) : 0}%
                        </h3>
                        <p className="text-[10px] font-black text-slate-450 uppercase tracking-widest mt-2">{t('W-4 Compliance')}</p>
                    </div>
                </div>
            </div>

            {/* Module Render Container */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 min-h-[500px] p-6 sm:p-8 flex items-start justify-center">
                
                {/* Roster Tab */}
                {activeTab === 'roster' && (
                    <div className="w-full flex flex-col h-full">
                        
                        {/* Roster Interactive Filter Bar */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6 w-full">
                            <div className="relative w-full md:max-w-md">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                                    <Search className="w-5 h-5" />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors shadow-sm"
                                />
                            </div>
                            
                            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-start sm:justify-end">
                                <span className="flex items-center gap-1.5 bg-slate-100/60 dark:bg-slate-950/40 px-3 py-2 rounded-xl text-xs font-bold text-slate-500">
                                    <Filter className="w-3.5 h-3.5" />
                                    Filters:
                                </span>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value as any)}
                                    className="bg-white/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                                >
                                    <option value="all">All Roles</option>
                                    <option value="employee">Employees</option>
                                    <option value="supervisor">Supervisors</option>
                                    <option value="technician">Technicians</option>
                                    <option value="subcontractor">Subcontractors</option>
                                </select>

                                <select
                                    value={configFilter}
                                    onChange={(e) => setConfigFilter(e.target.value as any)}
                                    className="bg-white/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-xs font-extrabold text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                                >
                                    <option value="all">All Pay Statuses</option>
                                    <option value="configured">Configured & Active</option>
                                    <option value="pending">Setup Required</option>
                                </select>
                            </div>
                        </div>

                        {/* Roster Table */}
                        <div className="bg-white/40 dark:bg-slate-950/20 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex-1">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                            <th className="p-4 font-bold text-xs tracking-widest uppercase">{t('Team Member')}</th>
                                            <th className="p-4 font-bold text-xs tracking-widest uppercase">{t('Platform Role')}</th>
                                            <th className="p-4 font-bold text-xs tracking-widest uppercase">
                                                {activePayrollService === 'none' 
                                                    ? t('Local Pay Rate') 
                                                    : activePayrollService === 'quickbooks' 
                                                    ? t('QuickBooks Sync') 
                                                    : t(`${activePayrollService} Link`)
                                                }
                                            </th>
                                            <th className="p-4 font-bold text-xs tracking-widest uppercase text-right">{t('Actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                        {filteredUsers.map((usr: any) => {
                                            const user = usr as any;
                                            const isSynced = !!user.gustoEmployeeId;
                                            const isConfigured = !!user.payRate;
                                            
                                            return (
                                                <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all duration-200 group">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            {/* Initial Avatar Styled with HSL Gradient */}
                                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold flex flex-col items-center justify-center shrink-0 shadow-inner border border-indigo-500/10">
                                                                {user.firstName?.[0] || user.name?.[0] || '?'}
                                                            </div>
                                                            <div>
                                                                <p 
                                                                    onClick={() => setSelectedProfileEmployee(user)}
                                                                    className="font-extrabold text-slate-900 dark:text-white capitalize hover:underline hover:text-indigo-650 cursor-pointer"
                                                                >
                                                                    {user.firstName || user.name} {user.lastName}
                                                                </p>
                                                                <p className="text-xs text-slate-500 font-medium">{user.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-xl text-xs font-bold capitalize border border-slate-200 dark:border-slate-800">
                                                            {user.role?.replace('_', ' ') || 'Contractor'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {activePayrollService === 'gusto' ? (
                                                            isSynced ? (
                                                                <div className="flex flex-col">
                                                                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                                                                        <ShieldCheck className="w-4 h-4" /> {t('Actively Linked')}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5" title={user.gustoEmployeeId}>ID: {user.gustoEmployeeId.substring(0,8)}...</span>
                                                                </div>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-bold text-sm">
                                                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div> {t('Pending Setup')}
                                                                </span>
                                                            )
                                                        ) : (
                                                            isConfigured ? (
                                                                <div className="flex flex-col">
                                                                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                                                                        <ShieldCheck className="w-4 h-4" /> {t('Configured & Active')}
                                                                    </span>
                                                                    <span className="text-xs text-slate-600 dark:text-slate-400 font-extrabold mt-0.5">Rate: ${user.payRate} / {t(user.payType || 'hour')}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-bold text-sm">
                                                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div> {t('Setup Required')}
                                                                </span>
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                         <button 
                                                             onClick={async () => {
                                                                 if (activePayrollService === 'none') {
                                                                     // Open compensation editor modal
                                                                     setEditingUser(user);
                                                                     setEditPayRate(user.payRate ? String(user.payRate) : '');
                                                                     setEditPayType(user.payType === 'salary' ? 'salary' : 'hour');
                                                                     setEditW4Status(user.w4Status || 'Missing');
                                                                     setEditPtoBalance(String(user.ptoAccrued || '0'));
                                                                     setEditWeeklyHours(String(user.weeklyStandardHours || '40'));
                                                                 } else {
                                                                     showToast.info(t('Connect a payroll provider in Settings -> Integrations to link employee profiles directly.'));
                                                                 }
                                                             }}
                                                             className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-sm active:scale-95 ${
                                                                 isConfigured && activePayrollService === 'none'
                                                                 ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10' 
                                                                 : activePayrollService === 'none'
                                                                 ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10'
                                                                 : isSynced
                                                                 ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-not-allowed'
                                                                 : 'bg-indigo-400 text-white cursor-not-allowed'
                                                             }`}
                                                         >
                                                             {activePayrollService === 'none' && isConfigured ? t('Edit Rate') : t('Link Payroll')}
                                                         </button>
                                                     </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-400 font-bold text-sm bg-slate-50/50 dark:bg-transparent">No team members match the search and filters.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Payroll Staging Tab */}
                {activeTab === 'payroll' && (
                    <div className="w-full animate-fade-in">
                        <TimeSheetReview />
                    </div>
                )}

                {/* Shift Scheduling Tab */}
                {activeTab === 'scheduling' && (
                    <div className="w-full animate-fade-in">
                        <div className="mb-4">
                            <h3 className="text-lg font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-500" />
                                {t('Shift Schedules Manager')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure active shifts, work times, and weekly standard calendars for employees.</p>
                        </div>
                        <EmployeeScheduling />
                    </div>
                )}

                {/* Benefits & Taxes Tab */}
                {activeTab === 'benefits' && (
                    <div className="w-full flex flex-col h-full animate-fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 w-full">
                            
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => {
                                        const csvRows = [
                                            ['ID', 'Name', 'Email', 'Role', 'Gusto Linked', 'Square Linked', 'W4 Status'],
                                            ...usersList.map((usr: any) => [
                                                usr.id,
                                                `"${usr.firstName || usr.name || ''} ${usr.lastName || ''}"`.trim(),
                                                usr.email || '',
                                                usr.role || '',
                                                usr.gustoEmployeeId ? 'Yes' : 'No',
                                                usr.squareTeamMemberId ? 'Yes' : 'No',
                                                usr.w4Status || 'Unfiled'
                                            ])
                                        ];
                                        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                                        const link = document.createElement("a");
                                        link.setAttribute("href", encodeURI(csvContent));
                                        link.setAttribute("download", `Universal_Roster_Export_${new Date().toISOString().split('T')[0]}.csv`);
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                    }}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all duration-250 flex items-center gap-2 text-slate-700 dark:text-slate-300 active:scale-95"
                                >
                                    <FileSignature className="w-4 h-4" /> Generic CSV
                                </button>
                                
                                {state.currentOrganization?.squareApplicationId && (
                                    <button 
                                        onClick={() => showToast.info("Square Payroll export requires active Square integration. Connect in Settings.")}
                                        className="px-4 py-2 bg-blue-50 text-blue-750 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all duration-250 active:scale-95"
                                    >
                                        Square Export
                                    </button>
                                )}
                                
                                {state.currentOrganization?.quickbooksConnected && (
                                    <button 
                                        onClick={() => showToast.info("QuickBooks sync requires active integration. Connect in Settings.")}
                                        className="px-4 py-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all duration-250 active:scale-95"
                                    >
                                        Push to Quickbooks
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Benefits Table */}
                        <div className="bg-white/40 dark:bg-slate-950/20 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex-1">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                            <th className="p-4 font-bold text-xs tracking-widest uppercase">{t('Team Member')}</th>
                                            <th className="p-4 font-bold text-xs tracking-widest uppercase">{t('W-4 Filing Status')}</th>
                                            <th className="p-4 font-bold text-xs tracking-widest uppercase text-center">{t('PTO Bank')}</th>
                                            <th className="p-4 font-bold text-xs tracking-widest uppercase text-right">{t('Fallback Sync')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                        {usersList.map((usr: any) => {
                                            const user = usr as any;
                                            return (
                                                <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all duration-200 group">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-orange-600 dark:text-orange-400 font-extrabold flex items-center justify-center shadow-inner border border-orange-500/10">
                                                                {user.firstName?.[0] || user.name?.[0] || '?'}
                                                            </div>
                                                            <div>
                                                                <p 
                                                                    onClick={() => setSelectedProfileEmployee(user)}
                                                                    className="font-extrabold text-slate-900 dark:text-white capitalize hover:underline hover:text-indigo-650 cursor-pointer"
                                                                >
                                                                    {user.firstName || user.name} {user.lastName}
                                                                </p>
                                                                <p className="text-xs text-slate-500 font-medium">{user.payType === 'salary' ? 'Salaried' : 'Hourly Worker'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {/* Interactive W-4 dropdown */}
                                                        <select
                                                            value={user.w4Status || 'Missing'}
                                                            onChange={async (e) => {
                                                                try {
                                                                    const val = e.target.value === 'Missing' ? null : e.target.value;
                                                                    const isSub = user.id.startsWith('sub-') || user.role?.toLowerCase() === 'subcontractor';
                                                                    const collectionName = isSub ? 'subcontractors' : 'users';
                                                                    await db.collection(collectionName).doc(user.id).update({
                                                                        w4Status: val
                                                                    });
                                                                    showToast.success(`W-4 status updated for ${user.firstName || user.name}`);
                                                                } catch (err: any) {
                                                                    console.error(err);
                                                                    showToast.error("Failed to update W-4 status: " + err.message);
                                                                }
                                                            }}
                                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                                        >
                                                            <option value="Missing">❌ Missing Setup</option>
                                                            <option value="Single">Single</option>
                                                            <option value="Married">Married</option>
                                                            <option value="Head of Household">Head of Household</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {/* Interactive PTO increments */}
                                                        <div className="flex items-center justify-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl w-28 mx-auto shadow-sm">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        const isSub = user.id.startsWith('sub-') || user.role?.toLowerCase() === 'subcontractor';
                                                                        const collectionName = isSub ? 'subcontractors' : 'users';
                                                                        const currentPto = user.ptoAccrued || 0;
                                                                        if (currentPto <= 0) return;
                                                                        await db.collection(collectionName).doc(user.id).update({
                                                                            ptoAccrued: currentPto - 1
                                                                        });
                                                                        showToast.success(`Decremented PTO for ${user.firstName || user.name}`);
                                                                    } catch (err: any) {
                                                                        console.error(err);
                                                                        showToast.error("Failed to update PTO: " + err.message);
                                                                    }
                                                                }}
                                                                className="w-7 h-7 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-350 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/20 transition-all flex items-center justify-center active:scale-90"
                                                            >
                                                                <Minus className="w-3.5 h-3.5 stroke-[3]" />
                                                            </button>
                                                            <div className="flex flex-col items-center select-none min-w-[20px]">
                                                                <span className="text-base font-extrabold text-slate-950 dark:text-white leading-none">{user.ptoAccrued || 0}</span>
                                                                <span className="text-[8px] uppercase font-bold text-slate-400 mt-1 tracking-wider">Hrs</span>
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        const isSub = user.id.startsWith('sub-') || user.role?.toLowerCase() === 'subcontractor';
                                                                        const collectionName = isSub ? 'subcontractors' : 'users';
                                                                        const currentPto = user.ptoAccrued || 0;
                                                                        await db.collection(collectionName).doc(user.id).update({
                                                                            ptoAccrued: currentPto + 1
                                                                        });
                                                                        showToast.success(`Incremented PTO for ${user.firstName || user.name}`);
                                                                    } catch (err: any) {
                                                                        console.error(err);
                                                                        showToast.error("Failed to update PTO: " + err.message);
                                                                    }
                                                                }}
                                                                className="w-7 h-7 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-350 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-450 hover:border-emerald-500/20 transition-all flex items-center justify-center active:scale-90"
                                                            >
                                                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {user.squareTeamMemberId ? (
                                                                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-wider border border-blue-500/20">{t('Square Sync')}</span>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs italic">{t('No Fallback')}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {usersList.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">No team members available for reporting.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Comprehensive Compensation Editor Popover Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
                    <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-[scaleUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
                        {/* Visual Gradient Glow */}
                        <div className="absolute right-0 top-0 w-36 h-36 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>
                        
                        {/* Header */}
                        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800/80 pb-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-950 dark:text-white tracking-tight leading-none">Configure HR Compensation</h3>
                                <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 mt-2 capitalize flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                                    {editingUser.firstName || editingUser.name} {editingUser.lastName} ({editingUser.email})
                                </p>
                            </div>
                            <button 
                                onClick={() => setEditingUser(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 active:scale-90"
                            >
                                <X className="w-5 h-5 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Editor Form Columns */}
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                            
                            {/* Line 1: Payment Type */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">Payment Class</label>
                                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-955 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-850">
                                    <button
                                        type="button"
                                        onClick={() => setEditPayType('hour')}
                                        className={`py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-250 ${
                                            editPayType === 'hour' 
                                            ? 'bg-indigo-600 text-white shadow-md border border-indigo-705/25' 
                                            : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        Hourly Rate
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditPayType('salary')}
                                        className={`py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-250 ${
                                            editPayType === 'salary' 
                                            ? 'bg-indigo-600 text-white shadow-md border border-indigo-705/25' 
                                            : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        Salary Mode
                                    </button>
                                </div>
                            </div>

                            {/* Grid block for Pay Value and Weekly Hours */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Pay Rate Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">
                                        {editPayType === 'hour' ? 'Hourly Pay Rate ($)' : 'Salary Amount ($)'}
                                    </label>
                                    <div className="relative rounded-2xl border border-slate-300 dark:border-slate-800 focus-within:border-indigo-605 dark:focus-within:border-indigo-500 transition-all bg-white dark:bg-slate-950/60 overflow-hidden flex items-center px-4 py-3 shadow-inner">
                                        <span className="text-slate-400 font-extrabold mr-2 text-lg">$</span>
                                        <input
                                            type="number"
                                            value={editPayRate}
                                            onChange={(e) => setEditPayRate(e.target.value)}
                                            placeholder={editPayType === 'hour' ? '50.00' : '4500.00'}
                                            className="bg-transparent border-none outline-none w-full text-slate-955 dark:text-white font-black text-lg focus:ring-0 placeholder:text-slate-300"
                                        />
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider ml-2 shrink-0">
                                            {editPayType === 'hour' ? '/ hr' : '/ cycle'}
                                        </span>
                                    </div>
                                </div>

                                {/* Weekly Standard Hours */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">Scheduled Weekly Hours</label>
                                    <div className="relative rounded-2xl border border-slate-300 dark:border-slate-800 focus-within:border-indigo-605 dark:focus-within:border-indigo-500 transition-all bg-white dark:bg-slate-950/60 overflow-hidden flex items-center px-4 py-3 shadow-inner">
                                        <input
                                            type="number"
                                            value={editWeeklyHours}
                                            onChange={(e) => setEditWeeklyHours(e.target.value)}
                                            placeholder="40"
                                            className="bg-transparent border-none outline-none w-full text-slate-955 dark:text-white font-black text-lg focus:ring-0 placeholder:text-slate-300"
                                        />
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider ml-2 shrink-0">Hrs</span>
                                    </div>
                                </div>
                            </div>

                            {/* Grid block for W-4 Tax Status and PTO Accrual */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* W-4 Withholding Status */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">W-4 Filing Withholding</label>
                                    <select
                                        value={editW4Status}
                                        onChange={(e) => setEditW4Status(e.target.value)}
                                        className="w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-sm font-extrabold text-slate-800 dark:text-slate-200 px-4 py-3.5 focus:outline-none focus:border-indigo-600 focus:dark:focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
                                    >
                                        <option value="Missing">❌ Missing Setup</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Head of Household">Head of Household</option>
                                    </select>
                                </div>

                                {/* PTO Current Balance */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest block">Accrued PTO Balance</label>
                                    <div className="relative rounded-2xl border border-slate-300 dark:border-slate-800 focus-within:border-indigo-605 dark:focus-within:border-indigo-500 transition-all bg-white dark:bg-slate-950/60 overflow-hidden flex items-center px-4 py-3 shadow-inner">
                                        <input
                                            type="number"
                                            value={editPtoBalance}
                                            onChange={(e) => setEditPtoBalance(e.target.value)}
                                            placeholder="0"
                                            className="bg-transparent border-none outline-none w-full text-slate-955 dark:text-white font-black text-lg focus:ring-0 placeholder:text-slate-300"
                                        />
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider ml-2 shrink-0">Hrs</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Staging Info Notification */}
                            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 p-3.5 rounded-2xl flex items-start gap-2.5 mt-2">
                                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 font-bold">
                                    These credentials are saved to TekTrakker's local server database. When timesheets are submitted, these configurations will stage direct ACH transactions out of money transmitter regulatory scope.
                                </p>
                            </div>
                        </div>

                        {/* Form Buttons */}
                        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all border border-slate-250 dark:border-slate-750 active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        setIsSaving(true);
                                        const rateVal = parseFloat(editPayRate) || 0;
                                        const ptoVal = parseFloat(editPtoBalance) || 0;
                                        const hoursVal = parseInt(editWeeklyHours) || 40;
                                        const w4Val = editW4Status === 'Missing' ? null : editW4Status;
                                        
                                        const isSub = editingUser.id.startsWith('sub-') || editingUser.role?.toLowerCase() === 'subcontractor';
                                        const collectionName = isSub ? 'subcontractors' : 'users';
                                        
                                        await db.collection(collectionName).doc(editingUser.id).update({
                                            payRate: rateVal,
                                            payType: editPayType,
                                            w4Status: w4Val,
                                            ptoAccrued: ptoVal,
                                            weeklyStandardHours: hoursVal
                                        });

                                        showToast.success("HR profile updated successfully!");
                                        setEditingUser(null);
                                    } catch (err: any) {
                                        console.error(err);
                                        showToast.error("Failed to update HR configuration: " + err.message);
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                disabled={isSaving}
                                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md active:scale-95 shadow-indigo-600/20"
                            >
                                {isSaving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedProfileEmployee && (
                <EmployeeProfileModal
                    isOpen={!!selectedProfileEmployee}
                    onClose={() => setSelectedProfileEmployee(null)}
                    employee={selectedProfileEmployee}
                />
            )}
        </div>
    );
};

export default HROperationsDashboard;
