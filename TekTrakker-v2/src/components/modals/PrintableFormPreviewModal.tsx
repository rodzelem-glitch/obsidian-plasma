import React, { useState } from 'react';
import { X, Printer, Download, FileText, Mail, Send, Check, UserCheck } from 'lucide-react';
import type { Job } from '../../types';
import { PrintableTechJobForm } from '../forms/PrintableTechJobForm';
import { generateInteractiveFillablePdf } from '../../utils/fillablePdfBuilder';
import SubcontractorWorkOrderModal from './SubcontractorWorkOrderModal';

interface PrintableFormPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  job?: Job | null;
  organization?: any;
  defaultCopies?: number;
}

export const PrintableFormPreviewModal: React.FC<PrintableFormPreviewModalProps> = ({
  isOpen,
  onClose,
  job = null,
  organization = null,
  defaultCopies = 1
}) => {
  const [copiesCount, setCopiesCount] = useState<number>(1);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [showSubcontractorModal, setShowSubcontractorModal] = useState<boolean>(false);
  const [techEmail, setTechEmail] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const pdfBytes = await generateInteractiveFillablePdf({ job, organization });
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = job ? `Fillable_Tech_Job_${job.workOrderNumber || job.id.slice(0, 8)}.pdf` : `Blank_Fillable_Tech_Form.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Fillable PDF generation error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendEmailToTech = (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    const link = `${window.location.origin}/#/tech-form/${job.id}`;
    const subject = encodeURIComponent(`Work Order #${job.workOrderNumber || job.id.slice(0, 8)} - Interactive Field Inspection Form`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease open your interactive field work order form using the link below:\n\n${link}\n\nYou can fill in gauge readings, notes, parts used, system health, and signatures directly on your phone or tablet, then tap "Submit Form to Office" when done.\n\nThank you,\n${organization?.name || 'TekAir Inc.'}`
    );

    window.open(`mailto:${techEmail}?subject=${subject}&body=${body}`, '_blank');
    setShowEmailModal(false);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 sticky top-0 z-20 flex flex-col gap-3">
          {/* Row 1: Title and dedicated Close button */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="p-2 sm:p-2.5 bg-slate-900 text-white rounded-2xl shadow-md shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base lg:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {job ? `Print Job Sheet: #${job.workOrderNumber || job.id.slice(0, 8)}` : 'Print Stack of Blank Tech Forms'}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                  Full-width fillable &amp; printable 8.5&quot; x 11&quot; letter format • <span className="text-indigo-600 dark:text-indigo-400 font-bold">Click any box to type details</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer border border-slate-200/80 dark:border-slate-700"
              aria-label="Close"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Row 2: Actions toolbar with flex-wrap */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
            {!job && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold">
                <span className="text-slate-500">Copies:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={copiesCount}
                  onChange={(e) => setCopiesCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 text-center bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-black rounded-lg py-0.5"
                />
              </div>
            )}

            {job && (
              <>
                <button
                  onClick={() => setShowSubcontractorModal(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" /> <span>Send to Subcontractor</span>
                </button>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
                >
                  <Mail className="w-4 h-4" /> <span>Email Form to Tech</span>
                </button>
              </>
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> <span>{isDownloading ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" /> <span>Print Form</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY PREVIEW */}
        <div className="p-6 overflow-y-auto bg-slate-100 dark:bg-slate-950 flex-1 flex justify-center">
          <div id="printable-form-container" className="w-full">
            <PrintableTechJobForm 
              job={job} 
              organization={organization} 
              copiesCount={copiesCount}
              interactive={true} 
            />
          </div>
        </div>

      </div>

      {/* DIRECT EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-600 text-white rounded-2xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Email Form to Technician</h3>
                  <p className="text-xs text-slate-500">Send direct interactive fillable link</p>
                </div>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmailToTech} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Technician Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="tech@company.com"
                  value={techEmail}
                  onChange={(e) => setTechEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!job) return;
                    const link = `${window.location.origin}/#/tech-form/${job.id}`;
                    navigator.clipboard.writeText(link);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : null}
                  {copiedLink ? 'Link Copied!' : 'Copy Form Link Instead'}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-lg flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Send Email
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBCONTRACTOR WORK ORDER MODAL */}
      <SubcontractorWorkOrderModal
        isOpen={showSubcontractorModal}
        onClose={() => setShowSubcontractorModal(false)}
        job={job || null}
      />
    </div>
  );
};
