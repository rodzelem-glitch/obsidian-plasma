import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Job } from '../types/job';
import { isHvacTrade } from './tradeResolver';

interface FillablePdfOptions {
  job?: Job | null;
  organization?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: any;
  } | null;
}

export async function generateInteractiveFillablePdf({ job, organization }: FillablePdfOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Standard 8.5" x 11" Letter size in points (72 points/inch)
  const form = pdfDoc.getForm();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const orgName = organization?.name || 'TEKAIR INC.';
  const orgPhone = organization?.phone || '2103184197';
  const orgEmail = organization?.email || 'Operations@tekairinc.com';

  const customerName = job?.customerName || '';
  const customerPhone = job?.customerPhone || '';
  const customerEmail = job?.customerEmail || '';
  const serviceAddress = typeof job?.address === 'string'
    ? job.address
    : (job?.address ? `${job.address.street || ''}, ${job.address.city || ''} ${job.address.state || ''}` : '');
  const workOrderNo = job?.workOrderNumber || job?.poNumber || job?.id || '';
  const appointmentDate = job?.appointmentTime ? new Date(job.appointmentTime).toLocaleDateString() : '';
  const appointmentTime = job?.appointmentTime ? new Date(job.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  // Background page border
  page.drawRectangle({
    x: 18,
    y: 18,
    width: 576,
    height: 756,
    borderColor: rgb(0.1, 0.15, 0.25),
    borderWidth: 2,
  });

  // HEADER SECTION
  const logoUrl = (organization as any)?.logoUrl || (organization as any)?.logo || (organization as any)?.letterheadDataUrl;
  let textX = 30;
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      const imgBuffer = await response.arrayBuffer();
      const isPng = logoUrl.toLowerCase().includes('.png') || logoUrl.startsWith('data:image/png');
      const embeddedImg = isPng ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
      const dims = embeddedImg.scaleToFit(110, 26);
      page.drawImage(embeddedImg, {
        x: 30,
        y: 745,
        width: dims.width,
        height: dims.height,
      });
      textX = 35 + dims.width;
    } catch (e) {
      console.warn("Logo embedding failed:", e);
    }
  }

  page.drawText(orgName, { x: textX, y: 755, size: 14, font: boldFont, color: rgb(0.1, 0.15, 0.25) });
  page.drawText(`${orgPhone} | ${orgEmail}`, { x: 30, y: 735, size: 9, font, color: rgb(0.3, 0.35, 0.4) });
  page.drawText('Official Fillable & Printable Field Inspection Work Order', { x: 30, y: 723, size: 8, font, color: rgb(0.5, 0.55, 0.6) });

  // HEADER BADGE & WO/DATE
  page.drawRectangle({ x: 440, y: 748, width: 140, height: 18, color: rgb(0.1, 0.15, 0.25) });
  page.drawText('FIELD SERVICE FORM', { x: 452, y: 753, size: 9, font: boldFont, color: rgb(1, 1, 1) });

  page.drawText('WO / PO #:', { x: 440, y: 732, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  const woField = form.createTextField('workOrderNo');
  woField.setText(workOrderNo);
  woField.addToPage(page, { x: 495, y: 728, width: 85, height: 14, borderWidth: 0 });

  page.drawText('Date:', { x: 440, y: 715, size: 9, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  const dateField = form.createTextField('appointmentDate');
  dateField.setText(appointmentDate);
  dateField.addToPage(page, { x: 470, y: 711, width: 110, height: 14, borderWidth: 0 });

  page.drawLine({ start: { x: 25, y: 702 }, end: { x: 587, y: 702 }, thickness: 1.5, color: rgb(0.2, 0.2, 0.2) });

  // CUSTOMER & SITE LOCATION BOX
  page.drawRectangle({ x: 25, y: 625, width: 562, height: 70, borderColor: rgb(0.2, 0.25, 0.35), borderWidth: 1.5, color: rgb(0.97, 0.98, 0.99) });
  page.drawText('CUSTOMER INFORMATION', { x: 32, y: 682, size: 8, font: boldFont, color: rgb(0.3, 0.35, 0.4) });

  page.drawText('Name:', { x: 32, y: 665, size: 9, font: boldFont });
  const custNameField = form.createTextField('customerName');
  custNameField.setText(customerName);
  custNameField.addToPage(page, { x: 65, y: 661, width: 220, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('Phone:', { x: 32, y: 647, size: 9, font: boldFont });
  const custPhoneField = form.createTextField('customerPhone');
  custPhoneField.setText(customerPhone);
  custPhoneField.addToPage(page, { x: 65, y: 643, width: 220, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('Email:', { x: 32, y: 629, size: 9, font: boldFont });
  const custEmailField = form.createTextField('customerEmail');
  custEmailField.setText(customerEmail);
  custEmailField.addToPage(page, { x: 65, y: 625, width: 220, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('SERVICE SITE ADDRESS', { x: 310, y: 682, size: 8, font: boldFont, color: rgb(0.3, 0.35, 0.4) });

  page.drawText('Site:', { x: 310, y: 665, size: 9, font: boldFont });
  const siteField = form.createTextField('serviceAddress');
  siteField.setText(serviceAddress);
  siteField.addToPage(page, { x: 340, y: 661, width: 240, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('Time:', { x: 310, y: 647, size: 9, font: boldFont });
  const timeField = form.createTextField('appointmentTime');
  timeField.setText(appointmentTime);
  timeField.addToPage(page, { x: 340, y: 643, width: 240, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('Visit:', { x: 310, y: 629, size: 9, font: boldFont });
  const visitField = form.createTextField('visitType');
  visitField.setText(job?.visitType || 'Diagnostic & Repair');
  visitField.addToPage(page, { x: 340, y: 625, width: 240, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  // EQUIPMENT & SYSTEM HEALTH
  page.drawRectangle({ x: 25, y: 550, width: 562, height: 68, borderColor: rgb(0.2, 0.25, 0.35), borderWidth: 1.5 });
  page.drawText('EQUIPMENT & ASSET IDENTIFICATION', { x: 32, y: 605, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

  page.drawText('Unit Location / Area:', { x: 32, y: 590, size: 8, font });
  const unitLocField = form.createTextField('unitLocation');
  unitLocField.setText(job?.unitStates?.[0]?.assetId || '');
  unitLocField.addToPage(page, { x: 32, y: 574, width: 125, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('Brand / Manufacturer:', { x: 170, y: 590, size: 8, font });
  const brandField = form.createTextField('brand');
  brandField.setText(job?.hvacBrand || '');
  brandField.addToPage(page, { x: 170, y: 574, width: 125, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('Model Number (M/N):', { x: 308, y: 590, size: 8, font });
  const modelField = form.createTextField('modelNo');
  modelField.addToPage(page, { x: 308, y: 574, width: 125, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('Serial Number (S/N):', { x: 446, y: 590, size: 8, font });
  const serialField = form.createTextField('serialNo');
  serialField.addToPage(page, { x: 446, y: 574, width: 135, height: 14, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('System Health:', { x: 32, y: 556, size: 8, font: boldFont });
  page.drawText('[  ] GOOD   [  ] FAIR   [  ] POOR   [  ] CRITICAL', { x: 110, y: 556, size: 8, font });

  // GAUGE & DIAGNOSTIC READINGS GRID
  const isHvac = isHvacTrade(job, organization);

  page.drawRectangle({ x: 25, y: 445, width: 562, height: 98, borderColor: rgb(0.2, 0.25, 0.35), borderWidth: 1.5 });
  page.drawText(isHvac ? 'FIELD GAUGE & REFRIGERANT TOOL READINGS' : 'FIELD EQUIPMENT & DIAGNOSTIC TOOL READINGS', { x: 32, y: 531, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

  if (isHvac) {
    const gaugeFields = [
      { label: 'HIGH PRESSURE', name: 'highPressure', unit: 'PSI', x: 32 },
      { label: 'LOW PRESSURE', name: 'lowPressure', unit: 'PSI', x: 125 },
      { label: 'LIQUID TEMP', name: 'liquidTemp', unit: '°F', x: 218 },
      { label: 'SUCTION TEMP', name: 'suctionTemp', unit: '°F', x: 311 },
      { label: 'SUPERHEAT', name: 'superheat', unit: '°F', x: 404 },
      { label: 'SUBCOOLING', name: 'subcooling', unit: '°F', x: 497 },
    ];

    gaugeFields.forEach(g => {
      page.drawText(g.label, { x: g.x, y: 518, size: 7, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
      const f = form.createTextField(g.name);
      f.addToPage(page, { x: g.x, y: 502, width: 60, height: 14, borderWidth: 0.5, borderColor: rgb(0.6, 0.6, 0.6) });
      page.drawText(g.unit, { x: g.x + 65, y: 505, size: 8, font: boldFont });
    });

    const row2Fields = [
      { label: 'AMBIENT TEMP', name: 'ambientTemp', unit: '°F', x: 32 },
      { label: 'SUPPLY TEMP', name: 'supplyTemp', unit: '°F', x: 125 },
      { label: 'RETURN TEMP', name: 'returnTemp', unit: '°F', x: 218 },
      { label: 'DELTA T', name: 'deltaT', unit: '°F', x: 311 },
      { label: 'VOLTAGE', name: 'voltage', unit: 'V', x: 404 },
      { label: 'AMPERAGE', name: 'amps', unit: 'A', x: 497 },
    ];

    row2Fields.forEach(g => {
      page.drawText(g.label, { x: g.x, y: 488, size: 7, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
      const f = form.createTextField(g.name);
      f.addToPage(page, { x: g.x, y: 472, width: 60, height: 14, borderWidth: 0.5, borderColor: rgb(0.6, 0.6, 0.6) });
      page.drawText(g.unit, { x: g.x + 65, y: 475, size: 8, font: boldFont });
    });

    page.drawText('Refrigerant Type:', { x: 32, y: 452, size: 8, font: boldFont });
    const refTypeField = form.createTextField('refrigerantType');
    refTypeField.setText('R-410A');
    refTypeField.addToPage(page, { x: 110, y: 448, width: 90, height: 14, borderWidth: 0.5 });

    page.drawText('Refrigerant Added:', { x: 350, y: 452, size: 8, font: boldFont });
    const refLbsField = form.createTextField('refrigerantLbs');
    refLbsField.addToPage(page, { x: 435, y: 448, width: 40, height: 14, borderWidth: 0.5 });
    page.drawText('lbs', { x: 480, y: 452, size: 8, font });
    const refOzField = form.createTextField('refrigerantOz');
    refOzField.addToPage(page, { x: 505, y: 448, width: 40, height: 14, borderWidth: 0.5 });
    page.drawText('oz', { x: 550, y: 452, size: 8, font });
  } else {
    const generalToolFields = [
      { label: 'VOLTAGE (V)', name: 'voltage', unit: 'V', x: 32 },
      { label: 'AMPERAGE (A)', name: 'amps', unit: 'A', x: 125 },
      { label: 'AMBIENT TEMP', name: 'ambientTemp', unit: '°F', x: 218 },
      { label: 'OPERATING TEMP', name: 'supplyTemp', unit: '°F', x: 311 },
      { label: 'RESISTANCE', name: 'deltaT', unit: 'Ω', x: 404 },
      { label: 'SYSTEM STATUS', name: 'refrigerantType', unit: '', x: 497 },
    ];

    generalToolFields.forEach(g => {
      page.drawText(g.label, { x: g.x, y: 518, size: 7, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
      const f = form.createTextField(g.name);
      f.addToPage(page, { x: g.x, y: 502, width: 60, height: 14, borderWidth: 0.5, borderColor: rgb(0.6, 0.6, 0.6) });
      if (g.unit) page.drawText(g.unit, { x: g.x + 65, y: 505, size: 8, font: boldFont });
    });
  }

  // DIAGNOSIS & WORK NOTES
  page.drawRectangle({ x: 25, y: 340, width: 562, height: 98, borderColor: rgb(0.2, 0.25, 0.35), borderWidth: 1.5 });
  page.drawText('DIAGNOSIS & WORK PERFORMED FINDINGS', { x: 32, y: 426, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

  page.drawText('INITIAL DIAGNOSIS / CAUSE OF FAILURE:', { x: 32, y: 412, size: 7, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
  const diagField = form.createTextField('diagnosisNotes');
  if (job?.notes?.diagnosis) diagField.setText(job.notes.diagnosis);
  diagField.enableMultiline();
  diagField.addToPage(page, { x: 32, y: 382, width: 548, height: 28, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('WORK PERFORMED / REPAIRS EXECUTED:', { x: 32, y: 368, size: 7, font: boldFont, color: rgb(0.4, 0.4, 0.4) });
  const workNotesField = form.createTextField('workNotes');
  if (job?.notes?.workNotes || job?.notes?.completion) workNotesField.setText(job?.notes?.workNotes || job?.notes?.completion || '');
  workNotesField.enableMultiline();
  workNotesField.addToPage(page, { x: 32, y: 344, width: 548, height: 22, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  // PARTS USED TABLE
  page.drawRectangle({ x: 25, y: 240, width: 562, height: 94, borderColor: rgb(0.2, 0.25, 0.35), borderWidth: 1.5 });
  page.drawText('PARTS & MATERIALS CONSUMED', { x: 32, y: 322, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });

  // Table header line
  page.drawRectangle({ x: 25, y: 304, width: 562, height: 14, color: rgb(0.9, 0.92, 0.95) });
  page.drawText('#', { x: 32, y: 308, size: 8, font: boldFont });
  page.drawText('Part Description / Name', { x: 55, y: 308, size: 8, font: boldFont });
  page.drawText('SKU / Part No', { x: 350, y: 308, size: 8, font: boldFont });
  page.drawText('Qty', { x: 470, y: 308, size: 8, font: boldFont });
  page.drawText('Cost ($)', { x: 530, y: 308, size: 8, font: boldFont });

  [1, 2, 3].forEach((rowNum, idx) => {
    const yPos = 284 - (idx * 20);
    page.drawText(String(rowNum), { x: 32, y: yPos + 3, size: 8, font });
    const pDesc = form.createTextField(`part_desc_${rowNum}`);
    pDesc.addToPage(page, { x: 55, y: yPos, width: 285, height: 14, borderWidth: 0.5, borderColor: rgb(0.8, 0.8, 0.8) });

    const pSku = form.createTextField(`part_sku_${rowNum}`);
    pSku.addToPage(page, { x: 350, y: yPos, width: 110, height: 14, borderWidth: 0.5, borderColor: rgb(0.8, 0.8, 0.8) });

    const pQty = form.createTextField(`part_qty_${rowNum}`);
    pQty.addToPage(page, { x: 470, y: yPos, width: 45, height: 14, borderWidth: 0.5, borderColor: rgb(0.8, 0.8, 0.8) });

    const pCost = form.createTextField(`part_cost_${rowNum}`);
    pCost.addToPage(page, { x: 530, y: yPos, width: 50, height: 14, borderWidth: 0.5, borderColor: rgb(0.8, 0.8, 0.8) });
  });

  // RECOMMENDATIONS & SIGNATURES
  page.drawRectangle({ x: 25, y: 155, width: 562, height: 78, borderColor: rgb(0.2, 0.25, 0.35), borderWidth: 1.5, color: rgb(0.97, 0.98, 0.99) });
  
  page.drawText('TECHNICIAN RECOMMENDATIONS & FOLLOW-UP', { x: 32, y: 221, size: 7, font: boldFont, color: rgb(0.3, 0.35, 0.4) });
  const recField = form.createTextField('techRecommendations');
  if (job?.techRecommendations) recField.setText(job.techRecommendations);
  recField.enableMultiline();
  recField.addToPage(page, { x: 32, y: 165, width: 260, height: 52, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });

  page.drawText('TECHNICIAN SIGNATURE & DATE', { x: 310, y: 221, size: 7, font: boldFont, color: rgb(0.3, 0.35, 0.4) });
  page.drawLine({ start: { x: 310, y: 195 }, end: { x: 500, y: 195 }, thickness: 1 });
  page.drawText('Date:', { x: 510, y: 195, size: 8, font });
  page.drawLine({ start: { x: 535, y: 195 }, end: { x: 580, y: 195 }, thickness: 1 });

  page.drawText('CUSTOMER ACCEPTANCE SIGNATURE & DATE', { x: 310, y: 180, size: 7, font: boldFont, color: rgb(0.3, 0.35, 0.4) });
  page.drawLine({ start: { x: 310, y: 160 }, end: { x: 500, y: 160 }, thickness: 1 });
  page.drawText('Date:', { x: 510, y: 160, size: 8, font });
  page.drawLine({ start: { x: 535, y: 160 }, end: { x: 580, y: 160 }, thickness: 1 });

  // FOOTER
  page.drawText('THANK YOU FOR YOUR BUSINESS! PLEASE SUBMIT THIS COMPLETED PAPER DOCUMENT TO OFFICE STAFF FOR DIGITAL FILING.', {
    x: 40,
    y: 138,
    size: 6.5,
    font: boldFont,
    color: rgb(0.4, 0.45, 0.5)
  });
  page.drawText('(REQUIRED: SUBMIT BEFORE & AFTER PHOTOS FOR EACH UNIT WITH THIS FORM).', {
    x: 140,
    y: 128,
    size: 6.5,
    font: boldFont,
    color: rgb(0.2, 0.25, 0.35)
  });

  return await pdfDoc.save();
}
