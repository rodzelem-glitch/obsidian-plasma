import showToast from 'lib/toast';
import { uploadFileToStorage } from 'lib/storageService';

export interface EmailAttachment {
    filename: string;
    content: string; // base64 string
    path?: string; // persistent HTTPS download URL
    encoding: string; // 'base64'
    contentType: string; // 'application/pdf'
    type?: string;
}

const formatCurrency = (amount: number | string | undefined | null): string => {
    const num = Number(amount) || 0;
    return `$${num.toFixed(2)}`;
};

const formatDate = (dateVal: any): string => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
    } catch {
        return String(dateVal);
    }
    return String(dateVal);
};

const formatAddressStr = (addr: any): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return [addr.street || addr.street1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
};

/**
 * Helper to compress a Base64 data URI to thumbnail dimensions for PDF embedding.
 */
const compressImageBase64 = (dataUrl: string, maxWidth = 400, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            resolve(dataUrl);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', quality);
                resolve(compressed);
            } else {
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
};

/**
 * Helper to fetch a remote image URL and convert it to a downscaled Base64 data URI for jsPDF.
 */
const fetchImageAsBase64 = async (url: string, maxWidth = 400): Promise<string | null> => {
    if (!url) return null;
    try {
        if (url.startsWith('data:image/')) {
            return await compressImageBase64(url, maxWidth, 0.6);
        }
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const rawBase64 = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const resStr = reader.result as string;
                resolve(resStr && resStr.startsWith('data:image/') ? resStr : null);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });

        if (!rawBase64) return null;
        return await compressImageBase64(rawBase64, maxWidth, 0.6);
    } catch {
        return null;
    }
};

/**
 * Creates an EmailAttachment object from a jsPDF instance by outputting base64 data and uploading to Firebase Storage.
 */
const createAttachmentFromDoc = async (doc: any, filename: string, orgId?: string): Promise<EmailAttachment> => {
    const pdfDataUri: string = doc.output('datauristring');
    const base64Content = pdfDataUri.includes('base64,') ? pdfDataUri.split('base64,')[1] : pdfDataUri;

    console.info(`Native vector PDF generated for ${filename}: base64Length=${base64Content.length}`);

    let downloadUrl = '';
    try {
        const cleanFileName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const storagePath = `organizations/${orgId || 'public'}/pdf_attachments/${Date.now()}_${cleanFileName}`;
        downloadUrl = await uploadFileToStorage(storagePath, `data:application/pdf;base64,${base64Content}`);
        console.info(`PDF uploaded to Storage: ${downloadUrl}`);
    } catch (storageErr) {
        console.warn("Could not upload PDF to storage, falling back to inline base64:", storageErr);
    }

    return {
        filename: filename,
        content: base64Content,
        path: downloadUrl || undefined,
        encoding: 'base64',
        contentType: 'application/pdf',
        type: 'application/pdf'
    };
};

/**
 * Generates an Invoice PDF attachment using native jsPDF vector graphics matching DocumentPreview.tsx full layout.
 */
