import showToast from "lib/toast";
import { getBaseUrl , cleanUndefinedFields } from "lib/utils";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../../../context/AppContext';
import { db, functions } from '../../../../lib/firebase';
import type { Subcontractor } from '../../../../types';
import Button from '../../../../components/ui/Button';
import SubcontractorModal from '../../../../components/modals/AddSubcontractorModal'; 
import SubcontractorComplianceModal from '../../../../components/modals/SubcontractorComplianceModal';
import Card from '../../../../components/ui/Card';
import Input from '../../../../components/ui/Input';
import Modal from '../../../../components/ui/Modal';
import { PlusCircle, Copy, Link2, Mail, CheckCircle2, XCircle, Trash2, RefreshCw, Printer, FileText, Search, ShieldCheck, AlertTriangle, Receipt, Calendar, DollarSign, AlertCircle, ChevronDown, ChevronUp, Send, Check, BellRing, Sparkles } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import Form1099CopyA from '../../../master/components/sales-team/Form1099CopyA';
import { sendEmail, notifyAdmins } from 'lib/notificationService';
import { checkSubcontractorCompliance } from '../../../../lib/subcontractorCompliance';
import SubcontractorJobsModal from '../../../../components/modals/SubcontractorJobsModal';
import SubcontractorStatementModal from '../../../../components/modals/SubcontractorStatementModal';
import SubcontractorChargebackModal from '../../../../components/modals/SubcontractorChargebackModal';
import type { SubcontractorChargeback } from '../../../../types';
import { Briefcase } from 'lucide-react';

