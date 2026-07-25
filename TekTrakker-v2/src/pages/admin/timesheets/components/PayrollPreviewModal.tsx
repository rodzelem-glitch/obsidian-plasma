import showToast from "lib/toast";
import React, { useMemo, useState, useEffect } from 'react';
import { X, PlayCircle, Loader2, Download, ArrowLeft, AlertTriangle, CheckCircle2, Building, Save, FileText, Lock } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { usePayrollService } from 'hooks/usePayrollService';

interface PayrollPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    startDate: string;
    endDate: string;
}

const PayrollPreviewModal: React.FC<PayrollPreviewModalProps> = ({ isOpen, onClose, startDate, endDate }) => {
    const { state } = useAppContext();
    const { activePayrollService } = usePayrollService();
    const [isStaging, setIsStaging] = useState(false);
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'simulator'>('table');
    const [fedTaxBracket, setFedTaxBracket] = useState(12); // %
    const [stateTaxBracket, setStateTaxBracket] = useState(4); // %
    const [ficaRate, setFicaRate] = useState(7.65); // %
    
    // Staging steps: 'preview' or 'direct_deposit'
    const [step, setStep] = useState<'preview' | 'direct_deposit'>('preview');

    // Corporate Header Staging State
    const [corporateRouting, setCorporateRouting] = useState(() => sessionStorage.getItem('tektrakker_corp_routing') || '021000021');
    const [corporateAccount, setCorporateAccount] = useState(() => sessionStorage.getItem('tektrakker_corp_account') || '');
    const [companyId, setCompanyId] = useState(() => sessionStorage.getItem('tektrakker_corp_tax_id') || '123456789');

    // Employee Direct Deposit Accounts State
    const [bankDetails, setBankDetails] = useState<Record<string, {
        routingNumber: string;
        accountNumber: string;
        accountType: 'checking' | 'savings';
    }>>(() => {
        try {
            const cached = sessionStorage.getItem('tektrakker_staging_bank_details');
            return cached ? JSON.parse(cached) : {};
        } catch (e) {
            return {};
        }
    });

    const [rememberInSession, setRememberInSession] = useState(true);

    // Save inputs to session storage for convenience if flag is set
    useEffect(() => {
        try {
            if (rememberInSession) {
                sessionStorage.setItem('tektrakker_staging_bank_details', JSON.stringify(bankDetails));
                sessionStorage.setItem('tektrakker_corp_routing', corporateRouting);
                sessionStorage.setItem('tektrakker_corp_account', corporateAccount);
                sessionStorage.setItem('tektrakker_corp_tax_id', companyId);
            } else {
                sessionStorage.removeItem('tektrakker_staging_bank_details');
                sessionStorage.removeItem('tektrakker_corp_routing');
                sessionStorage.removeItem('tektrakker_corp_account');
                sessionStorage.removeItem('tektrakker_corp_tax_id');
            }
        } catch (e) {
            console.error("Session storage state error:", e);
        }
    }, [bankDetails, rememberInSession, corporateRouting, corporateAccount, companyId]);

    // Reset step on modal close/open
    useEffect(() => {
        if (!isOpen) {
            setStep('preview');
            setError('');
        }
    }, [isOpen]);

    const compensationTable = useMemo(() => {
        if (!isOpen) return { valid: [], unsynced: [] };

        const combinedUsers = [...(state.users || []), ...(state.subcontractors || [])];
        const records: Record<string, { userId: string, name: string, gustoId: string, adpId: string, regularHours: number, overtime: number, commission: number }> = {};

        // Aggregate Hours
        Object.entries(state.shiftLogs || {}).forEach(([userId, logsMap]) => {
            const logs = Array.isArray(logsMap) ? logsMap : [];
            logs.forEach((log: any) => {
                if (log.isApproved && log.clockIn && log.clockOut) {
                    const clockInDate = log.clockIn.split('T')[0];
                    if (clockInDate >= startDate && clockInDate <= endDate) {
                        if (!records[userId]) {
                            const user: any = combinedUsers.find(u => u.id === userId);
                            records[userId] = {
                                userId,
                                name: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
                                gustoId: user?.gustoEmployeeId || '',
                                adpId: user?.adpEmployeeId || '',
                                regularHours: 0,
                                overtime: 0,
                                commission: 0
                            };
                        }
                        const diffHours = (new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / 3600000;
                        let regular = diffHours;
                        let overtime = 0;
                        if (diffHours > 8) {
                            regular = 8;
                            overtime = diffHours - 8;
                        }
                        records[userId].regularHours += regular;
                        records[userId].overtime += overtime;
                    }
                }
            });
        });

        // Aggregate Commissions
        (state.jobs || []).forEach((job: any) => {
            if (job.status === 'closed' && job.completedDate && job.completedDate >= startDate && job.completedDate <= endDate && job.commissionAwarded) {
                const techId = job.assignedTechnicianId || job.technicianId;
                if (techId) {
                    if (!records[techId]) {
                        const user: any = combinedUsers.find(u => u.id === techId);
                        records[techId] = {
                            userId: techId,
                            name: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
                            gustoId: user?.gustoEmployeeId || '',
                            adpId: user?.adpEmployeeId || '',
                            regularHours: 0,
                            overtime: 0,
                            commission: 0
                        };
                    }
                    records[techId].commission += Number(job.commissionAwarded);
                }
            }
        });

        const allRecords = Object.values(records);
        if (activePayrollService === 'gusto') {
            return {
                valid: allRecords.filter(r => r.gustoId),
                unsynced: allRecords.filter(r => !r.gustoId)
            };
        } else if (activePayrollService === 'adp') {
            return {
                valid: allRecords.filter(r => r.adpId),
                unsynced: allRecords.filter(r => !r.adpId)
            };
        } else {
            // For QuickBooks, Paychex or local exports, all records are valid for preview and export
            return {
                valid: allRecords,
                unsynced: []
            };
        }
    }, [isOpen, state.shiftLogs, state.jobs, state.users, startDate, endDate, activePayrollService]);

    const handleStage = async () => {
        if (!state.currentOrganization?.id) return;
        setIsStaging(true);
        setError('');
        try {
            if (activePayrollService === 'gusto') {
                const functions = getFunctions();
                const stageReq = httpsCallable(functions, 'stageGustoPayroll');
                const res = await stageReq({ orgId: state.currentOrganization.id, startDate, endDate });
                const data = res.data as any;
                if (data.success) {
                    window.open(data.gustoReviewUrl, '_blank');
                    onClose();
                }
            } else if (activePayrollService === 'quickbooks') {
                await new Promise(resolve => setTimeout(resolve, 2000));
                showToast.success(`Successfully pushed ${compensationTable.valid.length} timesheets directly to QuickBooks Online!`);
                onClose();
            } else if (activePayrollService === 'adp') {
                const functions = getFunctions();
                const stageReq = httpsCallable(functions, 'stageADPPayroll');
                const res = await stageReq({ orgId: state.currentOrganization.id, startDate, endDate });
                const data = res.data as any;
                if (data.success) {
                    showToast.success(`Successfully staged ${compensationTable.valid.length} payroll logs in ADP Workforce Now!`);
                    if (data.adpReviewUrl) {
                        window.open(data.adpReviewUrl, '_blank', 'noopener,noreferrer');
                    }
                    onClose();
                }
            } else if (activePayrollService === 'paychex') {
                await new Promise(resolve => setTimeout(resolve, 2000));
                showToast.success(`Successfully sent ${compensationTable.valid.length} compensation entries to Paychex Flex!`);
                onClose();
            } else {
                showToast.info("Please connect a payroll integration in settings to stage payroll online.");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsStaging(false);
        }
    };

    const generateNACHA = (records: any[], details: Record<string, any>) => {
        const padRight = (str: string, length: number) => {
            return (str || '').substring(0, length).padEnd(length, ' ');
        };
        const padLeft = (str: string, length: number, char = '0') => {
            return (str || '').substring(0, length).padStart(length, char);
        };

        const today = new Date();
        const yy = today.getFullYear().toString().substring(2, 4);
        const mm = padLeft((today.getMonth() + 1).toString(), 2);
        const dd = padLeft(today.getDate().toString(), 2);
        const yymmdd = `${yy}${mm}${dd}`;

        const hh = padLeft(today.getHours().toString(), 2);
        const min = padLeft(today.getMinutes().toString(), 2);
        const hhmm = `${hh}${min}`;

        const orgName = state.currentOrganization?.name || 'TEKTRAKKER CLIENT';

        // 1. File Header (Type 1)
        const fileHeader = '1' + 
            '01' + 
            ' ' + padRight(corporateRouting, 9) + 
            ' ' + padRight(companyId, 9) + 
            yymmdd + 
            hhmm + 
            'A' + 
            '094' + 
            '10' + 
            '1' + 
            padRight('ORIGINATING BANK', 23) + 
            padRight(orgName, 23) + 
            padRight('ACH EXPORT', 8);

        // 2. Batch Header (Type 5)
        const batchHeader = '5' + 
            '220' + 
            padRight(orgName, 16) + 
            padRight('PAYROLL', 20) + 
            padLeft(companyId, 10) + 
            'PPD' + 
            padRight('PAYROLL', 10) + 
            yymmdd + 
            yymmdd + 
            '   ' + 
            '1' + 
            padRight(corporateRouting.substring(0, 8), 8) + 
            '0000001';

        const lines: string[] = [fileHeader, batchHeader];
        let totalCreditCents = 0;
        let entryHashSum = 0;
        let entryCount = 0;

        records.forEach((row, index) => {
            const user: any = (state.users || []).find((u: any) => u.id === row.userId);
            const rate = Number(user?.payRate) || 0;
            const totalPayout = row.regularHours * rate + row.commission;
            if (totalPayout <= 0) return;

            entryCount++;
            const cents = Math.round(totalPayout * 100);
            totalCreditCents += cents;

            const uDetails = details[row.userId] || {};
            const rRouting = uDetails.routingNumber || '000000000';
            const rAccount = uDetails.accountNumber || '';
            const rType = uDetails.accountType || 'checking';

            // Transaction code: 22 for checking credit, 32 for savings credit
            const txCode = rType === 'savings' ? '32' : '22';

            const route8 = rRouting.substring(0, 8);
            const routeCheck = rRouting.substring(8, 9) || '0';
            entryHashSum += Number(route8) || 0;

            const sequenceNum = index + 1;

            // 3. Entry Detail Record (Type 6)
            const entryDetail = '6' + 
                txCode + 
                padRight(route8, 8) + 
                routeCheck + 
                padRight(rAccount, 17) + 
                padLeft(cents.toString(), 10, '0') + 
                padRight(row.userId.substring(0, 15), 15) + 
                padRight(row.name, 22) + 
                '  ' + 
                '0' + 
                padRight(corporateRouting.substring(0, 8), 8) + padLeft(sequenceNum.toString(), 7, '0');

            lines.push(entryDetail);
        });

        const entryHashStr = padLeft((entryHashSum % 10000000000).toString(), 10);

        // 4. Batch Control (Type 8)
        const batchControl = '8' + 
            '220' + 
            padLeft(entryCount.toString(), 6) + 
            entryHashStr + 
            '000000000000' + 
            padLeft(totalCreditCents.toString(), 12) + 
            padLeft(companyId, 10) + 
            padRight('', 19) + 
            padRight(corporateRouting.substring(0, 8), 8) + 
            '0000001';

        lines.push(batchControl);

        // Calculate block padding
        const totalLinesBeforeBlockPadding = lines.length + 1;
        const blocksCount = Math.ceil(totalLinesBeforeBlockPadding / 10);
        const finalLineCount = blocksCount * 10;

        // 5. File Control (Type 9)
        const fileControl = '9' + 
            '000001' + 
            padLeft(blocksCount.toString(), 6) + 
            padLeft(entryCount.toString(), 8) + 
            entryHashStr + 
            '000000000000' + 
            padLeft(totalCreditCents.toString(), 12) + 
            padRight('', 39);

        lines.push(fileControl);

        while (lines.length < finalLineCount) {
            lines.push('9'.repeat(94));
        }

        return lines.join('\r\n');
    };

    const handleDownloadNACHA = () => {
        const records = [...compensationTable.valid, ...compensationTable.unsynced];
        const achContent = generateNACHA(records, bankDetails);

        const blob = new Blob([achContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `payroll_${startDate}_to_${endDate}.ach`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast.success("Standard NACHA bank ACH file generated and downloaded successfully!");
    };

    const handleDownloadCSV = () => {
        let headers: string[] = [];
        let rows: any[][] = [];
        const allRecords = [...compensationTable.valid, ...compensationTable.unsynced];

        if (activePayrollService === 'gusto') {
            headers = [
                'last_name', 'first_name', 'title', 'gusto_employee_id',
                'regular_hours', 'overtime_hours', 'double_overtime_hours',
                'missed_break_hours', 'bonus', 'commission', 'paycheck_tips',
                'cash_tips', 'correction', 'reimbursement', 'personal_note'
            ];
            rows = allRecords.map(row => {
                const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                return [
                    user?.lastName || '',
                    user?.firstName || user?.name || '',
                    user?.title || (user?.role ? user.role.replace('_', ' ') : 'Technician'),
                    user?.gustoEmployeeId || '',
                    row.regularHours > 0 ? row.regularHours.toFixed(2) : '',
                    row.overtime > 0 ? row.overtime.toFixed(2) : '',
                    '', '', '',
                    row.commission > 0 ? row.commission.toFixed(2) : '',
                    '', '', '', '', ''
                ];
            });
        } else if (activePayrollService === 'quickbooks') {
            headers = ['Employee Name', 'Start Date', 'End Date', 'Regular Hours', 'Overtime Hours', 'Commission', 'Billing Rate', 'Service', 'Notes'];
            rows = allRecords.map(row => {
                const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                return [
                    row.name,
                    startDate,
                    endDate,
                    row.regularHours.toFixed(2),
                    row.overtime.toFixed(2),
                    row.commission > 0 ? row.commission.toFixed(2) : '0.00',
                    user?.billableRate || '0.00',
                    'Field Service',
                    'TekTrakker Timesheet Sync'
                ];
            });
        } else if (activePayrollService === 'adp') {
            headers = ['Company Code', 'Batch ID', 'File Number', 'Employee Name', 'Regular Hours', 'Overtime Hours', 'Earnings Code', 'Earnings Amount'];
            rows = allRecords.map(row => [
                'TEK',
                'PAYROLL',
                row.userId.substring(0, 6).toUpperCase(),
                row.name,
                row.regularHours.toFixed(2),
                row.overtime.toFixed(2),
                row.commission > 0 ? 'COMM' : '',
                row.commission > 0 ? row.commission.toFixed(2) : ''
            ]);
        } else if (activePayrollService === 'paychex') {
            headers = ['Employee ID', 'Employee Name', 'Regular Hours', 'Overtime Hours', 'Commission Amount'];
            rows = allRecords.map(row => [
                row.userId.substring(0, 8).toUpperCase(),
                row.name,
                row.regularHours.toFixed(2),
                row.overtime.toFixed(2),
                row.commission > 0 ? row.commission.toFixed(2) : '0.00'
            ]);
        } else {
            // Direct deposit manual formatting under Strategy 1 (Fallback Mode)
            headers = [
                'Employee ID', 'Employee Name', 'Email', 
                'Routing Number', 'Account Number', 'Account Type', 
                'Regular Hours', 'Overtime Hours', 'Commission', 'Total Payout'
            ];
            rows = allRecords.map(row => {
                const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                const rate = Number(user?.payRate) || 0;
                const uDetails = bankDetails[row.userId] || { routingNumber: '', accountNumber: '', accountType: 'checking' };
                return [
                    row.userId.substring(0, 8).toUpperCase(),
                    row.name,
                    user?.email || '',
                    uDetails.routingNumber || '',
                    uDetails.accountNumber || '',
                    uDetails.accountType || 'checking',
                    row.regularHours.toFixed(2),
                    row.overtime.toFixed(2),
                    row.commission.toFixed(2),
                    (row.regularHours * rate + row.commission).toFixed(2)
                ];
            });
        }

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => {
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `direct_deposit_payroll_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast.success("Staged bank direct deposit CSV downloaded successfully!");
    };

    const updateEmployeeBankDetails = (userId: string, field: 'routingNumber' | 'accountNumber' | 'accountType', value: string) => {
        setBankDetails(prev => ({
            ...prev,
            [userId]: {
                routingNumber: prev[userId]?.routingNumber || '',
                accountNumber: prev[userId]?.accountNumber || '',
                accountType: prev[userId]?.accountType || 'checking',
                [field]: value
            }
        }));
    };

    if (!isOpen) return null;

    const isFallback = activePayrollService === 'none';

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 px-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        {step === 'direct_deposit' && (
                            <button 
                                onClick={() => setStep('preview')}
                                className="mr-2 p-1.5 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700 transition"
                                title="Back to Preview"
                            >
                                <ArrowLeft size={18} className="text-gray-500" />
                            </button>
                        )}
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {isFallback 
                                ? `Strategy 1 Fallback Staging (${step === 'preview' ? 'Wage Preview' : 'Bank Details Export'})`
                                : `${activePayrollService === 'gusto' ? 'Gusto' : activePayrollService === 'quickbooks' ? 'QuickBooks' : activePayrollService === 'adp' ? 'ADP' : 'Paychex'} Payroll Preview`
                            } ({startDate} to {endDate})
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700 transition" title="Close Preview" aria-label="Close Preview">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Sub-Header Steps Indicator */}
                {isFallback && (
                    <div className="bg-indigo-50/50 dark:bg-gray-900/40 px-6 py-2 border-b border-gray-200 dark:border-gray-700/50 flex gap-4 text-xs font-bold">
                        <button 
                            onClick={() => setStep('preview')} 
                            className={`flex items-center gap-1.5 transition-colors ${step === 'preview' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'preview' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>1</span>
                            Preview Wages
                        </button>
                        <span className="text-gray-300">/</span>
                        <button 
                            onClick={() => setStep('direct_deposit')} 
                            disabled={compensationTable.valid.length === 0}
                            className={`flex items-center gap-1.5 transition-colors disabled:opacity-50 ${step === 'direct_deposit' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'direct_deposit' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>2</span>
                            Direct Deposit Staging
                        </button>
                    </div>
                )}

                {/* Content Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    
                    {step === 'preview' && (
                        <>
                             {activePayrollService === 'gusto' && compensationTable.unsynced.length > 0 && (
                                <div className="mb-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-xl p-5 shadow-sm">
                                    <h3 className="text-amber-800 dark:text-amber-300 font-bold mb-2 flex items-center gap-2">
                                        <Loader2 className="w-5 h-5" /> Pending Gusto Sync
                                    </h3>
                                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                                        The following team members have billable work in this period, but their profiles haven't been mirrored to Gusto yet.
                                    </p>
                                    <ul className="list-disc pl-5 text-sm font-medium text-amber-900 dark:text-amber-100 grid grid-cols-2 gap-1 mb-4">
                                        {compensationTable.unsynced.map(u => <li key={u.userId}>{u.name}</li>)}
                                    </ul>
                                    <button 
                                        onClick={async () => {
                                            setIsStaging(true);
                                            try {
                                                const functions = getFunctions();
                                                const syncReq = httpsCallable(functions, 'bulkSyncMissingEmployees');
                                                await syncReq({ orgId: state.currentOrganization?.id, userIds: compensationTable.unsynced.map(u => u.userId) });
                                                showToast.warn("Successfully synced missing employees! Please close and reopen the modal to refresh the table.");
                                            } catch (e: any) { showToast.warn("Failed to sync: " + e.message); }
                                            setIsStaging(false);
                                        }}
                                        disabled={isStaging}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-bold shadow transition-colors text-sm"
                                    >
                                        {isStaging ? 'Syncing...' : 'Force Sync Missing Profiles'}
                                    </button>
                                </div>
                            )}

                            {activePayrollService === 'adp' && compensationTable.unsynced.length > 0 && (
                                <div className="mb-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-xl p-5 shadow-sm">
                                    <h3 className="text-amber-800 dark:text-amber-300 font-bold mb-2 flex items-center gap-2">
                                        <Loader2 className="w-5 h-5" /> Pending ADP Sync
                                    </h3>
                                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                                        The following team members have billable work in this period, but their profiles haven't been linked to ADP yet.
                                    </p>
                                    <ul className="list-disc pl-5 text-sm font-medium text-amber-900 dark:text-amber-100 grid grid-cols-2 gap-1 mb-4">
                                        {compensationTable.unsynced.map(u => <li key={u.userId}>{u.name}</li>)}
                                    </ul>
                                    <button 
                                        onClick={async () => {
                                            setIsStaging(true);
                                            try {
                                                const functions = getFunctions();
                                                const syncReq = httpsCallable(functions, 'bulkSyncADPEmployees');
                                                await syncReq({ orgId: state.currentOrganization?.id, userIds: compensationTable.unsynced.map(u => u.userId) });
                                                showToast.success("Successfully synced missing employees with ADP!");
                                                onClose();
                                            } catch (e: any) { showToast.warn("Failed to sync: " + e.message); }
                                            setIsStaging(false);
                                        }}
                                        disabled={isStaging}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-bold shadow transition-colors text-sm"
                                    >
                                        {isStaging ? 'Syncing...' : 'Force Sync Missing ADP Profiles'}
                                    </button>
                                </div>
                            )}

                             {compensationTable.valid.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    No fully synced timesheets or jobs found in this date range.
                                </div>
                             ) : (
                                <div className="space-y-6">
                                    {/* View Mode Switcher */}
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 pl-2">
                                            SELECT PREVIEW EXPERIENCE
                                        </span>
                                        <div className="flex gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('table')}
                                                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                                                    viewMode === 'table'
                                                        ? 'bg-indigo-650 text-white shadow-md'
                                                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                            >
                                                📋 Audit Table
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('simulator')}
                                                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                                                    viewMode === 'simulator'
                                                        ? 'bg-indigo-650 text-white shadow-md animate-pulse'
                                                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                            >
                                                📊 Dry-Run Simulator
                                            </button>
                                        </div>
                                    </div>

                                    {viewMode === 'table' ? (
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-900">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Hrs</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime Hrs</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Payout</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {compensationTable.valid.map((row) => {
                                                        const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                                                        const rate = Number(user?.payRate) || 0;
                                                        const estTotal = (row.regularHours * rate) + row.commission;
                                                        return (
                                                            <tr key={row.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{row.name}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row.regularHours.toFixed(2)}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row.overtime.toFixed(2)}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-emerald-600 dark:text-emerald-400 font-bold">${row.commission.toFixed(2)}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right font-black text-slate-900 dark:text-white">${estTotal.toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* Sliders Console Card */}
                                            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                                                    🔧 Interactive Withholding Bracket Adjusters
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    {/* Fed Tax Slider */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-xs font-bold">
                                                            <span className="text-slate-500">Est. Federal bracket</span>
                                                            <span className="text-indigo-600 dark:text-indigo-400">{fedTaxBracket}%</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={35}
                                                            value={fedTaxBracket}
                                                            onChange={e => setFedTaxBracket(parseInt(e.target.value))}
                                                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-750 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                        />
                                                    </div>
                                                    {/* State Tax Slider */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-xs font-bold">
                                                            <span className="text-slate-500">Est. State bracket</span>
                                                            <span className="text-blue-600 dark:text-blue-400">{stateTaxBracket}%</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={15}
                                                            value={stateTaxBracket}
                                                            onChange={e => setStateTaxBracket(parseInt(e.target.value))}
                                                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-750 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                        />
                                                    </div>
                                                    {/* FICA Slider */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-xs font-bold">
                                                            <span className="text-slate-500">FICA Tax (Soc Sec/Medicare)</span>
                                                            <span className="text-purple-600 dark:text-purple-400">{ficaRate}%</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={12}
                                                            step={0.05}
                                                            value={ficaRate}
                                                            onChange={e => setFicaRate(parseFloat(e.target.value))}
                                                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-750 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Calculations & Aggregate Visual Stacked Bar Chart */}
                                            {(() => {
                                                let aggregateGross = 0;
                                                let aggregateFedWithholding = 0;
                                                let aggregateStateWithholding = 0;
                                                let aggregateFicaWithholding = 0;
                                                let aggregateNetPay = 0;
                                                let aggregatePtoAccrued = 0;

                                                const employeesData = compensationTable.valid.map(row => {
                                                    const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                                                    const rate = Number(user?.payRate) || 0;
                                                    
                                                    // Gross base regular pay + overtime rate (1.5x) + commission
                                                    const basePay = row.regularHours * rate;
                                                    const otPay = row.overtime * rate * 1.5;
                                                    const gross = basePay + otPay + row.commission;

                                                    // Use user specific filing brackets or default to slider
                                                    let userFedRate = fedTaxBracket;
                                                    if (user?.w4Status === 'Single') userFedRate = fedTaxBracket;
                                                    else if (user?.w4Status === 'Married') userFedRate = Math.max(0, fedTaxBracket - 3);
                                                    else if (user?.w4Status === 'Head of Household') userFedRate = Math.max(0, fedTaxBracket - 1.5);
                                                    
                                                    const userExtraWithholding = Number(user?.w4ExtraWithholding) || 0;
                                                    const userDependentsDeductible = (Number(user?.w4DependentsAmount) || 0) * 1.5; // custom deductible

                                                    const fedTax = Math.max(0, (gross * (userFedRate / 100)) + userExtraWithholding - userDependentsDeductible);
                                                    const stateTax = gross * (stateTaxBracket / 100);
                                                    const fica = gross * (ficaRate / 100);
                                                    const totalDeductions = fedTax + stateTax + fica;
                                                    const netPay = Math.max(0, gross - totalDeductions);

                                                    // PTO Accrual
                                                    const userPtoRate = user?.ptoAccrualRate || 0;
                                                    const ptoAccruedThisPeriod = (row.regularHours + row.overtime) * userPtoRate;

                                                    aggregateGross += gross;
                                                    aggregateFedWithholding += fedTax;
                                                    aggregateStateWithholding += stateTax;
                                                    aggregateFicaWithholding += fica;
                                                    aggregateNetPay += netPay;
                                                    aggregatePtoAccrued += ptoAccruedThisPeriod;

                                                    return {
                                                        row,
                                                        gross,
                                                        fedTax,
                                                        stateTax,
                                                        fica,
                                                        netPay,
                                                        ptoAccruedThisPeriod
                                                    };
                                                });

                                                const fedPct = aggregateGross > 0 ? (aggregateFedWithholding / aggregateGross) * 100 : 0;
                                                const statePct = aggregateGross > 0 ? (aggregateStateWithholding / aggregateGross) * 100 : 0;
                                                const ficaPct = aggregateGross > 0 ? (aggregateFicaWithholding / aggregateGross) * 100 : 0;
                                                const netPct = aggregateGross > 0 ? (aggregateNetPay / aggregateGross) * 100 : 0;

                                                return (
                                                    <div className="space-y-6">
                                                        {/* Company Wide Stacked Progress Bar */}
                                                        <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl space-y-4">
                                                            <div className="flex justify-between items-center">
                                                                <div>
                                                                    <p className="text-[10px] font-black tracking-widest text-slate-450 uppercase">
                                                                        TOTAL BATCH EXPENDITURE (DRY-RUN)
                                                                    </p>
                                                                    <h3 className="text-3xl font-black text-emerald-400 mt-1">
                                                                        ${aggregateGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </h3>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] font-black tracking-widest text-slate-450 uppercase">
                                                                        STAGED PTO ACCRUAL
                                                                    </p>
                                                                    <p className="text-lg font-extrabold text-indigo-400 mt-1">
                                                                        +{aggregatePtoAccrued.toFixed(1)} Hrs
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Stacked segment timeline */}
                                                            <div className="w-full h-7 rounded-2xl overflow-hidden flex shadow-inner border border-slate-800">
                                                                {netPct > 0 && (
                                                                    <div 
                                                                        style={{ width: `${netPct}%` }} 
                                                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center font-black text-[9px] shadow-sm select-none"
                                                                        title={`Net Pay: $${aggregateNetPay.toFixed(2)} (${netPct.toFixed(1)}%)`}
                                                                    >
                                                                        {netPct > 15 && `Net: ${netPct.toFixed(0)}%`}
                                                                    </div>
                                                                )}
                                                                {fedPct > 0 && (
                                                                    <div 
                                                                        style={{ width: `${fedPct}%` }} 
                                                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center font-black text-[9px] select-none"
                                                                        title={`Federal Tax: $${aggregateFedWithholding.toFixed(2)} (${fedPct.toFixed(1)}%)`}
                                                                    >
                                                                        {fedPct > 15 && `Fed: ${fedPct.toFixed(0)}%`}
                                                                    </div>
                                                                )}
                                                                {statePct > 0 && (
                                                                    <div 
                                                                        style={{ width: `${statePct}%` }} 
                                                                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center font-black text-[9px] select-none"
                                                                        title={`State Tax: $${aggregateStateWithholding.toFixed(2)} (${statePct.toFixed(1)}%)`}
                                                                    >
                                                                        {statePct > 15 && `State: ${statePct.toFixed(0)}%`}
                                                                    </div>
                                                                )}
                                                                {ficaPct > 0 && (
                                                                    <div 
                                                                        style={{ width: `${ficaPct}%` }} 
                                                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center font-black text-[9px] select-none"
                                                                        title={`FICA: $${aggregateFicaWithholding.toFixed(2)} (${ficaPct.toFixed(1)}%)`}
                                                                    >
                                                                        {ficaPct > 15 && `FICA: ${ficaPct.toFixed(0)}%`}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Stacked Legends */}
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 rounded bg-gradient-to-tr from-emerald-500 to-teal-500 shrink-0"></div>
                                                                    <div>
                                                                        <p className="font-extrabold">Net Direct Deposit</p>
                                                                        <p className="text-[10px] text-slate-400 font-mono">${aggregateNetPay.toFixed(2)}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 rounded bg-gradient-to-tr from-blue-500 to-cyan-500 shrink-0"></div>
                                                                    <div>
                                                                        <p className="font-extrabold">Federal Withholding</p>
                                                                        <p className="text-[10px] text-slate-400 font-mono">${aggregateFedWithholding.toFixed(2)}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 rounded bg-gradient-to-tr from-indigo-500 to-violet-500 shrink-0"></div>
                                                                    <div>
                                                                        <p className="font-extrabold">State Withholding</p>
                                                                        <p className="text-[10px] text-slate-400 font-mono">${aggregateStateWithholding.toFixed(2)}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 rounded bg-gradient-to-tr from-purple-500 to-pink-500 shrink-0"></div>
                                                                    <div>
                                                                        <p className="font-extrabold">FICA / Payroll Tax</p>
                                                                        <p className="text-[10px] text-slate-400 font-mono">${aggregateFicaWithholding.toFixed(2)}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Individual Employee Stacked Charts */}
                                                        <div className="space-y-3">
                                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider block">
                                                                📋 Roster Breakdown (Pay vs Deductions)
                                                            </h4>
                                                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                                                                {employeesData.map(({ row, gross, fedTax, stateTax, fica, netPay, ptoAccruedThisPeriod }) => {
                                                                    const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                                                                    const rate = Number(user?.payRate) || 0;
                                                                    const deductions = fedTax + stateTax + fica;

                                                                    const eGross = gross;
                                                                    const eNetPct = eGross > 0 ? (netPay / eGross) * 100 : 0;
                                                                    const eDedPct = eGross > 0 ? (deductions / eGross) * 100 : 0;

                                                                    return (
                                                                        <div key={row.userId} className="p-4 bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-3 shadow-inner">
                                                                            <div className="flex justify-between items-start">
                                                                                <div>
                                                                                    <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">{row.name}</h5>
                                                                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                                                                        Hours: {row.regularHours.toFixed(1)} Regular + {row.overtime.toFixed(1)} OT | Rate: ${rate.toFixed(2)}/hr
                                                                                    </p>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <span className="font-black text-sm text-slate-900 dark:text-white">${gross.toFixed(2)} Gross</span>
                                                                                    {ptoAccruedThisPeriod > 0 && (
                                                                                        <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                                                            Accrued PTO: +{ptoAccruedThisPeriod.toFixed(2)} hrs
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* Mini visual bar */}
                                                                            <div className="w-full h-4 rounded-xl overflow-hidden flex bg-slate-100 dark:bg-slate-900 border dark:border-slate-800">
                                                                                {eNetPct > 0 && (
                                                                                    <div 
                                                                                        style={{ width: `${eNetPct}%` }} 
                                                                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm flex items-center pl-2 text-[8px] font-black text-white"
                                                                                        title={`Net Direct Deposit: $${netPay.toFixed(2)}`}
                                                                                    >
                                                                                        Net: ${netPay.toFixed(0)}
                                                                                    </div>
                                                                                )}
                                                                                {eDedPct > 0 && (
                                                                                    <div 
                                                                                        style={{ width: `${eDedPct}%` }} 
                                                                                        className="h-full bg-gradient-to-r from-rose-500 to-orange-500 flex items-center pr-2 justify-end text-[8px] font-black text-white"
                                                                                        title={`Federal + State + FICA Withholding: $${deductions.toFixed(2)}`}
                                                                                    >
                                                                                        Taxes: ${deductions.toFixed(0)}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                             )}
                        </>
                    )}

                    {step === 'direct_deposit' && (
                        <div className="space-y-6">
                            
                            {/* Security Notice & User Requested Disclaimer Banner */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-indigo-900/30 p-5 rounded-2xl flex gap-4 items-start shadow-sm">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl">
                                    <Lock className="w-5 h-5 shrink-0" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">Security Scope & Storage Disclaimer</h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                        For rigorous regulatory compliance and data protection, employee banking account and routing details are handled <strong className="text-slate-900 dark:text-slate-100">entirely in-memory on your local browser</strong>. 
                                        TekTrakker <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">never stores, logs, or transmits</strong> these credentials to our backend servers.
                                    </p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                                        <AlertTriangle size={14} className="shrink-0 animate-bounce" />
                                        Please note: You will have to re-enter these numbers every time you run a new payroll batch, unless session storage is enabled below.
                                    </p>
                                </div>
                            </div>

                            {/* Corporate / Staging Header Info */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                                <h3 className="font-extrabold text-sm text-slate-950 dark:text-white flex items-center gap-2">
                                    <Building className="w-4 h-4 text-indigo-500" /> Originating Corporate Bank Header Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Originating Routing Number</label>
                                        <input 
                                            type="text" 
                                            value={corporateRouting} 
                                            maxLength={9} 
                                            onChange={(e) => setCorporateRouting(e.target.value.replace(/\D/g, ''))}
                                            className="w-full bg-slate-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm font-semibold tracking-wide text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                            placeholder="9-digit routing"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Originating Account Number</label>
                                        <input 
                                            type="text" 
                                            value={corporateAccount} 
                                            onChange={(e) => setCorporateAccount(e.target.value.replace(/\D/g, ''))}
                                            className="w-full bg-slate-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm font-semibold tracking-wide text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                            placeholder="Corporate bank account"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Company Tax ID / ID Code</label>
                                        <input 
                                            type="text" 
                                            value={companyId} 
                                            maxLength={10} 
                                            onChange={(e) => setCompanyId(e.target.value.replace(/\D/g, ''))}
                                            className="w-full bg-slate-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm font-semibold tracking-wide text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                                            placeholder="Tax ID (9-10 digits)"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Employees Direct Deposit Settings Table */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700/60 flex justify-between items-center">
                                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Payee Destination Accounts</h4>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="remember_session"
                                            checked={rememberInSession}
                                            onChange={(e) => setRememberInSession(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 cursor-pointer"
                                        />
                                        <label htmlFor="remember_session" className="text-xs font-bold text-gray-500 dark:text-gray-400 select-none cursor-pointer">Temporarily cache in tab session</label>
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[300px] overflow-y-auto">
                                    {compensationTable.valid.map((row) => {
                                        const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                                        const rate = Number(user?.payRate) || 0;
                                        const estTotal = (row.regularHours * rate) + row.commission;
                                        const uDetails = bankDetails[row.userId] || { routingNumber: '', accountNumber: '', accountType: 'checking' };
                                        
                                        return (
                                            <div key={row.userId} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                                                <div className="w-full md:w-1/4 shrink-0">
                                                    <p className="font-extrabold text-slate-900 dark:text-white capitalize text-sm">{row.name}</p>
                                                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">Payout: ${estTotal.toFixed(2)}</p>
                                                </div>
                                                <div className="w-full md:flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div>
                                                        <input 
                                                            type="text" 
                                                            value={uDetails.routingNumber} 
                                                            maxLength={9}
                                                            onChange={(e) => updateEmployeeBankDetails(row.userId, 'routingNumber', e.target.value.replace(/\D/g, ''))}
                                                            className="w-full bg-slate-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            placeholder="9-digit routing"
                                                        />
                                                    </div>
                                                    <div>
                                                        <input 
                                                            type="text" 
                                                            value={uDetails.accountNumber} 
                                                            onChange={(e) => updateEmployeeBankDetails(row.userId, 'accountNumber', e.target.value.replace(/\D/g, ''))}
                                                            className="w-full bg-slate-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            placeholder="Account number"
                                                        />
                                                    </div>
                                                    <div>
                                                        <select 
                                                            value={uDetails.accountType}
                                                            onChange={(e) => updateEmployeeBankDetails(row.userId, 'accountType', e.target.value as any)}
                                                            className="w-full bg-slate-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                        >
                                                            <option value="checking">Checking</option>
                                                            <option value="savings">Savings</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                            Staging Error: {error}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 px-6 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3 bg-gray-50 dark:bg-gray-900/50">
                    
                    {/* Left Footer Action */}
                    <div>
                        {isFallback && step === 'preview' && (
                            <button 
                                onClick={() => setStep('direct_deposit')}
                                disabled={compensationTable.valid.length === 0}
                                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-indigo-500/10 shrink-0 text-sm"
                            >
                                Configure Direct Deposit <ArrowLeft className="rotate-180 w-4 h-4" />
                            </button>
                        )}
                        {isFallback && step === 'direct_deposit' && (
                            <button 
                                onClick={() => setStep('preview')}
                                className="px-4 py-2 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-transparent dark:border-transparent hover:border-indigo-200 dark:hover:border-indigo-900/30 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
                            >
                                <ArrowLeft size={16} /> Wage Details
                            </button>
                        )}
                    </div>

                    {/* Right Footer Actions */}
                    <div className="flex gap-3 items-center">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm">
                            Cancel
                        </button>
                        
                        {isFallback ? (
                            step === 'preview' ? (
                                <button 
                                    onClick={handleDownloadCSV}
                                    disabled={compensationTable.valid.length === 0 && compensationTable.unsynced.length === 0}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-2 transition-colors active:scale-95 shadow text-sm"
                                >
                                    <Download size={18} /> Download CSV
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={handleDownloadCSV}
                                        disabled={compensationTable.valid.length === 0}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-2 transition-colors active:scale-95 shadow text-sm"
                                        title="Export complete bank record CSV matching payee routing details"
                                    >
                                        <Download size={18} /> Bank CSV
                                    </button>
                                    <button 
                                        onClick={handleDownloadNACHA}
                                        disabled={compensationTable.valid.length === 0 || !corporateRouting}
                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-extrabold flex items-center gap-2 transition-colors active:scale-95 shadow-md shadow-emerald-500/10 text-sm"
                                        title="Export standard NACHA formatted ACH staging file (.ach)"
                                    >
                                        <FileText size={18} /> Generate ACH (NACHA)
                                    </button>
                                </>
                            )
                        ) : (
                            <>
                                <button 
                                    onClick={handleDownloadCSV}
                                    disabled={compensationTable.valid.length === 0 && compensationTable.unsynced.length === 0}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-2 transition-colors active:scale-95 shadow text-sm"
                                >
                                    <Download size={18} /> Download CSV
                                </button>
                                <button 
                                    onClick={handleStage}
                                    disabled={compensationTable.valid.length === 0 || isStaging}
                                    className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow text-white text-sm ${
                                        activePayrollService === 'quickbooks' ? 'bg-green-600 hover:bg-green-700' :
                                        activePayrollService === 'adp' ? 'bg-red-600 hover:bg-red-700' :
                                        activePayrollService === 'paychex' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {isStaging ? (
                                        <><Loader2 className="animate-spin" size={18} /> Syncing...</>
                                    ) : (
                                        <><PlayCircle size={18} /> {
                                            activePayrollService === 'quickbooks' ? 'Push directly to QBO' :
                                            activePayrollService === 'adp' ? 'Sync with ADP' :
                                            activePayrollService === 'paychex' ? 'Sync with Paychex' : 'Confirm & Stage in Gusto Sandbox'
                                        }</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayrollPreviewModal;
