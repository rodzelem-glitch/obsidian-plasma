import showToast from "lib/toast";
// ... [Adding territories to FranchiseManager] ... Look below
import React, { useState, useEffect } from 'react';
import { db, storage, functions } from '../../lib/firebase';
import { Network, Plus, Settings, Trash2, Key, Globe, Store, Loader2, Save, Map, Handshake, CornerDownLeft, CloudLightning, Copy, Upload, CreditCard, ShieldCheck } from 'lucide-react';
import type { Franchise } from '../../types/franchise';
import { useAppContext } from '../../context/AppContext';
import { generateColorShades } from '../../lib/colorUtils';

const FranchiseManager: React.FC = () => {
    const { state } = useAppContext();
    const isMasterAdmin = state.isMasterAdmin;
    const isFranchiseAdmin = state.currentUser?.role === 'franchise_admin';
    const myFranchiseId = state.currentUser?.franchiseId;

    const [franchises, setFranchises] = useState<Franchise[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Edit form state
    const [formName, setFormName] = useState('');
    const [formDomain, setFormDomain] = useState('');
    const [formLogo, setFormLogo] = useState('');
    const [formColor, setFormColor] = useState('');
    const [formGeminiKey, setFormGeminiKey] = useState('');
    const [formAnthropicKey, setFormAnthropicKey] = useState('');
    const [formOpenaiKey, setFormOpenaiKey] = useState('');
    const [formActiveProvider, setFormActiveProvider] = useState<'openai' | 'anthropic' | 'gemini'>('openai');
    
    // Advanced Franchise Controls
    const [formTerritoryStates, setFormTerritoryStates] = useState('');
    const [formBusinessTypes, setFormBusinessTypes] = useState('');
    const [formAgreementSigned, setFormAgreementSigned] = useState(false);
    const [formSetupFeePaid, setFormSetupFeePaid] = useState(false);
    const [formPerUserFee, setFormPerUserFee] = useState(10);
    const [formPerVirtualWorkerFee, setFormPerVirtualWorkerFee] = useState(10);
    const [provisioningDomain, setProvisioningDomain] = useState(false);

    useEffect(() => {
        if (isFranchiseAdmin && !isMasterAdmin && myFranchiseId) {
            const unsubscribe = db.collection('franchises').doc(myFranchiseId).onSnapshot(doc => {
                if (doc.exists) {
                    setFranchises([{ id: doc.id, ...doc.data() } as Franchise]);
                } else {
                    setFranchises([]);
                }
                setLoading(false);
            }, (error) => {
                console.error("Error fetching franchise:", error);
                setLoading(false);
            });
            return () => unsubscribe();
        } else if (isMasterAdmin) {
            const unsubscribe = db.collection('franchises').onSnapshot(snap => {
                let list: Franchise[] = [];
                snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Franchise));
                setFranchises(list);
                setLoading(false);
            }, (error) => {
                console.error("Error in master franchise listener:", error);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setLoading(false);
            setFranchises([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFranchiseAdmin, isMasterAdmin, myFranchiseId]);

    // Auto-select if they only have exactly 1 record visible (for Franchise Admins)
    useEffect(() => {
        if (isFranchiseAdmin && !isMasterAdmin && franchises.length === 1 && !isEditing) {
            handleSelect(franchises[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [franchises, isFranchiseAdmin, isMasterAdmin, isEditing]);

    // Live Color Preview
    useEffect(() => {
        const root = document.documentElement;
        
        if (isEditing && formColor) {
            const shades = generateColorShades(formColor);
            Object.entries(shades).forEach(([weight, hex]) => {
                root.style.setProperty(`--color-primary-${weight}`, hex);
            });
        } else if (!isEditing && selectedFranchise?.branding?.primaryColor) {
            const shades = generateColorShades(selectedFranchise.branding.primaryColor);
            Object.entries(shades).forEach(([weight, hex]) => {
                root.style.setProperty(`--color-primary-${weight}`, hex);
            });
        }
        
        return () => {
            // Cleanup on unmount! Prevents bleeding into the master platform.
            const weights = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
            weights.forEach(w => root.style.removeProperty(`--color-primary-${w}`));
        };
    }, [formColor, isEditing, selectedFranchise]);

    const handleSelect = (fr: any) => {
        setSelectedFranchise(fr);
        setFormName(fr.name);
        setFormDomain(fr.branding?.customDomain || '');
        setFormLogo(fr.branding?.logoUrl || '');
        setFormColor(fr.branding?.primaryColor || '#FF5733');
        setFormGeminiKey(fr.aiApiKeys?.gemini || '');
        setFormAnthropicKey(fr.aiApiKeys?.anthropic || '');
        setFormOpenaiKey(fr.aiApiKeys?.openai || '');
        setFormActiveProvider(fr.aiApiKeys?.activeProvider || 'openai');
        setFormTerritoryStates(fr.constraints?.territoryStates?.join(', ') || '');
        setFormBusinessTypes(fr.constraints?.allowedBusinessTypes?.join(', ') || '');
        setFormAgreementSigned(fr.billing?.agreementSigned || false);
        setFormSetupFeePaid(fr.billing?.setupFeePaid || false);
        setFormPerUserFee(fr.billing?.perUserFee ?? 10);
        setFormPerVirtualWorkerFee(fr.billing?.perVirtualWorkerFee ?? 10);
        setIsEditing(true);
    };

    const handleCreateNew = () => {
        setIsEditing(true);
        setSelectedFranchise(null);
        setFormName('');
        setFormDomain('');
        setFormLogo('');
        setFormColor('#3b82f6'); 
        setFormGeminiKey('');
        setFormAnthropicKey('');
        setFormOpenaiKey('');
        setFormActiveProvider('openai');
        setFormTerritoryStates('');
        setFormBusinessTypes('');
        setFormAgreementSigned(false);
        setFormSetupFeePaid(false);
        setFormPerUserFee(10);
        setFormPerVirtualWorkerFee(10);
    };

    const handleSave = async () => {
        try {
            const dataToSave = {
                name: formName,
                branding: {
                    customDomain: formDomain,
                    logoUrl: formLogo,
                    primaryColor: formColor,
                },
                aiApiKeys: {
                    gemini: formGeminiKey,
                    anthropic: formAnthropicKey,
                    openai: formOpenaiKey,
                    activeProvider: formActiveProvider
                },
                constraints: {
                    territoryStates: formTerritoryStates.split(',').map(s => s.trim()).filter(s => s),
                    allowedBusinessTypes: formBusinessTypes.split(',').map(s => s.trim()).filter(s => s)
                },
                billing: {
                    agreementSigned: formAgreementSigned,
                    setupFeePaid: formSetupFeePaid,
                    monthlyFee: 1000,
                    perUserFee: formPerUserFee,
                    perVirtualWorkerFee: formPerVirtualWorkerFee
                },
                updatedAt: new Date().toISOString()
            };

            if (selectedFranchise) {
                await db.collection('franchises').doc(selectedFranchise.id).update(dataToSave as any);
            } else {
                await db.collection('franchises').add({
                    ...dataToSave,
                    createdAt: new Date().toISOString(),
                    ownerUserId: null
                });
            }
            setIsEditing(false);
        } catch (e: any) {
            showToast.warn('Failed to save franchise: ' + e.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you SURE? This will orphan all tenants under this franchise!")) return;
        await db.collection('franchises').doc(id).delete();
        setIsEditing(false);
        setSelectedFranchise(null);
    };

    const handleBillFranchise = async () => {
        if (!selectedFranchise) return;
        
        const jobId = `franchise-bill-${Date.now()}`;
        const invoiceData = {
            id: jobId,
            organizationId: 'platform',
            franchiseId: selectedFranchise.id,
            customerName: selectedFranchise.name || 'Unknown',
            customerId: selectedFranchise.id,
            customerEmail: '',
            tasks: ['Franchise Monthly / Onboarding Fee'],
            jobStatus: 'Completed',
            source: 'PlatformAdmin',
            invoice: {
                id: `FRANCHISE-${Date.now()}`,
                status: 'Unpaid',
                items: [{
                    id: 'f-fee-1',
                    description: 'TekTrakker Franchise Operations Fee',
                    quantity: 1,
                    unitPrice: 1000,
                    total: 1000,
                    type: 'Fee'
                }],
                subtotal: 1000,
                taxRate: 0,
                taxAmount: 0,
                totalAmount: 1000,
                amount: 1000
            },
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('jobs').doc(jobId).set(invoiceData);
            showToast.warn(`Drafted $1,000 Franchise invoice for ${selectedFranchise.name}. View paper trail in Master Billing.`);
        } catch(e) {
            showToast.warn('Failed to bill franchise');
        }
    };

    const handleProvisionDomain = async () => {
        if (!formDomain) return showToast.warn("Please enter a Custom Domain Hostname first.");
        if (!selectedFranchise) return showToast.warn("Please save this franchise before provisioning DNS.");

        setProvisioningDomain(true);
        try {
            const provisionCustomDomain = functions.httpsCallable('provisionCustomDomain');
            await provisionCustomDomain({
                domainUrl: formDomain,
                franchiseId: selectedFranchise.id
            });
            showToast.warn(`Domain provisioned successfully! Refresh to view DNS instructions.`);
        } catch (e: any) {
            console.error("DNS Provisioning Failed", e);
            showToast.warn(`DNS Provisioning Failed: ${e.message}`);
        } finally {
            setProvisioningDomain(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const fileName = `${Date.now()}_${file.name}`;
            const storageRef = storage.ref(`franchises/logos/${selectedFranchise?.id || 'new'}/${fileName}`);
            await storageRef.put(file);
            const downloadUrl = await storageRef.getDownloadURL();
            setFormLogo(downloadUrl);
        } catch (error) {
            showToast.warn("Failed to upload logo.");
            console.error(error);
        }
    };

    if (loading) {
        return <div className="p-8 flex items-center justify-center"><Loader2 className="animate-spin text-primary-500 mr-2"/> Loading Franchisees...</div>;
    }

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto pb-32">
            <div className="flex items-center justify-between mb-8">
                <div>
                </div>
                {!isEditing && isMasterAdmin && (
                    <button onClick={handleCreateNew} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg">
                        <Plus size={20} /> New Franchise
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in">
                    <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">{selectedFranchise ? 'Edit Configuration' : 'Create New Franchise'}</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2"><Store size={16}/> Identity</h3>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Franchise Internal Name</label>
                                <input aria-label="Franchise Internal Name" title="Franchise Internal Name" type="text" readOnly={!isMasterAdmin} value={formName} onChange={e => isMasterAdmin && setFormName(e.target.value)} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 opacity-80" placeholder="e.g. Acme Services Southeast" />
                            </div>

                            {selectedFranchise && (
                                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3"><ShieldCheck size={14}/> Assigned Administrators</h4>
                                    <div className="space-y-2">
                                        {state.users.filter(u => u.role === 'franchise_admin' && u.franchiseId === selectedFranchise.id).length > 0 ? (
                                            state.users.filter(u => u.role === 'franchise_admin' && u.franchiseId === selectedFranchise.id).map(admin => (
                                                <div key={admin.id} className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                                    <span>{admin.firstName} {admin.lastName}</span>
                                                    <span className="text-xs text-slate-500 break-all">{admin.email}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-slate-500 italic bg-amber-50 dark:bg-amber-900/10 text-amber-600 p-2 rounded border border-amber-200 dark:border-amber-900/50">
                                                No administrators assigned. You can assign users from the Global Users panel.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2 mt-8"><Globe size={16}/> White-Label Branding</h3>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Custom Domain Hostname (No https://)</label>
                                <div className="flex gap-2 mt-1">
                                    <input aria-label="Custom Domain Hostname" title="Custom Domain Hostname" type="text" value={formDomain} onChange={e => setFormDomain(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2" placeholder="e.g. portal.acmeservices.com" />
                                    {selectedFranchise && (
                                        <button 
                                            onClick={handleProvisionDomain} 
                                            disabled={provisioningDomain}
                                            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold truncate flex items-center gap-2 transition-colors disabled:opacity-50"
                                            title="Provision DNS Records"
                                        >
                                            {provisioningDomain ? <Loader2 size={16} className="animate-spin" /> : <CloudLightning size={16} />} 
                                            <span className="hidden sm:inline">Connect</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {selectedFranchise?.dnsConfig?.records && (
                                <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Globe size={16}/> DNS Records</h4>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${selectedFranchise.dnsConfig.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {selectedFranchise.dnsConfig.status || 'PENDING'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-4">Add these TXT verify records to your DNS provider to complete setup and activate SSL.</p>
                                    
                                    <div className="space-y-3">
                                        {Object.entries(selectedFranchise.dnsConfig.records).map(([key, record]: [string, any]) => (
                                            record.txtRecord && (
                                                <div key={key} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs font-mono group">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-slate-400 capitalize">{key.replace('Record', '')} Verify</span>
                                                        <button aria-label="Copy TXT Value" title="Copy TXT Value" onClick={() => { navigator.clipboard.writeText(record.txtRecord); showToast.warn('Copied TXT Value'); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary-500"><Copy size={14}/></button>
                                                    </div>
                                                    <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
                                                        <span className="text-slate-500 font-bold">Type:</span> <span className="text-slate-slate-900 dark:text-white">TXT</span>
                                                        <span className="text-slate-500 font-bold">Host:</span> <span className="text-slate-slate-900 dark:text-white">{record.domainName || '_acme-challenge'}</span>
                                                        <span className="text-slate-500 font-bold">Value:</span> <span className="text-slate-slate-900 dark:text-white truncate" title={record.txtRecord}>{record.txtRecord}</span>
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Custom Logo URL (SVG or Transparent PNG)</label>
                                <div className="flex gap-2 mt-1 items-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg pr-1">
                                    <input aria-label="Custom Logo URL" title="Custom Logo URL" type="text" value={formLogo} onChange={e => setFormLogo(e.target.value)} className="w-full bg-transparent px-4 py-2 outline-none" placeholder="https://..." />
                                    <label className="cursor-pointer bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 p-2 rounded-md transition-colors" title="Upload Logo image">
                                         <Upload size={16} />
                                         <input type="file" aria-label="Logo Upload" title="Logo Upload" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                    </label>
                                </div>
                                {formLogo && <img src={formLogo} alt="Logo preview" className="mt-4 h-16 w-auto object-contain rounded-lg border border-slate-200 dark:border-slate-700 p-2 bg-white dark:bg-slate-800" />}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">Primary Brand Color</label>
                                <div className="flex items-center gap-3">
                                    <input aria-label="Primary Brand Color Picker" title="Primary Brand Color Picker" type="color" value={formColor} onChange={e => setFormColor(e.target.value)} className="w-12 h-12 rounded cursor-pointer border-0 p-0" />
                                    <input aria-label="Primary Brand Color Hex" title="Primary Brand Color Hex" type="text" value={formColor} onChange={e => setFormColor(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 uppercase font-mono" placeholder="#000000" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {isMasterAdmin && (
                                <>
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2"><Map size={16}/> Territory & Licensing</h3>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Allowed US States (Comma separated)</label>
                                        <input aria-label="Allowed US States" title="Allowed US States" type="text" value={formTerritoryStates} onChange={e => setFormTerritoryStates(e.target.value)} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2" placeholder="e.g. FL, GA, SC" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Allowed Business Types (Comma separated)</label>
                                        <input aria-label="Allowed Business Types" title="Allowed Business Types" type="text" value={formBusinessTypes} onChange={e => setFormBusinessTypes(e.target.value)} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2" placeholder="e.g. HVAC, Plumbing, Electrical" />
                                    </div>

                                    <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/50 rounded-xl space-y-3">
                                        <h4 className="text-sm font-bold text-orange-800 dark:text-orange-400 flex items-center gap-2"><Handshake size={16}/> Contract Prerequisites</h4>
                                        <div className="flex flex-col gap-2">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input type="checkbox" checked={formAgreementSigned} onChange={e => setFormAgreementSigned(e.target.checked)} className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500" />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">1-Year Master Agreement Signed</span>
                                            </label>
                                            {formAgreementSigned && (
                                                <div className="ml-8 mt-2 space-y-3">
                                                    <a href="/#/franchise-agreement" target="_blank" rel="noopener" className="text-xs text-primary-600 font-bold hover:underline flex items-center gap-1">
                                                        <ShieldCheck size={12} /> View Master Agreement Terms
                                                    </a>
                                                    {selectedFranchise?.billing?.signatureBase64 && (
                                                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg inline-block">
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Captured Signature:</p>
                                                            <img src={selectedFranchise.billing.signatureBase64} alt="Signature" className="h-12 w-auto invert dark:invert-0 opacity-80" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input type="checkbox" checked={formSetupFeePaid} onChange={e => setFormSetupFeePaid(e.target.checked)} className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500" />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">$1,500 Setup & DNS Fee Paid via PayPal/Square</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            <div>
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">TekTrakker Rev-Share: Per User ($)</label>
                                                <input aria-label="Per User Fee" title="Per User Fee" type="number" placeholder="0" value={formPerUserFee} onChange={e => setFormPerUserFee(parseFloat(e.target.value) || 0)} className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">TekTrakker Rev-Share: Per Virtual Worker ($)</label>
                                                <input aria-label="Per Virtual Worker Fee" title="Per Virtual Worker Fee" type="number" placeholder="0" value={formPerVirtualWorkerFee} onChange={e => setFormPerVirtualWorkerFee(parseFloat(e.target.value) || 0)} className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5" />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2 mt-8"><Key size={16}/> AI Provider & BYOK</h3>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Active AI Routing</label>
                                <select aria-label="Active AI Routing" title="Active AI Routing" value={formActiveProvider} onChange={e => setFormActiveProvider(e.target.value as any)} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2">
                                    <option value="openai">OpenAI (Strict BYOK)</option>
                                    <option value="anthropic">Anthropic (Strict BYOK)</option>
                                    <option value="gemini">Google Gemini (Strict BYOK)</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">TekTrakker no longer funds AI usage. Tenant must provide an active key.</p>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">OpenAI API Key</label>
                                <input aria-label="OpenAI API Key" title="OpenAI API Key" type="password" value={formOpenaiKey} onChange={e => setFormOpenaiKey(e.target.value)} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2" placeholder="sk-..." />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Anthropic API Key</label>
                                <input aria-label="Anthropic API Key" title="Anthropic API Key" type="password" value={formAnthropicKey} onChange={e => setFormAnthropicKey(e.target.value)} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2" placeholder="sk-ant-..." />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Google Gemini API Key</label>
                                <input aria-label="Google Gemini API Key" title="Google Gemini API Key" type="password" value={formGeminiKey} onChange={e => setFormGeminiKey(e.target.value)} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2" placeholder="AIzaSy..." />
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 flex gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2"><Save size={18}/> Save Configuration</button>
                        {isMasterAdmin && (
                            <button onClick={() => setIsEditing(false)} className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-6 py-3 rounded-lg font-bold">Cancel</button>
                        )}
                        {selectedFranchise && isMasterAdmin && <button title="Delete Franchise" aria-label="Delete Franchise" onClick={() => handleDelete(selectedFranchise.id)} className="ml-auto text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg"><Trash2 size={20}/></button>}
                        {selectedFranchise && isMasterAdmin && <button title="Bill Franchise" aria-label="Bill Franchise" onClick={handleBillFranchise} className="text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-purple-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2"><CreditCard size={18}/> Bill Franchise</button>}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {franchises.map(fr => (
                        <div key={fr.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col group hover:border-primary-500 transition-all shadow-sm hover:shadow-md cursor-pointer" onClick={() => handleSelect(fr)}>
                            <div className="flex items-center gap-4 mb-4">
                                {/* eslint-disable-next-line react/forbid-dom-props */}
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-700" style={{ backgroundColor: fr.branding?.primaryColor ? `${fr.branding.primaryColor}20` : '#f1f5f9' }}> {/* NOSONAR */}
                                    {fr.branding?.logoUrl ? <img src={fr.branding.logoUrl} className="w-8 h-8 object-contain" alt="Logo" /> : <Network className="text-slate-400" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">{fr.name}</h3>
                                    <p className="text-xs text-slate-500">{fr.id}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-3 mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Domain</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{fr.branding?.customDomain || 'System Default'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Territory</span>
                                    <span className="font-medium text-slate-900 dark:text-white max-w-[120px] truncate" title={fr.constraints?.territoryStates?.join(', ')}>{fr.constraints?.territoryStates?.join(', ') || 'Global'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">AI Routing</span>
                                    <span className="font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded text-xs uppercase">{fr.aiApiKeys?.activeProvider || 'BYOK Missing'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {franchises.length === 0 && <div className="col-span-full text-center py-12 text-slate-500">No franchises found. Create one.</div>}
                </div>
            )}
        </div>
    );
};

export default FranchiseManager;
