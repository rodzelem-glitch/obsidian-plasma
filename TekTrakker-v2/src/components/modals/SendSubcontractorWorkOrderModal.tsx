import { db } from '../../lib/firebase';
import { cleanUndefinedFields, formatAddress } from '../../lib/utils';
import React, { useState, useEffect } from 'react';
import { X, Mail, MessageSquare, Copy, Check, Send, ExternalLink, ShieldCheck, FileText, UserCheck, Loader2, Building2, Plus, ArrowLeft, DollarSign } from 'lucide-react';
import { getFirestore, collection, addDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import type { Job, Subcontractor } from '../../types';
import { useAppContext } from '../../context/AppContext';
import showToast from '../../lib/toast';
import { generateUserEmailSignatureHtml } from '../../lib/signatureHelper';
import { sendEmail } from '../../lib/notificationService';
import { patchJsPdfInstance } from '../../lib/pdfHelper';

interface SendSubcontractorWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  organization?: any;
}

export const SendSubcontractorWorkOrderModal: React.FC<SendSubcontractorWorkOrderModalProps> = ({
  isOpen,
  onClose,
  job,
  organization
}) => {
  const { state, dispatch } = useAppContext();
  const [subSelectionMode, setSubSelectionMode] = useState<'choose' | 'existing' | 'new'>('choose');
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [subcontractorName, setSubcontractorName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [nteLimit, setNteLimit] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedDocLink, setCopiedDocLink] = useState<boolean>(false);
  const [copiedJobUploadLink, setCopiedJobUploadLink] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [isSendingDirect, setIsSendingDirect] = useState<boolean>(false);

  useEffect(() => {
    if (job) {
      const subWO = (job as any)?.subcontractorWorkOrder;
      const initialNte = subWO?.nte || (job as any)?.partnerPayoutAmount || (job as any)?.subcontractorPayRate || (job as any)?.subcontractorNte || '549';
      setNteLimit(String(initialNte));

      const initialSubName = (job as any)?.subcontractorWorkOrder?.contactName || (job as any)?.subcontractorName || (job as any)?.assignedPartnerName || 'Subcontractor';
      setSubcontractorName(initialSubName);
      setContactPerson((job as any)?.subcontractorContact || initialSubName || 'Technician');
      setRecipientEmail((job as any)?.subcontractorEmail || 'Operations@tekairinc.com');
      setRecipientPhone((job as any)?.subcontractorPhone || '(210) 318-4197');
    }
  }, [job]);

  if (!isOpen || !job) return null;

  const orgName = organization?.name || state.currentOrganization?.name || 'TekAir Inc.';
  const workOrderNo = job.workOrderNumber || job.poNumber || job.id.slice(0, 8);
  const publicLink = `${window.location.origin}/#/tech-form/${job.id}`;

  const subcontractorsList: Subcontractor[] = state.subcontractors || [];

  const handleSelectSubcontractor = (subId: string) => {
    setSelectedSubId(subId);
    if (!subId) return;
    const sub = subcontractorsList.find(s => s.id === subId);
    if (sub) {
      setSubcontractorName(sub.companyName || sub.contactName || 'Subcontractor');
      setContactPerson(sub.contactName || '');
      if (sub.email) setRecipientEmail(sub.email);
      if (sub.phone) setRecipientPhone(sub.phone);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    showToast.success("Subcontractor Work Order Link Copied to Clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  const siteLocationName = (job as any)?.siteLocationName || (job as any)?.siteName || (typeof job?.address === 'object' && (job?.address as any)?.name) || '';
  const subWorkOrder = (job as any)?.subcontractorWorkOrder;
  const subNte = subWorkOrder?.nte || (job as any)?.partnerPayoutAmount || (job as any)?.subcontractorPayRate || (job as any)?.subcontractorNte;
  const nteAmountDisplay = subNte ? `$${subNte}.00` : 'Not Specified';
  const reportedIssue = subWorkOrder?.reportedIssue || job?.notes?.preRepair || job?.notes?.diagnosis || (job as any)?.description || job?.visitType || '';
  const ivrPhone = subWorkOrder?.ivrNumber || '';
  const specialInstructions = subWorkOrder?.specialInstructions || (job as any)?.specialInstructions || '';

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Work Order #${workOrderNo} - Field Inspection & Completion Link`);
    const bodyText = `Hello,

Here is your official Subcontractor Work Order #${workOrderNo} from ${orgName}.

SERVICE LOCATION:
${siteLocationName ? `${siteLocationName}\n` : ''}${typeof job.address === 'string' ? job.address : (job.address ? `${job.address.street || ''}, ${job.address.city || ''}` : 'Service Site')}

APPROVED SUBCONTRACTOR NTE:
${nteAmountDisplay}

${reportedIssue ? `REPORTED ISSUE / WORK SCOPE:\n${reportedIssue}\n\n` : ''}${ivrPhone ? `IVR CHECK-IN PHONE:\n${ivrPhone}\n\n` : ''}${specialInstructions ? `SPECIAL INSTRUCTIONS:\n${specialInstructions}\n\n` : ''}INTERACTIVE WORK ORDER FORM LINK:
${publicLink}

${note ? `SPECIAL DISPATCHER INSTRUCTIONS:\n${note}\n\n` : ''}You do NOT need a TekTrakker account or app to fill this out. Tap the link above on your phone or computer to enter equipment readings, repair notes, parts used, photos, and digital signatures, then tap "Submit Form to Office" when done.

Thank you,
${orgName}`;

    window.open(`mailto:${recipientEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`, '_blank');
    showToast.success(`Opened email draft for ${recipientEmail || 'Subcontractor'}`);
    onClose();
  };

  const handleSendDirectEmail = async () => {
    if (!recipientEmail) {
      showToast.error("Please enter a recipient email address");
      return;
    }
    setIsSendingDirect(true);

    try {
      const db = getFirestore();
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const doc = patchJsPdfInstance(new jsPDF({ unit: 'pt', format: 'letter' }));
      const pageWidth = doc.internal.pageSize.getWidth();

      // PAGE 1: WORK ORDER SHEET
      const logoUrl = organization?.logoUrl || state.currentOrganization?.logoUrl || 'https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9';
      
      try {
        if (logoUrl) {
          doc.addImage(logoUrl, 'PNG', 40, 30, 110, 32);
        }
      } catch (e) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(2, 132, 199);
        doc.text(orgName, 40, 50);
      }

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(organization?.address ? (typeof organization.address === 'string' ? organization.address : formatAddress(organization.address)) : '', 40, 74);
      doc.text(`Phone: ${organization?.phone || ''}`, 40, 87);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text('WORK ORDER', pageWidth - 40, 48, { align: 'right' });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(`Work Order #: ${job.poNumber || workOrderNo}`, pageWidth - 40, 64, { align: 'right' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Issue Date: ${new Date().toLocaleDateString()}`, pageWidth - 40, 77, { align: 'right' });
      const schedDateStr = job.appointmentTime ? new Date(job.appointmentTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : new Date().toLocaleDateString();
      doc.text(`Schedule Date: ${schedDateStr}`, pageWidth - 40, 90, { align: 'right' });

      // Divider line
      doc.setLineWidth(1.5);
      doc.setDrawColor(15, 23, 42);
      doc.line(40, 102, pageWidth - 40, 102);

      // Cards row 1: Service Location & Contractor (Y: 115 to 200)
      doc.setLineWidth(0.75);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(40, 115, 258, 85, 6, 6);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(2, 132, 199);
      doc.text('SERVICE LOCATION', 52, 132);
      doc.setLineWidth(0.5);
      doc.setDrawColor(226, 232, 240);
      doc.line(52, 138, 286, 138);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(siteLocationName || 'Service Location', 52, 154);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(doc.splitTextToSize(typeof job.address === 'string' ? job.address : (job.address ? `${job.address.street || ''}, ${job.address.city || ''}` : '1860 S Seguin Ave. Building E'), 234), 52, 169);

      doc.setLineWidth(0.75);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(314, 115, 258, 85, 6, 6);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(2, 132, 199);
      doc.text('TECHNICIAN / CONTRACTOR', 326, 132);
      doc.setLineWidth(0.5);
      doc.setDrawColor(226, 232, 240);
      doc.line(326, 138, 560, 138);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(subcontractorName || 'Subcontractor', 326, 154);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Phone: ${organization?.phone || '2103184197'}`, 326, 169);
      doc.text(`Email: ${recipientEmail || 'Operations@tekairinc.com'}`, 326, 183);

      // Cards row 2: NTE & IVR Instructions (Y: 215 to 310)
      doc.setLineWidth(1);
      doc.setDrawColor(239, 68, 68);
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(40, 215, 220, 95, 6, 6, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(153, 27, 27);
      doc.text('NOT-TO-EXCEED (N.T.E.) AMOUNT', 150, 233, { align: 'center' });
      doc.setFontSize(28);
      doc.setTextColor(185, 28, 28);
      doc.text(nteAmountDisplay, 150, 267, { align: 'center' });
      doc.setFontSize(7.5);
      doc.setTextColor(127, 29, 29);
      doc.text('MUST CALL FOR PRE-APPROVAL IF COST', 150, 285, { align: 'center' });
      doc.text('EXCEEDS LIMIT', 150, 296, { align: 'center' });

      doc.setLineWidth(0.75);
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(274, 215, 298, 95, 6, 6, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text('IVR CHECK-IN INSTRUCTIONS', 286, 232);
      doc.setFontSize(8.5);
      doc.setTextColor(217, 119, 6);
      doc.text('MANDATORY CALL-IN REQUIRED UPON ARRIVAL & DEPARTURE', 286, 246);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`1. Call System: ${ivrPhone || '(704) 823-6108'}`, 286, 260);
      doc.text(`2. Security PIN / Job #: ${workOrderNo}`, 286, 273);
      doc.text(doc.splitTextToSize('3. Actions: Follow voice prompts to log on-site presence. Labor hours must align with call logs.', 276), 286, 286);

      // Dynamic Scope & Special Instructions Layout
      let currentY = 325;
      const scopeLines = doc.splitTextToSize(reportedIssue || 'Diagnostic & Repair Work Order', 508);
      const scopeBoxHeight = Math.max(70, scopeLines.length * 12 + 35);

      doc.setLineWidth(0.75);
      doc.setDrawColor('#cbd5e1');
      doc.setFillColor('#f8fafc');
      doc.roundedRect(40, currentY, 532, scopeBoxHeight, 6, 6, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor('#0284c7');
      doc.text('REPORTED ISSUE / WORK SCOPE', 52, currentY + 16);

      doc.setLineWidth(0.5);
      doc.setDrawColor('#e2e8f0');
      doc.line(52, currentY + 22, 560, currentY + 22);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor('#334155');
      doc.text(scopeLines, 52, currentY + 36);

      currentY += scopeBoxHeight + 14;

      const specialText = specialInstructions || 'Please complete work on the first trip if possible. Contact the AM prior to leaving site.';
      const specialLines = doc.splitTextToSize(specialText, 508);
      const specialBoxHeight = Math.max(55, specialLines.length * 12 + 35);

      if (currentY + specialBoxHeight > 700) {
        doc.addPage();
        currentY = 40;
      }

      doc.setLineWidth(0.75);
      doc.setDrawColor('#fde68a');
      doc.setFillColor('#fffbeb');
      doc.roundedRect(40, currentY, 532, specialBoxHeight, 6, 6, 'FD');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor('#92400e');
      doc.text('SPECIAL INSTRUCTIONS', 52, currentY + 16);

      doc.setLineWidth(0.5);
      doc.setDrawColor('#fef3c7');
      doc.line(52, currentY + 22, 560, currentY + 22);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor('#78350f');
      doc.text(specialLines, 52, currentY + 36);

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page 1 of 3 - Subcontractor Work Order • ${orgName}`, pageWidth / 2, 750, { align: 'center' });

      // PAGE 2
      doc.addPage();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(2, 132, 199);
      doc.text(orgName, 40, 50);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Work Order Compliance & Sign-Off Requirements', 40, 66);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Work Order #: ${workOrderNo}`, pageWidth - 40, 50, { align: 'right' });

      doc.line(40, 78, pageWidth - 40, 78);

      const visitInstructions = subWorkOrder?.visitInstructions || [
        'Technician must wear mask when working within the clinics',
        'Proper Dress Code Required, this is a patient facing client',
        'Check in and out with manager on duty',
        'NO VAPING/SMOKING ON CLINIC PROPERTY',
        'All requests for NTE increase must be made while tech is onsite (Labor MUST match IVR hours)',
        'Before/After Photos: Taking before and after photos is required',
        'PROPOSALS ARE REQUIRED TO BE SUBMITTED WITHIN 24 HOURS OF BEING ONSITE',
        'Record make/model # of HVAC unit(s) being serviced (where applicable)',
        'Failure to meet mandatory requirements may result in a delay in payment'
      ];

      doc.rect(40, 90, 532, 280);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(2, 132, 199);
      doc.text('MANDATORY VISIT INSTRUCTIONS', 50, 110);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      let y = 132;
      visitInstructions.forEach((inst: string, i: number) => {
        doc.text(`${i + 1}. ${inst}`, 55, y);
        y += 26;
      });

      doc.setFillColor(250, 250, 250);
      doc.rect(40, 390, 532, 220, 'FD');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('LOCATION MANAGER SIGN-OFF', pageWidth / 2, 415, { align: 'center' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Technician must obtain signature, printed name, and store/site stamp upon completion of work.', pageWidth / 2, 430, { align: 'center' });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('DATE OF SERVICE', 60, 460);
      doc.line(60, 485, 220, 485);
      doc.text('MANAGER NAME (PRINTED)', 250, 460);
      doc.line(250, 485, 540, 485);
      doc.text('MANAGER SIGNATURE', 60, 525);
      doc.line(60, 560, 340, 560);
      doc.rect(370, 510, 170, 80);
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text('STORE STAMP HERE', 455, 555, { align: 'center' });

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page 2 of 3 - Visit & Sign-off • ${orgName}`, pageWidth / 2, 750, { align: 'center' });

      // PAGE 3
      doc.addPage();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(2, 132, 199);
      doc.text(orgName, 40, 50);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Work Order Legal & Payment Terms', 40, 66);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Work Order #: ${workOrderNo}`, pageWidth - 40, 50, { align: 'right' });
      doc.line(40, 78, pageWidth - 40, 78);

      const legalTerms = subWorkOrder?.terms || [
        '1. Contractor is required to follow all instructions listed on this Work Order',
        '2. Contractor is not to perform any work above and beyond the scope of this work order without prior approval from the Purchaser',
        '3. Contractor is not to discuss any pricing or leave paperwork with store/site personnel',
        '4. Contractor must comply with all Government, Property Owner/Management, and Tenant requirements based on the location of work',
        '5. When services are ordered by Purchaser, only one chargeable technician shall be dispatched unless prior written approval is provided',
        '6. All trips to the location must comply with the IVR Check In/Out Procedures. Failure to comply can result in non-payment of invoices',
        '7. All charges should be billed on one invoice with appropriate backup no later than 5 days after the work order has been completed',
        '8. All Invoices must reference the WO#, include a description of services along with an itemized breakdown of labor hours billed in 15 minute increments, rates, material costs and material description',
        '9. Unless approved in writing in advance, the following are not chargeable: fuel, tolls, parking, administrative time, or finance charges',
        '10. The total cost for all trips including Sales Tax cannot exceed the NTE amount on the Work Order',
        '11. Each trip requires a Signoff form. The form must be signed and stamped by the store manager. In addition, any required documents must be submitted with the invoice',
        '12. Contractor must be fully compliant with a W-9 signed registration form and updated insurance on file with Purchaser'
      ];

      doc.rect(40, 90, 532, 620);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('WORK ORDER TERMS & CONDITIONS', 50, 110);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      let y3 = 135;
      legalTerms.forEach((term: string) => {
        const lines = doc.splitTextToSize(term, 500);
        doc.text(lines, 55, y3);
        y3 += (lines.length * 14) + 14;
      });

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page 3 of 3 - Terms & Conditions • ${orgName}`, pageWidth / 2, 750, { align: 'center' });

      const targetSubId = selectedSubId || `sub-${Date.now()}`;
      const onboardingLink = `${window.location.origin}/#/widgets/subcontractor-onboarding/${state.currentOrganization?.id || 'org'}?subId=${targetSubId}&company=${encodeURIComponent(subcontractorName || 'Subcontractor')}&email=${encodeURIComponent(recipientEmail)}&contact=${encodeURIComponent(contactPerson)}&phone=${encodeURIComponent(recipientPhone)}`;
      const jobUploadLink = `${window.location.origin}/#/public-upload/job/${job.id}`;

      const pdfDataUri = doc.output('datauristring');

      const textBody = `Subcontractor Work Order ${workOrderNo}
Prime Contractor: ${orgName}
Service Location: ${siteLocationName} - ${typeof job.address === 'string' ? job.address : (job.address ? `${job.address.street || ''}, ${job.address.city || ''}` : '')}
Approved Subcontractor NTE: ${nteAmountDisplay}

${reportedIssue ? `Reported Issue: ${reportedIssue}\n\n` : ''}${ivrPhone ? `IVR Check-In Phone: ${ivrPhone} (PIN: ${workOrderNo})\n\n` : ''}${specialInstructions ? `Special Instructions: ${specialInstructions}\n\n` : ''}Interactive Job Form Link: ${publicLink}

📤 UPLOAD JOB PROPOSALS, INVOICES, OR NTE INCREASE REQUESTS:
${jobUploadLink}
(Use this link to upload proposals, estimates, subcontractor invoices, parts receipts, or NTE increase requests for Work Order #${workOrderNo}.)

📄 SUBCONTRACTOR COMPLIANCE DOCUMENT UPLOAD (W-9, COI, LICENSE):
${onboardingLink}
(Note: Compliance documents upload directly to your Subcontractor Company Record for office verification and are NOT linked to the customer job.)

Attached PDF Document: TekTrakker_WorkOrder_${workOrderNo.replace('#','')}.pdf`;

      const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; background: #ffffff; color: #0f172a;">
        <div style="background: #059669; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">📋 Subcontractor Work Order ${workOrderNo}</h1>
          <p style="margin: 6px 0 0 0; color: #ecfdf5; font-size: 13px;">${orgName} Operations Portal</p>
        </div>

        <div style="padding: 24px; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 20px;">
            <a href="${publicLink}" target="_blank" style="background: #059669; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 15px; display: inline-block;">
              📲 Open Mobile Work Order Form
            </a>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px;">No TekTrakker login or app download required</div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Prime Contractor</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${orgName}</div>
            <div style="font-size: 12px; color: #64748b;">Phone: ${organization?.phone || ''} • Email: ${organization?.email || ''} ${organization?.address ? `• ${typeof organization.address === 'string' ? organization.address : formatAddress(organization.address)}` : ''}</div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: bold; color: #059669; text-transform: uppercase;">📍 Service Site Location</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${siteLocationName}</div>
            <div style="font-size: 13px; color: #334155; font-weight: 600;">${typeof job.address === 'string' ? job.address : (job.address ? `${job.address.street || ''}, ${job.address.city || ''}` : 'Service Site')}</div>
          </div>

          <div style="background: #ecfdf5; border: 2px solid #059669; border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">Approved Subcontractor Not-To-Exceed (N.T.E.) Amount</div>
            <div style="font-size: 28px; font-weight: 900; color: #065f46; margin: 4px 0;">${nteAmountDisplay}</div>
            <div style="font-size: 11px; color: #047857; font-weight: bold;">Pre-Approval Required for Increases</div>
          </div>

          ${reportedIssue ? `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin-bottom: 4px;">🔧 Reported Issue / Work Scope</div>
            <div style="font-size: 13px; color: #1e293b; font-weight: 600;">${reportedIssue}</div>
          </div>
          ` : ''}

          ${ivrPhone ? `
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; padding: 14px; margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: bold; color: #92400e; text-transform: uppercase; margin-bottom: 4px;">📞 Mandatory IVR Check-In Instructions</div>
            <div style="font-size: 12px; color: #78350f; line-height: 1.5;">
              • <strong>Call System:</strong> ${ivrPhone}<br>
              • <strong>Security PIN / Job #:</strong> ${workOrderNo}<br>
              • <strong>Requirement:</strong> Call upon arrival &amp; prior to departure. Call logs must match on-site labor hours.
            </div>
          </div>
          ` : ''}

          ${specialInstructions ? `
          <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: bold; color: #991b1b; text-transform: uppercase; margin-bottom: 4px;">⚠️ Special Instructions</div>
            <div style="font-size: 12px; color: #991b1b; font-weight: 600;">${specialInstructions}</div>
          </div>
          ` : ''}

          <!-- JOB DOCUMENT UPLOAD PORTAL SECTION -->
          <div style="background: #eff6ff; border: 2px dashed #2563eb; border-radius: 14px; padding: 16px; margin-bottom: 16px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">📂 Job Document Upload Portal (Proposals, Invoices, NTE Increases)</div>
            <div style="font-size: 12px; color: #1e3a8a; margin: 6px 0 12px 0;">
              Need to submit a proposal, subcontractor invoice, parts receipt, or NTE job increase request?
            </div>
            <a href="${jobUploadLink}" target="_blank" style="background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
              📤 Upload Proposals, Invoices &amp; NTE Requests
            </a>
            <div style="font-size: 10px; color: #1e40af; margin-top: 8px;">
              Uploaded documents attach directly to Work Order #${workOrderNo} for dispatcher review.
            </div>
          </div>

          <!-- SUBCONTRACTOR COMPLIANCE DOCUMENT UPLOAD SECTION -->
          <div style="background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 14px; padding: 16px; margin-bottom: 20px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">📄 Subcontractor Required Compliance Document Upload</div>
            <div style="font-size: 12px; color: #166534; margin: 6px 0 12px 0;">
              Please upload your company's W-9, Certificate of Insurance (COI), Trade License, and Subcontractor Agreement.
            </div>
            <a href="${onboardingLink}" target="_blank" style="background: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
              📤 Upload Compliance Documents
            </a>
            <div style="font-size: 10px; color: #15803d; margin-top: 8px;">
              These documents are linked to your Subcontractor Company Profile for compliance verification and are NOT attached to the customer job.
            </div>
          </div>

          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 12px; color: #334155; text-align: center;">
            📎 <strong>PDF Document Attached:</strong> The official printable work order PDF (<code>TekTrakker_WorkOrder_${workOrderNo.replace('#','')}.pdf</code>) complete with manager sign-off sheet and legal contract terms is attached to this email.
          </div>

          <div style="text-align: center; margin: 24px 0 10px 0;">
            <a href="${publicLink}" target="_blank" style="background: #059669; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block;">
              📋 OPEN &amp; COMPLETE WORK ORDER FORM
            </a>
          </div>
        </div>

        <div style="background: #0f172a; color: #94a3b8; padding: 16px; text-align: center; font-size: 11px;">
          Subcontractor Work Order System • ${orgName} Operations
        </div>
      </div>
      `;

      // 1. Save External Subcontractor document (NOT workforce/employee)
      const subData = {
        id: targetSubId,
        organizationId: state.currentOrganization?.id || '',
        name: subcontractorName.trim() || 'Subcontractor',
        companyName: subcontractorName.trim() || 'Subcontractor',
        contactName: contactPerson.trim() || '',
        email: recipientEmail.trim().toLowerCase(),
        phone: recipientPhone.trim() || '',
        type: 'external',
        isInternal: false, // NOT workforce/employee
        isSubscribedToTekTrakker: false, // NOT subscribed to TekTrakker
        status: 'Active',
        complianceStatus: 'Pending Documentation',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'subcontractors', targetSubId), subData, { merge: true });
      dispatch({ type: 'UPDATE_SUBCONTRACTOR', payload: subData });

      // 2. Update Job Document with Subcontractor Details
      const jobRef = doc(db, 'jobs', job.id);
      await updateDoc(jobRef, {
        assignedPartnerId: targetSubId,
        assignedPartnerName: subcontractorName || 'Subcontractor',
        subcontractorName: subcontractorName || 'Subcontractor',
        subcontractorContact: contactPerson || '',
        subcontractorEmail: recipientEmail,
        subcontractorPhone: recipientPhone,
        subcontractorNte: parseFloat(nteLimit) || 549,
        partnerPayoutAmount: parseFloat(nteLimit) || 549,
        subcontractorWorkOrder: {
          ...((job as any)?.subcontractorWorkOrder || {}),
          subcontractorName: subcontractorName || 'Subcontractor',
          contactPerson: contactPerson || '',
          email: recipientEmail,
          phone: recipientPhone,
          nte: parseFloat(nteLimit) || 549
        }
      });

      let finalHtmlBody = htmlBody;
      if (state.currentUser?.includeSignatureInOutbound !== false) {
        const sigHtml = state.currentUser?.emailSignatureHtml || generateUserEmailSignatureHtml(state.currentUser, state.currentOrganization || organization);
        if (sigHtml) {
          finalHtmlBody += `<br/><br/>${sigHtml}`;
        }
      }

      const mailPayload: any = {
        to: recipientEmail,
        type: 'SubcontractorWorkOrder',
        message: {
          subject: `Subcontractor Work Order #${workOrderNo} - ${orgName}`,
          text: textBody,
          html: finalHtmlBody,
          attachments: [
            {
              filename: `TekTrakker_WorkOrder_${workOrderNo.replace('#','')}.pdf`,
              contentType: 'application/pdf',
              path: pdfDataUri
            }
          ]
        },
        skipAutoLog: true,
        createdAt: new Date().toISOString()
      };

      await sendEmail(state.currentOrganization || organization, mailPayload);
      showToast.success(`TekTrakker Work Order PDF & summary email sent to ${recipientEmail}!`);
      onClose();
    } catch (err: any) {
      console.error("Error dispatching direct mail queue document:", err);
      showToast.error(`Failed to send email: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSendingDirect(false);
    }
  };

  const handleSendSMS = async () => {
    if (!recipientPhone) {
      showToast.warn("No phone number specified for recipient.");
      return;
    }
    const smsMessage = `Work Order #${workOrderNo} from ${orgName} for ${siteLocationName || 'Service Site'}. Link: ${publicLink} (No login required)`;
    try {
      const nowIso = new Date().toISOString();
      const msgObj = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: state.currentUser?.id || 'staff',
        senderName: state.currentUser?.firstName ? `${state.currentUser.firstName} ${state.currentUser.lastName || ''}`.trim() : 'Staff',
        receiverId: recipientPhone,
        to: recipientPhone,
        content: smsMessage,
        timestamp: nowIso,
        createdAt: nowIso,
        organizationId: state.currentOrganization?.id || null,
        type: 'sms',
        direction: 'outbound',
        status: 'sent'
      };
      await db.collection('messages').doc(msgObj.id).set(cleanUndefinedFields(msgObj));
      showToast.success(`SMS dispatched via Twilio to ${recipientPhone}!`);
    } catch (err: any) {
      console.error("SMS dispatch error:", err);
      showToast.error(`Failed to send SMS: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col my-auto">
        
        {/* HEADER */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl">
              <Send className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Send Work Order to Subcontractor</h2>
              <p className="text-xs text-indigo-200">
                WO #{workOrderNo} • Interactive remote completion link
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          
          {/* STEP 1: CHOICE SCREEN (NEW VS PREVIOUSLY USED) */}
          {subSelectionMode === 'choose' ? (
            <div className="space-y-4 py-2">
              <div className="text-center mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Assign Subcontractor for Work Order #{workOrderNo}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose whether to select a previously used subcontractor or enter details for a new subcontractor.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* BUTTON 1: PREVIOUSLY USED */}
                <button
                  type="button"
                  onClick={() => setSubSelectionMode('existing')}
                  className="p-5 border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-2xl text-left transition-all group flex flex-col justify-between hover:shadow-lg"
                >
                  <div>
                    <div className="p-3 bg-indigo-600 text-white rounded-xl w-max mb-3 group-hover:scale-110 transition-transform">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">Previously Used Subcontractor</h4>
                    <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wide">From Directory</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      Select from your saved subcontractors directory, linked partner list, or past 1099 vendors.
                    </p>
                  </div>
                </button>

                {/* BUTTON 2: NEW SUBCONTRACTOR */}
                <button
                  type="button"
                  onClick={() => setSubSelectionMode('new')}
                  className="p-5 border-2 border-emerald-200 dark:border-emerald-800 hover:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-2xl text-left transition-all group flex flex-col justify-between hover:shadow-lg"
                >
                  <div>
                    <div className="p-3 bg-emerald-600 text-white rounded-xl w-max mb-3 group-hover:scale-110 transition-transform">
                      <Plus className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">New Subcontractor</h4>
                    <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wide">Enter Details Now</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      Enter company name, contact person, email, phone, and NTE limit for a new subcontractor.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* BACK BUTTON TO CHANGE SELECTION MODE */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setSubSelectionMode('choose')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Change Subcontractor Option
                </button>
                <span className="text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                  {subSelectionMode === 'existing' ? 'Previously Used Subcontractor' : 'New Subcontractor Entry'}
                </span>
              </div>

              {/* PERMISSIONS INFO BADGE */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">No TekTrakker Login Required</span>
                  Subcontractors opening this link can view job details, fill gauge readings, upload photos, and sign digitally.
                </div>
              </div>

              {/* STEP 2A: EXISTING SUBCONTRACTOR DIRECTORY SELECTION */}
              {subSelectionMode === 'existing' && subcontractorsList.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-500" /> Choose Previously Used Subcontractor
                  </label>
                  <select
                    value={selectedSubId}
                    onChange={(e) => handleSelectSubcontractor(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Select from Subcontractors Directory --</option>
                    {subcontractorsList.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.companyName || sub.contactName || 'Subcontractor'} {sub.trade ? `(${sub.trade})` : ''} - {sub.email || sub.phone || 'No Contact Info'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* SHORTENED FORM INPUTS FOR SUBCONTRACTOR DETAILS & EMAIL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Subcontractor Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AdvantiAir"
                    value={subcontractorName}
                    onChange={(e) => setSubcontractorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Trey Bowen"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Subcontractor Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="Operations@tekairinc.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Subcontractor Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="(210) 318-4197"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* APPROVED NTE LIMIT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Subcontractor Assigned NTE Limit ($)
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    placeholder="549"
                    value={nteLimit}
                    onChange={(e) => setNteLimit(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* DISPATCHER NOTE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Custom Dispatcher Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Access code is 1234. Please contact the AM prior to leaving site."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              {/* PUBLIC LINK DISPLAY & COPY BUTTON */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" /> Remote Field Form URL
                  </span>
                  <a
                    href={publicLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Preview Form <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicLink}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0 transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
              {/* JOB RELATED DOCUMENT UPLOAD LINK (PROPOSALS, INVOICES, NTE INCREASES) */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/60 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-300">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" /> Job Upload Portal (Proposals, Invoices, NTE Requests)
                  </span>
                  <a
                    href={`${window.location.origin}/#/public-upload/job/${job.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Preview Portal <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-[11px] text-blue-700 dark:text-blue-400 leading-snug">
                  Subcontractors use this link to upload proposals, invoices, receipts, or NTE increase requests for Work Order #{workOrderNo}.
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/#/public-upload/job/${job.id}`}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-slate-900 dark:text-white font-mono text-xs select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const link = `${window.location.origin}/#/public-upload/job/${job.id}`;
                      navigator.clipboard.writeText(link);
                      setCopiedJobUploadLink(true);
                      showToast.success("Job Upload Link Copied!");
                      setTimeout(() => setCopiedJobUploadLink(false), 3000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0 transition-all"
                  >
                    {copiedJobUploadLink ? <Check className="w-3.5 h-3.5 text-blue-200" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedJobUploadLink ? 'Copied!' : 'Copy Job Upload Link'}
                  </button>
                </div>
              </div>

              {/* SUBCONTRACTOR COMPLIANCE DOCUMENT UPLOAD LINK */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Subcontractor Document Upload Link (W-9, COI, License)
                  </span>
                  <a
                    href={`${window.location.origin}/#/widgets/subcontractor-onboarding/${state.currentOrganization?.id || 'org'}?subId=${selectedSubId || 'new'}&company=${encodeURIComponent(subcontractorName || 'Subcontractor')}&email=${encodeURIComponent(recipientEmail)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Preview Portal <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-snug">
                  Uploaded compliance documents attach to the <strong>Subcontractor Company Record</strong> (NOT the customer job).
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/#/widgets/subcontractor-onboarding/${state.currentOrganization?.id || 'org'}?subId=${selectedSubId || 'new'}&company=${encodeURIComponent(subcontractorName || 'Subcontractor')}&email=${encodeURIComponent(recipientEmail)}`}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white font-mono text-xs select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const link = `${window.location.origin}/#/widgets/subcontractor-onboarding/${state.currentOrganization?.id || 'org'}?subId=${selectedSubId || 'new'}&company=${encodeURIComponent(subcontractorName || 'Subcontractor')}&email=${encodeURIComponent(recipientEmail)}`;
                      navigator.clipboard.writeText(link);
                      setCopiedDocLink(true);
                      showToast.success("Subcontractor Document Upload Link Copied!");
                      setTimeout(() => setCopiedDocLink(false), 3000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0 transition-all"
                  >
                    {copiedDocLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedDocLink ? 'Copied!' : 'Copy Doc Link'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ACTIONS */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-colors"
            >
              Close
            </button>

            {subSelectionMode !== 'choose' && (
              <div className="flex flex-wrap items-center gap-2">
                {recipientPhone && (
                  <button
                    type="button"
                    onClick={handleSendSMS}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all"
                  >
                    <MessageSquare className="w-4 h-4" /> Text SMS
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSendDirectEmail}
                  disabled={isSendingDirect}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSendingDirect ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Work Order &amp; Mobile Link
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default SendSubcontractorWorkOrderModal;
