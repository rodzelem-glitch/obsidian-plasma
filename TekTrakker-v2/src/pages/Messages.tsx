
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import { db } from 'lib/firebase';
import type { Message, User as AppUser } from 'types';
import { User, Users, Mail, MessageSquare, Phone, Search, Send, Clock, AlertCircle, Trash2, ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";

const Messages: React.FC = () => {
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
    const [selectedPartnerId, setSelectedPartnerId] = useState<'all' | string>('all');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(false);
    
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // --- DATA TRANSFORMATION ---

    const teamPartners = useMemo(() => {
        const currentOrgId = state.currentOrganization?.id;
        const isSales = user?.role === 'platform_sales';

        if (!currentOrgId && !isSales) return [];

        let otherUsers: AppUser[];

        if (isSales) {
            otherUsers = state.users.filter(u =>
                (u.role === 'platform_sales' || u.role === 'master_admin') &&
                u.id !== user?.id &&
                u.status !== 'archived'
            );
        } else {
            otherUsers = state.users.filter(u =>
                u.organizationId === currentOrgId &&
                u.id !== user?.id &&
                u.status !== 'archived' &&
                u.role !== 'customer'
            );
        }
        
        return otherUsers.map(u => {
            const unreadCount = state.messages.filter(msg => 
                msg.senderId === u.id && 
                msg.receiverId === user?.id && 
                !msg.read
            ).length;

            const threadMsgs = state.messages.filter(m => 
                (m.senderId === user?.id && m.receiverId === u.id) ||
                (m.senderId === u.id && m.receiverId === user?.id)
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
        const broadcasts = state.messages.filter(m => m.receiverId === 'all');
        if (!lastSeenId) return broadcasts.length;
        
        const lastIndex = broadcasts.findIndex(m => m.id === lastSeenId);
        return lastIndex === -1 ? broadcasts.length : lastIndex;
    }, [state.messages, user?.id]);

    const threadMessages = useMemo(() => {
        if (activeTab === 'team') {
            if (selectedPartnerId === 'all') {
                return state.messages.filter(m => m.receiverId === 'all')
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            } else {
                return state.messages.filter(m => 
                    (m.senderId === user?.id && m.receiverId === selectedPartnerId) ||
                    (m.senderId === selectedPartnerId && m.receiverId === user?.id)
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

        const activeOrgId = state.currentOrganization.id;
        const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        
        // Mark as queued for SMS. The backend Cloud Function should handle delivery.
        let deliveryStatus: Message['deliveryStatus'] = activeTab === 'team' ? 'sent' : 'queued';

        setIsSending(true);

        const msg: Message = {
            id: msgId,
            organizationId: activeOrgId,
            senderId: user.id,
            senderName: `${user.firstName} ${user.lastName}`,
            receiverId: activeTab === 'team' ? selectedPartnerId : (selectedCustomerId || ''),
            content: newMessage.trim(),
            timestamp: new Date().toISOString(),
            read: false,
            type: activeTab === 'team' ? 'text' : 'sms',
            deliveryStatus: deliveryStatus
        };

        try {
            await db.collection('messages').doc(msgId).set(msg);
            
            // Trigger Push Notification for Team Messages
            if (activeTab === 'team') {
                const { sendNotification } = await import('lib/notificationService');
                if (selectedPartnerId !== 'all') {
                    await sendNotification(selectedPartnerId, {
                        title: `New Message from ${user.firstName}`,
                        body: newMessage.trim(),
                        type: 'message',
                        data: { senderId: user.id }
                    });
                } else {
                    // Trigger global broadcast cascade
                    const promises = teamPartners.map(p => sendNotification(p.id, {
                        title: `Broadcast from ${user.firstName}`,
                        body: newMessage.trim(),
                        type: 'broadcast',
                        data: { senderId: user.id }
                    }));
                    await Promise.all(promises);
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

    const handleDeleteMessage = async (msgId: string) => {
        if (!await globalConfirm("Permanently delete this message?")) return;
        try {
            await db.collection('messages').doc(msgId).delete();
            // Optimistic Delete
            const updatedMessages = state.messages.filter(m => m.id !== msgId);
            dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
        } catch (e) {
            console.error(e);
            alert("Delete failed.");
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
                        <button onClick={() => setIsMobileThreadOpen(false)} className="md:hidden p-2 -ml-2 text-slate-500">
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
                        const isMe = msg.senderId === user?.id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-fade-in`}>
                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[80%]`}>
                                    {!isMe && selectedPartnerId === 'all' && <span className="text-[10px] font-black text-slate-400 mb-1 ml-2 uppercase tracking-tighter">{msg.senderName}</span>}
                                    <div className="relative group/msg">
                                        <div className={`px-4 md:px-5 py-2 md:py-3 rounded-2xl md:rounded-3xl shadow-sm text-sm leading-relaxed ${isMe ? 'bg-primary-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none border border-slate-100 dark:border-slate-700'}`}>
                                            {msg.content}
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteMessage(msg.id)}
                                            className={`absolute ${isMe ? '-left-8' : '-right-8'} top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover/msg:opacity-100 transition-opacity`}
                                            title="Delete Message"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {isMe && msg.type === 'sms' && (
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
                    <form onSubmit={handleSend} className="flex gap-2 md:gap-3">
                        <input 
                            className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                        />
                        <button type="submit" disabled={!newMessage.trim() || isSending} className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 shadow-lg transition-all disabled:opacity-50">
                            {isSending ? <RefreshCw className="animate-spin" size={20}/> : <Send size={20}/>}
                        </button>
                    </form>
                </div>
            </Card>
        </div>
    );
};

export default Messages;
