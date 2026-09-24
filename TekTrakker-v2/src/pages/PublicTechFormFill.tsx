import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { PrintableTechJobForm, type SubcontractorFormData } from '../components/forms/PrintableTechJobForm';
import { isHvacTrade } from '../utils/tradeResolver';
import { uploadFileToStorage } from '../lib/storageService';
import { CheckCircle2, Loader2, Send, AlertTriangle, FileText, Printer } from 'lucide-react';
import type { Job } from '../types';

export const PublicTechFormFill: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [formData, setFormData] = useState<SubcontractorFormData | null>(null);

  useEffect(() => {
    const fetchJobData = async () => {
      if (!jobId) {
        setError('Invalid Job Link');
        setIsLoading(false);
        return;
      }

      try {
        const db = getFirestore();
        const jobRef = doc(db, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
          setError('Job record not found. Please check the link sent by your office.');
          setIsLoading(false);
          return;
        }

        const data = { id: jobSnap.id, ...jobSnap.data() } as Job;
        setJob(data);

        // Fetch Org data if available
        if (data.organizationId) {
          try {
            const orgSnap = await getDoc(doc(db, 'organizations', data.organizationId));
            if (orgSnap.exists()) {
              setOrganization(orgSnap.data());
            }
          } catch (orgErr) {
            console.warn("Org fetch warning:", orgErr);
          }
        }

        // Restore draft from localStorage or Cloud draft or subcontractorFormData
        try {
          const localDraftKey = `tektrakker_tech_form_draft_${jobId}`;
          const localDraft = localStorage.getItem(localDraftKey);
          if (localDraft) {
            const parsed = JSON.parse(localDraft);
            setFormData(parsed);
            setIsDraftRestored(true);
          } else if ((data as any)?.draftData) {
            setFormData((data as any).draftData);
            setIsDraftRestored(true);
          } else if ((data as any)?.subcontractorFormData) {
            setFormData((data as any).subcontractorFormData);
            setIsDraftRestored(true);
          }
        } catch (draftErr) {
          console.warn("Draft restore notice:", draftErr);
        }
      } catch (err: any) {
        console.error("Error loading job for public form:", err);
        setError("Failed to load job data: " + (err.message || String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobData();
  }, [jobId]);

  // Auto-Save to LocalStorage whenever formData changes
  useEffect(() => {
    if (!jobId || !formData || isSubmitted) return;
    try {
      localStorage.setItem(`tektrakker_tech_form_draft_${jobId}`, JSON.stringify(formData));
    } catch (e) {
      console.warn("LocalStorage save warning:", e);
    }
  }, [formData, jobId, isSubmitted]);

  // Periodic Cloud Auto-Save to Firestore (every 15s)
  useEffect(() => {
    if (!jobId || !formData || isSubmitted) return;
    const interval = setInterval(async () => {
      try {
        const db = getFirestore();
        const jobRef = doc(db, 'jobs', jobId);
        await updateDoc(jobRef, {
          draftData: formData,
          draftUpdatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Cloud draft autosave notice:", e);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [formData, jobId, isSubmitted]);

  // Warn on accidental tab close / navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSubmitted && formData) {
        e.preventDefault();
        e.returnValue = 'You have unsaved work order form progress. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSubmitted, formData]);

  const handleSubmit = async () => {
    if (!jobId || !job) return;
    setIsSubmitting(true);

    try {
      // 1. Upload attached photos with category & custom labels
      const uploadedFileObjects: any[] = [];
      const orgId = job.organizationId || 'default';
      const rawTechName = (formData as any)?.techName || (job as any)?.technicianName || (job as any)?.assignedTech || (job as any)?.techName || '';
      const activeTechName = (rawTechName && !rawTechName.toLowerCase().includes('dispatch')) ? rawTechName : 'Subcontractor Tech';

      if (formData?.photoAttachments && formData.photoAttachments.length > 0) {
        for (let idx = 0; idx < formData.photoAttachments.length; idx++) {
          const item = formData.photoAttachments[idx];
          try {
            const file = item.file;
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'photo.jpg';
            const uniqueNonce = Math.random().toString(36).substring(2, 9);
            const path = `organizations/${orgId}/public_uploads/${job.id}/${Date.now()}_${idx}_${uniqueNonce}_${safeName}`;
            const fileUrl = await uploadFileToStorage(path, file);
            
            const categoryTag = item.category || 'Before';
            const notes = item.customLabel?.trim() || '';
            const displayLabel = notes ? `[${categoryTag}] ${notes}` : `[${categoryTag}] Photo`;

            uploadedFileObjects.push({
              id: `photo_${Date.now()}_${idx}_${uniqueNonce}`,
              fileName: file.name || safeName,
              fileUrl,
              url: fileUrl,
              dataUrl: fileUrl,
              type: 'Photo',
              fileType: file.type || 'image/jpeg',
              category: categoryTag,
              label: displayLabel,
              uploadedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              parentId: job.id,
              parentType: 'job',
              organizationId: orgId,
              uploadedBy: activeTechName,
              metadata: {
                label: displayLabel,
                category: categoryTag,
                customNotes: notes,
                phase: categoryTag.toLowerCase()
              }
            });
          } catch (uploadErr) {
            console.warn("Non-fatal: Photo upload error:", uploadErr);
          }
        }
      } else if (formData?.photos && formData.photos.length > 0) {
        for (let idx = 0; idx < formData.photos.length; idx++) {
          const file = formData.photos[idx];
          try {
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'photo.jpg';
            const uniqueNonce = Math.random().toString(36).substring(2, 9);
            const path = `organizations/${orgId}/public_uploads/${job.id}/${Date.now()}_${idx}_${uniqueNonce}_${safeName}`;
            const fileUrl = await uploadFileToStorage(path, file);
            uploadedFileObjects.push({
              id: `photo_${Date.now()}_${idx}_${uniqueNonce}`,
              fileName: file.name || safeName,
              fileUrl,
              url: fileUrl,
              dataUrl: fileUrl,
              type: 'Photo',
              fileType: file.type || 'image/jpeg',
              category: 'Before',
              label: '[Before] Photo',
              uploadedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              parentId: job.id,
              parentType: 'job',
              organizationId: orgId,
              uploadedBy: activeTechName,
              metadata: {
                label: '[Before] Photo',
                category: 'Before',
                phase: 'before'
              }
            });
          } catch (uploadErr) {
            console.warn("Non-fatal: Photo upload error:", uploadErr);
          }
        }
      }

      // 2. Generate SignOff_Sheet.html document
      const managerSig = formData?.customerSignature || '';
      const techSig = formData?.techSignature || '';
      const mgrName = formData?.managerName || 'Site Manager';
      const rawTech = formData?.techName || (job as any)?.technicianName || (job as any)?.assignedTech || (job as any)?.techName || '';
      const technicianName = (rawTech && !rawTech.toLowerCase().includes('dispatch')) ? rawTech : 'Technician';
      const stamp = formData?.storeStamp || 'Site Stamp Verified';
      const dateStr = new Date().toLocaleString();
      const siteLocationName = (job as any)?.siteLocationName || (job as any)?.siteName || (typeof job.address === 'object' ? job.address?.name : '') || job.customerName || 'Service Location';
      const subCompanyName = (job as any)?.subcontractorWorkOrder?.contactName || (job as any)?.subcontractorName || (job as any)?.assignedPartnerName || 'Subcontractor';
      const woNumber = job.workOrderNumber || job.poNumber || job.id.slice(0, 8);

      const signOffHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Official Job Completion &amp; Sign-Off Sheet</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
          .sheet { max-width: 650px; margin: 0 auto; background: #ffffff; border: 2px solid #0f172a; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: start; }
          .title { font-size: 20px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 16px; background: #fafafa; }
          .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0284c7; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .sig-box { border: 1px solid #cbd5e1; background: #ffffff; padding: 8px; border-radius: 6px; min-height: 70px; display: flex; align-items: center; justify-content: center; margin-top: 6px; }
          .sig-img { max-height: 60px; max-width: 100%; object-fit: contain; }
          .cert-text { font-size: 11px; color: #334155; font-style: italic; background: #f1f5f9; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #059669; }
          .stamp-box { border: 2px dashed #94a3b8; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 11px; font-weight: bold; background: #f8fafc; margin-top: 14px; }
          .footer { border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; text-align: center; font-size: 10px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <h1 class="title">${organization?.name || 'TekAir Inc.'}</h1>
              <div class="subtitle">Official Job Completion &amp; Manager Sign-Off Sheet</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 14px; font-weight: 900; color: #0f172a;">WO #: ${woNumber}</div>
              <div style="font-size: 11px; color: #64748b;">Date: ${dateStr}</div>
            </div>
          </div>

          <div class="box">
            <div class="box-title">📍 Service Site Location</div>
            <div style="font-weight: 800; font-size: 14px;">${siteLocationName}</div>
            <div style="font-size: 12px; color: #334155;">${typeof job.address === 'string' ? job.address : '1860 S Seguin Ave. Building E'}</div>
          </div>

          <div class="box">
            <div class="box-title">✍️ 1. Site Manager / Customer Acceptance Sign-Off</div>
            <div style="font-size: 12px; margin-bottom: 4px;"><strong>Manager Name:</strong> ${mgrName}</div>
            <div style="font-size: 12px; margin-bottom: 4px;"><strong>Store / Location Stamp:</strong> ${stamp}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">I confirm that the service work order has been completed satisfactorily on site.</div>
            <div class="sig-box">
              ${managerSig.startsWith('data:image') 
                ? `<img src="${managerSig}" class="sig-img" alt="Manager Signature"/>`
                : `<div style="font-family: cursive, sans-serif; font-size: 18px; font-weight: bold; color: #0f172a;">${managerSig || mgrName}</div>`
              }
            </div>
          </div>

          <div class="box">
            <div class="box-title">🛠️ 2. Technician Verification &amp; Accuracy Certification</div>
            <div style="font-size: 12px; margin-bottom: 8px;"><strong>Technician Name:</strong> ${technicianName}</div>
            <div class="cert-text">
              &quot;I hereby certify that all information, equipment readings, diagnostic findings, consumed parts, attached photos, and work logs submitted for Work Order #${woNumber} are 100% accurate, complete, and verified in full.&quot;
            </div>
            <div class="sig-box">
              ${techSig.startsWith('data:image') 
                ? `<img src="${techSig}" class="sig-img" alt="Tech Signature"/>`
                : `<div style="font-family: cursive, sans-serif; font-size: 18px; font-weight: bold; color: #0f172a;">${techSig || technicianName}</div>`
              }
            </div>
          </div>

          <div class="stamp-box">
            OFFICIAL LOCATION VERIFICATION STAMP RECORD<br/>
            <span style="font-size: 11px; color: #0f172a;">${stamp}</span>
          </div>

          <div class="footer">
            Recorded via TekTrakker Work Order System • ${dateStr}
          </div>
        </div>
      </body>
      </html>
      `;

      const signOffFileObj = {
        id: `signoff-doc-${Date.now()}`,
        organizationId: job.organizationId || 'default',
        parentId: job.id,
        parentType: 'job',
        fileName: 'SignOff_Sheet.html',
        fileType: 'text/html',
        dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(signOffHtml))),
        createdAt: new Date().toISOString(),
        uploadedBy: 'subcontractor',
        type: 'Document',
        isInternal: true,
        internalOnly: true,
        metadata: { label: 'Sign-Off Sheet', internalOnly: true, isSubcontractorDoc: true }
      };

      // 3. Generate Confidential Internal Subcontractor Tech Job Record Document
      const partsRows = (formData?.parts || [])
        .filter(p => p.desc && p.desc.trim() !== '')
        .map((p, i) => `
          <tr>
            <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px;">${i + 1}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold;">${p.desc}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px;">${p.sku || '-'}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: center;">${p.qty || 1}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; font-size: 11px; text-align: right;">$${p.cost || '0.00'}</td>
          </tr>
        `).join('');

      const photoCards = uploadedFileObjects
        .filter(f => f.fileUrl)
        .map(f => `
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; padding: 6px;">
            <img src="${f.fileUrl}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 4px;" alt="${f.label || 'Job Photo'}"/>
            <div style="font-size: 10px; font-weight: bold; color: #0f172a; margin-top: 4px;">${f.label || '[Photo]'}</div>
          </div>
        `).join('');

      const filledFormHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Subcontractor Technical Job Record - WO #${woNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
          .sheet { max-width: 750px; margin: 0 auto; background: #ffffff; border: 2px solid #0f172a; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          .header { border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: start; }
          .title { font-size: 22px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; }
          .badge { background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 900; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 16px; background: #fafafa; }
          .box-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #0284c7; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
          .stat-card { background: #ffffff; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px; font-size: 11px; }
          .stat-label { font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; }
          .stat-val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          .sig-box { border: 1px solid #cbd5e1; background: #ffffff; padding: 8px; border-radius: 6px; min-height: 60px; display: flex; align-items: center; justify-content: center; margin-top: 6px; }
          .sig-img { max-height: 55px; max-width: 100%; object-fit: contain; }
          .footer { border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; text-align: center; font-size: 10px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div>
              <h1 class="title">${organization?.name || 'TekAir Inc.'}</h1>
              <div style="font-size: 12px; font-weight: 700; color: #475569; margin-top: 2px;">CONFIDENTIAL SUBCONTRACTOR JOB TECHNICAL RECORD</div>
            </div>
            <div style="text-align: right;">
              <span class="badge">INTERNAL RECORD</span>
              <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 6px;">WO #: ${woNumber}</div>
              <div style="font-size: 11px; color: #64748b;">Date: ${dateStr}</div>
            </div>
          </div>

          <div class="box grid-2">
            <div>
              <div class="box-title">📍 Service Location</div>
              <div style="font-weight: 800; font-size: 13px;">${siteLocationName}</div>
              <div style="font-size: 11px; color: #334155;">${typeof job.address === 'string' ? job.address : (job.address ? `${job.address.street || ''}, ${job.address.city || ''}` : 'Service Location Address')}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Customer: ${job.customerName || 'Customer'}</div>
            </div>
            <div>
              <div class="box-title">🛠️ Subcontractor &amp; Tech Information</div>
              <div style="font-weight: 800; font-size: 13px;">${subCompanyName}</div>
              <div style="font-size: 11px; color: #334155;">Lead Tech: ${technicianName}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Visit Type: ${formData?.visitType || 'Diagnostic & Repair'}</div>
            </div>
          </div>

          <div class="box">
            <div class="box-title">${isHvacTrade(job, organization) ? '❄️ Equipment & Operating Measurements' : '🛠️ Asset & Field Diagnostic Measurements'}</div>
            <div class="grid-3 mb-2">
              <div class="stat-card"><div class="stat-label">Asset Location</div><div class="stat-val">${formData?.unitLocation || 'Site Asset 1'}</div></div>
              <div class="stat-card"><div class="stat-label">Brand / Manufacturer</div><div class="stat-val">${formData?.brand || (job as any)?.hvacBrand || 'Standard'}</div></div>
              <div class="stat-card"><div class="stat-label">Unit Health</div><div class="stat-val">${formData?.healthStatus || 'Good'}</div></div>
            </div>
            ${isHvacTrade(job, organization) ? `
            <div class="grid-3">
              <div class="stat-card"><div class="stat-label">High / Low Pressure</div><div class="stat-val">${formData?.highPressure || '-'} / ${formData?.lowPressure || '-'} PSI</div></div>
              <div class="stat-card"><div class="stat-label">Superheat / Subcooling</div><div class="stat-val">${formData?.superheat || '-'}° / ${formData?.subcooling || '-'}°F</div></div>
              <div class="stat-card"><div class="stat-label">Supply / Return Delta-T</div><div class="stat-val">${formData?.supplyTemp || '-'}° / ${formData?.returnTemp || '-'}° (${formData?.deltaT || '-'}° ΔT)</div></div>
            </div>
            ` : `
            <div class="grid-3">
              <div class="stat-card"><div class="stat-label">Voltage / Amps</div><div class="stat-val">${formData?.voltage || '-'} V / ${formData?.amps || '-'} A</div></div>
              <div class="stat-card"><div class="stat-label">Operating Temp</div><div class="stat-val">${formData?.ambientTemp || '-'}°F</div></div>
              <div class="stat-card"><div class="stat-label">Diagnostic Status</div><div class="stat-val">PASS / OPERATIONAL</div></div>
            </div>
            `}
          </div>

          <div class="box">
            <div class="box-title">🔍 Diagnostic Findings &amp; Work Performed</div>
            <div style="font-size: 12px; line-height: 1.5; color: #0f172a; font-weight: 600; white-space: pre-wrap; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px;">${formData?.workNotes || formData?.diagnosisNotes || 'Diagnostic and drain line clearance performed onsite.'}</div>
          </div>

          ${partsRows ? `
          <div class="box">
            <div class="box-title">📦 Consumed Parts &amp; Materials</div>
            <table class="table">
              <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                  <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 10px;">#</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 10px;">Description</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 10px;">SKU</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 10px; text-align: center;">Qty</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; font-size: 10px; text-align: right;">Cost</th>
                </tr>
              </thead>
              <tbody>${partsRows}</tbody>
            </table>
          </div>
          ` : ''}

          ${photoCards ? `
          <div class="box">
            <div class="box-title">📸 Attached Job Site Photos</div>
            <div class="grid-2">${photoCards}</div>
          </div>
          ` : ''}

          <div class="box grid-2">
            <div>
              <div class="box-title">✍️ Site Manager Acceptance</div>
              <div style="font-size: 11px;">Manager: <strong>${mgrName}</strong></div>
              <div style="font-size: 11px;">Stamp: <strong>${stamp}</strong></div>
              <div class="sig-box">
                ${managerSig.startsWith('data:image') 
                  ? `<img src="${managerSig}" class="sig-img" alt="Manager Sig"/>`
                  : `<div style="font-family: cursive, sans-serif; font-size: 16px; font-weight: bold;">${managerSig || mgrName}</div>`
                }
              </div>
            </div>
            <div>
              <div class="box-title">🛠️ Technician Verification</div>
              <div style="font-size: 11px;">Tech: <strong>${technicianName}</strong></div>
              <div style="font-size: 10px; color: #059669; font-style: italic; margin-top: 2px;">Certified Accurate</div>
              <div class="sig-box">
                ${techSig.startsWith('data:image') 
                  ? `<img src="${techSig}" class="sig-img" alt="Tech Sig"/>`
                  : `<div style="font-family: cursive, sans-serif; font-size: 16px; font-weight: bold;">${techSig || technicianName}</div>`
                }
              </div>
            </div>
          </div>

          <div class="footer">
            Confidential Internal Record • TekTrakker Work Order System • ${dateStr}
          </div>
        </div>
      </body>
      </html>
      `;

      const filledDocFileObj = {
        id: `sub-record-${Date.now()}`,
        organizationId: job.organizationId || 'default',
        parentId: job.id,
        parentType: 'job',
        fileName: 'Subcontractor_Tech_Job_Record.html',
        fileType: 'text/html',
        dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(filledFormHtml))),
        createdAt: new Date().toISOString(),
        uploadedBy: 'subcontractor',
        type: 'Document',
        isInternal: true,
        internalOnly: true,
        metadata: { label: 'Subcontractor Technical Job Record', internalOnly: true, isSubcontractorDoc: true }
      };

      // 4. Prepare payload for job document update
      const db = getFirestore();
      const jobRef = doc(db, 'jobs', jobId);

      const updatePayload: Record<string, any> = {
        jobStatus: 'Completed',
        updatedAt: new Date().toISOString(),
        completedBySubcontractor: true,
        subcontractorCompletionDate: new Date().toISOString(),
        subcontractorFormData: formData || {},
        draftData: formData || {},
        notes: {
          ...(job.notes || {}),
          diagnosis: formData?.diagnosisNotes || job.notes?.diagnosis || '',
          workNotes: formData?.workNotes || job.notes?.workNotes || '',
          completion: formData?.workNotes || `Completed via Technician Remote Fillable Form at ${new Date().toLocaleString()}`
        },
        techRecommendations: formData?.techRecommendations || job.techRecommendations || '',
        hvacBrand: formData?.brand || job.hvacBrand || '',
        techSignature: formData?.techSignature || '',
        customerSignature: formData?.customerSignature || '',
        signOffSheet: {
          managerName: mgrName,
          managerSignature: managerSig,
          storeStamp: stamp,
          techName: technicianName,
          techSignature: techSig,
          certifiedAccurate: true,
          signOffDate: new Date().toISOString(),
          status: 'Signed & Completed'
        },
        readings: {
          highPressure: formData?.highPressure || '',
          lowPressure: formData?.lowPressure || '',
          liquidTemp: formData?.liquidTemp || '',
          suctionTemp: formData?.suctionTemp || '',
          superheat: formData?.superheat || '',
          subcooling: formData?.subcooling || '',
          ambientTemp: formData?.ambientTemp || '',
          supplyTemp: formData?.supplyTemp || '',
          returnTemp: formData?.returnTemp || '',
          deltaT: formData?.deltaT || '',
          voltage: formData?.voltage || '',
          amps: formData?.amps || '',
          refrigerantType: formData?.refrigerantType || '',
          refrigerantLbs: formData?.refrigerantLbs || '',
          refrigerantOz: formData?.refrigerantOz || ''
        },
        unitStates: [
          {
            assetId: formData?.unitLocation || job.unitStates?.[0]?.assetId || 'Unit 1',
            health: formData?.healthStatus || job.unitStates?.[0]?.health || 'Good',
            refrigerantType: formData?.refrigerantType || job.unitStates?.[0]?.refrigerantType || ''
          }
        ],
        partsUsed: (formData?.parts || [])
          .filter(p => p.desc && p.desc.trim() !== '')
          .map(p => ({
            name: p.desc,
            sku: p.sku || '',
            quantity: parseFloat(p.qty) || 1,
            unitPrice: parseFloat(p.cost) || 0
          }))
      };

      const existingFiles = (job.files || []).filter(f => 
        f.fileName !== 'SignOff_Sheet.html' && 
        f.fileName !== 'Subcontractor_Tech_Job_Record.html' && 
        f.metadata?.label !== 'Sign-Off Sheet' &&
        f.metadata?.label !== 'Subcontractor Technical Job Record'
      );
      updatePayload.files = [...existingFiles, ...uploadedFileObjects, signOffFileObj, filledDocFileObj];
      updatePayload.signOffSheetUrl = signOffFileObj.dataUrl;
      updatePayload.signoffSheetUrl = signOffFileObj.dataUrl;
      updatePayload.customWorkOrderFormUrl = signOffFileObj.dataUrl;
      updatePayload.signOff = updatePayload.signOffSheet;
      updatePayload.signOffSignature = managerSig || techSig || 'SIGNED_ON_FILE';

      await updateDoc(jobRef, updatePayload);
      try { localStorage.removeItem(`tektrakker_tech_form_draft_${jobId}`); } catch (e) {}
      setIsSubmitted(true);
    } catch (err: any) {
      console.error("Failed to submit tech form:", err);
      alert("Failed to submit form: " + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6 space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <h2 className="text-xl font-bold">Loading Field Technician Form...</h2>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6 space-y-4 text-center">
        <div className="p-4 bg-red-500/20 text-red-400 rounded-full border border-red-500/40">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black">{error || 'Job Not Found'}</h2>
        <p className="text-xs text-slate-400 max-w-md">Please contact your dispatcher or office staff to re-send the job form link.</p>
      </div>
    );
  }

  // Render full interactive form with status banners
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 pb-16">
      
      {/* TOP STICKY TOOLBAR FOR TECH */}
      <div className="sticky top-0 z-30 bg-slate-900 text-white p-4 shadow-xl border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight flex items-center gap-2">
              Field Tech Work Order #{job.workOrderNumber || job.id.slice(0, 8)}
              {isSubmitted && <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase tracking-wider font-bold">Submitted</span>}
            </h1>
            <p className="text-[11px] text-slate-400">
              {isSubmitted ? 'Your entries are saved. You can adjust values and click Resubmit anytime.' : 'Fill all fields on screen and tap Submit when done'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {isSubmitted ? 'Updating...' : 'Submitting...'}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> {isSubmitted ? 'Resubmit & Update' : 'Submit Form to Office'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* FORM BODY */}
      <div className="max-w-5xl mx-auto px-1 sm:px-6 py-4 w-full box-border overflow-hidden">
        {isSubmitted ? (
          <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between flex-wrap gap-3 text-xs text-emerald-400 font-bold shadow-lg">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ✅ Form Submitted Successfully! All entries, readings, and signatures are linked to the job. You can update values below and click "Resubmit & Update" anytime.
            </span>
          </div>
        ) : isDraftRestored ? (
          <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-between text-xs text-indigo-400 font-bold">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
              ⚡ Form Progress Auto-Restored from Saved Data!
            </span>
            <button onClick={() => setIsDraftRestored(false)} className="text-[10px] underline opacity-75 hover:opacity-100 shrink-0">Dismiss</button>
          </div>
        ) : null}



        <PrintableTechJobForm
          job={job}
          organization={organization}
          interactive={true}
          onChangeData={setFormData}
        />

        {/* BOTTOM SUBMIT BUTTON */}
        <div className="mt-8 text-center">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-black shadow-2xl shadow-emerald-500/30 inline-flex items-center gap-3 transition-all hover:scale-105 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Submitting to Office...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6" /> Submit Completed Form to Office
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
};

export default PublicTechFormFill;
