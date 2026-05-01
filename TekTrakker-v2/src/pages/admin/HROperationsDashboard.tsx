import React, { useState } from 'react';
import { Users, FileSignature, DollarSign, Umbrella, ArrowRight, Activity, Clock, Award, ShieldCheck } from 'lucide-react';
import { useAppContext } from 'context/AppContext';

import type { User } from 'types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../lib/firebase';
import showToast from 'lib/toast';

import TimeSheetReview from './TimeSheetReview';

const HROperationsDashboard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'roster' | 'payroll' | 'benefits'>('roster');
    
    const WORKFORCE_ROLES = new Set(['employee', 'both', 'supervisor', 'technician', 'Technician', 'subcontractor', 'Subcontractor', 'admin', 'master_admin', 'platform_sales']);
    
    // Merge standard users and explicitly typed subcontractors into a single unified array
    const combinedUsers: any[] = [...(state.users || []), ...(state.subcontractors || [])];
    
    // Deduplicate in case a subcontractor also exists in the users array
    const uniqueUsers = Array.from(new Map(combinedUsers.map(u => [u.id, u])).values());
    
    const usersList: User[] = uniqueUsers.filter(u => WORKFORCE_ROLES.has(u.role) || u.companyName);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {state.currentOrganization?.gustoOnboardingUrl && (
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
                        className="shrink-0 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 hover:dark:bg-rose-900/40 px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors border border-rose-200 dark:border-rose-900/50"
                    >
                        Unlink Gusto
                    </button>
                    <button 
                        onClick={() => window.open(state.currentOrganization?.gustoOnboardingUrl, '_blank')}
                        className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors shadow-md group"
                    >
                        Open Native Gusto
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            )}

            {/* Quick Stats Bento */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Users className="w-6 h-6" />
                        </div>
                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2 py-1 rounded-full">{usersList.length > 0 ? 'Live' : 'Empty'}</span>
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white">{usersList.length}</h3>
                        <p className="text-sm font-medium text-gray-500">Active Team Members</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                            <FileSignature className="w-6 h-6" />
                        </div>
                        {usersList.filter((u: any) => !u.gustoEmployeeId).length > 0 && <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 animate-pulse text-xs font-bold px-2 py-1 rounded-full">Action Req</span>}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white">{usersList.filter((u: any) => !u.gustoEmployeeId).length}</h3>
                        <p className="text-sm font-medium text-gray-500">Pending Setup</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded-full">Automated</span>
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white">Active</h3>
                        <p className="text-sm font-medium text-gray-500">Payroll Integration</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                            <Umbrella className="w-6 h-6" />
                        </div>
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded-full">W-4 Checked</span>
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white">{usersList.length > 0 ? Math.round((usersList.filter((u: any) => u.w4Status).length / usersList.length) * 100) : 0}%</h3>
                        <p className="text-sm font-medium text-gray-500">Benefits Compliance</p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-2 overflow-x-auto custom-scrollbar">
                <button 
                    onClick={() => setActiveTab('roster')}
                    className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${activeTab === 'roster' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                    <Users className="w-5 h-5" />
                    Roster Terminal
                </button>
                <button 
                    onClick={() => setActiveTab('payroll')}
                    className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${activeTab === 'payroll' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                    <Clock className="w-5 h-5" />
                    Time & Payroll
                </button>
                <button 
                    onClick={() => setActiveTab('benefits')}
                    className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${activeTab === 'benefits' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                    <Award className="w-5 h-5" />
                    Benefits & Taxes
                </button>
            </div>

            {/* Module Render Container */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[500px] p-8 flex items-center justify-center">
                {activeTab === 'roster' && (
                    <div className="w-full flex flex-col h-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                            
                            <div className="flex gap-2">
                                <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    {usersList.filter((u: any) => u.gustoEmployeeId).length} Synced
                                </span>
                                <span className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                    {usersList.filter((u: any) => !u.gustoEmployeeId).length} Pending
                                </span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-1">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                            <th className="p-4 font-bold text-sm tracking-widest uppercase">Team Member</th>
                                            <th className="p-4 font-bold text-sm tracking-widest uppercase">Platform Role</th>
                                            <th className="p-4 font-bold text-sm tracking-widest uppercase">Gusto Link</th>
                                            <th className="p-4 font-bold text-sm tracking-widest uppercase text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {usersList.map((usr: any) => {
                                            const user = usr as any;
                                            const isSynced = !!user.gustoEmployeeId;
                                            return (
                                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 font-bold text-indigo-700 dark:text-indigo-400 flex flex-col items-center justify-center shrink-0">
                                                                {user.firstName?.[0] || user.name?.[0] || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-900 dark:text-white capitalize">{user.firstName || user.name} {user.lastName}</p>
                                                                <p className="text-sm text-gray-500">{user.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-bold capitalize border border-gray-200 dark:border-gray-700">
                                                            {user.role?.replace('_', ' ') || 'Contractor'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {isSynced ? (
                                                            <div className="flex flex-col">
                                                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                                                                    <ShieldCheck className="w-4 h-4" /> Actively Linked
                                                                </span>
                                                                <span className="text-xs text-gray-400 font-mono mt-0.5" title={user.gustoEmployeeId}>ID: {user.gustoEmployeeId.substring(0,8)}...</span>
                                                            </div>
                                                        ) : (
                                                            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-bold text-sm">
                                                                <div className="w-2 h-2 rounded-full bg-amber-500"></div> Pending Setup
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button 
                                                            disabled={true}
                                                            onClick={async () => {
                                                                showToast.warn('Coming Soon - Waiting for Production API Keys');
                                                            }}
                                                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                                                                isSynced 
                                                                ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700' 
                                                                : 'bg-indigo-400 text-white cursor-not-allowed border-b-2 border-indigo-600'
                                                            }`}
                                                        >
                                                            {isSynced ? 'View Profile' : 'Link to Gusto (Soon)'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {usersList.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-gray-500 font-medium">No team members found in organization.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'payroll' && (
                    <div className="w-full">
                        <TimeSheetReview />
                    </div>
                )}

                {activeTab === 'benefits' && (
                    <div className="w-full flex flex-col h-full animate-fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                            
                            <div className="flex flex-wrap gap-2">
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
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
                                >
                                    <FileSignature className="w-4 h-4" /> Generic CSV
                                </button>
                                
                                {state.currentOrganization?.squareApplicationId && (
                                    <button 
                                        onClick={() => showToast.info("Square Payroll export requires active Square integration. Connect in Settings.")}
                                        className="px-4 py-2 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-sm font-bold shadow-sm transition-colors"
                                    >
                                        Square Export
                                    </button>
                                )}
                                
                                {state.currentOrganization?.quickbooksConnected && (
                                    <button 
                                        onClick={() => showToast.info("QuickBooks sync requires active integration. Connect in Settings.")}
                                        className="px-4 py-2 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-xl text-sm font-bold shadow-sm transition-colors"
                                    >
                                        Push to Quickbooks
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-1">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                            <th className="p-4 font-bold text-sm tracking-widest uppercase">Team Member</th>
                                            <th className="p-4 font-bold text-sm tracking-widest uppercase">W-4 Filing Status</th>
                                            <th className="p-4 font-bold text-sm tracking-widest uppercase text-center">PTO Bank</th>
                                            <th className="p-4 font-bold text-sm tracking-widest uppercase text-right">Fallback Sync</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {usersList.map((usr: any) => {
                                            const user = usr as any;
                                            return (
                                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 font-bold flex items-center justify-center">
                                                                {user.firstName?.[0] || user.name?.[0] || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-900 dark:text-white capitalize">{user.firstName || user.name} {user.lastName}</p>
                                                                <p className="text-sm text-gray-500">{user.payType === 'salary' ? 'Salaried' : 'Hourly Worker'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {user.w4Status ? (
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{user.w4Status}</span>
                                                                {(user.w4DependentsAmount || 0) > 0 && <span className="text-xs text-gray-500">Dependents: ${user.w4DependentsAmount}</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded text-xs font-bold uppercase border border-red-200 dark:border-red-800/50">
                                                                Missing Setup
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <span className="text-xl font-black text-gray-900 dark:text-white">{user.ptoAccrued || 0}</span>
                                                            <span className="text-[10px] uppercase font-bold text-gray-400">Hours</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {user.squareTeamMemberId ? (
                                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[10px] font-bold uppercase border border-blue-200 dark:border-blue-800">Linked to Square</span>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs italic">No Fallback</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {usersList.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-gray-500 font-medium">No team members available for reporting.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HROperationsDashboard;
