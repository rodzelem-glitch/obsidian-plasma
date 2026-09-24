import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { useLanguage } from '../../../../context/LanguageContext';
import { 
  FileText, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Cpu, 
  DollarSign,
  Send,
  Layers,
  Sparkles
} from 'lucide-react';
import showToast from '../../../../lib/toast';

interface JobProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  unitStates: any[];
  onOpenProposalGenerator: (forceNew?: boolean) => void;
  onAddProposalLineItem?: (item: any) => void;
}

export const JobProposalsModal: React.FC<JobProposalsModalProps> = ({
  isOpen,
  onClose,
  job,
  unitStates,
  onOpenProposalGenerator,
  onAddProposalLineItem,
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<'Good' | 'Better' | 'Best'>('Good');

  // Collect all unit line items
  const allUnitItems: Array<{ assetId: string; item: any }> = [];
  unitStates.forEach((us) => {
    if (us.unitLineItems && us.unitLineItems.length > 0) {
      us.unitLineItems.forEach((item: any) => {
        allUnitItems.push({ assetId: us.assetId, item });
      });
    }
  });

  const totalAggregatedCost = allUnitItems.reduce(
    (acc, curr) => acc + (curr.item.total || curr.item.amount || 0),
    0
  );

  const handleLaunchEstimator = (forceNew: boolean = false) => {
    onClose();
    if (onOpenProposalGenerator) {
      onOpenProposalGenerator(forceNew);
      return;
    }
    if (job?.id) {
      const existingProposalId = job.proposalId || (job.linkedProposalIds && job.linkedProposalIds.length > 0 ? job.linkedProposalIds[0] : null);
      if (!forceNew && existingProposalId) {
        navigate(`/briefing/proposal?jobId=${job.id}&source=workflow&proposalId=${existingProposalId}`);
      } else {
        navigate(`/briefing/proposal?jobId=${job.id}&source=workflow${forceNew ? '&new=true' : ''}`);
      }
    }
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;
    const price = parseFloat(newItemPrice);
    if (isNaN(price)) return;

    if (onAddProposalLineItem) {
      onAddProposalLineItem({
        id: `pi-custom-${Date.now()}`,
        name: newItemName,
        price,
        tier: newItemCategory,
        createdAt: new Date().toISOString(),
      });
      showToast.success(t("Added item to proposal draft!"));
    }
    setNewItemName('');
    setNewItemPrice('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <FileText className="text-purple-600 shrink-0" size={24} />
          <div>
            <h2 className="font-extrabold text-base md:text-lg">{t("Field Proposal & Estimator")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {t("Auto-aggregated repairs from site equipment units & multi-option proposals.")}
            </p>
          </div>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6 pb-4">
        
        {/* Header Action Strip */}
        <div className="p-4 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 tracking-wider block">
              {t("Aggregated Unit Items")}
            </span>
            <div className="text-xl font-black text-purple-900 dark:text-purple-100 flex items-center gap-1">
              <span>${totalAggregatedCost.toFixed(2)}</span>
              <span className="text-xs font-normal text-purple-600 dark:text-purple-300">
                ({allUnitItems.length} {t("items from site equipment")})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => handleLaunchEstimator(false)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-10 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles size={16} />
              {t("Open Proposal Builder")}
            </Button>
            <Button
              type="button"
              onClick={() => handleLaunchEstimator(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={16} />
              {t("Create New Proposal")}
            </Button>
          </div>
        </div>

        {/* Section 1: Aggregated Repair Line Items from Units */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Cpu size={14} />
            {t("Equipment Unit Repair Items")} ({allUnitItems.length})
          </h3>

          {allUnitItems.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              {allUnitItems.map((entry, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {entry.item.name || entry.item.description || `Repair Item ${idx + 1}`}
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {t("Unit ID:")} {entry.assetId}
                    </p>
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                    ${(entry.item.total || entry.item.amount || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-slate-400 text-xs italic">
              {t("No unit repair items logged yet. Open any equipment unit on the dashboard to add repair recommendations.")}
            </div>
          )}
        </div>

        {/* Section 2: Quick Add Custom Proposal Item */}
        <form onSubmit={handleAddCustomItem} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Plus size={14} className="text-purple-600" />
            {t("Add Additional Proposal Line Item")}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder={t("Item Description (e.g. Capacitor Replacement)")}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 col-span-1 sm:col-span-2"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder={t("Price ($)")}
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
              <Button type="submit" className="bg-purple-600 text-white font-bold text-xs px-4 rounded-xl shrink-0">
                {t("Add")}
              </Button>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800 gap-2">
          <Button type="button" variant="primary" onClick={onClose} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs px-5 py-2.5 rounded-xl">
            {t("Close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default JobProposalsModal;
