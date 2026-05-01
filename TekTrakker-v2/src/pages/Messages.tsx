
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import { db } from 'lib/firebase';
import type { Message, User as AppUser } from 'types';
import { User, Users, Mail, MessageSquare, Phone, Search, Send, Clock, AlertCircle, Trash2, ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, Edit, X, Paperclip } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import { sendNotification } from 'lib/notificationService';

const Messages: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useAppContext();
    const { currentUser: user } = state;

    const parseTimestamp = (ts: any): number => {
        if (!ts) return 0;
        if (typeof ts === 'string') {
            const d = new Date(ts);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        }
        if (ts?.toDate) return ts.toDate().getTime();
        if (typeof ts === 'number') return ts;
        const d = new Date(ts);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    const [activeTab, setActiveTab] = useState<'team' | 'customers'>('team');
    
    // Selection State
    const [selectedPartnerId, setSelectedPartnerId] = useState<'all' | string>(() => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        return params.get('partner') || 'all';
    });
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(() => {
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        return !!params.get('partner');
    });
    
    const [newMessage, setNewMessage] = useState('');
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [includeCustomers, setIncludeCustomers] = useState(false);
    const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'all_admins' | 'all_sales'>('all');
    const scrollRef = useRef<HTMLDivElement>(null);

    // --- DATA TRANSFORMATION ---
    const isMe = (id?: string) => {
        if (!id) return false;
        if (id === user?.id) return true;
        if (user?.role === 'master_admin' && id === 'rodzelem@gmail.com') return true;
        if (user?.email === 'rodzelem@gmail.com' && id === 'rodzelem@gmail.com') return true;
        return false;
    };

    const teamPartners = useMemo(() => {
        const currentOrgId = state.currentOrganization?.id;
        const isSales = user?.role === 'platform_sales';

        if (!currentOrgId && !isSales) return [];

        let otherUsers: AppUser[];

        if (user?.role === 'master_admin') {
            otherUsers = state.users.filter(u =>
                ['admin', 'both', 'supervisor', 'platform_sales'].includes(u.role) &&
                u.id !== user?.id &&
                u.status !== 'archived'
            );
        } else if (isSales) {
            otherUsers = state.users.filter(u =>
                (u.role === 'platform_sales' || u.role === 'master_admin') &&
                u.id !== user?.id &&
                u.status !== 'archived'
            ).map(u => u.role === 'master_admin' ? { ...u, id: 'rodzelem@gmail.com', firstName: 'TekTrakker', lastName: 'Administrator' } : u);
            
            // Add Converted Clients (Organizations) as standard contacts for the Sales Rep!
            const convertedOrgs = state.allOrganizations.filter(org => org.salesRepId === user?.id);
            convertedOrgs.forEach(org => {
                const targetId = org.ownerId || org.id;
                // Avoid duplicating if owner happens to have same ID somehow
                if (!otherUsers.some(existing => existing.id === targetId)) {
                    otherUsers.push({
                        id: targetId,
                        uid: targetId,
                        firstName: org.name || 'Converted',
                        lastName: '(Client)',
                        role: 'admin',
                        organizationId: org.id,
                        username: 'client_org',
                        payRate: 0,
                        ptoAccrued: 0
                    } as any);
                }
            });
        } else {
            otherUsers = state.users.filter(u =>
                u.organizationId === currentOrgId &&
                u.id !== user?.id &&
                u.status !== 'archived' &&
                u.role !== 'customer'
            );
            
            // Inject Master Admin Contact for all organizations
            if (user?.email && user.email.toLowerCase() !== 'rodzelem@gmail.com') {
                otherUsers.push({
                    id: 'rodzelem@gmail.com',
                    uid: 'rodzelem@gmail.com',
                    firstName: 'TekTrakker',
                    lastName: 'Administrator',
                    role: 'master_admin',
                    organizationId: 'platform',
                    username: 'tektrakker_admin',
                    payRate: 0,
                    ptoAccrued: 0
                } as any);
            }

            // Inject Dedicated Platform Sales Representative Contact
            if (state.currentOrganization?.salesRepId && user?.id !== state.currentOrganization.salesRepId) {
                otherUsers.push({
                    id: state.currentOrganization.salesRepId,
                    uid: state.currentOrganization.salesRepId,
                    firstName: 'Your Platform',
                    lastName: 'Representative',
                    role: 'platform_sales',
                    organizationId: 'platform',
                    username: 'platform_sales_rep',
                    payRate: 0,
                    ptoAccrued: 0
                } as any);
            }
        }

        // FOR MASTER ADMINS & SALES REPS: Dynamically inject ANY user that has an active conversation thread with them
        if (user?.role === 'master_admin' || user?.role === 'platform_sales') {
            const activeChatUserIds = new Set<string>();
            state.messages.forEach(m => {
                if (m.senderId === 'rodzelem@gmail.com' && user.role === 'master_admin') activeChatUserIds.add(m.receiverId);
                if (m.receiverId === 'rodzelem@gmail.com' && user.role === 'master_admin') activeChatUserIds.add(m.senderId);
                if (m.senderId === user.id) activeChatUserIds.add(m.receiverId);
                if (m.receiverId === user.id) activeChatUserIds.add(m.senderId);
            });
            activeChatUserIds.forEach(id => {
                if (!otherUsers.some(u => u.id === id) && id !== 'all' && id !== 'rodzelem@gmail.com' && id !== user.id) {
                    const foundUser = state.users.find(x => x.id === id);
                    if (foundUser) {
                        otherUsers.push(foundUser);
                    } else {
                        // Fallback generic contact if user somehow doesn't exist in cache yet
                        otherUsers.push({ id, uid: id, firstName: 'External', lastName: 'User', role: 'admin', organizationId: 'unknown', username: id, payRate: 0, ptoAccrued: 0 } as any);
                    }
                }
            });
        }

        return otherUsers.map(u => {
            const unreadCount = state.messages.filter(msg => 
                msg.senderId === u.id && 
                isMe(msg.receiverId) && 
                !msg.read
            ).length;

            const threadMsgs = state.messages.filter(m => 
                (isMe(m.senderId) && m.receiverId === u.id) ||
                (m.senderId === u.id && isMe(m.receiverId))
            ).sort((a,b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));

            return { ...u, unreadCount, lastMsg: threadMsgs[0] };
        }).sort((a, b) => {
            const timeA = a.lastMsg ? new Date(a.lastMsg.timestamp).getTime() : 0;
            const timeB = b.lastMsg ? new Date(b.lastMsg.timestamp).getTime() : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });
    }, [state.users, state.messages, user?.id, user?.role, state.currentOrganization?.id]);

    const broadcastUnreadCount = useMemo(() => {
        const lastSeenId = localStorage.getItem(`tt_last_broadcast_${user?.id}`);
        const broadcasts = state.messages.filter(m => m.receiverId === 'all' || m.receiverId === 'all_customers');
        if (!lastSeenId) return broadcasts.length;
        
        const lastIndex = broadcasts.findIndex(m => m.id === lastSeenId);
        return lastIndex === -1 ? broadcasts.length : lastIndex;
    }, [state.messages, user?.id]);

    const threadMessages = useMemo(() => {
        if (activeTab === 'team') {
            if (selectedPartnerId === 'all') {
                const allBroadcasts = state.messages.filter(m => {
                    if (user?.role === 'master_admin') {
                        return ['all', 'all_customers', 'all_admins', 'all_sales'].includes(m.receiverId);
                    }
                    if (m.receiverId === 'all') return true;
                    if (m.receiverId === 'all_admins' && ['master_admin', 'admin', 'both'].includes(user?.role || '')) return true;
                    if (m.receiverId === 'all_sales' && user?.role === 'platform_sales') return true;
                    return false;
                }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    
                // Deduplicate broadcasts that were fanned out to tenant silos
                const uniqueBroadcasts: Message[] = [];
                const seenKeys = new Set<string>();
                allBroadcasts.forEach(m => {
                    const key = `${m.timestamp}-${m.content}`;
                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        uniqueBroadcasts.push(m);
                    }
                });
                return uniqueBroadcasts;
            } else {
                return state.messages.filter(m => 
                    (isMe(m.senderId) && m.receiverId === selectedPartnerId) ||
                    (m.senderId === selectedPartnerId && isMe(m.receiverId)) ||
                    // Allow organization admins to see messages generically sent to their Org ID
                    (m.senderId === selectedPartnerId && m.receiverId === state.currentOrganization?.id)
                ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            }
        } else {
            if (!selectedCustomerId) return [];
            return state.messages.filter(m => 
                (m.receiverId === selectedCustomerId || m.senderId === selectedCustomerId) &&
                (m.type === 'sms' || m.type === 'email' || m.type === 'customer-log')
            ).sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
        }
    }, [state.messages, activeTab, selectedPartnerId, selectedCustomerId, user?.id]);

    // --- EFFECT: AUTO SCROLL ---

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        if (activeTab === 'team' && selectedPartnerId !== 'all') {
            const unreadFromPartner = threadMessages.filter(m => m.senderId === selectedPartnerId && !m.read);
            unreadFromPartner.forEach(m => {
                db.collection('messages').doc(m.id).update({ read: true }).catch(() => {});
            });
        }

        if (activeTab === 'team' && selectedPartnerId === 'all' && threadMessages.length > 0) {
            const lastId = threadMessages[threadMessages.length - 1].id;
            localStorage.setItem(`tt_last_broadcast_${user?.id}`, lastId);
        }
    }, [threadMessages, activeTab, selectedPartnerId, user?.id]);

    // --- ACTIONS ---

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !state.currentOrganization) return;

        if (activeTab === 'customers' && !selectedCustomerId) {
            alert("Please select a customer.");
            return;
        }

        // --- CONSENT CHECK ---
        if (activeTab === 'customers' && selectedCustomerId) {
            const customer = state.customers.find(c => c.id === selectedCustomerId);
            if (activeTab === 'customers') {
                 if (!customer?.marketingConsent?.sms) {
                     alert("⚠️ Cannot Send: This customer has not opted-in to SMS communications.");
                     return;
                 }
            }
        }

        let activeOrgId = state.currentOrganization.id;

        // If a Platform Admin sends a message to a Tenant, we must assign the target Org's ID to the message payload
        // so the tenant's bounded listener actually detects and downloads the reply.
        if (state.currentOrganization.id === 'platform') {
            if (activeTab === 'team' && selectedPartnerId !== 'all') {
                const targetUser = state.users.find(u => u.id === selectedPartnerId);
                if (targetUser && targetUser.organizationId) {
                    activeOrgId = targetUser.organizationId;
                }
            } else if (activeTab === 'customers' && selectedCustomerId) {
                const targetCustomer = state.customers.find(c => c.id === selectedCustomerId);
                if (targetCustomer && targetCustomer.organizationId) {
                    activeOrgId = targetCustomer.organizationId;
                }
            }
        }

        const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        
        // Mark as queued for SMS. The backend Cloud Function should handle delivery.
        let deliveryStatus: Message['deliveryStatus'] = activeTab === 'team' ? 'sent' : 'queued';

        setIsSending(true);

        const activeReceiverId = (activeTab === 'team' && selectedPartnerId === 'all' && user?.role === 'master_admin') 
            ? broadcastTarget 
            : (activeTab === 'team' ? selectedPartnerId : (selectedCustomerId || ''));

        const msg: Message = {
            id: msgId,
            organizationId: activeOrgId,
            senderId: user.email === 'rodzelem@gmail.com' ? 'rodzelem@gmail.com' : user.id,
            senderName: user.email === 'rodzelem@gmail.com' ? 'TekTrakker Administrator' : `${user.firstName} ${user.lastName}`,
            receiverId: activeReceiverId,
            content: newMessage.trim(),
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            read: false,
            type: activeTab === 'team' ? 'text' : 'sms',
            deliveryStatus: deliveryStatus
        };

        try {
            // If Master Admin broadcasts, fan out message across all tenant silos so their bounded listeners pick it up natively
            if (activeTab === 'team' && selectedPartnerId === 'all' && state.currentOrganization.id === 'platform' && user?.role === 'master_admin') {
                const batch = db.batch();
                const allOrgIds = Array.from(new Set(['platform', ...(state.allOrganizations || []).map(o => o.id)]));
                allOrgIds.forEach(orgId => {
                    const uniqueId = `${msgId}-${orgId}`;
                    const ref = db.collection('messages').doc(uniqueId);
                    batch.set(ref, { ...msg, id: uniqueId, organizationId: orgId });
                });
                await batch.commit();
            } else {
                await db.collection('messages').doc(msgId).set(msg);
            }
            
            // Trigger Push Notification for Team Messages
            if (activeTab === 'team') {
                if (selectedPartnerId !== 'all') {
                    await sendNotification(selectedPartnerId, {
                        title: `New Message from ${user.email === 'rodzelem@gmail.com' ? 'TekTrakker Admin' : user.firstName}`,
                        body: newMessage.trim(),
                        type: 'message',
                        data: { senderId: user.id }
                    });
                } else {
                    // Trigger global broadcast cascade
                    // Tenant admins are isolated strictly to their company `teamPartners`. Master Admins can broadcast platform-wide.
                    let usersToNotify: any[] = teamPartners;
                    if (state.currentOrganization.id === 'platform' && user?.role === 'master_admin') {
                        const senderEmail = (user?.email || '').toLowerCase();
                        // Deduplicate self to prevent multiple push notifications sending to the master admin's alt-tenant accounts
                        usersToNotify = state.users.filter(u => u.id !== user.id && (u.email || '').toLowerCase() !== senderEmail);
                        if (broadcastTarget === 'all_admins') {
                            usersToNotify = usersToNotify.filter(u => ['master_admin', 'admin', 'both'].includes(u.role));
                        } else if (broadcastTarget === 'all_sales') {
                            usersToNotify = usersToNotify.filter(u => u.role === 'platform_sales');
                        }
                    }
                           
                    const promises = usersToNotify.map(p => sendNotification(p.id, {
                        title: `Broadcast from ${user.email === 'rodzelem@gmail.com' ? 'TekTrakker Admin' : user.firstName}`,
                        body: newMessage.trim(),
                        type: 'broadcast',
                        data: { senderId: user.id }
                    }));
                    await Promise.all(promises);
                    
                    // Dispatch secondary explicit customer push explicitly if explicitly requested
                    if (state.currentOrganization.id === 'platform' && user?.role === 'master_admin' && includeCustomers) {
                         const custMsg = { ...msg, id: `${msgId}-cust`, receiverId: 'all_customers', type: 'sms' as any };
                         await db.collection('messages').doc(custMsg.id).set(custMsg);
                    }
                }
            }

            // Optimistic Update
            const updatedMessages = [...state.messages, msg];
            dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
            
            setNewMessage('');
        } catch (error: any) {
            console.error(error);
            alert("Send failed. Please check your connection.");
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteMessage = async (msg: Message) => {
        if (!await globalConfirm("Permanently delete this message?")) return;
        try {
            if (['all', 'all_admins', 'all_sales', 'all_customers'].includes(msg.receiverId) && msg.senderId === user?.id && state.currentOrganization.id === 'platform') {
                const snapshot = await db.collection('messages')
                                        .where('senderId', '==', msg.senderId)
                                        .where('timestamp', '==', msg.timestamp)
                                        .get();
                const batch = db.batch();
                snapshot.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                
                const deletedIds = snapshot.docs.map(d => d.id);
                const updatedMessages = state.messages.filter(m => !deletedIds.includes(m.id));
                dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
            } else {
                await db.collection('messages').doc(msg.id).delete();
                const updatedMessages = state.messages.filter(m => m.id !== msg.id);
                dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
            }
        } catch (e) {
            console.error(e);
            alert("Delete failed.");
        }
    };

    const handleSaveEdit = async (msg: Message) => {
        if (!editContent.trim() || editContent.trim() === msg.content) {
            setEditingMessageId(null);
            return;
        }
        try {
            await db.collection('messages').doc(msg.id).update({
                content: editContent.trim(),
                isEdited: true
            });
            const updatedMessages = state.messages.map(m => m.id === msg.id ? { ...m, content: editContent.trim(), isEdited: true } : m);
            dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
            setEditingMessageId(null);
        } catch (e) {
            alert("Edit failed.");
        }
    };

    const handlePartnerSelect = (id: string | 'all') => {
        setSelectedPartnerId(id);
        setIsMobileThreadOpen(true);
    };

    const handleCustomerSelect = (id: string) => {
        setSelectedCustomerId(id);
        setIsMobileThreadOpen(true);
    };

    const activeCustomer = state.customers.find(c => c.id === selectedCustomerId);

    const role = state.currentUser?.role || '';
    const isStaffAdmin = ['admin', 'master_admin', 'both', 'supervisor'].includes(role);

    const renderContentWithLinks = (text: string) => {
        if (!text) return text;
        const parts = text.split(/(https?:\/\/[^\s]+|#[A-Z]+-[A-Za-z0-9-]+)/g);
        return parts.map((part, i) => {
            if (part.match(/^https?:\/\/[^\s]+/)) {
                return <a key={i} href={part} target="_blank" rel="noreferrer" className="underline hover:opacity-80 break-all text-blue-500">{part}</a>;
            }
            if (part.match(/^#JOB-(.+)/)) {
                const id = part.replace('#JOB-', '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/operations?tab=jobs&jobId=${id}`); 
                    else navigate(`/briefing/scheduling?jobId=${id}`);
                }} className="underline font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#HIST-(.+)/)) {
                const id = part.replace('#HIST-', '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/records?tab=history&histId=${id}`); 
                    else alert("Restricted: Historical job records require administrator privileges.");
                }} className="underline font-bold bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#DOC-(.+)/)) {
                const id = part.replace('#DOC-', '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/records?tab=documents&docId=${id}`);
                    else alert('Restricted: Documents require administrator privileges.');
                }} className="underline font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#INV-(.+)/)) {
                const id = part.replace('#INV-', '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/financials?tab=invoices&invoiceId=${id}`);
                    else alert('Restricted: Invoices require administrator privileges.');
                }} className="underline font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#PROP-(.+)/)) {
                const id = part.replace('#PROP-', '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/sales?propId=${id}`); 
                    else navigate(`/briefing/proposal?proposalId=${id}`);
                }} className="underline font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#CUST-(.+)/)) {
                const id = part.replace('#CUST-', '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/customers?custId=${id}`);
                    else alert('Restricted: Full customer profiles require administrator privileges. Please view customer info assigned to your jobs.');
                }} className="underline font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#EXP-(.+)/)) {
                const id = part.replace('#EXP-', '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/financials?tab=expenses&expId=${id}`);
                    else alert('Restricted: Financial records require administrator privileges.');
                }} className="underline font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            return part;
        });
    };

    return (
        <div className="flex h-[calc(100vh-140px)] flex-col md:flex-row gap-4 p-2 md:p-4 animate-fade-in relative overflow-hidden">
            
            {/* LEFT BAR: THREADS */}
            <Card className={`w-full md:w-80 lg:w-96 flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl transition-transform duration-300 ${isMobileThreadOpen ? '-translate-x-full md:translate-x-0 absolute md:relative pointer-events-none md:pointer-events-auto' : 'translate-x-0 relative'}`}>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <button onClick={() => setActiveTab('team')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'team' ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-white shadow-sm' : 'text-slate-500'}`}>
                        <Users size={14}/> Team
                    </button>
                    <button onClick={() => setActiveTab('customers')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'customers' ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-white shadow-sm' : 'text-gray-500'}`}>
                        <User size={14}/> Customers
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {activeTab === 'team' ? (
                        <>
                            <button onClick={() => handlePartnerSelect('all')} className={`w-full text-left px-4 py-4 rounded-2xl flex items-center gap-4 transition-all ${selectedPartnerId === 'all' ? 'bg-primary-600 text-white shadow-lg' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${selectedPartnerId === 'all' ? 'bg-white/20' : 'bg-blue-500 text-white'}`}>#</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-black text-sm uppercase tracking-wider">Broadcast</span>
                                        {broadcastUnreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{broadcastUnreadCount}</span>}
                                    </div>
                                    <p className={`text-xs truncate ${selectedPartnerId === 'all' ? 'text-white/70' : 'text-slate-500'}`}>General updates</p>
                                </div>
                            </button>
                            
                            <div className="pt-4 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Chat</div>
                            
                            {teamPartners.map(p => (
                                <button key={p.id} onClick={() => handlePartnerSelect(p.id)} className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-4 transition-all ${selectedPartnerId === p.id ? 'bg-primary-600 text-white shadow-lg' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${selectedPartnerId === p.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200'}`}>
                                        {(p.firstName || 'U')[0]}{(p.lastName || '')[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm truncate">{p.firstName}</span>
                                            {p.unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{p.unreadCount}</span>}
                                        </div>
                                        <p className={`text-xs truncate ${selectedPartnerId === p.id ? 'text-white/70' : 'text-slate-500'}`}>
                                            {p.lastMsg ? p.lastMsg.content : '...'}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </>
                    ) : (
                        <>
                            <div className="px-2 mb-4 relative">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border-none bg-slate-100 dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 transition-all dark:text-white" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            </div>
                            {state.customers.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map(c => (
                                <button key={c.id} onClick={() => handleCustomerSelect(c.id)} className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-4 transition-all ${selectedCustomerId === c.id ? 'bg-primary-600 text-white shadow-lg' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${selectedCustomerId === c.id ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>{(c.name || 'C')[0]}</div>
                                    <div className="flex-1 min-w-0">
                                        <span className="block font-bold text-sm truncate">{c.name}</span>
                                        <span className={`block text-[10px] truncate ${selectedCustomerId === c.id ? 'text-white/70' : 'text-slate-500'}`}>{c.phone}</span>
                                    </div>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </Card>

            {/* MAIN AREA: CHAT WINDOW */}
            <Card className={`flex-1 flex flex-col p-0 overflow-hidden relative border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl transition-transform duration-300 ${!isMobileThreadOpen ? 'translate-x-full md:translate-x-0 absolute md:relative pointer-events-none md:pointer-events-auto' : 'translate-x-0 relative'}`}>
                {/* Header */}
                <div className="p-3 md:p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center h-16 md:h-20 shadow-sm z-10">
                    <div className="flex items-center gap-3 md:gap-4">
                        <button onClick={() => setIsMobileThreadOpen(false)} aria-label="Back to threads" title="Back to threads" className="md:hidden p-2 -ml-2 text-slate-500">
                            <ArrowLeft size={20}/>
                        </button>
                        {activeTab === 'team' ? (
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${selectedPartnerId === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                {selectedPartnerId === 'all' ? '#' : (teamPartners.find(p => p.id === selectedPartnerId)?.firstName?.[0] || 'U')}
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
                                {activeCustomer?.name?.[0] || 'C'}
                            </div>
                        )}
                        <div>
                            <h3 className="font-black text-slate-900 dark:text-white leading-tight text-sm md:text-base truncate max-w-[150px] md:max-w-none">
                                {activeTab === 'team' ? (selectedPartnerId === 'all' ? 'Broadcast' : teamPartners.find(p => p.id === selectedPartnerId)?.firstName) : activeCustomer?.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {activeTab === 'team' ? 'Internal' : 'Customer SMS'}
                                </p>
                                {activeTab === 'customers' && activeCustomer && (
                                    activeCustomer.marketingConsent?.sms ? (
                                        <span className="text-[9px] text-green-600 font-bold bg-green-50 px-1.5 rounded flex items-center gap-0.5"><CheckCircle2 size={10}/> Opted-In</span>
                                    ) : (
                                        <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1.5 rounded flex items-center gap-0.5"><ShieldAlert size={10}/> No Consent</span>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feed */}
                <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 custom-scrollbar" ref={scrollRef}>
                    {threadMessages.map(msg => {
                        const isOwnMessage = isMe(msg.senderId);
                        const isEditable = isOwnMessage && ((new Date().getTime() - new Date(msg.timestamp).getTime()) < 15 * 60 * 1000);
                        const isEditingThis = editingMessageId === msg.id;

                        return (
                            <div key={msg.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group animate-fade-in`}>
                                <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[80%] relative`}>
                                    {!isOwnMessage && selectedPartnerId === 'all' && <span className="text-[10px] font-black text-slate-400 mb-1 ml-2 uppercase tracking-tighter">{msg.senderName}</span>}
                                    <div className="relative group/msg w-full flex flex-col items-end">
                                    {isEditingThis ? (
                                        <div className="flex gap-2 items-center bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                                            <input 
                                                title="Edit Message"
                                                aria-label="Edit Message Content"
                                                className="bg-slate-100 dark:bg-slate-900 border-none rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 w-48 md:w-64"
                                                value={editContent}
                                                onChange={e => setEditContent(e.target.value)}
                                                autoFocus
                                            />
                                            <button title="Save Edit" aria-label="Save Edit" onClick={() => handleSaveEdit(msg)} className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">
                                                <CheckCircle2 size={16}/>
                                            </button>
                                            <button title="Cancel Edit" aria-label="Cancel Edit" onClick={() => setEditingMessageId(null)} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 transition-colors">
                                                <X size={16}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={`px-4 md:px-5 py-2 md:py-3 rounded-2xl md:rounded-3xl shadow-sm text-sm leading-relaxed ${isOwnMessage ? 'bg-primary-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none border border-slate-100 dark:border-slate-700'}`}>
                                                {renderContentWithLinks(msg.content)} {msg.isEdited && <span className="text-[10px] opacity-70 italic ml-1">(edited)</span>}
                                            </div>
                                            <div className={`absolute ${isOwnMessage ? '-left-16' : '-right-8'} top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity`}>
                                                {isEditable && activeTab === 'team' && (
                                                    <button 
                                                        onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }}
                                                        className="p-1.5 text-slate-300 hover:text-blue-500 bg-white dark:bg-slate-800 rounded-full shadow-sm"
                                                        title="Edit Message (within 15m)"
                                                    >
                                                        <Edit size={12}/>
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleDeleteMessage(msg)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 bg-white dark:bg-slate-800 rounded-full shadow-sm"
                                                    title="Delete Message"
                                                >
                                                    <Trash2 size={12}/>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {isOwnMessage && msg.type === 'sms' && (
                                            <div title={msg.deliveryStatus === 'failed' ? msg.deliveryError : `SMS ${msg.deliveryStatus || 'queued'}`}>
                                                {msg.deliveryStatus === 'sent' ? (
                                                    <CheckCircle2 size={10} className="text-emerald-500" />
                                                ) : msg.deliveryStatus === 'failed' ? (
                                                    <AlertCircle size={10} className="text-rose-500" />
                                                ) : (
                                                    <Clock size={10} className="text-slate-400 animate-pulse" />
                                                )}
                                            </div>
                                        )}
                                        <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
                                            {(() => {
                                                try {
                                                    if (!msg.timestamp) return 'Unknown';
                                                    let d;
                                                    if (typeof msg.timestamp === 'string') {
                                                        d = new Date(msg.timestamp);
                                                    } else if ((msg.timestamp as any)?.toDate) {
                                                        d = (msg.timestamp as any).toDate();
                                                    } else {
                                                        d = new Date(msg.timestamp);
                                                    }
                                                    if (isNaN(d.getTime())) return 'Unknown';
                                                    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                                } catch {
                                                    return 'Unknown';
                                                }
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Input */}
                <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                    {selectedPartnerId === 'all' && !['master_admin', 'admin', 'both'].includes(user?.role || '') ? (
                        <div className="py-3 text-center text-sm font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-800/80">
                            Only Administrators can post to the Broadcast channel.
                        </div>
                    ) : (
                        <form onSubmit={handleSend} className="flex flex-col gap-2">
                            {activeTab === 'team' && (
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setNewMessage(prev => prev + (prev.endsWith(" ") || prev === "" ? "" : " ") + "#JOB-")} className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors"><Paperclip size={10}/> Ref Job</button>
                                    <button type="button" onClick={() => setNewMessage(prev => prev + (prev.endsWith(" ") || prev === "" ? "" : " ") + "#DOC-")} className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors"><Paperclip size={10}/> Ref Doc</button>
                                </div>
                            )}
                            <div className="flex gap-2 md:gap-3">
                                <input 
                                    className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                                    placeholder="Type a message..."
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                />
                                <button type="submit" disabled={!newMessage.trim() || isSending} className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 shadow-lg transition-all disabled:opacity-50">
                                    {isSending ? <RefreshCw className="animate-spin" size={20}/> : <Send size={20}/>}
                                </button>
                            </div>
                            {selectedPartnerId === 'all' && user?.role === 'master_admin' && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-2 px-3 py-2 mt-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                                    <div className="flex items-center">
                                        <label className="text-[10px] uppercase tracking-[0.1em] font-extrabold text-slate-400 dark:text-slate-500 mr-3">Audience:</label>
                                        <select
                                            aria-label="Broadcast Audience Target"
                                            value={broadcastTarget}
                                            onChange={e => setBroadcastTarget(e.target.value as any)}
                                            className="text-xs bg-white dark:bg-slate-800 border-none rounded shadow-sm px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 font-semibold text-slate-700 dark:text-slate-200 outline-none"
                                        >
                                            <option value="all">All Tenant Users</option>
                                            <option value="all_admins">Admins & Superusers</option>
                                            <option value="all_sales">Platform Sales Reps</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center">
                                        <input 
                                            type="checkbox" 
                                            id="include_customers"
                                            checked={includeCustomers} 
                                            onChange={e => setIncludeCustomers(e.target.checked)} 
                                            className="h-4 w-4 rounded bg-transparent border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                                        />
                                        <label htmlFor="include_customers" className="ml-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 select-none cursor-pointer">
                                            Include Customers (Global SMS)
                                        </label>
                                    </div>
                                </div>
                            )}
                        </form>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default Messages;
