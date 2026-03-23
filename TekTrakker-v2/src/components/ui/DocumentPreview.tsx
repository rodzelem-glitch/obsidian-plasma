
import React, { useRef, useState } from 'react';
import { useAppContext } from 'context/AppContext';
import { Printer, ArrowRight, ExternalLink, CreditCard, FileText } from 'lucide-react';
import type { Proposal, Job, Organization, Address } from 'types';
import Button from './Button';
import { db } from 'lib/firebase';
import { globalConfirm } from "lib/globalConfirm";

interface DocumentPreviewProps {
    type: 'Proposal' | 'Invoice' | 'Other';
    data: Proposal | Job | any;
    onClose: () => void;
    isInternal?: boolean; // If true, hides customer-facing tools like financing
    organization?: Organization | null; // Optional override for platform invoices
}

const formatAddress = (addr: Address | string | undefined): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ type, data, onClose, isInternal = true, organization }) => {
    const { state, dispatch } = useAppContext();
    
    // Use passed org or fallback to context
    const org = organization || state.currentOrganization;
    
    const printRef = useRef<HTMLDivElement>(null);
    const [isConverting, setIsConverting] = useState(false);

    const isProposal = type === 'Proposal';
    const isOther = type === 'Other';
    const prop = isProposal ? data as Proposal : null;
    const job = (!isProposal && !isOther) ? data as Job : null;
    
    const rawItems = isProposal ? prop?.items || [] : job?.invoice?.items || [];
    // If no option is selected on the proposal, default to the tier of the first item.
    const activeTier = prop?.selectedOption || (rawItems.length > 0 ? (rawItems[0] as any).tier : undefined);
    
    // Items Mapping
    const items = rawItems.filter((i: any) => !isProposal || i.tier === activeTier).map((item: any) => ({
        id: item.id,
        name: isProposal ? item.name : item.description,
        description: isProposal ? item.description : undefined,
        quantity: item.quantity || 1,
        unitPrice: isProposal ? item.price : item.unitPrice,
        total: item.total || ((isProposal ? item.price : item.unitPrice) * (item.quantity || 1))
    }));

    const total = (isProposal ? prop?.total : (job?.invoice?.totalAmount || job?.invoice?.amount)) || 0;
    const subtotal = (isProposal ? prop?.subtotal : job?.invoice?.subtotal) || 0;
    const tax = (isProposal ? prop?.taxAmount : job?.invoice?.taxAmount) || 0;
    const customerName = isProposal ? prop?.customerName : (isOther ? '' : job?.customerName);
    
    const addressObj = isProposal ? (state.customers.find(c => c.name === prop?.customerName)?.address) : (isOther ? '' : job?.address);
    const address = formatAddress(addressObj);

    const date = isProposal ? (prop?.createdAt || new Date().toISOString()) : (isOther ? new Date().toISOString() : job?.appointmentTime);
    const id = isProposal ? (prop?.id || 'DRAFT') : (isOther ? 'DOC-PREVIEW' : job?.invoice?.id);
    const status = isProposal ? prop?.status : (isOther ? 'Draft' : job?.invoice?.status);
    const signature = isProposal ? (prop?.signatureDataUrl || prop?.signature) : (isOther ? null : (job?.invoiceSignature || null));

    const handleConvertToJob = async () => {
        if (!isProposal || !prop || !state.currentOrganization) return;
        if (!await globalConfirm(`Convert this proposal for ${prop.customerName} into an active Job/Invoice?`)) return;

        setIsConverting(true);
        const customer = state.customers.find(c => c.name === prop.customerName);
        const jobId = `job-${Date.now()}`;
        
        const newJob: Job = {
            id: jobId,
            organizationId: state.currentOrganization.id,
            customerName: prop.customerName,
            customerId: customer?.id || null,
            address: addressObj || '', // Pass the object or string directly
            tasks: items.map(i => i.name),
            jobStatus: 'Scheduled',
            appointmentTime: new Date().toISOString(),
            invoice: {
                id: `INV-${Date.now()}`,
                items: items.map(i => ({
                    id: i.id,
                    description: i.name,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    total: i.total,
                    type: 'Part'
                })),
                subtotal,
                taxRate: (state.currentOrganization.taxRate || 8.25) / 100,
                taxAmount: tax,
                totalAmount: total,
                amount: total,
                status: 'Unpaid'
            },
            jobEvents: [],
            specialInstructions: `Auto-converted from Proposal #${prop.id}`,
            source: 'ProposalConversion',
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('jobs').doc(jobId).set(newJob);
            dispatch({ type: 'ADD_JOB', payload: newJob });
            alert("Job/Invoice created successfully! View in Operations.");
            onClose();
        } catch (e) {
            console.error(e);
            alert("Conversion failed.");
        } finally {
            setIsConverting(false);
        }
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const win = window.open('', '', 'width=1000,height=1300');
        if (win) {
            win.document.write(`
                <html>
                    <head>
                        <title>${type} - ${id}</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
                            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                            body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 0; margin: 0; color: #1e293b; background: #f1f5f9; line-height: 1.5; }
                            .page { width: 8.5in; min-height: 11in; padding: 0.75in; margin: 1in auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); box-sizing: border-box; position: relative; }
                            .prose { max-width: none; font-size: 14px; color: #334155; }
                            .prose h3 { color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                            .prose p { margin-bottom: 1em; text-align: justify; }
                            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
                            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10px; color: #94a3b8; }
                            @media print {
                                body { background: white; padding: 0; margin: 0; }
                                .page { margin: 0; box-shadow: none; border: none; width: 100%; height: auto; min-height: 0; page-break-after: always; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="page">
                            ${printRef.current.innerHTML}
                        </div>
                        <script>
                            window.onload = function() { setTimeout(() => { window.print(); }, 500); };
                        </script>
                    </body>
                </html>
            `);
            win.document.close();
        }
    };

    // --- RENDER CUSTOM HTML CONTENT (e.g. WAIVERS) ---
    if (isOther && data.htmlContent) {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 dark:bg-slate-900">
                <div className="bg-white dark:bg-slate-800 shadow-xl p-3 md:p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 min-h-[5rem] md:h-20">
                    <div className="flex items-center gap-3 md:gap-4">
                         <div className="bg-primary-600 p-1.5 md:p-2 rounded-xl text-white shadow-lg shadow-primary-500/20">
                            <FileText size={20} className="md:w-6 md:h-6"/>
                        </div>
                        <h2 className="text-sm md:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">{data.title || 'Document Preview'}</h2>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800">Close</button>
                        <Button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 font-black shadow-xl shadow-primary-500/20"><Printer size={16}/> Print</Button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-12 flex justify-center custom-scrollbar bg-slate-100 dark:bg-slate-900">
                     <div ref={printRef} className="bg-white text-slate-900 shadow-2xl w-full max-w-[8.5in] p-4 md:p-8 md:p-16 rounded-xl min-h-[11in] box-border">
                         {/* Header for Custom Doc */}
                         <div className="flex justify-between items-start mb-8 border-b pb-8">
                             <div>
                                 {org?.logoUrl ? <img src={org.logoUrl} alt="Logo" className="h-12 object-contain" /> : <h1 className="text-2xl font-black text-primary-600 uppercase">{org?.name}</h1>}
                             </div>
                             <div className="text-right text-sm">
                                 <p className="font-bold text-slate-900">{new Date().toLocaleDateString()}</p>
                                 <p className="text-slate-500 font-medium">{data.title}</p>
                             </div>
                         </div>
                         
                         <div className="prose max-w-none prose-slate dark:prose-invert" dangerouslySetInnerHTML={{ __html: data.htmlContent }} />
                         
                         <div className="mt-12 pt-8 border-t text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                             Generated by TekTrakker Platform
                         </div>
                     </div>
                </div>
            </div>
        );
    }

    // --- STANDARD RENDER (INVOICE / PROPOSAL) ---
    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 dark:bg-slate-900">
            <div className="bg-white dark:bg-slate-800 shadow-xl p-3 md:p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-700 min-h-[5rem] md:h-20">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="bg-primary-600 p-1.5 md:p-2 rounded-xl text-white shadow-lg shadow-primary-500/20">
                        <FileText size={20} className="md:w-6 md:h-6"/>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm md:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">Reviewing {type}</h2>
                        <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest truncate">ID: #{id}</p>
                    </div>
                </div>
                <div className="flex gap-2 md:gap-4">
                    <button onClick={onClose} className="text-[10px] md:text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors px-2 md:px-6">Close</button>
                    {isProposal && status === 'Accepted' && isInternal && (
                        <Button onClick={handleConvertToJob} disabled={isConverting} className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 md:gap-2 h-9 md:h-12 px-3 md:px-8 text-[10px] md:text-sm font-black shadow-xl shadow-emerald-500/20">
                            <ArrowRight size={14} className="md:w-4 md:h-4"/> {isConverting ? '...' : 'Convert'}
                        </Button>
                    )}
                    <Button onClick={handlePrint} className="flex items-center gap-1 md:gap-2 h-9 md:h-12 px-3 md:px-8 text-[10px] md:text-sm font-black shadow-xl shadow-primary-500/20">
                        <Printer size={14} className="md:w-4 md:h-4"/> Print
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 md:p-12 flex justify-center custom-scrollbar bg-slate-100 dark:bg-slate-900">
                <div 
                    ref={printRef}
                    className="bg-white text-slate-900 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[8.5in] p-4 md:p-16 box-border relative overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] h-fit mb-12"
                >
                    <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-slate-50 rounded-bl-full -z-0 opacity-50"></div>
                    
                    <div className="relative z-10 pb-20">
                        {/* Header */}
                        <div className="header flex flex-col md:flex-row justify-between mb-8 md:mb-[60px] gap-6 md:gap-0">
                            <div className="logo-area text-center md:text-left">
                                {org?.logoUrl ? (
                                    <img src={org.logoUrl} alt="Company Logo" className="logo-img inline-block md:block" style={{maxHeight:'60px', maxWidth:'100%'}} />
                                ) : org?.letterheadDataUrl ? (
                                    <img src={org.letterheadDataUrl} alt="Company Logo" className="logo-img inline-block md:block" style={{maxHeight:'60px', maxWidth:'100%'}} />
                                ) : (
                                    <h1 className="branding-h1" style={{fontSize:'24px', fontWeight:800, color: org?.primaryColor || '#0284c7', margin:0}}>{org?.name}</h1>
                                )}
                                {org?.licenseNumber && (
                                    <div className="license-badge" style={{fontSize:'10px', fontWeight:800, color:'#64748b', marginTop:'8px', textTransform:'uppercase'}}>Licence # {org.licenseNumber}</div>
                                )}
                            </div>
                            <div className="doc-meta text-center md:text-right">
                                <div className="doc-type-badge" style={{display: 'inline-block', background:'#f1f5f9', padding:'6px 16px', borderRadius:'10px', fontWeight:800, fontSize:'12px', textTransform:'uppercase', marginBottom:'10px', color:'#475569'}}>{type.toUpperCase()}</div>
                                <div className="meta-grid" style={{display:'grid', gridTemplateColumns:'auto auto', gap:'5px 15px', fontSize:'11px', textAlign:'right', justifyContent: 'center'}}>
                                    <span className="meta-label" style={{color:'#94a3b8'}}>ID</span>
                                    <span className="meta-value" style={{fontWeight:800}}>#{id}</span>
                                    <span className="meta-label" style={{color:'#94a3b8'}}>Date</span>
                                    <span className="meta-value" style={{fontWeight:800}}>{new Date(date).toLocaleDateString()}</span>
                                    <span className="meta-label" style={{color:'#94a3b8'}}>Status</span>
                                    <span className="meta-value" style={{fontWeight:800, textTransform:'uppercase'}}>{status}</span>
                                </div>
                            </div>
                        </div>

                        {/* Billing Blocks */}
                        <div className="billing-info flex flex-col md:flex-row justify-between mb-8 md:mb-[50px] gap-4 md:gap-10">
                            <div className="info-block" style={{flex:1, background:'#f8fafc', padding:'20px', borderRadius:'20px', border:'1px solid #f1f5f9'}}>
                                <div className="info-title" style={{fontSize:'9px', textTransform:'uppercase', fontWeight:800, letterSpacing:'2px', color:'#94a3b8', marginBottom:'8px'}}>Bill To</div>
                                <div className="info-name" style={{fontSize:'16px', fontWeight:800, marginBottom:'4px'}}>{customerName}</div>
                                <div className="info-text" style={{fontSize:'13px', color:'#475569'}}>{address}</div>
                            </div>
                            <div className="info-block" style={{flex:1, background:'#f8fafc', padding:'20px', borderRadius:'20px', border:'1px solid #f1f5f9'}}>
                                <div className="info-title" style={{fontSize:'9px', textTransform:'uppercase', fontWeight:800, letterSpacing:'2px', color:'#94a3b8', marginBottom:'8px'}}>From</div>
                                <div className="info-name" style={{fontSize:'16px', fontWeight:800, marginBottom:'4px'}}>{org?.name}</div>
                                <div className="info-text" style={{fontSize:'13px', color:'#475569'}}>{org?.address?.street}</div>
                                <div className="info-text" style={{fontSize:'13px', color:'#475569'}}>{org?.address?.city}, {org?.address?.state} {org?.address?.zip}</div>
                                {org?.phone && <div className="info-text" style={{fontSize:'13px', color:'#475569', marginTop:'4px'}}>{org.phone}</div>}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="table-area overflow-x-auto" style={{marginBottom:'30px', border:'1px solid #f1f5f9', borderRadius:'20px'}}>
                            <table style={{width:'100%', minWidth: '600px', borderCollapse:'collapse'}}>
                                <thead style={{background:'#f8fafc'}}>
                                    <tr>
                                        <th style={{padding:'15px 20px', fontSize:'9px', fontWeight:800, color:'#94a3b8', textAlign:'left'}}>Item & Services</th>
                                        <th style={{padding:'15px 20px', fontSize:'9px', fontWeight:800, color:'#94a3b8', textAlign:'center', width:'70px'}}>Qty</th>
                                        <th style={{padding:'15px 20px', fontSize:'9px', fontWeight:800, color:'#94a3b8', textAlign:'right', width:'110px'}}>Price</th>
                                        <th style={{padding:'15px 20px', fontSize:'9px', fontWeight:800, color:'#94a3b8', textAlign:'right', width:'110px'}}>Total</th>
                                    </tr>
                                </thead>
                                <tbody style={{background:'white'}}>
                                    {items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td style={{padding:'15px 20px', borderBottom:'1px solid #f1f5f9'}}>
                                                <div className="item-name" style={{fontWeight:800, fontSize:'14px', color:'#0f172a', marginBottom:'2px'}}>{item.name}</div>
                                                {item.description && <div className="item-desc" style={{fontSize:'11px', color:'#64748b'}}>{item.description}</div>}
                                            </td>
                                            <td style={{padding:'15px 20px', borderBottom:'1px solid #f1f5f9', textAlign:'center', fontWeight:700, color:'#64748b', fontSize: '13px'}}>{item.quantity}</td>
                                            <td style={{padding:'15px 20px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:700, fontSize: '13px'}}>${Number(item.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style={{padding:'15px 20px', borderBottom:'1px solid #f1f5f9', textAlign:'right', fontWeight:800, color:'#0f172a', fontSize: '13px'}}>${Number(item.total).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary */}
                        <div className="summary-grid flex justify-end mb-10 md:mb-[60px]">
                            <div className="summary-box w-full md:w-[320px]">
                                <div className="summary-row flex justify-between py-2 border-b border-dashed border-slate-200" style={{fontSize:'13px'}}>
                                    <span className="summary-label" style={{color:'#64748b', fontWeight:700}}>Subtotal</span>
                                    <span style={{fontWeight:800}}>${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                <div className="summary-row flex justify-between py-2 border-b border-dashed border-slate-200" style={{fontSize:'13px'}}>
                                    <span className="summary-label" style={{color:'#64748b', fontWeight:700}}>Estimated Tax</span>
                                    <span style={{fontWeight:800}}>${tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                <div className="summary-row grand-total flex justify-between pt-4 mt-2" style={{fontSize:'22px', fontWeight:800, color:'#0f172a'}}>
                                    <span style={{color: org?.primaryColor || '#0284c7'}}>Total</span>
                                    <span style={{letterSpacing:'-1px'}}>${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                
                                {org?.financingLink && (
                                    <div style={{marginTop:'25px', textAlign:'center'}}>
                                        <a href={org.financingLink} target="_blank" rel="noopener noreferrer" style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', background:'#0284c7', color:'white', padding:'12px', borderRadius:'10px', textDecoration:'none', fontWeight:800, fontSize:'12px', textTransform:'uppercase', letterSpacing:'1px', boxShadow:'0 10px 15px -3px rgba(2, 132, 199, 0.2)'}}>
                                            <CreditCard size={16}/> Financing Available
                                        </a>
                                        <p style={{fontSize:'9px', color:'#94a3b8', marginTop:'8px', fontWeight:600}}>Click to view financing options.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {org?.termsAndConditions && (
                            <div className="extra-section bg-[#f8fafc] p-5 md:p-8 rounded-[20px] md:rounded-[32px] mb-10">
                                <div className="terms-title" style={{fontSize:'10px', fontWeight:800, letterSpacing:'2px', textTransform:'uppercase', color:'#0f172a', marginBottom:'10px'}}>Terms & Conditions</div>
                                <div className="terms-content" style={{fontSize:'11px', color:'#64748b', textAlign:'justify', lineHeight: 1.6}}>{org.termsAndConditions}</div>
                            </div>
                        )}

                        <div className="signature-area flex flex-col md:flex-row justify-between items-center md:items-end mt-12 md:mt-[80px]">
                            <div className="text-center md:text-left">
                                {signature ? (
                                    <div>
                                        <img src={signature} alt="Client Signature" className="sig-img mx-auto md:ml-0" style={{maxHeight:'80px', marginBottom:'-15px'}} />
                                        <div className="sig-placeholder" style={{width:'260px', borderTop:'2px solid #0f172a', paddingTop:'10px'}}>
                                            <div className="sig-label" style={{fontSize:'9px', fontWeight:800, textTransform:'uppercase', color:'#94a3b8'}}>Authorized Client Signature</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="sig-placeholder" style={{width:'260px', borderTop:'2px solid #0f172a', paddingTop:'10px', height:'35px'}}>
                                        <div className="sig-label" style={{fontSize:'9px', fontWeight:800, textTransform:'uppercase', color:'#94a3b8'}}>Authorized Client Signature</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {org?.complianceFooter && (
                             <div className="legal-footer">
                                 {org.complianceFooter}
                             </div>
                        )}

                        {org?.footerImage && (
                            <div className="footer-image-container flex justify-center mt-12 pt-8 border-t border-[#f1f5f9]">
                                <img src={org.footerImage} alt="Company Footer" style={{maxWidth:'100%', height:'auto', borderRadius:'10px'}} />
                            </div>
                        )}

                        <div className="footer mt-10 pt-8 border-t border-[#f1f5f9] text-center text-[#94a3b8]" style={{fontSize:'10px'}}>
                            <div className="footer-branding font-extrabold text-[#64748b] mb-1">{org?.name.toUpperCase()} PLATFORM</div>
                            <p style={{margin:0}}>Generated by TekTrakker on {new Date().toLocaleString()}</p>
                            <div className="flex justify-center items-center gap-1.5 mt-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                                <img src={`${window.location.origin}/tektrakker-icon.png`} width="14" /> 
                                <span>Powered by TekTrakker</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentPreview;
