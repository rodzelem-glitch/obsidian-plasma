
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { useSearchParams } from 'react-router-dom';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import type { RefrigerantCylinder, RefrigerantTransaction, ToolMaintenanceLog, BusinessDocument, User } from 'types';
import { CheckCircle, AlertTriangle, Wrench, Shield, Users, Printer, Flag } from 'lucide-react';

import RefrigerantTab from './compliance/components/RefrigerantTab';
import ToolsTab from './compliance/components/ToolsTab';
import CertsTab from './compliance/components/CertsTab';
import PolicyTrackingTab from './compliance/components/PolicyTrackingTab';
import HRHandbookView from './compliance/components/HRHandbookView';
import IncidentsTab from './compliance/components/IncidentsTab';

const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
    });
};

const ComplianceDashboard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [searchParams] = useSearchParams();
    const industry = state.currentOrganization?.industry || 'HVAC';
    const { currentUser } = state;
    
    // Determine initial tab from URL or default
    const getInitialTab = () => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'hr') return 'hr';
        if (tabParam === 'incidents') return 'incidents';
        return industry === 'HVAC' ? 'refrigerant' : 'tools';
    };

    const [activeTab, setActiveTab] = useState<'tools' | 'certs' | 'hr' | 'policy_tracking' | 'incidents'>(
        getInitialTab() as any
    );
    
    // Update tab if URL parameter changes
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'hr') {
            setActiveTab('hr');
        } else if (tabParam === 'incidents') {
            setActiveTab('incidents');
        }
    }, [searchParams]);
    
    const [isAddCylinderOpen, setIsAddCylinderOpen] = useState(false);
    const [isLogMaintenanceOpen, setIsLogMaintenanceOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [newCylinder, setNewCylinder] = useState<Partial<RefrigerantCylinder>>({ type: 'R410A', status: 'Full', totalWeight: 25, remainingWeight: 25 });
    const [maintenanceLog, setMaintenanceLog] = useState<Partial<ToolMaintenanceLog>>({ toolType: 'Recovery Machine', result: 'Pass', nextDueDate: '' });
    const [reportConfig, setReportConfig] = useState({ type: activeTab === 'tools' ? 'Tools' : 'Compliance', range: 'Yearly' });

    const [isCertUploadOpen, setIsCertUploadOpen] = useState(false);
    const [selectedUserForCert, setSelectedUserForCert] = useState<User | null>(null);
    const [certFile, setCertFile] = useState<File | null>(null);
    const [certName, setCertName] = useState('');
    const [certExpiry, setCertExpiry] = useState('');
    const [isUploadingCert, setIsUploadingCert] = useState(false);

    const employees = useMemo(() => {
        const orgUsers = state.users.filter(u => u.organizationId === state.currentOrganization?.id && u.role !== 'customer');
        if (currentUser?.role === 'supervisor') {
            return orgUsers.filter(u => u.reportsTo === currentUser.id || u.id === currentUser.id);
        }
        return orgUsers;
    }, [state.users, state.currentOrganization, currentUser]);

    const cylinders = useMemo(() => {
        const all = state.refrigerantCylinders || [];
        if (currentUser?.role === 'supervisor') {
            const teamIds = employees.map(e => e.id);
            return all.filter(c => !c.assignedTechId || teamIds.includes(c.assignedTechId));
        }
        return all;
    }, [state.refrigerantCylinders, employees, currentUser]);

    const toolLogs = state.toolMaintenanceLogs || []; 
    const requiredCerts = state.currentOrganization?.requiredCertifications || [];
    const policies = state.documents.filter(d => d.type === 'Policy' || d.type === 'Handbook');

    const handleSaveCylinder = async () => {
        if (!state.currentOrganization) return;
        const isEdit = !!newCylinder.id;
        const cylId = newCylinder.id || `cyl-${Date.now()}`;
        const cyl: RefrigerantCylinder = {
            id: cylId,
            organizationId: state.currentOrganization.id,
            tag: newCylinder.tag || `TAG-${Date.now().toString().slice(-4)}`,
            type: newCylinder.type || 'R410A',
            status: isEdit ? (newCylinder.status || 'Full') : 'Full',
            totalWeight: Number(newCylinder.totalWeight),
            remainingWeight: isEdit ? Number(newCylinder.remainingWeight) : Number(newCylinder.totalWeight),
            assignedTechId: newCylinder.assignedTechId,
            createdAt: newCylinder.createdAt || new Date().toISOString()
        };
        if (isEdit) {
            await db.collection('refrigerantCylinders').doc(cyl.id).update(cyl);
            dispatch({ type: 'UPDATE_CYLINDER', payload: cyl });
        } else {
            const trans: RefrigerantTransaction = { id: `trans-${Date.now()}`, organizationId: state.currentOrganization.id, date: new Date().toISOString(), action: 'Purchase', cylinderId: cyl.id, amount: cyl.totalWeight, notes: 'Initial Purchase', createdAt: new Date().toISOString() };
            await Promise.all([db.collection('refrigerantCylinders').doc(cyl.id).set(cyl), db.collection('refrigerantTransactions').doc(trans.id).set(trans)]);
            dispatch({ type: 'ADD_CYLINDER', payload: cyl });
            dispatch({ type: 'ADD_REF_TRANSACTION', payload: trans });
        }
        setIsAddCylinderOpen(false);
    };

    const handleLogMaintenance = async () => {
        if (!state.currentOrganization) return;
        const log: ToolMaintenanceLog = { 
            id: `tool-${Date.now()}`, 
            organizationId: state.currentOrganization.id, 
            date: new Date().toISOString(), 
            toolType: maintenanceLog.toolType || 'Tool', 
            serialNumber: maintenanceLog.serialNumber || 'N/A', 
            action: (maintenanceLog.action || 'Inspection') as any, 
            result: (maintenanceLog.result || 'Pass') as any, 
            nextDueDate: maintenanceLog.nextDueDate || '', 
            notes: maintenanceLog.notes 
        };
        await db.collection('toolMaintenanceLogs').doc(log.id).set(log);
        dispatch({ type: 'ADD_TOOL_LOG', payload: log });
        setIsLogMaintenanceOpen(false);
    };

    const handleUploadCert = async () => {
        if (!selectedUserForCert || !certFile || !certName) return;
        setIsUploadingCert(true);
        try {
            const dataUrl = await compressFile(certFile);
            const newCert = { name: certName, expiryDate: certExpiry, fileUrl: dataUrl };
            const updatedCerts = [...(selectedUserForCert.certifications || []), newCert];
            await db.collection('users').doc(selectedUserForCert.id).update({ certifications: updatedCerts });
            setIsCertUploadOpen(false);
        } catch (e) { alert("Failed to upload."); } finally { setIsUploadingCert(false); }
    };

    const generateReport = () => {
        const win = window.open('', '_blank');
        if (win) { win.document.write(`<h1>Compliance Report</h1><p>${new Date().toLocaleDateString()}</p>`); win.document.close(); }
        setIsReportOpen(false);
    };

    const tabs = [
        { id: 'tools', icon: Wrench, label: 'Tools', hide: false },
        { id: 'certs', icon: Shield, label: 'Certs / EPA', hide: false },
        { id: 'hr', icon: Users, label: 'My Documents', hide: false },
        { id: 'policy_tracking', icon: CheckCircle, label: 'Policy Tracking', hide: !(state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor') },
        { id: 'incidents', icon: Flag, label: 'Hazards & Incidents', hide: false }
    ];

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Compliance & Safety</h2>
                    <p className="text-gray-600 dark:text-gray-400">Industry standards and internal policies.</p>
                </div>
                <Button onClick={() => setIsReportOpen(true)} variant="secondary" className="w-auto flex items-center gap-2">
                    <Printer size={16}/> Generate Report
                </Button>
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
                {tabs.filter(t => !t.hide).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                            activeTab === tab.id ? 'border-primary-600 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="animate-fade-in">
                {activeTab === 'tools' && <ToolsTab {...{ toolLogs, setIsLogMaintenanceOpen }} />}
                {activeTab === 'certs' && <CertsTab {...{ employees, requiredCerts, setSelectedUserForCert, setIsCertUploadOpen }} />}
                {activeTab === 'hr' && <HRHandbookView />}
                {activeTab === 'policy_tracking' && <PolicyTrackingTab {...{ employees, policies }} />}
                {activeTab === 'incidents' && <IncidentsTab incidents={state.incidentReports || []} />}
            </div>

            <Modal isOpen={isAddCylinderOpen} onClose={() => setIsAddCylinderOpen(false)} title="Manage Tank">
                <div className="space-y-4">
                    <Input label="Tag #" value={newCylinder.tag || ''} onChange={e => setNewCylinder({...newCylinder, tag: e.target.value})} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Type" value={newCylinder.type || 'R410A'} onChange={e => setNewCylinder({...newCylinder, type: e.target.value})}>
                            <option value="R410A">R410A</option>
                            <option value="R22">R22</option>
                            <option value="R404A">R404A</option>
                        </Select>
                        <Input label="Total Weight (lbs)" type="number" value={newCylinder.totalWeight || 0} onChange={e => setNewCylinder({...newCylinder, totalWeight: Number(e.target.value)})} />
                    </div>
                    <Button onClick={handleSaveCylinder}>Save Cylinder</Button>
                </div>
            </Modal>

            <Modal isOpen={isLogMaintenanceOpen} onClose={() => setIsLogMaintenanceOpen(false)} title="Log Tool Maint">
                <div className="space-y-4">
                    <Input label="Tool" value={maintenanceLog.toolType || ''} onChange={e => setMaintenanceLog({...maintenanceLog, toolType: e.target.value})} />
                    <Input label="Serial Number" value={maintenanceLog.serialNumber || ''} onChange={e => setMaintenanceLog({...maintenanceLog, serialNumber: e.target.value})} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Action" value={maintenanceLog.action || 'Inspection'} onChange={e => setMaintenanceLog({...maintenanceLog, action: e.target.value as any})}>
                            <option value="Inspection">Inspection</option>
                            <option value="Calibration">Calibration</option>
                            <option value="Repair">Repair</option>
                        </Select>
                        <Select label="Result" value={maintenanceLog.result || 'Pass'} onChange={e => setMaintenanceLog({...maintenanceLog, result: e.target.value as any})}>
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                        </Select>
                    </div>
                    <Input label="Next Due Date" type="date" value={maintenanceLog.nextDueDate || ''} onChange={e => setMaintenanceLog({...maintenanceLog, nextDueDate: e.target.value})} />
                    <Button onClick={handleLogMaintenance}>Save Tool Log</Button>
                </div>
            </Modal>
            
            <Modal isOpen={isCertUploadOpen} onClose={() => setIsCertUploadOpen(false)} title={`Upload Certification: ${selectedUserForCert?.firstName}`}>
                <div className="space-y-4">
                    <Input label="Certification Name" value={certName} onChange={e => setCertName(e.target.value)} placeholder="e.g. EPA Universal" />
                    <Input label="Expiry Date (Optional)" type="date" value={certExpiry} onChange={e => setCertExpiry(e.target.value)} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Image/PDF</label>
                        <input type="file" accept="image/*,.pdf" onChange={e => setCertFile(e.target.files?.[0] || null)} className="text-sm text-gray-500" />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsCertUploadOpen(false)}>Cancel</Button>
                        <Button onClick={handleUploadCert} disabled={isUploadingCert || !certFile || !certName}>{isUploadingCert ? 'Uploading...' : 'Save Certification'}</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} title="Generate Compliance Report">
                <div className="space-y-4">
                    <Select label="Report Type" value={reportConfig.type} onChange={e => setReportConfig({...reportConfig, type: e.target.value})}>
                        <option value="Refrigerant">EPA Refrigerant Inventory</option>
                        <option value="Tools">Tool Maintenance Summary</option>
                    </Select>
                    <Select label="Time Range" value={reportConfig.range} onChange={e => setReportConfig({...reportConfig, range: e.target.value})}>
                        <option value="Yearly">Current Fiscal Year</option>
                        <option value="All">All Records</option>
                    </Select>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsReportOpen(false)}>Cancel</Button>
                        <Button onClick={generateReport}>Preview & Print</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ComplianceDashboard;
