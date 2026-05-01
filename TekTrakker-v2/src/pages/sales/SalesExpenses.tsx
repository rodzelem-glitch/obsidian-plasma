import showToast from "lib/toast";

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useConfirm } from 'context/ConfirmContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import { db, functions } from 'lib/firebase';
import { uploadFileToStorage } from 'lib/storageService';
import type { Expense, BusinessDocument } from 'types';
import { Receipt, Plus, Trash2, FileText, Download, PenTool, Paperclip, Camera as CameraIcon, Loader2, ArrowLeft } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { formatAddress } from 'lib/utils';
import DOMPurify from 'dompurify';

const SalesExpenses: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useAppContext();
    const { confirm } = useConfirm();
    const { currentUser } = state;
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [taxDocs, setTaxDocs] = useState<BusinessDocument[]>([]);
    const [viewingReceipt, setViewingReceipt] = useState<string[] | null>(null);
    const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);
    const [isUploadingToExpenseId, setIsUploadingToExpenseId] = useState<string | null>(null);
    
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newExpensePhotos, setNewExpensePhotos] = useState<string[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        date: new Date().toISOString().split('T')[0],
        category: 'Travel',
        amount: 0,
        description: '',
        vendor: '',
        receiptData: null,
        receiptUrl: null,
        receiptUrls: []
    });

    const handleAttachToExisting = async (e: React.ChangeEvent<HTMLInputElement>, expId: string) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser) return;
        
        if (file.size > 5 * 1024 * 1024) {
            showToast.warn("File Too Large: The receipt photo must be under 5MB. Please compress the image.");
            e.target.value = '';
            return;
        }

        setIsUploadingToExpenseId(expId);
        
        try {
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'receipt.jpg';
            const path = `organizations/platform/users/${currentUser.id}/receipts/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            await db.collection('expenses').doc(expId).update({ receiptUrl: downloadUrl, receiptData: null });
        } catch (err) {
            console.error("Failed to update receipt", err);
            showToast.warn("Upload failed. The file format might be unsupported or the server rejected the payload.");
        } finally {
            setIsUploadingToExpenseId(null);
        }
    };

    const handleCaptureReceipt = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt
            });
            if (image.base64String) {
                const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
                const updatedPhotos = [...newExpensePhotos, dataUrl];
                setNewExpensePhotos(updatedPhotos);

                if (updatedPhotos.length === 1) {
                    setIsAnalyzing(true);
                    try {
                        const analyzeFn = functions.httpsCallable('analyzeReceiptWithAI');
                        const res = await analyzeFn({ base64Images: [dataUrl] });
                        const extracted = (res.data as any).data;
                        if (extracted) {
                            setNewExpense(prev => ({
                                ...prev,
                                vendor: extracted.vendor || prev.vendor,
                                amount: extracted.amount ? parseFloat(extracted.amount) : prev.amount,
                                date: extracted.date || prev.date,
                                category: extracted.category || prev.category,
                                description: extracted.description || prev.description
                            }));
                        }
                    } catch (aiErr) {
                        console.error('OCR Extraction failed:', aiErr);
                    } finally {
                        setIsAnalyzing(false);
                    }
                }
            }
        } catch (e) {
            console.error("Camera Cancelled/Failed", e);
        }
    };

    // W-9 State
    const [isW9Open, setIsW9Open] = useState(false);
    const [w9Data, setW9Data] = useState({
        name: currentUser?.firstName + ' ' + currentUser?.lastName || '',
        businessName: '',
        taxClass: '', // Indiv, C Corp, S Corp, Partnership, Trust, LLC
        llcClass: '', // C, S, P
        otherClass: '',
        exemptPayeeCode: '',
        exemptFatcaCode: '',
        address: formatAddress(currentUser?.address) || '',
        cityStateZip: '',
        requesterName: '',
        listAccountNumbers: '',
        tinType: 'SSN', // SSN or EIN
        tin: '',
        certificationDate: new Date().toISOString().split('T')[0],
        certification1: false,
        certification2: false
    });

    useEffect(() => {
        if (!currentUser) return;
        
        // Fetch Expenses
        const unsubExp = db.collection('expenses')
            .where('paidBy', '==', currentUser.firstName) // Simple match for now, ideally ID
            .where('organizationId', '==', 'platform')
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense));
                setExpenses(data);
            });
            
        // Fetch Tax Docs (Assuming manually uploaded by admin to platform org)
        const unsubDocs = db.collection('documents')
            .where('organizationId', '==', 'platform')
            .where('type', '==', 'Tax Form')
            .onSnapshot(snap => {
                // Filter client side for docs relevant to this user
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as BusinessDocument));
                const myDocs = data.filter(d => d.title.includes(currentUser.lastName));
                setTaxDocs(myDocs);
            });

        return () => { unsubExp(); unsubDocs(); };
    }, [currentUser]);

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        
        setIsSaving(true);
        let uploadedUrls: string[] = [];

        try {
            if (newExpensePhotos.length > 0) {
                for (let i = 0; i < newExpensePhotos.length; i++) {
                    const safeName = `expense_${Date.now()}_page${i+1}.jpg`;
                    const path = `organizations/platform/users/${currentUser.id}/receipts/${safeName}`;
                    const url = await uploadFileToStorage(path, newExpensePhotos[i]);
                    uploadedUrls.push(url);
                }
            }

            const expense: Expense = {
                id: `exp-${Date.now()}`,
                organizationId: 'platform',
                date: newExpense.date || new Date().toISOString(),
                category: newExpense.category || 'Other',
                amount: Number(newExpense.amount),
                description: newExpense.description || '',
                vendor: newExpense.vendor || '',
                paidBy: currentUser.firstName, 
                projectId: 'SalesExpense',
                receiptData: null,
                receiptUrl: uploadedUrls.length > 0 ? uploadedUrls[0] : null,
                receiptUrls: uploadedUrls
            };

            await db.collection('expenses').doc(expense.id).set(expense);
            setIsAddModalOpen(false);
            setNewExpensePhotos([]);
            setNewExpense({ date: new Date().toISOString().split('T')[0], category: 'Travel', amount: 0, description: '', vendor: '', receiptData: '', receiptUrls: [] });
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to save expense. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!(await confirm("Delete this expense?"))) return;
        await db.collection('expenses').doc(id).delete();
    };

    const handleSaveW9 = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!w9Data.name || !w9Data.tin) {
            showToast.warn("Name and TIN are required.");
            return;
        }

        if (!w9Data.certification1 || !w9Data.certification2) {
            showToast.warn("You must agree to the certifications.");
            return;
        }

        const w9Html = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; border: 2px solid black; padding: 0; color: #000;">
                <div style="display: flex; border-bottom: 2px solid black;">
                    <div style="width: 20%; padding: 10px; border-right: 1px solid black;">
                        <h1 style="font-size: 24px; font-weight: bold; margin: 0;">W-9</h1>
                        <p style="font-size: 10px; margin: 5px 0;">(Rev. March 2024)</p>
                        <p style="font-size: 10px; margin: 0;">Department of the Treasury<br>Internal Revenue Service</p>
                    </div>
                    <div style="width: 60%; padding: 10px; text-align: center;">
                        <h2 style="font-size: 18px; font-weight: bold; margin: 0;">Request for Taxpayer<br>Identification Number and Certification</h2>
                        <p style="font-size: 10px; margin-top: 5px;"><a href="https://www.irs.gov/FormW9" target="_blank" style="color: black; text-decoration: none;">Go to www.irs.gov/FormW9 for instructions and the latest information.</a></p>
                    </div>
                    <div style="width: 20%; padding: 10px; border-left: 1px solid black;">
                        <p style="font-size: 12px; margin: 0;">Give form to the requester. Do not send to the IRS.</p>
                    </div>
                </div>

                <div style="padding: 10px; font-size: 12px;">
                    <div style="margin-bottom: 8px;">
                        <label style="display: block; font-weight: bold;">1 Name of entity/individual. An entry is required.</label>
                        <div style="border-bottom: 1px solid black; min-height: 20px;">${w9Data.name}</div>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="display: block; font-weight: bold;">2 Business name/disregarded entity name, if different from above.</label>
                        <div style="border-bottom: 1px solid black; min-height: 20px;">${w9Data.businessName}</div>
                    </div>

                    <div style="display: flex; gap: 20px; margin-bottom: 10px;">
                        <div style="flex: 2;">
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">3a Check the appropriate box for federal tax classification of the entity/individual whose name is entered on line 1. Check only one of the following seven boxes.</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 11px;">
                                <div><input type="checkbox" ${w9Data.taxClass === 'Individual' ? 'checked' : ''} disabled> Individual/sole proprietor</div>
                                <div><input type="checkbox" ${w9Data.taxClass === 'C Corp' ? 'checked' : ''} disabled> C Corporation</div>
                                <div><input type="checkbox" ${w9Data.taxClass === 'S Corp' ? 'checked' : ''} disabled> S Corporation</div>
                                <div><input type="checkbox" ${w9Data.taxClass === 'Partnership' ? 'checked' : ''} disabled> Partnership</div>
                                <div><input type="checkbox" ${w9Data.taxClass === 'Trust' ? 'checked' : ''} disabled> Trust/estate</div>
                                <div style="grid-column: span 2;">
                                    <input type="checkbox" ${w9Data.taxClass === 'LLC' ? 'checked' : ''} disabled> LLC. Enter the tax classification (C=C corporation, S=S corporation, P=Partnership): <u>${w9Data.llcClass}</u>
                                </div>
                                <div style="grid-column: span 2;">
                                    <input type="checkbox" ${w9Data.taxClass === 'Other' ? 'checked' : ''} disabled> Other (see instructions): <u>${w9Data.otherClass}</u>
                                </div>
                            </div>
                        </div>
                        <div style="flex: 1; border-left: 1px solid black; padding-left: 10px;">
                            <label style="display: block; font-weight: bold;">4 Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):</label>
                            <div style="margin-top: 5px;">Exempt payee code (if any): <u>${w9Data.exemptPayeeCode}</u></div>
                            <div style="margin-top: 5px;">Exemption from FATCA reporting code (if any): <u>${w9Data.exemptFatcaCode}</u></div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px;">
                        <div style="flex: 2;">
                            <div style="margin-bottom: 8px;">
                                <label style="display: block; font-weight: bold;">5 Address (number, street, and apt. or suite no.) See instructions.</label>
                                <div style="border-bottom: 1px solid black; min-height: 20px;">${w9Data.address}</div>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <label style="display: block; font-weight: bold;">6 City, state, and ZIP code</label>
                                <div style="border-bottom: 1px solid black; min-height: 20px;">${w9Data.cityStateZip}</div>
                            </div>
                             <div style="margin-bottom: 8px;">
                                <label style="display: block; font-weight: bold;">7 List account number(s) here (optional)</label>
                                <div style="border-bottom: 1px solid black; min-height: 20px;">${w9Data.listAccountNumbers}</div>
                            </div>
                        </div>
                        <div style="flex: 1; border-left: 1px solid black; padding-left: 10px;">
                             <label style="display: block; font-weight: bold;">Requester's name and address (optional)</label>
                             <div>${w9Data.requesterName}</div>
                        </div>
                    </div>
                </div>

                <div style="border-top: 2px solid black; padding: 0;">
                    <div style="background: black; color: white; padding: 5px 10px; font-weight: bold; font-size: 14px;">Part I Taxpayer Identification Number (TIN)</div>
                    <div style="padding: 10px; display: flex; font-size: 12px;">
                        <div style="flex: 1; padding-right: 20px;">
                            Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid backup withholding. For individuals, this is generally your social security number (SSN).
                        </div>
                        <div style="flex: 1; border: 1px solid black; padding: 10px;">
                            <div style="margin-bottom: 10px;">
                                <label style="font-weight: bold;">Social security number</label>
                                <div style="border: 1px solid black; height: 25px; display: flex; align-items: center; justify-content: center; letter-spacing: 5px;">
                                    ${w9Data.tinType === 'SSN' ? w9Data.tin : ''}
                                </div>
                            </div>
                            <div style="font-weight: bold; text-align: center;">OR</div>
                            <div style="margin-top: 10px;">
                                <label style="font-weight: bold;">Employer identification number</label>
                                <div style="border: 1px solid black; height: 25px; display: flex; align-items: center; justify-content: center; letter-spacing: 5px;">
                                     ${w9Data.tinType === 'EIN' ? w9Data.tin : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="border-top: 2px solid black; padding: 0;">
                    <div style="background: black; color: white; padding: 5px 10px; font-weight: bold; font-size: 14px;">Part II Certification</div>
                    <div style="padding: 10px; font-size: 11px; line-height: 1.4;">
                        <p style="margin: 0 0 5px;">Under penalties of perjury, I certify that:</p>
                        <ol style="margin: 0; padding-left: 20px;">
                            <li>The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and</li>
                            <li>I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and</li>
                            <li>I am a U.S. citizen or other U.S. person (defined below); and</li>
                            <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
                        </ol>
                        <p style="margin-top: 10px; font-style: italic;">Certification instructions. You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return.</p>
                        <div style="margin-top: 20px; display: flex; gap: 20px; align-items: center;">
                            <div style="display: flex; gap: 10px; align-items: center; flex: 1;">
                                <div style="display:flex; flex-direction:column; width: 60px;">
                                    <strong>Sign</strong>
                                    <strong>Here</strong>
                                </div>
                                <div style="display:flex; flex-direction:column; flex:1;">
                                    <div style="border-bottom: 1px solid black; flex: 1; font-family: 'Brush Script MT', cursive; font-size: 18px;">${w9Data.name} (Electronic)</div>
                                    <span style="font-size:10px;">Signature of U.S. person</span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center; width: 200px;">
                                <strong>Date</strong>
                                <div style="border-bottom: 1px solid black; flex: 1;">${w9Data.certificationDate}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        try {
            await db.collection('users').doc(currentUser.id).update({
                taxW9Content: DOMPurify.sanitize(w9Html), 
            });
            
            // Save as a Document record too
            await db.collection('documents').add({
                organizationId: 'platform',
                title: `W-9 - ${w9Data.name}`,
                type: 'Tax Form',
                content: DOMPurify.sanitize(w9Html),
                createdAt: new Date().toISOString(),
                createdBy: currentUser.id
            });

            showToast.warn("W-9 Generated and Saved.");
            setIsW9Open(false);
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to save W-9.");
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Expenses & W-9</h1>
                </div>
                
                <div className="flex gap-2">
                    <Button onClick={() => setIsW9Open(true)} variant="secondary" className="flex items-center gap-2">
                        <FileText size={18}/> Update W-9
                    </Button>
                    <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2">
                        <Plus size={18}/> Log Expense
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">My Expenses</h3>
                    <Table headers={['Date', 'Vendor', 'Amount', 'Status', 'Action']}>
                        {expenses.map(exp => (
                            <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                <td className="px-6 py-4 text-sm text-slate-500">{new Date(exp.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                    {exp.vendor}
                                    <div className="text-xs text-slate-400 font-normal">{exp.category}</div>
                                </td>
                                <td className="px-6 py-4 text-emerald-600 font-bold">${exp.amount.toFixed(2)}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Pending</span>
                                </td>
                                <td className="px-6 py-4 flex items-center gap-3">
                                    {(() => {
                                        const possibleReceipt = exp.receiptUrl || exp.receiptData;
                                        const possibleUrls = exp.receiptUrls && exp.receiptUrls.length > 0 ? exp.receiptUrls : (possibleReceipt ? [possibleReceipt] : []);
                                        if (possibleUrls.length > 0) {
                                            return (
                                                <button onClick={() => setViewingReceipt(possibleUrls)} className="text-blue-500 hover:text-blue-700 flex items-center gap-1" title="View Receipt">
                                                    <Receipt size={16}/>
                                                    {possibleUrls.length > 1 && <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1 rounded-full">{possibleUrls.length}</span>}
                                                </button>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <label htmlFor={`receipt-upload-${exp.id}`} className={`cursor-pointer ${isUploadingToExpenseId === exp.id ? 'text-blue-400 animate-pulse' : 'text-slate-500 hover:text-primary-600'}`} title={(exp.receiptData || exp.receiptUrl) ? "Replace Receipt" : "Attach Receipt"}>
                                        <input type="file" title="Upload receipt" id={`receipt-upload-${exp.id}`} className="hidden" accept="image/*" onChange={(e) => handleAttachToExisting(e, exp.id)} />
                                        <Paperclip size={16} />
                                    </label>
                                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-500 hover:text-red-700" title="Delete Expense"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </Table>
                </Card>

                <Card>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Tax Documents</h3>
                    <div className="space-y-3">
                        {taxDocs.map(doc => (
                            <div key={doc.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded"><FileText size={18}/></div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white text-sm">{doc.title}</p>
                                        <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <Button variant="secondary" className="text-xs h-8" onClick={() => {
                                    const win = window.open('', '_blank');
                                    win?.document.write(`<html><body>${doc.content}</body></html>`);
                                    win?.document.close();
                                    win?.print();
                                }}>
                                    <Download size={14}/>
                                </Button>
                            </div>
                        ))}
                        {taxDocs.length === 0 && <p className="text-center text-slate-400 py-4 md:py-8 text-sm">No tax documents available.</p>}
                    </div>
                </Card>
            </div>

            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Log Sales Expense">
                <form onSubmit={handleSaveExpense} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Date" type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} required />
                        <Input label="Amount ($)" type="number" step="0.01" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})} required />
                    </div>
                    <Input label="Vendor" value={newExpense.vendor} onChange={e => setNewExpense({...newExpense, vendor: e.target.value})} placeholder="Hotel, Airline, Restaurant..." required />
                    <Select label="Category" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                        <option value="Travel">Travel</option>
                        <option value="Meals">Meals</option>
                        <option value="Supplies">Supplies</option>
                        <option value="Software">Software</option>
                        <option value="Other">Other</option>
                    </Select>
                    <Input label="Description" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} placeholder="Client lunch, Flight to HQ..." />
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Receipt Images (Optional)</label>
                        <div className="flex gap-2 mb-2">
                            <Button type="button" variant="secondary" onClick={handleCaptureReceipt} className="w-full flex items-center justify-center gap-2">
                                <CameraIcon size={16} /> Capture Receipt / Add Page
                            </Button>
                        </div>
                        {newExpensePhotos.length > 0 && (
                            <div className="mt-2 text-emerald-600 text-xs flex flex-col gap-1 font-medium bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded">
                                <div><Receipt size={14} className="inline mr-1" /> {newExpensePhotos.length} {newExpensePhotos.length === 1 ? 'Page' : 'Pages'} Captured</div>
                                {isAnalyzing && <div className="text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> AI Extracting Receipt Data...</div>}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSaving || isAnalyzing}>
                            {isSaving ? (
                                <><Loader2 size={16} className="animate-spin mr-2"/> Saving...</>
                            ) : 'Submit Expense'}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isW9Open} onClose={() => setIsW9Open(false)} title="Complete W-9 Form" size="lg">
                <form onSubmit={handleSaveW9} className="space-y-6 max-h-[70vh] overflow-y-auto p-2">
                    <div className="grid grid-cols-1 gap-4">
                        <Input label="1. Name (as shown on income tax return)" value={w9Data.name} onChange={e => setW9Data({...w9Data, name: e.target.value})} required />
                        <Input label="2. Business name/disregarded entity name (if different)" value={w9Data.businessName} onChange={e => setW9Data({...w9Data, businessName: e.target.value})} />
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">3. Federal Tax Classification</label>
                            <Select value={w9Data.taxClass} onChange={e => setW9Data({...w9Data, taxClass: e.target.value})}>
                                <option value="Individual">Individual/sole proprietor or single-member LLC</option>
                                <option value="C Corp">C Corporation</option>
                                <option value="S Corp">S Corporation</option>
                                <option value="Partnership">Partnership</option>
                                <option value="Trust">Trust/estate</option>
                                <option value="LLC">Limited Liability Company</option>
                                <option value="Other">Other</option>
                            </Select>
                        </div>

                        {w9Data.taxClass === 'LLC' && (
                             <Input label="LLC Tax Classification (C=C Corp, S=S Corp, P=Partnership)" value={w9Data.llcClass} onChange={e => setW9Data({...w9Data, llcClass: e.target.value.toUpperCase()})} maxLength={1} />
                        )}
                        {w9Data.taxClass === 'Other' && (
                             <Input label="Other Classification Description" value={w9Data.otherClass} onChange={e => setW9Data({...w9Data, otherClass: e.target.value})} />
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <Input label="Exempt Payee Code (if any)" value={w9Data.exemptPayeeCode} onChange={e => setW9Data({...w9Data, exemptPayeeCode: e.target.value})} />
                             <Input label="FATCA Exemption Code (if any)" value={w9Data.exemptFatcaCode} onChange={e => setW9Data({...w9Data, exemptFatcaCode: e.target.value})} />
                        </div>

                        <Input label="5. Address (number, street, and apt. no.)" value={w9Data.address} onChange={e => setW9Data({...w9Data, address: e.target.value})} required />
                        <Input label="6. City, state, and ZIP code" value={w9Data.cityStateZip} onChange={e => setW9Data({...w9Data, cityStateZip: e.target.value})} required />
                        
                        <Input label="Requester's name and address (Optional)" value={w9Data.requesterName} onChange={e => setW9Data({...w9Data, requesterName: e.target.value})} />
                        <Input label="7. List account number(s) here (optional)" value={w9Data.listAccountNumbers} onChange={e => setW9Data({...w9Data, listAccountNumbers: e.target.value})} />

                        <div className="bg-gray-50 p-4 rounded border dark:bg-gray-800">
                             <h4 className="font-bold text-sm mb-2">Part I: Taxpayer Identification Number (TIN)</h4>
                             <div className="flex gap-4 items-center">
                                 <Select value={w9Data.tinType} onChange={e => setW9Data({...w9Data, tinType: e.target.value})} className="w-32">
                                     <option value="SSN">SSN</option>
                                     <option value="EIN">EIN</option>
                                 </Select>
                                 <Input value={w9Data.tin} onChange={e => setW9Data({...w9Data, tin: e.target.value})} placeholder="XX-XXXXXXX" className="flex-1" required />
                             </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded border dark:bg-gray-800">
                             <h4 className="font-bold text-sm mb-2">Part II: Certification</h4>
                             <div className="space-y-2 text-xs">
                                 <label className="flex gap-2 items-start cursor-pointer">
                                     <input type="checkbox" checked={w9Data.certification1} onChange={e => setW9Data({...w9Data, certification1: e.target.checked})} className="mt-1" />
                                     <span>I certify that the TIN provided is correct (or I am waiting for a number to be issued to me).</span>
                                 </label>
                                 <label className="flex gap-2 items-start cursor-pointer">
                                     <input type="checkbox" checked={w9Data.certification2} onChange={e => setW9Data({...w9Data, certification2: e.target.checked})} className="mt-1" />
                                     <span>I am not subject to backup withholding (or have been notified I am exempt), and I am a U.S. citizen or other U.S. person.</span>
                                 </label>
                                 <p className="mt-2 text-gray-500 italic">By clicking "Sign & Save", you electronically sign this form as {w9Data.name}.</p>
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsW9Open(false)}>Cancel</Button>
                        <Button type="submit">Sign & Save W-9</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!viewingReceipt} onClose={() => { setViewingReceipt(null); setCurrentReceiptIndex(0); }} title="Receipt Preview" size="lg">
                <div className="flex flex-col items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-b-lg gap-4">
                     {viewingReceipt && viewingReceipt.length > 0 && (
                        <div className="w-full flex flex-col items-center gap-2">
                             {viewingReceipt.length > 1 && (
                                <div className="flex items-center gap-4 text-slate-500 font-bold mb-2">
                                    <button 
                                        disabled={currentReceiptIndex === 0} 
                                        onClick={() => setCurrentReceiptIndex(c => c - 1)}
                                        className="p-2 disabled:opacity-30 hover:text-slate-900 dark:hover:text-white"
                                    >
                                        &larr; Prev
                                    </button>
                                    <span>Page {currentReceiptIndex + 1} of {viewingReceipt.length}</span>
                                    <button 
                                        disabled={currentReceiptIndex === viewingReceipt.length - 1} 
                                        onClick={() => setCurrentReceiptIndex(c => c + 1)}
                                        className="p-2 disabled:opacity-30 hover:text-slate-900 dark:hover:text-white"
                                    >
                                        Next &rarr;
                                    </button>
                                </div>
                            )}
                            <img src={viewingReceipt[currentReceiptIndex]} alt={`Receipt Page ${currentReceiptIndex + 1}`} className="max-w-full max-h-[70vh] object-contain shadow-md rounded" />
                        </div>
                     )}
                </div>
            </Modal>
        </div>
    );
};

export default SalesExpenses;