const SubcontractorsTab: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<Partial<Subcontractor> | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [viewTaxSub, setViewTaxSub] = useState<Subcontractor | null>(null);
    const [complianceSub, setComplianceSub] = useState<Subcontractor | null>(null);
    const [viewJobsSub, setViewJobsSub] = useState<Subcontractor | null>(null);
    const [statementSub, setStatementSub] = useState<Subcontractor | null>(null);
    const [chargebackSub, setChargebackSub] = useState<Subcontractor | null>(null);
    const [allChargebacks, setAllChargebacks] = useState<SubcontractorChargeback[]>([]);
    const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
    const [taxAmountOverride, setTaxAmountOverride] = useState<string>('');
    const [isSending1099Email, setIsSending1099Email] = useState(false);
    const [isTriggeringReminder, setIsTriggeringReminder] = useState(false);
    const [show1099Ledger, setShow1099Ledger] = useState(true);
    const [showYearEndBanner, setShowYearEndBanner] = useState(true);

    // Fetch org-wide chargebacks for real-time badge counts
    React.useEffect(() => {
        if (!state.currentOrganization?.id) return;
        const unsub = db.collection('subcontractor_chargebacks')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubcontractorChargeback));
                setAllChargebacks(list);
            }, err => {
                console.error("Error loading chargebacks in SubcontractorsTab:", err);
            });
        return () => unsub();
    }, [state.currentOrganization?.id]);

    const handleNewSub = () => {
        setEditingSub(null);
        setModalOpen(true);
    };

    const handleEditSub = (sub: Subcontractor) => {
        setEditingSub(sub);
        setModalOpen(true);
    };

    const handleSaveSub = async (sub: Partial<Subcontractor>) => {
        setIsProcessing(true);
        const subId = sub.id || `sub-${Date.now()}`;
        const orgId = state.currentOrganization?.id || '';
        
        // Determine status change
        const isNewLink = sub.linkedOrgId && (!sub.handshakeStatus || sub.handshakeStatus === 'None');
        const newStatus = isNewLink ? 'Pending' : (sub.handshakeStatus || 'None');

        const subData = {
            ...sub,
            id: subId,
            organizationId: orgId,
            status: sub.status || 'Active',
            handshakeStatus: newStatus
        };

        try {
            // 1. Save Local Doc
            const cleanData = Object.fromEntries(Object.entries(subData).filter(([_, v]) => v !== undefined));
            await db.collection('subcontractors').doc(subId).set(cleanUndefinedFields(cleanData), { merge: true });
            // Don't dispatch here if we rely on subscription, OR ensure we don't duplicate.
            // Dispatching helps UI responsiveness before sync.
            dispatch({ type: sub.id ? 'UPDATE_SUBCONTRACTOR' : 'ADD_SUBCONTRACTOR', payload: cleanData });
            
            // 2. Send Handshake Request if new link
            if (isNewLink && sub.linkedOrgId) {
                const manageHandshake = functions.httpsCallable('manageHandshake');
                await manageHandshake({
                    action: 'request',
                    targetOrgId: sub.linkedOrgId,
                    requestingOrgId: orgId,
                    subcontractorId: subId
                });
                showToast.warn("Handshake request sent!");
            }

            setModalOpen(false);
        } catch (e: any) {
            console.error(e);
            showToast.warn("Failed to save: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelRequest = async (sub: Subcontractor) => {
        if (!await globalConfirm("Cancel this handshake request?")) return;
        setIsProcessing(true);
        try {
            const manageHandshake = functions.httpsCallable('manageHandshake');
            await manageHandshake({
                action: 'cancel',
                targetOrgId: sub.linkedOrgId,
                requestingOrgId: state.currentOrganization?.id,
                subcontractorId: sub.id
            });
            
            // Optimistic update
            const updatedSub = { ...sub, handshakeStatus: 'None' as const };
            dispatch({ type: 'UPDATE_SUBCONTRACTOR', payload: updatedSub });
            showToast.warn("Request cancelled.");
        } catch (e: any) {
            showToast.warn("Error: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUnlink = async (sub: Subcontractor) => {
        if (!await globalConfirm("Are you sure you want to unlink this partner? They will be removed from your network.")) return;
        setIsProcessing(true);
        try {
            const manageHandshake = functions.httpsCallable('manageHandshake');
            await manageHandshake({
                action: 'unlink',
                targetOrgId: sub.linkedOrgId, // The other org
                requestingOrgId: state.currentOrganization?.id, // Me
                subcontractorId: sub.id
            });
            
            // Optimistic update
            const updatedSub = { ...sub, handshakeStatus: 'None' as const };
            dispatch({ type: 'UPDATE_SUBCONTRACTOR', payload: updatedSub });
            showToast.warn("Partner unlinked.");
        } catch (e: any) {
            showToast.warn("Error: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteSub = async (sub: Subcontractor) => {
        if (!await globalConfirm("Delete this subcontractor record?")) return;
        try {
            if (sub.handshakeStatus === 'Linked' && sub.linkedOrgId) {
                await handleUnlink(sub); // Unlink first
            }
            await db.collection('subcontractors').doc(sub.id).delete();
            
            // Manually filter it out via SET_SUBCONTRACTORS since DELETE_SUBCONTRACTOR is not in reducer
            const newSubs = state.subcontractors.filter(s => s.id !== sub.id);
            dispatch({ type: 'SET_SUBCONTRACTORS', payload: newSubs });

        } catch (e: any) {
            showToast.warn("Failed to delete: " + e.message);
        }
    };

    const handleApproveRequest = async (request: any) => {
        setIsProcessing(true);
        try {
            const manageHandshake = functions.httpsCallable('manageHandshake');
            await manageHandshake({
                action: 'approve',
                targetOrgId: state.currentOrganization?.id, // I am the target/approver
                requestingOrgId: request.fromOrgId,
                subcontractorId: request.subcontractorId // ID in THEIR db
            });
            showToast.warn("Approved! The organizations are now linked.");
        } catch (e: any) {
            showToast.warn("Error: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRejectRequest = async (request: any) => {
        if (!await globalConfirm("Reject this request?")) return;
        setIsProcessing(true);
        try {
            const manageHandshake = functions.httpsCallable('manageHandshake');
            await manageHandshake({
                action: 'reject',
                targetOrgId: state.currentOrganization?.id,
                requestingOrgId: request.fromOrgId,
                subcontractorId: request.subcontractorId
            });
            showToast.warn("Request rejected.");
        } catch (e: any) {
            showToast.warn("Error: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSetupNoLogin = async (sub: Subcontractor) => {
        setIsProcessing(true);
        try {
            const updated = {
                ...sub,
                type: 'external',
                isInternal: false,
                isSubscribedToTekTrakker: false,
                status: 'Active'
            };
            await db.collection('subcontractors').doc(sub.id).set(cleanUndefinedFields(updated), { merge: true });
            dispatch({ type: 'UPDATE_SUBCONTRACTOR', payload: updated });
            showToast.success(`${sub.companyName || (sub as any).name || 'Subcontractor'} set up for no-login email & link dispatches!`);
        } catch (e: any) {
            showToast.error("Failed to update subcontractor status: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendInvite = async (email: string, withDiscount: boolean) => {
        const { name: orgName, id: orgId } = state.currentOrganization || {};
        const normalizedEmail = email.toLowerCase().trim();
        if (!orgName || !orgId || !normalizedEmail) return;

        const inviteLink = `${getBaseUrl()}/#/register?view=register_business&email=${encodeURIComponent(normalizedEmail)}&oid=${orgId}${withDiscount ? '&promo=true' : ''}`;
        const subject = withDiscount ? `10% Discount: Join ${orgName} on TekTrakker` : `Join ${orgName} on TekTrakker`;

        const htmlBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Invitation from ${orgName}</h2>
                <p>Hi,</p>
                <p>${orgName} has invited you to join their service network on <strong>TekTrakker</strong>.</p>
                ${withDiscount ? '<p style="color: #059669; font-weight: bold;">Good news! You\'ve been granted a 10% discount on your subscription.</p>' : ''}
                <p style="margin: 30px 0;">
                    <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation & Register</a>
                </p>
                <p style="font-size: 12px; color: #666;">If the button above doesn't work, copy and paste this link into your browser:<br/>
                <a href="${inviteLink}">${inviteLink}</a></p>
                <br/>
                <p>Thanks,<br/>The TekTrakker Team</p>
            </div>
        `;

        try {
            // 1. Create a root user document (Acts as an INVITE for registration)
            const inviteDoc: any = {
                email: normalizedEmail,
                organizationId: orgId,
                role: 'employee',
                status: 'invited',
                createdAt: new Date().toISOString(),
                preferences: { theme: 'dark' },
                hireDate: new Date().toISOString(),
                payRate: 0,
                ptoAccrued: 0
            };

            await db.collection('users').doc(normalizedEmail).set(cleanUndefinedFields(inviteDoc), { merge: true });

            // 2. Send Invitation Email
            await sendEmail(state.currentOrganization, {
                to: [normalizedEmail],
                message: { subject, html: htmlBody },
                type: 'Invite',
                referralMeta: withDiscount ? { referringOrgId: orgId, referredEmail: normalizedEmail } : null
            });
            showToast.warn("Invitation sent successfully!");
        } catch (e) { showToast.warn("Failed to send invite."); }
    };

    const handleCopyId = () => {
        if (state.currentOrganization?.id) {
            navigator.clipboard.writeText(state.currentOrganization.id);
            showToast.warn('ID Copied!');
        }
    };

    const partnerRequests = state.currentOrganization?.partnerRequests || [];

    // Deduplicate logic
    const uniqueSubs = useMemo(() => {
        const seen = new Set();
        return state.subcontractors.filter(sub => {
            const duplicate = seen.has(sub.id);
            seen.add(sub.id);
            return !duplicate;
        });
    }, [state.subcontractors]);

    // Formatted recipient for Form 1099-NEC
    const taxRecipient = useMemo(() => {
        if (!viewTaxSub) return null;
        const legalName = (viewTaxSub as any).legalCompanyName;
        const dba = viewTaxSub.companyName;
        const displayName = legalName && dba && legalName !== dba
            ? `${legalName} (DBA: ${dba})`
            : (legalName || dba || viewTaxSub.contactName);
        return {
            ...viewTaxSub,
            companyName: displayName,
            taxId: viewTaxSub.taxId || (viewTaxSub as any).w9Details?.taxId || (viewTaxSub as any).ssn || 'Pending W-9',
            address: viewTaxSub.address || (viewTaxSub as any).w9Details?.address
        };
    }, [viewTaxSub]);

    // Subcontractor payouts calculation for viewTaxSub
    const subPayouts = useMemo(() => {
        if (!viewTaxSub) return [];
        const orgId = state.currentOrganization?.id;
        const subId = viewTaxSub.id;
        const searchTerms = [
            viewTaxSub.companyName?.toLowerCase(),
            viewTaxSub.contactName?.toLowerCase(),
            (viewTaxSub as any).legalCompanyName?.toLowerCase()
        ].filter(Boolean) as string[];

        const matchedExpenses = (state.expenses || []).filter(e => {
            // Tax year check
            const expDate = e.date ? String(e.date) : '';
            const expYear = expDate ? new Date(expDate).getFullYear() : null;
            if (expYear !== taxYear) return false;

            // Paid status check
            if ((e as any).status && !['Paid', 'Settled'].includes((e as any).status)) return false;

            // Direct ID match
            if ((e as any).subcontractorId === subId) return true;

            // Vendor name match for Subcontractor Labor
            if (e.category === 'Subcontractor Labor') {
                const vendorLower = (e.vendor || '').toLowerCase();
                if (searchTerms.some(term => vendorLower.includes(term))) return true;
            }
            return false;
        });

        return matchedExpenses.map(e => ({
            id: e.id,
            date: e.date || '',
            category: e.category,
            vendor: e.vendor || viewTaxSub.companyName,
            statementNumber: (e as any).statementNumber,
            description: e.description || `Subcontractor Labor Settlement - ${e.vendor || viewTaxSub.companyName}`,
            amount: Number(e.amount) || 0,
            paymentMethod: (e as any).paymentMethod || (e as any).paidBy || 'ACH / Direct Deposit'
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [viewTaxSub, taxYear, state.expenses, state.currentOrganization?.id]);

    const autoCalculatedTaxAmount = useMemo(() => {
        return subPayouts.reduce((sum, p) => sum + p.amount, 0);
    }, [subPayouts]);

    const finalTaxAmount = taxAmountOverride !== '' ? (parseFloat(taxAmountOverride) || 0) : autoCalculatedTaxAmount;

    // Org-wide annual 1099 summary
    const annual1099Summary = useMemo(() => {
        const orgId = state.currentOrganization?.id;
        return uniqueSubs.map(sub => {
            const subNames = [
                sub.companyName?.toLowerCase(),
                sub.contactName?.toLowerCase(),
                (sub as any).legalCompanyName?.toLowerCase()
            ].filter(Boolean) as string[];

            const paidExpenses = (state.expenses || []).filter(e => {
                if (orgId && e.organizationId && e.organizationId !== orgId) return false;
                const expDate = e.date ? String(e.date) : '';
                const expYear = expDate ? new Date(expDate).getFullYear() : null;
                if (expYear !== taxYear) return false;
                if ((e as any).status && !['Paid', 'Settled'].includes((e as any).status)) return false;
                if ((e as any).subcontractorId === sub.id) return true;
                if (e.category === 'Subcontractor Labor') {
                    const vendorLower = (e.vendor || '').toLowerCase();
                    if (subNames.some(term => vendorLower.includes(term))) return true;
                }
                return false;
            });

            const totalPaid = paidExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const hasW9 = !!((sub as any).taxId || (sub as any).w9Details?.taxId || (sub as any).ssn || (sub.complianceDocs || []).some((d: any) => d.docKey === 'w9' && d.status === 'verified'));

            return {
                subcontractor: sub,
                totalPaid,
                hasW9,
                is1099Required: totalPaid >= 600,
                payoutCount: paidExpenses.length
            };
        }).sort((a, b) => b.totalPaid - a.totalPaid);
    }, [uniqueSubs, state.expenses, state.currentOrganization?.id, taxYear]);

    const eligible1099Subs = useMemo(() => {
        return annual1099Summary.filter(s => s.is1099Required);
    }, [annual1099Summary]);

    const total1099Volume = useMemo(() => {
        return eligible1099Subs.reduce((sum, s) => sum + s.totalPaid, 0);
    }, [eligible1099Subs]);

    // Send Form 1099-NEC via Email
    const handleSend1099Email = async () => {
        if (!viewTaxSub || !state.currentOrganization) return;
        const recipientEmail = viewTaxSub.email;
        if (!recipientEmail) {
            showToast.warn("Subcontractor does not have an email address on file.");
            return;
        }

        setIsSending1099Email(true);
        try {
            const orgName = state.currentOrganization.name || 'TekAir Inc.';
            const orgEmail = state.currentOrganization.email || 'accounts-payable@tekairinc.com';
            const subName = taxRecipient?.companyName || viewTaxSub.companyName;

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
                    <div style="background-color: #0f172a; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; font-size: 18px;">Form 1099-NEC Annual Nonemployee Compensation Statement</h2>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Tax Year ${taxYear} • Issued by ${orgName}</p>
                    </div>
                    <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
                        <p>Dear <strong>${subName}</strong>,</p>
                        <p>Please find below your annual Form 1099-NEC nonemployee compensation summary for tax year <strong>${taxYear}</strong> for services rendered to <strong>${orgName}</strong>.</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 20px 0;">
                            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;"><strong>Recipient / Legal Entity:</strong></td>
                                    <td style="padding: 6px 0; text-align: right; font-weight: 700;">${subName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;"><strong>Recipient TIN / SSN:</strong></td>
                                    <td style="padding: 6px 0; text-align: right; font-family: monospace;">${taxRecipient?.taxId ? `XXX-XX-${taxRecipient.taxId.slice(-4)}` : 'On File'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b;"><strong>Tax Year:</strong></td>
                                    <td style="padding: 6px 0; text-align: right; font-weight: 700;">${taxYear}</td>
                                </tr>
                                <tr style="border-top: 1px solid #e2e8f0;">
                                    <td style="padding: 10px 0 6px 0; color: #0f172a; font-size: 15px;"><strong>Box 1 Nonemployee Compensation:</strong></td>
                                    <td style="padding: 10px 0 6px 0; text-align: right; font-size: 18px; font-weight: 900; color: #047857; font-family: monospace;">$${finalTaxAmount.toFixed(2)}</td>
                                </tr>
                            </table>
                        </div>

                        ${subPayouts.length > 0 ? `
                        <p style="font-size: 12px; color: #475569; margin-bottom: 8px;"><strong>Itemized Remittance Records Included:</strong></p>
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 20px;">
                            <thead>
                                <tr style="background-color: #f1f5f9; text-align: left;">
                                    <th style="padding: 6px;">Date</th>
                                    <th style="padding: 6px;">Reference</th>
                                    <th style="padding: 6px; text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${subPayouts.map(p => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 6px;">${p.date}</td>
                                        <td style="padding: 6px;">${p.statementNumber ? `Statement #${p.statementNumber}` : p.description}</td>
                                        <td style="padding: 6px; text-align: right; font-family: monospace;">$${p.amount.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : ''}

                        <p style="font-size: 12px; color: #64748b;">
                            This document serves as your copy of Form 1099-NEC. Please keep this for your federal and state tax records. If you have any questions or discrepancies, please contact ${orgEmail}.
                        </p>
                    </div>
                </div>
            `;

            await sendEmail(state.currentOrganization, {
                to: [recipientEmail],
                message: {
                    subject: `Form 1099-NEC Statement (${taxYear}) - ${orgName}`,
                    html: emailHtml
                },
                type: '1099-NEC'
            });

            showToast.success(`Form 1099-NEC successfully emailed to ${recipientEmail}!`);
        } catch (err: any) {
            console.error("Error sending 1099 email:", err);
            showToast.error("Failed to email 1099 form: " + (err.message || 'Unknown error'));
        } finally {
            setIsSending1099Email(false);
        }
    };

    // Trigger Admin Year-End Filing Reminder Notification
    const handleTriggerYearEndReminder = async () => {
        if (!state.currentOrganization?.id) return;
        setIsTriggeringReminder(true);
        try {
            const orgId = state.currentOrganization.id;
            const orgName = state.currentOrganization.name || 'TekAir';

            const payload = {
                title: `IRS Form 1099-NEC Year-End Filing Alert (${taxYear})`,
                body: `${eligible1099Subs.length} subcontractor(s) have reached the IRS $600+ threshold in ${taxYear} (Total: $${total1099Volume.toFixed(2)}). Ensure all 1099-NEC forms are generated and dispatched by January 31.`,
                link: '/admin/workforce?tab=subcontractors',
                type: '1099_year_end_reminder',
                data: {
                    taxYear,
                    eligibleCount: eligible1099Subs.length,
                    totalPaid: total1099Volume
                }
            };

            await notifyAdmins(orgId, payload);
            showToast.success(`Year-end 1099 filing reminder dispatched to all ${orgName} administrators!`);
        } catch (err: any) {
            console.error("Error triggering reminder:", err);
            showToast.error("Failed to trigger reminder.");
        } finally {
            setIsTriggeringReminder(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6 space-y-6">
            
            {/* ID Section */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs tracking-widest">Network Handshake ID</h4>
                        <p className="text-sm text-slate-500 mt-1">Provide this ID to existing TekTrakker partners to link your businesses.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-700 p-2 rounded-lg border shadow-sm">
                        <code className="text-sm font-black text-primary-600">{state.currentOrganization?.id}</code>
                        <button onClick={handleCopyId} aria-label="Copy Handshake ID" title="Copy Handshake ID" className="p-1 hover:text-primary-600 transition-colors"><Copy size={14} /></button>
                    </div>
                </div>
            </div>

            {/* Year-End 1099 Tax Compliance Center Banner */}
            {showYearEndBanner && eligible1099Subs.length > 0 && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-800/60 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <FileText size={18} />
                                </span>
                                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                                    Tax Year {taxYear} Form 1099-NEC Filing Center
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                                        {eligible1099Subs.length} Eligible ({eligible1099Subs.length === 1 ? 'Subcontractor' : 'Subcontractors'})
                                    </span>
                                </h3>
                            </div>
                            <p className="text-xs text-slate-300">
                                Total YTD Compensation: <strong className="text-emerald-400 font-mono">${total1099Volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> across {eligible1099Subs.length} partner(s) paid ≥ $600. IRS filing & furnishing deadline is <strong>January 31, {taxYear + 1}</strong>.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleTriggerYearEndReminder}
                                disabled={isTriggeringReminder}
                                className="bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 text-xs font-bold h-9 px-3"
                                title="Send immediate high-priority 1099 filing reminder to all administrators"
                            >
                                <BellRing size={14} className="mr-1.5 text-amber-400" />
                                {isTriggeringReminder ? 'Sending Alert...' : 'Send Reminder Alert'}
                            </Button>
                        </div>
                    </div>

                    {/* Quick Subcontractor 1099 Access Chips */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Ready for 1099:</span>
                        {eligible1099Subs.map(item => (
                            <button
                                key={item.subcontractor.id}
                                onClick={() => {
                                    setViewTaxSub(item.subcontractor);
                                    setTaxAmountOverride('');
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors shadow-sm"
                            >
                                <span>{item.subcontractor.companyName || item.subcontractor.contactName}</span>
                                <span className="font-mono text-[11px] text-emerald-400 font-bold">${item.totalPaid.toFixed(2)}</span>
                                {item.hasW9 ? (
                                    <span className="text-[10px] text-emerald-400" title="Verified W-9 on File">✓ W-9</span>
                                ) : (
                                    <span className="text-[10px] text-amber-400 font-bold" title="Missing W-9">⚠ No W-9</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Incoming Requests */}
            {partnerRequests.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                     <h3 className="font-bold text-amber-800 dark:text-amber-500 mb-3 flex items-center gap-2"><RefreshCw size={18} className={isProcessing ? "animate-spin" : ""} /> Incoming Handshake Requests</h3>
                     <div className="space-y-3">
                        {partnerRequests.map((req, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">{req.fromOrgName}</p>
                                    <p className="text-xs text-slate-500">ID: {req.fromOrgId}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleApproveRequest(req)} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                        <CheckCircle2 size={14} className="mr-1"/> Approve
                                    </Button>
                                    <Button size="sm" variant="danger" onClick={() => handleRejectRequest(req)} disabled={isProcessing}>
                                        <XCircle size={14} className="mr-1"/> Reject
                                    </Button>
                                </div>
                            </div>
                        ))}
                     </div>
                </div>
            )}

            {/* Subcontractor List */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Partner Network</h3>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => navigate('/marketplace')} className="whitespace-nowrap"><Search size={16} className="mr-2"/> Browse Marketplace</Button>
                    <Button onClick={handleNewSub} className="bg-indigo-600 whitespace-nowrap"><PlusCircle size={16} className="mr-2"/> Add Subcontractor</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueSubs.map((sub) => {
                    const comp = checkSubcontractorCompliance(sub, state.currentOrganization?.subcontractorComplianceSettings);
                    return (
                        <Card key={sub.id} className="hover:shadow-lg transition-all group relative">
                            <div className="flex justify-between items-start mb-3 gap-2">
                                <div>
                                    <h4 
                                        onClick={() => setViewJobsSub(sub)}
                                        className="font-extrabold text-sm text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        title="Click to view jobs & payouts"
                                    >
                                        {sub.companyName || (sub as any).name || sub.contactName || 'Subcontractor'}
                                    </h4>
                                    {sub.contactName && (sub.companyName || (sub as any).name) && (sub.companyName || (sub as any).name) !== sub.contactName && (
                                        <p className="text-[11px] font-medium text-slate-500">Contact: {sub.contactName}</p>
                                    )}
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 uppercase font-bold tracking-tight">{sub.trade || 'HVAC'}</p>
                                </div>
                                {sub.linkedOrgId && sub.handshakeStatus && sub.handshakeStatus !== 'None' ? (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${sub.handshakeStatus === 'Linked' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        <Link2 size={10}/> {sub.handshakeStatus}
                                    </span>
                                ) : (sub as any).isInternal ? (
                                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-black uppercase shrink-0">Internal 1099</span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-black uppercase shrink-0">External 1099</span>
                                )}
                            </div>

                            {/* Compliance Status Pill */}
                            <div className="mb-2">
                                <button
                                    type="button"
                                    onClick={() => setComplianceSub(sub)}
                                    className={`w-full p-2 rounded-lg text-left text-[11px] font-bold border transition-all flex items-center justify-between ${
                                        comp.isCompliant 
                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                                            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <ShieldCheck size={14} className={comp.isCompliant ? "text-emerald-600" : "text-amber-600"} />
                                        {comp.isCompliant ? "Compliant & Verified" : `Missing ${comp.missingDocKeys.length} Compliance Docs`}
                                    </span>
                                    <span className="text-[10px] opacity-75 font-mono">
                                        {comp.fulfilledCount}/{comp.totalRequiredCount}
                                    </span>
                                </button>
                            </div>

                            {/* Chargebacks / Damage Deductions Pill */}
                            {(() => {
                                const subCBs = allChargebacks.filter(cb => cb.subcontractorId === sub.id);
                                const activeCBs = subCBs.filter(cb => cb.status === 'Applied' || cb.status === 'Pending');
                                const cbTotal = activeCBs.reduce((sum, cb) => sum + (Number(cb.amount) || 0), 0);

                                if (activeCBs.length === 0) return null;

                                return (
                                    <div className="mb-3">
                                        <button
                                            type="button"
                                            onClick={() => setStatementSub(sub)}
                                            className="w-full p-2 rounded-lg text-left text-[11px] font-bold border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100 transition-all flex items-center justify-between"
                                            title="Click to view Subcontractor Payment Statement with damage deductions"
                                        >
                                            <span className="flex items-center gap-1.5 truncate">
                                                <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                                                {activeCBs.length} Damage/Rework Chargeback{activeCBs.length > 1 ? 's' : ''}
                                            </span>
                                            <span className="text-[10px] font-black font-mono text-rose-700 dark:text-rose-300 bg-rose-200/70 dark:bg-rose-900/60 px-1.5 py-0.5 rounded shrink-0">
                                                -${cbTotal.toFixed(2)}
                                            </span>
                                        </button>
                                    </div>
                                );
                            })()}

                            <div className="space-y-2 mb-4">
                                <p className="text-xs flex items-center gap-2 text-slate-600 dark:text-slate-400"><Mail size={12}/> {sub.email}</p>
                                {sub.licenseNumber && (
                                    <p className="text-xs text-slate-500 font-medium">Lic #: <span className="font-mono text-slate-700 dark:text-slate-300">{sub.licenseNumber}</span></p>
                                )}
                            </div>
                            
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    {sub.handshakeStatus === 'Pending' ? (
                                        <button 
                                            onClick={() => handleCancelRequest(sub)}
                                            disabled={isProcessing}
                                            className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                        >
                                            <XCircle size={12}/> Cancel Request
                                        </button>
                                    ) : sub.handshakeStatus === 'Linked' ? (
                                         <button 
                                            onClick={() => handleUnlink(sub)}
                                            disabled={isProcessing}
                                            className="text-[10px] font-bold text-slate-400 hover:text-red-500 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                        >
                                            <XCircle size={12}/> Unlink
                                        </button>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {sub.email && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendInvite(sub.email, true)}
                                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2 py-1 rounded flex items-center gap-1 transition-colors border border-indigo-100 dark:border-indigo-800/40"
                                                    title="Send TekTrakker account invitation email"
                                                >
                                                    <Mail size={12}/> Send Invite
                                                </button>
                                            )}
                                            {!(sub as any).isSubscribedToTekTrakker && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetupNoLogin(sub)}
                                                    className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                                                    title="Set up as External Subcontractor for link & email dispatches without TekTrakker login account"
                                                >
                                                    <CheckCircle2 size={11} className="text-emerald-600" /> Set Up No-Login
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <button onClick={() => handleDeleteSub(sub)} className="px-1.5 py-1 text-slate-300 hover:text-red-600 transition-colors ml-auto" title="Delete Subcontractor">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>

                                {/* Primary Action Row 1: Statement, Jobs, Chargeback */}
                                <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <button 
                                        onClick={() => setStatementSub(sub)} 
                                        className="px-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] rounded-lg font-black uppercase flex items-center justify-center gap-1 transition-colors shadow-sm truncate"
                                        title="Generate & Email Payment Statement / Remittance"
                                    >
                                        <Receipt size={11} className="shrink-0"/> Statement
                                    </button>
                                    <button 
                                        onClick={() => setViewJobsSub(sub)} 
                                        className="px-1.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300 text-[10px] rounded-lg font-bold flex items-center justify-center gap-1 transition-colors truncate"
                                        title="View Jobs, Payouts & Settled Payments"
                                    >
                                        <Briefcase size={11} className="shrink-0"/> Jobs
                                    </button>
                                    <button 
                                        onClick={() => setChargebackSub(sub)} 
                                        className="px-1.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-[10px] rounded-lg font-bold flex items-center justify-center gap-1 transition-colors truncate"
                                        title="Log Property Damage or Rework Chargeback"
                                    >
                                        <AlertTriangle size={11} className="shrink-0 text-rose-600"/> Chargeback
                                    </button>
                                </div>

                                {/* Secondary Action Row 2: Packets, 1099, Manage */}
                                <div className="grid grid-cols-3 gap-1.5">
                                    <button 
                                        onClick={() => setComplianceSub(sub)} 
                                        className="px-1.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-[10px] rounded font-medium flex items-center justify-center gap-1 transition-colors truncate"
                                        title="Manage Compliance & Packets"
                                    >
                                        <ShieldCheck size={10} className="shrink-0 text-slate-500"/> Packets
                                    </button>
                                    <button 
                                        onClick={() => setViewTaxSub(sub as any)} 
                                        className="px-1.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-[10px] rounded font-medium flex items-center justify-center gap-1 transition-colors truncate"
                                        title="Generate Tax Form 1099-NEC"
                                    >
                                        <FileText size={10} className="shrink-0 text-slate-500"/> 1099
                                    </button>
                                    <button 
                                        onClick={() => handleEditSub(sub)} 
                                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 text-[10px] rounded font-bold flex items-center justify-center gap-1 transition-colors truncate"
                                        title="Manage Subcontractor Details"
                                    >
                                        Manage
                                    </button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Subcontractor Payment Statement Modal */}
            {statementSub && (
                <SubcontractorStatementModal
                    isOpen={!!statementSub}
                    onClose={() => setStatementSub(null)}
                    subcontractor={statementSub}
                />
            )}

            {/* Subcontractor Chargeback Modal */}
            {chargebackSub && (
                <SubcontractorChargebackModal
                    isOpen={!!chargebackSub}
                    onClose={() => setChargebackSub(null)}
                    subcontractor={chargebackSub}
                />
            )}

            {/* Compliance Modal */}
            {complianceSub && (
                <SubcontractorComplianceModal
                    isOpen={!!complianceSub}
                    onClose={() => setComplianceSub(null)}
                    subcontractor={complianceSub}
                    onUpdateSubcontractor={(updated) => {
                        dispatch({ type: 'UPDATE_SUBCONTRACTOR', payload: updated });
                        setComplianceSub(updated);
                    }}
                />
            )}

            {viewTaxSub && (
                <Modal 
                    isOpen={true} 
                    onClose={() => { setViewTaxSub(null); setTaxAmountOverride(''); }} 
                    title={`Generate Tax Form 1099-NEC - ${viewTaxSub.companyName || viewTaxSub.contactName}`}
                    size="2xl"
                >
                    <div className="space-y-5 text-slate-900 dark:text-white">
                        {/* Control Bar: Tax Year & Calculation Summary */}
                        <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                    Tax Reporting Year
                                </label>
                                <Input 
                                    type="number" 
                                    value={taxYear} 
                                    onChange={e => setTaxYear(parseInt(e.target.value) || new Date().getFullYear())} 
                                    className="font-bold text-sm"
                                />
                            </div>

                            <div className="md:col-span-2 flex flex-col justify-between">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Calculated YTD Nonemployee Comp
                                    </span>
                                    {finalTaxAmount >= 600 ? (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase">
                                            IRS 1099-NEC Mandatory (≥ $600)
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 uppercase">
                                            Below $600 Threshold
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-3 mt-1">
                                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                                        ${finalTaxAmount.toFixed(2)}
                                    </span>
                                    {taxAmountOverride !== '' ? (
                                        <button 
                                            onClick={() => setTaxAmountOverride('')}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                                        >
                                            <RefreshCw size={11} /> Reset to Auto (${autoCalculatedTaxAmount.toFixed(2)})
                                        </button>
                                    ) : (
                                        <span className="text-xs text-slate-400">
                                            (Auto-calculated from {subPayouts.length} settled remittance{subPayouts.length === 1 ? '' : 's'})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Optional Manual Override Input */}
                        <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                                        Tax Amount Custom Adjustment (Optional):
                                    </span>
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                        Leave blank to use the automated system total (${autoCalculatedTaxAmount.toFixed(2)}), or enter an override if adjusting for external payouts.
                                    </p>
                                </div>
                                <div className="w-full sm:w-44 shrink-0">
                                    <Input 
                                        type="number" 
                                        value={taxAmountOverride} 
                                        onChange={e => setTaxAmountOverride(e.target.value)} 
                                        placeholder={autoCalculatedTaxAmount.toFixed(2)}
                                        className="text-right font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Itemized Payout Breakdown Ledger */}
                        {subPayouts.length > 0 && (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShow1099Ledger(!show1099Ledger)}
                                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700/60 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Receipt size={14} className="text-slate-500" />
                                        <span>Itemized Settled Remittances for Tax Year {taxYear} ({subPayouts.length})</span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">${autoCalculatedTaxAmount.toFixed(2)}</span>
                                        {show1099Ledger ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </span>
                                </button>
                                {show1099Ledger && (
                                    <div className="max-h-48 overflow-y-auto">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-700">
                                                    <th className="py-2 px-3">Date</th>
                                                    <th className="py-2 px-3">Reference / Description</th>
                                                    <th className="py-2 px-3">Method</th>
                                                    <th className="py-2 px-3 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {subPayouts.map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono">{p.date}</td>
                                                        <td className="py-2 px-3">
                                                            <div className="font-bold text-slate-800 dark:text-slate-200">
                                                                {p.statementNumber ? `Statement #${p.statementNumber}` : p.vendor}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{p.description}</div>
                                                        </td>
                                                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px]">{p.paymentMethod}</td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">${p.amount.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* IRS Form 1099-NEC (Copy A) Preview */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50 dark:bg-slate-900">
                            <Form1099CopyA 
                                recipient={taxRecipient} 
                                amount={finalTaxAmount} 
                                year={taxYear} 
                                payerName={state.currentOrganization?.name || 'TekAir Inc.'} 
                                payerEin={(state.currentOrganization as any)?.ein || (state.currentOrganization as any)?.taxId || '74-3298412'}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                IRS Form 1099-NEC must be furnished to the recipient and filed by <strong>January 31, {taxYear + 1}</strong>.
                            </p>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <Button 
                                    variant="secondary"
                                    onClick={handleSend1099Email} 
                                    disabled={isSending1099Email || !viewTaxSub.email}
                                    className="flex items-center gap-1.5 text-xs font-bold"
                                    title={viewTaxSub.email ? `Email 1099 statement to ${viewTaxSub.email}` : 'No email address on file'}
                                >
                                    <Mail size={15} />
                                    {isSending1099Email ? 'Sending...' : 'Email to Subcontractor'}
                                </Button>
                                <Button 
                                    onClick={() => window.print()} 
                                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    <Printer size={15}/> Print Form 1099-NEC
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {viewJobsSub && (
                <SubcontractorJobsModal
                    isOpen={!!viewJobsSub}
                    onClose={() => setViewJobsSub(null)}
                    subcontractor={viewJobsSub}
                />
            )}

            <SubcontractorModal 
                isOpen={isModalOpen} 
                onClose={() => setModalOpen(false)} 
                onSave={handleSaveSub} 
                subcontractor={editingSub} 
                onInvite={handleSendInvite}
            />
        </div>
    );
};

export default SubcontractorsTab;
