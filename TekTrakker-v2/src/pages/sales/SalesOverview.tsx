import showToast from "lib/toast";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import type { PlatformLead, CommissionSettings, Organization, User } from '../../types';
import { DollarSign, Briefcase, Users, PieChart, FileText, Download, PlayCircle, User as UserIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmployeeProfileModal from '../../components/modals/EmployeeProfileModal';
import SignaturePad, { SignaturePadHandle } from '../../components/ui/SignaturePad';
import { MOCK_DEMO_LEADS } from '../../lib/mockDemoData';
import DOMPurify from 'dompurify';

const DEFAULT_COMMISSION_RULES: CommissionSettings = {
    baseRate: 0.25,
    acceleratorRate: 0.30,
    annualQuota: 500000,
    renewalRate: 0.05,
    rampUpMonths: {
        phase1: 3,
        phase1QuotaPct: 0.50,
        phase2: 6,
        phase2QuotaPct: 0.75
    }
};

const SalesOverview: React.FC = () => {
    const { state, dispatch, startDemo } = useAppContext();
    const { currentUser, isDemoMode } = state;
    const navigate = useNavigate();
    const [leads, setLeads] = useState<PlatformLead[]>([]);
    const [viewContract, setViewContract] = useState(false);
    const [commissionRules, setCommissionRules] = useState<CommissionSettings | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const sigPadRef = useRef<SignaturePadHandle>(null);
    const [isSigning, setIsSigning] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        if (isDemoMode) {
            setLeads(MOCK_DEMO_LEADS as PlatformLead[]);
            setCommissionRules(DEFAULT_COMMISSION_RULES);
            return;
        }

        const unsub = db.collection('platformLeads')
            .where('repId', '==', currentUser.id)
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as PlatformLead));
                setLeads(data);
            }, (error) => {
                console.error("Firestore error:", error);
            });
            
        db.collection('settings').doc('commission_rules').get().then(doc => {
            if (currentUser.customCommissionSettings) {
                setCommissionRules(currentUser.customCommissionSettings);
            } else if (doc.exists) {
                setCommissionRules(doc.data() as CommissionSettings);
            } else {
                setCommissionRules(DEFAULT_COMMISSION_RULES);
            }
        });
            
        return () => unsub();
    }, [currentUser, isDemoMode]);

    const metrics = useMemo(() => {
        const totalPipeline = leads.reduce((sum, l) => sum + (l.status !== 'Closed Lost' ? (l.value || 0) : 0), 0);
        const closedWon = leads.filter(l => l.status === 'Closed Won').reduce((sum, l) => sum + (l.value || 0), 0);
        const openLeads = leads.filter(l => !['Closed Won', 'Closed Lost'].includes(l.status)).length;
        const rate = commissionRules?.baseRate || 0.25;
        const projectedCommission = closedWon * rate; 
        return { totalPipeline, closedWon, openLeads, projectedCommission };
    }, [leads, commissionRules]);
    
    const handleLaunchDemo = () => {
        // Use the centralized startDemo system
        startDemo('admin');
    };

    const generateContractHtml = (rep: User, rules: CommissionSettings) => {
        return `
            <h1 style="text-align:center;text-transform:uppercase;">Independent Sales Representative Agreement</h1>
            <p>This Agreement is made effective as of <strong>${new Date(rep.salesContractDate || Date.now()).toLocaleDateString()}</strong> between <strong>TekTrakker Platform</strong> ("Company") and <strong>${rep.firstName} ${rep.lastName}</strong> ("Representative").</p>
            
            <h3>1. Services Provided</h3>
            <p>Representative agrees to promote and sell Company’s software services to eligible businesses. Representative is an independent contractor, not an employee.</p>
            
            <h3>2. Compensation</h3>
            <p>Company agrees to pay Representative commissions based on the current Commission Schedule:</p>
            <ul>
                <li><strong>Base Commission:</strong> ${(rules.baseRate * 100).toFixed(1)}% of first-year revenue collected.</li>
                <li><strong>Accelerator:</strong> ${(rules.acceleratorRate * 100).toFixed(1)}% for revenue above annual quota of $${rules.annualQuota.toLocaleString()}.</li>
                <li><strong>Renewal:</strong> ${(rules.renewalRate * 100).toFixed(1)}% on subscription renewals.</li>
            </ul>
            
            <h3>3. Ramp Up Period</h3>
            <p>During the initial period of engagement, Representative is subject to modified quota requirements:</p>
            <ul>
                <li>Months 1-${rules.rampUpMonths.phase1}: ${(rules.rampUpMonths.phase1QuotaPct * 100).toFixed(0)}% of prorated annual quota required.</li>
                <li>Months ${rules.rampUpMonths.phase1 + 1}-${rules.rampUpMonths.phase2}: ${(rules.rampUpMonths.phase2QuotaPct * 100).toFixed(0)}% of prorated annual quota required.</li>
            </ul>

            <h3>4. Term and Termination</h3>
            <p>This Agreement may be terminated by either party with 30 days written notice. Upon termination, pending commissions will be paid out as collected.</p>
            
            <h3>5. Confidentiality</h3>
            <p>Representative agrees to keep all customer data, pricing strategies, and proprietary information confidential.</p>
        `;
    };

    const handlePrintContract = () => {
        if (!currentUser || !commissionRules) return;
        const html = currentUser.salesContractContent || generateContractHtml(currentUser, commissionRules);
        const signatureSection = currentUser.salesContractSignature ? `
            <div style="margin-top:60px; display:flex; justify-content:space-between;">
                <div style="width:45%">
                    <p style="border-bottom:1px solid #000; padding-bottom:5px;">Master Admin</p>
                    <p><strong>TekTrakker Platform</strong></p>
                </div>
                <div style="width:45%">
                    <img src="${currentUser.salesContractSignature}" style="max-height:60px; display:block; border-bottom:1px solid #000;" />
                    <p><strong>${currentUser.firstName} ${currentUser.lastName}</strong></p>
                </div>
            </div>
        ` : `<p style="margin-top:40px; font-style:italic;">Contract pending signature.</p>`;

        const win = window.open('', '_blank');
        if (win) {
            const sanitizedBody = DOMPurify.sanitize(html + signatureSection);
            win.document.write(`<html><head><title>Contract</title><style>body { font-family: serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }</style></head><body>${sanitizedBody}</body></html>`);
            win.document.close();
            setTimeout(() => { win.focus(); win.print(); }, 500);
        }
    };

    const handleSignContract = async () => {
        if (!currentUser || !sigPadRef.current || sigPadRef.current.isEmpty()) { showToast.warn("Please provide signature."); return; }
        
        if (isDemoMode) {
            showToast.warn("Contract signing is disabled in Demo Mode.");
            return;
        }

        setIsSigning(true);
        try {
            const signature = sigPadRef.current.toDataURL();
            const contractContent = currentUser.salesContractContent || (commissionRules ? generateContractHtml(currentUser, commissionRules) : '');
            const updateData = { salesContractSigned: true, salesContractDate: new Date().toISOString(), salesContractSignature: signature, salesContractContent: DOMPurify.sanitize(contractContent) };
            await db.collection('users').doc(currentUser.id).update(updateData);
            dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...currentUser, ...updateData } as User & { id: string } });
            showToast.warn("Contract accepted.");
        } catch (e) { showToast.warn("Failed to save signature."); } finally { setIsSigning(false); }
    };

    if (!currentUser) return null;

    return (
        <div className="space-y-6 pb-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Sales Overview</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={handleLaunchDemo} className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-700">
                        <PlayCircle size={16}/> Launch Demo
                    </Button>
                    <Button onClick={() => setViewContract(true)} variant="secondary" className="flex items-center gap-2 text-xs">
                        <FileText size={16}/> Contract
                    </Button>
                    <Button onClick={() => setIsProfileModalOpen(true)} variant="secondary" className="flex items-center gap-2 text-xs">
                        <UserIcon size={16}/> Profile
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-emerald-50 border-emerald-200 p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/sales/commissions')}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-200 text-emerald-700 rounded-full"><DollarSign size={24}/></div>
                        <div><p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Closed Revenue</p><p className="text-3xl font-black text-emerald-900">${metrics.closedWon.toLocaleString()}</p></div>
                    </div>
                </Card>
                <Card className="bg-blue-50 border-blue-200 p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/sales/pipeline')}>
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-200 text-blue-700 rounded-full"><Briefcase size={24}/></div>
                        <div><p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Pipeline Value</p><p className="text-3xl font-black text-blue-900">${metrics.totalPipeline.toLocaleString()}</p></div>
                    </div>
                </Card>
                <Card className="bg-purple-50 border-purple-200 p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/sales/commissions')}>
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-200 text-purple-700 rounded-full"><PieChart size={24}/></div>
                        <div><p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Est. Commission</p><p className="text-3xl font-black text-purple-900">${metrics.projectedCommission.toLocaleString()}</p></div>
                    </div>
                </Card>
                <Card className="bg-slate-50 border-slate-200 p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/sales/leads')}>
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-200 text-slate-700 rounded-full"><Users size={24}/></div>
                        <div><p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Open Leads</p><p className="text-3xl font-black text-slate-900">{metrics.openLeads}</p></div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-96 flex flex-col justify-center items-center text-slate-400 border-2 border-dashed">
                    <PieChart size={48} className="mb-4 opacity-50"/>
                    <p className="font-bold">Performance Analytics</p>
                    <p className="text-xs">Detailed revenue charts will appear here as data accumulates.</p>
                </Card>
                 <Card className="h-96 overflow-y-auto">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">Recent Activity</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm text-slate-500 text-center italic">Activity log will populate as you engage with leads.</div>
                    </div>
                </Card>
            </div>

            <Modal isOpen={viewContract} onClose={() => setViewContract(false)} title="My Sales Agreement" size="lg">
                <div className="space-y-6 flex flex-col h-[80vh]">
                    <div className="bg-white border p-4 md:p-8 shadow-sm flex-1 overflow-y-auto text-sm text-slate-800 font-serif leading-relaxed custom-scrollbar">
                        {currentUser && commissionRules ? <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentUser.salesContractContent || generateContractHtml(currentUser, commissionRules)) }} /> : <div className="text-center p-4 md:p-8 text-gray-500">Loading...</div>}
                    </div>
                    {!currentUser?.salesContractSigned && <div className="p-4 bg-slate-50 border rounded-lg"><p className="text-sm font-bold mb-2">Sign Here:</p><SignaturePad ref={sigPadRef} className="h-32 bg-white" /></div>}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        {currentUser?.salesContractSigned ? <Button variant="secondary" onClick={handlePrintContract} className="flex items-center gap-2"><Download size={16} /> Print</Button> : <Button onClick={handleSignContract} disabled={isSigning} className="bg-emerald-600">{isSigning ? 'Signing...' : 'Sign Agreement'}</Button>}
                        <Button variant="secondary" onClick={() => setViewContract(false)}>Close</Button>
                    </div>
                </div>
            </Modal>
            
            {isProfileModalOpen && <EmployeeProfileModal isOpen={true} onClose={() => setIsProfileModalOpen(false)} employee={currentUser} isSelf={true} />}
        </div>
    );
};

export default SalesOverview;
