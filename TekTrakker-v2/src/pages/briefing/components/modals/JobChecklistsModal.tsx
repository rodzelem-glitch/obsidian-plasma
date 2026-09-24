import React, { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { useLanguage } from '../../../../context/LanguageContext';
import { useAppContext } from '../../../../context/AppContext';
import { StoredFile } from '../../../../types';
import showToast from '../../../../lib/toast';
import { db } from '../../../../lib/firebase';
import { cleanUndefinedFields } from '../../../../lib/utils';
import { 
  ClipboardCheck, 
  ShieldCheck, 
  AlertTriangle, 
  PenTool, 
  CheckCircle2, 
  FileText,
  Trash2,
  Plus,
  Download,
  FileCheck
} from 'lucide-react';
import SignatureCanvasModule from 'react-signature-canvas';
const SignatureCanvas = (SignatureCanvasModule as any).default || SignatureCanvasModule;

interface JobChecklistsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  workflowState: any;
  onUpdateWorkflowState: (field: string, value: any) => void;
}

export const JobChecklistsModal: React.FC<JobChecklistsModalProps> = ({
  isOpen,
  onClose,
  job,
  workflowState,
  onUpdateWorkflowState,
}) => {
  const { t } = useLanguage();
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState<'safety' | 'intake' | 'custom_checklists' | 'waiver'>('safety');
  const [sigCanvasRef, setSigCanvasRef] = useState<any>(null);
  
  // Selected Document Center Waiver ID
  const [selectedWaiverId, setSelectedWaiverId] = useState<string>('default');
  
  // Selected Document Center Checklist Template ID for importing
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // 1. Fetch all available Document Center Checklists from state
  const availableChecklistTemplates = useMemo(() => {
    const templates = (state.inspectionTemplates || []).filter((t: any) => !t.isHiringPacket);
    // Also include any embedded job templates
    if (job?.embeddedData?.inspectionTemplates) {
      job.embeddedData.inspectionTemplates.forEach((embTpl: any) => {
        if (!templates.some((t: any) => t.id === embTpl.id)) {
          templates.push(embTpl);
        }
      });
    }
    return templates;
  }, [state.inspectionTemplates, job]);

  // 2. Fetch all available Document Center Waivers from state.documents
  const availableDocCenterWaivers = useMemo(() => {
    const defaultWaiver = {
      id: 'default',
      title: t("Pre-Diagnostic & Inspection Liability Authorization"),
      content: t("I authorize technicians to inspect, test, and perform non-destructive diagnostic evaluations on the HVAC system at the site location specified. I acknowledge pre-existing wear, electrical faults, or refrigerant leaks may be discovered during inspection.")
    };

    const docWaivers = (state.documents || []).filter((d: any) => 
      d.type === 'Waiver' || 
      d.type === 'Agreement' || 
      d.type === 'Template' || 
      d.type === 'Policy' || 
      d.category === 'Waiver' || 
      d.title?.toLowerCase().includes('waiver') || 
      d.title?.toLowerCase().includes('liability') || 
      d.title?.toLowerCase().includes('authorization') || 
      d.title?.toLowerCase().includes('agreement')
    ).map((d: any) => ({
      id: d.id,
      title: d.title,
      content: d.content || d.body || d.description || t("Custom Document Center Waiver / Agreement")
    }));

    return [defaultWaiver, ...docWaivers];
  }, [state.documents, t]);

  const activeWaiverObj = useMemo(() => {
    return availableDocCenterWaivers.find(w => w.id === selectedWaiverId) || availableDocCenterWaivers[0];
  }, [availableDocCenterWaivers, selectedWaiverId]);

  // Default Safety & Intake Items
  const safetyItems = [
    { id: 'ppe', label: t("PPE Required (Safety Glasses, Gloves, Boots) Verified") },
    { id: 'power', label: t("Electrical Disconnect & Lockout/Tagout Verified") },
    { id: 'gas', label: t("Gas Shutoff Valve Located & Inspected") },
    { id: 'ladder', label: t("Ladder & Roof Access Inspected & Secured") },
    { id: 'ventilation', label: t("Confined Space & Attic Ventilation Verified") },
  ];

  const intakeItems = [
    { id: 'pre_damage', label: t("Pre-existing Property Damage Documented & Photographed") },
    { id: 'thermostat', label: t("Initial Thermostat Settings & Errors Logged") },
    { id: 'filter_check', label: t("Air Filters Inspected & Static Pressure Noted") },
    { id: 'customer_concern', label: t("Customer Chief Complaint Confirmed with Occupant") },
  ];

  const safetyState = workflowState?.safetyIntake || {};
  const intakeState = workflowState?.arrivalIntake || {};
  const customChecklistState = workflowState?.customChecklists || {};

  const toggleSafetyItem = (id: string) => {
    const updated = { ...safetyState, [id]: !safetyState[id] };
    onUpdateWorkflowState('safetyIntake', updated);
  };

  const toggleIntakeItem = (id: string) => {
    const updated = { ...intakeState, [id]: !intakeState[id] };
    onUpdateWorkflowState('arrivalIntake', updated);
  };

  const handleImportChecklist = (templateId: string) => {
    if (!templateId) return;
    const tpl = availableChecklistTemplates.find((t: any) => t.id === templateId);
    if (!tpl) return;

    const existingChecklists = { ...(workflowState?.importedChecklists || {}) };
    existingChecklists[tpl.id] = tpl;
    onUpdateWorkflowState('importedChecklists', existingChecklists);
    setSelectedTemplateId(templateId);
    setActiveTab('custom_checklists');
    showToast.success(`Imported checklist "${tpl.name || 'Template'}" from Document Center!`);
  };

  const toggleCustomChecklistItem = (templateId: string, itemId: string) => {
    const currentForTpl = customChecklistState[templateId] || {};
    const updatedForTpl = { ...currentForTpl, [itemId]: !currentForTpl[itemId] };
    const updatedAll = { ...customChecklistState, [templateId]: updatedForTpl };
    onUpdateWorkflowState('customChecklists', updatedAll);
  };

  const handleSaveSignature = async () => {
    if (sigCanvasRef && !sigCanvasRef.isEmpty()) {
      const sigData = sigCanvasRef.getTrimmedCanvas().toDataURL('image/png');
      const nowIso = new Date().toISOString();
      onUpdateWorkflowState('preWorkWaiverSignature', sigData);
      onUpdateWorkflowState('preWorkWaiverSignedAt', nowIso);
      onUpdateWorkflowState('preWorkWaiverTitle', activeWaiverObj.title);

      if (job?.id) {
        try {
          const docId = `waiver-${job.id}-${Date.now()}`;
          await db.collection('documents').doc(docId).set(cleanUndefinedFields({
            id: docId,
            title: activeWaiverObj.title,
            jobId: job.id,
            customerId: job.customerId || null,
            customerName: job.customerName || 'Customer',
            type: 'Waiver',
            status: 'Signed',
            signature: sigData,
            signedAt: nowIso,
            createdAt: nowIso,
            content: activeWaiverObj.content,
            organizationId: state.currentOrganization?.id || null
          })).catch((err: any) => console.warn("Notice: Document write error:", err));

          const sigFile: StoredFile = {
            id: `sig-waiver-${Date.now()}`,
            organizationId: job.organizationId || state.currentOrganization?.id || '',
            parentId: job.id,
            parentType: 'job',
            fileName: 'Customer_Waiver_Signature.png',
            fileType: 'image/png',
            dataUrl: sigData,
            url: sigData,
            createdAt: nowIso,
            uploadedBy: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Technician',
            label: 'Pre-Work Waiver Signature',
            metadata: {
              category: 'signature',
              phase: 'waiver',
              signerName: job.customerName || 'Customer',
              timestamp: nowIso
            }
          };

          const existingFiles: StoredFile[] = Array.isArray(job.files) ? job.files : [];
          const updatedFiles = [...existingFiles.filter(f => f.fileName !== 'Customer_Waiver_Signature.png'), sigFile];
          const jobUpdates = {
            preWorkWaiverSignature: sigData,
            preWorkWaiverSignedAt: nowIso,
            preWorkWaiverTitle: activeWaiverObj.title,
            files: updatedFiles,
            updatedAt: nowIso
          };

          await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(jobUpdates));
          dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...jobUpdates } });
        } catch (e) {
          console.warn("Waiver Firestore sync notice:", e);
        }
      }

      showToast.success(t("Pre-work waiver signed and saved successfully!"));
    }
  };

  const handleClearSignature = () => {
    if (sigCanvasRef) {
      sigCanvasRef.clear();
      onUpdateWorkflowState('preWorkWaiverSignature', null);
      onUpdateWorkflowState('preWorkWaiverSignedAt', null);
      onUpdateWorkflowState('preWorkWaiverTitle', null);
    }
  };

  const activeImportedChecklists = Object.values(workflowState?.importedChecklists || {}) as any[];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <ClipboardCheck className="text-blue-600 shrink-0" size={24} />
          <div>
            <h2 className="font-extrabold text-base md:text-lg">{t("Site Checklists & Waivers")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {t("Safety protocols, Document Center checklists, and customer liability waivers.")}
            </p>
          </div>
        </div>
      }
      size="lg"
    >
      <div className="space-y-5 pb-4">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('safety')}
            className={`px-3 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'safety'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={16} />
            <span>{t("Safety Assessment")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('intake')}
            className={`px-3 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'intake'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={16} />
            <span>{t("Site Arrival Intake")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom_checklists')}
            className={`px-3 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'custom_checklists'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ClipboardCheck size={16} />
            <span>{t("Document Center Checklists")} ({activeImportedChecklists.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('waiver')}
            className={`px-3 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'waiver'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <PenTool size={16} />
            <span>{t("Pre-Work Waiver")}</span>
            {workflowState?.preWorkWaiverSignature && (
              <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                ✓
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Safety Assessment */}
        {activeTab === 'safety' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
              <span>{t("Verify all OSHA safety requirements before beginning diagnostic or repair procedures.")}</span>
            </div>

            <div className="space-y-2">
              {safetyItems.map((item) => {
                const isChecked = !!safetyState[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSafetyItem(item.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      isChecked
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}>
                      {isChecked && <CheckCircle2 size={14} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Site Arrival Intake */}
        {activeTab === 'intake' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {intakeItems.map((item) => {
                const isChecked = !!intakeState[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleIntakeItem(item.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      isChecked
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}>
                      {isChecked && <CheckCircle2 size={14} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Document Center Checklists */}
        {activeTab === 'custom_checklists' && (
          <div className="space-y-5">
            {/* Import Bar */}
            <div className="p-4 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Download size={16} />
                  {t("Import Document Center Checklist")}
                </span>
                <span className="text-[10px] bg-purple-200 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full">
                  {availableChecklistTemplates.length} {t("Templates Available")}
                </span>
              </div>
              
              <div className="flex gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">{t("-- Select a Checklist from Document Center --")}</option>
                  {availableChecklistTemplates.map((tpl: any) => (
                    <option key={tpl.id} value={tpl.id}>
                      📋 {tpl.name || tpl.title || 'Checklist Template'} ({tpl.items?.length || 0} {t("items")})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={() => handleImportChecklist(selectedTemplateId)}
                  disabled={!selectedTemplateId}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 rounded-xl flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  {t("Import")}
                </Button>
              </div>
            </div>

            {/* Imported Checklists List */}
            {activeImportedChecklists.length > 0 ? (
              <div className="space-y-6">
                {activeImportedChecklists.map((tpl: any) => {
                  const tplAnswers = customChecklistState[tpl.id] || {};
                  const items = tpl.items || [];
                  const completedCount = items.filter((i: any) => !!tplAnswers[i.id]).length;

                  return (
                    <div key={tpl.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck size={18} className="text-purple-600" />
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {tpl.name || tpl.title || 'Custom Checklist'}
                          </h4>
                        </div>
                        <span className="text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                          {completedCount} / {items.length} {t("Completed")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {items.map((item: any) => {
                          const isChecked = !!tplAnswers[item.id];
                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleCustomChecklistItem(tpl.id, item.id)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isChecked
                                  ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
                                  : 'bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                  {item.label || item.name || 'Checklist Item'}
                                </span>
                                {item.description && (
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {item.description}
                                  </span>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                                isChecked
                                  ? 'bg-purple-600 border-purple-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                              }`}>
                                {isChecked && <CheckCircle2 size={14} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                <FileCheck size={32} className="mx-auto text-slate-400 mb-2" />
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  {t("No Document Center Checklists Imported Yet")}
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  {t("Select any custom inspection template or quality checklist built in Document Center above to import it for this job.")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Pre-Work Waiver & Signature */}
        {activeTab === 'waiver' && (
          <div className="space-y-4">
            {/* Document Center Waiver Selector */}
            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                {t("📥 Select Waiver / Agreement Template from Document Center")}
              </label>
              <select
                value={selectedWaiverId}
                onChange={(e) => setSelectedWaiverId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold p-2.5 focus:ring-2 focus:ring-blue-500"
              >
                {availableDocCenterWaivers.map((w) => (
                  <option key={w.id} value={w.id}>
                    📄 {w.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Waiver Body Preview */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 max-h-52 overflow-y-auto">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                {activeWaiverObj.title}
              </h4>
              <div 
                className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeWaiverObj.content || '') }}
              />
            </div>

            {workflowState?.preWorkWaiverSignature ? (
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 size={16} />
                    {t("Waiver Signed:")} {workflowState.preWorkWaiverTitle || activeWaiverObj.title}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSignature}
                    className="text-xs text-rose-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Trash2 size={14} />
                    {t("Clear & Resign")}
                  </button>
                </div>
                <img
                  src={workflowState.preWorkWaiverSignature}
                  alt="Customer Signature"
                  className="max-h-24 mx-auto border border-emerald-300 rounded bg-white p-1"
                />
                {workflowState.preWorkWaiverSignedAt && (
                  <p className="text-[10px] text-slate-400 text-center font-mono">
                    {t("Signed at:")} {new Date(workflowState.preWorkWaiverSignedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("Customer Digital Signature")}
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 overflow-hidden">
                  <SignatureCanvas
                    ref={(ref: any) => setSigCanvasRef(ref)}
                    canvasProps={{
                      className: 'w-full h-36 cursor-crosshair',
                    }}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => sigCanvasRef?.clear()}
                    className="text-xs py-1.5 px-3"
                  >
                    {t("Clear")}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveSignature}
                    className="bg-blue-600 text-white font-bold text-xs py-1.5 px-4 rounded-xl"
                  >
                    {t("Save Signature")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800 gap-2">
          <Button type="button" variant="primary" onClick={onClose} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs px-5 py-2.5 rounded-xl">
            {t("Done")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default JobChecklistsModal;
