
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { useSearchParams } from 'react-router-dom';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import { uploadFileToStorage } from 'lib/storageService';
import type { RefrigerantCylinder, RefrigerantTransaction, ToolMaintenanceLog, BusinessDocument, User } from 'types';
import { CheckCircle, AlertTriangle, Wrench, Shield, Users, Printer, Flag, Trash2 } from 'lucide-react';
import { globalConfirm } from 'lib/globalConfirm';
import showToast from 'lib/toast';

import ToolsTab from './compliance/components/ToolsTab';
import CertsTab from './compliance/components/CertsTab';
import PolicyTrackingTab from './compliance/components/PolicyTrackingTab';
import HRHandbookView from './compliance/components/HRHandbookView';
import IncidentsTab from './compliance/components/IncidentsTab';
import AiAuditTab from './compliance/components/AiAuditTab';
import { Bot } from 'lucide-react';

const ComplianceDashboard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [searchParams] = useSearchParams();
    const industry = state.currentOrganization?.industry || 'HVAC';
    const { currentUser } = state;
    
    // UI State for Modal expansion
    const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
    const [isRequirementsModalOpen, setIsRequirementsModalOpen] = useState(false);
    const [isIncidentsModalOpen, setIsIncidentsModalOpen] = useState(false);
    const [isAiAuditModalOpen, setIsAiAuditModalOpen] = useState(false);

    // Initial check for URL deep links
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'requirements') setIsRequirementsModalOpen(true);
        if (tabParam === 'incidents') setIsIncidentsModalOpen(true);
    }, [searchParams]);
    
    const [isAddCylinderOpen, setIsAddCylinderOpen] = useState(false);
    const [isLogMaintenanceOpen, setIsLogMaintenanceOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [newCylinder, setNewCylinder] = useState<Partial<RefrigerantCylinder>>({ type: 'R410A', status: 'Full', totalWeight: 25, remainingWeight: 25 });
    const [maintenanceLog, setMaintenanceLog] = useState<Partial<ToolMaintenanceLog>>({ toolType: 'Recovery Machine', result: 'Pass', nextDueDate: '' });
    const [reportConfig, setReportConfig] = useState({ type: 'Compliance', range: 'Yearly' });

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
            assignedTechId: newCylinder.assignedTechId || null,
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

    const handleDeleteCylinder = async (id: string) => {
        if (!await globalConfirm("Permanently remove this cylinder from inventory?")) return;
        try {
            await db.collection('refrigerantCylinders').doc(id).delete();
            dispatch({ type: 'DELETE_CYLINDER', payload: id });
        } catch (e) { showToast.error("Delete failed."); }
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
            notes: maintenanceLog.notes || '' 
        };
        await db.collection('toolMaintenanceLogs').doc(log.id).set(log);
        dispatch({ type: 'ADD_TOOL_LOG', payload: log });
        setIsLogMaintenanceOpen(false);
    };

    const handleUploadCert = async () => {
        if (!selectedUserForCert || !certFile || !certName || !state.currentOrganization) return;
        setIsUploadingCert(true);
        try {
            const orgId = state.currentOrganization.id;
            const safeName = certFile.name ? certFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'cert.pdf';
            const path = `organizations/${orgId}/users/${selectedUserForCert.id}/certifications/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, certFile);
            
            const newCert = { name: certName, expiryDate: certExpiry, fileUrl: downloadUrl };
            const updatedCerts = [...(selectedUserForCert.certifications || []), newCert];
            await db.collection('users').doc(selectedUserForCert.id).update({ certifications: updatedCerts });
            setIsCertUploadOpen(false);
        } catch (e) { showToast.error("Failed to upload certification."); } finally { setIsUploadingCert(false); }
    };

    const generateReport = () => {
        const win = window.open('', '_blank');
        if (win) { win.document.write(`<h1>Compliance Report</h1><p>${new Date().toLocaleDateString()}</p>`); win.document.close(); }
        setIsReportOpen(false);
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            <header className="flex justify-between items-center">
                
                <Button onClick={() => setIsReportOpen(true)} variant="secondary" className="w-auto flex items-center gap-2">
                    <Printer size={16}/> Generate Report
                </Button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Tools & Maintenance Card */}
                <div 
                    onClick={() => setIsToolsModalOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                            <Wrench size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tools & Maintenance</h3>
                    </div>
                    {toolLogs.length === 0 ? (
                        <p className="text-sm text-gray-500 italic mt-auto">No tools logged.</p>
                    ) : (
                        <div className="space-y-2 flex-1">
                            {toolLogs.slice(0, 3).map(log => (
                                <div key={log.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{log.toolType}</span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${log.result === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{log.result}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3">
                        View All {toolLogs.length} Tools
                    </button>
                </div>

                {/* Requirements Card */}
                {(state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor') && (
                    <div 
                        onClick={() => setIsRequirementsModalOpen(true)}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                <CheckCircle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Requirements</h3>
                        </div>
                        <div className="space-y-3 flex-1">
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-purple-500">
                                <p className="text-xs font-bold text-gray-500 uppercase">Policy Tracking</p>
                                <p className="text-sm text-gray-800 dark:text-gray-200">{policies.length} Active Policies</p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-indigo-500">
                                <p className="text-xs font-bold text-gray-500 uppercase">Certifications</p>
                                <p className="text-sm text-gray-800 dark:text-gray-200">{employees.length} Tracked Employees</p>
                            </div>
                        </div>
                        <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3">
                            Manage Trackers
                        </button>
                    </div>
                )}

                {/* Incidents Card */}
                <div 
                    onClick={() => setIsIncidentsModalOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                            <Flag size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hazards & Incidents</h3>
                    </div>
                    {(!state.incidentReports || state.incidentReports.length === 0) ? (
                        <p className="text-sm text-gray-500 italic mt-auto">No incidents reported.</p>
                    ) : (
                        <div className="space-y-2 flex-1">
                            {state.incidentReports.slice(0, 3).map(incident => (
                                <div key={incident.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate">{incident.type || 'Hazard'}</span>
                                    <span className="text-xs text-gray-500">{new Date(incident.date).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3">
                        View All {state.incidentReports?.length || 0} Reports
                    </button>
                </div>

                {/* AI Audit Log Card */}
                {(state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both') && (
                    <div 
                        onClick={() => setIsAiAuditModalOpen(true)}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg">
                                <Bot size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Operations</h3>
                        </div>
                        <div className="space-y-2 flex-1">
                            <p className="text-sm text-gray-500">Track and audit actions completed by the Virtual AI Worker.</p>
                        </div>
                        <button className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3">
                            View Audit Ledger
                        </button>
                    </div>
                )}
            </div>

            {/* Expansive Modals */}
            <Modal isOpen={isToolsModalOpen} onClose={() => setIsToolsModalOpen(false)} title="Tools & Maintenance" size="full">
                <ToolsTab {...{ toolLogs, setIsLogMaintenanceOpen }} />
            </Modal>

            <Modal isOpen={isRequirementsModalOpen} onClose={() => setIsRequirementsModalOpen(false)} title="Requirement Tracking" size="full">
                <div className="space-y-12 pb-12">
                    <div>
                        <CertsTab {...{ employees, requiredCerts, setSelectedUserForCert, setIsCertUploadOpen }} />
                    </div>
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                        <PolicyTrackingTab {...{ employees, policies }} />
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isIncidentsModalOpen} onClose={() => setIsIncidentsModalOpen(false)} title="Hazards & Incidents" size="full">
                <IncidentsTab incidents={state.incidentReports || []} />
            </Modal>

            <Modal isOpen={isAiAuditModalOpen} onClose={() => setIsAiAuditModalOpen(false)} title="AI Operations Ledger" size="full">
                <AiAuditTab />
            </Modal>

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
                        <input type="file" title="Upload certification document" accept="image/*,.pdf" onChange={e => setCertFile(e.target.files?.[0] || null)} className="text-sm text-gray-500" />
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
