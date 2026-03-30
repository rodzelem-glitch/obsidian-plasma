
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../../context/AppContext';
import { db, functions } from '../../../../lib/firebase';
import type { Subcontractor } from '../../../../types';
import Button from '../../../../components/ui/Button';
import SubcontractorModal from '../../../../components/modals/AddSubcontractorModal'; 
import Card from '../../../../components/ui/Card';
import { PlusCircle, Copy, Link2, Mail, CheckCircle2, XCircle, Trash2, RefreshCw } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import { sendEmail } from 'lib/notificationService';

const SubcontractorsTab: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState<Partial<Subcontractor> | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

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
            await db.collection('subcontractors').doc(subId).set(subData, { merge: true });
            // Don't dispatch here if we rely on subscription, OR ensure we don't duplicate.
            // Dispatching helps UI responsiveness before sync.
            dispatch({ type: sub.id ? 'UPDATE_SUBCONTRACTOR' : 'ADD_SUBCONTRACTOR', payload: subData });
            
            // 2. Send Handshake Request if new link
            if (isNewLink && sub.linkedOrgId) {
                const manageHandshake = functions.httpsCallable('manageHandshake');
                await manageHandshake({
                    action: 'request',
                    targetOrgId: sub.linkedOrgId,
                    requestingOrgId: orgId,
                    subcontractorId: subId
                });
                alert("Handshake request sent!");
            }

            setModalOpen(false);
        } catch (e: any) {
            console.error(e);
            alert("Failed to save: " + e.message);
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
            alert("Request cancelled.");
        } catch (e: any) {
            alert("Error: " + e.message);
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
            alert("Partner unlinked.");
        } catch (e: any) {
            alert("Error: " + e.message);
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
            alert("Failed to delete: " + e.message);
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
            alert("Approved! The organizations are now linked.");
        } catch (e: any) {
            alert("Error: " + e.message);
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
            alert("Request rejected.");
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendInvite = async (email: string, withDiscount: boolean) => {
        const { name: orgName, id: orgId } = state.currentOrganization || {};
        const normalizedEmail = email.toLowerCase().trim();
        if (!orgName || !orgId || !normalizedEmail) return;

        const inviteLink = `${window.location.origin}/#/register?view=register_business&email=${encodeURIComponent(normalizedEmail)}&oid=${orgId}${withDiscount ? '&promo=true' : ''}`;
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

            await db.collection('users').doc(normalizedEmail).set(inviteDoc, { merge: true });

            // 2. Send Invitation Email
            await sendEmail(state.currentOrganization, {
                to: [normalizedEmail],
                message: { subject, html: htmlBody },
                type: 'Invite',
                referralMeta: withDiscount ? { referringOrgId: orgId, referredEmail: normalizedEmail } : null
            });
            alert("Invitation sent successfully!");
        } catch (e) { alert("Failed to send invite."); }
    };

    const handleCopyId = () => {
        if (state.currentOrganization?.id) {
            navigator.clipboard.writeText(state.currentOrganization.id);
            alert('ID Copied!');
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
                        <button onClick={handleCopyId} className="p-1 hover:text-primary-600 transition-colors"><Copy size={14} /></button>
                    </div>
                </div>
            </div>

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
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Partner Network</h3>
                <Button onClick={handleNewSub} className="bg-indigo-600"><PlusCircle size={16} className="mr-2"/> Add Subcontractor</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueSubs.map((sub) => (
                    <Card key={sub.id} className="hover:shadow-lg transition-all group relative">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">{sub.companyName}</h4>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">{sub.trade}</p>
                            </div>
                            {sub.linkedOrgId ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${sub.handshakeStatus === 'Linked' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    <Link2 size={10}/> {sub.handshakeStatus}
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-black uppercase">Internal</span>
                            )}
                        </div>
                        <div className="space-y-2 mb-4">
                             <p className="text-xs flex items-center gap-2 text-slate-600 dark:text-slate-400"><Mail size={12}/> {sub.email}</p>
                        </div>
                        
                        <div className="pt-4 border-t flex justify-between items-center">
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
                                <div></div>
                            )}
                            <div className="flex gap-2">
                                 <button onClick={() => handleDeleteSub(sub)} className="p-1 text-slate-300 hover:text-red-600 transition-colors" title="Delete">
                                    <Trash2 size={14}/>
                                 </button>
                                 <Button variant="secondary" size="sm" onClick={() => handleEditSub(sub)}>Manage</Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

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
