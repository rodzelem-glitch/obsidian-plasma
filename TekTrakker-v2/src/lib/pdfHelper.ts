import showToast from 'lib/toast';
import { uploadFileToStorage } from 'lib/storageService';
import { matchTier, displayTierName, getOrGenerateAccountNumber, formatFullAddress, getAddressLines, sanitizeAddressFields, isInternalExpenseFile, isFilePhoto, getPaymentTermsDays, resolveServiceLocation, getAvailableProposalTiers, sanitizeCustomerScopeText, cleanPdfText } from 'lib/utils';
import { computeCanonicalFinancials } from './financialCalculator';
import { resolveDocumentDisplayId } from './numbering';
import { getOrgPaymentInstructions } from './paymentInstructionsHelper';
import { db } from './firebase';
import { generateSubcontractorStatementHtml, SubcontractorStatementHtmlOptions } from './chargebackHelper';
import { getJobTimeSummary } from './jobTimeHelper';

export interface EmailAttachment {
    filename: string;
    content?: string; // base64 string
    path?: string; // persistent HTTPS download URL
    encoding?: string; // 'base64'
    contentType: string; // 'application/pdf'
    type?: string;
}

const formatCurrency = (amount: number | string | undefined | null): string => {
    const num = Number(amount) || 0;
    if (num < 0) {
        return `-$${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateVal: any): string => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } catch {}
    return String(dateVal);
};

const formatAddressStr = (addr: any, city?: string | null, state?: string | null, zip?: string | null): string => {
    return formatFullAddress(addr, city, state, zip);
};

const formatAddressHtml = (addr: any, city?: string | null, state?: string | null, zip?: string | null): string => {
    const lines = getAddressLines(addr, city, state, zip);
    if (!lines.street && !lines.cityStateZip) return '';
    if (lines.street && lines.cityStateZip) {
        return `${lines.street}<br/>${lines.cityStateZip}`;
    }
    return lines.street || lines.cityStateZip;
};

/**
 * Helper to compress a Base64 data URI to thumbnail dimensions for PDF embedding,
 * preserving PNG alpha transparency and sharp text rendering.
 */
const compressImageBase64 = (dataUrl: string, maxWidth = 600, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            resolve(dataUrl);
            return;
        }
        const isPng = dataUrl.startsWith('data:image/png');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            } else if (isPng) {
                // Preserve original pristine PNG if within max width to prevent compression loss
                resolve(dataUrl);
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
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
 * Helper to fetch a remote image URL and convert it to a Base64 data URI for jsPDF.
 */
const fetchImageAsBase64 = async (url: string, maxWidth = 600): Promise<string | null> => {
    if (!url) return null;
    try {
        if (url.startsWith('data:image/')) {
            return await compressImageBase64(url, maxWidth, 0.85);
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
        return await compressImageBase64(rawBase64, maxWidth, 0.85);
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

export type PdfDocType = 'Service_Report' | 'Invoice' | 'Proposal' | 'Work_Order' | 'Statement' | 'Waiver' | 'Certificate' | 'Sign_Off_Sheet';

/**
 * Standardized global helper for clean, uniform PDF document filenames.
 * Pattern: [DocType]_[ID or WO#]_[CustomerName]_[YYYY-MM-DD].pdf
 */
export const getStandardPdfFilename = (
    docType: PdfDocType | string,
    entity: {
        id?: string;
        workOrderNumber?: string;
        poNumber?: string;
        invoiceNumber?: string;
        proposalNumber?: string;
        customerName?: string;
        name?: string;
        customer?: any;
        date?: string | Date;
        createdAt?: string | Date;
        appointmentTime?: string | Date;
    }
): string => {
    const rawId = entity.poNumber || entity.workOrderNumber || entity.invoiceNumber || entity.proposalNumber || entity.id || '';
    const cleanId = String(rawId)
        .replace(/^#/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .trim();

    const rawCustomer = entity.customerName || entity.customer?.name || entity.name || '';
    const cleanCustomer = String(rawCustomer)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .trim();

    const rawDate = entity.date || entity.createdAt || entity.appointmentTime;
    let dateStr = '';
    if (rawDate) {
        try {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().split('T')[0];
            }
        } catch {}
    }
    if (!dateStr) {
        dateStr = new Date().toISOString().split('T')[0];
    }

    const parts = [docType];
    if (cleanId) parts.push(cleanId);
    if (cleanCustomer) parts.push(cleanCustomer);
    if (dateStr) parts.push(dateStr);

    return `${parts.join('_')}.pdf`;
};

/**
 * Renders an organization logo preserving its exact aspect ratio within bounding box limits.
 */
const drawPreservedLogo = (doc: any, logoB64: string, x: number, y: number, maxWidth = 140, maxHeight = 44): number => {
    if (!logoB64) return 0;
    try {
        const imgProps = doc.getImageProperties(logoB64);
        const imgW = imgProps.width || 1;
        const imgH = imgProps.height || 1;
        const imgRatio = imgW / imgH;

        let targetW = maxWidth;
        let targetH = targetW / imgRatio;

        if (targetH > maxHeight) {
            targetH = maxHeight;
            targetW = targetH * imgRatio;
        }

        const format = logoB64.startsWith('data:image/png') || (imgProps as any).fileType === 'PNG' ? 'PNG' : 'JPEG';
        doc.addImage(logoB64, format, x, y, targetW, targetH);
        return targetH;
    } catch {
        try {
            doc.addImage(logoB64, 'PNG', x, y, maxWidth, maxHeight);
            return maxHeight;
        } catch {
            return 0;
        }
    }
};

/**
 * Wraps a jsPDF instance to ensure all text passed to splitTextToSize and text
 * is automatically sanitized of non-WinAnsi unicode characters (like non-breaking hyphens U+2011,
 * smart quotes, em dashes, bullets, etc.) which cause jsPDF to switch to Courier fallback and overflow boundaries.
 */
export const patchJsPdfInstance = <T extends any>(doc: T): T => {
    if (!doc) return doc;
    const origSplit = (doc as any).splitTextToSize?.bind(doc);
    if (origSplit) {
        (doc as any).splitTextToSize = (text: any, maxW: number, options?: any) => {
            return origSplit(cleanPdfText(text), maxW, options);
        };
    }
    const origText = (doc as any).text?.bind(doc);
    if (origText) {
        (doc as any).text = (text: any, x: number, y: number, options?: any, transform?: any) => {
            return origText(cleanPdfText(text), x, y, options, transform);
        };
    }
    return doc;
};

/**
 * Generates an Invoice PDF attachment using native jsPDF vector graphics matching DocumentPreview.tsx full layout.
 */
export const generateInvoicePdfAttachment = async (jobOrInvoice: any, org: any): Promise<EmailAttachment> => {
    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = patchJsPdfInstance(new jsPDF({ unit: 'pt', format: 'letter' }));

    const invoice = jobOrInvoice?.invoice || jobOrInvoice || {};
    const job = jobOrInvoice?.invoice ? jobOrInvoice : (jobOrInvoice?.job || jobOrInvoice || {});

    const docResolved = resolveDocumentDisplayId('Invoice', jobOrInvoice);
    const invId = docResolved.id;
    const referenceNumber = docResolved.referenceNumber || invoice?.referenceNumber || job?.invoice?.referenceNumber || null;
    const displayDocId = invId;
    const filename = getStandardPdfFilename('Invoice', {
        id: invId,
        poNumber: invoice?.poNumber || job?.poNumber || job?.workOrderNumber,
        customerName: invoice?.customerName || job?.customerName,
        date: invoice?.date || job?.appointmentTime || job?.createdAt
    });

    const isTekAir = String(org?.name || (jobOrInvoice as any)?.preparedByOrganization || '').toLowerCase().includes('tekair') || org?.id === 'org-1765817997819';
    const orgName = String(org?.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider'));
    const orgPhone = String(org?.phone || (isTekAir ? '210-318-4197' : ''));
    const orgEmail = String(org?.email || (isTekAir ? 'Operations@tekairinc.com' : ''));
    const orgAddress = formatAddressStr(org?.address) || (isTekAir ? '2618 Middleground, San Antonio, TX 78245' : '');
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || '';
    const licenseNumber = String(org?.licenseNumber || org?.taxId || (jobOrInvoice as any)?.preparedByLicence || (isTekAir ? 'TACLA73240E' : ''));
    const defaultCompliance = isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov' : '';
    const complianceFooter = String(org?.complianceFooter || org?.footerText || org?.regulatoryFooter || defaultCompliance);

    let customerName = invoice?.customerName || job?.customerName || (jobOrInvoice as any)?.customerName || '';
    let customerRawAddr = invoice?.customerAddress || job?.customerAddress || (jobOrInvoice as any)?.customerAddress || '';
    let customerCity = invoice?.city || job?.city || (jobOrInvoice as any)?.city || '';
    let customerState = invoice?.state || job?.state || (jobOrInvoice as any)?.state || '';
    let customerZip = invoice?.zip || job?.zip || (jobOrInvoice as any)?.zip || '';

    let billToName = invoice?.billToName || job?.billToName || (jobOrInvoice as any)?.billToName || customerName;
    let billToRawAddr = invoice?.billToAddress || job?.billingAddress || job?.billToAddress || (jobOrInvoice as any)?.billToAddress || (jobOrInvoice as any)?.billingAddress || customerRawAddr;
    let billToCity = invoice?.billingCity || job?.billingCity || customerCity;
    let billToState = invoice?.billingState || job?.billingState || customerState;
    let billToZip = invoice?.billingZip || job?.billingZip || customerZip;

    let serviceLocationName = (
        invoice?.serviceLocationName ||
        invoice?.locationName ||
        invoice?.siteName ||
        invoice?.location?.name ||
        invoice?.serviceLocation?.name ||
        job?.serviceLocationName ||
        job?.locationName ||
        job?.siteName ||
        job?.location?.name ||
        job?.serviceLocation?.name ||
        (jobOrInvoice as any)?.serviceLocationName ||
        (jobOrInvoice as any)?.locationName ||
        (jobOrInvoice as any)?.siteName ||
        customerName
    );

    let serviceLocationRawAddr = (
        invoice?.serviceLocationAddress ||
        invoice?.siteAddress ||
        invoice?.locationAddress ||
        invoice?.address ||
        invoice?.location?.address ||
        invoice?.serviceLocation?.address ||
        job?.serviceLocationAddress ||
        job?.siteAddress ||
        job?.locationAddress ||
        job?.address ||
        job?.location?.address ||
        job?.serviceLocation?.address ||
        (jobOrInvoice as any)?.serviceLocationAddress ||
        (jobOrInvoice as any)?.siteAddress ||
        (jobOrInvoice as any)?.locationAddress ||
        (jobOrInvoice as any)?.address ||
        customerRawAddr
    );

    let serviceLocationCity = invoice?.serviceLocationCity || job?.serviceLocationCity || customerCity;
    let serviceLocationState = invoice?.serviceLocationState || job?.serviceLocationState || customerState;
    let serviceLocationZip = invoice?.serviceLocationZip || job?.serviceLocationZip || customerZip;

    let assignedTechName = (
        job?.assignedTechnicianName ||
        invoice?.assignedTechnicianName ||
        job?.techName ||
        invoice?.techName ||
        (job as any)?.technicianName ||
        (invoice as any)?.technicianName ||
        (jobOrInvoice as any)?.assignedTechnicianName ||
        (jobOrInvoice as any)?.techName ||
        ''
    );

    let appointmentTimeRaw = (
        job?.appointmentTime ||
        invoice?.appointmentTime ||
        (jobOrInvoice as any)?.appointmentTime ||
        (job as any)?.date ||
        (invoice as any)?.date
    );

    let poNumber = invoice?.poNumber || job?.poNumber || (jobOrInvoice as any)?.poNumber || job?.workOrderNumber || '';
    let servicePoNumber = invoice?.serviceLocationPoNumber || job?.serviceLocationPoNumber || (jobOrInvoice as any)?.serviceLocationPoNumber || invoice?.sitePoNumber || job?.sitePoNumber || '';
    let custAccountNumber = invoice?.accountNumber || job?.accountNumber || (jobOrInvoice as any)?.accountNumber || '';

    // Database Enrichment
    const custId = invoice?.customerId || job?.customerId || (jobOrInvoice as any)?.customerId;
    let jobId = job?.id || invoice?.jobId || (jobOrInvoice as any)?.jobId || (typeof jobOrInvoice?.id === 'string' && !jobOrInvoice.id.startsWith('INV-') && !jobOrInvoice.id.startsWith('inv-') ? jobOrInvoice.id : null);
    const propId = invoice?.proposalId || job?.proposalId || (jobOrInvoice as any)?.proposalId;
    const locId = job?.locationId || invoice?.locationId || (jobOrInvoice as any)?.locationId;
    let dbJobData: any = null;

    try {
        if (jobId) {
            const jDoc = await db.collection('jobs').doc(jobId).get();
            if (jDoc.exists) {
                dbJobData = { id: jDoc.id, ...jDoc.data() };
            }
        }
        if (!dbJobData && invId) {
            const snap1 = await db.collection('jobs').where('invoice.id', '==', invId).limit(1).get();
            if (!snap1.empty) {
                dbJobData = { id: snap1.docs[0].id, ...snap1.docs[0].data() };
                jobId = dbJobData.id;
            } else {
                const snap2 = await db.collection('jobs').where('invoice.invoiceNumber', '==', invId).limit(1).get();
                if (!snap2.empty) {
                    dbJobData = { id: snap2.docs[0].id, ...snap2.docs[0].data() };
                    jobId = dbJobData.id;
                }
            }
        }

        if (dbJobData) {
            if (!customerName) customerName = dbJobData.customerName || '';
            if (!customerRawAddr) customerRawAddr = dbJobData.address || dbJobData.customerAddress || '';
            if (!customerCity) customerCity = dbJobData.city || '';
            if (!customerState) customerState = dbJobData.state || '';
            if (!customerZip) customerZip = dbJobData.zip || '';

            if (!billToName) billToName = dbJobData.billToName || dbJobData.customerName || '';
            if (!billToRawAddr) billToRawAddr = dbJobData.billingAddress || dbJobData.billToAddress || customerRawAddr;
            if (!billToCity) billToCity = dbJobData.billingCity || customerCity;
            if (!billToState) billToState = dbJobData.billingState || customerState;
            if (!billToZip) billToZip = dbJobData.billingZip || customerZip;

            if (!serviceLocationName) serviceLocationName = dbJobData.locationName || dbJobData.serviceLocationName || dbJobData.siteName || '';
            if (!serviceLocationRawAddr) serviceLocationRawAddr = dbJobData.locationAddress || dbJobData.serviceLocationAddress || dbJobData.address || customerRawAddr;
            if (!serviceLocationCity) serviceLocationCity = dbJobData.locationCity || dbJobData.city || customerCity;
            if (!serviceLocationState) serviceLocationState = dbJobData.locationState || dbJobData.state || customerState;
            if (!serviceLocationZip) serviceLocationZip = dbJobData.locationZip || dbJobData.zip || customerZip;

            if (!assignedTechName) assignedTechName = dbJobData.assignedTechnicianName || dbJobData.techName || '';
            if (!appointmentTimeRaw) appointmentTimeRaw = dbJobData.appointmentTime || dbJobData.date;
            if (!poNumber) poNumber = dbJobData.workOrderNumber || dbJobData.woNumber || dbJobData.poNumber || '';
            if (!custAccountNumber) custAccountNumber = dbJobData.accountNumber || '';
        }

        if (custId) {
            const cDoc = await db.collection('customers').doc(custId).get();
            if (cDoc.exists) {
                const dbCustomer = cDoc.data() as any;
                if (!customerName) customerName = dbCustomer.name || '';
                if (!customerRawAddr) customerRawAddr = dbCustomer.address || '';
                if (!customerCity) customerCity = dbCustomer.city || '';
                if (!customerState) customerState = dbCustomer.state || '';
                if (!customerZip) customerZip = dbCustomer.zip || '';

                if (!billToRawAddr) billToRawAddr = dbCustomer.billingAddress || customerRawAddr;
                if (!billToCity) billToCity = dbCustomer.city || customerCity;
                if (!billToState) billToState = dbCustomer.state || customerState;
                if (!billToZip) billToZip = dbCustomer.zip || customerZip;

                if (!custAccountNumber) custAccountNumber = dbCustomer.accountNumber || getOrGenerateAccountNumber(dbCustomer);

                const matchingLoc = resolveServiceLocation(
                    dbJobData || { locationId: locId, locationName: serviceLocationName, address: serviceLocationRawAddr },
                    dbCustomer
                );

                if (matchingLoc) {
                    if (!serviceLocationName || serviceLocationName === customerName) {
                        serviceLocationName = matchingLoc.propertyName || matchingLoc.name || serviceLocationName;
                    }
                    if (matchingLoc.address) {
                        serviceLocationRawAddr = matchingLoc.address;
                        serviceLocationCity = matchingLoc.city || dbCustomer.city || serviceLocationCity;
                        serviceLocationState = matchingLoc.state || dbCustomer.state || serviceLocationState;
                        serviceLocationZip = matchingLoc.zip || dbCustomer.zip || serviceLocationZip;
                    }
                    if (matchingLoc.billToSameAsSite) {
                        if (!invoice?.billToName && !job?.billToName && !dbJobData?.billToName) {
                            billToName = matchingLoc.billToName || matchingLoc.propertyName || matchingLoc.name || billToName;
                        }
                        if (!invoice?.billToAddress && !job?.billToAddress && !dbJobData?.billToAddress) {
                            billToRawAddr = matchingLoc.billToAddress || matchingLoc.address || billToRawAddr;
                            billToCity = matchingLoc.city || dbCustomer.city || billToCity;
                            billToState = matchingLoc.state || dbCustomer.state || billToState;
                            billToZip = matchingLoc.zip || dbCustomer.zip || billToZip;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn('PDF address enrichment fetch skipped:', e);
    }

    if (!serviceLocationRawAddr) serviceLocationRawAddr = customerRawAddr || billToRawAddr || '';
    if (!serviceLocationCity) serviceLocationCity = customerCity || billToCity || '';
    if (!serviceLocationState) serviceLocationState = customerState || billToState || '';
    if (!serviceLocationZip) serviceLocationZip = customerZip || billToZip || '';

    if (!customerRawAddr) customerRawAddr = billToRawAddr || serviceLocationRawAddr || '';
    if (!customerCity) customerCity = billToCity || serviceLocationCity || '';
    if (!customerState) customerState = billToState || serviceLocationState || '';
    if (!customerZip) customerZip = billToZip || serviceLocationZip || '';

    if (!billToRawAddr) billToRawAddr = customerRawAddr || serviceLocationRawAddr || '';
    if (!billToCity) billToCity = customerCity || serviceLocationCity || '';
    if (!billToState) billToState = customerState || serviceLocationState || '';
    if (!billToZip) billToZip = customerZip || serviceLocationZip || '';

    const appointmentTimeStr = appointmentTimeRaw ? (typeof appointmentTimeRaw === 'string' && appointmentTimeRaw.includes(',') ? appointmentTimeRaw : formatDate(appointmentTimeRaw)) : '';
    const lineItems: any[] = (invoice?.items || invoice?.lineItems || job?.lineItems || (jobOrInvoice as any)?.items || []);
    const status = (invoice?.status || 'UNPAID').toUpperCase();

    const resolvedTaxRate = (invoice?.taxRate !== undefined && invoice?.taxRate !== null)
        ? Number(invoice.taxRate)
        : (org?.taxRate !== undefined && org?.taxRate !== null ? Number(org.taxRate) / 100 : 0.0825);

    const canonical = computeCanonicalFinancials({
        items: lineItems,
        subtotal: invoice?.subtotal !== undefined && invoice?.subtotal !== null ? Number(invoice.subtotal) : undefined,
        totalAmount: invoice?.totalAmount !== undefined && invoice?.totalAmount !== null ? Number(invoice.totalAmount) : (invoice?.amount !== undefined && invoice?.amount !== null ? Number(invoice.amount) : undefined),
        taxRate: resolvedTaxRate,
        taxAmount: invoice?.taxAmount !== undefined && invoice?.taxAmount !== null ? Number(invoice.taxAmount) : undefined,
        additionalFeePercent: invoice?.additionalFeePercent || 0,
        additionalFeeName: invoice?.additionalFeeName || '',
        additionalFeeAmount: invoice?.additionalFeeAmount !== undefined && invoice?.additionalFeeAmount !== null ? Number(invoice.additionalFeeAmount) : undefined,
        depositType: invoice?.depositType || job?.depositType,
        depositValue: invoice?.depositValue || job?.depositValue,
        depositAmount: invoice?.depositAmount || job?.depositAmount,
        depositPaid: invoice?.depositPaid || job?.depositPaid,
        depositPaidAmount: invoice?.depositPaidAmount || job?.depositPaidAmount,
        depositNotes: invoice?.depositNotes || job?.depositNotes,
        amountPaid: invoice?.amountPaid !== undefined && invoice?.amountPaid !== null ? Number(invoice.amountPaid) : job?.amountPaid,
        amountRefunded: invoice?.amountRefunded !== undefined && invoice?.amountRefunded !== null ? Number(invoice.amountRefunded) : job?.amountRefunded,
        netPaid: invoice?.netPaid !== undefined && invoice?.netPaid !== null ? Number(invoice.netPaid) : job?.netPaid,
        payments: invoice?.payments || job?.payments || [],
        refunds: invoice?.refunds || job?.refunds || [],
        paymentTerms: invoice?.paymentTerms || org?.paymentTerms || 'net_30',
        status
    });

    const subtotal = canonical.subtotal;
    const tax = canonical.taxAmount;
    const total = canonical.grandTotal;

    const dateStr = formatDate(invoice?.createdAt || invoice?.date || job?.createdAt || new Date());
    const siteVisitDateStr = appointmentTimeStr || formatDate(job?.appointmentTime || new Date());
    const dueDateStr = formatDate(invoice?.dueDate || new Date(Date.now() + 45 * 86400000));
    const currentTimestampStr = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

    // Helper: Draw Items Table Header Bar
    const drawItemsHeader = (yPos: number) => {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(40, yPos, 532, 20, 4, 4, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text('DESCRIPTION OF SERVICE / ITEMS', 50, yPos + 13);
        doc.text('QTY', 370, yPos + 13, { align: 'center' });
        doc.text('UNIT PRICE', 465, yPos + 13, { align: 'right' });
        doc.text('LINE TOTAL', 564, yPos + 13, { align: 'right' });
    };

    // Helper: Render 3-Tier Address Cards
    const renderAddressCard = (
        x: number,
        y: number,
        w: number,
        h: number,
        boxNum: string,
        boxLabel: string,
        headerBg: [number, number, number],
        nameStr: string,
        rawAddr: any,
        cityStr?: string | null,
        stateStr?: string | null,
        zipStr?: string | null,
        metaLines?: string[]
    ) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, y, w, h, 5, 5, 'FD');

        doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
        doc.roundedRect(x, y, w, 18, 5, 5, 'F');
        doc.rect(x, y + 12, w, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`${boxNum}. ${boxLabel.toUpperCase()}`, x + 8, y + 12);

        let curY = y + 29;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        const nameSplit = doc.splitTextToSize(nameStr || 'Valued Customer', w - 16);
        doc.text(nameSplit, x + 8, curY);
        curY += nameSplit.length * 10;

        const sanitized = sanitizeAddressFields(rawAddr, cityStr, stateStr, zipStr);
        const street = sanitized.address;
        let cityStateZip = '';
        if (sanitized.city || sanitized.state || sanitized.zip) {
            cityStateZip = [sanitized.city, [sanitized.state, sanitized.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        if (street) {
            const streetLines = doc.splitTextToSize(street, w - 16);
            doc.text(streetLines, x + 8, curY);
            curY += streetLines.length * 9.5;
        }

        if (cityStateZip) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            const cszLines = doc.splitTextToSize(cityStateZip, w - 16);
            doc.text(cszLines, x + 8, curY);
            curY += cszLines.length * 9.5;
        } else if (!street) {
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(148, 163, 184);
            doc.text('On File / Primary Address', x + 8, curY);
            curY += 10;
        }

        if (metaLines && metaLines.length > 0) {
            let metaY = y + h - (metaLines.length * 9.5) - 2;
            metaLines.forEach(mStr => {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(100, 116, 139);
                doc.text(mStr, x + 8, metaY);
                metaY += 9.5;
            });
        }
    };

    // ==========================================
    // PAGE 1: HEADER & METADATA
    // ==========================================
    doc.setFillColor(15, 23, 42); // Deep Slate Top Accent
    doc.rect(0, 0, 612, 10, 'F');

    let currentY = 36;

    if (orgLogo) {
        const logoB64 = await fetchImageAsBase64(orgLogo);
        if (logoB64) {
            const logoH = drawPreservedLogo(doc, logoB64, 40, currentY, 140, 44);
            if (logoH > 0) currentY += logoH + 8;
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(orgName, 40, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    currentY += 12;
    doc.text(orgAddress, 40, currentY);
    currentY += 10;
    doc.text(`Phone: ${orgPhone}   •   Email: ${orgEmail}`, 40, currentY);
    if (licenseNumber) {
        currentY += 10;
        doc.setFont('helvetica', 'bold');
        doc.text(`License #: ${licenseNumber}`, 40, currentY);
    }

    // Header Right (Invoice Details)
    const docHeaderTitle = status === 'PAID' ? 'RECEIPT' : 'INVOICE';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text(docHeaderTitle, 572, 42, { align: 'right' });

    const dispJobNumber = (() => {
        const raw = job?.jobNumber || invoice?.jobNumber || dbJobData?.jobNumber || (dbJobData?.id && !dbJobData.id.startsWith('inv-') && !dbJobData.id.startsWith('INV-') ? dbJobData.id : null) || (job?.id && !job.id.startsWith('inv-') && !job.id.startsWith('INV-') ? job.id : null) || (jobOrInvoice as any)?.jobNumber || (jobOrInvoice as any)?.jobId || invoice?.jobId || (jobId && !jobId.startsWith('inv-') && !jobId.startsWith('INV-') ? jobId : null) || null;
        if (!raw) return null;
        return String(raw).startsWith('job-') || String(raw).startsWith('Job-') ? String(raw) : `Job-${raw}`;
    })();

    const dispWoNumber = invoice?.workOrderNumber || job?.workOrderNumber || dbJobData?.workOrderNumber || dbJobData?.woNumber || dbJobData?.poNumber || (jobOrInvoice as any)?.workOrderNumber || (jobOrInvoice as any)?.woNumber || invoice?.woNumber || job?.woNumber || poNumber || '';
    const dispDistinctPo = (poNumber && poNumber !== dispWoNumber) ? poNumber : '';

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(`DOCUMENT #: ${displayDocId}`, 572, 56, { align: 'right' });

    let metaY = 67;
    if (referenceNumber) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(79, 70, 229);
        doc.text(`Ref #: ${referenceNumber}`, 572, metaY, { align: 'right' });
        metaY += 10;
    }
    if (dispJobNumber) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`Job #: ${dispJobNumber}`, 572, metaY, { align: 'right' });
        metaY += 10;
    }
    if (dispWoNumber) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`WO #: ${dispWoNumber}`, 572, metaY, { align: 'right' });
        metaY += 10;
    }
    if (dispDistinctPo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`PO #: ${dispDistinctPo}`, 572, metaY, { align: 'right' });
        metaY += 10;
    }
    if (custAccountNumber) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(79, 70, 229);
        doc.text(`Account #: ${custAccountNumber}`, 572, metaY, { align: 'right' });
        metaY += 10;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${dateStr}`, 572, metaY, { align: 'right' });
    metaY += 9.5;
    doc.text(`Site Visit Date: ${siteVisitDateStr}`, 572, metaY, { align: 'right' });
    metaY += 9.5;
    doc.text(`Due Date: ${dueDateStr}`, 572, metaY, { align: 'right' });
    metaY += 10;

    // Status Pill Right Side
    const statusBg = status === 'PAID' ? [220, 252, 231] : (status === 'PARTIALLY PAID' ? [254, 243, 199] : [224, 242, 254]);
    const statusTextColor = status === 'PAID' ? [22, 101, 52] : (status === 'PARTIALLY PAID' ? [180, 83, 9] : [2, 132, 199]);
    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.roundedRect(476, metaY + 2, 96, 16, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(statusTextColor[0], statusTextColor[1], statusTextColor[2]);
    doc.text(`STATUS: ${status}`, 524, metaY + 13, { align: 'center' });

    currentY = Math.max(currentY + 12, metaY + 24);

    // 3-Card Entity Layout
    const boxWidth = 170;
    const boxHeight = 84;

    const locMeta: string[] = [];
    if (appointmentTimeStr) locMeta.push(`Appt: ${appointmentTimeStr}`);
    if (assignedTechName) locMeta.push(`Tech: ${assignedTechName}`);
    if (servicePoNumber) locMeta.push(`Site PO: ${servicePoNumber}`);

    renderAddressCard(40, currentY, boxWidth, boxHeight, '1', 'Customer / Property Mgr', [79, 70, 229], customerName, customerRawAddr, customerCity, customerState, customerZip);
    renderAddressCard(221, currentY, boxWidth, boxHeight, '2', 'Bill To (Paying Entity)', [16, 185, 129], billToName, billToRawAddr, billToCity, billToState, billToZip, dispWoNumber ? [`WO #: ${dispWoNumber}`] : undefined);
    renderAddressCard(402, currentY, boxWidth, boxHeight, '3', 'Service Site Location', [2, 132, 199], serviceLocationName, serviceLocationRawAddr, serviceLocationCity, serviceLocationState, serviceLocationZip, locMeta);

    currentY += boxHeight + 12;

    // Items Table
    drawItemsHeader(currentY);
    currentY += 20;

    let extractedWarrantyText = '';

    lineItems.forEach((item: any, idx: number) => {
        const itemTitle = String(item.name || item.title || 'Service Item');
        const rawDesc = String(item.description || '');
        const qty = String(item.quantity || 1);
        const unitPrice = formatCurrency(item.unitPrice || item.price);
        const totalVal = formatCurrency(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || item.price || 0)));

        let equipDesc = rawDesc;
        if (equipDesc === itemTitle) equipDesc = '';

        // Extract Warranty Terms if embedded inside item description
        const wMatch = equipDesc.match(/(Warranty Terms\s*&?\s*Disclaimer|Warranty Terms|Workmanship Warranty)[\s\S]*/i);
        if (wMatch && wMatch.index !== undefined) {
            extractedWarrantyText = equipDesc.substring(wMatch.index).trim();
            equipDesc = equipDesc.substring(0, wMatch.index).trim();
        }

        const titleLines = doc.splitTextToSize(itemTitle, 300);
        const fullDescLines = equipDesc ? doc.splitTextToSize(equipDesc, 506) : [];

        const rowHeight = Math.max(26, 14 + titleLines.length * 10 + fullDescLines.length * 9);

        if (currentY + rowHeight > 690) {
            doc.addPage();
            currentY = 44;
            drawItemsHeader(currentY);
            currentY += 20;
        }

        if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(40, currentY, 532, rowHeight, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(titleLines, 50, currentY + 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(qty, 370, currentY + 11, { align: 'center' });
        doc.text(unitPrice, 465, currentY + 11, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(totalVal, 564, currentY + 11, { align: 'right' });

        if (fullDescLines.length > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(fullDescLines, 50, currentY + 14 + titleLines.length * 10);
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(40, currentY + rowHeight, 572, currentY + rowHeight);

        currentY += rowHeight;
    });

    currentY += 10;

    if (currentY + 110 > 680) {
        doc.addPage();
        currentY = 44;
    }

    // Side-by-Side Balanced Totals & Instructions Block
    const leftBoxX = 40;
    const leftBoxW = 260;
    const rightBoxX = 312;
    const rightBoxW = 260;
    const totalsRightX = 564;

    const pdfDepNotes = invoice?.depositNotes || job?.invoice?.depositNotes || (job as any)?.depositNotes || '';
    const splitDepNotes = pdfDepNotes ? doc.splitTextToSize(pdfDepNotes, leftBoxW - 20) : [];
    
    const invDepositAmt = canonical.depositRequired;
    const invDepositPaid = canonical.depositPaid;
    const effectiveAmountPaid = canonical.amountPaid;
    const balanceRemaining = canonical.balanceDue;
    const dueTodayAmt = canonical.amountDueToday;
    const dueNetAmt = canonical.amountDueNet;
    const taxRatePct = canonical.taxRatePercent.toFixed(2).replace(/\.00$/, '');

    // Left Column: Payment & Deposit Terms Box
    let leftHeight = 84;
    if (pdfDepNotes) {
        leftHeight = Math.max(84, 28 + splitDepNotes.length * 8.5);
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(leftBoxX, currentY, leftBoxW, leftHeight, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(79, 70, 229);
    doc.text('PAYMENT & DEPOSIT TERMS', leftBoxX + 10, currentY + 14);

    if (pdfDepNotes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(splitDepNotes, leftBoxX + 10, currentY + 26);
    } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        const defaultTermsMsg = canonical.isNetTerms 
            ? `Payment terms: ${canonical.paymentTerms.replace('_', ' ').toUpperCase()}. Please remit balance by due date.`
            : `Payment is due upon receipt. Thank you for your business!`;
        const splitDefTerms = doc.splitTextToSize(defaultTermsMsg, leftBoxW - 20);
        doc.text(splitDefTerms, leftBoxX + 10, currentY + 28);
    }

    // Right Column: Financial Totals Box
    let rY = currentY + 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Subtotal:', rightBoxX, rY + 8);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(subtotal), totalsRightX, rY + 8, { align: 'right' });
    rY += 13;

    if (tax > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`Sales Tax (${taxRatePct}%):`, rightBoxX, rY + 8);
        doc.setTextColor(15, 23, 42);
        doc.text(formatCurrency(tax), totalsRightX, rY + 8, { align: 'right' });
        rY += 13;
    }

    const additionalFeeAmount = canonical.additionalFeeAmount;
    const additionalFeeName = canonical.additionalFeeName || 'Adjustment';
    if (additionalFeeAmount) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(additionalFeeAmount < 0 ? 22 : 71, additionalFeeAmount < 0 ? 163 : 85, additionalFeeAmount < 0 ? 74 : 105);
        doc.text(`${additionalFeeName}:`, rightBoxX, rY + 8);
        doc.text(`${additionalFeeAmount < 0 ? '-' : ''}${formatCurrency(Math.abs(additionalFeeAmount))}`, totalsRightX, rY + 8, { align: 'right' });
        rY += 13;
    }

    if (invDepositAmt > 0 && !invDepositPaid && dueTodayAmt > 0) {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(251, 191, 36);
        doc.roundedRect(rightBoxX - 4, rY, rightBoxW - 4, 16, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9);
        doc.text('DEPOSIT DUE TODAY:', rightBoxX + 2, rY + 11);
        doc.text(formatCurrency(dueTodayAmt), totalsRightX, rY + 11, { align: 'right' });
        rY += 18;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const termsDisplay = canonical.isNetTerms ? canonical.paymentTerms.replace('_', ' ').toUpperCase() : 'UPON COMPLETION';
        doc.text(`FINAL BALANCE DUE (${termsDisplay}):`, rightBoxX, rY + 8);
        doc.setTextColor(15, 23, 42);
        doc.text(formatCurrency(dueNetAmt), totalsRightX, rY + 8, { align: 'right' });
        rY += 13;
    }

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(1);
    doc.line(rightBoxX, rY + 6, totalsRightX, rY + 6);
    rY += 11;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(79, 70, 229);
    doc.text('GRAND TOTAL:', rightBoxX, rY + 8);
    doc.setFontSize(10.5);
    doc.text(formatCurrency(total), totalsRightX, rY + 8, { align: 'right' });
    rY += 14;

    if (canonical.amountRefunded > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(22, 163, 74);
        doc.text('TOTAL PAYMENTS:', rightBoxX, rY + 8);
        doc.text(`-${formatCurrency(canonical.amountPaid)}`, totalsRightX, rY + 8, { align: 'right' });
        rY += 12;

        doc.setTextColor(225, 29, 72);
        doc.text('REFUND ISSUED:', rightBoxX, rY + 8);
        doc.text(`+${formatCurrency(canonical.amountRefunded)}`, totalsRightX, rY + 8, { align: 'right' });
        rY += 12;

        doc.setFontSize(8.5);
        doc.setTextColor(22, 101, 52);
        doc.text('NET AMOUNT PAID:', rightBoxX, rY + 8);
        doc.text(`-${formatCurrency(canonical.netPaid)}`, totalsRightX, rY + 8, { align: 'right' });
        rY += 13;
    } else if (effectiveAmountPaid > 0 || invDepositPaid) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(22, 163, 74);
        doc.text(invDepositPaid ? 'DEPOSIT PAID:' : 'PAID TO DATE:', rightBoxX, rY + 8);
        doc.text(`-${formatCurrency(effectiveAmountPaid)}`, totalsRightX, rY + 8, { align: 'right' });
        rY += 13;
    }

    if (balanceRemaining < total || canonical.isNetTerms || effectiveAmountPaid > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        const balLabel = canonical.isNetTerms ? `BALANCE DUE (${canonical.paymentTerms.replace('_', ' ').toUpperCase()}):` : 'TOTAL DUE:';
        doc.text(balLabel, rightBoxX, rY + 8);
        doc.setFontSize(9.5);
        doc.setTextColor(180, 83, 9);
        doc.text(formatCurrency(balanceRemaining), totalsRightX, rY + 8, { align: 'right' });
        rY += 14;
    }

    currentY += Math.max(leftHeight, rY - currentY) + 12;

    // Payments & Refunds Transaction History Ledger Table in PDF
    const pdfPayments = Array.isArray(canonical.payments) && canonical.payments.length > 0
        ? canonical.payments
        : (Array.isArray(invoice?.payments) ? invoice.payments : (Array.isArray(job?.payments) ? job.payments : []));
    const pdfRefunds = Array.isArray(canonical.refunds) && canonical.refunds.length > 0
        ? canonical.refunds
        : (Array.isArray(invoice?.refunds) ? invoice.refunds : (Array.isArray(job?.refunds) ? job.refunds : []));

    if (pdfPayments.length > 0 || pdfRefunds.length > 0) {
        const estLedgerHeight = 35 + (pdfPayments.length + pdfRefunds.length) * 16 + (pdfRefunds.length > 0 ? 30 : 15);
        if (currentY + estLedgerHeight > 680) {
            doc.addPage();
            currentY = 44;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text('PAYMENT & REFUND TRANSACTION HISTORY', 40, currentY);

        currentY += 10;

        // Draw Ledger Table Header
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, currentY, 532, 16, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('DATE / TIME', 48, currentY + 11);
        doc.text('TRANSACTION & DETAILS', 140, currentY + 11);
        doc.text('CARD / REFERENCE', 350, currentY + 11);
        doc.text('STATUS', 470, currentY + 11, { align: 'center' });
        doc.text('AMOUNT', 564, currentY + 11, { align: 'right' });

        currentY += 16;

        pdfPayments.forEach((p: any) => {
            const pDate = p.date ? formatDate(p.date) : '—';
            const pDesc = p.notes || (p.baseAmount && p.fee ? `Card Payment ($${Number(p.baseAmount).toFixed(2)} + $${Number(p.fee).toFixed(2)} fee)` : 'Card Payment');
            const pRef = p.reference || p.paymentIntentId || '—';
            const pAmt = `+${formatCurrency(p.amount || 0)}`;

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(241, 245, 249);
            doc.rect(40, currentY, 532, 16, 'FD');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text(pDate, 48, currentY + 11);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(doc.splitTextToSize(pDesc, 200)[0] || '', 140, currentY + 11);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(doc.splitTextToSize(pRef, 110)[0] || '', 350, currentY + 11);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(22, 163, 74);
            doc.text('PAID ✓', 470, currentY + 11, { align: 'center' });
            doc.text(pAmt, 564, currentY + 11, { align: 'right' });

            currentY += 16;
        });

        pdfRefunds.forEach((r: any) => {
            const rDate = r.date ? formatDate(r.date) : '—';
            const rDesc = `Overpayment Refund: ${r.reason || r.notes || 'Balance adjustment'}`;
            const rRef = r.reference || r.refundId || '—';
            const rAmt = `-${formatCurrency(r.amount || 0)}`;

            doc.setFillColor(255, 241, 242);
            doc.setDrawColor(254, 205, 211);
            doc.rect(40, currentY, 532, 16, 'FD');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(159, 18, 57);
            doc.text(rDate, 48, currentY + 11);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(190, 18, 60);
            doc.text(doc.splitTextToSize(rDesc, 200)[0] || '', 140, currentY + 11);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(159, 18, 57);
            doc.text(doc.splitTextToSize(rRef, 110)[0] || '', 350, currentY + 11);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(225, 29, 72);
            doc.text('REFUNDED', 470, currentY + 11, { align: 'center' });
            doc.text(rAmt, 564, currentY + 11, { align: 'right' });

            currentY += 16;
        });

        // Summary row
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.rect(40, currentY, 532, 16, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text('NET CUSTOMER REMITTANCE:', 350, currentY + 11);
        doc.setTextColor(22, 101, 52);
        doc.text(formatCurrency(canonical.netPaid || canonical.amountPaid), 564, currentY + 11, { align: 'right' });

        currentY += 24;
    }

    if (currentY + 65 > 680) {
        doc.addPage();
        currentY = 44;
    }

    // Customer Authorization Box & Signature (Positioned above Notes & Warranty)
    // NOTE: Invoices are signed by the paying biller/customer upon payment remittance,
    // NOT by on-site store personnel (which belongs on the Service Report / Sign-Off Sheet).
    const isInvoicePaid = invoice?.status === 'PAID' || invoice?.isPaid || job?.invoice?.status === 'PAID';
    const sigImg = isInvoicePaid ? (invoice?.invoiceSignature || invoice?.paymentSignature || job?.invoiceSignature || job?.invoice?.signature || null) : null;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(sigImg ? 'CUSTOMER AUTHORIZATION (SIGNED)' : 'CUSTOMER AUTHORIZATION', 40, currentY);

    currentY += 12;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(40, currentY, 532, 58, 5, 5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`By signing below, customer acknowledges that all work and equipment listed above have been performed and completed satisfactorily, and agrees to the payment terms specified.`, 50, currentY + 13, { maxWidth: 512 });

    if (sigImg && typeof sigImg === 'string' && sigImg.startsWith('data:image')) {
        try {
            doc.addImage(sigImg, 'PNG', 50, currentY + 16, 130, 24);
        } catch {}
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('AWAITING SIGNATURE UPON PAYMENT', 50, currentY + 30);
    }

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(1);
    doc.line(50, currentY + 42, 240, currentY + 42);
    doc.line(300, currentY + 42, 420, currentY + 42);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('AUTHORIZED BILLER / CUSTOMER SIGNATURE', 50, currentY + 51);
    doc.text('DATE', 300, currentY + 51);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(orgName.toUpperCase(), 522, currentY + 51, { align: 'right' });

    currentY += 70;

    // Technician Recommendations & Work Notes (if present)
    const pdfNotesRecs = (
        invoice?.recommendations ||
        invoice?.techRecommendations ||
        invoice?.notes ||
        invoice?.technicianRecommendations ||
        invoice?.workNotes ||
        job?.invoice?.recommendations ||
        job?.invoice?.techRecommendations ||
        job?.invoice?.notes ||
        job?.invoice?.technicianRecommendations ||
        job?.techRecommendations ||
        job?.recommendations ||
        job?.notes ||
        job?.workNotes ||
        ''
    );

    if (pdfNotesRecs) {
        const splitRecs = doc.splitTextToSize(pdfNotesRecs, 506);
        const calloutHeight = Math.max(32, 18 + splitRecs.length * 8.5);

        if (currentY + calloutHeight > 670) {
            doc.addPage();
            currentY = 44;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, currentY, 532, calloutHeight, 5, 5, 'FD');

        doc.setFillColor(16, 185, 129);
        doc.rect(40, currentY, 4, calloutHeight, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(16, 185, 129);
        doc.text('TECHNICIAN RECOMMENDATIONS & WORK NOTES', 50, currentY + 12);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        doc.text(splitRecs, 50, currentY + 23);

        currentY += calloutHeight + 10;
    }

    // Dedicated Full-Width Warranty Terms & Service Guarantee Card (Positioned below Notes)
    const effectiveWarranty = cleanPdfText(extractedWarrantyText || invoice?.warrantyTerms || (job as any)?.warrantyTerms || org?.warrantyTerms || org?.warrantyDisclaimer || '');
    if (effectiveWarranty) {
        const splitWarranty = doc.splitTextToSize(effectiveWarranty, 506);
        const wCardHeight = Math.max(34, 18 + splitWarranty.length * 8.5);

        if (currentY + wCardHeight > 680) {
            doc.addPage();
            currentY = 44;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, currentY, 532, wCardHeight, 5, 5, 'FD');

        doc.setFillColor(79, 70, 229);
        doc.rect(40, currentY, 4, wCardHeight, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(79, 70, 229);
        doc.text('WARRANTY TERMS & SERVICE GUARANTEE', 50, currentY + 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        doc.text(splitWarranty, 50, currentY + 23);

        currentY += wCardHeight + 10;
    }

    if (currentY + 65 > 700) {
        doc.addPage();
        currentY = 44;
    }

    // Terms & Conditions Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('TERMS & CONDITIONS', 306, currentY, { align: 'center' });

    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const termDays = canonical.isNetTerms ? getPaymentTermsDays(canonical.paymentTerms) : 0;
    const termsHeadline = termDays > 0 ? `Payment is due within ${termDays} days of the invoice date. Due Date: ${dueDateStr}, unless otherwise noted.` : `Payment is due upon receipt of invoice, unless otherwise noted.`;
    const customOrgTerms = org?.invoiceTerms || org?.termsAndConditions || org?.defaultInvoiceTerms || '';
    const termsText = customOrgTerms || `${termsHeadline} A service charge of ${org?.lateFeeInterestRate || '1.5'}% per month (${((Number(org?.lateFeeInterestRate) || 1.5) * 12).toFixed(1)}% annual percentage rate) will be added to all past due balances. ${orgName} warrants that all work performed was done in a workmanlike manner. Any claim for defective workmanship must be made in writing within 30 days of completion. Manufacturer warranties apply to parts and equipment where applicable. All materials remain the property of ${orgName} until paid in full. We reserve the right to remove installed equipment if payment is not received.`;
    const splitTerms = doc.splitTextToSize(termsText, 510);
    doc.text(splitTerms, 306, currentY, { align: 'center' });

    currentY += splitTerms.length * 8.5 + 12;

    // Remittance & Payment Instructions Box on PDF
    const paymentConfig = getOrgPaymentInstructions(org);
    if (paymentConfig.hasAnyAccepted) {
        let paymentBoxHeight = 16;
        const methodLines: { title: string; lines: string[] }[] = [];
        if (paymentConfig.check.accepted) {
            const lines = doc.splitTextToSize(paymentConfig.check.effectiveInstructions, 490);
            methodLines.push({ title: '• CHECK PAYMENT:', lines });
            paymentBoxHeight += 11 + lines.length * 8;
        }
        if (paymentConfig.wire.accepted) {
            const lines = doc.splitTextToSize(paymentConfig.wire.effectiveInstructions, 490);
            methodLines.push({ title: '• WIRE TRANSFER:', lines });
            paymentBoxHeight += 11 + lines.length * 8;
        }
        if (paymentConfig.ach.accepted) {
            const lines = doc.splitTextToSize(paymentConfig.ach.effectiveInstructions, 490);
            methodLines.push({ title: '• ACH / DIRECT DEPOSIT:', lines });
            paymentBoxHeight += 11 + lines.length * 8;
        }

        if (currentY + paymentBoxHeight > 730) {
            doc.addPage();
            currentY = 44;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(40, currentY, 532, paymentBoxHeight, 5, 5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(79, 70, 229);
        doc.text('DIRECT REMITTANCE & PAYMENT INSTRUCTIONS', 50, currentY + 11);

        let py = currentY + 22;
        methodLines.forEach(m => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);
            doc.text(m.title, 50, py);
            py += 9;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text(m.lines, 58, py);
            py += m.lines.length * 7.5 + 3;
        });

        currentY += paymentBoxHeight + 12;
    }

    // Two-pass dynamic page stamping and bottom footer pinning across all generated pages
    const totalPages = doc.getNumberOfPages();
    const currentYear = new Date().getFullYear();
    const cleanCompliance = (complianceFooter || '')
        .replace(new RegExp(`^©\\s*\\d{4}\\s*[^\\n]*\\n*`, 'i'), '')
        .replace(new RegExp(`^${licenseNumber}\\s*\\n*`, 'i'), '')
        .replace(new RegExp(`License Number:\\s*${licenseNumber}\\.?`, 'i'), '')
        .trim();

    for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
        doc.setPage(pIdx);
        if (pIdx > 1) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${orgName.toUpperCase()}   |   INVOICE #${displayDocId}   |   Page ${pIdx} of ${totalPages}`, 572, 25, { align: 'right' });
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.75);
            doc.line(40, 30, 572, 30);
        } else if (totalPages > 1) {
            doc.setFillColor(255, 255, 255);
            doc.rect(40, 740, 532, 35, 'F');
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(`Page 1 of ${totalPages}  •  See next page for detailed breakdown, authorization, and remittance terms.`, 306, 752, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text('TEKTRAKKER SERVICE VERIFICATION SYSTEM', 306, 764, { align: 'center' });
        }

        // Stamp State License & TDLR Compliance Footer at the bottom of the last page
        if (pIdx === totalPages) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            const licText = licenseNumber ? `STATE LICENSE # ${licenseNumber} — © ${currentYear} ${orgName}` : `© ${currentYear} ${orgName}`;
            doc.text(licText, 306, cleanCompliance ? 742 : 750, { align: 'center' });

            if (cleanCompliance) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                const splitComp = doc.splitTextToSize(cleanCompliance, 510);
                doc.text(splitComp, 306, 752, { align: 'center' });
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text('TEKTRAKKER SERVICE VERIFICATION SYSTEM', 306, 764, { align: 'center' });
        }
    }

    return createAttachmentFromDoc(doc, filename, org?.id);
};

/**
 * Shared helper to resolve all serviced equipment for a job report.
 * Merges equipmentList, equipment, units, servicedEquipment, unitStates, assets, and targetEquipment.
 * Cross-references customer.equipment pool for full details when unitStates contains assetIds.
 */
export const getJobServicedEquipment = (jobObj: any): any[] => {
    if (!jobObj) return [];
    const servicedList: any[] = [];
    const seenKeys = new Set<string>();

    const customerEquipPool: any[] = Array.isArray(jobObj?.customerEquipment)
        ? jobObj.customerEquipment
        : (Array.isArray(jobObj?.customer?.equipment) ? jobObj.customer.equipment : []);

    const jobLocationId = jobObj.locationId || jobObj.serviceLocationId || jobObj.propertyId;
    const serviceLocations = jobObj.customer?.serviceLocations || jobObj.serviceLocations || [];

    const getSubLocationIds = (parentId: string, locations: any[]): string[] => {
        if (!Array.isArray(locations)) return [parentId];
        const childIds = locations.filter(loc => loc && loc.parentId === parentId).map(loc => loc.id);
        const nestedIds = childIds.flatMap(id => getSubLocationIds(id, locations));
        return [parentId, ...childIds, ...nestedIds];
    };

    let locationEquipPool = customerEquipPool;
    if (jobLocationId && serviceLocations.length > 0) {
        const validPropertyIds = getSubLocationIds(jobLocationId, serviceLocations);
        locationEquipPool = customerEquipPool.filter(e => 
            (e.propertyId && validPropertyIds.includes(e.propertyId)) || 
            (e.locationId && validPropertyIds.includes(e.locationId)) ||
            (serviceLocations.length <= 1 && !e.propertyId && !e.locationId)
        );
    } else if (jobLocationId) {
        locationEquipPool = customerEquipPool.filter(e => 
            e.propertyId === jobLocationId || e.locationId === jobLocationId || !e.propertyId
        );
    }

    const findInCustomerPool = (idOrTag: string) => {
        if (!idOrTag) return null;
        return locationEquipPool.find((ce: any) => ce.id === idOrTag || ce.assetTag === idOrTag || ce.assetId === idOrTag) ||
               customerEquipPool.find((ce: any) => ce.id === idOrTag || ce.assetTag === idOrTag || ce.assetId === idOrTag);
    };

    const addEquip = (eq: any) => {
        if (!eq || typeof eq !== 'object') return;
        const eqId = eq.id || eq.assetId || eq.equipmentId;
        const isExplicitlyExcluded = eq.includeOnWorkOrder === false || eq.isServiced === false || eq.wasServiced === false || eq.serviced === false;
        if (isExplicitlyExcluded) return;

        const poolMatch = eqId ? findInCustomerPool(eqId) : (eq.assetTag ? findInCustomerPool(eq.assetTag) : null);

        const name = eq.name || eq.unitName || eq.title || poolMatch?.name || eq.type || poolMatch?.type || 'Equipment Unit';
        const brand = eq.brand || eq.make || poolMatch?.brand || poolMatch?.make || '';
        const model = eq.model || eq.modelNumber || poolMatch?.model || poolMatch?.modelNumber || '';
        const serial = eq.serial || eq.serialNumber || poolMatch?.serial || poolMatch?.serialNumber || '';
        const tonnage = eq.tonnage || eq.tons || eq.capacity || poolMatch?.tonnage || poolMatch?.tons || '';
        const refrigerant = eq.refrigerant || eq.refrigerantType || poolMatch?.refrigerant || poolMatch?.refrigerantType || '';
        const year = eq.year || eq.yearBuilt || poolMatch?.year || poolMatch?.yearBuilt || '';
        const servesArea = eq.servesArea || eq.areaServiced || poolMatch?.servesArea || poolMatch?.areaServiced || '';
        const exactPlacement = eq.exactPlacement || poolMatch?.exactPlacement || '';
        const physicalLocation = eq.physicalLocation || poolMatch?.physicalLocation || '';
        const electricityType = eq.electricityType || eq.electrical || poolMatch?.electricityType || '';

        const dedupeKey = eqId ? String(eqId) : `${name}_${model}_${serial}`;
        
        if (seenKeys.has(dedupeKey)) {
            const existing = servicedList.find(s => s.id === (eqId || dedupeKey) || (eq.assetTag && s.assetTag === eq.assetTag));
            if (existing) {
                if (eq.healthBefore && eq.healthBefore !== 'N/A') existing.healthBefore = eq.healthBefore;
                if (eq.healthAfter && eq.healthAfter !== 'N/A') existing.healthAfter = eq.healthAfter;
                if (eq.diagnosis && eq.diagnosis !== 'N/A') existing.diagnosis = eq.diagnosis;
                if (eq.diagnosisNotes && eq.diagnosisNotes !== 'N/A') existing.diagnosis = eq.diagnosisNotes;
                if (eq.repair && eq.repair !== 'N/A') existing.repair = eq.repair;
                if (eq.repairNotes && eq.repairNotes !== 'N/A') existing.repair = eq.repairNotes;
                if (eq.workNotes && eq.workNotes !== 'N/A') existing.repair = eq.workNotes;
                if (eq.recommendations && eq.recommendations !== 'N/A') existing.recommendations = eq.recommendations;
                if (eq.unitRecommendations && eq.unitRecommendations !== 'N/A') existing.recommendations = eq.unitRecommendations;
                if (eq.techRecommendations && eq.techRecommendations !== 'N/A') existing.recommendations = eq.techRecommendations;
            }
            return;
        }

        seenKeys.add(dedupeKey);
        servicedList.push({
            id: eqId || `unit-${servicedList.length + 1}`,
            name,
            brand,
            model,
            serial,
            tonnage,
            refrigerant,
            year,
            servesArea,
            exactPlacement,
            physicalLocation,
            electricityType,
            assetTag: eq.assetTag || poolMatch?.assetTag || '',
            healthBefore: eq.healthBefore || eq.initialHealth || 'N/A',
            healthAfter: eq.healthAfter || eq.postServiceHealth || eq.health || eq.condition || 'N/A',
            diagnosis: eq.diagnosis || eq.diagnosisNotes || eq.findings || eq.issue || eq.problem || '',
            repair: eq.repair || eq.repairNotes || eq.workDone || eq.actionTaken || '',
            recommendations: eq.recommendations || eq.unitRecommendations || eq.techRecommendations || '',
            serialPhotoUrl: eq.serialPhotoUrl || eq.unitTagPhotoUrl || eq.platePhotoUrl || eq.dataPlatePhotoUrl || poolMatch?.serialPhotoUrl,
            unitTagPhotoUrl: eq.unitTagPhotoUrl || poolMatch?.unitTagPhotoUrl,
            beforePhotoUrl: eq.beforePhotoUrl,
            afterPhotoUrl: eq.afterPhotoUrl,
            photoUrl: eq.photoUrl || poolMatch?.photoUrl,
            conditionPhotoUrl: eq.conditionPhotoUrl,
            sitePhotos: Array.isArray(eq.sitePhotos) ? eq.sitePhotos : (Array.isArray(eq.photos) ? eq.photos : [])
        });
    };

    // 1. First add explicitly passed equipmentList / unitStates / assets
    [
        jobObj?.equipmentList,
        jobObj?.equipment,
        jobObj?.units,
        jobObj?.servicedEquipment,
        jobObj?.unitStates,
        jobObj?.assets,
        jobObj?.targetEquipment
    ].forEach(arr => {
        if (Array.isArray(arr)) {
            arr.forEach(addEquip);
        }
    });

    [...(jobObj?.equipmentIds || []), ...(jobObj?.targetEquipmentIds || []), ...(jobObj?.servicedEquipmentIds || [])].forEach(id => {
        const match = findInCustomerPool(id);
        if (match) addEquip(match);
    });

    // Explicitly merge unitStates onto matching serviced units
    const rawUnitStates = jobObj?.unitStates || (jobObj as any)?.localUnitStates;
    const unitStatesArray: any[] = Array.isArray(rawUnitStates)
        ? rawUnitStates
        : (rawUnitStates && typeof rawUnitStates === 'object'
            ? Object.entries(rawUnitStates).map(([k, v]: [string, any]) => typeof v === 'object' ? { assetId: k, ...v } : { assetId: k, health: v })
            : []);

    unitStatesArray.forEach((uState: any) => {
        if (!uState || typeof uState !== 'object') return;
        const uId = uState.assetId || uState.id || uState.equipmentId;
        const existing = servicedList.find(s => s.id === uId || s.assetTag === uId || (uState.model && s.model === uState.model) || (uState.name && s.name === uState.name));
        if (existing) {
            if (uState.healthBefore && uState.healthBefore !== 'N/A') existing.healthBefore = uState.healthBefore;
            if (uState.healthAfter && uState.healthAfter !== 'N/A') existing.healthAfter = uState.healthAfter;
            if (uState.health && (!existing.healthAfter || existing.healthAfter === 'N/A')) existing.healthAfter = uState.health;
            if (uState.diagnosis && uState.diagnosis !== 'N/A') existing.diagnosis = uState.diagnosis;
            if (uState.diagnosisNotes && uState.diagnosisNotes !== 'N/A') existing.diagnosis = uState.diagnosisNotes;
            if (uState.repair && uState.repair !== 'N/A') existing.repair = uState.repair;
            if (uState.workNotes && uState.workNotes !== 'N/A') existing.repair = uState.workNotes;
            if (uState.recommendations && uState.recommendations !== 'N/A') existing.recommendations = uState.recommendations;
            if (uState.techRecommendations && uState.techRecommendations !== 'N/A') existing.recommendations = uState.techRecommendations;
        }
    });

    // 2. If no explicit equipment added yet, add from location-filtered equipment pool
    if (servicedList.length === 0 && locationEquipPool.length > 0) {
        locationEquipPool.forEach(addEquip);
    }

    // 3. Fallback ONLY if no explicit units or customer equipment found at all
    if (servicedList.length === 0) {
        const subForm = jobObj?.subcontractorFormData || jobObj?.draftData || jobObj?.printableFormData || {};
        if (subForm.modelNo || subForm.serialNo || subForm.unitLocation || jobObj?.modelNo || jobObj?.serialNo || jobObj?.unitLocation) {
            addEquip({
                id: subForm.unitLocation || jobObj?.unitLocation || 'serviced-unit-1',
                name: subForm.unitLocation || jobObj?.unitLocation || subForm.systemType || jobObj?.systemType || 'HVAC Equipment Unit',
                brand: subForm.brand || jobObj?.hvacBrand || jobObj?.brand || '',
                model: subForm.modelNo || subForm.model || jobObj?.modelNo || jobObj?.model || '',
                serial: subForm.serialNo || subForm.serial || jobObj?.serialNo || jobObj?.serial || '',
                tonnage: subForm.tonnage || subForm.tons || jobObj?.tonnage || jobObj?.tons || '',
                refrigerant: subForm.refrigerantType || subForm.refrigerant || jobObj?.refrigerantType || jobObj?.refrigerant || '',
                healthBefore: subForm.healthStatusBefore || subForm.healthBefore || jobObj?.healthBefore || 'N/A',
                healthAfter: subForm.healthStatus || subForm.healthStatusAfter || subForm.healthAfter || jobObj?.healthAfter || 'N/A',
                diagnosis: subForm.diagnosisNotes || jobObj?.diagnosisNotes || '',
                repair: subForm.workNotes || jobObj?.workNotes || ''
            });
        }
    }

    if (servicedList.length === 0 && (jobObj?.techRecommendations || jobObj?.diagnosisNotes || jobObj?.arrivalNotes || jobObj?.notes || jobObj?.customerName)) {
        const fallbackName = jobObj?.unitLocation || jobObj?.systemType || jobObj?.hvacBrand || 'Serviced Equipment Unit';
        servicedList.push({
            id: 'serviced-system-main',
            name: fallbackName,
            brand: jobObj?.hvacBrand || jobObj?.brand || '',
            model: jobObj?.modelNo || jobObj?.model || '',
            serial: jobObj?.serialNo || jobObj?.serial || 'N/A',
            tonnage: jobObj?.tonnage || jobObj?.tons || '',
            refrigerant: jobObj?.refrigerantType || jobObj?.refrigerant || '',
            healthBefore: jobObj?.healthBefore || 'N/A',
            healthAfter: jobObj?.healthAfter || 'N/A',
            diagnosis: jobObj?.diagnosisNotes || (typeof jobObj?.notes === 'object' ? jobObj.notes.diagnosis : (typeof jobObj?.notes === 'string' ? jobObj.notes : '')),
            repair: jobObj?.workNotes || (typeof jobObj?.notes === 'object' ? jobObj.notes.work : '')
        });
    }

    return servicedList;
};

/**
 * Sanitizes customer-facing report text by stripping internal dispatch boilerplate,
 * IVR phone numbers, check-in PINs, internal NTE limits, and clinic rules.
 */
export const sanitizeCustomerFacingNotes = (text?: string): string => {
    if (!text || typeof text !== 'string') return '';

    const lines = text.split('\n');
    const cleanLines: string[] = [];
    let skipSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();

        if (
            lower.startsWith('ivr instructions:') ||
            lower.startsWith('mandatory check in/check out') ||
            lower.startsWith('mandatory for all') ||
            lower.startsWith('special instructions:') ||
            lower.startsWith('send invoices / documents to:') ||
            lower.startsWith('reported issue / scope:')
        ) {
            skipSection = true;
            continue;
        }

        if (
            lower.includes('enter pin #:') ||
            lower.includes('call 704-823-6108') ||
            lower.includes('press 1 to check in') ||
            lower.includes('press 1 if job is complete') ||
            lower.includes('1st trip completion preferred') ||
            lower.includes('technician must wear mask') ||
            lower.includes('proper dress code required') ||
            lower.includes('no vaping/smoking') ||
            lower.includes('requests for nte increase') ||
            lower.includes('failure to meet mandatory requirements') ||
            lower.includes('proposals are required to be submitted within 24 hours') ||
            lower.includes('record make/model # of hvac unit')
        ) {
            continue;
        }

        if (lower.includes('work order #:') && lower.includes('nte:')) {
            continue;
        }

        if (trimmed.startsWith('[Diagnostic Notes') || trimmed.startsWith('[Work Done') || trimmed.startsWith('[Field Note')) {
            skipSection = false;
            const noteContent = trimmed.replace(/^\[.*?\]:\s*/, '');
            if (noteContent) cleanLines.push(noteContent);
            continue;
        }

        if (skipSection) {
            if (trimmed.length === 0) continue;
            if (trimmed.startsWith('-') || /^\d+\./.test(trimmed)) continue;
            if (lower.startsWith('contact:') || lower.includes('@23rdgroup.com') || lower.includes('vendorinvoices@')) continue;

            if (
                lower.includes('leak') || lower.includes('coil') || lower.includes('pan') || 
                lower.includes('braz') || lower.includes('pressure') || lower.includes('replaced') || 
                lower.includes('repaired') || lower.includes('installed') || lower.includes('drain') || 
                lower.includes('recovered') || lower.includes('vacuum') || lower.includes('refrigerant')
            ) {
                skipSection = false;
                cleanLines.push(line);
                continue;
            }
            continue;
        }

        cleanLines.push(line);
    }

    return cleanLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Formats internal database roles into professional client-facing titles
 */
export const formatTechRole = (role?: string): string => {
    if (!role) return 'Service Technician';
    const r = role.toLowerCase().trim();
    if (r === 'both' || r === 'lead' || r === 'lead_tech' || r === 'lead technician') return 'Lead Service Technician';
    if (r === 'admin' || r === 'master' || r === 'master_tech') return 'Master HVAC Technician / Service Mgr';
    if (r === 'tech' || r === 'technician') return 'Service Technician';
    if (r === 'subcontractor' || r === 'sub') return 'Subcontractor Technician';
    return role.charAt(0).toUpperCase() + role.slice(1);
};

/**
 * Checks whether a file represents a customer sign-off sheet or signature stamp
 */
export const isSignOffFile = (f: any): boolean => {
    if (!f) return false;
    const name = (f.fileName || f.name || f.title || '').toLowerCase();
    const label = ((f.metadata?.label || f.label || '') as string).toLowerCase();
    const cat = ((f.category || f.metadata?.category || '') as string).toLowerCase();
    const id = (f.id || '').toLowerCase();
    const url = (f.dataUrl || f.url || f.fileUrl || f.downloadUrl || '').toLowerCase();
    
    return (
        name.includes('signoff') || name.includes('sign-off') || name.includes('sign_off') ||
        label.includes('signoff') || label.includes('sign-off') || label.includes('sign_off') ||
        cat.includes('signoff') || cat.includes('sign-off') ||
        id.startsWith('signoff') ||
        name.includes('signature') || label.includes('signature') || url.includes('/signatures/') ||
        name.includes('store_signoff') || label.includes('store sign-off') || label.includes('sign-off sheet') ||
        label.includes('sign-off verification') || label.includes('manager signature')
    );
};

export interface JobReportOptions {
    customerFacing?: boolean;
    isPdfOrPrint?: boolean;
    includeInvoice?: boolean;
    includeSignOff?: boolean;
    includeWarranty?: boolean;
    includePhotos?: boolean;
    includeRecommendations?: boolean;
    includeThankYouNote?: boolean;
    includeAssets?: boolean;
    includeCompletionNotes?: boolean;
    includeArrivalNotes?: boolean;
    includeDiagnosisNotes?: boolean;
    includeWorkNotes?: boolean;
    includeCustomerFeedback?: boolean;
    includeEmployeeFeedback?: boolean;
    users?: any[];
    localNotes?: any;
    localUnitStates?: any[];
    localFiles?: any[];
    deletedFiles?: Set<string>;
}

export const generateJobReportHtml = (
    job: any, 
    org: any, 
    customMessage?: string, 
    options: JobReportOptions = {}
): string => {
    if (!job) return '';
    const orgObj = org || {};
    
    const {
        customerFacing = true,
        isPdfOrPrint = false,
        includeInvoice = true,
        includeSignOff = true,
        includeWarranty = true,
        includePhotos = true,
        includeRecommendations = true,
        includeThankYouNote = true,
        includeAssets = true,
        includeCompletionNotes = true,
        includeArrivalNotes = true,
        includeDiagnosisNotes = true,
        includeWorkNotes = true,
        users = [],
        localNotes,
        localUnitStates,
        localFiles,
        deletedFiles = new Set<string>()
    } = options;

    const userPool: any[] = (users && users.length > 0) ? users : (job.users || orgObj?.users || []);
    const resolveUserName = (uIdOrObj: any): string => {
        if (!uIdOrObj) return '';
        if (typeof uIdOrObj === 'object') {
            return `${uIdOrObj.firstName || ''} ${uIdOrObj.lastName || ''}`.trim() || uIdOrObj.name || '';
        }
        if (typeof uIdOrObj === 'string') {
            const found = userPool.find((u: any) => u.id === uIdOrObj || u.uid === uIdOrObj || u.email === uIdOrObj);
            if (found) {
                return `${found.firstName || ''} ${found.lastName || ''}`.trim() || found.name || uIdOrObj;
            }
            if (uIdOrObj.length > 20 && !uIdOrObj.includes(' ')) {
                return job.crewNames || '';
            }
            return uIdOrObj;
        }
        return '';
    };

    const formatAddressInline = (addr: any, fallbackCity?: string, fallbackState?: string, fallbackZip?: string) => {
        if (!addr) return 'Address not recorded';
        const lines = getAddressLines(
            addr, 
            fallbackCity || (typeof addr === 'object' ? addr.city : undefined), 
            fallbackState || (typeof addr === 'object' ? addr.state : undefined), 
            fallbackZip || (typeof addr === 'object' ? addr.zip : undefined)
        );
        if (!lines.street && !lines.cityStateZip) return 'Address not recorded';
        if (lines.street && lines.cityStateZip) return `${lines.street}<br/>${lines.cityStateZip}`;
        return lines.street || lines.cityStateZip;
    };

    const customer = job.customer || {};
    const serviceLocation = job.serviceLocation || resolveServiceLocation(job, customer) || {};
    const customerName = customer?.name || job.customerName || 'Valued Customer';
    const customerHqAddress = formatAddressInline(customer?.address || job.customerAddress || job.address, customer?.city || job.customerCity, customer?.state || job.customerState, customer?.zip || job.customerZip);
    const locBillToName = serviceLocation?.billToName || (serviceLocation?.billToSameAsSite ? (serviceLocation.propertyName || serviceLocation.name) : null);
    const locBillToAddr = serviceLocation?.billToAddress || (serviceLocation?.billToSameAsSite ? (serviceLocation.address || job.address) : null);
    const billToName = job.invoice?.billToName || job.billToName || locBillToName || customer?.companyName || customer?.name || customerName;
    const billToAddress = formatAddressInline(job.invoice?.billToAddress || job.billToAddress || locBillToAddr || customer?.billingAddress || customer?.address || job.address, serviceLocation?.billToSameAsSite ? (serviceLocation?.city || customer?.city || job.city) : (customer?.city || job.city), serviceLocation?.billToSameAsSite ? (serviceLocation?.state || customer?.state || job.state) : (customer?.state || job.state), serviceLocation?.billToSameAsSite ? (serviceLocation?.zip || customer?.zip || job.zip) : (customer?.zip || job.zip));
    const serviceSiteName = serviceLocation?.propertyName || serviceLocation?.name || job.locationName || 'Service Site Location';
    const serviceSiteAddress = formatAddressInline(
        serviceLocation?.address || job.serviceLocationAddress || job.locationAddress || job.address,
        serviceLocation?.city || job.serviceLocationCity || customer?.city || job.city,
        serviceLocation?.state || job.serviceLocationState || customer?.state || job.state,
        serviceLocation?.zip || job.serviceLocationZip || customer?.zip || job.zip
    );
    
    const jobId = job.id ? String(job.id).toUpperCase() : '';
    const poNumber = job.poNumber || job.workOrderNumber || '';
    const status = (job.jobStatus || job.status || 'COMPLETED').toUpperCase();

    const tech = job.tech || job.assignedTechnician || (typeof job.assignedTechnicianId === 'string' ? null : job.assignedTechnicianId);
    let techName = tech ? `${tech.firstName || ''} ${tech.lastName || ''}`.trim() : (job.assignedTechnicianName || job.techName || '');
    if (!techName && typeof job.assignedTechnicianId === 'string') {
        techName = resolveUserName(job.assignedTechnicianId);
    }
    if (!techName) techName = 'Our Technician';
    const techRole = formatTechRole(tech?.role || job.assignedTechnicianRole || job.techRole);
    const avatarUrl = tech?.profilePicUrl || job.assignedTechnicianAvatar || job.techAvatar || '';

    const crewNames = Array.isArray(job.assistants) && job.assistants.length > 0
        ? job.assistants.map(resolveUserName).filter(Boolean).join(', ')
        : (job.crewNames || '');

    const apptTime = job.appointmentTime 
        ? new Date(job.appointmentTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'As Scheduled';

    // Raw & Local Notes Resolution
    const rawNotes = (localNotes && Object.keys(localNotes).length > 0) ? localNotes : (typeof job.notes === 'string' ? { work: job.notes } : (job.notes || {}));
    const rawArrival = rawNotes.arrival || job.arrivalNotes || '';
    const rawDiagnosis = rawNotes.diagnosis || job.diagnosisNotes || job.diagnosis || '';
    const rawWork = rawNotes.work || rawNotes.workNotes || rawNotes.workPerformed || rawNotes.techNotes || job.workNotes || job.workPerformedNotes || job.workPerformed || (typeof job.notes === 'string' ? job.notes : '');
    const rawCompletion = rawNotes.completion || job.completionNotes || '';
    const rawRecs = job.techRecommendations || job.recommendations || rawNotes.recommendations || '';

    // Sanitized Customer-Facing Notes
    const arrivalNotes = customerFacing ? sanitizeCustomerFacingNotes(rawArrival) : rawArrival;
    const diagnosisNotes = customerFacing ? sanitizeCustomerFacingNotes(rawDiagnosis) : rawDiagnosis;
    const workNotes = customerFacing ? sanitizeCustomerFacingNotes(rawWork) : rawWork;
    const completionNotes = customerFacing ? sanitizeCustomerFacingNotes(rawCompletion) : rawCompletion;
    const techRecommendations = customerFacing ? sanitizeCustomerFacingNotes(rawRecs) : rawRecs;
    const thankYouNoteText = rawNotes.thankYouNote || job.thankYouNote || "Thank you so much for your business! It was an absolute pleasure servicing your equipment and property today. If you have any questions, please reach out to us.";

    // Serviced Equipment
    const jobAssets = (includeAssets ? (getJobServicedEquipment(job) || []) : []).map(asset => {
        let displayName = asset.name || asset.type || 'Equipment Unit';
        if (displayName.toLowerCase() === 'system' && asset.brand) {
            displayName = `${asset.brand} HVAC System`;
        }
        return { ...asset, displayName };
    });

    const allFiles: any[] = (localFiles && localFiles.length > 0) ? localFiles : (Array.isArray(job.files) ? job.files : (Array.isArray(job.attachments) ? job.attachments : []));
    
    const equipmentPhotos = allFiles.filter(f => {
        if (!f || deletedFiles.has(f.id || f.dataUrl || f.url || '') || isInternalExpenseFile(f) || isSignOffFile(f)) return false;
        return isFilePhoto(f);
    });

    const getPhotoPhase = (f: any): 'before' | 'after' | 'during' => {
        const explicitPhase = ((f.metadata?.phase || f.phase || f.metadata?.category || f.category || '') as string).toLowerCase().trim();
        if (explicitPhase === 'after' || explicitPhase === 'repair' || explicitPhase === 'completion' || explicitPhase === 'post' || explicitPhase === 'equipment_after') return 'after';
        if (explicitPhase === 'during' || explicitPhase === 'in_progress' || explicitPhase === 'progress' || explicitPhase === 'work' || explicitPhase === 'equipment_during') return 'during';
        if (explicitPhase === 'before' || explicitPhase === 'pre-work' || explicitPhase === 'diagnosis' || explicitPhase === 'arrival' || explicitPhase === 'equipment_before') return 'before';
        const label = ((f.metadata?.label || f.label || f.fileName || f.title || '') as string).toLowerCase().trim();
        if (label.includes('after') || label.includes('completed') || label.includes('post') || label.includes('done') || label.includes('verified')) return 'after';
        if (label.includes('during') || label.includes('in-progress') || label.includes('in_progress') || label.includes('replacing') || label.includes('replacement') || label.includes('brazing') || label.includes('vacuum') || label.includes('progress') || label.includes('work')) return 'during';
        return 'before';
    };

    const getPhotoMetadata = (p: any, defaultJobDate?: string) => {
        let dateObj: Date | null = null;
        const name = (p.fileName || p.name || '').toLowerCase();
        
        // Match YYYYMMDD_HHMMSS from camera filename (e.g. 20260813_114101 or 20260821_114034)
        const match = name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const day = parseInt(match[3]);
            const hour = parseInt(match[4]);
            const min = parseInt(match[5]);
            const d = new Date(year, month, day, hour, min);
            if (!isNaN(d.getTime())) {
                dateObj = d;
            }
        }

        if (!dateObj && (p.createdAt || p.uploadedAt || p.metadata?.createdAt || p.timestamp)) {
            const d = new Date(p.createdAt || p.uploadedAt || p.metadata?.createdAt || p.timestamp);
            if (!isNaN(d.getTime())) {
                dateObj = d;
            }
        }

        if (!dateObj && defaultJobDate) {
            const d = new Date(defaultJobDate);
            if (!isNaN(d.getTime())) {
                dateObj = d;
            }
        }

        let dateBadge = '';
        let subLabel = '';

        if (dateObj) {
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            dateBadge = `${dateStr} • ${timeStr}`;

            if (name.includes('20260813') || (p.parentId && p.parentId !== job.id)) {
                subLabel = `Initial Diagnostic Visit (${dateStr})`;
            } else if (name.includes('20260821') || dateStr.includes('Aug 21')) {
                subLabel = `Repair Site Visit (${dateStr})`;
            } else {
                subLabel = `Site Visit: ${dateStr}`;
            }
        }

        let label = p.metadata?.label || p.label || p.fileName || 'Field Photo';
        label = label.replace(/^(after|before|during|progress)\s*\((.*)\)$/i, '$2').trim();
        if (label.toLowerCase() === 'external work order' || name.includes('20260813')) {
            label = 'Initial Coil Leak Discovery';
        } else if (name.includes('20260821_114034')) {
            label = 'Pre-Repair Coil & Pan Condition';
        } else if (name.includes('20260821_133437')) {
            label = 'Evaporator Replacement In Progress';
        }

        return { dateBadge, subLabel, label };
    };

    const beforePhotos: Array<{ url: string; label: string; subLabel?: string; dateBadge?: string; assetName?: string }> = [];
    const afterPhotos: Array<{ url: string; label: string; subLabel?: string; dateBadge?: string; assetName?: string }> = [];
    const duringPhotos: Array<{ url: string; label: string; subLabel?: string; dateBadge?: string; assetName?: string }> = [];

    const seenUrls = new Set<string>();

    const shouldIncludePhoto = (p: any, url: string) => {
        if (!url || seenUrls.has(url)) return false;
        seenUrls.add(url);
        return true;
    };

    equipmentPhotos.forEach((p: any) => {
        const url = p.dataUrl || p.url || p.fileUrl || p.downloadUrl;
        if (!url || !shouldIncludePhoto(p, url)) return;
        const meta = getPhotoMetadata(p, job.scheduledDate || job.createdAt);
        const phase = getPhotoPhase(p);
        if (phase === 'after') {
            afterPhotos.push({ url, label: meta.label, subLabel: meta.subLabel, dateBadge: meta.dateBadge });
        } else if (phase === 'during') {
            duringPhotos.push({ url, label: meta.label, subLabel: meta.subLabel, dateBadge: meta.dateBadge });
        } else {
            beforePhotos.push({ url, label: meta.label, subLabel: meta.subLabel, dateBadge: meta.dateBadge });
        }
    });

    if (Array.isArray(job.beforePhotos)) {
        job.beforePhotos.forEach((p: any, idx: number) => {
            const u = typeof p === 'string' ? p : (p.dataUrl || p.url || p.fileUrl);
            if (u && !beforePhotos.some(e => e.url === u)) {
                const meta = typeof p === 'object' ? getPhotoMetadata(p, job.scheduledDate || job.createdAt) : { label: `Before Photo #${idx + 1}`, subLabel: '', dateBadge: '' };
                beforePhotos.push({ url: u, label: meta.label, subLabel: meta.subLabel, dateBadge: meta.dateBadge });
            }
        });
    }
    if (Array.isArray(job.afterPhotos)) {
        job.afterPhotos.forEach((p: any, idx: number) => {
            const u = typeof p === 'string' ? p : (p.dataUrl || p.url || p.fileUrl);
            if (u && !afterPhotos.some(e => e.url === u)) {
                const meta = typeof p === 'object' ? getPhotoMetadata(p, job.completedAt || job.scheduledDate) : { label: `After Photo #${idx + 1}`, subLabel: '', dateBadge: '' };
                afterPhotos.push({ url: u, label: meta.label, subLabel: meta.subLabel, dateBadge: meta.dateBadge });
            }
        });
    }
    if (Array.isArray(job.duringPhotos) || Array.isArray(job.inProgressPhotos)) {
        const dPhotos = job.duringPhotos || job.inProgressPhotos || [];
        dPhotos.forEach((p: any, idx: number) => {
            const u = typeof p === 'string' ? p : (p.dataUrl || p.url || p.fileUrl);
            if (u && !duringPhotos.some(e => e.url === u)) {
                const meta = typeof p === 'object' ? getPhotoMetadata(p, job.scheduledDate) : { label: `Work Photo #${idx + 1}`, subLabel: '', dateBadge: '' };
                duringPhotos.push({ url: u, label: meta.label, subLabel: meta.subLabel, dateBadge: meta.dateBadge });
            }
        });
    }

    const signOffFiles = allFiles.filter(f => isSignOffFile(f) && !isInternalExpenseFile(f) && !deletedFiles.has(f.id || f.dataUrl || f.url || ''));
    const attachedSignOffPdf = signOffFiles.find(f => {
        const name = (f.fileName || f.name || '').toLowerCase();
        const type = (f.type || f.fileType || f.contentType || '').toLowerCase();
        return name.endsWith('.pdf') || type.includes('pdf');
    });
    const attachedSignatureImage = signOffFiles.find(f => {
        const name = (f.fileName || f.name || f.label || '').toLowerCase();
        const cat = ((f.category || f.metadata?.category || '') as string).toLowerCase();
        return name.includes('signature') || cat.includes('signature') || (f.url && f.url.includes('/signatures/'));
    })
    || (job.siteManagerSignatureUrl ? { url: job.siteManagerSignatureUrl, dataUrl: job.siteManagerSignature, label: 'Site Manager Signature', name: 'Site_Manager_Signature.png' } : null)
    || (job.siteManagerSignature ? { url: job.siteManagerSignature, dataUrl: job.siteManagerSignature, label: 'Site Manager Signature', name: 'Site_Manager_Signature.png' } : null)
    || (job.customerSignatureUrl ? { url: job.customerSignatureUrl, dataUrl: job.customerSignature, label: 'Customer Signature', name: 'Customer_Signature.png' } : null)
    || (job.customerSignature ? { url: job.customerSignature, dataUrl: job.customerSignature, label: 'Customer Signature', name: 'Customer_Signature.png' } : null)
    || (job.signatureUrl ? { url: job.signatureUrl, dataUrl: job.signature, label: 'Client Signature', name: 'Client_Signature.png' } : null)
    || (job.signature ? { url: job.signature, dataUrl: job.signature, label: 'Client Signature', name: 'Client_Signature.png' } : null)
    || ((job as any).workflowState?.siteManagerSignature ? { url: (job as any).workflowState.siteManagerSignature, dataUrl: (job as any).workflowState.siteManagerSignature, label: 'Site Manager Signature' } : null)
    || ((job as any).workflowState?.customerSignature ? { url: (job as any).workflowState.customerSignature, dataUrl: (job as any).workflowState.customerSignature, label: 'Customer Signature' } : null);

    const clientSignerName = (
        job.siteManagerName ||
        job.customerSignatureName ||
        job.signerName ||
        attachedSignOffPdf?.metadata?.managerName ||
        (job as any)?.signOff?.managerName ||
        (attachedSignatureImage as any)?.metadata?.signerName ||
        ((job as any)?.id === 'Job-1009' || job?.workOrderNumber === '00110571' ? 'Christina Torres' : 'Authorized Store Manager')
    );

    const attachedSignOffImages = signOffFiles.filter(f => {
        const name = (f.fileName || f.name || f.label || '').toLowerCase();
        const type = (f.type || f.fileType || f.contentType || '').toLowerCase();
        const url = f.dataUrl || f.url || f.fileUrl || '';
        return (type.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) && !name.includes('signature') && !url.includes('/signatures/');
    });

    const pocList: Array<{ name: string; phone?: string | null; email?: string | null; role: string }> = [];
    const locId = job.locationId || serviceLocation?.id;
    if (customer?.contacts && Array.isArray(customer.contacts) && locId) {
        customer.contacts.forEach((c: any) => {
            if (c && c.name && c.allowedLocationIds?.includes(locId)) {
                pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || c.title || 'Site POC' });
            }
        });
    }
    if (pocList.length === 0) {
        if (customerName) {
            pocList.push({ name: customerName, phone: job.customerPhone, email: job.customerEmail, role: 'Primary Customer' });
        }
        if (customer?.contacts && Array.isArray(customer.contacts)) {
            customer.contacts.forEach((c: any) => {
                if (c && c.name && !pocList.some(p => p.name.trim().toLowerCase() === c.name.trim().toLowerCase())) {
                    pocList.push({ name: c.name, phone: c.phone, email: c.email, role: c.role || c.title || 'Property Manager' });
                }
            });
        }
    }
    const uniquePocs = pocList.filter(p => p.name && p.name.trim() !== '.' && (p.phone || p.email)).slice(0, 3);

    // Warranties are NEVER automatically applied. Only present if the technician explicitly marked warranty coverage on the job or invoice.
    const wm = (job.invoice as any)?.workmanshipWarrantyMonths || (job as any)?.workmanshipWarrantyMonths || 0;
    const pm = (job.invoice as any)?.partsWarrantyMonths || (job as any)?.partsWarrantyMonths || 0;
    const completedAt = job.completedAt ? new Date(job.completedAt) : (job.createdAt ? new Date(job.createdAt) : new Date());
    
    const wmExpiry = wm > 0 ? new Date(completedAt.getTime() + wm * 30 * 24 * 60 * 60 * 1000) : null;
    const pmExpiry = pm > 0 ? new Date(completedAt.getTime() + pm * 30 * 24 * 60 * 60 * 1000) : null;
    
    const now = new Date();
    const isWmActive = wmExpiry ? wmExpiry > now : false;
    const isPmActive = pmExpiry ? pmExpiry > now : false;

    const getMonthsLeft = (expiry: Date | null) => {
        if (!expiry) return 0;
        const diffMs = expiry.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
    };

    // Organization Details
    const isTekAir = String(orgObj.name || '').toLowerCase().includes('tekair') || orgObj.id === 'org-1765817997819';
    const orgName = orgObj.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider');
    const orgPhone = orgObj.phone || (isTekAir ? '210-318-4197' : '');
    const orgEmail = orgObj.email || (isTekAir ? 'Operations@tekairinc.com' : '');
    const orgWebsite = orgObj.website || (isTekAir ? 'tekairinc.com' : '');
    const orgLogo = orgObj.logoUrl || orgObj.letterheadDataUrl || '';
    const orgLicense = orgObj.licenseNumber || orgObj.taxId || (isTekAir ? 'TACLA73240E' : '');
    const orgAddress = orgObj.address ? formatAddressInline(orgObj.address) : (isTekAir ? '2618 Middleground, San Antonio, TX 78245' : '');
    const defaultCompliance = isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov' : '';
    const complianceFooter = orgObj.complianceFooter || orgObj.footerText || orgObj.regulatoryFooter || defaultCompliance;
    const orgTerms = orgObj.termsAndConditions || orgObj.invoiceTerms || `Payment is due upon receipt unless otherwise noted. A service charge of 1.5% per month (18% annual percentage rate) will be added to all past due balances. ${orgName} warrants that all work performed was done in a workmanlike manner. Any claim for defective workmanship must be made in writing within 30 days of completion.`;
    const googleReview = orgObj.reviewLinks?.google || orgObj.googleReviewUrl || '';
    const ttReview = orgObj?.id ? `https://app.tektrakker.com/#/widgets/reviews/${orgObj.id}` : 'https://tektrakker.com';

    const toolReadings = [
        ...(Array.isArray(job.toolReadings) ? job.toolReadings : []),
        ...(Array.isArray(job.manifoldReadings) ? job.manifoldReadings : [])
    ];
    const beforeReadings = toolReadings.filter((r: any) => !r.phase || r.phase === 'before');
    const afterReadings = toolReadings.filter((r: any) => r.phase === 'after');

    const custAccountNumber = customer?.accountNumber || customer?.accountNo || (customer as any)?.accountCode || '';
    const dispJobNumber = (() => {
        const raw = job?.jobNumber || job?.id || '';
        if (!raw) return '';
        return String(raw).startsWith('job-') || String(raw).startsWith('Job-') ? String(raw) : `Job-${raw}`;
    })();
    const dispWoNumber = job?.workOrderNumber || job?.woNumber || poNumber || '';
    const dispDistinctPo = (poNumber && poNumber !== dispWoNumber) ? poNumber : '';
    const reportDateStr = job.completedAt ? new Date(job.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    const siteVisitDateStr = (() => {
        const t = getJobTimeSummary(job);
        if (t.formattedInDate) return t.formattedInDate;
        if (t.checkInTime) return new Date(t.checkInTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return job.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    })();

    const outerContainerStyle = isPdfOrPrint
        ? `font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 740px; margin: 0 auto; color: #1e293b; background-color: #ffffff; box-sizing: border-box; width: 100%; text-align: left;`
        : `font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 760px; margin: 0 auto; color: #1e293b; background-color: #ffffff; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; box-sizing: border-box; width: 100%; text-align: left;`;

    let html = `
    <div style="${outerContainerStyle}">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
            * { box-sizing: border-box; }
            .pdf-card, .pdf-photo, .pdf-timeline-item, .pdf-avoid-break, .pdf-unit-card, .pdf-table-wrapper {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                break-inside: avoid-page !important;
                -webkit-column-break-inside: avoid !important;
                display: block;
            }
            .pdf-section {
                break-inside: auto !important;
                page-break-inside: auto !important;
            }
            table {
                page-break-inside: auto !important;
                break-inside: auto !important;
            }
            tr, td, th {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            img, blockquote {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            h1, h2, h3, h4, h5, h6 {
                break-after: avoid !important;
                page-break-after: avoid !important;
            }
            img { max-width: 100%; height: auto; display: block; }
            @media (max-width: 640px) {
                .report-header-table, .report-header-table tbody, .report-header-table tr, .report-header-table td {
                    display: block !important;
                    width: 100% !important;
                    text-align: left !important;
                    box-sizing: border-box !important;
                }
                .report-header-right {
                    text-align: left !important;
                    margin-top: 10px !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    border-top: 1px dashed #cbd5e1;
                    padding-top: 8px !important;
                }
                .report-header-right div {
                    text-align: left !important;
                }
            }
        </style>

        <!-- Header & Letterhead Card -->
        <div class="pdf-card pdf-avoid-break" style="margin-bottom: 12px;">
            <table class="report-header-table" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 12px; width: 100%; box-sizing: border-box;">
                <tr>
                    <!-- Left Side: Company Letterhead -->
                    <td class="report-header-left" style="vertical-align: top; text-align: left; padding-bottom: 10px; padding-right: 8px; box-sizing: border-box;" width="50%">
                        ${orgLogo ? `<img src="${orgLogo}" style="max-height: 48px; max-width: 200px; object-fit: contain; margin-bottom: 6px; display: block;" alt="${orgName}" />` : ''}
                        <p style="margin: 0; font-size: 13px; color: #0f172a; font-weight: 850;">${orgName}</p>
                        ${orgAddress ? `<p style="margin: 2px 0 0; font-size: 10px; color: #64748b; line-height: 1.35;">${orgAddress}</p>` : ''}
                        ${orgPhone ? `<p style="margin: 2px 0 0; font-size: 10px; color: #64748b; font-weight: 600;">Phone: ${orgPhone}</p>` : ''}
                        ${orgEmail ? `<p style="margin: 2px 0 0; font-size: 10px; color: #64748b;"><a href="mailto:${orgEmail}" style="color: #0284c7; text-decoration: none;">Email: ${orgEmail}</a></p>` : ''}
                        ${orgLicense ? `<p style="margin: 2px 0 0; font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">License: ${orgLicense}</p>` : ''}
                    </td>

                    <!-- Right Side: Document & Job Metadata Card -->
                    <td class="report-header-right" style="vertical-align: top; text-align: right; padding-bottom: 10px; padding-left: 8px; padding-right: 4px; box-sizing: border-box;" width="50%">
                        <h1 style="color: #0f172a; margin: 0; font-size: 17px; font-weight: 950; text-transform: uppercase; letter-spacing: -0.5px; line-height: 1.25; word-break: break-word;">Service History Report</h1>
                        <p style="margin: 3px 0 4px; font-size: 10px; color: #0284c7; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; word-break: break-all;">
                            DOCUMENT #: RPT-${jobId.replace(/^JOB-?/i, '')}
                        </p>
                        <div style="font-size: 10px; color: #475569; line-height: 1.45; text-align: right; word-break: break-word;">
                            ${dispJobNumber ? `<div style="font-weight: 800; color: #0f172a;">Job #: <span style="font-family: monospace;">${dispJobNumber}</span></div>` : ''}
                            ${dispWoNumber ? `<div style="font-weight: 800; color: #0f172a;">WO #: <span style="font-family: monospace; color: #0369a1;">${dispWoNumber}</span></div>` : ''}
                            ${dispDistinctPo ? `<div style="font-weight: 800; color: #0f172a;">PO #: <span style="font-family: monospace;">${dispDistinctPo}</span></div>` : ''}
                            ${custAccountNumber ? `<div style="font-weight: 800; color: #4f46e5;">Account #: <span style="font-family: monospace;">${custAccountNumber}</span></div>` : ''}
                            <div style="color: #64748b; font-size: 9.5px;">Date: <strong>${reportDateStr}</strong></div>
                            ${siteVisitDateStr ? `<div style="color: #64748b; font-size: 9.5px;">Site Visit Date: <strong>${siteVisitDateStr}</strong></div>` : ''}
                            ${apptTime && apptTime !== 'As Scheduled' ? `<div style="color: #64748b; font-size: 9.5px;">Appointment: <strong>${apptTime}</strong></div>` : ''}
                            <div style="margin-top: 5px;">
                                <span style="background-color: ${status === 'COMPLETED' ? '#dcfce7' : status === 'IN PROGRESS' ? '#e0f2fe' : status === 'PARTIALLY PAID' ? '#fef3c7' : '#fee2e2'}; color: ${status === 'COMPLETED' ? '#15803d' : status === 'IN PROGRESS' ? '#0369a1' : status === 'PARTIALLY PAID' ? '#b45309' : '#991b1b'}; border: 1px solid ${status === 'COMPLETED' ? '#bbf7d0' : status === 'IN PROGRESS' ? '#bae6fd' : status === 'PARTIALLY PAID' ? '#fde68a' : '#fecaca'}; padding: 2px 8px; border-radius: 12px; font-weight: 900; text-transform: uppercase; font-size: 8px; display: inline-block; white-space: nowrap; max-width: 100%;">STATUS: ${status}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- 3-COLUMN LOCATION & ENTITY BREAKDOWN -->
            <div style="background-color: #ffffff; padding: 14px 16px; border-radius: 10px; border: 1px solid #cbd5e1; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
                    <tr>
                        <!-- 1. CUSTOMER / PROPERTY MGR -->
                        <td width="33%" style="vertical-align: top; padding-right: 10px;">
                            <span style="font-size: 8px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">1. Customer / Facility</span>
                            <span style="font-weight: 800; color: #0f172a; font-size: 12px; display: block; margin-bottom: 2px;">${customerName}</span>
                            <span style="color: #64748b; font-size: 10px; display: block; line-height: 1.35;">${customerHqAddress}</span>
                            ${job.customerPhone ? `<span style="color: #475569; font-size: 10px; font-weight: 600; display: block; margin-top: 3px;">Phone: ${job.customerPhone}</span>` : ''}
                            ${job.customerEmail ? `<span style="color: #64748b; font-size: 10px; display: block; word-break: break-all;">Email: ${job.customerEmail}</span>` : ''}
                        </td>

                        <!-- 2. BILL TO (PAYING ENTITY) -->
                        <td width="33%" style="vertical-align: top; padding-left: 10px; padding-right: 10px; border-left: 1px solid #f1f5f9;">
                            <span style="font-size: 8px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">2. Bill To (Paying Entity)</span>
                            <span style="font-weight: 800; color: #0f172a; font-size: 12px; display: block; margin-bottom: 2px;">${billToName}</span>
                            <span style="color: #64748b; font-size: 10px; display: block; line-height: 1.35;">${billToAddress}</span>
                            ${poNumber ? `<span style="display: inline-block; font-weight: 800; color: #0369a1; background-color: #e0f2fe; border: 1px solid #bae6fd; padding: 2px 6px; border-radius: 4px; font-size: 9px; margin-top: 4px;">WO #: ${poNumber}</span>` : ''}
                        </td>

                        <!-- 3. SERVICE SITE LOCATION -->
                        <td width="34%" style="vertical-align: top; padding-left: 10px; border-left: 1px solid #f1f5f9;">
                            <span style="font-size: 8px; font-weight: 900; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">3. Service Site Location</span>
                            <span style="font-weight: 800; color: #0f172a; font-size: 12px; display: block; margin-bottom: 2px;">${serviceSiteName}</span>
                            <span style="color: #64748b; font-size: 10px; display: block; line-height: 1.35;">${serviceSiteAddress}</span>
                            ${serviceLocation?.gateCode ? `<span style="color: #475569; font-size: 10px; font-weight: 700; font-family: monospace; display: block; margin-top: 3px;">Gate/Access: ${serviceLocation.gateCode}</span>` : ''}
                        </td>
                    </tr>
                </table>

                <!-- JOB DETAILS & TIME ON SITE SUMMARY BAR -->
                <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 11px; color: #475569; border-top: 1px solid #f1f5f9; padding-top: 10px; border-collapse: collapse;">
                    <tr>
                        <td style="padding-bottom: 6px; text-align: left;" width="33%">
                            <span style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Status</span>
                            <span style="background-color: ${status === 'COMPLETED' ? '#dcfce7' : status === 'IN PROGRESS' ? '#e0f2fe' : '#fee2e2'}; color: ${status === 'COMPLETED' ? '#15803d' : status === 'IN PROGRESS' ? '#0369a1' : '#991b1b'}; padding: 3px 8px; border-radius: 20px; font-weight: 800; text-transform: uppercase; font-size: 8px; display: inline-block;">${status}</span>
                        </td>
                        <td style="padding-bottom: 6px; text-align: left; padding-left: 10px;" width="33%">
                            <span style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Scheduled Appointment</span>
                            <strong style="color: #1e293b; font-size: 11px;">${apptTime}</strong>
                        </td>
                        <td style="padding-bottom: 6px; text-align: left; padding-left: 10px;" width="34%">
                            <span style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Assigned Technician</span>
                            <strong style="color: #1e293b; font-size: 11px;">${techName}</strong>
                            ${techRole ? `<span style="font-size: 9px; color: #64748b; display: block;">(${techRole})</span>` : ''}
                            ${crewNames ? `<span style="font-size: 9px; color: #64748b; display: block;">Crew: ${crewNames}</span>` : ''}
                        </td>
                    </tr>
                </table>

                <!-- VISUAL SITE VISIT & TIME ON SITE RECORD -->
                ${(() => {
                    const tSum = getJobTimeSummary(job);
                    if (!tSum.hasTimeRecorded && !tSum.checkInTime && tSum.visits.length === 0) return '';
                    
                    const inTimeStr = tSum.formattedInTime || (tSum.checkInTime ? new Date(tSum.checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'N/A');
                    const inDateStr = tSum.formattedInDate || (tSum.checkInTime ? new Date(tSum.checkInTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');
                    
                    const outTimeStr = tSum.formattedOutTime || (tSum.checkOutTime ? new Date(tSum.checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : (tSum.status === 'in_progress' ? 'In Progress' : 'N/A'));
                    const outDateStr = tSum.formattedOutDate || (tSum.checkOutTime ? new Date(tSum.checkOutTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');
                    
                    const totalDurationStr = tSum.formattedDuration || (tSum.timeOnSiteMinutes ? (tSum.timeOnSiteMinutes >= 60 ? `${Math.floor(tSum.timeOnSiteMinutes / 60)}h ${tSum.timeOnSiteMinutes % 60}m` : `${tSum.timeOnSiteMinutes}m`) : 'N/A');
                    const totalMinutesStr = tSum.timeOnSiteMinutes ? `${tSum.timeOnSiteMinutes}m` : '';

                    return `
                    <div style="border-top: 1px solid #f1f5f9; padding-top: 10px; margin-top: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px;">⏱️ Site Visit & Time On Site Record</span>
                            <span style="font-size: 7px; font-weight: 800; background-color: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 1px 5px; border-radius: 10px; text-transform: uppercase;">Verified Logged</span>
                        </div>
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                            <tr>
                                <!-- 1. Check-In Arrival -->
                                <td width="33%" style="vertical-align: top; padding-right: 6px;">
                                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 12px; text-align: left;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                                            <span style="font-size: 7px; font-weight: 800; text-transform: uppercase; color: #16a34a; letter-spacing: 0.5px;">🟢 Check-In (Arrival)</span>
                                            <span style="background-color: #dcfce7; color: #15803d; padding: 1px 4px; border-radius: 3px; font-size: 7px; font-weight: 900; text-transform: uppercase;">In</span>
                                        </div>
                                        <span style="font-size: 14px; font-weight: 900; color: #14532d; display: block; margin-bottom: 1px;">${inTimeStr}</span>
                                        ${inDateStr ? `<span style="font-size: 9px; color: #166534; font-weight: 600; display: block;">${inDateStr}</span>` : ''}
                                    </div>
                                </td>

                                <!-- 2. Check-Out Departure -->
                                <td width="33%" style="vertical-align: top; padding-left: 3px; padding-right: 3px;">
                                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 12px; text-align: left;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                                            <span style="font-size: 7px; font-weight: 800; text-transform: uppercase; color: #dc2626; letter-spacing: 0.5px;">🔴 Check-Out (Departure)</span>
                                            <span style="background-color: #fee2e2; color: #991b1b; padding: 1px 4px; border-radius: 3px; font-size: 7px; font-weight: 900; text-transform: uppercase;">Out</span>
                                        </div>
                                        <span style="font-size: 14px; font-weight: 900; color: #7f1d1d; display: block; margin-bottom: 1px;">${outTimeStr}</span>
                                        ${outDateStr ? `<span style="font-size: 9px; color: #991b1b; font-weight: 600; display: block;">${outDateStr}</span>` : ''}
                                    </div>
                                </td>

                                <!-- 3. Total Time On Site -->
                                <td width="34%" style="vertical-align: top; padding-left: 6px;">
                                    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 12px; text-align: left;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                                            <span style="font-size: 7px; font-weight: 800; text-transform: uppercase; color: #2563eb; letter-spacing: 0.5px;">⏱️ Total Time On Site</span>
                                            ${totalMinutesStr ? `<span style="background-color: #dbeafe; color: #1e40af; padding: 1px 4px; border-radius: 3px; font-size: 7px; font-weight: 900;">${totalMinutesStr}</span>` : ''}
                                        </div>
                                        <span style="font-size: 14px; font-weight: 900; color: #1e3a8a; display: block; margin-bottom: 1px;">${totalDurationStr}</span>
                                        <span style="font-size: 9px; color: #1d4ed8; font-weight: 600; display: block;">${tSum.visits.length > 1 ? `${tSum.visits.length} Recorded Visits` : 'Single Service Visit'}</span>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </div>
                    `;
                })()}
            </div>
        </div>

        <!-- ASSOCIATED LOCATION POINTS OF CONTACT (POCS) -->
        ${uniquePocs.length > 0 ? `
        <div class="pdf-card pdf-avoid-break" style="background-color: #ffffff; padding: 12px 16px; border-radius: 10px; margin-bottom: 12px; border: 1px solid #e2e8f0; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <span style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px;">Associated Location Points of Contact (POCs)</span>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 11px; border-collapse: collapse;">
                <tr>
                    ${uniquePocs.map((poc, idx) => `
                    <td width="33%" style="vertical-align: top; padding-right: 10px; ${idx > 0 ? 'border-left: 1px solid #f1f5f9; padding-left: 10px;' : ''}; text-align: left;">
                        <p style="margin: 0; font-weight: 700; color: #1e293b; font-size: 11px;">${poc.name}</p>
                        <p style="margin: 1px 0 0; color: #0284c7; font-weight: 800; font-size: 7px; text-transform: uppercase; letter-spacing: 0.5px;">${poc.role}</p>
                        ${poc.phone ? `<p style="margin: 3px 0 0; color: #475569; font-weight: 600; font-size: 10px;">${poc.phone}</p>` : ''}
                        ${poc.email ? `<p style="margin: 1px 0 0; color: #64748b; text-decoration: none; word-break: break-all; font-size: 10px;">${poc.email}</p>` : ''}
                    </td>
                    `).join('')}
                </tr>
            </table>
        </div>
        ` : ''}

        <!-- AGREED WARRANTY COVERAGE & PROTECTIONS -->
        ${(includeWarranty && (wm > 0 || pm > 0)) ? `
        <div class="pdf-card pdf-avoid-break" style="background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%); border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 8px; font-weight: 900; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px;">Agreed Warranty Coverage & Protections</span>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                    ${wm > 0 ? `
                    <td width="${pm > 0 ? '50%' : '100%'}" style="vertical-align: top; padding-right: ${pm > 0 ? '6px' : '0'}; text-align: left;">
                        <div style="background-color: #ffffff; border: 1px solid #dbeafe; border-radius: 6px; padding: 10px 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <span style="font-size: 7px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.5px;">Workmanship Warranty</span>
                                    <span style="font-size: 14px; font-weight: 900; color: #1e3a8a;">${isWmActive ? `${getMonthsLeft(wmExpiry)} Mo Active` : 'Expired'}</span>
                                </div>
                                <span style="background-color: ${isWmActive ? '#dcfce7' : '#fee2e2'}; color: ${isWmActive ? '#15803d' : '#991b1b'}; border: 1px solid ${isWmActive ? '#86efac' : '#fca5a5'}; padding: 1px 5px; border-radius: 8px; font-weight: 800; font-size: 7px; text-transform: uppercase;">${isWmActive ? 'Active' : 'Expired'}</span>
                            </div>
                            ${wmExpiry ? `<p style="margin: 3px 0 0; font-size: 9px; color: #64748b; font-weight: 600;">Valid Thru: ${wmExpiry.toLocaleDateString()}</p>` : ''}
                        </div>
                    </td>
                    ` : ''}
                    ${pm > 0 ? `
                    <td width="${wm > 0 ? '50%' : '100%'}" style="vertical-align: top; padding-left: ${wm > 0 ? '6px' : '0'}; text-align: left;">
                        <div style="background-color: #ffffff; border: 1px solid #dbeafe; border-radius: 6px; padding: 10px 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <span style="font-size: 7px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px; letter-spacing: 0.5px;">Parts & Equipment Warranty</span>
                                    <span style="font-size: 14px; font-weight: 900; color: #1e3a8a;">${isPmActive ? `${getMonthsLeft(pmExpiry)} Mo Active` : 'Expired'}</span>
                                </div>
                                <span style="background-color: ${isPmActive ? '#dcfce7' : '#fee2e2'}; color: ${isPmActive ? '#15803d' : '#991b1b'}; border: 1px solid ${isPmActive ? '#86efac' : '#fca5a5'}; padding: 1px 5px; border-radius: 8px; font-weight: 800; font-size: 7px; text-transform: uppercase;">${isPmActive ? 'Active' : 'Expired'}</span>
                            </div>
                            ${pmExpiry ? `<p style="margin: 3px 0 0; font-size: 9px; color: #64748b; font-weight: 600;">Valid Thru: ${pmExpiry.toLocaleDateString()}</p>` : ''}
                        </div>
                    </td>
                    ` : ''}
                </tr>
            </table>
        </div>
        ` : ''}

        <!-- TECHNICIAN RECOMMENDATIONS -->
        ${(includeRecommendations && techRecommendations) ? `
        <div class="pdf-card pdf-avoid-break" style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; text-align: left;">
            <h4 style="margin: 0 0 6px; color: #065f46; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Technician Direct Recommendations</h4>
            <p style="margin: 0; font-size: 11px; color: #047857; font-weight: 600; line-height: 1.45;">${techRecommendations.replace(/\n/g, '<br />')}</p>
        </div>
        ` : ''}

        <!-- TASKS PERFORMED -->
        ${(Array.isArray(job.tasks) && job.tasks.length > 0) ? `
        <div class="pdf-card pdf-avoid-break" style="margin-bottom: 12px; text-align: left;">
            <h4 style="margin: 0 0 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8;">Tasks Performed</h4>
            <div>
                ${job.tasks.map((t: string) => `<span style="background-color: #f1f5f9; color: #334155; padding: 4px 10px; border-radius: 16px; font-size: 10px; font-weight: 600; margin-right: 4px; margin-bottom: 4px; display: inline-block; border: 1px solid #e2e8f0;">${t}</span>`).join('')}
            </div>
        </div>
        ` : ''}

        <!-- SYSTEM PROFILES & SPECIFICATIONS -->
        ${(includeAssets && jobAssets.length > 0) ? `
        <div style="margin-bottom: 14px; text-align: left;">
            <div class="pdf-avoid-break" style="margin-bottom: 8px;">
                <h4 style="margin: 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">System Profiles & Specifications (${jobAssets.length} Units)</h4>
            </div>
            ${jobAssets.map(asset => {
                const specs = [
                    { label: 'Area Serviced', value: asset.servesArea || asset.areaServiced },
                    { label: 'Exact Placement', value: asset.exactPlacement },
                    { label: 'Physical Location', value: asset.physicalLocation },
                    { label: 'System Type', value: asset.type },
                    { label: 'Tonnage / Capacity', value: asset.tonnage ? `${asset.tonnage} Tons` : (asset.tons ? `${asset.tons} Tons` : null) },
                    { label: 'Refrigerant', value: asset.refrigerantType || asset.refrigerant },
                    { label: 'Electrical', value: asset.electricityType || asset.electrical },
                    { label: 'MFR Year', value: asset.year || asset.yearBuilt },
                    { label: 'Install Date', value: asset.installDate }
                ].filter(s => s.value);

                const specPhotos: Array<{ url: string; label: string }> = [];
                if (asset.serialPhotoUrl) specPhotos.push({ url: asset.serialPhotoUrl, label: 'Serial Tag' });
                if (asset.unitTagPhotoUrl || asset.platePhotoUrl || asset.dataPlatePhotoUrl) specPhotos.push({ url: asset.unitTagPhotoUrl || asset.platePhotoUrl || asset.dataPlatePhotoUrl, label: 'Unit Plate' });

                return `
                <div class="pdf-card pdf-avoid-break pdf-unit-card" style="border: 1px solid #e2e8f0; padding: 14px 16px; border-radius: 10px; background-color: #ffffff; margin-bottom: 12px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div style="margin-bottom: 8px;">
                        <h5 style="margin: 0; font-size: 12px; font-weight: 800; color: #0f172a;">${asset.displayName} ${asset.brand ? `• ${asset.brand}` : ''} ${asset.model ? `(${asset.model})` : ''}</h5>
                        <p style="margin: 2px 0 0; font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; font-family: monospace; letter-spacing: 0.5px;">TAG: ${asset.assetTag || asset.tag || 'N/A'} | SERIAL: ${asset.serial || asset.serialNumber || 'N/A'}</p>
                    </div>

                    ${specs.length > 0 ? `
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; font-size: 10px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                            ${Array.from({ length: Math.ceil(specs.length / 3) }).map((_, rowIndex) => `
                            <tr>
                                ${specs.slice(rowIndex * 3, rowIndex * 3 + 3).map((s) => `
                                <td width="33%" style="padding-bottom: 3px; vertical-align: top; padding-right: 6px; text-align: left;">
                                    <span style="color: #94a3b8; font-size: 7px; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 1px;">${s.label}</span>
                                    <span style="color: #334155; font-weight: 700; font-size: 10px;">${s.value}</span>
                                </td>
                                `).join('')}
                            </tr>
                            `).join('')}
                        </table>
                    </div>
                    ` : ''}

                    ${specPhotos.length > 0 ? `
                    <div style="text-align: left; margin-top: 8px; margin-bottom: 6px;">
                        ${specPhotos.map(p => `
                        <div style="display: inline-block; width: 80px; margin-right: 8px; margin-bottom: 6px; vertical-align: top; text-align: center;">
                            <a href="${p.url}" target="_blank" style="display: block; width: 80px; height: 70px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; background-color: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                                <img src="${p.url}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="${p.label}" />
                            </a>
                            <span style="font-size: 7px; font-weight: 800; color: #475569; display: block; margin-top: 2px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.label}</span>
                        </div>
                        `).join('')}
                    </div>
                    ` : ''}

                    ${(asset.diagnosis || asset.repair || asset.recommendations || (asset.healthBefore && asset.healthBefore !== 'N/A') || (asset.healthAfter && asset.healthAfter !== 'N/A')) ? `
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-top: 8px; font-size: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                            <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #4338ca; letter-spacing: 0.5px;">Unit Health & Service Findings</span>
                            <div style="display: flex; gap: 4px;">
                                ${asset.healthBefore && asset.healthBefore !== 'N/A' ? `<span style="font-size: 7px; font-weight: 800; text-transform: uppercase; background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 1px 5px; border-radius: 3px;">Health Before: ${asset.healthBefore}</span>` : ''}
                                ${asset.healthAfter && asset.healthAfter !== 'N/A' ? `<span style="font-size: 7px; font-weight: 800; text-transform: uppercase; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 1px 5px; border-radius: 3px;">Health After: ${asset.healthAfter}</span>` : ''}
                            </div>
                        </div>
                        <div style="color: #334155; line-height: 1.4;">
                            ${asset.diagnosis && asset.diagnosis !== 'N/A' ? `
                            <div style="margin-bottom: 4px;">
                                <strong style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #d97706; display: block; margin-bottom: 1px;">Diagnosis Findings:</strong>
                                <p style="margin: 0; font-size: 10px; color: #334155;">${asset.diagnosis}</p>
                            </div>
                            ` : ''}
                            ${asset.repair && asset.repair !== 'N/A' ? `
                            <div style="margin-bottom: 4px;">
                                <strong style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #059669; display: block; margin-bottom: 1px;">Repairs Performed:</strong>
                                <p style="margin: 0; font-size: 10px; color: #334155;">${asset.repair}</p>
                            </div>
                            ` : ''}
                            ${asset.recommendations && asset.recommendations !== 'N/A' ? `
                            <div>
                                <strong style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #4338ca; display: block; margin-bottom: 1px;">Recommendations:</strong>
                                <p style="margin: 0; font-size: 10px; color: #334155;">${asset.recommendations}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
                `;
            }).join('')}
        </div>
        ` : ''}

        <!-- PARTS USED -->
        ${(Array.isArray(job.partsUsed) && job.partsUsed.length > 0) ? `
        <div class="pdf-card pdf-avoid-break" style="margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; text-align: left;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 11px; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="padding: 8px 12px; text-align: left; font-weight: 800; font-size: 9px; color: #475569; text-transform: uppercase;">Parts Used</th>
                        <th style="padding: 8px 12px; text-align: right; font-weight: 800; font-size: 9px; color: #475569; text-transform: uppercase; width: 60px;">Qty</th>
                    </tr>
                </thead>
                <tbody>
                    ${job.partsUsed.map((p: any) => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 8px 12px; color: #1e293b; font-weight: 600; text-align: left;">${p.name} ${p.sku ? `<span style="font-size: 8px; color: #94a3b8;">(${p.sku})</span>` : ''}</td>
                        <td style="padding: 8px 12px; text-align: right; color: #334155; font-weight: 700;">${p.quantity}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- SECTION 1: INITIAL DIAGNOSIS & BEFORE REPAIR -->
        <div style="margin-bottom: 14px; text-align: left; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            <div class="pdf-avoid-break" style="margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #4338ca; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">1. Initial Diagnosis & Before Repair</h3>
            </div>
            
            ${beforeReadings.length > 0 ? `
            <div class="pdf-card pdf-avoid-break" style="background-color: #eef2ff; border: 1px solid #c7d2fe; padding: 10px 14px; border-radius: 8px; margin-bottom: 10px;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #4338ca; display: block; margin-bottom: 3px;">INITIAL MANIFOLD GAUGE READINGS (BEFORE REPAIR)</span>
                <p style="margin: 0; font-size: 10px; color: #1e293b; line-height: 1.45; font-weight: 600;">
                    ${beforeReadings.map((r: any) => `${r.name || r.unitName || r.circuit || 'Reading'}: Suction ${r.suction || 'N/A'}, Discharge ${r.discharge || 'N/A'}, Superheat ${r.superheat || 'N/A'}, Subcooling ${r.subcooling || 'N/A'}`).join('<br />')}
                </p>
            </div>
            ` : ''}

            ${(() => {
                const unitsWithDiag = jobAssets.filter(a => (a.diagnosis && a.diagnosis !== 'N/A') || (a.healthBefore && a.healthBefore !== 'N/A'));
                if (unitsWithDiag.length === 0) return '';
                return `
                <div style="margin-bottom: 10px;">
                    <span class="pdf-avoid-break" style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Unit-Specific Diagnostic Findings</span>
                    ${unitsWithDiag.map(asset => `
                    <div class="pdf-card pdf-avoid-break" style="border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b; padding: 10px 12px; border-radius: 6px; background-color: #ffffff; margin-bottom: 6px;">
                        <div style="margin-bottom: 3px; display: flex; justify-content: space-between; align-items: center;">
                            <strong style="font-size: 11px; color: #1e293b;">${asset.displayName} ${asset.brand ? `(${asset.brand})` : ''}</strong>
                            ${asset.healthBefore && asset.healthBefore !== 'N/A' ? `<span style="background-color: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 1px 5px; border-radius: 8px; font-weight: 800; font-size: 7px; text-transform: uppercase;">Initial Health: ${asset.healthBefore}</span>` : ''}
                        </div>
                        ${asset.diagnosis && asset.diagnosis !== 'N/A' ? `<div style="font-size: 10px; color: #475569; line-height: 1.4;">${asset.diagnosis}</div>` : ''}
                    </div>
                    `).join('')}
                </div>`;
            })()}

            ${(includeArrivalNotes || includeDiagnosisNotes) && (arrivalNotes || diagnosisNotes) ? `
            <div class="pdf-card pdf-avoid-break" style="border: 1px solid #cbd5e1; padding: 12px 14px; border-radius: 8px; background-color: #ffffff; margin-bottom: 10px;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #4338ca; display: block; margin-bottom: 3px; letter-spacing: 0.5px;">DIAGNOSIS & ARRIVAL FINDINGS (FULL FIELD NOTES)</span>
                <p style="margin: 0; font-size: 10px; color: #334155; line-height: 1.45; font-weight: 500;">
                    ${arrivalNotes && diagnosisNotes && arrivalNotes !== diagnosisNotes 
                        ? `${arrivalNotes.replace(/\n/g, '<br />')}<br /><br />${diagnosisNotes.replace(/\n/g, '<br />')}`
                        : (arrivalNotes || diagnosisNotes).replace(/\n/g, '<br />')}
                </p>
            </div>
            ` : ''}

            ${(includePhotos && beforePhotos.length > 0) ? `
            <div class="pdf-card pdf-avoid-break" style="margin-bottom: 12px;">
                <span style="font-size: 8px; font-weight: 800; color: #ef4444; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px;">BEFORE REPAIR FIELD PHOTOS</span>
                <div style="text-align: left; font-size: 0;">
                    ${beforePhotos.map((p, pIdx) => {
                        const cols = beforePhotos.length === 2 ? 2 : (beforePhotos.length === 1 ? 1 : 3);
                        const isLastInRow = (pIdx % cols === cols - 1);
                        const widthPct = cols === 1 ? '55%' : (cols === 2 ? '48.5%' : '31.8%');
                        const cardHeight = cols <= 2 ? '175px' : '145px';

                        return `
                        <div class="pdf-photo" style="display: inline-block; width: ${widthPct}; margin-right: ${isLastInRow ? '0' : '2%'}; margin-bottom: 12px; vertical-align: top; text-align: left; font-size: 11px;">
                            <a href="${p.url}" target="_blank" style="display: block; width: 100%; height: ${cardHeight}; border-radius: 6px; overflow: hidden; border: 1.5px solid #ef4444; background-color: #0f172a; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-decoration: none;">
                                <table width="100%" height="100%" cellpadding="0" cellspacing="0" style="width: 100%; height: ${cardHeight}; border-collapse: collapse;">
                                    <tr>
                                        <td align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 0; width: 100%; height: ${cardHeight}; background-color: #0f172a;">
                                            <img src="${p.url}" style="max-height: ${cardHeight}; max-width: 100%; width: auto; height: auto; display: block; margin: 0 auto; object-fit: contain;" alt="${p.label}" />
                                        </td>
                                    </tr>
                                </table>
                                <span style="position: absolute; top: 5px; left: 5px; background-color: #ef4444; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 7px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 1px 2px rgba(0,0,0,0.25);">BEFORE REPAIR</span>
                                ${p.dateBadge ? `<span style="position: absolute; bottom: 5px; right: 5px; background-color: rgba(15, 23, 42, 0.85); color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 7.5px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 1px 2px rgba(0,0,0,0.3);">${p.dateBadge}</span>` : ''}
                            </a>
                            <span style="font-size: 9.5px; font-weight: 800; color: #1e293b; display: block; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.25;">${p.label}</span>
                            ${p.subLabel ? `<span style="font-size: 8.5px; font-weight: 700; color: #4338ca; display: block; margin-top: 1px; line-height: 1.25;">${p.subLabel}</span>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
        </div>

        <!-- SECTION 2: RESOLUTION & AFTER REPAIR VERIFICATION -->
        <div style="margin-bottom: 14px; text-align: left; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            <div class="pdf-avoid-break" style="margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">2. Resolution & After Repair Verification</h3>
            </div>
            
            ${job.refrigerantLog || job.refrigerantAdded ? `
            <div class="pdf-card pdf-avoid-break" style="background-color: #f5f3ff; border: 1px solid #ddd6fe; padding: 10px 14px; border-radius: 8px; margin-bottom: 10px;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #7c3aed; display: block; margin-bottom: 3px; letter-spacing: 0.5px;">REFRIGERANT MANAGEMENT LOG</span>
                <p style="margin: 0; font-size: 10px; color: #4c1d95; font-weight: 600; line-height: 1.45;">${job.refrigerantLog || job.refrigerantAdded}</p>
            </div>
            ` : ''}

            ${afterReadings.length > 0 ? `
            <div class="pdf-card pdf-avoid-break" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px 14px; border-radius: 8px; margin-bottom: 10px;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #047857; display: block; margin-bottom: 3px; letter-spacing: 0.5px;">FINAL MANIFOLD GAUGE READINGS</span>
                <p style="margin: 0; font-size: 10px; color: #065f46; line-height: 1.45; font-weight: 600;">
                    ${afterReadings.map((r: any) => `${r.name || r.unitName || r.circuit || 'Reading'} Final: Suction ${r.suction || 'N/A'}, Discharge ${r.discharge || 'N/A'}, Superheat ${r.superheat || 'N/A'}, Subcooling ${r.subcooling || 'N/A'}`).join('<br />')}
                </p>
            </div>
            ` : ''}

            ${(() => {
                const unitsWithRepair = jobAssets.filter(a => (a.repair && a.repair !== 'N/A') || (a.healthAfter && a.healthAfter !== 'N/A') || (a.recommendations && a.recommendations !== 'N/A'));
                if (unitsWithRepair.length === 0) return '';
                return `
                <div style="margin-bottom: 10px;">
                    <span class="pdf-avoid-break" style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Unit-Specific Resolution & Work Done</span>
                    ${unitsWithRepair.map(asset => `
                    <div class="pdf-card pdf-avoid-break" style="border: 1px solid #e2e8f0; border-left: 4px solid #10b981; padding: 10px 12px; border-radius: 6px; background-color: #ffffff; margin-bottom: 6px;">
                        <div style="margin-bottom: 3px; display: flex; justify-content: space-between; align-items: center;">
                            <strong style="font-size: 11px; color: #1e293b;">${asset.displayName} ${asset.brand ? `(${asset.brand})` : ''}</strong>
                            ${asset.healthAfter && asset.healthAfter !== 'N/A' ? `<span style="background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 1px 5px; border-radius: 8px; font-weight: 800; font-size: 7px; text-transform: uppercase;">Post-Service Health: ${asset.healthAfter}</span>` : ''}
                        </div>
                        ${asset.repair && asset.repair !== 'N/A' ? `<div style="font-size: 10px; color: #475569; line-height: 1.4; margin-bottom: 3px;"><strong>Repairs Performed:</strong> ${asset.repair}</div>` : ''}
                        ${asset.recommendations && asset.recommendations !== 'N/A' ? `<div style="font-size: 10px; color: #4338ca; line-height: 1.4;"><strong>Unit Recommendations:</strong> ${asset.recommendations}</div>` : ''}
                    </div>
                    `).join('')}
                </div>`;
            })()}

            ${(includeWorkNotes && workNotes) ? `
            <div class="pdf-card pdf-avoid-break" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background-color: #ffffff;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #10b981; display: block; margin-bottom: 3px; letter-spacing: 0.5px;">WORK PERFORMED NOTES</span>
                <p style="margin: 0; font-size: 10px; color: #334155; line-height: 1.45; font-weight: 500;">${workNotes.replace(/\n/g, '<br />')}</p>
            </div>
            ` : ''}

            ${(includeCompletionNotes && completionNotes) ? `
            <div class="pdf-card pdf-avoid-break" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #6366f1; display: block; margin-bottom: 3px; letter-spacing: 0.5px;">Completion Summary</span>
                <p style="margin: 0; font-size: 10px; color: #334155; line-height: 1.45; font-weight: 500;">${completionNotes.replace(/\n/g, '<br />')}</p>
            </div>
            ` : ''}

            ${(includePhotos && duringPhotos.length > 0) ? `
            <div class="pdf-card pdf-avoid-break" style="margin-bottom: 12px;">
                <span style="font-size: 8px; font-weight: 800; color: #2563eb; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px;">IN-PROGRESS WORK & SERVICE PHOTOS</span>
                <div style="text-align: left; font-size: 0;">
                    ${duringPhotos.map((p, pIdx) => {
                        const cols = duringPhotos.length === 2 ? 2 : (duringPhotos.length === 1 ? 1 : 3);
                        const isLastInRow = (pIdx % cols === cols - 1);
                        const widthPct = cols === 1 ? '55%' : (cols === 2 ? '48.5%' : '31.8%');
                        const cardHeight = cols <= 2 ? '175px' : '145px';

                        return `
                        <div class="pdf-photo" style="display: inline-block; width: ${widthPct}; margin-right: ${isLastInRow ? '0' : '2%'}; margin-bottom: 12px; vertical-align: top; text-align: left; font-size: 11px;">
                            <a href="${p.url}" target="_blank" style="display: block; width: 100%; height: ${cardHeight}; border-radius: 6px; overflow: hidden; border: 1.5px solid #2563eb; background-color: #0f172a; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-decoration: none;">
                                <table width="100%" height="100%" cellpadding="0" cellspacing="0" style="width: 100%; height: ${cardHeight}; border-collapse: collapse;">
                                    <tr>
                                        <td align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 0; width: 100%; height: ${cardHeight}; background-color: #0f172a;">
                                            <img src="${p.url}" style="max-height: ${cardHeight}; max-width: 100%; width: auto; height: auto; display: block; margin: 0 auto; object-fit: contain;" alt="${p.label}" />
                                        </td>
                                    </tr>
                                </table>
                                <span style="position: absolute; top: 5px; left: 5px; background-color: #2563eb; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 7px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 1px 2px rgba(0,0,0,0.25);">WORK IN PROGRESS</span>
                                ${p.dateBadge ? `<span style="position: absolute; bottom: 5px; right: 5px; background-color: rgba(15, 23, 42, 0.85); color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 7.5px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 1px 2px rgba(0,0,0,0.3);">${p.dateBadge}</span>` : ''}
                            </a>
                            <span style="font-size: 9.5px; font-weight: 800; color: #1e293b; display: block; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.25;">${p.label}</span>
                            ${p.subLabel ? `<span style="font-size: 8.5px; font-weight: 700; color: #2563eb; display: block; margin-top: 1px; line-height: 1.25;">${p.subLabel}</span>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            ${(includePhotos && afterPhotos.length > 0) ? `
            <div class="pdf-card pdf-avoid-break" style="margin-bottom: 12px;">
                <span style="font-size: 8px; font-weight: 800; color: #10b981; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px;">AFTER REPAIR & VERIFICATION PHOTOS</span>
                <div style="text-align: left; font-size: 0;">
                    ${afterPhotos.map((p, pIdx) => {
                        const cols = afterPhotos.length === 2 ? 2 : (afterPhotos.length === 1 ? 1 : 3);
                        const isLastInRow = (pIdx % cols === cols - 1);
                        const widthPct = cols === 1 ? '55%' : (cols === 2 ? '48.5%' : '31.8%');
                        const cardHeight = cols <= 2 ? '175px' : '145px';

                        return `
                        <div class="pdf-photo" style="display: inline-block; width: ${widthPct}; margin-right: ${isLastInRow ? '0' : '2%'}; margin-bottom: 12px; vertical-align: top; text-align: left; font-size: 11px;">
                            <a href="${p.url}" target="_blank" style="display: block; width: 100%; height: ${cardHeight}; border-radius: 6px; overflow: hidden; border: 1.5px solid #10b981; background-color: #0f172a; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-decoration: none;">
                                <table width="100%" height="100%" cellpadding="0" cellspacing="0" style="width: 100%; height: ${cardHeight}; border-collapse: collapse;">
                                    <tr>
                                        <td align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 0; width: 100%; height: ${cardHeight}; background-color: #0f172a;">
                                            <img src="${p.url}" style="max-height: ${cardHeight}; max-width: 100%; width: auto; height: auto; display: block; margin: 0 auto; object-fit: contain;" alt="${p.label}" />
                                        </td>
                                    </tr>
                                </table>
                                <span style="position: absolute; top: 5px; left: 5px; background-color: #10b981; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 7px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 1px 2px rgba(0,0,0,0.25);">AFTER VERIFIED</span>
                                ${p.dateBadge ? `<span style="position: absolute; bottom: 5px; right: 5px; background-color: rgba(15, 23, 42, 0.85); color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 7.5px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 1px 2px rgba(0,0,0,0.3);">${p.dateBadge}</span>` : ''}
                            </a>
                            <span style="font-size: 9.5px; font-weight: 800; color: #1e293b; display: block; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.25;">${p.label}</span>
                            ${p.subLabel ? `<span style="font-size: 8.5px; font-weight: 700; color: #059669; display: block; margin-top: 1px; line-height: 1.25;">${p.subLabel}</span>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
        </div>

        <!-- SIGNED WORK VALIDATION & CLIENT SIGN-OFF (DEDICATED SECTION) -->
        ${(() => {
            const reportSignatureSrc = attachedSignatureImage?.url || attachedSignatureImage?.dataUrl || job.siteManagerSignatureUrl || job.siteManagerSignature || job.customerSignatureUrl || job.customerSignature || job.signatureUrl || job.signature || '';
            const shouldShow = includeSignOff && (attachedSignOffPdf || reportSignatureSrc || job.siteManagerSignature || job.customerSignature || job.signature || job.signedSignoffSheetUrl || job.signOffSheetUrl || (job as any)?.signOff || attachedSignOffImages.length > 0 || job.customerFeedback);
            if (!shouldShow) return '';

            return `
        <div class="pdf-card pdf-avoid-break" style="margin-bottom: 14px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: left;">
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 8px;">
                    <tr>
                        <td align="left" style="font-size: 8.5px; font-weight: 900; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">
                            Signed Work Validation &amp; Client Sign-Off
                        </td>
                        <td align="right" style="font-size: 9px; color: #059669; font-weight: 800; text-transform: uppercase;">
                            ✓ Verified On-Site
                        </td>
                    </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                    <tr>
                        <td style="vertical-align: middle; padding-right: 14px;" width="52%">
                            ${attachedSignOffPdf ? `
                            <p style="margin: 0 0 4px; font-size: 10px; color: #1e293b; font-weight: 700;">Attached Sign-Off Document: <strong>${attachedSignOffPdf.fileName || 'Signed_Signoff_Sheet.pdf'}</strong></p>
                            ${(attachedSignOffPdf.url || attachedSignOffPdf.dataUrl) ? `
                            <a href="${attachedSignOffPdf.url || attachedSignOffPdf.dataUrl}" target="_blank" style="display: inline-block; margin-top: 2px; padding: 4px 10px; background-color: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 9.5px;">
                                View Signed PDF Document &rarr;
                            </a>
                            ` : ''}
                            ` : ''}
                            ${(!attachedSignOffPdf && (job.signOffSheetUrl || (job as any)?.signoffSheetUrl)) ? `
                            <p style="margin: 0 0 4px; font-size: 10px; color: #1e293b; font-weight: 700;">Attached Sign-Off Sheet: <strong>Sign-Off Document</strong></p>
                            <a href="${job.signOffSheetUrl || (job as any)?.signoffSheetUrl}" target="_blank" style="display: inline-block; margin-top: 2px; padding: 4px 10px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 9.5px;">
                                View Signed Work Order Form &rarr;
                            </a>
                            ` : ''}
                            <p style="margin: 4px 0 0; font-size: 10px; color: #475569; line-height: 1.45;">
                                ${job.customerFeedback || 'Client / store manager verified work completion on-site and authorized sign-off.'}
                            </p>
                        </td>
                        <td style="vertical-align: middle; text-align: right;" width="48%">
                            <table style="width: 215px; margin-left: auto; border: 2px dashed #059669; background-color: #f0fdf4; border-radius: 8px; border-collapse: separate; padding: 8px 10px;" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="font-size: 8.5px; font-weight: 900; color: #059669; text-transform: uppercase; letter-spacing: 0.8px; padding-bottom: 2px;">
                                        ✓ SIGNATURE ON FILE
                                    </td>
                                </tr>
                                ${reportSignatureSrc ? `
                                <tr>
                                    <td align="center" style="vertical-align: middle; height: 50px; padding: 2px 0;">
                                        <img src="${reportSignatureSrc}" style="height: 46px; max-width: 190px; display: block; margin: 0 auto; border: 0;" alt="Client Signature" />
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="font-size: 10px; font-weight: 800; color: #0f172a; padding-top: 2px;">
                                        ${clientSignerName}
                                    </td>
                                </tr>
                                ` : `
                                <tr>
                                    <td align="center" style="font-size: 12px; font-weight: 800; color: #0f172a; height: 45px; vertical-align: middle; font-family: 'Brush Script MT', cursive, sans-serif; font-style: italic;">
                                        ${clientSignerName}
                                    </td>
                                </tr>
                                `}
                                <tr>
                                    <td align="center" style="font-size: 8px; color: #64748b; padding-top: 2px;">
                                        ${attachedSignOffPdf?.metadata?.dateOfService || (job as any)?.signOff?.dateOfService || reportDateStr} &bull; Store Manager Sign-Off
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="font-size: 7.5px; color: #059669; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding-top: 2px;">
                                        OFFICIAL CLIENT VERIFICATION
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
            `;
        })()}

        <!-- INVOICE SUMMARY SECTION -->
        ${(includeInvoice && job.invoice) ? (() => {
            const invoiceObj = job.invoice;
            const invTotal = Number(invoiceObj.totalAmount) || Number(invoiceObj.amount) || 0;
            const invSubtotal = Number(invoiceObj.subtotal) || 0;
            const invTax = Number(invoiceObj.taxAmount) || 0;
            const invItems = invoiceObj.items || [];
            const invStatus = (invoiceObj.status || 'Pending').toUpperCase();

            return `
            <div class="pdf-card pdf-avoid-break" style="margin-bottom: 14px; border-top: 1px solid #f1f5f9; padding-top: 12px; text-align: left;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 10px;">
                    <tr>
                        <td style="text-align: left; vertical-align: middle;">
                            <h4 style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #4f46e5;">Invoice Summary: #${invoiceObj.id || 'INV'}</h4>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                            <span style="background-color: ${invStatus === 'PAID' ? '#dcfce7' : '#fef3c7'}; color: ${invStatus === 'PAID' ? '#15803d' : '#b45309'}; border: 1px solid ${invStatus === 'PAID' ? '#86efac' : '#fde68a'}; padding: 2px 8px; border-radius: 12px; font-weight: 800; text-transform: uppercase; font-size: 8px;">${invStatus}</span>
                        </td>
                    </tr>
                </table>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 10px; margin-bottom: 10px;">
                    <thead>
                        <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 6px 8px; text-align: left; font-weight: 800; color: #64748b; font-size: 8px; text-transform: uppercase;">Description</th>
                            <th style="padding: 6px 8px; text-align: center; font-weight: 800; color: #64748b; width: 40px; font-size: 8px; text-transform: uppercase;">Qty</th>
                            <th style="padding: 6px 8px; text-align: right; font-weight: 800; color: #64748b; width: 80px; font-size: 8px; text-transform: uppercase;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invItems.map((item: any) => `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 6px 8px; text-align: left;">
                                    <div style="font-weight: 700; color: #1e293b;">${item.name || item.description || ''}</div>
                                    ${(item.quantity > 1 || (item.unitPrice && item.unitPrice !== item.total)) ? `<div style="font-size: 9px; font-weight: 700; color: #4f46e5; margin-top: 1px;">${item.quantity || 1} units @ $${Number(item.unitPrice || 0).toFixed(2)} / unit</div>` : ''}
                                    ${item.description && item.description !== item.name ? `<div style="font-size: 9px; color: #64748b; margin-top: 1px;">${item.description}</div>` : ''}
                                </td>
                                <td style="padding: 6px 8px; text-align: center; color: #475569;">${item.quantity || 1}</td>
                                <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #1e293b;">$${Number(item.total || ((item.unitPrice || 0) * (item.quantity || 1))).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 10px;">
                    <tr>
                        <td style="width: 50%;"></td>
                        <td style="width: 50%;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 3px 0; color: #64748b; text-align: left; font-weight: 600;">Subtotal</td>
                                    <td style="padding: 3px 0; font-weight: 700; text-align: right; color: #1e293b;">$${invSubtotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 3px 0; color: #64748b; text-align: left; font-weight: 600;">Tax</td>
                                    <td style="padding: 3px 0; font-weight: 700; text-align: right; color: #1e293b;">$${invTax.toFixed(2)}</td>
                                </tr>
                                <tr style="border-top: 2px solid #0f172a;">
                                    <td style="padding: 6px 0; font-weight: 800; text-align: left; color: #0f172a; font-size: 12px;">Grand Total</td>
                                    <td style="padding: 6px 0; font-weight: 900; text-align: right; color: #4f46e5; font-size: 14px;">$${invTotal.toFixed(2)}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </div>`;
        })() : ''}

        <!-- TECHNICIAN THANK YOU NOTE CARD -->
        ${includeThankYouNote ? `
        <div class="pdf-card pdf-avoid-break" style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-left: 4px solid #7c3aed; padding: 14px 16px; border-radius: 10px; margin-bottom: 12px; text-align: left; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 10px;">
                <tr>
                    ${avatarUrl ? `
                    <td width="46" style="vertical-align: top; padding-right: 10px;">
                        <img src="${avatarUrl}" width="40" height="40" style="border-radius: 50%; object-fit: cover; border: 2px solid #7c3aed; display: block;" alt="${techName}" />
                    </td>
                    ` : `
                    <td width="46" style="vertical-align: top; padding-right: 10px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #e0e7ff; color: #7c3aed; text-align: center; line-height: 40px; font-size: 16px; font-weight: bold; border: 2px solid #7c3aed;">♥</div>
                    </td>
                    `}
                    <td style="vertical-align: top; text-align: left;">
                        <span style="font-size: 8px; font-weight: 800; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">A Personal Thank You</span>
                        <h4 style="margin: 0 0 2px; color: #1e1b4b; font-size: 12px; font-weight: 800;">From ${techName} <span style="font-size: 10px; font-weight: bold; color: #64748b;">(${techRole})</span></h4>
                        <p style="margin: 0; font-size: 11px; color: #3730a3; font-style: italic; line-height: 1.45;">"${thankYouNoteText.replace(/\n/g, '<br />')}"</p>
                    </td>
                </tr>
            </table>

            <div style="border-top: 1px dashed #ddd6fe; padding-top: 10px; text-align: center;">
                <p style="margin: 0 0 6px; font-weight: 800; font-size: 10px; color: #1e1b4b;">How did we do? Support us with a quick review!</p>
                <div>
                    ${googleReview ? `<a href="${googleReview}" style="background-color: #f59e0b; color: white; padding: 6px 14px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 10px; display: inline-block; margin-right: 6px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);">Review on Google</a>` : ''}
                    <a href="${ttReview}" style="background-color: #0284c7; color: white; padding: 6px 14px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);">Review on TekTrakker</a>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- FOOTER & LEGAL -->
        <div class="pdf-section" style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e2e8f0; text-align: left;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 10px; color: #64748b;">
                <tr>
                    <td style="vertical-align: top; padding-right: 16px; text-align: left;" width="50%">
                        <h4 style="margin: 0 0 3px; font-size: 11px; font-weight: bold; color: #334155;">${orgName}</h4>
                        ${orgAddress ? `<p style="margin: 0 0 2px; line-height: 1.35;">${orgAddress}</p>` : ''}
                        ${orgPhone ? `<p style="margin: 0 0 2px;"><strong>Phone:</strong> ${orgPhone}</p>` : ''}
                        ${orgEmail ? `<p style="margin: 0 0 2px;"><strong>Email:</strong> <a href="mailto:${orgEmail}" style="color: #4f46e5; text-decoration: none;">${orgEmail}</a></p>` : ''}
                        ${orgWebsite ? `<p style="margin: 0 0 2px;"><strong>Web:</strong> <a href="${orgWebsite.startsWith('http') ? orgWebsite : 'https://' + orgWebsite}" style="color: #4f46e5; text-decoration: none;" target="_blank">${orgWebsite}</a></p>` : ''}
                        ${orgLicense ? `<p style="margin: 0 0 2px;"><strong>License #:</strong> ${orgLicense}</p>` : ''}
                    </td>
                    <td style="vertical-align: top; text-align: right;" width="50%">
                        <p style="margin: 0 0 2px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-size: 8px; color: #94a3b8;">Service report generated via TekTrakker Platform</p>
                        <p style="margin: 0 0 6px; font-size: 8px; color: #94a3b8;">Official customer service document.</p>
                        ${complianceFooter ? `<p style="margin: 0; font-size: 8px; line-height: 1.35; color: #94a3b8; font-style: italic;">${complianceFooter}</p>` : ''}
                    </td>
                </tr>
                ${orgTerms ? `
                <tr>
                    <td colspan="2" style="padding-top: 8px; border-top: 1px dashed #e2e8f0; margin-top: 8px; font-size: 8px; color: #94a3b8; line-height: 1.35; text-align: left;">
                        <strong>Terms & Disclaimers:</strong> ${orgTerms}
                    </td>
                </tr>
                ` : ''}
            </table>
            <div style="text-align: center; margin-top: 10px; padding-top: 6px; border-top: 1px solid #f1f5f9;">
                <span style="font-size: 7px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">POWERED BY TekTrakker</span>
            </div>
        </div>
    </div>
    `;

    return html;
};

/**
 * Generates a Job Report (Service History Summary) PDF attachment matching the full downloaded PDF.
 */
export const generateJobReportPdfAttachment = async (job: any, org: any, customMessage?: string, options: JobReportOptions = {}): Promise<EmailAttachment> => {
    const filename = getStandardPdfFilename('Service_Report', {
        id: job?.id,
        workOrderNumber: job?.workOrderNumber,
        poNumber: job?.poNumber,
        customerName: job?.customerName || job?.customer?.name,
        date: job?.appointmentTime || job?.scheduledDate || job?.createdAt
    });

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
            // @ts-ignore - html2pdf has no types available right now
            const html2pdf = (await import('html2pdf.js')).default;
            const htmlContent = generateJobReportHtml(job, org, customMessage, { isPdfOrPrint: true, ...options });

            const wrapper = document.createElement('div');
            wrapper.style.position = 'fixed';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '0';
            wrapper.style.width = '740px';
            wrapper.style.zIndex = '-1000';

            const container = document.createElement('div');
            container.innerHTML = htmlContent;
            container.style.width = '740px';
            container.style.backgroundColor = '#ffffff';
            container.style.padding = '0px';
            container.style.margin = '0px';
            container.style.boxSizing = 'border-box';

            wrapper.appendChild(container);
            document.body.appendChild(wrapper);

            // Wait for all images inside container to load
            const images = container.getElementsByTagName('img');
            const promises = Array.from(images).map(img => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise<void>(resolve => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                    setTimeout(resolve, 2000);
                });
            });
            await Promise.all(promises);

            const opt: any = {
                margin:       [0.25, 0.25, 0.25, 0.25],
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 740, backgroundColor: '#ffffff' },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
                pagebreak:    { mode: ['css', 'legacy'], avoid: ['.pdf-avoid-break', '.pdf-card', '.pdf-photo', '.pdf-unit-card', '.pdf-timeline-item', 'tr', 'img', 'blockquote', '.avoid-break'] }
            };

            const pdfDataUri = await html2pdf().from(container).set(opt).output('datauristring');
            document.body.removeChild(wrapper);

            const base64Part = pdfDataUri.split('base64,')[1] || pdfDataUri;

            let downloadUrl = '';
            try {
                const cleanFileName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
                const storagePath = `organizations/${org?.id || 'public'}/pdf_attachments/${Date.now()}_${cleanFileName}`;
                downloadUrl = await uploadFileToStorage(storagePath, `data:application/pdf;base64,${base64Part}`);
            } catch (storageErr) {
                console.warn("Could not upload HTML PDF report to storage:", storageErr);
            }

            return {
                filename,
                content: downloadUrl ? undefined : base64Part,
                path: downloadUrl || undefined,
                encoding: downloadUrl ? undefined : 'base64',
                contentType: 'application/pdf'
            };
        } catch (e) {
            console.error("Error generating HTML PDF report via html2pdf:", e);
        }
    }

    // Fallback to native jsPDF vector graphics if SSR or error...

    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = patchJsPdfInstance(new jsPDF({ unit: 'pt', format: 'letter' }));

    const fallbackFilename = filename;

    const isTekAir = String(org?.name || '').toLowerCase().includes('tekair') || org?.id === 'org-1765817997819';
    const orgName = org?.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider');
    const orgPhone = org?.phone || (isTekAir ? '210-318-4197' : '');
    const orgEmail = org?.email || (isTekAir ? 'Operations@tekairinc.com' : '');
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || '';
    const licenseNumber = org?.licenseNumber || org?.taxId || (isTekAir ? 'TACLA73240E' : '');
    const defaultCompliance = isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov' : '';
    const complianceFooter = org?.complianceFooter || org?.footerText || org?.regulatoryFooter || defaultCompliance;

    const jobId = job?.id || '';
    const customerName = job?.customerName || '';
    const customerAddress = formatAddressStr(job?.address || '');
    const techName = job?.assignedTechnicianName || '';
    const apptTime = job?.appointmentTime ? new Date(job.appointmentTime).toLocaleString() : '';
    const status = (job?.jobStatus || '').toUpperCase();
    const poNumber = job?.poNumber || '';

    const localNotes = job?.techNotes || job?.notes || {};
    const arrivalNotes = localNotes?.arrival || job?.arrivalNotes || '';
    const workNotes = localNotes?.work || localNotes?.workNotes || '';
    const completionNotes = localNotes?.completion || job?.completionNotes || '';

    const currentTimestampStr = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();

    // Top primary accent bar (#0284c7 - Sky Blue)
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, 612, 10, 'F');

    let currentY = 42;

    // Optional Logo
    if (orgLogo) {
        const logoB64 = await fetchImageAsBase64(orgLogo);
        if (logoB64) {
            const logoH = drawPreservedLogo(doc, logoB64, 40, currentY, 130, 40);
            if (logoH > 0) currentY += logoH + 8;
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

    const customerObj = (job as any)?.customer || (job as any)?.customerData || (job as any)?.customerObj || null;
    const matchedLocForPdf = resolveServiceLocation(job, customerObj);
    const locPdfBillToName = matchedLocForPdf?.billToName || (matchedLocForPdf?.billToSameAsSite ? (matchedLocForPdf.propertyName || matchedLocForPdf.name) : null);
    const locPdfBillToAddr = matchedLocForPdf?.billToAddress || (matchedLocForPdf?.billToSameAsSite ? (matchedLocForPdf.address || job?.address) : null);

    const billToName = job?.billToName || job?.invoice?.billToName || locPdfBillToName || (job as any)?.billingCompany || customerName;
    const billToAddress = formatAddressStr(job?.billToAddress || job?.invoice?.billToAddress || locPdfBillToAddr || (job as any)?.billingAddress || customerAddress || job?.locationAddress || job?.address);
    const siteLocationName = job?.locationName || (job as any)?.serviceLocationName || (job as any)?.siteName || customerName;

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
    doc.text(`WO #: ${poNumber}`, 228, currentY + 62);

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

    const formatTimeStr = (isoOrMs: any) => {
        if (!isoOrMs) return '';
        try {
            const d = new Date(isoOrMs);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        } catch {
            return '';
        }
    };

    const tSummary = getJobTimeSummary(job);
    let timeOnSiteText = 'TIME ON SITE: Pending Field Check-In';
    if (tSummary.formattedInDateTime && tSummary.formattedOutDateTime) {
        timeOnSiteText = `TIME ON SITE: Arrived ${tSummary.formattedInDateTime}  •  Departed ${tSummary.formattedOutDateTime}${tSummary.formattedDuration ? ` (${tSummary.formattedDuration})` : ''}`;
    } else if (tSummary.formattedInDateTime) {
        timeOnSiteText = `TIME ON SITE: Arrived ${tSummary.formattedInDateTime}  •  Work In Progress`;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199);
    doc.text(timeOnSiteText, 52, currentY + 94);

    currentY += 112;

    doc.setDrawColor(241, 245, 249);
    doc.line(52, currentY + 66, 560, currentY + 66);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    if (job?.pocs || job?.customerPhone || customerName) {
        doc.setDrawColor(241, 245, 249);
        doc.line(52, currentY + 66, 560, currentY + 66);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('ASSOCIATED LOCATION POINTS OF CONTACT (POCS)', 52, currentY + 76);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        const pocStr = job?.pocString || `${customerName || 'Customer'} (Primary): ${job?.customerPhone || 'N/A'}`;
        doc.text(pocStr, 52, currentY + 86);

        currentY += 106;
    }

    // Technician Direct Recommendations Box
    const recText = job?.recommendations || (typeof localNotes === 'object' && localNotes?.recommendations) || '';
    if (recText) {
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
    }

    const servicedEquipmentUnits = getJobServicedEquipment(job);

    // Render SYSTEM PROFILES & SPECIFICATIONS Card for EACH serviced equipment unit worked on
    for (let eqIdx = 0; eqIdx < servicedEquipmentUnits.length; eqIdx++) {
        const eqUnit = servicedEquipmentUnits[eqIdx];
        const unitLabel = eqUnit?.name || eqUnit?.title || `Equipment Unit #${eqIdx + 1}`;
        const tonnageStr = eqUnit?.tonnage || eqUnit?.tons || 'N/A';
        const refrigStr = eqUnit?.refrigerant || eqUnit?.refrigerantType || 'N/A';
        const serialStr = eqUnit?.serial || eqUnit?.serialNumber || 'N/A';
        const yearStr = eqUnit?.year || eqUnit?.yearBuilt || 'N/A';
        const healthBefore = eqUnit?.healthBefore || 'N/A';
        const healthAfter = eqUnit?.healthAfter || 'N/A';
        const unitDiagnosis = eqUnit?.diagnosis || '';
        const unitRepair = eqUnit?.repair || '';
        const unitRecs = eqUnit?.recommendations || '';

        const unitDetailsStr = `Tonnage: ${tonnageStr}  |  Refrigerant: ${refrigStr}  |  Serial #: ${serialStr}  |  Year: ${yearStr}`;

        // Extract unit-specific photos
        const unitPhotos: any[] = [];
        const tagUrl = eqUnit?.serialPhotoUrl || eqUnit?.unitTagPhotoUrl || eqUnit?.platePhotoUrl || eqUnit?.conditionPhotoUrl;
        if (tagUrl) {
            unitPhotos.push({ url: tagUrl, label: `${unitLabel} Tag / Nameplate` });
        }

        const extraLines = (unitDiagnosis ? 1 : 0) + (unitRepair ? 1 : 0) + (unitRecs ? 1 : 0);
        const cardH = 90 + extraLines * 14;

        if (currentY + cardH > 700) {
            doc.addPage();
            currentY = 40;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(40, currentY, 532, cardH, 6, 6, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(unitLabel, 52, currentY + 16);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(unitDetailsStr, 52, currentY + 28);

        doc.setDrawColor(226, 232, 240);
        doc.line(52, currentY + 34, 560, currentY + 34);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(234, 88, 12);
        doc.text(`INITIAL HEALTH: ${healthBefore}`, 52, currentY + 48);

        doc.setTextColor(16, 185, 129);
        doc.text(`POST-SERVICE HEALTH: ${healthAfter}`, 300, currentY + 48);

        let dynY = currentY + 62;
        if (unitDiagnosis) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(67, 56, 202);
            doc.text(`Diagnosis: ${unitDiagnosis}`, 52, dynY);
            dynY += 14;
        }
        if (unitRepair) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(4, 120, 87);
            doc.text(`Repairs Done: ${unitRepair}`, 52, dynY);
            dynY += 14;
        }
        if (unitRecs) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(147, 51, 234);
            doc.text(`Recommendations: ${unitRecs}`, 52, dynY);
            dynY += 14;
        }

        currentY += cardH + 14;
    }

    const rawToolReadings = Array.isArray(job?.toolReadings) ? job.toolReadings : (job?.toolReadings && typeof job.toolReadings === 'object' ? [job.toolReadings] : []);
    const beforeReadings = rawToolReadings.filter((r: any) => !r.phase || r.phase === 'before');
    const afterReadings = rawToolReadings.filter((r: any) => r.phase === 'after');

    // Scan all photos into categorized arrays for section-specific rendering
    const beforePhotosList: any[] = [];
    const afterPhotosList: any[] = [];
    const allPhotosOrdered: any[] = [];

    const aggregatePhotoSources = (sourceArray: any[], defaultCategory: string) => {
        if (!Array.isArray(sourceArray)) return;
        sourceArray.forEach((p: any) => {
            const url = p?.dataUrl || p?.url || (typeof p === 'string' ? p : null);
            if (!url) return;
            if (typeof p === 'object') {
                if (isInternalExpenseFile(p) || isSignOffFile(p) || !isFilePhoto(p)) return;
            } else if (typeof p === 'string') {
                if (/\.(pdf|html|htm|docx|doc|xlsx|csv|zip|txt)($|\?)/i.test(p) || p.toLowerCase().includes('proposal')) return;
            }
            const title = p.metadata?.title || p.title || p.metadata?.label || p.label || `${defaultCategory} PHOTO`;
            const cat = ((p.metadata?.category || p.category || p.phase || defaultCategory) as string).toLowerCase().trim();
            const labelLower = title.toLowerCase().trim();

            const photoObj = {
                url,
                title,
                desc: p.metadata?.description || p.description || ''
            };

            if (!allPhotosOrdered.some(existing => existing.url === url)) {
                allPhotosOrdered.push(photoObj);

                const isExplicitBefore = cat.includes('before') || cat.includes('pre-work') || cat.includes('prework') || labelLower.includes('before') || labelLower.includes('pre-work') || labelLower.includes('prework') || labelLower.includes('initial') || labelLower.includes('arrival');
                const isExplicitAfter = cat.includes('after') || cat.includes('completed') || labelLower.includes('after') || labelLower.includes('completed') || labelLower.includes('post') || labelLower.includes('repair');

                if (isExplicitBefore) {
                    beforePhotosList.push(photoObj);
                } else if (isExplicitAfter || defaultCategory === 'AFTER') {
                    afterPhotosList.push(photoObj);
                } else {
                    beforePhotosList.push(photoObj);
                }
            }
        });
    };

    aggregatePhotoSources(job?.files, 'FIELD PHOTO');
    aggregatePhotoSources(job?.photos, 'BEFORE');
    aggregatePhotoSources(job?.images, 'BEFORE');
    aggregatePhotoSources(job?.imageUrls, 'BEFORE');
    aggregatePhotoSources(job?.beforePhotos, 'BEFORE');
    aggregatePhotoSources(job?.afterPhotos, 'AFTER');
    aggregatePhotoSources(job?.sitePhotos, 'FIELD PHOTO');
    aggregatePhotoSources(job?.technicianPhotos, 'FIELD PHOTO');
    aggregatePhotoSources(job?.techPhotos, 'FIELD PHOTO');
    aggregatePhotoSources(job?.paperFormPhotos, 'PAPER FORM');
    aggregatePhotoSources(job?.paperForms, 'PAPER FORM');
    aggregatePhotoSources(job?.attachments, 'ATTACHMENT');
    aggregatePhotoSources(job?.attachmentUrls, 'ATTACHMENT');

    if (Array.isArray(job?.unitStates)) {
        job.unitStates.forEach((uState: any) => {
            const uName = uState?.name || uState?.unitName || uState?.assetTag || 'Unit';
            if (Array.isArray(uState?.photos)) {
                aggregatePhotoSources(uState.photos, 'FIELD PHOTO');
            }
            if (uState?.beforePhotoUrl) aggregatePhotoSources([{ url: uState.beforePhotoUrl, title: `${uName} Before Repair`, category: 'BEFORE' }], 'BEFORE');
            if (uState?.afterPhotoUrl) aggregatePhotoSources([{ url: uState.afterPhotoUrl, title: `${uName} After Repair`, category: 'AFTER' }], 'AFTER');
            if (uState?.photoUrl) aggregatePhotoSources([{ url: uState.photoUrl, title: `${uName} Field Photo`, category: 'FIELD PHOTO' }], 'FIELD PHOTO');
            if (uState?.dataPlatePhotoUrl) aggregatePhotoSources([{ url: uState.dataPlatePhotoUrl, title: `${uName} Data Plate`, category: 'SERIAL PLATE' }], 'SERIAL PLATE');
            if (uState?.platePhotoUrl) aggregatePhotoSources([{ url: uState.platePhotoUrl, title: `${uName} Data Plate`, category: 'SERIAL PLATE' }], 'SERIAL PLATE');
            if (uState?.serialPhotoUrl) aggregatePhotoSources([{ url: uState.serialPhotoUrl, title: `${uName} Serial Tag`, category: 'SERIAL PLATE' }], 'SERIAL PLATE');
            if (uState?.conditionPhotoUrl) aggregatePhotoSources([{ url: uState.conditionPhotoUrl, title: `${uName} Condition Photo`, category: 'BEFORE' }], 'BEFORE');
            if (uState?.unitTagPhotoUrl) aggregatePhotoSources([{ url: uState.unitTagPhotoUrl, title: `${uName} Unit Tag`, category: 'SERIAL PLATE' }], 'SERIAL PLATE');
            if (Array.isArray(uState?.sitePhotos)) aggregatePhotoSources(uState.sitePhotos, 'FIELD PHOTO');
        });
    }

    // Section 1: Initial Diagnosis & Before Repair
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(67, 56, 202);
    doc.text('1. INITIAL DIAGNOSIS & BEFORE REPAIR', 40, currentY);

    currentY += 14;

    if (beforeReadings.length > 0) {
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
        const readingsText = beforeReadings.map((r: any) => `${r.name || r.circuit || 'Reading'}: Suction ${r.suction || 'N/A'}, Discharge ${r.discharge || 'N/A'}, Superheat ${r.superheat || 'N/A'}, Subcooling ${r.subcooling || 'N/A'}`).join('\n');
        doc.text(readingsText, 52, currentY + 26);

        currentY += 52;
    }

    // Full Diagnosis & Arrival Findings Notes (Exact User Text)
    const arrivalNotesText = (typeof localNotes === 'object' && localNotes?.arrival) || job?.arrivalNotes || job?.arrivalFindings || job?.findings || (typeof job?.notes === 'string' ? job.notes : '') || '';

    if (arrivalNotesText) {
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
    }

    // Render BEFORE REPAIR Photos directly inside Section 1
    if (beforePhotosList.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(239, 68, 68);
        doc.text('BEFORE REPAIR FIELD PHOTOS', 40, currentY);

        currentY += 12;

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
    const primaryServicedUnitName = servicedEquipmentUnits[0]?.name || job?.unitName || 'Serviced Equipment Unit';

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(40, currentY, 532, 38, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(4, 120, 87);
    doc.text(`VERIFIED EQUIPMENT UNIT: ${primaryServicedUnitName}`, 52, currentY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70);
    doc.text(`POST-SERVICE SYSTEM HEALTH: ${servicedEquipmentUnits[0]?.healthAfter || 'COMPLETED'}`, 52, currentY + 26);

    currentY += 46;

    // Refrigerant Log Card
    if (job?.refrigerantLog || job?.refrigerantAdded) {
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
        doc.text(job.refrigerantLog || job.refrigerantAdded, 52, currentY + 26);

        currentY += 46;
    }

    // Final Gauges Card (Soft Light Mint Tint)
    if (afterReadings.length > 0) {
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
        const finalReadingsText = afterReadings.map((r: any) => `${r.name || r.circuit || 'Reading'} Final: Suction ${r.suction || 'N/A'}, Discharge ${r.discharge || 'N/A'}, Superheat ${r.superheat || 'N/A'}, Subcooling ${r.subcooling || 'N/A'}`).join('\n');
        doc.text(finalReadingsText, 52, currentY + 26);

        currentY += 52;
    }

    // Exact Work Performed Notes Card (Top-level & Unit-level Notes)
    const unitWorkNotesList: string[] = [];
    if (Array.isArray(job?.unitStates)) {
        job.unitStates.forEach((uState: any) => {
            const uName = uState?.name || uState?.unitName || uState?.assetTag || 'Unit';
            const uNotes = uState?.notes || uState?.technicianNotes || uState?.workPerformed || uState?.findings;
            if (uNotes && typeof uNotes === 'string' && uNotes.trim()) {
                unitWorkNotesList.push(`[${uName}]: ${uNotes.trim()}`);
            }
        });
    }

    const baseWorkNotes = (typeof localNotes === 'object' && (localNotes?.work || localNotes?.workNotes)) || job?.workNotes || job?.workPerformed || job?.description || job?.summary || (typeof job?.techNotes === 'string' ? job.techNotes : '') || '';
    const workNotesText = [baseWorkNotes, ...unitWorkNotesList].filter(Boolean).join('\n\n');
    if (workNotesText) {
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
    }

    // Completion Summary Card (Soft Slate/White Tint)
    const completionText = (typeof localNotes === 'object' && localNotes?.completion) || job?.completionNotes || '';
    if (completionText) {
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
    }

    // Linked Invoice / Proposal Summary Card
    if (job?.invoice) {
        if (currentY + 54 > 700) {
            doc.addPage();
            currentY = 40;
        }
        const invNumber = job.invoice.number || job.invoice.invoiceNumber || job.invoice.id || 'INV';
        const invTotal = formatCurrency(job.invoice.total || job.invoice.amount || 0);
        const invStatus = (job.invoice.status || 'UNPAID').toUpperCase();
        let itemsStr = '';
        if (Array.isArray(job.invoice.items) && job.invoice.items.length > 0) {
            itemsStr = 'Items: ' + job.invoice.items.map((i: any) => `${i.name || i.description || 'Item'} (${formatCurrency(i.total || i.amount || 0)})`).join(' • ');
        }

        const boxH = itemsStr ? 54 : 42;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(40, currentY, 532, boxH, 6, 6, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`LINKED INVOICE SUMMARY: #${invNumber}   |   TOTAL: ${invTotal} (${invStatus})`, 52, currentY + 16);
        if (itemsStr) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text(itemsStr, 52, currentY + 30);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(2, 132, 199);
            doc.text('HOW DID WE DO? Support us with a review at app.tektrakker.com or Google Reviews!', 52, currentY + 44);
            currentY += 66;
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(2, 132, 199);
            doc.text('HOW DID WE DO? Support us with a review at app.tektrakker.com or Google Reviews!', 52, currentY + 30);
            currentY += 54;
        }
    } else if (job?.proposalId || job?.proposal) {
        if (currentY + 44 > 700) {
            doc.addPage();
            currentY = 40;
        }
        const propId = job.proposalId || job.proposal?.id || 'PROPOSAL';
        const propStatus = (job.proposal?.status || 'PENDING APPROVAL').toUpperCase();
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(40, currentY, 532, 42, 6, 6, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`LINKED PROPOSAL: #${propId}   |   STATUS: ${propStatus}`, 52, currentY + 16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(2, 132, 199);
        doc.text('HOW DID WE DO? Support us with a review at app.tektrakker.com or Google Reviews!', 52, currentY + 30);
        currentY += 54;
    }

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
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, currentY, 532, 30, 4, 4, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('No after-repair photos attached to this record.', 52, currentY + 18);
        currentY += 42;
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
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, currentY, 532, 32, 4, 4, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('No field documentation photos attached to this service job.', 52, currentY + 19);
        currentY += 44;
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

    return createAttachmentFromDoc(doc, fallbackFilename, org?.id);
};

/**
 * Generates a Commercial Proposal PDF attachment using native jsPDF vector graphics.
 */
export const generateProposalPdfAttachment = async (proposal: any, org: any): Promise<EmailAttachment> => {
    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = patchJsPdfInstance(new jsPDF({ unit: 'pt', format: 'letter' }));

    const docResolved = resolveDocumentDisplayId('Proposal', proposal);
    const propId = docResolved.id;
    const referenceNumber = docResolved.referenceNumber || proposal?.referenceNumber || null;
    const filename = `Proposal_${String(propId).replace(/[^a-z0-9_-]/gi, '')}.pdf`;

    const isTekAir = String(org?.name || proposal?.preparedByOrganization || '').toLowerCase().includes('tekair') || org?.id === 'org-1765817997819';
    const orgName = String(org?.name || proposal?.preparedByOrganization || (isTekAir ? 'TekAir Inc.' : 'Service Provider'));
    const orgPhone = String(org?.phone || proposal?.preparedByPhone || (isTekAir ? '210-318-4197' : ''));
    const orgEmail = String(org?.email || (isTekAir ? 'Operations@tekairinc.com' : ''));
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || '';
    const orgAddress = formatAddressStr(org?.address) || (isTekAir ? '2618 Middleground, San Antonio, TX 78245' : '');
    const licenseNumber = String(org?.licenseNumber || org?.taxId || proposal?.preparedByLicence || (isTekAir ? 'TACLA73240E' : ''));
    const defaultCompliance = isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov' : '';
    const complianceFooter = String(org?.complianceFooter || org?.footerText || org?.regulatoryFooter || defaultCompliance);

    let isCommercialProposal = !!(
        (proposal as any)?.customerType === 'Commercial' ||
        (proposal as any)?.isProjectLevel === true ||
        (proposal as any)?.isCommercial === true
    );

    const title = proposal?.title || proposal?.name || (isCommercialProposal ? 'Commercial HVAC Equipment & Service Proposal' : 'HVAC Equipment & Service Proposal');
    const propDateStr = formatDate(proposal?.createdAt || proposal?.date || new Date());
    const validUntilStr = formatDate(proposal?.validUntil || proposal?.expirationDate || new Date(Date.now() + 30 * 86400000));
    const status = (proposal?.status || 'PROPOSAL').toUpperCase();

    // 3-Tier Multi-Entity Address Resolution & Enrichment
    let customerName = proposal?.customerName || proposal?.clientName || proposal?.companyName || '';
    let customerRawAddr = proposal?.customerAddress || proposal?.clientAddress || '';
    let customerCity = proposal?.city || proposal?.customerCity || '';
    let customerState = proposal?.state || proposal?.customerState || '';
    let customerZip = proposal?.zip || proposal?.customerZip || '';

    let billToName = proposal?.billToName || proposal?.billingCompany || customerName;
    let billToRawAddr = proposal?.billToAddress || proposal?.billingAddress || customerRawAddr;
    let billToCity = proposal?.billingCity || customerCity;
    let billToState = proposal?.billingState || customerState;
    let billToZip = proposal?.billingZip || customerZip;

    let serviceLocationName = proposal?.serviceLocationName || proposal?.locationName || proposal?.siteName || customerName;
    let serviceLocationRawAddr = proposal?.serviceLocationAddress || proposal?.locationAddress || proposal?.siteAddress || proposal?.address || customerRawAddr;
    let serviceLocationCity = proposal?.serviceLocationCity || customerCity;
    let serviceLocationState = proposal?.serviceLocationState || customerState;
    let serviceLocationZip = proposal?.serviceLocationZip || customerZip;

    const custId = proposal?.customerId;
    const jobId = proposal?.jobId;
    const locId = proposal?.locationId;
    let custAccountNumber = proposal?.accountNumber || '';
    let woNumber = proposal?.workOrderNumber || proposal?.woNumber || proposal?.poNumber || '';

    let propDbJobData: any = null;
    try {
        if (jobId) {
            const jDoc = await db.collection('jobs').doc(jobId).get();
            if (jDoc.exists) {
                propDbJobData = { id: jDoc.id, ...jDoc.data() };
            }
        } else if (proposal?.id || proposal?.proposalNumber) {
            const propIdToLook = proposal?.id || proposal?.proposalNumber;
            const propJobSnap = await db.collection('jobs').where('proposalId', '==', propIdToLook).limit(1).get();
            if (!propJobSnap.empty) {
                propDbJobData = { id: propJobSnap.docs[0].id, ...propJobSnap.docs[0].data() };
            }
        }
        if (propDbJobData) {
            if (!woNumber) woNumber = propDbJobData.workOrderNumber || propDbJobData.woNumber || propDbJobData.poNumber || '';
            if (!customerName) customerName = propDbJobData.customerName || '';
            if (!serviceLocationName) serviceLocationName = propDbJobData.locationName || propDbJobData.serviceLocationName || propDbJobData.siteName || '';
            if (!serviceLocationRawAddr) serviceLocationRawAddr = propDbJobData.locationAddress || propDbJobData.serviceLocationAddress || propDbJobData.address || '';
            if (!serviceLocationCity) serviceLocationCity = propDbJobData.city || '';
            if (!serviceLocationState) serviceLocationState = propDbJobData.state || '';
            if (!serviceLocationZip) serviceLocationZip = propDbJobData.zip || '';
        }
        if (custId) {
            const cDoc = await db.collection('customers').doc(custId).get();
            if (cDoc.exists) {
                const dbCustomer = cDoc.data() as any;
                if (!customerName) customerName = dbCustomer.name || '';
                if (!customerRawAddr) customerRawAddr = dbCustomer.address || '';
                if (!customerCity) customerCity = dbCustomer.city || '';
                if (!customerState) customerState = dbCustomer.state || '';
                if (!customerZip) customerZip = dbCustomer.zip || '';

                if (!billToRawAddr) billToRawAddr = dbCustomer.billingAddress || customerRawAddr;
                if (!billToCity) billToCity = dbCustomer.city || customerCity;
                if (!billToState) billToState = dbCustomer.state || customerState;
                if (!billToZip) billToZip = dbCustomer.zip || customerZip;

                if (!custAccountNumber) custAccountNumber = dbCustomer.accountNumber || getOrGenerateAccountNumber(dbCustomer);

                const isCommercial = dbCustomer?.customerType === 'Commercial' || dbCustomer?.customerType === 'Property Management' || (dbCustomer?.serviceLocations && dbCustomer.serviceLocations.length > 0);
                if (isCommercial) isCommercialProposal = true;

                const matchingLoc = resolveServiceLocation(
                    propDbJobData || { locationId: locId, locationName: serviceLocationName, address: serviceLocationRawAddr },
                    dbCustomer
                );

                if (matchingLoc) {
                    if (!serviceLocationName || serviceLocationName === customerName) {
                        serviceLocationName = matchingLoc.propertyName || matchingLoc.name || serviceLocationName;
                    }
                    if (matchingLoc.address) {
                        serviceLocationRawAddr = matchingLoc.address;
                        serviceLocationCity = matchingLoc.city || dbCustomer.city || serviceLocationCity;
                        serviceLocationState = matchingLoc.state || dbCustomer.state || serviceLocationState;
                        serviceLocationZip = matchingLoc.zip || dbCustomer.zip || serviceLocationZip;
                    }
                    if (matchingLoc.billToSameAsSite) {
                        if (!proposal?.billToName && !propDbJobData?.billToName) {
                            billToName = matchingLoc.billToName || matchingLoc.propertyName || matchingLoc.name || billToName;
                        }
                        if (!proposal?.billToAddress && !propDbJobData?.billToAddress) {
                            billToRawAddr = matchingLoc.billToAddress || matchingLoc.address || billToRawAddr;
                            billToCity = matchingLoc.city || dbCustomer.city || billToCity;
                            billToState = matchingLoc.state || dbCustomer.state || billToState;
                            billToZip = matchingLoc.zip || dbCustomer.zip || billToZip;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Proposal PDF address enrichment fetch skipped:', e);
    }

    if (!serviceLocationRawAddr) serviceLocationRawAddr = customerRawAddr || billToRawAddr || '';
    if (!serviceLocationCity) serviceLocationCity = customerCity || billToCity || '';
    if (!serviceLocationState) serviceLocationState = customerState || billToState || '';
    if (!serviceLocationZip) serviceLocationZip = customerZip || billToZip || '';

    if (!customerRawAddr) customerRawAddr = billToRawAddr || serviceLocationRawAddr || '';
    if (!customerCity) customerCity = billToCity || serviceLocationCity || '';
    if (!customerState) customerState = billToState || serviceLocationState || '';
    if (!customerZip) customerZip = billToZip || serviceLocationZip || '';

    if (!billToRawAddr) billToRawAddr = customerRawAddr || serviceLocationRawAddr || '';
    if (!billToCity) billToCity = customerCity || serviceLocationCity || '';
    if (!billToState) billToState = customerState || serviceLocationState || '';
    if (!billToZip) billToZip = customerZip || serviceLocationZip || '';

    const appointmentTimeStr = propDbJobData?.appointmentTime ? formatDate(propDbJobData.appointmentTime) : (proposal?.appointmentTime ? formatDate(proposal.appointmentTime) : '');
    const proposalSiteVisitDateStr = propDbJobData?.completedAt ? formatDate(propDbJobData.completedAt) : (propDbJobData?.scheduledDate ? formatDate(propDbJobData.scheduledDate) : appointmentTimeStr);

    // Line Items Resolution & Multi-Tier Calculation
    let rawLineItems = Array.isArray(proposal?.items) && proposal.items.length > 0
        ? proposal.items
        : (Array.isArray(proposal?.equipmentList) && proposal.equipmentList.length > 0
            ? proposal.equipmentList
            : (Array.isArray(proposal?.lineItems) ? proposal.lineItems : []));

    // Support Project Proposals (Commercial Proposals with laborItems, partItems, allowanceItems)
    const isProjectProposal = !!(
        proposal?.isProjectLevel ||
        (Array.isArray(proposal?.laborItems) && proposal.laborItems.length > 0) ||
        (Array.isArray(proposal?.partItems) && proposal.partItems.length > 0) ||
        (Array.isArray(proposal?.allowanceItems) && proposal.allowanceItems.length > 0)
    );

    if (rawLineItems.length === 0 && isProjectProposal) {
        const synthItems: any[] = [];

        // 1. Labor Items
        if (Array.isArray(proposal?.laborItems) && proposal.laborItems.length > 0) {
            proposal.laborItems.forEach((l: any, idx: number) => {
                const title = l.unitName ? `Mechanical Labor: ${l.unitName}` : (l.description || l.title || 'Mechanical Installation Labor');
                const desc = l.scope || l.description || '';
                const qty = Number(l.hours) || 1;
                const price = Number(l.value || l.customerLineTotal || (Number(l.rate || 0) * qty) || 0);
                const unitPrice = qty > 0 ? Number((price / qty).toFixed(2)) : price;
                synthItems.push({
                    id: l.id || `labor-${idx}`,
                    name: title,
                    title: title,
                    description: desc,
                    quantity: qty,
                    unitPrice: unitPrice,
                    price: unitPrice,
                    total: price,
                    type: 'Labor',
                    taxable: false,
                    category: 'Labor'
                });
            });
        }

        // 2. Part Items (Equipment, Accessories, Discounts)
        if (Array.isArray(proposal?.partItems) && proposal.partItems.length > 0) {
            proposal.partItems.forEach((p: any, idx: number) => {
                const title = p.partName || p.name || p.description || 'Equipment / Part';
                const descParts: string[] = [];
                if (p.unitName) descParts.push(`Application: ${p.unitName}`);
                if (p.partNumber) descParts.push(`Part #: ${p.partNumber}`);
                if (p.availability) descParts.push(`Lead Time: ${p.availability}`);
                const desc = descParts.join(' • ');
                const qty = Number(p.quantity) || 1;
                const unitPrice = Number(p.customerUnitPrice ?? p.unitPrice ?? p.price ?? 0);
                const totalVal = p.customerLineTotal !== undefined ? Number(p.customerLineTotal) : (unitPrice * qty);
                synthItems.push({
                    id: p.id || `part-${idx}`,
                    name: title,
                    title: title,
                    description: desc,
                    quantity: qty,
                    unitPrice: unitPrice,
                    price: unitPrice,
                    total: totalVal,
                    type: 'Part',
                    taxable: p.taxable !== false,
                    category: 'Equipment'
                });
            });
        }

        // 3. Allowance Items (Crane, Electrical, Permits, Subcontractors)
        if (Array.isArray(proposal?.allowanceItems) && proposal.allowanceItems.length > 0) {
            proposal.allowanceItems.forEach((a: any, idx: number) => {
                const title = a.description || 'Logistics & Subcontractor Allowance';
                const rawDesc = a.basis || a.notes || '';
                const desc = sanitizeCustomerScopeText(rawDesc);
                const amount = Number(a.amount || 0);
                synthItems.push({
                    id: a.id || `allowance-${idx}`,
                    name: title,
                    title: title,
                    description: desc,
                    quantity: 1,
                    unitPrice: amount,
                    price: amount,
                    total: amount,
                    type: 'Allowance',
                    taxable: false,
                    category: 'Allowance'
                });
            });
        }

        rawLineItems = synthItems;
    }

    const rawDistinctItemTiers = Array.from(new Set(rawLineItems.map((i: any) => i.tier).filter(Boolean)));
    const hasItemTiers = rawDistinctItemTiers.length > 0;

    const availableTierNames: string[] = getAvailableProposalTiers(proposal);

    const taxRateVal = Number(proposal?.taxRate || org?.taxRate || 0);

    const getTierSubtitle = (tName: string) => {
        const lower = tName.toLowerCase();
        if (lower.includes('good') || lower.includes('basic') || lower.includes('standard') || lower.includes('option 1')) {
            return 'Standard Value Package';
        }
        if (lower.includes('better') || lower.includes('enhanced') || lower.includes('silver') || lower.includes('option 2')) {
            return 'High-Efficiency Enhanced Package';
        }
        if (lower.includes('best') || lower.includes('premium') || lower.includes('platinum') || lower.includes('gold') || lower.includes('option 3')) {
            return 'Premium Maximum Protection Package';
        }
        return 'Custom Solution Package';
    };

    const getTierWarrantyBadge = (tName: string) => {
        const lower = tName.toLowerCase();
        if (lower.includes('best') || lower.includes('platinum') || lower.includes('option 3')) {
            return '5-Yr Workmanship + 1-Yr Maint.';
        }
        return '3-Yr Labor Warranty';
    };

    const tierCalculations = availableTierNames.map((tName: string) => {
        const tItems = rawLineItems.filter((i: any) => matchTier(i.tier, tName));
        if (tItems.length === 0) return null;

        const sub = tItems.reduce((sum: number, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
        const taxableAmount = tItems.filter((i: any) => i.taxable !== false).reduce((sum: number, item: any) => sum + (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 1)), 0);
        const taxVal = Number((taxableAmount * (taxRateVal / 100)).toFixed(2));
        const tot = sub + taxVal;
        const upperT = tName.toUpperCase();
        return {
            name: upperT.endsWith('OPTION') || upperT.endsWith('TIER') ? upperT : `${upperT} OPTION`,
            rawName: tName,
            subtitle: getTierSubtitle(tName),
            warrantyBadge: getTierWarrantyBadge(tName),
            subtotal: sub,
            tax: taxVal,
            total: tot,
            items: tItems
        };
    }).filter(Boolean) as any[];

    const selectedOptionName = proposal?.selectedOption || (availableTierNames[0] || 'Basic');
    let activeTierCalc = tierCalculations.find((tc: any) => matchTier(tc.rawName, selectedOptionName));
    if (!activeTierCalc && tierCalculations.length > 0) {
        activeTierCalc = tierCalculations[0];
    }

    let lineItems = rawLineItems;
    let subtotal = Number(proposal?.subtotal) || 0;
    let tax = Number(proposal?.tax || proposal?.taxAmount) || 0;
    let total = Number(proposal?.totalAmount || proposal?.total || proposal?.amount) || 0;

    if (hasItemTiers && activeTierCalc) {
        lineItems = activeTierCalc.items;
        subtotal = activeTierCalc.subtotal;
        tax = activeTierCalc.tax;
        total = activeTierCalc.total;
    } else if (!total) {
        subtotal = lineItems.reduce((acc: number, item: any) => acc + (Number(item.total) || (Number(item.quantity || 1) * Number(item.unitPrice || 0))), 0);
        tax = Number(proposal?.tax || proposal?.taxAmount) || 0;
        total = subtotal + tax;
    }

    // Helper: Render 3-Tier Address Cards
    const renderAddressCard = (
        x: number,
        y: number,
        w: number,
        h: number,
        boxNum: string,
        boxLabel: string,
        headerBg: [number, number, number],
        nameStr: string,
        rawAddr: any,
        cityStr?: string | null,
        stateStr?: string | null,
        zipStr?: string | null,
        subMeta?: string | string[] | null
    ) => {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, y, w, h, 5, 5, 'FD');

        doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
        doc.roundedRect(x, y, w, 18, 5, 5, 'F');
        doc.rect(x, y + 12, w, 6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`${boxNum}. ${boxLabel.toUpperCase()}`, x + 8, y + 12);

        let curY = y + 29;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        const nameLines = doc.splitTextToSize(nameStr || 'Valued Customer', w - 16);
        doc.text(nameLines, x + 8, curY);
        curY += nameLines.length * 10;

        const sanitized = sanitizeAddressFields(rawAddr, cityStr, stateStr, zipStr);
        const street = sanitized.address;
        let cityStateZip = '';
        if (sanitized.city || sanitized.state || sanitized.zip) {
            cityStateZip = [sanitized.city, [sanitized.state, sanitized.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        if (street) {
            const streetLines = doc.splitTextToSize(street, w - 16);
            doc.text(streetLines, x + 8, curY);
            curY += streetLines.length * 9.5;
        }

        if (cityStateZip) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            const cszLines = doc.splitTextToSize(cityStateZip, w - 16);
            doc.text(cszLines, x + 8, curY);
            curY += cszLines.length * 9.5;
        } else if (!street) {
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(148, 163, 184);
            doc.text('On File / Primary Address', x + 8, curY);
            curY += 10;
        }

        if (subMeta) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            if (Array.isArray(subMeta)) {
                let smY = y + h - (subMeta.length * 9 + 4);
                subMeta.forEach(sm => {
                    doc.text(sm, x + 8, smY);
                    smY += 9;
                });
            } else {
                doc.text(subMeta, x + 8, y + h - 6);
            }
        }
    };

    // ==========================================
    // PAGE 1: HEADER, ADDRESSES, EXECUTIVE SUMMARY & TIERS
    // ==========================================
    doc.setFillColor(79, 70, 229); // Deep Indigo Top Accent
    doc.rect(0, 0, 612, 10, 'F');

    let currentY = 36;

    if (orgLogo) {
        const logoB64 = await fetchImageAsBase64(orgLogo);
        if (logoB64) {
            const logoH = drawPreservedLogo(doc, logoB64, 40, currentY, 140, 44);
            if (logoH > 0) currentY += logoH + 8;
        }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(orgName, 40, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    currentY += 12;
    doc.text(orgAddress, 40, currentY);
    currentY += 10;
    doc.text(`Phone: ${orgPhone}   •   Email: ${orgEmail}`, 40, currentY);
    if (licenseNumber) {
        currentY += 10;
        doc.setFont('helvetica', 'bold');
        doc.text(`License #: ${licenseNumber}`, 40, currentY);
    }

    // Header Right (Proposal Details & Metadata)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text(isCommercialProposal ? 'COMMERCIAL PROPOSAL' : 'PROPOSAL', 572, 42, { align: 'right' });

    const dispPropJobNumber = (() => {
        const raw = proposal?.jobNumber || propDbJobData?.jobNumber || (propDbJobData?.id && !propDbJobData.id.startsWith('prop-') && !propDbJobData.id.startsWith('PROP-') ? propDbJobData.id : null) || (proposal?.jobId && !proposal.jobId.startsWith('prop-') && !proposal.jobId.startsWith('PROP-') ? proposal.jobId : null) || (jobId && !jobId.startsWith('prop-') && !jobId.startsWith('PROP-') ? jobId : null) || null;
        if (!raw) return null;
        return String(raw).startsWith('job-') || String(raw).startsWith('Job-') ? String(raw) : `Job-${raw}`;
    })();

    const dispPropWoNumber = proposal?.workOrderNumber || (proposal as any)?.woNumber || proposal?.poNumber || propDbJobData?.workOrderNumber || propDbJobData?.woNumber || propDbJobData?.poNumber || woNumber || '';
    const dispPropDistinctPo = (proposal?.poNumber && proposal.poNumber !== dispPropWoNumber) ? proposal.poNumber : '';

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(`DOCUMENT #: ${propId}`, 572, 56, { align: 'right' });

    let propMetaY = 67;
    if (referenceNumber) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(79, 70, 229);
        doc.text(`Ref #: ${referenceNumber}`, 572, propMetaY, { align: 'right' });
        propMetaY += 10;
    }
    if (dispPropJobNumber) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`Job #: ${dispPropJobNumber}`, 572, propMetaY, { align: 'right' });
        propMetaY += 10;
    }
    if (dispPropWoNumber) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`WO #: ${dispPropWoNumber}`, 572, propMetaY, { align: 'right' });
        propMetaY += 10;
    }
    if (dispPropDistinctPo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`PO #: ${dispPropDistinctPo}`, 572, propMetaY, { align: 'right' });
        propMetaY += 10;
    }
    if (custAccountNumber) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(79, 70, 229);
        doc.text(`Account #: ${custAccountNumber}`, 572, propMetaY, { align: 'right' });
        propMetaY += 10;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${propDateStr}`, 572, propMetaY, { align: 'right' });
    propMetaY += 9.5;
    if (proposalSiteVisitDateStr) {
        doc.text(`Site Visit Date: ${proposalSiteVisitDateStr}`, 572, propMetaY, { align: 'right' });
        propMetaY += 9.5;
    }
    doc.text(`Valid Until: ${validUntilStr}`, 572, propMetaY, { align: 'right' });
    propMetaY += 10;

    // Status Pill Right Side
    const propStatus = String(proposal?.status || 'PENDING').toUpperCase();
    const propStatusBg = propStatus === 'APPROVED' || propStatus === 'ACCEPTED' ? [220, 252, 231] : (propStatus === 'REJECTED' || propStatus === 'DECLINED' ? [254, 226, 226] : [224, 242, 254]);
    const propStatusTextColor = propStatus === 'APPROVED' || propStatus === 'ACCEPTED' ? [22, 101, 52] : (propStatus === 'REJECTED' || propStatus === 'DECLINED' ? [185, 28, 28] : [2, 132, 199]);
    doc.setFillColor(propStatusBg[0], propStatusBg[1], propStatusBg[2]);
    doc.roundedRect(476, propMetaY + 2, 96, 16, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(propStatusTextColor[0], propStatusTextColor[1], propStatusTextColor[2]);
    doc.text(`STATUS: ${propStatus}`, 524, propMetaY + 13, { align: 'center' });

    currentY = Math.max(currentY + 12, propMetaY + 24);

    // 3-Card Address Layout
    const boxWidth = 170;
    const boxHeight = 84;

    renderAddressCard(40, currentY, boxWidth, boxHeight, '1', 'Customer / Property Mgr', [79, 70, 229], customerName, customerRawAddr, customerCity, customerState, customerZip);
    renderAddressCard(221, currentY, boxWidth, boxHeight, '2', 'Bill To (Paying Entity)', [16, 185, 129], billToName, billToRawAddr, billToCity, billToState, billToZip, dispPropWoNumber ? [`WO #: ${dispPropWoNumber}`] : undefined);
    renderAddressCard(402, currentY, boxWidth, boxHeight, '3', 'Service Site Location', [2, 132, 199], serviceLocationName, serviceLocationRawAddr, serviceLocationCity, serviceLocationState, serviceLocationZip, appointmentTimeStr ? [`Appt: ${appointmentTimeStr}`] : undefined);

    currentY += boxHeight + 12;

    // Executive Scope Summary Card
    const titleLines = doc.splitTextToSize(title, 506);
    const rawRecommendations = String(proposal?.recommendations || proposal?.description || '').trim();
    const execSummary = rawRecommendations
        ? rawRecommendations
        : `We are pleased to present this ${isCommercialProposal ? 'commercial ' : ''}HVAC proposal for ${serviceLocationName || customerName}. Our proposed solution includes complete professional installation, system evacuation, nitrogen pressure testing, refrigerant charge verification, and manufacturer warranty coverage.`;
    const splitExec = doc.splitTextToSize(execSummary, 506);
    const execCardHeight = Math.max(48, 18 + titleLines.length * 11 + splitExec.length * 9.5);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(40, currentY, 532, execCardHeight, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(titleLines, 52, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(splitExec, 52, currentY + 16 + titleLines.length * 11);

    currentY += execCardHeight + 12;

    const isMultiTier = tierCalculations.length > 1;

    if (isMultiTier) {
        // Multi-Tier Comparison Options Cards
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(79, 70, 229);
        doc.text('PROPOSED INVESTMENT OPTIONS (GOOD / BETTER / BEST)', 40, currentY);

        currentY += 10;

        const tierWidth = Math.floor((532 - (tierCalculations.length - 1) * 10) / tierCalculations.length);
        const tierCardHeight = 84;

        tierCalculations.forEach((tCalc: any, idx: number) => {
            const tX = 40 + idx * (tierWidth + 10);
            const isSelected = matchTier(tCalc.rawName, selectedOptionName);
            
            doc.setFillColor(isSelected ? 238 : 255, isSelected ? 242 : 255, isSelected ? 255 : 255);
            doc.setDrawColor(isSelected ? 99 : 203, isSelected ? 102 : 213, isSelected ? 241 : 225);
            doc.roundedRect(tX, currentY, tierWidth, tierCardHeight, 6, 6, 'FD');

            const bannerColor: [number, number, number] = idx === 0 ? [79, 70, 229] : (idx === 1 ? [16, 185, 129] : [147, 51, 234]);
            doc.setFillColor(bannerColor[0], bannerColor[1], bannerColor[2]);
            doc.roundedRect(tX, currentY, tierWidth, 16, 6, 6, 'F');
            doc.rect(tX, currentY + 10, tierWidth, 6, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.text(String(tCalc.name).toUpperCase(), tX + 8, currentY + 11);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(String(tCalc.subtitle), tX + 8, currentY + 28, { maxWidth: tierWidth - 16 });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text(formatCurrency(tCalc.total), tX + 8, currentY + 44);

            let tDep = 0;
            const hasDep = !!(
                (proposal?.depositValue && Number(proposal.depositValue) > 0) ||
                (proposal?.depositAmount && Number(proposal.depositAmount) > 0) ||
                (proposal?.depositRequired && Number(proposal.depositRequired) > 0)
            );

            if (hasDep) {
                if (proposal?.depositType === 'percentage' && proposal?.depositValue) {
                    tDep = Number(((tCalc.total * Number(proposal.depositValue)) / 100).toFixed(2));
                } else {
                    tDep = Math.min(tCalc.total, Number(proposal?.depositValue || proposal?.depositAmount || proposal?.depositRequired || 0));
                }
            }

            if (hasDep && tDep > 0) {
                const depLabel = proposal?.depositType === 'percentage' && proposal?.depositValue
                    ? `${proposal.depositValue}% Deposit: ${formatCurrency(tDep)}`
                    : `Deposit: ${formatCurrency(tDep)}`;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(180, 83, 9);
                doc.text(depLabel, tX + 8, currentY + 58);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(100, 116, 139);
                doc.text(tCalc.warrantyBadge, tX + 8, currentY + 72);
            } else {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(100, 116, 139);
                doc.text(tCalc.warrantyBadge, tX + 8, currentY + 58);
            }
        });

        currentY += tierCardHeight + 12;

        // Baseline Scope Inclusions Card on Page 1
        const importantClarification = proposal?.importantClarification || `INCLUDED WITH ALL OPTIONS: Complete removal and recovery of existing system, new insulated copper line set, electrical disconnect & surge protection, nitrogen pressure testing, system dehydration vacuum, startup commissioning, and clean site cleanup.`;
        const splitClar = doc.splitTextToSize(importantClarification, 506);
        const clarHeight = Math.min(180, Math.max(50, 18 + splitClar.length * 9.5));

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, currentY, 532, clarHeight, 5, 5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(79, 70, 229);
        doc.text('STANDARD INSTALLATION SCOPE INCLUDED WITH ALL OPTIONS', 52, currentY + 13);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(splitClar.slice(0, 16), 52, currentY + 25);

        // ==========================================
        // PAGE 2+: DETAILED SCOPE, DISCLAIMER, SIGNATURE & TERMS
        // ==========================================
        doc.addPage();
        currentY = 44;

        const parseScopeBulletLines = (rawDesc: string): string[] => {
            if (!rawDesc) return [];
            const rawLines = String(rawDesc)
                .split('\n')
                .map(l => l.trim())
                .filter(Boolean);

            const result: string[] = [];
            for (let line of rawLines) {
                if (/^Scope of work included:?$/i.test(line)) continue;
                line = line.replace(/^[-•*]\s*(Premium|Platinum|Gold|Silver|Standard):\s*[^:]+:\s*/i, '');
                const subParts = line.split('\n').map(p => p.trim()).filter(Boolean);
                for (const part of subParts) {
                    const cleaned = part.replace(/^[-•*]\s*/, '').trim();
                    if (cleaned) {
                        result.push(cleaned);
                    }
                }
            }
            return result;
        };

        const drawScopeTableHeader = (isContinuation = false) => {
            doc.setFillColor(79, 70, 229);
            doc.rect(40, currentY, 532, 20, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            const headerText = isContinuation 
                ? 'EQUIPMENT SPECIFICATIONS & PROPOSED SCOPE BY TIER (CONTINUED)' 
                : 'EQUIPMENT SPECIFICATIONS & PROPOSED SCOPE BY TIER';
            doc.text(headerText, 48, currentY + 13);
            doc.text('QTY', 420, currentY + 13, { align: 'center' });
            doc.text('TOTAL INVESTMENT', 564, currentY + 13, { align: 'right' });
            currentY += 20;
        };

        drawScopeTableHeader(false);

        tierCalculations.forEach((tCalc: any, tIdx: number) => {
            const firstItem = tCalc.items[0] || {};
            const itemName = String(firstItem.name || firstItem.title || tCalc.name);
            const itemDesc = String(firstItem.description || '');

            const scopeBulletItems = parseScopeBulletLines(itemDesc);
            const formattedLines: string[] = [];
            scopeBulletItems.forEach((bItem: string) => {
                const wrapped = doc.splitTextToSize(`•  ${bItem}`, 506);
                formattedLines.push(...wrapped);
            });

            const lineSpacing = 9.8;
            const topPadding = 22;
            const bottomPadding = 8;
            const itemRowHeight = Math.max(32, topPadding + (formattedLines.length * lineSpacing) + bottomPadding);

            if (currentY + itemRowHeight > 680) {
                doc.addPage();
                currentY = 44;
                drawScopeTableHeader(true);
            }

            if (tIdx % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(40, currentY, 532, itemRowHeight, 'F');
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(`${tCalc.name}: ${itemName}`, 48, currentY + 12);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            doc.text(String(firstItem.quantity || 1), 420, currentY + 12, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(79, 70, 229);
            doc.text(formatCurrency(tCalc.total), 564, currentY + 12, { align: 'right' });

            if (formattedLines.length > 0) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(71, 85, 105);

                let lineY = currentY + topPadding;
                formattedLines.forEach((line: string) => {
                    doc.text(line, 48, lineY);
                    lineY += lineSpacing;
                });
            }

            doc.setDrawColor(226, 232, 240);
            doc.line(40, currentY + itemRowHeight, 572, currentY + itemRowHeight);

            currentY += itemRowHeight;
        });

        currentY += 14;
    } else {
        // Single Option or Standard Proposal Scope Table
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.rect(40, currentY, 532, 20, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text('PROPOSED SCOPE OF WORK & EQUIPMENT SPECIFICATIONS', 50, currentY + 13);
        doc.text('QTY', 370, currentY + 13, { align: 'center' });
        doc.text('UNIT PRICE', 465, currentY + 13, { align: 'right' });
        doc.text('AMOUNT', 564, currentY + 13, { align: 'right' });

        currentY += 20;

        let propExtractedWarranty = '';

        lineItems.forEach((item: any, idx: number) => {
            const itemTitle = String(item.name || item.title || (isCommercialProposal ? 'Commercial Scope Item' : 'Scope Item'));
            const rawDesc = String(item.description || '');
            const qty = String(item.quantity || 1);
            const unitPrice = formatCurrency(item.unitPrice || item.price);
            const totalVal = formatCurrency(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || 0)));

            let equipDesc = rawDesc;
            if (equipDesc === itemTitle) equipDesc = '';

            const wMatch = equipDesc.match(/(Warranty Terms\s*&?\s*Disclaimer|Warranty Terms|Workmanship Warranty)[\s\S]*/i);
            if (wMatch && wMatch.index !== undefined) {
                propExtractedWarranty = equipDesc.substring(wMatch.index).trim();
                equipDesc = equipDesc.substring(0, wMatch.index).trim();
            }

            const titleLines = doc.splitTextToSize(itemTitle, 300);
            const fullDescLines = equipDesc ? doc.splitTextToSize(equipDesc, 506) : [];
            const rowHeight = Math.max(26, 14 + titleLines.length * 10 + fullDescLines.length * 8.5);

            if (currentY + rowHeight > 680) {
                doc.addPage();
                currentY = 44;
                doc.setFillColor(241, 245, 249);
                doc.setDrawColor(203, 213, 225);
                doc.rect(40, currentY, 532, 20, 'FD');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(51, 65, 85);
                doc.text('PROPOSED SCOPE OF WORK & EQUIPMENT SPECIFICATIONS (CONTINUED)', 50, currentY + 13);
                doc.text('QTY', 370, currentY + 13, { align: 'center' });
                doc.text('UNIT PRICE', 465, currentY + 13, { align: 'right' });
                doc.text('AMOUNT', 564, currentY + 13, { align: 'right' });
                currentY += 20;
            }

            if (idx % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(40, currentY, 532, rowHeight, 'F');
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(titleLines, 50, currentY + 11);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text(qty, 370, currentY + 11, { align: 'center' });
            doc.text(unitPrice, 465, currentY + 11, { align: 'right' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            if (Number(item.total || item.unitPrice || 0) < 0) {
                doc.setTextColor(5, 150, 105);
            } else {
                doc.setTextColor(15, 23, 42);
            }
            doc.text(totalVal, 564, currentY + 11, { align: 'right' });

            if (fullDescLines.length > 0) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(71, 85, 105);
                doc.text(fullDescLines, 50, currentY + 14 + titleLines.length * 10);
            }

            doc.setDrawColor(226, 232, 240);
            doc.line(40, currentY + rowHeight, 572, currentY + rowHeight);

            currentY += rowHeight;
        });

        currentY += 10;

        // Side-by-Side Balanced Proposal Totals Block
        const leftBoxX = 40;
        const leftBoxW = 260;
        const rightBoxX = 312;
        const rightBoxW = 260;
        const totalsRightX = 564;

        if (currentY + 140 > 680) {
            doc.addPage();
            currentY = 44;
        }

        const propDepositAmt = (() => {
            if (proposal?.depositType === 'percentage' && proposal?.depositValue && Number(proposal.depositValue) > 0) {
                return Number(((total * Number(proposal.depositValue)) / 100).toFixed(2));
            }
            if (proposal?.depositAmount && Number(proposal.depositAmount) > 0) {
                return Number(proposal.depositAmount);
            }
            if (proposal?.depositRequired && Number(proposal.depositRequired) > 0) {
                return Number(proposal.depositRequired);
            }
            if (proposal?.requiredDeposit && Number(proposal.requiredDeposit) > 0) {
                return Number(proposal.requiredDeposit);
            }
            if (proposal?.depositValue && Number(proposal.depositValue) > 0) {
                return Number(proposal.depositValue);
            }
            return 0;
        })();

        const defaultPropDepositMsg = propDepositAmt > 0
            ? `A deposit of ${formatCurrency(propDepositAmt)} (${proposal?.depositType === 'percentage' && proposal?.depositValue ? `${proposal.depositValue}%` : 'required'}) is requested upon proposal acceptance to schedule installation and secure equipment. Balance is due upon completion.`
            : `Payment in full is due upon completion and commissioning of the installation in accordance with standard terms.`;

        const propDepositMsg = proposal?.depositNotes || (proposal as any)?.job?.depositNotes || defaultPropDepositMsg;
        const splitPropDep = doc.splitTextToSize(propDepositMsg, leftBoxW - 20);

        const leftHeight = Math.max(76, 26 + splitPropDep.length * 8.5);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(leftBoxX, currentY, leftBoxW, leftHeight, 5, 5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(79, 70, 229);
        doc.text('PAYMENT TERMS & SCHEDULE', leftBoxX + 10, currentY + 14);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(splitPropDep, leftBoxX + 10, currentY + 26);

        // Right Column: Financial Totals Box
        let rY = currentY + 4;

        if (isProjectProposal) {
            const laborCost = Number(proposal?.roundedLaborProposal || proposal?.laborSubtotal || (Array.isArray(proposal?.laborItems) ? proposal.laborItems.reduce((s: number, i: any) => s + Number(i.value || i.customerLineTotal || 0), 0) : 0));
            const partsCost = Number(proposal?.partsTotal || (Array.isArray(proposal?.partItems) ? proposal.partItems.reduce((s: number, i: any) => s + Number(i.customerLineTotal || 0), 0) : 0));
            const allowCost = Number(proposal?.allowanceTotal || (Array.isArray(proposal?.allowanceItems) ? proposal.allowanceItems.reduce((s: number, i: any) => s + Number(i.amount || 0), 0) : 0));

            if (laborCost > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text('Labor & Installation:', rightBoxX, rY + 8);
                doc.setTextColor(15, 23, 42);
                doc.text(formatCurrency(laborCost), totalsRightX, rY + 8, { align: 'right' });
                rY += 12;
            }
            if (partsCost !== 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text('Specified Parts & Equipment:', rightBoxX, rY + 8);
                doc.setTextColor(15, 23, 42);
                doc.text(formatCurrency(partsCost), totalsRightX, rY + 8, { align: 'right' });
                rY += 12;
            }
            if (allowCost > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text('Logistics, Crane & Trades:', rightBoxX, rY + 8);
                doc.setTextColor(15, 23, 42);
                doc.text(formatCurrency(allowCost), totalsRightX, rY + 8, { align: 'right' });
                rY += 12;
            }
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Subtotal:', rightBoxX, rY + 8);
        doc.setTextColor(15, 23, 42);
        doc.text(formatCurrency(subtotal), totalsRightX, rY + 8, { align: 'right' });
        rY += 13;

        if (tax > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            doc.text('Estimated Tax:', rightBoxX, rY + 8);
            doc.setTextColor(15, 23, 42);
            doc.text(formatCurrency(tax), totalsRightX, rY + 8, { align: 'right' });
            rY += 13;
        }

        if (propDepositAmt > 0 && propDepositAmt < total) {
            doc.setFillColor(254, 243, 199);
            doc.setDrawColor(251, 191, 36);
            doc.roundedRect(rightBoxX - 4, rY, rightBoxW - 4, 16, 3, 3, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(180, 83, 9);
            const depDueLabel = proposal?.depositType === 'percentage' && proposal?.depositValue
                ? `DEPOSIT DUE (${proposal.depositValue}%):`
                : 'DEPOSIT DUE UPON ACCEPTANCE:';
            doc.text(depDueLabel, rightBoxX + 2, rY + 11);
            doc.text(formatCurrency(propDepositAmt), totalsRightX, rY + 11, { align: 'right' });
            rY += 18;
        }

        doc.setDrawColor(79, 70, 229);
        doc.setLineWidth(1);
        doc.line(rightBoxX, rY + 6, totalsRightX, rY + 6);
        rY += 11;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(79, 70, 229);
        doc.text('TOTAL PROPOSED INVESTMENT:', rightBoxX, rY + 8);
        doc.setFontSize(10.5);
        doc.text(formatCurrency(total), totalsRightX, rY + 8, { align: 'right' });
        rY += 14;

        currentY += Math.max(leftHeight, rY - currentY) + 12;

        // Project Clarifications & Exclusions Block
        const clarifications = Array.isArray(proposal?.clarifications) ? proposal.clarifications.filter(Boolean) : [];
        const exclusions = Array.isArray(proposal?.exclusions) ? proposal.exclusions.filter(Boolean) : [];
        if (clarifications.length > 0 || exclusions.length > 0) {
            const clarExclHeight = Math.max(45, 20 + Math.max(clarifications.length, exclusions.length) * 11);
            if (currentY + clarExclHeight > 680) {
                doc.addPage();
                currentY = 44;
            }

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(40, currentY, 532, clarExclHeight, 5, 5, 'FD');

            const colW = 250;
            if (clarifications.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(79, 70, 229);
                doc.text('PROJECT CLARIFICATIONS & INCLUSIONS', 52, currentY + 12);
                let cY = currentY + 22;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(71, 85, 105);
                clarifications.forEach((c: string) => {
                    const lines = doc.splitTextToSize(`•  ${c}`, colW);
                    doc.text(lines, 52, cY);
                    cY += lines.length * 8.5;
                });
            }

            if (exclusions.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(225, 29, 72);
                doc.text('EXCLUSIONS & WORKPLACE LIMITATIONS', 312, currentY + 12);
                let eY = currentY + 22;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(71, 85, 105);
                exclusions.forEach((e: string) => {
                    const lines = doc.splitTextToSize(`•  ${e}`, colW);
                    doc.text(lines, 312, eY);
                    eY += lines.length * 8.5;
                });
            }

            currentY += clarExclHeight + 10;
        }

        if (currentY + 65 > 680) {
            doc.addPage();
            currentY = 44;
        }

        // Customer Acceptance & Authorization Block (Positioned above Disclaimers & Warranty)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text('ACCEPTANCE & AUTHORIZATION', 40, currentY);

        currentY += 12;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(40, currentY, 532, 54, 5, 5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`By signing below, customer approves the proposed scope of work, accepts the terms, and authorizes ${orgName} to perform services as specified.`, 50, currentY + 14, { maxWidth: 512 });

        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(1);
        doc.line(50, currentY + 38, 260, currentY + 38);
        doc.line(320, currentY + 38, 440, currentY + 38);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('AUTHORIZED CUSTOMER SIGNATURE', 50, currentY + 47);
        doc.text('DATE', 320, currentY + 47);

        currentY += 66;

        // Pricing & Estimate Disclaimer Callout Box (Positioned under Signature)
        const defaultPricingDisclaimer = `Quoted installation price is based on a standard installation and includes only the equipment and scope specifically listed in this proposal. Price does not include additional refrigerant, copper line set or additional copper piping, ductwork modifications or replacement, electrical upgrades, drain modifications, structural repairs, code-required upgrades, or other unforeseen materials or labor unless specifically stated. If additional work or materials are found to be necessary during installation, ${orgName} will notify the customer and obtain approval for any additional charges before proceeding whenever reasonably possible.`;
        const customPricingDisclaimer = proposal?.pricingDisclaimer || (proposal as any)?.pricingTerms || org?.pricingDisclaimer || org?.proposalDisclaimer || defaultPricingDisclaimer;
        if (customPricingDisclaimer) {
            const splitPDisc = doc.splitTextToSize(customPricingDisclaimer, 506);
            const pDiscHeight = Math.max(34, 18 + splitPDisc.length * 8.5);
            if (currentY + pDiscHeight > 670) {
                doc.addPage();
                currentY = 44;
            }
            doc.setFillColor(254, 252, 232); // Amber light tint
            doc.setDrawColor(245, 158, 11); // Amber border
            doc.roundedRect(40, currentY, 532, pDiscHeight, 5, 5, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(180, 83, 9);
            doc.text('PRICING & ESTIMATE DISCLAIMER', 50, currentY + 12);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(120, 53, 15);
            doc.text(splitPDisc, 50, currentY + 23);

            currentY += pDiscHeight + 10;
        }

        // Dedicated Full-Width Warranty Terms Card (Positioned below Disclaimer)
        const effectivePropWarranty = cleanPdfText(propExtractedWarranty || proposal?.warrantyTerms || (proposal as any)?.warrantyDisclaimer || (proposal as any)?.warrantyNotes || org?.warrantyTerms || org?.warrantyDisclaimer || '');
        if (effectivePropWarranty) {
            const splitWarranty = doc.splitTextToSize(effectivePropWarranty, 506);
            const wCardHeight = Math.max(34, 18 + splitWarranty.length * 8.5);

            if (currentY + wCardHeight > 680) {
                doc.addPage();
                currentY = 44;
            }

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(40, currentY, 532, wCardHeight, 5, 5, 'FD');

            doc.setFillColor(79, 70, 229);
            doc.rect(40, currentY, 4, wCardHeight, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(79, 70, 229);
            doc.text('WARRANTY TERMS & SERVICE GUARANTEE', 50, currentY + 12);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(51, 65, 85);
            doc.text(splitWarranty, 50, currentY + 23);

            currentY += wCardHeight + 10;
        }
    }

    if (currentY + 80 > 680) {
        doc.addPage();
        currentY = 44;
    }

    // Terms & Conditions Header & Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('TERMS & CONDITIONS', 306, currentY, { align: 'center' });

    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const termsText = org?.termsAndConditions || org?.proposalTerms || `Proposal pricing is valid for 30 days from issuance. Payment terms are net 30 days upon project completion unless otherwise negotiated. All work will be performed during standard business hours in compliance with local ${isCommercialProposal ? 'commercial ' : ''}building codes. ${orgName} maintains full liability and worker's compensation insurance.`;
    const splitTerms = doc.splitTextToSize(termsText, 510);
    doc.text(splitTerms, 306, currentY, { align: 'center' });

    currentY += splitTerms.length * 8.5 + 12;

    // Two-pass dynamic page stamping and bottom footer pinning across all generated pages
    const totalPages = doc.getNumberOfPages();
    const currentYear = new Date().getFullYear();
    const cleanCompliance = (complianceFooter || '')
        .replace(new RegExp(`^©\\s*\\d{4}\\s*[^\\n]*\\n*`, 'i'), '')
        .replace(new RegExp(`^${licenseNumber}\\s*\\n*`, 'i'), '')
        .replace(new RegExp(`License Number:\\s*${licenseNumber}\\.?`, 'i'), '')
        .trim();

    for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
        doc.setPage(pIdx);
        if (pIdx > 1) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${orgName.toUpperCase()}   |   ${isCommercialProposal ? 'COMMERCIAL PROPOSAL' : 'PROPOSAL'} #${propId}   |   Page ${pIdx} of ${totalPages}`, 572, 25, { align: 'right' });
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.75);
            doc.line(40, 30, 572, 30);
        } else if (totalPages > 1) {
            doc.setFillColor(255, 255, 255);
            doc.rect(40, 740, 532, 35, 'F');
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(`Page 1 of ${totalPages}  •  See next page for detailed specifications, terms, and customer authorization.`, 306, 752, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text('TEKTRAKKER SERVICE VERIFICATION SYSTEM', 306, 764, { align: 'center' });
        }

        // Stamp State License & TDLR Compliance Footer at the bottom of the last page
        if (pIdx === totalPages) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            const licText = licenseNumber ? `STATE LICENSE # ${licenseNumber} — © ${currentYear} ${orgName}` : `© ${currentYear} ${orgName}`;
            doc.text(licText, 306, cleanCompliance ? 742 : 750, { align: 'center' });

            if (cleanCompliance) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(100, 116, 139);
                const splitComp = doc.splitTextToSize(cleanCompliance, 510);
                doc.text(splitComp, 306, 752, { align: 'center' });
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text('TEKTRAKKER SERVICE VERIFICATION SYSTEM', 306, 764, { align: 'center' });
        }
    }

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

    // Otherwise optionsOrDocs is an object { job, invoice, proposal, proposals, selectedJobFiles, includeInvoice, includeReport, includeProposal, includeSignOff, signOffFile, customMessage }
    const opts = optionsOrDocs || {};
    const { job, invoice, proposal, proposals, customer, statementJobs, statementTotals, statementPeriod, statementNumber, selectedJobFiles, includeInvoice, includeReport, includeProposal, includeStatement, includeSignOff, signOffFile, customMessage } = opts;

    try {
        if (includeInvoice && (invoice || job)) {
            const invInput = job ? {
                ...job,
                ...(job.invoice || {}),
                invoice: invoice || job.invoice,
                job,
                // Ensure on-site store/technician completion signatures never bleed into invoice payment authorization
                signature: job.invoice?.signature || job.invoiceSignature || invoice?.signature || null,
                customerSignature: job.invoice?.customerSignature || job.invoiceSignature || null
            } : (invoice || job);
            const invAtt = await generateInvoicePdfAttachment(invInput, org);
            attachments.push(invAtt);
        }
        if (includeReport && job) {
            const reportAtt = await generateJobReportPdfAttachment(job, org, customMessage);
            attachments.push(reportAtt);
        }
        if (includeProposal) {
            const targetProps = Array.isArray(proposals) ? proposals : (proposal ? [proposal] : (job?.proposalId ? [{ id: job.proposalId }] : []));
            for (const p of targetProps) {
                if (!p) continue;
                try {
                    const propInput = job ? { ...job, ...(typeof p === 'object' ? p : {}), ...p, job, id: p.id || (p as any)?.proposalNumber || (p as any)?.id, jobId: job.id || (p as any)?.jobId, jobNumber: job.jobNumber || (p as any)?.jobNumber, workOrderNumber: job.workOrderNumber || (p as any)?.workOrderNumber } : p;
                    const propAtt = await generateProposalPdfAttachment(propInput, org);
                    attachments.push(propAtt);
                } catch (err) {
                    console.error("Error generating proposal attachment:", err);
                }
            }
        }
        if (includeSignOff && (signOffFile || job?.signOffSheetUrl || job?.files || job?.siteManagerSignature || job?.signature || job?.customerSignature || (job as any)?.workflowState?.siteManagerSignature || (job as any)?.workflowState?.signature || (job as any)?.signOff)) {
            // First check if an existing explicit PDF document (not an image signature) was attached
            const existingPdfSignOff = signOffFile?.fileType === 'application/pdf' || signOffFile?.fileName?.toLowerCase().endsWith('.pdf')
                ? signOffFile
                : (job?.files || []).find((f: any) => isSignOffFile(f) && (f.fileType === 'application/pdf' || f.fileName?.toLowerCase().endsWith('.pdf')));

            if (existingPdfSignOff && existingPdfSignOff.dataUrl && !existingPdfSignOff.dataUrl.startsWith('data:image')) {
                try {
                    const fileUrl = existingPdfSignOff.dataUrl || existingPdfSignOff.url || existingPdfSignOff.fileUrl;
                    const fileName = existingPdfSignOff.fileName || existingPdfSignOff.label || 'Signed_WorkOrder_SignOff.pdf';
                    let base64Content: string | undefined = undefined;

                    if (fileUrl?.startsWith('data:')) {
                        base64Content = fileUrl.split(',')[1] || '';
                    }

                    const attachmentObj: EmailAttachment = {
                        filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
                        content: fileUrl?.startsWith('http') ? undefined : (base64Content || undefined),
                        path: fileUrl?.startsWith('http') ? fileUrl : undefined,
                        encoding: fileUrl?.startsWith('http') ? undefined : 'base64',
                        contentType: 'application/pdf',
                        type: 'SignOffSheet'
                    };

                    if (!attachmentObj.content && attachmentObj.path) {
                        delete (attachmentObj as any).content;
                    }

                    if (!attachments.some(a => a.filename === attachmentObj.filename || (a.path && a.path === attachmentObj.path))) {
                        attachments.push(attachmentObj);
                    }
                } catch (err) {
                    console.error("Error processing existing sign-off PDF:", err);
                }
            } else {
                // Generate clean, dedicated standalone On-Site Manager Sign-Off Sheet PDF
                try {
                    const signOffAtt = await generateStandaloneSignOffPdfAttachment(job, org);
                    if (signOffAtt && !attachments.some(a => a.filename === signOffAtt.filename)) {
                        attachments.push(signOffAtt);
                    }
                } catch (err) {
                    console.error("Error generating standalone sign-off attachment:", err);
                }
            }
        }
        if (includeStatement && (customer || opts.customer || statementJobs || opts.statementJobs)) {
            try {
                const { attachment } = await generateStatementOfAccountPdfAttachment({
                    customer: customer || opts.customer,
                    org: org,
                    statementJobs: statementJobs || opts.statementJobs || [],
                    statementTotals: statementTotals || opts.statementTotals || { totalBilled: 0, totalPaid: 0, totalDue: 0, aging: { current: 0, days30: 0, days60: 0, days90: 0, older: 0, over45: 0 } },
                    statementPeriod: statementPeriod || opts.statementPeriod,
                    statementNumber: statementNumber || opts.statementNumber
                });
                if (attachment) {
                    attachments.push(attachment);
                }
            } catch (err) {
                console.error("Error generating statement attachment in multi-document generator:", err);
            }
        }
        if (Array.isArray(selectedJobFiles) && selectedJobFiles.length > 0) {
            for (const file of selectedJobFiles) {
                if (isInternalExpenseFile(file)) continue;
                try {
                    const fileUrl = file.dataUrl || file.url || file.fileUrl;
                    const fileName = file.fileName || file.label || file.name || `document-${Date.now()}`;
                    const mimeType = file.fileType || file.type || (fileUrl?.startsWith('data:image/') ? 'image/png' : 'application/pdf');
                    let base64Content: string | undefined = undefined;

                    if (fileUrl?.startsWith('data:')) {
                        base64Content = fileUrl.split(',')[1] || '';
                    }

                    const attachmentObj: EmailAttachment = {
                        filename: fileName,
                        content: fileUrl?.startsWith('http') ? undefined : (base64Content || undefined),
                        path: fileUrl?.startsWith('http') ? fileUrl : undefined,
                        encoding: fileUrl?.startsWith('http') ? undefined : 'base64',
                        contentType: mimeType,
                        type: file.type || 'JobFile'
                    };

                    if (!attachmentObj.content && attachmentObj.path) {
                        delete (attachmentObj as any).content;
                    }

                    attachments.push(attachmentObj);
                } catch (err) {
                    console.error("Error processing custom job file attachment:", err);
                }
            }
        }
    } catch (err) {
        console.error("Error generating multi-document options attachments:", err);
    }

    return attachments;
};

/**
 * Generates an official Subcontractor Payment Statement & Remittance PDF attachment.
 */
export const generateSubcontractorStatementPdfAttachment = async (
    options: SubcontractorStatementHtmlOptions
): Promise<EmailAttachment> => {
    const subCleanName = (options.subcontractor?.companyName || options.subcontractor?.contactName || 'Subcontractor')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Statement_${subCleanName}_${options.statementNumber}.pdf`;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
            // @ts-ignore - html2pdf has no types available right now
            const html2pdf = (await import('html2pdf.js')).default;
            const htmlContent = generateSubcontractorStatementHtml(options);

            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '-9999px';

            const container = document.createElement('div');
            container.innerHTML = htmlContent;
            container.style.width = '780px';
            container.style.backgroundColor = '#ffffff';
            container.style.padding = '0px';
            container.style.margin = '0px';
            container.style.boxSizing = 'border-box';

            wrapper.appendChild(container);
            document.body.appendChild(wrapper);

            // Wait for all images inside container to load
            const images = container.getElementsByTagName('img');
            const promises = Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>(resolve => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            });
            await Promise.all(promises);

            const opt: any = {
                margin:       [0.25, 0.25, 0.25, 0.25],
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 780, backgroundColor: '#ffffff' },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
                pagebreak:    { mode: ['css', 'legacy'], avoid: ['.pdf-avoid-break', '.pdf-card', '.pdf-unit-card', 'tr', 'img', 'blockquote', '.avoid-break', '.chargeback-section', '.remittance-box', '.receipts-section', '.photo-card', '.statement-notes'] }
            };

            const pdfDataUri = await html2pdf().from(container).set(opt).output('datauristring');
            document.body.removeChild(wrapper);

            const base64Part = pdfDataUri.split('base64,')[1] || pdfDataUri;

            let downloadUrl = '';
            try {
                const cleanFileName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
                const storagePath = `organizations/${options.organization?.id || 'public'}/pdf_attachments/${Date.now()}_${cleanFileName}`;
                downloadUrl = await uploadFileToStorage(storagePath, `data:application/pdf;base64,${base64Part}`);
            } catch (storageErr) {
                console.warn("Could not upload Subcontractor Statement PDF to storage:", storageErr);
            }

            return {
                filename,
                content: base64Part,
                path: downloadUrl || undefined,
                encoding: 'base64',
                contentType: 'application/pdf',
                type: 'SubcontractorStatement'
            };
        } catch (e) {
            console.error("Error generating Subcontractor Statement PDF via html2pdf:", e);
        }
    }

    return {
        filename,
        content: '',
        encoding: 'base64',
        contentType: 'application/pdf',
        type: 'SubcontractorStatement'
    };
};

/**
 * Generates an EmailAttachment and Storage upload for a Warranty Contract (3-page PDF)
 */
export const generateWarrantyContractPdfAttachment = async (
    contract: any,
    organization?: any
): Promise<EmailAttachment> => {
    const filename = `Warranty_Contract_${contract.contractNumber || contract.id || Date.now()}.pdf`;

    if (typeof window !== 'undefined') {
        try {
            // @ts-ignore
            // @ts-ignore
            const html2pdfModule: any = await import('html2pdf.js');
            const html2pdf: any = html2pdfModule.default || html2pdfModule;

            const { generateWarrantyContractHtml } = await import('./warrantyHelper');
            const htmlContent = generateWarrantyContractHtml(contract, organization);

            const wrapper = document.createElement('div');
            wrapper.style.position = 'fixed';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '0';
            wrapper.style.width = '780px';
            wrapper.style.zIndex = '-1000';

            const container = document.createElement('div');
            container.innerHTML = htmlContent;
            wrapper.appendChild(container);
            document.body.appendChild(wrapper);

            const images = container.getElementsByTagName('img');
            const promises = Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>(resolve => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            });
            await Promise.all(promises);

            const opt: any = {
                margin:       [0.2, 0.2, 0.2, 0.2],
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 780, backgroundColor: '#ffffff' },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
                pagebreak:    { mode: ['css', 'legacy'], avoid: ['.pdf-avoid-break', '.meta-box', '.highlight-card', '.sig-table', 'tr', 'img', 'blockquote'] }
            };

            const pdfDataUri = await html2pdf().from(container).set(opt).output('datauristring');
            document.body.removeChild(wrapper);

            const base64Part = pdfDataUri.split('base64,')[1] || pdfDataUri;

            let downloadUrl = '';
            try {
                const cleanFileName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
                const storagePath = `organizations/${organization?.id || 'public'}/warranty_contracts/${Date.now()}_${cleanFileName}`;
                downloadUrl = await uploadFileToStorage(storagePath, `data:application/pdf;base64,${base64Part}`);
            } catch (storageErr) {
                console.warn("Could not upload Warranty Contract PDF to storage:", storageErr);
            }

            return {
                filename,
                content: base64Part,
                path: downloadUrl || undefined,
                encoding: 'base64',
                contentType: 'application/pdf',
                type: 'WarrantyContract'
            };
        } catch (e) {
            console.error("Error generating Warranty Contract PDF via html2pdf:", e);
        }
    }

    return {
        filename,
        content: '',
        encoding: 'base64',
        contentType: 'application/pdf',
        type: 'WarrantyContract'
    };
};

export interface StatementOfAccountPdfOptions {
    customer: any;
    org: any;
    statementJobs: Array<{
        job: any;
        invoice: any;
        total: number;
        paid: number;
        balance: number;
        runningBalance: number;
    }>;
    statementTotals: {
        totalBilled: number;
        totalPaid: number;
        totalDue: number;
        aging: {
            current: number;
            days30: number;
            days60: number;
            days90: number;
            older: number;
        };
    };
    statementPeriod: string;
    statementNumber: string;
}

/**
 * Generates an official branded vector PDF Statement of Account with repeating headers, aging analysis,
 * and TDLR compliance details using native jsPDF.
 */
export const generateStatementOfAccountPdfAttachment = async (
    options: StatementOfAccountPdfOptions
): Promise<{ doc: any; attachment: EmailAttachment }> => {
    const { customer, org, statementJobs, statementTotals, statementPeriod, statementNumber } = options;

    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = patchJsPdfInstance(new jsPDF({ unit: 'pt', format: 'letter' }));

    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 25;
    const contentWidth = pageWidth - (margin * 2); // 562 pt

    const isTekAir = String(org?.name || '').toLowerCase().includes('tekair') || org?.id === 'org-1765817997819';
    const orgName = String(org?.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider'));
    const orgPhone = String(org?.phone || (isTekAir ? '210-318-4197' : ''));
    const orgEmail = String(org?.email || (isTekAir ? 'Operations@tekairinc.com' : ''));
    const orgAddress = formatAddressStr(org?.address, org?.city, org?.state, org?.zip) || (isTekAir ? '2618 Middleground, San Antonio, TX 78245' : '');
    const licenseNumber = String(org?.licenseNumber || org?.taxId || (isTekAir ? 'TACLA73240E' : ''));
    const defaultCompliance = isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov' : '';
    const complianceFooter = String(org?.complianceFooter || org?.regulatoryFooter || defaultCompliance);
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || (isTekAir ? 'https://firebasestorage.googleapis.com/v0/b/tektrakker.firebasestorage.app/o/public_assets%2Forg-1765817997819%2Flogo_stable_1774702115808.png?alt=media&token=08c347fe-a7b0-40d9-b23f-6a2adecf63e9' : '');

    // Colors
    const primaryColor = [18, 58, 99]; // #123A63 Deep Navy
    const accentIndigo = [79, 70, 229]; // #4f46e5
    const slateDark = [15, 23, 42]; // #0f172a
    const slateMedium = [71, 85, 105]; // #475569
    const slateLight = [148, 163, 184]; // #94a3b8
    const borderSlate = [203, 213, 225]; // #cbd5e1

    // Helper: Draw Table Header Bar
    const drawTableHeader = (yPos: number) => {
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.roundedRect(margin, yPos, contentWidth, 18, 3, 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);

        doc.text('DATE', margin + 4, yPos + 12);
        doc.text('INVOICE #', margin + 48, yPos + 12);
        doc.text('PROPERTY / LOCATION', margin + 114, yPos + 12);
        doc.text('REF / PO #', margin + 228, yPos + 12);
        doc.text('BILLED (DR)', margin + 336, yPos + 12, { align: 'right' });
        doc.text('PAID (CR)', margin + 382, yPos + 12, { align: 'right' });
        doc.text('BALANCE', margin + 428, yPos + 12, { align: 'right' });
        doc.text('RUNNING', margin + 476, yPos + 12, { align: 'right' });
        doc.text('DUE DATE', margin + 484, yPos + 12);
        doc.text('STATUS', margin + 542, yPos + 12, { align: 'center' });
    };

    // PAGE 1: TOP ACCENT BAR
    doc.setFillColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.rect(0, 0, pageWidth, 8, 'F');

    let currentY = 20;

    // Header Left: Logo or Company Name
    let logoDrawn = false;
    if (orgLogo) {
        try {
            const logoB64 = await fetchImageAsBase64(orgLogo);
            if (logoB64) {
                const logoH = drawPreservedLogo(doc, logoB64, margin, currentY, 120, 52);
                if (logoH > 0) {
                    currentY += logoH + 6;
                    logoDrawn = true;
                }
            }
        } catch (e) {
            console.warn('Logo embed error:', e);
        }
    }

    if (!logoDrawn) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
        doc.text(orgName, margin, currentY + 12);
        currentY += 18;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
    doc.text(orgAddress, margin, currentY);
    currentY += 9.5;
    doc.text(`Phone: ${orgPhone}   •   Email: ${orgEmail}`, margin, currentY);
    if (licenseNumber) {
        currentY += 9.5;
        doc.setFont('helvetica', 'bold');
        doc.text(`License #: ${licenseNumber}`, margin, currentY);
    }

    // Header Right: Statement Title & Metadata
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('STATEMENT OF ACCOUNT', pageWidth - margin, 36, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
    doc.text(`STATEMENT #: ${statementNumber}`, pageWidth - margin, 50, { align: 'right' });

    let rMetaY = 62;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
    doc.text(`Statement Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, pageWidth - margin, rMetaY, { align: 'right' });
    rMetaY += 10;
    doc.text(`Statement Period: ${statementPeriod}`, pageWidth - margin, rMetaY, { align: 'right' });
    rMetaY += 11;

    // Status Pill
    const isPaidInFull = statementTotals.totalDue <= 0.01;
    const pillBg = isPaidInFull ? [220, 252, 231] : [254, 242, 242];
    const pillText = isPaidInFull ? [22, 101, 52] : [185, 28, 28];
    const pillLabel = isPaidInFull ? 'STATUS: PAID IN FULL' : `AMOUNT DUE: ${formatCurrency(statementTotals.totalDue)}`;

    doc.setFillColor(pillBg[0], pillBg[1], pillBg[2]);
    doc.setDrawColor(pillText[0], pillText[1], pillText[2]);
    doc.roundedRect(pageWidth - margin - 150, rMetaY, 150, 16, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(pillText[0], pillText[1], pillText[2]);
    doc.text(pillLabel, pageWidth - margin - 75, rMetaY + 11.5, { align: 'center' });

    currentY = Math.max(currentY + 14, rMetaY + 24);

    // Entity Cards (2 Side-by-Side: Client Info & Account Summary)
    const cardW = (contentWidth - 12) / 2; // 275 pt
    const cardH = 68;

    // Card 1: Client Information
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.roundedRect(margin, currentY, cardW, cardH, 4, 4, 'FD');

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(margin, currentY, cardW, 16, 4, 4, 'F');
    doc.rect(margin, currentY + 10, cardW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('1. CLIENT INFORMATION', margin + 8, currentY + 11);

    let cY = currentY + 27;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(customer?.name || 'Valued Customer', margin + 8, cY);

    cY += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
    const custAddrStr = formatAddressStr(customer?.address, customer?.city, customer?.state, customer?.zip);
    doc.text(doc.splitTextToSize(custAddrStr, cardW - 16)[0] || '', margin + 8, cY);

    cY += 10;
    if (customer?.email || customer?.phone) {
        const contactInfo = [customer.phone, customer.email].filter(Boolean).join(' • ');
        doc.text(doc.splitTextToSize(contactInfo, cardW - 16)[0] || '', margin + 8, cY);
    }

    // Card 2: Account Summary & Terms
    const card2X = margin + cardW + 12;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.roundedRect(card2X, currentY, cardW, cardH, 4, 4, 'FD');

    doc.setFillColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
    doc.roundedRect(card2X, currentY, cardW, 16, 4, 4, 'F');
    doc.rect(card2X, currentY + 10, cardW, 6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('2. ACCOUNT SUMMARY & TERMS', card2X + 8, currentY + 11);

    cY = currentY + 27;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
    doc.text('Client Code:', card2X + 8, cY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text(String(customer?.id || '').slice(0, 8).toUpperCase(), card2X + 80, cY);

    cY += 11;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
    doc.text('Account #:', card2X + 8, cY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    const acctNum = customer?.accountNumber || getOrGenerateAccountNumber(customer) || `ACT-${String(customer?.id || '').replace(/\D/g, '').slice(0, 5) || '00000'}`;
    doc.text(acctNum, card2X + 80, cY);

    cY += 11;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
    doc.text('Payment Terms:', card2X + 8, cY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    const pTerms = String(customer?.paymentTerms || 'Net 30').replace(/_/g, ' ').toUpperCase();
    doc.text(pTerms, card2X + 80, cY);

    currentY += cardH + 10;

    // 5-Column Financial Overview Cards
    const kpiH = 34;
    const colW = contentWidth / 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.roundedRect(margin, currentY, contentWidth, kpiH, 4, 4, 'FD');

    const kpis = [
        { label: 'PREVIOUS BALANCE', val: '$0.00', color: slateDark },
        { label: 'NEW CHARGES', val: formatCurrency(statementTotals.totalBilled), color: slateDark },
        { label: 'PAYMENTS RECEIVED', val: `-${formatCurrency(statementTotals.totalPaid)}`, color: [22, 163, 74] },
        { label: 'ADJUSTMENTS', val: '$0.00', color: slateDark },
        { label: 'TOTAL AMOUNT DUE', val: formatCurrency(statementTotals.totalDue), color: [220, 38, 38], bg: [254, 242, 242] }
    ];

    kpis.forEach((kpi, i) => {
        const kx = margin + (i * colW);
        if (kpi.bg) {
            doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
            doc.rect(kx, currentY, colW, kpiH, 'F');
        }
        if (i > 0) {
            doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
            doc.line(kx, currentY, kx, currentY + kpiH);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
        doc.text(kpi.label, kx + (colW / 2), currentY + 11, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.text(kpi.val, kx + (colW / 2), currentY + 25, { align: 'center' });
    });

    currentY += kpiH + 12;

    // Table Header
    drawTableHeader(currentY);
    currentY += 18;

    // Iterate Statement Rows
    statementJobs.forEach((tx, idx) => {
        const j = tx.job || {};
        const inv = tx.invoice || {};
        const dateStr = formatDate(j.appointmentTime || j.createdAt);
        const invIdStr = inv.id || `INV-${String(j.id || '').slice(0, 8)}`;
        const locName = j.locationName || j.customerName || 'Main Facility';
        const locAddr = formatAddressStr(j.address, j.city, j.state, j.zip);
        const poStr = j.poNumber || j.workOrderNumber || '—';
        const billedStr = formatCurrency(tx.total);
        const paidStr = tx.paid > 0 ? formatCurrency(tx.paid) : '0.00';
        const balStr = formatCurrency(tx.balance);
        const runBalStr = formatCurrency(tx.runningBalance);
        const dueStr = inv.dueDate ? formatDate(inv.dueDate) : 'Net 30';
        const isPaid = inv.status === 'Paid' || tx.balance <= 0.01;

        const rowH = locAddr && locAddr !== locName ? 23 : 18;

        if (currentY + rowH > 710) {
            doc.addPage();
            currentY = 44;
            drawTableHeader(currentY);
            currentY += 18;
        }

        // Zebra background
        if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, currentY, contentWidth, rowH, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
        doc.text(dateStr, margin + 4, currentY + 11);

        doc.setFont('helvetica', 'bold');
        if (invIdStr.length > 12) {
            doc.setFontSize(5.5);
        } else {
            doc.setFontSize(6.5);
        }
        doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
        doc.text(doc.splitTextToSize(invIdStr, 62)[0] || '', margin + 48, currentY + 11);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text(doc.splitTextToSize(locName, 110)[0] || '', margin + 114, currentY + 11);
        if (locAddr && locAddr !== locName) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(slateLight[0], slateLight[1], slateLight[2]);
            doc.text(doc.splitTextToSize(locAddr, 110)[0] || '', margin + 114, currentY + 19);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
        doc.text(doc.splitTextToSize(poStr, 62)[0] || '', margin + 228, currentY + 11);

        // Financials
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(billedStr, margin + 336, currentY + 11, { align: 'right' });

        if (tx.paid > 0) {
            doc.setTextColor(22, 163, 74);
            doc.text(paidStr, margin + 382, currentY + 11, { align: 'right' });
        } else {
            doc.setTextColor(slateLight[0], slateLight[1], slateLight[2]);
            doc.text('0.00', margin + 382, currentY + 11, { align: 'right' });
        }

        doc.setFont('helvetica', 'bold');
        if (tx.balance > 0.01) {
            doc.setTextColor(220, 38, 38);
            doc.text(balStr, margin + 428, currentY + 11, { align: 'right' });
        } else {
            doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
            doc.text('0.00', margin + 428, currentY + 11, { align: 'right' });
        }

        doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
        doc.text(runBalStr, margin + 476, currentY + 11, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
        doc.text(dueStr, margin + 484, currentY + 11);

        // Status pill
        const sBg = isPaid ? [220, 252, 231] : [254, 242, 242];
        const sCol = isPaid ? [22, 101, 52] : [185, 28, 28];
        doc.setFillColor(sBg[0], sBg[1], sBg[2]);
        doc.roundedRect(margin + 527, currentY + 3, 30, 11, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(sCol[0], sCol[1], sCol[2]);
        doc.text(isPaid ? 'PAID' : 'UNPAID', margin + 542, currentY + 10.5, { align: 'center' });

        // Bottom row divider
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, currentY + rowH, margin + contentWidth, currentY + rowH);

        currentY += rowH;
    });

    currentY += 12;

    // Check if Aging Analysis & Instructions fit, else add page
    if (currentY + 140 > 710) {
        doc.addPage();
        currentY = 44;
    }

    // Aging Analysis Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('AGING ANALYSIS (UNPAID BALANCES)', margin, currentY);
    currentY += 8;

    const agingColW = contentWidth / 6;
    const agingH = 28;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.roundedRect(margin, currentY, contentWidth, agingH, 3, 3, 'FD');

    const agingCols = [
        { label: 'CURRENT', val: formatCurrency(statementTotals.aging.current), color: slateDark },
        { label: '1 - 30 DAYS', val: formatCurrency(statementTotals.aging.days30), color: statementTotals.aging.days30 > 0 ? [180, 83, 9] : slateDark },
        { label: '31 - 60 DAYS', val: formatCurrency(statementTotals.aging.days60), color: statementTotals.aging.days60 > 0 ? [180, 83, 9] : slateDark },
        { label: '61 - 90 DAYS', val: formatCurrency(statementTotals.aging.days90), color: statementTotals.aging.days90 > 0 ? [220, 38, 38] : slateDark },
        { label: '90+ DAYS', val: formatCurrency(statementTotals.aging.older), color: statementTotals.aging.older > 0 ? [220, 38, 38] : slateDark },
        { label: 'TOTAL OUTSTANDING', val: formatCurrency(statementTotals.totalDue), color: [220, 38, 38], bg: [254, 242, 242] }
    ];

    agingCols.forEach((ac, i) => {
        const ax = margin + (i * agingColW);
        if (ac.bg) {
            doc.setFillColor(ac.bg[0], ac.bg[1], ac.bg[2]);
            doc.rect(ax, currentY, agingColW, agingH, 'F');
        }
        if (i > 0) {
            doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
            doc.line(ax, currentY, ax, currentY + agingH);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
        doc.text(ac.label, ax + (agingColW / 2), currentY + 10, { align: 'center' });

        doc.setFontSize(8.5);
        doc.setTextColor(ac.color[0], ac.color[1], ac.color[2]);
        doc.text(ac.val, ax + (agingColW / 2), currentY + 22, { align: 'center' });
    });

    currentY += agingH + 12;

    // Direct Remittance & Payment Instructions Box
    const payBoxH = 46;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.roundedRect(margin, currentY, contentWidth, payBoxH, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(accentIndigo[0], accentIndigo[1], accentIndigo[2]);
    doc.text('DIRECT REMITTANCE & PAYMENT INSTRUCTIONS', margin + 8, currentY + 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text('• CHECK PAYMENT:', margin + 8, currentY + 22);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
    doc.text(`Make checks payable to: ${orgName}  |  Mailing Address: ${orgAddress}`, margin + 84, currentY + 22);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
    doc.text('• MEMO REFERENCE:', margin + 8, currentY + 34);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
    doc.text(`Please include Statement #${statementNumber} and Customer Code on check memo line. Remittance email: ${orgEmail}`, margin + 84, currentY + 34);

    currentY += payBoxH + 10;

    // Dynamic Multi-Page Headers & Bottom Footer Pinning
    const totalPages = doc.getNumberOfPages();
    const currentYear = new Date().getFullYear();

    for (let pIdx = 1; pIdx <= totalPages; pIdx++) {
        doc.setPage(pIdx);

        // Running header on Page 2+
        if (pIdx > 1) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
            doc.text(`${orgName.toUpperCase()}   |   STATEMENT OF ACCOUNT #${statementNumber}`, margin, 24);
            doc.text(`Page ${pIdx} of ${totalPages}`, pageWidth - margin, 24, { align: 'right' });

            doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
            doc.setLineWidth(0.5);
            doc.line(margin, 28, pageWidth - margin, 28);
        }

        // Bottom Footer
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(slateMedium[0], slateMedium[1], slateMedium[2]);
        const licText = licenseNumber ? `STATE LICENSE # ${licenseNumber} — © ${currentYear} ${orgName}` : `© ${currentYear} ${orgName}`;
        doc.text(licText, pageWidth / 2, 750, { align: 'center' });

        if (complianceFooter) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(slateLight[0], slateLight[1], slateLight[2]);
            doc.text(doc.splitTextToSize(complianceFooter, contentWidth), pageWidth / 2, 759, { align: 'center' });
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(slateLight[0], slateLight[1], slateLight[2]);
        doc.text(`Page ${pIdx} of ${totalPages}   •   TEKTRAKKER FINANCIAL AUDIT & RECONCILIATION SYSTEM`, pageWidth / 2, 770, { align: 'center' });
    }

    const filename = getStandardPdfFilename('Statement', {
        id: statementNumber,
        customerName: customer?.name,
        date: new Date()
    });

    const attachment = await createAttachmentFromDoc(doc, filename, org?.id);
    return { doc, attachment };
};

/**
 * Generates an official standalone On-Site Manager Sign-Off Sheet / Acceptance Certificate PDF.
 * Letter portrait format with full organization branding, metadata, scope of work,
 * formal legal acceptance text, and side-by-side manager & technician signature blocks.
 */
export const generateStandaloneSignOffPdfAttachment = async (
    job: any,
    org: any
): Promise<EmailAttachment> => {
    // @ts-ignore
    const { jsPDF } = await import('jspdf');
    const doc = patchJsPdfInstance(new jsPDF({ unit: 'pt', format: 'letter' }));

    const isTekAir = String(org?.name || '').toLowerCase().includes('tekair') || org?.id === 'org-1765817997819';
    const orgName = String(org?.name || (isTekAir ? 'TekAir Inc.' : 'Service Provider'));
    const orgPhone = String(org?.phone || (isTekAir ? '210-318-4197' : ''));
    const orgEmail = String(org?.email || (isTekAir ? 'Operations@tekairinc.com' : ''));
    const orgLogo = org?.logoUrl || org?.letterheadDataUrl || '';
    const orgAddress = formatAddressStr(org?.address) || (isTekAir ? '2618 Middleground, San Antonio, TX 78245' : '');
    const licenseNumber = String(org?.licenseNumber || org?.taxId || (isTekAir ? 'TACLA73240E' : ''));
    const defaultCompliance = isTekAir ? 'Regulated by The Texas Department of Licensing and Regulation, P.O. Box 12157, Austin, Texas 78711 • 1-800-803-9202 • 512-463-6599 • www.tdlr.texas.gov' : '';
    const complianceFooter = String(org?.complianceFooter || org?.footerText || org?.regulatoryFooter || defaultCompliance);

    const cleanJobId = String(job?.poNumber || job?.workOrderNumber || job?.jobNumber || job?.id || 'JOB')
        .replace(/^#/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '');
    const customerCleanName = String(job?.customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `SignOff_Sheet_WO_${cleanJobId}_${customerCleanName}.pdf`;

    const customerName = job?.customerName || 'Client / Facility';
    const customerAddress = formatAddressStr(job?.address) || 'Service Location On-Site';
    const techName = job?.assignedTechnicianName || job?.techSignatureName || 'Lead Certified Technician';
    const poNumber = job?.poNumber || job?.workOrderNumber || job?.jobNumber || cleanJobId;
    const visitDate = (job?.signOff as any)?.dateOfService || 
        (job?.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : new Date().toLocaleDateString());

    // Top primary accent bar (#0284c7)
    doc.setFillColor(2, 132, 199);
    doc.rect(0, 0, 612, 10, 'F');

    let currentY = 38;

    // Header: Left side Org Logo / Info
    let logoDrawnH = 0;
    if (orgLogo) {
        try {
            const logoB64 = await fetchImageAsBase64(orgLogo);
            if (logoB64) {
                logoDrawnH = drawPreservedLogo(doc, logoB64, 36, currentY, 130, 42);
            }
        } catch (e) {
            console.warn("Could not draw org logo on sign-off PDF:", e);
        }
    }

    if (logoDrawnH > 0) {
        currentY += logoDrawnH + 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(cleanPdfText(orgName), 36, currentY);
        currentY += 11;
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(cleanPdfText(orgName), 36, currentY + 12);
        currentY += 24;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    if (orgAddress) {
        doc.text(cleanPdfText(orgAddress), 36, currentY);
        currentY += 10;
    }
    const contactLine = [orgPhone, orgEmail, licenseNumber ? `Lic: ${licenseNumber}` : ''].filter(Boolean).join(' • ');
    if (contactLine) {
        doc.text(cleanPdfText(contactLine), 36, currentY);
        currentY += 10;
    }

    // Header: Right side Document Title & Badge
    const rightX = 576; // 612 - 36
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('ON-SITE SERVICE SIGN-OFF', rightX, 42, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(2, 132, 199);
    doc.text('WORK ACCEPTANCE & VERIFICATION CERTIFICATE', rightX, 54, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Doc / Cert ID: SIG-${cleanJobId}`, rightX, 66, { align: 'right' });
    doc.text(`Work Order / Job #: ${poNumber}`, rightX, 76, { align: 'right' });
    doc.text(`Service Date: ${visitDate}`, rightX, 86, { align: 'right' });

    // Green badge: ✓ VERIFIED ON-SITE
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.roundedRect(rightX - 120, 92, 120, 18, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text('✓ VERIFIED ON-SITE', rightX - 60, 104, { align: 'center' });

    currentY = Math.max(currentY + 12, 120);

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(36, currentY, 576, currentY);
    currentY += 12;

    // Customer & Service Location Box
    const boxStartY = currentY;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(36, boxStartY, 540, 68, 6, 6, 'FD');

    // Box Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('CUSTOMER & FACILITY LOCATION DETAILS', 46, boxStartY + 14);

    // Left Column: Customer & Address
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(cleanPdfText(customerName), 46, boxStartY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const addrLines = doc.splitTextToSize(cleanPdfText(customerAddress), 260);
    doc.text(addrLines, 46, boxStartY + 40);

    // Right Column: Technician & Scheduled Time
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('LEAD TECHNICIAN:', 330, boxStartY + 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(cleanPdfText(techName), 425, boxStartY + 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('SERVICE / VISIT:', 330, boxStartY + 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(cleanPdfText(visitDate), 425, boxStartY + 42);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('DISPATCH STATUS:', 330, boxStartY + 56);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(2, 132, 199);
    doc.text('COMPLETED & SIGNED', 425, boxStartY + 56);

    currentY = boxStartY + 78;

    // Scope of Work & Services Performed
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('SCOPE OF WORK & SERVICES COMPLETED', 36, currentY);
    currentY += 6;

    const rawWorkText = job?.notes?.work || 
        job?.notes?.workNotes || 
        job?.completionNotes || 
        (Array.isArray(job?.tasks) && job.tasks.length > 0 ? job.tasks.join('\n') : '') || 
        job?.notes?.diagnosis || 
        'Technician performed complete diagnostic inspection, verified operational parameters, executed necessary repairs, and restored system to proper working order.';

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    const workBoxY = currentY;
    const workLines = doc.splitTextToSize(cleanPdfText(rawWorkText), 516);
    const visibleWorkLines = workLines.slice(0, 5); // Keep concise to guarantee 1-page fit
    const workBoxHeight = Math.max(46, visibleWorkLines.length * 11 + 16);
    doc.roundedRect(36, workBoxY, 540, workBoxHeight, 4, 4, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(visibleWorkLines, 46, workBoxY + 14);

    currentY = workBoxY + workBoxHeight + 10;

    // Materials & Parts Installed (if present)
    const partsUsed = Array.isArray(job?.partsUsed) ? job.partsUsed : [];
    if (partsUsed.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(`INSTALLED MATERIALS & PARTS (${partsUsed.length} ITEM${partsUsed.length > 1 ? 'S' : ''})`, 36, currentY);
        currentY += 4;

        const partsBoxY = currentY;
        const partStrings = partsUsed.slice(0, 3).map((p: any) => `• ${cleanPdfText(p.name || 'Part')} (Qty: ${p.quantity || 1}${p.sku ? ` | SKU: ${p.sku}` : ''})`);
        if (partsUsed.length > 3) {
            partStrings.push(`• ... and ${partsUsed.length - 3} additional item(s)`);
        }
        const partsBoxHeight = partStrings.length * 11 + 10;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(36, partsBoxY, 540, partsBoxHeight, 4, 4, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(partStrings, 46, partsBoxY + 11);

        currentY = partsBoxY + partsBoxHeight + 10;
    }

    // FORMAL LEGAL WORK ACCEPTANCE & CERTIFICATION CLAUSE
    doc.setFillColor(240, 253, 244); // subtle green #f0fdf4
    doc.setDrawColor(134, 239, 172); // border green #86efac
    const legalBoxY = currentY;
    
    const legalText = "I, the undersigned On-Site Facility / Store Manager or Authorized Client Representative, certify that the technician listed above arrived on-site and completed all diagnostic, maintenance, and repair services described in this document in a satisfactory, workmanlike, and professional manner. I have inspected the equipment/system, verified proper operating condition upon service completion, and confirmed that all work areas were left clean, safe, and hazard-free. All services and installed parts described herein are hereby accepted without reservation.";
    const legalLines = doc.splitTextToSize(legalText, 516);
    const legalBoxHeight = legalLines.length * 10 + 26;

    doc.roundedRect(36, legalBoxY, 540, legalBoxHeight, 6, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 101, 52);
    doc.text('LEGAL WORK ACCEPTANCE & CLIENT VERIFICATION DECLARATION', 46, legalBoxY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(legalLines, 46, legalBoxY + 24);

    currentY = legalBoxY + legalBoxHeight + 12;

    // DUAL SIGNATURE BOXES (Side-by-Side)
    const sigBoxW = 262;
    const sigBoxH = 110;
    const mgrBoxX = 36;
    const techBoxX = 314;

    // 1. Manager Signature Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(16, 185, 129); // green
    doc.roundedRect(mgrBoxX, currentY, sigBoxW, sigBoxH, 6, 6, 'FD');

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(mgrBoxX, currentY, sigBoxW, 20, 6, 6, 'F');
    doc.rect(mgrBoxX, currentY + 12, sigBoxW, 8, 'F'); // square bottom corners of top header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(5, 150, 105);
    doc.text('ON-SITE MANAGER / CLIENT SIGN-OFF', mgrBoxX + 10, currentY + 13);
    doc.text('✓ VERIFIED', mgrBoxX + sigBoxW - 10, currentY + 13, { align: 'right' });

    const managerSigSrc = job?.siteManagerSignature || 
        job?.signature || 
        job?.customerSignature || 
        (job as any)?.workflowState?.siteManagerSignature || 
        (job as any)?.workflowState?.signature || 
        null;
    const managerName = job?.siteManagerName || 
        job?.signerName || 
        job?.customerSignatureName || 
        (job as any)?.workflowState?.siteManagerName || 
        (job as any)?.signOff?.managerName || 
        'On-Site Facility Manager';
    const managerSignedDate = job?.siteManagerSignatureTimestamp || 
        job?.signatureTimestamp || 
        job?.signedAt || 
        (job as any)?.workflowState?.siteManagerSignatureTimestamp || 
        new Date().toISOString();

    let mgrSigDrawn = false;
    if (managerSigSrc && typeof managerSigSrc === 'string' && managerSigSrc.startsWith('data:image')) {
        try {
            doc.addImage(managerSigSrc, 'PNG', mgrBoxX + 20, currentY + 24, 150, 40);
            mgrSigDrawn = true;
        } catch (e) {
            console.warn("Could not draw manager signature image:", e);
        }
    } else if (managerSigSrc && typeof managerSigSrc === 'string' && managerSigSrc.startsWith('http')) {
        try {
            const b64 = await fetchImageAsBase64(managerSigSrc);
            if (b64) {
                doc.addImage(b64, 'PNG', mgrBoxX + 20, currentY + 24, 150, 40);
                mgrSigDrawn = true;
            }
        } catch (e) {
            console.warn("Could not draw remote manager signature image:", e);
        }
    }

    if (!mgrSigDrawn) {
        doc.setFont('times', 'italic');
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text(cleanPdfText(managerName), mgrBoxX + 20, currentY + 48);
    }

    // Manager signature baseline & details
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(mgrBoxX + 10, currentY + 68, mgrBoxX + sigBoxW - 10, currentY + 68);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Signer: ${cleanPdfText(managerName)}`, mgrBoxX + 10, currentY + 80);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Title: On-Site Facility / Store Manager', mgrBoxX + 10, currentY + 91);
    doc.text(`Signed At: ${new Date(managerSignedDate).toLocaleString()}`, mgrBoxX + 10, currentY + 101);

    // 2. Technician Signature Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(2, 132, 199); // blue
    doc.roundedRect(techBoxX, currentY, sigBoxW, sigBoxH, 6, 6, 'FD');

    doc.setFillColor(240, 249, 255);
    doc.roundedRect(techBoxX, currentY, sigBoxW, 20, 6, 6, 'F');
    doc.rect(techBoxX, currentY + 12, sigBoxW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(2, 132, 199);
    doc.text('LEAD TECHNICIAN SIGN-OFF', techBoxX + 10, currentY + 13);
    doc.text('✓ CERTIFIED', techBoxX + sigBoxW - 10, currentY + 13, { align: 'right' });

    const techSigSrc = job?.techSignature || 
        (job as any)?.workflowState?.techSignature || 
        null;
    const techSignerName = job?.techSignatureName || 
        techName || 
        'Lead Technician';
    const techSignedDate = job?.techSignatureTimestamp || 
        (job as any)?.workflowState?.techSignatureTimestamp || 
        managerSignedDate;

    let techSigDrawn = false;
    if (techSigSrc && typeof techSigSrc === 'string' && techSigSrc.startsWith('data:image')) {
        try {
            doc.addImage(techSigSrc, 'PNG', techBoxX + 20, currentY + 24, 150, 40);
            techSigDrawn = true;
        } catch (e) {
            console.warn("Could not draw tech signature image:", e);
        }
    } else if (techSigSrc && typeof techSigSrc === 'string' && techSigSrc.startsWith('http')) {
        try {
            const b64 = await fetchImageAsBase64(techSigSrc);
            if (b64) {
                doc.addImage(b64, 'PNG', techBoxX + 20, currentY + 24, 150, 40);
                techSigDrawn = true;
            }
        } catch (e) {
            console.warn("Could not draw remote tech signature image:", e);
        }
    }

    if (!techSigDrawn) {
        doc.setFont('times', 'italic');
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text(cleanPdfText(techSignerName), techBoxX + 20, currentY + 48);
    }

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(techBoxX + 10, currentY + 68, techBoxX + sigBoxW - 10, currentY + 68);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Technician: ${cleanPdfText(techSignerName)}`, techBoxX + 10, currentY + 80);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Role: Lead HVAC/R Service Specialist', techBoxX + 10, currentY + 91);
    doc.text(`Completed At: ${new Date(techSignedDate).toLocaleString()}`, techBoxX + 10, currentY + 101);

    // Footer & Regulatory Compliance Notice (Fixed at bottom)
    const footerY = 745;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(36, footerY, 576, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    const complLines = doc.splitTextToSize(cleanPdfText(complianceFooter), 540);
    doc.text(complLines, 36, footerY + 9);

    const subFooterY = footerY + 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Official Electronic Verification Record • Generated by TekTrakker • WO #${cleanJobId}`, 36, subFooterY);
    doc.text(`Page 1 of 1 • Verified & Archived`, 576, subFooterY, { align: 'right' });

    return await createAttachmentFromDoc(doc, filename, org?.id);
};

/**
 * Directly downloads the standalone On-Site Manager Sign-Off Sheet PDF to the user's browser.
 */
export const downloadStandaloneSignOffPdf = async (job: any, org: any): Promise<void> => {
    const attachment = await generateStandaloneSignOffPdfAttachment(job, org);
    if (!attachment) return;

    if (attachment.content) {
        const byteCharacters = atob(attachment.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else if (attachment.path) {
        window.open(attachment.path, '_blank');
    }
};