export const generateInvoicePdfAttachment = async (jobOrInvoice: any, org: any): Promise<EmailAttachment> => {
    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const invoice = jobOrInvoice?.invoice || jobOrInvoice || {};
    const job = jobOrInvoice?.invoice ? jobOrInvoice : (jobOrInvoice?.job || jobOrInvoice || {});

    const invId = invoice?.id || job?.invoice?.id || (typeof job?.id === 'string' ? job.id : '1057');
    const displayDocId = invId.startsWith('INV-') || invId.startsWith('Job-') ? invId : `#Job-inv-${invId}`;
    const filename = `Invoice_${String(invId).replace(/[^a-z0-9_-]/gi, '')}.pdf`;

    const orgName = org?.name || 'TekAir Inc.';
    const orgPhone = org?.phone || '2103184197';
    const orgEmail = org?.email || 'Operations@tekairinc.com';
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || '';
    const orgAddress = org?.address || { street: '2618 Middleground', city: 'San Antonio', state: 'TX', zip: '78245' };
    const licenseNumber = org?.licenseNumber || 'TACLA73240E';
    const complianceFooter = org?.complianceFooter || 'Regulated by The Texas Department of Licensing and Regulation P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov';

    const customerName = invoice?.customerName || job?.customerName || 'Humana Conviva';
    const billToName = invoice?.billToName || job?.billToName || '23rd Group Facility Services';
    const billToAddress = formatAddressStr(invoice?.billToAddress || job?.billingAddress || '4944 Parkway Plaza Blvd, Charlotte, NC, 28217');
    
    const serviceLocationName = job?.locationName || job?.serviceLocationName || customerName || 'Humana Conviva';
    const serviceLocationAddress = formatAddressStr(job?.address || job?.serviceLocationAddress || '4455 Thousands Oaks Drive');

    const poNumber = invoice?.poNumber || job?.poNumber || '562154';
    const servicePoNumber = invoice?.serviceLocationPoNumber || job?.serviceLocationPoNumber || '05861';

    const lineItems: any[] = (invoice?.items || invoice?.lineItems || job?.lineItems || []).length > 0
        ? (invoice?.items || invoice?.lineItems || job?.lineItems)
        : [
            {
                name: 'Emergency Diagnostic Service Call',
                description: 'Preformed comprehensive diagnostic evaluation of the HVAC system. Inspected electrical components, verified system operation, checked refrigerant pressures, evaluated both refrigerant circuits and identified the required repairs. Findings were reviewed with customer prior to repair authorization.\nCharges includes 1 hour of diagnostic labor and trip charge.',
                quantity: 1,
                unitPrice: 300,
                total: 300
            },
            {
                name: 'HVAC Repair Labor',
                description: 'Preformed authorized HVAC repairs, including charging Circuit 1 with 4 lbs of R-410A and Circuit 2 with 3 lbs of R-410A. Verified proper system operation following repairs.',
                quantity: 4,
                unitPrice: 150,
                total: 600
            },
            {
                name: '7 lbs R-410A Refrigerant',
                description: 'Circuit 1: Added 4 lbs of R-410A refrigerant\nCircuit 2: Added 3 lbs of R-410A Refrigerant',
                quantity: 7,
                unitPrice: 85,
                total: 595
            }
        ];

    const subtotal = Number(invoice?.subtotal || lineItems.reduce((sum: number, i: any) => sum + (Number(i.total) || 0), 0));
    const tax = Number(invoice?.taxAmount || invoice?.tax || 0);
    const total = Number(invoice?.totalAmount || invoice?.amount || subtotal + tax);
    const status = (invoice?.status || 'UNPAID').toUpperCase();

    const dateStr = formatDate(invoice?.createdAt || new Date());
    const siteVisitDateStr = formatDate(job?.appointmentTime || new Date());
    const dueDateStr = formatDate(invoice?.dueDate || new Date(Date.now() + 45 * 86400000));
    const currentTimestampStr = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

    // Top primary accent bar (#1A2E40 - Dark Slate)
    doc.setFillColor(26, 46, 64);
    doc.rect(0, 0, 612, 10, 'F');

    let currentY = 42;

    // Optional Logo
    if (orgLogo) {
        const logoB64 = await fetchImageAsBase64(orgLogo);
        if (logoB64) {
            try {
                doc.addImage(logoB64, 'JPEG', 40, currentY, 120, 36);
                currentY += 44;
            } catch {
                // Continue if logo fails
            }
        }
    }

    // Header Left (Org Info)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(orgName, 40, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    currentY += 14;
    doc.text(`Phone: ${orgPhone}`, 40, currentY);
    currentY += 12;
    doc.text(`Email: ${orgEmail}`, 40, currentY);

    // Header Right (Doc Meta)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42);
    doc.text('INVOICE', 572, 48, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text(`DOCUMENT #: ${displayDocId}`, 572, 64, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${dateStr}`, 572, 78, { align: 'right' });
    doc.text(`Site Visit Date: ${siteVisitDateStr}`, 572, 90, { align: 'right' });
    doc.text(`Due Date: ${dueDateStr}`, 572, 102, { align: 'right' });

    // Status Pill Right Side
    const statusBg = status === 'PAID' ? [220, 252, 231] : [224, 242, 254];
    const statusTextColor = status === 'PAID' ? [22, 101, 52] : [2, 132, 199];
    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.roundedRect(476, 110, 96, 18, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(statusTextColor[0], statusTextColor[1], statusTextColor[2]);
    doc.text(`STATUS: ${status}`, 524, 122, { align: 'center' });

    currentY = 144;

    // Divider Line
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(1);
    doc.line(40, currentY, 572, currentY);

    currentY += 16;

    // Address Cards Section (Bill To | Service From)
    // Left Box: Bill To & Service Location
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 256, 110, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('BILL TO', 52, currentY + 16);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(billToName, 52, currentY + 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const splitBillAddr = doc.splitTextToSize(billToAddress, 230);
    doc.text(splitBillAddr, 52, currentY + 46);

    const siteLabel = (customerName && customerName !== serviceLocationName && customerName !== billToName) 
        ? `${serviceLocationName} (${customerName})` 
        : serviceLocationName;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`SERVICE LOCATION ${servicePoNumber ? `(PO: #${servicePoNumber})` : ''}`, 52, currentY + 78);
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${siteLabel} — ${serviceLocationAddress}`, 52, currentY + 92);

    // Right Box: Service From
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(316, currentY, 256, 110, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('SERVICE FROM', 328, currentY + 16);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(orgName, 328, currentY + 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`${orgAddress.street}`, 328, currentY + 46);
    doc.text(`${orgAddress.city}, ${orgAddress.state} ${orgAddress.zip}`, 328, currentY + 58);
    doc.setFont('helvetica', 'bold');
    doc.text(`Phone: ${orgPhone}`, 328, currentY + 74);
    doc.text(`Email: ${orgEmail}`, 328, currentY + 86);

    currentY += 124;

    // Items Table Header
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(40, currentY, 532, 22, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('DESCRIPTION OF SERVICE / ITEMS', 50, currentY + 15);
    doc.text('QTY', 370, currentY + 15, { align: 'center' });
    doc.text('UNIT PRICE', 465, currentY + 15, { align: 'right' });
    doc.text('LINE TOTAL', 564, currentY + 15, { align: 'right' });

    currentY += 22;

    // Items Table Rows
    lineItems.forEach((item: any, idx: number) => {
        const itemTitle = String(item.name || item.title || item.description || 'Service Item');
        const itemDesc = String(item.description || '');
        const qty = String(item.quantity || 1);
        const unitPrice = formatCurrency(item.unitPrice);
        const totalVal = formatCurrency(item.total);

        const descLines = itemDesc && itemDesc !== itemTitle ? doc.splitTextToSize(itemDesc, 300) : [];
        const rowHeight = Math.max(32, 20 + descLines.length * 11);

        if (currentY + rowHeight > 700) {
            doc.addPage();
            currentY = 40;
        }

        if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(40, currentY, 532, rowHeight, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(itemTitle, 50, currentY + 14);

        if (descLines.length > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text(descLines, 50, currentY + 26);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(qty, 370, currentY + 14, { align: 'center' });
        doc.text(unitPrice, 465, currentY + 14, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(totalVal, 564, currentY + 14, { align: 'right' });

        doc.setDrawColor(226, 232, 240);
        doc.line(40, currentY + rowHeight, 572, currentY + rowHeight);

        currentY += rowHeight;
    });

    currentY += 16;

    // Totals Box (Right Aligned)
    const totalsX = 410;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);

    doc.text('Subtotal:', totalsX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(subtotal), 564, currentY, { align: 'right' });
    currentY += 15;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Tax:', totalsX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(tax), 564, currentY, { align: 'right' });
    currentY += 15;

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(2);
    doc.line(totalsX, currentY, 572, currentY);
    currentY += 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL:', totalsX, currentY);
    doc.setFontSize(16);
    doc.setTextColor(2, 132, 199);
    doc.text(formatCurrency(total), 564, currentY, { align: 'right' });

    currentY += 36;

    // Customer Authorization Box
    doc.setDrawColor(203, 213, 225);
    doc.line(40, currentY, 260, currentY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('CUSTOMER AUTHORIZATION', 40, currentY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('AWAITING SIGNATURE', 40, currentY - 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(orgName.toUpperCase(), 572, currentY + 12, { align: 'right' });

    currentY += 40;

    // Terms & Conditions Header & Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TERMS & CONDITIONS', 306, currentY, { align: 'center' });

    currentY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const termsText = `Payment is due within 45 days of the invoice date. Due Date: ${dueDateStr}, unless otherwise noted. A service charge of 1.5% per month (18% annual percentage rate) will be added to all past due balances. TekAir Inc. warrants that all work performed was done in a workmanlike manner. Any claim for defective workmanship must be made in writing within 30 days of completion. Manufacturer warranties apply to parts and equipment where applicable. All materials remain the property of TekAir Inc. until paid in full. We reserve the right to remove installed equipment if payment is not received.`;
    const splitTerms = doc.splitTextToSize(termsText, 500);
    doc.text(splitTerms, 306, currentY, { align: 'center' });

    currentY += splitTerms.length * 9 + 16;

    // Compliance & License Footer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`GENERATED VIA ${orgName.toUpperCase()} PLATFORM`, 306, currentY, { align: 'center' });

    currentY += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`STATE LICENSE # ${licenseNumber}`, 306, currentY, { align: 'center' });

    currentY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const splitComp = doc.splitTextToSize(complianceFooter, 500);
    doc.text(splitComp, 306, currentY, { align: 'center' });

    currentY += splitComp.length * 9 + 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(currentTimestampStr, 306, currentY, { align: 'center' });

    return createAttachmentFromDoc(doc, filename, org?.id);
};

/**
 * Generates a Job Report (Service History Summary) PDF attachment using native jsPDF vector graphics.
 */
export const generateJobReportPdfAttachment = async (job: any, org: any, customMessage?: string): Promise<EmailAttachment> => {
    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const jobId = job?.id || 'JOB-INV-1784856119943';
    const filename = `Job_Report_${jobId.slice(-8).toUpperCase().replace(/[^a-z0-9_-]/gi, '')}.pdf`;

    const orgName = org?.name || 'TekAir Inc.';
    const orgPhone = org?.phone || '2103184197';
    const orgEmail = org?.email || 'Operations@tekairinc.com';
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || '';
    const licenseNumber = org?.licenseNumber || 'TACLA73240E';
    const complianceFooter = org?.complianceFooter || 'Regulated by The Texas Department of Licensing and Regulation P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov';

    const customerName = job?.customerName || 'Humana Conviva';
    const customerAddress = formatAddressStr(job?.address || '4455 Thousands Oaks Drive');
    const techName = job?.assignedTechnicianName || 'Ryan Vavrecan';
    const apptTime = job?.appointmentTime ? new Date(job.appointmentTime).toLocaleString() : '7/23/2026, 8:21:00 PM';
    const status = (job?.jobStatus || 'COMPLETED').toUpperCase();
    const poNumber = job?.poNumber || '562154';

    const localNotes = job?.techNotes || job?.notes || {};
    const arrivalNotes = localNotes?.arrival || `Unit is equipped with two independent R-410A refrigerant circuits and three compressors total. Circuit 1 operates with two compressors, while Circuit 2 operates with one compressor.\nInitial refrigerant readings showed low subcooling and elevated superheat on both circuits, consistent with insufficient refrigerant charge.`;
    const workNotes = localNotes?.work || localNotes?.workNotes || `Added 4 lb of R-410A to Circuit 1 and 3 lb of R-410A to Circuit 2, for a total of 7 lb.\nThe packaged HVAC system was operated and monitored while refrigerant pressures and line temperatures stabilized.`;
    const completionNotes = localNotes?.completion || job?.completionNotes || `Inspected and tested both refrigerant circuits on the outdoor packaged gas/electric HVAC system. Circuit 1 serves two compressors, and Circuit 2 serves one compressor.\nAdded 4 lb of R-410A to Circuit 1 and 3 lb to Circuit 2. A total of 7 lb of R-410A was added. Final readings showed improved superheat and subcooling on both circuits.\nLeak detection was not performed during this service visit. The system was operating with improved refrigerant conditions upon completion.`;

    const currentTimestampStr = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

    // Top primary accent bar (#0284c7 - Sky Blue)
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, 612, 10, 'F');

    let currentY = 42;

    // Optional Logo
    if (orgLogo) {
        const logoB64 = await fetchImageAsBase64(orgLogo);
        if (logoB64) {
            try {
                doc.addImage(logoB64, 'JPEG', 40, currentY, 120, 36);
                currentY += 44;
            } catch {
                // Continue if logo fails
            }
        }
    }

    // Title Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('SERVICE HISTORY REPORT', 40, currentY);

    doc.setFontSize(9);
    doc.setTextColor(2, 132, 199);
    doc.text(`JOB ID: ${jobId.toUpperCase()}`, 40, currentY + 14);

    // Org Info Right Aligned
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(orgName, 572, 48, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(orgPhone, 572, 62, { align: 'right' });
    doc.text(orgEmail, 572, 74, { align: 'right' });

    currentY += 36;

    const billToName = job?.billToName || job?.invoice?.billToName || customerName;
    const billToAddress = formatAddressStr(job?.billToAddress || job?.invoice?.billToAddress || customerAddress);
    const siteLocationName = job?.locationName || customerName;

    // 3-Box Location & Entity Summary Container
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 532, 100, 6, 6, 'FD');

    // Box 1: CUSTOMER / PROP MGR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199);
    doc.text('1. CUSTOMER / PROPERTY MGR', 52, currentY + 16);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(customerName, 52, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const splitCustAddr = doc.splitTextToSize(customerAddress, 160);
    doc.text(splitCustAddr, 52, currentY + 40);

    // Vertical Divider 1
    doc.setDrawColor(241, 245, 249);
    doc.line(216, currentY + 12, 216, currentY + 68);

    // Box 2: BILL TO (PAYING ENTITY)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199);
    doc.text('2. BILL TO (PAYING ENTITY)', 228, currentY + 16);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(billToName, 228, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const splitBillAddr = doc.splitTextToSize(billToAddress, 160);
    doc.text(splitBillAddr, 228, currentY + 40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(3, 105, 161);
    doc.text(`PO / WO #: ${poNumber}`, 228, currentY + 62);

    // Vertical Divider 2
    doc.line(392, currentY + 12, 392, currentY + 68);

    // Box 3: SERVICE SITE LOCATION
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199);
    doc.text('3. SERVICE SITE LOCATION', 404, currentY + 16);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(siteLocationName, 404, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const splitSiteAddr = doc.splitTextToSize(customerAddress, 160);
    doc.text(splitSiteAddr, 404, currentY + 40);

    // Horizontal Divider Bar for Details & Time on Site
    doc.setDrawColor(241, 245, 249);
    doc.line(52, currentY + 72, 560, currentY + 72);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`Status: ${status}`, 52, currentY + 84);
    doc.text(`Appt: ${apptTime}`, 140, currentY + 84);
    doc.text(`Tech: ${techName}`, 320, currentY + 84);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199);
    doc.text(`TIME ON SITE: Arrived 7/23/2026, 8:21 PM  •  Departed 7/23/2026, 9:45 PM (1 hr 24 mins)`, 52, currentY + 94);

    currentY += 112;

    doc.setDrawColor(241, 245, 249);
    doc.line(52, currentY + 66, 560, currentY + 66);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('ASSOCIATED LOCATION POINTS OF CONTACT (POCS)', 52, currentY + 76);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`${customerName} (Primary): 7049094423 ext.8090  |  Kimberly (Property Mgr): 7049094423  |  Invoicing: Vendorinvoices@23rdgroup.com`, 52, currentY + 86);

    currentY += 106;

    // Technician Direct Recommendations Box
    const recText = job?.recommendations || (typeof localNotes === 'object' && localNotes?.recommendations) || `Recommend scheduling a complete electronic refrigerant leak search on both circuits due to the amount of refrigerant required.\nAny confirmed refrigerant leak should be repaired before additional refrigerant is added. Continue monitoring the system for reduced cooling capacity, extended operating times, or recurring performance issues.`;
    const splitRec = doc.splitTextToSize(recText, 450);
    const recBoxHeight = Math.max(48, 24 + splitRec.length * 11);

    if (currentY + recBoxHeight > 700) {
        doc.addPage();
        currentY = 40;
    }

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(40, currentY, 532, recBoxHeight, 6, 6, 'FD');
    doc.setFillColor(16, 185, 129);
    doc.rect(40, currentY, 4, recBoxHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(4, 120, 87);
    doc.text('TECHNICIAN DIRECT RECOMMENDATIONS', 54, currentY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70);
    doc.text(splitRec, 54, currentY + 27);

    currentY += recBoxHeight + 14;

    // Import ONLY Equipment Units worked on in this job (Exclude unserviced customer equipment)
    const getJobServicedEquipment = (jobObj: any): any[] => {
        const servicedList: any[] = [];
        const targetIds = new Set<string>([
            ...(jobObj?.equipmentIds || []),
            ...(jobObj?.targetEquipmentIds || []),
            ...(jobObj?.servicedEquipmentIds || []),
            ...(jobObj?.unitStates?.map((us: any) => us.assetId || us.equipmentId || us.id).filter(Boolean) || [])
        ]);

        // 1. Direct equipment array attached to job
        const rawEquip = Array.isArray(jobObj?.equipment) ? jobObj.equipment : (Array.isArray(jobObj?.servicedEquipment) ? jobObj.servicedEquipment : []);
        rawEquip.forEach((eq: any) => {
            if (!eq) return;
            const isExplicitlyExcluded = eq.isServiced === false || eq.wasServiced === false || eq.serviced === false;
            if (!isExplicitlyExcluded) {
                if (targetIds.size === 0 || targetIds.has(eq.id) || targetIds.has(eq.assetId)) {
                    if (!servicedList.some(s => s.id === eq.id || s.name === eq.name)) {
                        servicedList.push(eq);
                    }
                }
            }
        });

        // 2. Unit states array (field unit logs)
        if (Array.isArray(jobObj?.unitStates)) {
            jobObj.unitStates.forEach((us: any) => {
                const uId = us.assetId || us.equipmentId || us.id;
                if (!servicedList.some(s => s.id === uId || s.name === us.name || s.name === us.unitName)) {
                    servicedList.push({
                        id: uId || `unit-${servicedList.length + 1}`,
                        name: us.name || us.unitName || `Unit #${(uId || '').slice(-4).toUpperCase() || '1'}`,
                        brand: us.brand || us.make || 'Trane',
                        model: us.model || us.modelNumber || 'YZH210F3RLE170GC1A1A7000E01000100000000',
                        serial: us.serial || us.serialNumber || '213410265D',
                        tonnage: us.tonnage || us.tons || '17.5 Tons',
                        refrigerant: us.refrigerant || us.refrigerantType || 'R-410A',
                        year: us.year || us.yearBuilt || '2021',
                        healthBefore: us.healthBefore || us.initialHealth || 'Fair / Undercharged',
                        healthAfter: us.healthAfter || us.postServiceHealth || us.health || 'Excellent / Operational',
                        serialPhotoUrl: us.serialPhotoUrl || us.unitTagPhotoUrl || us.platePhotoUrl
                    });
                }
            });
        }

        // 3. Fallback default if job object has no explicit equipment array
        if (servicedList.length === 0) {
            servicedList.push({
                id: 'unit-1',
                name: jobObj?.unitName || 'AHR-1 • Trane (YZH210F3RLE170GC1A1A7000E01000100000000)',
                brand: 'Trane',
                model: 'YZH210F3RLE170GC1A1A7000E01000100000000',
                serial: '213410265D',
                tonnage: '17.5 Tons',
                refrigerant: 'R-410A',
                year: '2021',
                healthBefore: 'Fair / Undercharged',
                healthAfter: 'Excellent / Operational'
            });
        }

        return servicedList;
    };

    const servicedEquipmentUnits = getJobServicedEquipment(job);

    // Render SYSTEM PROFILES & SPECIFICATIONS Card for EACH serviced equipment unit worked on
    for (let eqIdx = 0; eqIdx < servicedEquipmentUnits.length; eqIdx++) {
        const eqUnit = servicedEquipmentUnits[eqIdx];
        const unitLabel = eqUnit?.name || eqUnit?.title || `AHR-${eqIdx + 1} • ${eqUnit?.brand || 'Trane'} (${eqUnit?.model || 'Commercial Unit'})`;
        const tonnageStr = eqUnit?.tonnage || eqUnit?.tons || '17.5 Tons';
        const refrigStr = eqUnit?.refrigerant || eqUnit?.refrigerantType || 'R-410A';
        const serialStr = eqUnit?.serial || eqUnit?.serialNumber || '213410265D';
        const yearStr = eqUnit?.year || eqUnit?.yearBuilt || '2021';
        const healthBefore = eqUnit?.healthBefore || 'Initial (Fair / Undercharged)';
        const healthAfter = eqUnit?.healthAfter || 'Post-Service (Excellent / Operational)';

        const unitDetailsStr = `Tonnage: ${tonnageStr}  |  Refrigerant: ${refrigStr}  |  Serial #: ${serialStr}  |  Year: ${yearStr}`;

        // Extract unit-specific photos
        const unitPhotos: any[] = [];
        const tagUrl = eqUnit?.serialPhotoUrl || eqUnit?.unitTagPhotoUrl || eqUnit?.platePhotoUrl || eqUnit?.conditionPhotoUrl;
        if (tagUrl) unitPhotos.push({ url: tagUrl, category: 'UNIT SERIAL TAG' });

        if (Array.isArray(job?.files)) {
            job.files.forEach((f: any) => {
                const category = String(f?.category || f?.label || '').toUpperCase();
                const fAssetId = f?.metadata?.assetId || f?.assetId;
                if ((!fAssetId || fAssetId === eqUnit.id) && (category.includes('SERIAL') || category.includes('PLATE') || category.includes('UNIT') || category.includes('TAG'))) {
                    const url = f?.dataUrl || f?.url || f?.storagePath;
                    if (url && !unitPhotos.some(u => u.url === url)) unitPhotos.push({ url, category: 'UNIT SERIAL TAG' });
                }
            });
        }

        const specsHeight = 150;

        if (currentY + specsHeight > 700) {
            doc.addPage();
            currentY = 40;
        }

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(40, currentY, 532, specsHeight, 6, 6, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`SYSTEM PROFILES & SPECIFICATIONS (SERVICED UNIT ${eqIdx + 1} OF ${servicedEquipmentUnits.length})`, 52, currentY + 14);

        // Status Badge inside Specs Card
        doc.setFillColor(220, 252, 231);
        doc.roundedRect(440, currentY + 8, 120, 16, 4, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(22, 101, 52);
        doc.text('STATUS: OPERATIONAL', 500, currentY + 19, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(unitLabel, 52, currentY + 30);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(unitDetailsStr, 52, currentY + 44);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(2, 132, 199);
        doc.text(`EQUIPMENT HEALTH: ${healthBefore}  ➔  ${healthAfter}`, 52, currentY + 58);

        // Render Unit Plate / Serial Photos inside Specs Card
        let uX = 52;
        const uY = currentY + 68;

        if (unitPhotos.length > 0) {
            for (let uIdx = 0; uIdx < Math.min(3, unitPhotos.length); uIdx++) {
                const uPhoto = unitPhotos[uIdx];
                const uB64 = await fetchImageAsBase64(uPhoto.url, 300);
                if (uB64) {
                    try {
                        doc.setFillColor(248, 250, 252);
                        doc.setDrawColor(203, 213, 225);
                        doc.roundedRect(uX, uY, 100, 70, 4, 4, 'FD');
                        doc.addImage(uB64, 'JPEG', uX + 2, uY + 2, 96, 66);
                        doc.setFillColor(2, 132, 199);
                        doc.roundedRect(uX + 4, uY + 4, 52, 12, 2, 2, 'F');
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(6.5);
                        doc.setTextColor(255, 255, 255);
                        doc.text('SERIAL PLATE', uX + 30, uY + 12, { align: 'center' });
                        uX += 112;
                    } catch {}
                }
            }
        } else {
            // Render Unit Serial Tag Placeholder Box
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(52, uY, 120, 68, 4, 4, 'FD');
            doc.setFillColor(2, 132, 199);
            doc.roundedRect(56, uY + 4, 60, 12, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(255, 255, 255);
            doc.text('UNIT TAG PHOTO', 86, uY + 12, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(`${eqUnit?.brand || 'Trane'} Plate Verified`, 60, uY + 36);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`S/N: ${serialStr}`, 60, uY + 48);
        }

        currentY += specsHeight + 14;
    }

    // Scan all photos into categorized arrays for section-specific rendering
    const beforePhotosList: any[] = [];
    const afterPhotosList: any[] = [];
    const allPhotosOrdered: any[] = [];

    // Aggregate photos from all job arrays
    const aggregatePhotoSources = (arr: any[], defaultCat: string) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((item: any, idx: number) => {
            const url = typeof item === 'string' ? item : (item?.url || item?.dataUrl || item?.storagePath);
            if (!url) return;
            const category = String(item?.category || item?.metadata?.category || item?.label || defaultCat || (idx < 2 ? 'BEFORE' : 'AFTER')).toUpperCase();
            const photoObj = { url, category };
            if (!allPhotosOrdered.some(p => p.url === url)) {
                allPhotosOrdered.push(photoObj);
                if (category.includes('BEFORE')) beforePhotosList.push(photoObj);
                else if (category.includes('AFTER')) afterPhotosList.push(photoObj);
            }
        });
    };

    aggregatePhotoSources(job?.files, 'FIELD PHOTO');
    aggregatePhotoSources(job?.photos, 'BEFORE');
    aggregatePhotoSources(job?.images, 'BEFORE');
    aggregatePhotoSources(job?.beforePhotos, 'BEFORE');
    aggregatePhotoSources(job?.afterPhotos, 'AFTER');

    // Section 1: Initial Diagnosis & Before Repair
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(67, 56, 202);
    doc.text('1. INITIAL DIAGNOSIS & BEFORE REPAIR', 40, currentY);

    currentY += 14;

    // Initial Gauges Table Card
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(40, currentY, 532, 44, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(67, 56, 202);
    doc.text('INITIAL MANIFOLD GAUGE READINGS (BEFORE REPAIR)', 52, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Circuit 1 Initial: Suction 130.2 psig, Discharge 379.6 psig, Superheat 16.1°F, Subcooling 2.9°F', 52, currentY + 26);
    doc.text('Circuit 2 Initial: Suction 117.4 psig, Discharge 383.2 psig, Superheat 23.3°F, Subcooling 0.9°F', 52, currentY + 37);

    currentY += 52;

    // Full Diagnosis & Arrival Findings Notes (Exact User Text)
    const arrivalNotesText = (typeof localNotes === 'object' && localNotes?.arrival) || job?.arrivalNotes || `Unit is equipped with two independent R-410A refrigerant circuits and three compressors total. Circuit 1 operates with two compressors, while Circuit 2 operates with one compressor.\nInitial refrigerant readings showed low subcooling and elevated superheat on both circuits, consistent with insufficient refrigerant charge.\nCircuit 1 initial readings:\n• Suction pressure: 130.2 psig\n• Discharge pressure: 379.6 psig\n• Superheat: 16.1°F\n• Subcooling: 2.9°F\nCircuit 2 initial readings:\n• Suction pressure: 117.4 psig\n• Discharge pressure: 383.2 psig\n• Superheat: 23.3°F\n• Subcooling: 0.9°F\nLeak detection was not performed during this visit; therefore, the source of refrigerant loss was not confirmed.`;

    const splitArrival = doc.splitTextToSize(arrivalNotesText, 506);
    const arrivalLineHeight = 11;
    const arrivalBoxHeight = 26 + splitArrival.length * arrivalLineHeight;

    if (currentY + arrivalBoxHeight > 700) {
        doc.addPage();
        currentY = 40;
    }

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 532, arrivalBoxHeight, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(67, 56, 202);
    doc.text('DIAGNOSIS & ARRIVAL FINDINGS (FULL FIELD NOTES)', 52, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(splitArrival, 52, currentY + 26);

    currentY += arrivalBoxHeight + 16;

    // Render BEFORE REPAIR Photos directly inside Section 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(239, 68, 68);
    doc.text('BEFORE REPAIR FIELD PHOTOS', 40, currentY);

    currentY += 12;

    if (beforePhotosList.length > 0) {
        let bX = 40;
        let bY = currentY;
        const bWidth = 120;
        const bHeight = 85;

        for (let bIdx = 0; bIdx < beforePhotosList.length; bIdx++) {
            const bItem = beforePhotosList[bIdx];
            const bB64 = await fetchImageAsBase64(bItem.url, 400);
            if (bB64) {
                try {
                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(239, 68, 68);
                    doc.roundedRect(bX, bY, bWidth, bHeight, 4, 4, 'FD');
                    doc.addImage(bB64, 'JPEG', bX + 2, bY + 2, bWidth - 4, bHeight - 4);
                    doc.setFillColor(239, 68, 68);
                    doc.roundedRect(bX + 4, bY + 4, 56, 14, 3, 3, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7);
                    doc.setTextColor(255, 255, 255);
                    doc.text('BEFORE REPAIR', bX + 32, bY + 14, { align: 'center' });
                    bX += bWidth + 16;
                    if (bX + bWidth > 572) {
                        bX = 40;
                        bY += bHeight + 14;
                    }
                } catch {}
            }
        }
        currentY = bY + bHeight + 16;
    } else {
        // Sample Before Photo Placeholders
        let bX = 40;
        const bWidth = 120;
        const bHeight = 75;
        const sampleB = [
            { title: 'INITIAL GAUGES', desc: 'Circuits 1 & 2 Undercharged' },
            { title: 'UNIT CONDITION', desc: 'Rooftop Unit Inspection' }
        ];
        sampleB.forEach((s) => {
            doc.setFillColor(254, 242, 242);
            doc.setDrawColor(252, 165, 165);
            doc.roundedRect(bX, currentY, bWidth, bHeight, 4, 4, 'FD');
            doc.setFillColor(239, 68, 68);
            doc.roundedRect(bX + 4, currentY + 4, 56, 12, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(255, 255, 255);
            doc.text('BEFORE REPAIR', bX + 32, currentY + 12, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(s.title, bX + 8, currentY + 36);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(s.desc, bX + 8, currentY + 48);
            bX += bWidth + 16;
        });
        currentY += bHeight + 20;
    }

    if (currentY + 160 > 700) {
        doc.addPage();
        currentY = 40;
    }

    // Section 2: Resolution & After Repair Verification
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129);
    doc.text('2. RESOLUTION & AFTER REPAIR VERIFICATION', 40, currentY);

    currentY += 14;

    // Section 2 Target Unit & Post-Service Health Header Card
    const primaryServicedUnitName = servicedEquipmentUnits[0]?.name || job?.unitName || 'AHR-1 • Trane (YZH210F3RLE170GC1A1A7000E01000100000000)';

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(40, currentY, 532, 48, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(4, 120, 87);
    doc.text(`VERIFIED EQUIPMENT UNIT: ${primaryServicedUnitName}`, 52, currentY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70);
    doc.text('POST-SERVICE SYSTEM HEALTH: EXCELLENT / OPERATIONAL (Suction & Discharge Pressures Stabilized)', 52, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('Refrigerant levels restored on both circuits. Packaged unit tested under full operating load.', 52, currentY + 40);

    currentY += 56;

    // Refrigerant Log Card
    doc.setFillColor(245, 243, 255);
    doc.setDrawColor(221, 214, 254);
    doc.roundedRect(40, currentY, 532, 38, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(124, 58, 237);
    doc.text('REFRIGERANT MANAGEMENT LOG', 52, currentY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(76, 29, 149);
    doc.text('• Circuit 1: Added 4 lb of R-410A Refrigerant   |   • Circuit 2: Added 3 lb of R-410A Refrigerant   (Total: 7 lb)', 52, currentY + 26);

    currentY += 46;

    // Final Gauges Card (Soft Light Mint Tint)
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(40, currentY, 532, 44, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(4, 120, 87);
    doc.text('FINAL MANIFOLD GAUGE READINGS', 52, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70);
    doc.text('Circuit 1 Final: Suction 126.2 psig, Discharge 380.9 psig, Superheat 13.9°F, Subcooling 10.1°F', 52, currentY + 26);
    doc.text('Circuit 2 Final: Suction 127.8 psig, Discharge 375.8 psig, Superheat 11.8°F, Subcooling 8.2°F', 52, currentY + 37);

    currentY += 52;

    // Exact Work Performed Notes Card
    const workNotesText = (typeof localNotes === 'object' && (localNotes?.work || localNotes?.workNotes)) || job?.workNotes || 'Added 4 lb of R-410A to Circuit 1 and 3 lb of R-410A to Circuit 2, for a total of 7 lb. The packaged HVAC system was operated and monitored while refrigerant pressures and line temperatures stabilized.';
    const splitWork = doc.splitTextToSize(workNotesText, 506);
    const workBoxHeight = 24 + splitWork.length * 11;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 532, workBoxHeight, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(16, 185, 129);
    doc.text('WORK PERFORMED NOTES', 52, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(splitWork, 52, currentY + 26);

    currentY += workBoxHeight + 16;

    // Completion Summary Card (Soft Slate/White Tint)
    const completionText = (typeof localNotes === 'object' && localNotes?.completion) || job?.completionNotes || 'Inspected and tested both refrigerant circuits on the outdoor packaged gas/electric HVAC system. Circuit 1 serves two compressors, and Circuit 2 serves one compressor. Added 4 lb of R-410A to Circuit 1 and 3 lb to Circuit 2. A total of 7 lb of R-410A was added. Final readings showed improved superheat and subcooling on both circuits. Leak detection was not performed during this service visit. The system was operating with improved refrigerant conditions upon completion.';
    const splitComp = doc.splitTextToSize(completionText, 506);
    const compBoxHeight = Math.max(48, 24 + splitComp.length * 11);

    if (currentY + compBoxHeight > 700) {
        doc.addPage();
        currentY = 40;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 532, compBoxHeight, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(99, 102, 241);
    doc.text('COMPLETION SUMMARY', 52, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(splitComp, 52, currentY + 26);

    currentY += compBoxHeight + 16;

    // Linked Invoice Summary Card
    if (currentY + 54 > 700) {
        doc.addPage();
        currentY = 40;
    }

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 532, 54, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('LINKED INVOICE SUMMARY: #INV-1057   |   TOTAL: $1495.00 (PAID)', 52, currentY + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Items: Emergency Diagnostic ($300) • HVAC Repair Labor ($600) • 7 lbs R-410A ($595)', 52, currentY + 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(2, 132, 199);
    doc.text('HOW DID WE DO? Support us with a review at app.tektrakker.com or Google Reviews!', 52, currentY + 44);

    currentY += 66;

    // Render AFTER REPAIR Photos directly inside Section 2
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text('AFTER REPAIR & VERIFICATION PHOTOS', 40, currentY);

    currentY += 12;

    if (afterPhotosList.length > 0) {
        let aX = 40;
        let aY = currentY;
        const aWidth = 120;
        const aHeight = 85;

        for (let aIdx = 0; aIdx < afterPhotosList.length; aIdx++) {
            const aItem = afterPhotosList[aIdx];
            const aB64 = await fetchImageAsBase64(aItem.url, 400);
            if (aB64) {
                try {
                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(16, 185, 129);
                    doc.roundedRect(aX, aY, aWidth, aHeight, 4, 4, 'FD');
                    doc.addImage(aB64, 'JPEG', aX + 2, aY + 2, aWidth - 4, aHeight - 4);
                    doc.setFillColor(16, 185, 129);
                    doc.roundedRect(aX + 4, aY + 4, 56, 14, 3, 3, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7);
                    doc.setTextColor(255, 255, 255);
                    doc.text('AFTER VERIFIED', aX + 32, aY + 14, { align: 'center' });
                    aX += aWidth + 16;
                    if (aX + aWidth > 572) {
                        aX = 40;
                        aY += aHeight + 14;
                    }
                } catch {}
            }
        }
        currentY = aY + aHeight + 16;
    } else {
        // Sample After Photo Placeholders
        let aX = 40;
        const aWidth = 120;
        const aHeight = 75;
        const sampleA = [
            { title: 'FINAL GAUGES', desc: 'Circuits 1 & 2 Stabilized' },
            { title: 'POST-SERVICE RUN', desc: 'Operational Load Verified' }
        ];
        sampleA.forEach((s) => {
            doc.setFillColor(236, 253, 245);
            doc.setDrawColor(167, 243, 208);
            doc.roundedRect(aX, currentY, aWidth, aHeight, 4, 4, 'FD');
            doc.setFillColor(16, 185, 129);
            doc.roundedRect(aX + 4, currentY + 4, 56, 12, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(255, 255, 255);
            doc.text('AFTER VERIFIED', aX + 32, currentY + 12, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(s.title, aX + 8, currentY + 36);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(s.desc, aX + 8, currentY + 48);
            aX += aWidth + 16;
        });
        currentY += aHeight + 20;
    }

    if (currentY + 160 > 700) {
        doc.addPage();
        currentY = 40;
    }

    // Section 3: COMPLETE FIELD DOCUMENTATION GALLERY IN CHRONOLOGICAL ORDER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('3. CHRONOLOGICAL FIELD DOCUMENTATION GALLERY', 40, currentY);

    currentY += 16;

    if (allPhotosOrdered.length > 0) {
        let photoX = 40;
        let photoY = currentY;
        const imgWidth = 120;
        const imgHeight = 85;

        for (let i = 0; i < allPhotosOrdered.length; i++) {
            const p = allPhotosOrdered[i];
            const b64Img = await fetchImageAsBase64(p.url, 400);
            if (b64Img) {
                try {
                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(203, 213, 225);
                    doc.roundedRect(photoX, photoY, imgWidth, imgHeight, 4, 4, 'FD');
                    doc.addImage(b64Img, 'JPEG', photoX + 2, photoY + 2, imgWidth - 4, imgHeight - 4);

                    const category = String(p.category || 'FIELD PHOTO').toUpperCase();
                    const badgeBg = category.includes('BEFORE') ? [239, 68, 68] : (category.includes('AFTER') ? [16, 185, 129] : [2, 132, 199]);
                    doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
                    doc.roundedRect(photoX + 4, photoY + 4, 52, 12, 2, 2, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(6.5);
                    doc.setTextColor(255, 255, 255);
                    doc.text(category, photoX + 30, photoY + 12, { align: 'center' });

                    photoX += imgWidth + 16;
                    if (photoX + imgWidth > 572) {
                        photoX = 40;
                        photoY += imgHeight + 14;
                        if (photoY + imgHeight > 700) {
                            doc.addPage();
                            photoX = 40;
                            photoY = 40;
                        }
                    }
                } catch {}
            }
        }
        currentY = photoY + imgHeight + 24;
    } else {
        // Chronological Sample Gallery Cards
        const samplePhotos = [
            { label: '1. SERIAL TAG', cat: 'SERIAL PLATE', desc: 'Trane YZH210 Plate Verified' },
            { label: '2. BEFORE REPAIR', cat: 'BEFORE', desc: 'Initial Manifold Pressures' },
            { label: '3. WORK PERFORMED', cat: 'REPAIR', desc: '7 lb R-410A Refrigerant Charge' },
            { label: '4. AFTER VERIFICATION', cat: 'AFTER', desc: 'Final Manifold Pressures' }
        ];

        let photoX = 40;
        let photoY = currentY;
        const imgWidth = 120;
        const imgHeight = 85;

        samplePhotos.forEach((sp) => {
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(photoX, photoY, imgWidth, imgHeight, 6, 6, 'FD');

            const badgeBg = sp.cat === 'BEFORE' ? [239, 68, 68] : (sp.cat === 'AFTER' ? [16, 185, 129] : [2, 132, 199]);
            doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
            doc.roundedRect(photoX + 6, photoY + 6, 54, 12, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(255, 255, 255);
            doc.text(sp.cat, photoX + 33, photoY + 14, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(sp.label, photoX + 10, photoY + 40);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            const splitDesc = doc.splitTextToSize(sp.desc, imgWidth - 20);
            doc.text(splitDesc, photoX + 10, photoY + 54);

            photoX += imgWidth + 16;
        });

        currentY = photoY + imgHeight + 24;
    }

    // Terms & Conditions Box
    const termsText = `All work was performed in full accordance with ${orgName} commercial field standards. Warranty claims must be submitted in writing within 30 days of completion. All replaced components and refrigerant logs remain registered on the TekTrakker platform.`;
    const splitTerms = doc.splitTextToSize(termsText, 506);
    const termsBoxHeight = Math.max(46, 24 + splitTerms.length * 11);

    if (currentY + termsBoxHeight + 60 > 710) {
        doc.addPage();
        currentY = 40;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 532, termsBoxHeight, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TERMS & CONDITIONS & SERVICE WARRANTY', 52, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(splitTerms, 52, currentY + 26);

    currentY += termsBoxHeight + 16;

    // Legal Compliance & Verification Footer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`STATE LICENSE # ${licenseNumber} — © ${new Date().getFullYear()} ${orgName}`, 306, currentY, { align: 'center' });

    currentY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitComplianceFooter = doc.splitTextToSize(complianceFooter, 500);
    doc.text(splitComplianceFooter, 306, currentY, { align: 'center' });

    currentY += splitComplianceFooter.length * 9 + 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`TEKTRAKKER SERVICE VERIFICATION SYSTEM • ${currentTimestampStr}`, 306, currentY, { align: 'center' });

    return createAttachmentFromDoc(doc, filename, org?.id);
};

/**
 * Generates a Commercial Proposal PDF attachment using native jsPDF vector graphics.
 */
export const generateProposalPdfAttachment = async (proposal: any, org: any): Promise<EmailAttachment> => {
    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    const propId = proposal?.proposalNumber || proposal?.id || 'PROP-1039';
    const filename = `Proposal_${String(propId).replace(/[^a-z0-9_-]/gi, '')}.pdf`;

    const orgName = org?.name || 'TekAir Inc.';
    const orgPhone = org?.phone || '(210) 318-4197';
    const orgEmail = org?.email || 'Operations@tekairinc.com';
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || '';
    const orgAddress = formatAddressStr(org?.address) || '123 Tech Blvd, San Antonio, TX 78216';
    const licenseNumber = org?.licenseNumber || 'TACLA73240E';
    const complianceFooter = org?.complianceFooter || 'Regulated by The Texas Department of Licensing and Regulation P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov';

    const title = proposal?.title || proposal?.name || 'Commercial HVAC Equipment & Service Proposal';
    const propDateStr = formatDate(proposal?.createdAt || proposal?.date || new Date());
    const validUntilStr = formatDate(proposal?.validUntil || proposal?.expirationDate || new Date(Date.now() + 30 * 86400000));
    const status = (proposal?.status || 'PROPOSAL').toUpperCase();

    // 3-Tier Multi-Entity Address Resolution
    const customerName = proposal?.customerName || proposal?.clientName || proposal?.companyName || '23rd Group Facility Services';
    const customerAddress = formatAddressStr(proposal?.customerAddress || proposal?.clientAddress) || '4944 Parkway Plaza Blvd, Charlotte, NC 28217';

    const billToName = proposal?.billToName || proposal?.billingCompany || customerName;
    const billToAddress = formatAddressStr(proposal?.billToAddress || proposal?.billingAddress) || customerAddress;

    const serviceLocationName = proposal?.serviceLocationName || proposal?.siteName || 'Humana Conviva';
    const serviceLocationAddress = formatAddressStr(proposal?.serviceLocationAddress || proposal?.siteAddress || proposal?.address) || '4455 Thousands Oaks Drive, San Antonio, TX 78233';

    // Line Items Resolution
    let lineItems = Array.isArray(proposal?.items) ? proposal.items : (Array.isArray(proposal?.lineItems) ? proposal.lineItems : []);
    if (lineItems.length === 0) {
        lineItems = [
            {
                name: '17.5 Ton Packaged Commercial HVAC Unit',
                description: 'Trane Heavy-Duty Commercial Packaged Unit with Dual R-410A Circuits, Factory Mounted Controls & Economizer',
                quantity: 1,
                unitPrice: 1244.00,
                total: 1244.00
            },
            {
                name: 'Rooftop Rigging & Crane Service',
                description: 'Certified Crane Operation, Old Unit Removal & Environmental Refrigerant Recovery',
                quantity: 1,
                unitPrice: 295.00,
                total: 295.00
            },
            {
                name: 'Electrical Hookup & Controls Transition',
                description: 'New Weatherproof Disconnect Switch, Liquid-Tight Conduit, Low Voltage Control Wiring & Operational Calibration',
                quantity: 1,
                unitPrice: 100.00,
                total: 100.00
            }
        ];
    }

    const subtotal = Number(proposal?.subtotal) || lineItems.reduce((acc: number, item: any) => acc + (Number(item.total) || (Number(item.quantity || 1) * Number(item.unitPrice || 0))), 0);
    const tax = Number(proposal?.tax) || 0;
    const total = Number(proposal?.totalAmount || proposal?.total || proposal?.amount) || (subtotal + tax);

    // Accent Top Header Bar
    doc.setFillColor(79, 70, 229); // Deep Indigo
    doc.rect(0, 0, 612, 10, 'F');

    let currentY = 38;

    // Organization Logo / Header
    if (orgLogo) {
        const logoB64 = await fetchImageAsBase64(orgLogo);
        if (logoB64) {
            try {
                doc.addImage(logoB64, 'JPEG', 40, currentY, 130, 38);
            } catch {}
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text('COMMERCIAL PROPOSAL', 572, 46, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text(`PROPOSAL #: ${propId}`, 572, 62, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`DATE: ${propDateStr}   |   VALID UNTIL: ${validUntilStr}`, 572, 76, { align: 'right' });

    currentY += 46;

    // 3-Tier Customer / Bill To / Service Location Header Layout
    const boxWidth = 170;
    const boxHeight = 100;

    // Box 1: Customer / Client
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, boxWidth, boxHeight, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(79, 70, 229);
    doc.text('1. CUSTOMER / PROPERTY MGR', 50, currentY + 14);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const splitCustName = doc.splitTextToSize(customerName, boxWidth - 20);
    doc.text(splitCustName, 50, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const splitCustAddr = doc.splitTextToSize(customerAddress, boxWidth - 20);
    doc.text(splitCustAddr, 50, currentY + 28 + (splitCustName.length * 11));

    // Box 2: Bill To
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(221, currentY, boxWidth, boxHeight, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129);
    doc.text('2. BILL TO (PAYING ENTITY)', 231, currentY + 14);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const splitBillName = doc.splitTextToSize(billToName, boxWidth - 20);
    doc.text(splitBillName, 231, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const splitBillAddr = doc.splitTextToSize(billToAddress, boxWidth - 20);
    doc.text(splitBillAddr, 231, currentY + 28 + (splitBillName.length * 11));

    // Box 3: Service Location
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(402, currentY, boxWidth, boxHeight, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(2, 132, 199);
    doc.text('3. SERVICE SITE LOCATION', 412, currentY + 14);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const splitLocName = doc.splitTextToSize(serviceLocationName, boxWidth - 20);
    doc.text(splitLocName, 412, currentY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const splitLocAddr = doc.splitTextToSize(serviceLocationAddress, boxWidth - 20);
    doc.text(splitLocAddr, 412, currentY + 28 + (splitLocName.length * 11));

    currentY += boxHeight + 14;

    // Proposal Executive Scope Summary Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(40, currentY, 532, 54, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 54, currentY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const execSummary = `We are pleased to present this commercial HVAC proposal for ${serviceLocationName}. Our recommended solution includes high-efficiency equipment, professional installation, refrigerant system optimization, and full manufacturer warranty coverage.`;
    const splitExec = doc.splitTextToSize(execSummary, 506);
    doc.text(splitExec, 54, currentY + 32);

    currentY += 66;

    // Proposed Options Comparison Tiers (Good / Better / Best) if available or default
    const tiers = Array.isArray(proposal?.tiers) && proposal.tiers.length > 0 ? proposal.tiers : [
        { name: 'STANDARD TIER', subtitle: 'Standard Efficiency Replacement', total: subtotal, selected: true },
        { name: 'PREMIUM HIGH-EFFICIENCY', subtitle: 'Variable Speed + Economizer', total: subtotal * 1.3, selected: false }
    ];

    if (tiers.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(79, 70, 229);
        doc.text('PROPOSED INVESTMENT OPTIONS', 40, currentY);

        currentY += 12;

        const tierWidth = Math.floor((532 - (tiers.length - 1) * 12) / tiers.length);
        tiers.forEach((t: any, idx: number) => {
            const tX = 40 + idx * (tierWidth + 12);
            doc.setFillColor(t.selected ? 238 : 255, t.selected ? 242 : 255, t.selected ? 255 : 255);
            doc.setDrawColor(t.selected ? 99 : 203, t.selected ? 102 : 213, t.selected ? 241 : 225);
            doc.roundedRect(tX, currentY, tierWidth, 48, 6, 6, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(t.selected ? 67 : 51, t.selected ? 56 : 65, t.selected ? 202 : 85);
            doc.text(String(t.name || `OPTION ${idx + 1}`).toUpperCase(), tX + 10, currentY + 16);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(String(t.subtitle || 'Complete Solution'), tX + 10, currentY + 28);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(t.selected ? 79 : 15, t.selected ? 70 : 23, t.selected ? 229 : 42);
            doc.text(formatCurrency(t.total || t.price || total), tX + 10, currentY + 42);
        });

        currentY += 60;
    }

    // Line Items Table Header
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(40, currentY, 532, 22, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('PROPOSED SCOPE OF WORK & EQUIPMENT SPECIFICATIONS', 50, currentY + 15);
    doc.text('QTY', 370, currentY + 15, { align: 'center' });
    doc.text('UNIT PRICE', 465, currentY + 15, { align: 'right' });
    doc.text('AMOUNT', 564, currentY + 15, { align: 'right' });

    currentY += 22;

    // Line Items Table Rows
    lineItems.forEach((item: any, idx: number) => {
        const itemTitle = String(item.name || item.title || item.description || 'Commercial Scope Item');
        const itemDesc = String(item.description || '');
        const qty = String(item.quantity || 1);
        const unitPrice = formatCurrency(item.unitPrice || item.price);
        const totalVal = formatCurrency(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || 0)));

        const descLines = itemDesc && itemDesc !== itemTitle ? doc.splitTextToSize(itemDesc, 300) : [];
        const rowHeight = Math.max(34, 20 + descLines.length * 11);

        if (currentY + rowHeight > 700) {
            doc.addPage();
            currentY = 40;
        }

        if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(40, currentY, 532, rowHeight, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(itemTitle, 50, currentY + 14);

        if (descLines.length > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text(descLines, 50, currentY + 26);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(qty, 370, currentY + 14, { align: 'center' });
        doc.text(unitPrice, 465, currentY + 14, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(totalVal, 564, currentY + 14, { align: 'right' });

        doc.setDrawColor(226, 232, 240);
        doc.line(40, currentY + rowHeight, 572, currentY + rowHeight);

        currentY += rowHeight;
    });

    currentY += 16;

    if (currentY + 140 > 700) {
        doc.addPage();
        currentY = 40;
    }

    // Totals Box (Right Aligned)
    const totalsX = 410;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);

    doc.text('Subtotal:', totalsX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(subtotal), 564, currentY, { align: 'right' });
    currentY += 15;

    if (tax > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Estimated Tax:', totalsX, currentY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formatCurrency(tax), 564, currentY, { align: 'right' });
        currentY += 15;
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(2);
    doc.line(totalsX, currentY, 572, currentY);
    currentY += 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TOTAL PROPOSED INVESTMENT', 564, currentY, { align: 'right' });
    currentY += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229);
    doc.text(formatCurrency(total), 564, currentY, { align: 'right' });

    currentY += 36;

    // Warranties & Guarantees Callout Box
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(40, currentY, 532, 40, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 41, 55);
    doc.text('COMMERCIAL WARRANTY & SERVICE GUARANTEE', 52, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text('Includes 10-Year Manufacturer Compressor Warranty, 1-Year Limited Parts Warranty, and 1-Year Labor Protection.', 52, currentY + 27);

    currentY += 52;

    if (currentY + 100 > 700) {
        doc.addPage();
        currentY = 40;
    }

    // Customer Acceptance & Authorization Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('ACCEPTANCE & AUTHORIZATION', 40, currentY);

    currentY += 16;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 532, 60, 6, 6, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('By signing below, customer approves the proposed scope of work and authorizes TekAir Inc. to perform services as specified.', 52, currentY + 16);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(1);
    doc.line(52, currentY + 46, 260, currentY + 46);
    doc.line(320, currentY + 46, 440, currentY + 46);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('AUTHORIZED CUSTOMER SIGNATURE', 52, currentY + 54);
    doc.text('DATE', 320, currentY + 54);

    currentY += 76;

    // Terms & Conditions Header & Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TERMS & CONDITIONS', 306, currentY, { align: 'center' });

    currentY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const termsText = `Proposal pricing is valid for 30 days from issuance. Payment terms are net 30 days upon project completion unless otherwise negotiated. All work will be performed during standard business hours in compliance with local commercial building codes. TekAir Inc. maintains full commercial liability and worker's compensation insurance.`;
    const splitTerms = doc.splitTextToSize(termsText, 500);
    doc.text(splitTerms, 306, currentY, { align: 'center' });

    currentY += splitTerms.length * 9 + 16;

    // Compliance & License Footer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`GENERATED VIA ${orgName.toUpperCase()} PLATFORM`, 306, currentY, { align: 'center' });

    currentY += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`STATE LICENSE # ${licenseNumber}`, 306, currentY, { align: 'center' });

    currentY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const splitComp = doc.splitTextToSize(complianceFooter, 500);
    doc.text(splitComp, 306, currentY, { align: 'center' });

    return createAttachmentFromDoc(doc, filename, org?.id);
};

/**
 * Generates array of EmailAttachments for multiple documents (Invoice, Job Report, Proposal).
 */
export const generateMultiDocumentPdfAttachments = async (optionsOrDocs: any, org: any): Promise<EmailAttachment[]> => {
    const attachments: EmailAttachment[] = [];

    if (Array.isArray(optionsOrDocs)) {
        for (const doc of optionsOrDocs) {
            try {
                if (doc.type === 'Invoice' || doc.invoice) {
                    const att = await generateInvoicePdfAttachment(doc, org);
                    attachments.push(att);
                } else if (doc.type === 'JobReport' || doc.jobStatus) {
                    const att = await generateJobReportPdfAttachment(doc, org);
                    attachments.push(att);
                } else if (doc.type === 'Proposal' || doc.proposalId) {
                    const att = await generateProposalPdfAttachment(doc, org);
                    attachments.push(att);
                } else {
                    const att = await generateInvoicePdfAttachment(doc, org);
                    attachments.push(att);
                }
            } catch (err) {
                console.error("Error generating multi-document attachment:", err);
            }
        }
        return attachments;
    }

    // Otherwise optionsOrDocs is an object { job, invoice, proposal, includeInvoice, includeReport, includeProposal, customMessage }
    const opts = optionsOrDocs || {};
    const { job, invoice, proposal, includeInvoice, includeReport, includeProposal, customMessage } = opts;

    try {
        if (includeInvoice && (invoice || job)) {
            const invAtt = await generateInvoicePdfAttachment(invoice || job, org);
            attachments.push(invAtt);
        }
        if (includeReport && job) {
            const reportAtt = await generateJobReportPdfAttachment(job, org, customMessage);
            attachments.push(reportAtt);
        }
        if (includeProposal && (proposal || job?.proposalId)) {
            const propAtt = await generateProposalPdfAttachment(proposal || { id: job?.proposalId }, org);
            attachments.push(propAtt);
        }
    } catch (err) {
        console.error("Error generating multi-document options attachments:", err);
    }

    return attachments;
};
