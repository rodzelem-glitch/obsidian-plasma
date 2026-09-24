import { cleanUndefinedFields } from '../lib/utils';
import showToast from "lib/toast";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';
import type { Message, User as AppUser, MessageAttachment } from 'types';
import { 
    User, Users, Search, Send, Clock, AlertCircle, Trash2, ArrowLeft, 
    RefreshCw, CheckCircle2, ShieldAlert, Edit, X, Paperclip, Image, 
    FileText, Smile, Sparkles, Inbox, Mail, PlusCircle, Receipt, Download,
    Settings, CornerUpLeft, CornerUpRight, UserPlus, PhoneCall, Wrench, Zap
} from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import { sendNotification } from 'lib/notificationService';
import { uploadFileToStorage } from 'lib/storageService';
import { PhoneCenterView } from './communications/PhoneCenterView';
import { useTelephony } from '../context/TelephonyContext';
import { markNotificationInDb, isNotificationRead } from 'lib/notificationNavigator';

const Messages: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { state, dispatch } = useAppContext();
    const { currentUser: user } = state;

    const parseTimestamp = (ts: unknown): number => {
        if (!ts) return 0;
        if (typeof ts === 'string') {
            const d = new Date(ts);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        }
        if ((ts as { toDate?: () => Date })?.toDate) return (ts as { toDate: () => Date }).toDate().getTime();
        if (typeof ts === 'number') return ts;
        const d = new Date(ts as string | number | Date);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const { unreadVoicemailCount } = useTelephony();

    // Tab State (Phone & Voicemail | Team Chat | Customer SMS | Inbound Emails)
    const [activeTab, setActiveTab] = useState<'phone' | 'team' | 'customers' | 'inbound_emails'>(() => {
        const rawSearch = window.location.search || window.location.hash.split('?')[1] || '';
        const params = new URLSearchParams(rawSearch);
        const tab = params.get('tab');
        const partner = params.get('partner') || params.get('partnerId');
        const custId = params.get('customerId') || params.get('customer');
        if (partner) return 'team';
        if (custId) return 'customers';
        if (tab === 'team') return 'team';
        if (tab === 'phone' || tab === 'dialer' || tab === 'voicemail') return 'phone';
        if (tab === 'emails' || tab === 'inbound_emails') return 'inbound_emails';
        if (tab === 'customers' || tab === 'sms') return 'customers';
        return 'phone';
    });

    // Selection State
    const [selectedPartnerId, setSelectedPartnerId] = useState<'all' | string>(() => {
        const rawSearch = window.location.search || window.location.hash.split('?')[1] || '';
        const params = new URLSearchParams(rawSearch);
        return params.get('partner') || params.get('partnerId') || 'all';
    });
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(() => {
        const rawSearch = window.location.search || window.location.hash.split('?')[1] || '';
        const params = new URLSearchParams(rawSearch);
        return params.get('customerId') || params.get('customer') || null;
    });
    const [inboundEmails, setInboundEmails] = useState<any[]>([]);
    const [selectedInboundEmailId, setSelectedInboundEmailId] = useState<string | null>(null);
    const selectedEmailIdRef = useRef<string | null>(null);
    selectedEmailIdRef.current = selectedInboundEmailId;

    const [emailReplies, setEmailReplies] = useState<any[]>([]);
    const [isThreadModalOpen, setIsThreadModalOpen] = useState(false);
    const [isReplyAllMode, setIsReplyAllMode] = useState(false);
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [includeSignature, setIncludeSignature] = useState(true);
    const [emailCc, setEmailCc] = useState('');
    const [emailBcc, setEmailBcc] = useState('');
    const [emailFilter, setEmailFilter] = useState<'all' | 'unread' | 'workorders'>('all');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers'>('emojis');
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
    const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
    const [uploadingAttachments, setUploadingAttachments] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [lastSeenBroadcastId, setLastSeenBroadcastId] = useState(() => localStorage.getItem(`tt_last_broadcast_${user?.id}`));

    // --- DATA TRANSFORMATION ---
    const isMe = (id?: string) => {
        if (!id) return false;
        if (id === user?.id) return true;
        if (user?.role === 'master_admin' && (id === 'rodzelem@gmail.com' || id === 'ryanvavrecan@gmail.com')) return true;
        if ((user?.email === 'rodzelem@gmail.com' || user?.email === 'ryanvavrecan@gmail.com') && (id === 'rodzelem@gmail.com' || id === 'ryanvavrecan@gmail.com')) return true;
        return false;
    };

    const isCustomerMessage = (m: Message) => {
        if (m.type === 'sms' || m.type === 'email' || m.type === 'customer-log' || m.type === 'alert') return true;

        const isSenderCustomer = state.customers.some(c => c.id === m.senderId);
        const isReceiverCustomer = state.customers.some(c => c.id === m.receiverId);
        if (isSenderCustomer || isReceiverCustomer) return true;

        const systemSenders = ['system', 'ai', 'ai_agent', 'tektrakker_admin', 'platform'];
        const senderIdLower = (m.senderId || '').toLowerCase();
        if (m.senderId && !systemSenders.includes(senderIdLower)) {
            const isTeam = m.senderId === 'rodzelem@gmail.com' ||
                           m.senderId === user?.id ||
                           state.users.some(u => u.id === m.senderId);
            if (!isTeam) return true;
        }
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

            const convertedOrgs = state.allOrganizations.filter(org => org.salesRepId === user?.id);
            convertedOrgs.forEach(org => {
                const targetId = org.ownerId || org.id;
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
                    } as AppUser);
                }
            });
        } else {
            otherUsers = state.users.filter(u =>
                u.organizationId === currentOrgId &&
                u.id !== user?.id &&
                u.status !== 'archived' &&
                u.role !== 'customer'
            );

            if (user?.email && user.email.toLowerCase() !== 'rodzelem@gmail.com' && user.email.toLowerCase() !== 'ryanvavrecan@gmail.com') {
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
                } as AppUser);
            }

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
                } as AppUser);
            }
        }

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
                        otherUsers.push({ id, uid: id, firstName: 'External', lastName: 'User', role: 'admin', organizationId: 'unknown', username: id, payRate: 0, ptoAccrued: 0 } as AppUser);
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

    const sortedCustomers = useMemo(() => {
        return state.customers.map(c => {
            const threadMsgs = state.messages.filter(m =>
                (m.receiverId === c.id || m.senderId === c.id) &&
                (m.type === 'sms' || m.type === 'email' || m.type === 'customer-log')
            ).sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));

            const unreadCount = state.messages.filter(msg =>
                msg.senderId === c.id &&
                !msg.read &&
                (msg.type === 'sms' || msg.type === 'email' || msg.type === 'customer-log')
            ).length;

            return { ...c, lastMsg: threadMsgs[0], unreadCount };
        }).sort((a, b) => {
            const timeA = a.lastMsg ? parseTimestamp(a.lastMsg.timestamp) : 0;
            const timeB = b.lastMsg ? parseTimestamp(b.lastMsg.timestamp) : 0;
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        });
    }, [state.customers, state.messages]);

    // --- FIRESTORE INBOUND EMAIL LISTENERS WITH REF TO PREVENT OVERWRITING SELECTED EMAIL ---
    useEffect(() => {
        const orgId = state.currentOrganization?.id;
        if (!orgId) return;
        const unsub = db.collection('organizations').doc(orgId).collection('inboundEmails')
            .orderBy('receivedAt', 'desc')
            .onSnapshot(snap => {
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setInboundEmails(list);
                if (!selectedEmailIdRef.current && list.length > 0) {
                    setSelectedInboundEmailId(list[0].id);
                    selectedEmailIdRef.current = list[0].id;
                }
            }, err => console.error("Inbound email sub error:", err));
        return () => unsub();
    }, [state.currentOrganization?.id]);

    useEffect(() => {
        const orgId = state.currentOrganization?.id;
        if (!orgId || !selectedInboundEmailId) return;
        const unsub = db.collection('organizations').doc(orgId).collection('inboundEmails').doc(selectedInboundEmailId).collection('replies')
            .orderBy('sentAt', 'asc')
            .onSnapshot(snap => {
                const replies = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setEmailReplies(replies);
            }, err => console.error("Email replies error:", err));
        return () => unsub();
    }, [state.currentOrganization?.id, selectedInboundEmailId]);

    const broadcastUnreadCount = useMemo(() => {
        const broadcasts = state.messages.filter(m => {
            if (isCustomerMessage(m)) return false;
            if (user?.role === 'master_admin') {
                return ['all', 'all_customers', 'all_admins', 'all_sales'].includes(m.receiverId);
            }
            if (m.receiverId === 'all') return true;
            if (m.receiverId === 'all_admins' && ['master_admin', 'admin', 'both'].includes(user?.role || '')) return true;
            if (m.receiverId === 'all_sales' && user?.role === 'platform_sales') return true;
            return false;
        }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const uniqueBroadcasts: Message[] = [];
        const seenKeys = new Set<string>();
        broadcasts.forEach(m => {
            const key = `${m.timestamp}-${m.content}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueBroadcasts.push(m);
            }
        });

        if (!lastSeenBroadcastId) return uniqueBroadcasts.length;
        const lastIndex = uniqueBroadcasts.findIndex(m => m.id === lastSeenBroadcastId);
        return lastIndex === -1 ? uniqueBroadcasts.length : Math.max(0, uniqueBroadcasts.length - 1 - lastIndex);
    }, [state.messages, state.customers, user?.id, user?.role, lastSeenBroadcastId]);

    const threadMessages = useMemo(() => {
        if (activeTab === 'team') {
            if (selectedPartnerId === 'all') {
                const allBroadcasts = state.messages.filter(m => {
                    if (isCustomerMessage(m)) return false;
                    if (user?.role === 'master_admin') {
                        return ['all', 'all_customers', 'all_admins', 'all_sales'].includes(m.receiverId);
                    }
                    if (m.receiverId === 'all') return true;
                    if (m.receiverId === 'all_admins' && ['master_admin', 'admin', 'both'].includes(user?.role || '')) return true;
                    if (m.receiverId === 'all_sales' && user?.role === 'platform_sales') return true;
                    return false;
                }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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
    }, [state.messages, state.customers, activeTab, selectedPartnerId, selectedCustomerId, user?.id]);

    // --- EFFECT: REACTIVE URL PARAM SYNCHRONIZATION (For Notification Deep Linking) ---
    useEffect(() => {
        const rawSearch = window.location.search || window.location.hash.split('?')[1] || '';
        const params = new URLSearchParams(rawSearch);
        const tabParam = params.get('tab');
        const partnerParam = params.get('partner') || params.get('partnerId');
        const custParam = params.get('customerId') || params.get('customer');

        if (partnerParam) {
            setActiveTab('team');
            setSelectedPartnerId(partnerParam);
            setIsMobileThreadOpen(true);
        } else if (custParam) {
            setActiveTab('customers');
            setSelectedCustomerId(custParam);
            setIsMobileThreadOpen(true);
        } else if (tabParam === 'team') {
            setActiveTab('team');
        } else if (tabParam === 'customers' || tabParam === 'sms') {
            setActiveTab('customers');
        } else if (tabParam === 'emails' || tabParam === 'inbound_emails') {
            setActiveTab('inbound_emails');
        } else if (tabParam === 'phone' || tabParam === 'dialer' || tabParam === 'voicemail') {
            setActiveTab('phone');
        }
    }, [location.pathname, location.search, location.hash]);

    // --- EFFECT: AUTO SCROLL & AUTO MARK AS READ ---
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        if (activeTab === 'team' && selectedPartnerId !== 'all') {
            const unreadFromPartner = threadMessages.filter(m => m.senderId === selectedPartnerId && !m.read);
            unreadFromPartner.forEach(m => {
                db.collection('messages').doc(m.id).update(cleanUndefinedFields({ read: true })).catch(() => {});
            });

            const matchingNotifications = (state.notifications || []).filter(n =>
                !isNotificationRead(n, user) &&
                (n.type === 'message' || n.type === 'broadcast') &&
                (n.data?.senderId === selectedPartnerId || n.senderId === selectedPartnerId)
            );
            matchingNotifications.forEach(n => {
                dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { id: n.id, userId: user?.id, userEmail: user?.email } });
                markNotificationInDb(n.id, user);
            });
        }

        if (activeTab === 'team' && selectedPartnerId === 'all') {
            if (threadMessages.length > 0) {
                const lastId = threadMessages[threadMessages.length - 1].id;
                if (lastSeenBroadcastId !== lastId) {
                    localStorage.setItem(`tt_last_broadcast_${user?.id}`, lastId);
                    setLastSeenBroadcastId(lastId);
                }
            }

            const matchingNotifications = (state.notifications || []).filter(n =>
                !isNotificationRead(n, user) &&
                n.type === 'broadcast'
            );
            matchingNotifications.forEach(n => {
                dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { id: n.id, userId: user?.id, userEmail: user?.email } });
                markNotificationInDb(n.id, user);
            });
        }

        if (activeTab === 'customers' && selectedCustomerId) {
            const unreadFromCustomer = threadMessages.filter(m => m.senderId === selectedCustomerId && !m.read);
            unreadFromCustomer.forEach(m => {
                db.collection('messages').doc(m.id).update(cleanUndefinedFields({ read: true })).catch(() => {});
            });

            const matchingNotifications = (state.notifications || []).filter(n =>
                !isNotificationRead(n, user) &&
                (n.type === 'sms_received' || n.type === 'call_received' || n.type === 'message') &&
                (n.data?.senderId === selectedCustomerId || n.senderId === selectedCustomerId)
            );
            matchingNotifications.forEach(n => {
                dispatch({ type: 'MARK_NOTIFICATION_READ', payload: { id: n.id, userId: user?.id, userEmail: user?.email } });
                markNotificationInDb(n.id, user);
            });
        }
    }, [threadMessages, activeTab, selectedPartnerId, selectedCustomerId, user?.id, lastSeenBroadcastId, state.notifications, dispatch]);

    // --- ACTIONS ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setPendingAttachments(prev => [...prev, ...filesArray]);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removePendingAttachment = (index: number) => {
        setPendingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleDeleteInboundEmail = async (mailId: string) => {
        if (!await globalConfirm("Permanently delete this inbound email thread?")) return;
        try {
            const orgId = state.currentOrganization?.id;
            if (!orgId) return;
            await db.collection('organizations').doc(orgId).collection('inboundEmails').doc(mailId).delete();
            setInboundEmails(prev => prev.filter(e => e.id !== mailId));
            if (selectedInboundEmailId === mailId) {
                setSelectedInboundEmailId(null);
                selectedEmailIdRef.current = null;
            }
            showToast.success("Email thread deleted.");
        } catch (err) {
            console.error(err);
            showToast.warn("Failed to delete email.");
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && pendingAttachments.length === 0) || !user || !state.currentOrganization) return;

        if (activeTab === 'customers' && !selectedCustomerId) {
            showToast.warn("Please select a customer.");
            return;
        }

        if (activeTab === 'customers' && selectedCustomerId) {
            const customer = state.customers.find(c => c.id === selectedCustomerId);
            if (activeTab === 'customers') {
                 if (!customer?.marketingConsent?.sms) {
                     showToast.warn("⚠️ Cannot Send: This customer has not opted-in to SMS communications.");
                     return;
                 }
            }
        }

        let activeOrgId = state.currentOrganization.id;

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
        let deliveryStatus: Message['deliveryStatus'] = activeTab === 'team' ? 'sent' : 'queued';

        setIsSending(true);
        if (pendingAttachments.length > 0) {
            setUploadingAttachments(true);
        }

        if (activeTab === 'inbound_emails') {
            if (!selectedInboundEmailId) {
                showToast.warn("Please select an inbound email thread to reply to.");
                setIsSending(false);
                setUploadingAttachments(false);
                return;
            }
            const mail = inboundEmails.find(e => e.id === selectedInboundEmailId);
            if (!mail) {
                setIsSending(false);
                setUploadingAttachments(false);
                return;
            }

            try {
                const uploadedAttachments: MessageAttachment[] = [];
                if (pendingAttachments.length > 0) {
                    for (const file of pendingAttachments) {
                        const path = `organizations/${activeOrgId}/inbound_replies/${mail.id}/${file.name}`;
                        const downloadUrl = await uploadFileToStorage(path, file);
                        uploadedAttachments.push({ name: file.name, url: downloadUrl, type: file.type, size: file.size });
                    }
                }

                const signatureText = includeSignature ? `\n\n---\n${user?.firstName || ''} ${user?.lastName || ''}\n${state.currentOrganization?.name || 'TekTrakker Customer Support'}` : '';
                const fullBody = (newMessage.trim() + signatureText).trim();

                const replyId = `reply_${Date.now()}`;
                const replyData = {
                    id: replyId,
                    inboundEmailId: mail.id,
                    senderId: user?.id,
                    senderName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Support Rep',
                    senderEmail: user?.email || '',
                    to: mail.from,
                    cc: emailCc ? emailCc.split(',').map(s => s.trim()).filter(Boolean) : [],
                    bcc: emailBcc ? emailBcc.split(',').map(s => s.trim()).filter(Boolean) : [],
                    subject: mail.subject?.startsWith('Re:') ? mail.subject : `Re: ${mail.subject || 'Customer Inquiry'}`,
                    content: fullBody,
                    attachments: uploadedAttachments,
                    sentAt: new Date().toISOString()
                };

                await db.collection('organizations').doc(activeOrgId).collection('inboundEmails').doc(mail.id).collection('replies').doc(replyId).set(cleanUndefinedFields(replyData));

                try {
                    await db.collection('organizations').doc(activeOrgId).collection('outboundEmailQueue').doc(replyId).set(cleanUndefinedFields({
                        ...replyData,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    }));
                } catch (e) {
                    console.warn("Queue write warning:", e);
                }

                showToast.success("Reply sent successfully!");
                setNewMessage('');
                setPendingAttachments([]);
                setEmailCc('');
                setEmailBcc('');
                setShowCcBcc(false);
            } catch (err) {
                console.error("Reply send error:", err);
                showToast.warn("Failed to send reply. Please try again.");
            } finally {
                setIsSending(false);
                setUploadingAttachments(false);
            }
            return;
        }

        try {
            const uploadedAttachments: MessageAttachment[] = [];
            if (pendingAttachments.length > 0) {
                for (const file of pendingAttachments) {
                    const path = `organizations/${activeOrgId}/messages/${msgId}/${file.name}`;
                    const downloadUrl = await uploadFileToStorage(path, file);
                    uploadedAttachments.push({
                        name: file.name,
                        url: downloadUrl,
                        type: file.type,
                        size: file.size
                    });
                }
            }

            const msg: Message = {
                id: msgId,
                organizationId: activeOrgId,
                senderId: user.id,
                senderName: (user.email === 'rodzelem@gmail.com' || user.email === 'ryanvavrecan@gmail.com') ? 'TekTrakker Administrator' : `${user.firstName} ${user.lastName}`,
                receiverId: activeTab === 'team' ? selectedPartnerId : (selectedCustomerId || ''),
                content: newMessage.trim(),
                timestamp: new Date().toISOString(),
                type: activeTab === 'team' ? (selectedPartnerId === 'all' ? 'alert' : 'text') : 'sms',
                read: false,
                deliveryStatus,
                attachments: uploadedAttachments
            };

            if (selectedPartnerId === 'all' && state.currentOrganization.id === 'platform' && user?.role === 'master_admin') {
                const allOrgIds = Array.from(new Set(state.users.map(u => u.organizationId).filter(Boolean)));
                const batch = db.batch();
                allOrgIds.forEach(orgId => {
                    const uniqueId = `${msgId}-${orgId}`;
                    const ref = db.collection('messages').doc(uniqueId);
                    batch.set(cleanUndefinedFields(ref), { ...msg, id: uniqueId, organizationId: orgId });
                });
                await batch.commit();
            } else {
                await db.collection('messages').doc(msgId).set(cleanUndefinedFields(msg));
            }

            if (activeTab === 'team') {
                if (selectedPartnerId !== 'all') {
                    await sendNotification(selectedPartnerId, {
                        title: `New Message from ${(user.email === 'rodzelem@gmail.com' || user.email === 'ryanvavrecan@gmail.com') ? 'TekTrakker Admin' : user.firstName}`,
                        body: newMessage.trim() || (uploadedAttachments.length > 0 ? `Sent ${uploadedAttachments.length} attachment(s)` : ""),
                        type: 'message',
                        link: `/admin/communications?tab=team&partner=${user.id}`,
                        data: { senderId: user.id, type: 'message' }
                    });
                } else {
                    let usersToNotify: AppUser[] = teamPartners;
                    if (state.currentOrganization.id === 'platform' && user?.role === 'master_admin') {
                        const senderEmail = (user?.email || '').toLowerCase();
                        usersToNotify = state.users.filter(u => u.id !== user.id && (u.email || '').toLowerCase() !== senderEmail);
                        if (broadcastTarget === 'all_admins') {
                            usersToNotify = usersToNotify.filter(u => ['master_admin', 'admin', 'both'].includes(u.role));
                        } else if (broadcastTarget === 'all_sales') {
                            usersToNotify = usersToNotify.filter(u => u.role === 'platform_sales');
                        }
                    }

                    const BATCH_SIZE = 50;
                    for (let i = 0; i < usersToNotify.length; i += BATCH_SIZE) {
                        const chunk = usersToNotify.slice(i, i + BATCH_SIZE);
                        const promises = chunk.map(p => sendNotification(p.id, {
                            title: `Broadcast from ${(user.email === 'rodzelem@gmail.com' || user.email === 'ryanvavrecan@gmail.com') ? 'TekTrakker Admin' : user.firstName}`,
                            body: newMessage.trim() || (uploadedAttachments.length > 0 ? `Sent ${uploadedAttachments.length} attachment(s)` : ""),
                            type: 'broadcast',
                            link: `/admin/communications?tab=team&partner=all`,
                            data: { senderId: user.id, type: 'broadcast' }
                        }));
                        await Promise.all(promises);
                    }

                    if (state.currentOrganization.id === 'platform' && user?.role === 'master_admin' && includeCustomers) {
                         const custMsg = { ...msg, id: `${msgId}-cust`, receiverId: 'all_customers', type: 'sms' };
                         await db.collection('messages').doc(custMsg.id).set(cleanUndefinedFields(custMsg));
                    }
                }
            }

            const updatedMessages = [...state.messages, msg];
            dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });

            setNewMessage('');
            setPendingAttachments([]);
        } catch (error) {
            console.error(error);
            showToast.warn("Send failed. Please check your connection.");
        } finally {
            setIsSending(false);
            setUploadingAttachments(false);
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
            showToast.success("Message deleted.");
        } catch (e) {
            console.error(e);
            showToast.warn("Delete failed.");
        }
    };

    const handleSaveEdit = async (msg: Message) => {
        if (!editContent.trim() || editContent.trim() === msg.content) {
            setEditingMessageId(null);
            return;
        }
        try {
            await db.collection('messages').doc(msg.id).update(cleanUndefinedFields({
                content: editContent.trim(),
                isEdited: true
            }));
            const updatedMessages = state.messages.map(m => m.id === msg.id ? { ...m, content: editContent.trim(), isEdited: true } : m);
            dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
            setEditingMessageId(null);
        } catch {
            showToast.warn("Edit failed.");
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

    const EMOJI_CATEGORIES = [
        {
            name: 'Quick Reactions',
            emojis: ['👍', '❤️', '😊', '🔥', '🎉', '✅', '🙏', '🚀', '🛠️', '📄', '💼', '📱', '💯', '⭐', '👏', '🙌']
        },
        {
            name: 'Field & Work',
            emojis: ['🛠️', '🔧', '⚡', '📍', '🚗', '📋', '📸', '💰', '☕', '🔍', '🚨', '📦', '🏗️', '🧹', '🔑', '🏷️']
        },
        {
            name: 'Smilies & Expressions',
            emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '😎', '🤓', '🥳', '🤗', '🤔', '🤫', '🤐', '🫡', '💪', '🤝', '👋']
        }
    ];

    const STICKERS = [
        { label: 'On My Way!', icon: '🚗', text: '🚗 On my way to the site!' },
        { label: 'Job Complete', icon: '✅', text: '✅ Job has been completed!' },
        { label: 'Photos Uploaded', icon: '📸', text: '📸 Photos uploaded to job record.' },
        { label: 'Sign-off Needed', icon: '✍️', text: '✍️ Customer sign-off sheet ready for signature.' },
        { label: 'Invoice Paid', icon: '💰', text: '💰 Payment received & invoice cleared.' },
        { label: 'Urgent Request', icon: '🚨', text: '🚨 High Priority: Immediate attention requested.' },
        { label: 'Approved!', icon: '👍', text: '👍 Approved and verified.' },
        { label: 'Coffee Break', icon: '☕', text: '☕ Stepping away for a quick break.' },
    ];

    const renderContentWithLinks = (text: string) => {
        if (!text) return text;
        const regex = /(https?:\/\/[^\s]+|#?(?:JOB|WO|PROP|P|INV|DOC|HIST|CUST|EXP|REPORT)-[A-Za-z0-9-]+|#?WO[:#\s]*#?\d+|#\d{3,})/gi;
        const parts = text.split(regex);
        return parts.map((part, i) => {
            if (!part) return null;
            if (part.match(/^https?:\/\/[^\s]+/i)) {
                return <a key={i} href={part} target="_blank" rel="noreferrer" className="underline hover:opacity-80 break-all text-blue-500">{part}</a>;
            }
            if (part.match(/^#?JOB-([A-Za-z0-9-]+)/i)) {
                const id = part.replace(/^#?JOB-/i, '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/operations?tab=jobs&jobId=${id}`); 
                    else navigate(`/briefing/scheduling?jobId=${id}`);
                }} className="underline font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#?WO/i) || part.match(/^#\d{3,}/)) {
                const numMatch = part.match(/\d+/);
                const id = numMatch ? numMatch[0] : part;
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/operations?tab=jobs&search=${id}`); 
                    else navigate(`/briefing/scheduling?search=${id}`);
                }} className="underline font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#?HIST-([A-Za-z0-9-]+)/i)) {
                const id = part.replace(/^#?HIST-/i, '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/records?tab=history&histId=${id}`); 
                    else showToast.warn("Restricted: Historical job records require administrator privileges.");
                }} className="underline font-bold bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#?DOC-([A-Za-z0-9-]+)/i)) {
                const id = part.replace(/^#?DOC-/i, '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/records?tab=documents&docId=${id}`);
                    else showToast.warn('Restricted: Documents require administrator privileges.');
                }} className="underline font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#?INV-([A-Za-z0-9-]+)/i)) {
                const id = part.replace(/^#?INV-/i, '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/financials?tab=invoices&invoiceId=${id}`);
                    else showToast.warn('Restricted: Invoices require administrator privileges.');
                }} className="underline font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#?REPORT-([A-Za-z0-9-]+)/i)) {
                const id = part.replace(/^#?REPORT-/i, '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    navigate(`/admin/ai-reports?reportId=${id}`);
                }} className="underline font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#?(?:PROP|P)-([A-Za-z0-9-]+)/i)) {
                const id = part.replace(/^#?(?:PROP|P)-/i, '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/sales?propId=${id}`); 
                    else navigate(`/briefing/proposal?proposalId=${id}`);
                }} className="underline font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#?CUST-([A-Za-z0-9-]+)/i)) {
                const id = part.replace(/^#?CUST-/i, '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/customers?custId=${id}`);
                    else showToast.warn('Restricted: Full customer profiles require administrator privileges.');
                }} className="underline font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            if (part.match(/^#?EXP-([A-Za-z0-9-]+)/i)) {
                const id = part.replace(/^#?EXP-/i, '');
                return <button key={i} onClick={(e) => { 
                    e.preventDefault(); 
                    if (isStaffAdmin) navigate(`/admin/financials?tab=expenses&expId=${id}`);
                    else showToast.warn('Restricted: Financial records require administrator privileges.');
                }} className="underline font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition-opacity whitespace-nowrap">{part}</button>;
            }
            return part;
        });
    };

    const getInboundEmailContext = (mail: any) => {
        if (!mail) return { matchedCustomer: null, matchedContact: null, isWorkOrderEmail: false, customerName: '', contactName: '' };

        const fromClean = (mail.from?.match(/<([^>]+)>/)?.[1] || mail.from || '').trim().toLowerCase();

        // 1. Match by ID if present
        let matchedCust = mail.customerId ? (state.customers.find(c => c.id === mail.customerId) || null) : null;

        // 2. Match by customer direct email or contact email
        if (!matchedCust && fromClean) {
            matchedCust = state.customers.find(c => {
                if (c.email && c.email.trim().toLowerCase() === fromClean) return true;
                if (c.contacts && c.contacts.some((cnt: any) => typeof cnt?.email === 'string' && cnt.email.trim().toLowerCase() === fromClean)) return true;
                return false;
            }) || null;
        }

        const matchedContact: any = matchedCust?.contacts?.find((cnt: any) => typeof cnt?.email === 'string' && cnt.email.trim().toLowerCase() === fromClean) || null;

        const isWorkOrderEmail = Boolean(
            mail.isWorkOrderEmail || 
            matchedContact?.isIncomingWorkOrderContact || 
            (Array.isArray(matchedContact?.contactRoles) && matchedContact.contactRoles.includes('incoming_workorders')) ||
            (typeof matchedContact?.title === 'string' && matchedContact.title.toLowerCase().includes('incoming work order')) ||
            (typeof matchedContact?.title === 'string' && matchedContact.title.toLowerCase().includes('incoming workorder'))
        );

        return {
            matchedCustomer: matchedCust,
            matchedContact,
            isWorkOrderEmail,
            customerName: matchedCust?.name || mail.customerName || '',
            contactName: matchedContact?.name || mail.workOrderContactName || ''
        };
    };

    const selectedMail = useMemo(() => {
        return inboundEmails.find(e => e.id === selectedInboundEmailId);
    }, [inboundEmails, selectedInboundEmailId]);

    const selectedMailCtx = useMemo(() => {
        return getInboundEmailContext(selectedMail);
    }, [selectedMail, state.customers]);

    const handleCreateWorkOrderFromInboundEmail = (mail: any) => {
        if (!mail) return;
        const ctx = getInboundEmailContext(mail);
        const text = encodeURIComponent(mail.text || mail.subject || '');
        const from = encodeURIComponent(mail.from || '');
        const custId = encodeURIComponent(ctx.matchedCustomer?.id || mail.customerId || '');
        const atts = encodeURIComponent(JSON.stringify(mail.attachments || []));
        navigate(`/admin/operations?new=true&email=${from}&customerId=${custId}&notes=${text}&attachments=${atts}`);
    };

    // EMAIL THREAD TIMELINE AGGREGATION (PREVENTS COMBINING FORWARDED DOMAIN EMAILS)
    const emailThreadTimeline = useMemo(() => {
        if (!selectedMail) return [];

        const items: Array<{
            id: string;
            type: 'inbound' | 'outbound';
            senderName: string;
            senderEmail: string;
            to?: string;
            cc?: string | string[];
            subject: string;
            content: string;
            attachments?: any[];
            timestamp: string;
        }> = [];

        // 1. Add the selected inbound email itself
        items.push({
            id: selectedMail.id,
            type: 'inbound',
            senderName: selectedMail.senderName || selectedMail.from || 'Customer',
            senderEmail: selectedMail.from || '',
            to: selectedMail.to,
            cc: selectedMail.cc,
            subject: selectedMail.subject || '(No Subject)',
            content: selectedMail.text || selectedMail.html?.replace(/<[^>]*>?/gm, '') || '',
            attachments: selectedMail.attachments || [],
            timestamp: selectedMail.receivedAt || new Date().toISOString()
        });

        // 2. Add outbound replies sent for this email
        emailReplies.forEach(reply => {
            items.push({
                id: reply.id,
                type: 'outbound',
                senderName: reply.senderName || 'Support Rep',
                senderEmail: reply.senderEmail || user?.email || '',
                to: reply.to,
                cc: reply.cc,
                subject: reply.subject || `Re: ${selectedMail.subject || 'Inquiry'}`,
                content: reply.content || '',
                attachments: reply.attachments || [],
                timestamp: reply.sentAt || new Date().toISOString()
            });
        });

        return items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [selectedMail, emailReplies, user?.email]);

    const workOrderEmailsCount = useMemo(() => {
        return inboundEmails.filter(mail => getInboundEmailContext(mail).isWorkOrderEmail).length;
    }, [inboundEmails, state.customers]);

    const filteredInboundEmails = useMemo(() => {
        return inboundEmails.filter(mail => {
            const ctx = getInboundEmailContext(mail);
            if (emailFilter === 'unread' && mail.status !== 'unread') return false;
            if (emailFilter === 'workorders' && !ctx.isWorkOrderEmail) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (mail.subject || '').toLowerCase().includes(q) ||
                   (mail.from || '').toLowerCase().includes(q) ||
                   (mail.text || '').toLowerCase().includes(q) ||
                   (mail.senderName || '').toLowerCase().includes(q) ||
                   (ctx.customerName || '').toLowerCase().includes(q) ||
                   (ctx.contactName || '').toLowerCase().includes(q);
        });
    }, [inboundEmails, emailFilter, searchQuery, state.customers]);

    return (
        <div className="flex flex-col h-[calc(100dvh-110px)] p-2 md:p-4 gap-3 animate-fade-in relative overflow-hidden">
            
            {/* TOP BAR: UNIFIED TAB & HEADER SWITCHER */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 md:p-3 shadow-md flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl overflow-x-auto max-w-full custom-scrollbar">
                    <button
                        type="button"
                        onClick={() => { setActiveTab('phone'); setIsMobileThreadOpen(false); }}
                        className={`flex items-center gap-2 px-3 md:px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'phone' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        <PhoneCall size={15}/> Phone & Voicemail
                        {unreadVoicemailCount > 0 && (
                            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">
                                {unreadVoicemailCount}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => { setActiveTab('team'); setIsMobileThreadOpen(false); }}
                        className={`flex items-center gap-2 px-3 md:px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'team' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        <Users size={15}/> Team Chat
                    </button>

                    <button
                        type="button"
                        onClick={() => { setActiveTab('customers'); setIsMobileThreadOpen(false); }}
                        className={`flex items-center gap-2 px-3 md:px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'customers' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        <User size={15}/> Customer SMS
                    </button>

                    {isStaffAdmin && (
                        <button
                            type="button"
                            onClick={() => { setActiveTab('inbound_emails'); setIsMobileThreadOpen(false); }}
                            className={`flex items-center gap-2 px-3 md:px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'inbound_emails' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <Inbox size={15}/> Inbound Emails
                            {inboundEmails.filter(e => e.status === 'unread').length > 0 && (
                                <span className="bg-white text-indigo-700 text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1 shadow-xs">
                                    {inboundEmails.filter(e => e.status === 'unread').length}
                                </span>
                            )}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xs ml-auto">
                    {activeTab === 'inbound_emails' && isStaffAdmin && (
                        <button
                            type="button"
                            onClick={() => navigate('/admin/settings?tab=integrations')}
                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-900/50 transition-colors ml-auto shrink-0"
                            title="Configure Ingestion Settings"
                        >
                            <Settings size={14} /> Ingestion Settings
                        </button>
                    )}
                </div>
            </div>

            {/* MAIN WORKSPACE CONTENT BASED ON ACTIVE TAB */}
            {activeTab === 'phone' ? (
                <PhoneCenterView />
            ) : activeTab === 'inbound_emails' && isStaffAdmin ? (
                <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden relative">
                    
                    {/* LEFT COLUMN: FULLSCREEN EMAIL INBOX LIST */}
                    <Card className={`w-full md:w-80 lg:w-[380px] flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl shrink-0 transition-transform duration-300 ${selectedInboundEmailId && isMobileThreadOpen ? '-translate-x-full md:translate-x-0 absolute md:relative pointer-events-none md:pointer-events-auto' : 'translate-x-0 relative'}`}>
                        {/* Inbox Header & Search */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                    <Inbox size={16} className="text-indigo-600 dark:text-indigo-400" />
                                    Email Inbox ({inboundEmails.length})
                                </h3>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setEmailFilter('all')}
                                        className={`px-2 py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${emailFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                    >
                                        All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEmailFilter('workorders')}
                                        className={`px-2 py-1 text-[10px] font-black uppercase rounded-lg border transition-all flex items-center gap-1 ${emailFilter === 'workorders' ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'}`}
                                    >
                                        <Wrench size={11} /> Work Orders ({workOrderEmailsCount})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEmailFilter('unread')}
                                        className={`px-2 py-1 text-[10px] font-black uppercase rounded-lg border transition-all ${emailFilter === 'unread' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                                    >
                                        Unread
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                <input 
                                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white" 
                                    placeholder="Search subject or sender..." 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                />
                            </div>
                        </div>

                        {/* Email Items List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                            {filteredInboundEmails.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 space-y-2">
                                    <Mail size={32} className="mx-auto opacity-30 text-indigo-500" />
                                    <p className="text-xs font-semibold">No emails match your filter.</p>
                                </div>
                            ) : (
                                filteredInboundEmails.map(mail => {
                                    const isSelected = selectedInboundEmailId === mail.id;
                                    const mailCtx = getInboundEmailContext(mail);
                                    return (
                                        <div
                                            key={mail.id}
                                            onClick={() => {
                                                setSelectedInboundEmailId(mail.id);
                                                selectedEmailIdRef.current = mail.id;
                                                setIsMobileThreadOpen(true);
                                                if (mail.status === 'unread' && state.currentOrganization?.id) {
                                                    db.collection('organizations').doc(state.currentOrganization.id).collection('inboundEmails').doc(mail.id).update({ status: 'read' }).catch(() => {});
                                                }
                                            }}
                                            className={`w-full text-left px-3.5 py-3 rounded-2xl flex flex-col gap-2 transition-all cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-indigo-600 text-white shadow-md font-extrabold' 
                                                    : mailCtx.isWorkOrderEmail
                                                        ? 'bg-amber-50/40 dark:bg-amber-950/20 text-slate-900 dark:text-white border-2 border-amber-400 dark:border-amber-600/70 shadow-sm hover:border-amber-500'
                                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800/50'
                                            }`}
                                        >
                                            {mailCtx.isWorkOrderEmail && (
                                                <div className="flex items-center justify-between gap-1 mb-0.5 pb-1 border-b border-amber-200/60 dark:border-amber-900/40">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                                                        isSelected ? 'bg-amber-400 text-amber-950 font-black' : 'bg-amber-500 text-white shadow-xs'
                                                    }`}>
                                                        <Wrench size={10} /> Incoming Work Order
                                                    </span>
                                                    {mailCtx.customerName && (
                                                        <span className={`text-[10px] font-black truncate max-w-[140px] ${
                                                            isSelected ? 'text-amber-200' : 'text-amber-700 dark:text-amber-300'
                                                        }`}>
                                                            {mailCtx.customerName}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-start gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${isSelected ? 'bg-white/20 text-white' : (mail.status === 'unread' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400')}`}>
                                                    {(mail.senderName || mail.from || 'E')[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="font-bold text-xs truncate max-w-[170px]">{mail.senderName || mail.from}</span>
                                                        <span className={`text-[10px] font-medium shrink-0 ml-1 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                                            {new Date(mail.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className={`text-xs truncate font-extrabold ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                                        {mail.subject || '(No Subject)'}
                                                    </p>
                                                    <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {mail.text || mail.html?.replace(/<[^>]*>?/gm, '') || ''}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Toolbar on List Item Card */}
                                            <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-white/20 dark:border-slate-700/50" onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCreateWorkOrderFromInboundEmail(mail)}
                                                    className={`px-2 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors ${
                                                        isSelected 
                                                            ? 'bg-white/20 hover:bg-white/30 text-white' 
                                                            : mailCtx.isWorkOrderEmail
                                                                ? 'bg-amber-600 hover:bg-amber-700 text-white font-black shadow-xs'
                                                                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
                                                    }`}
                                                    title="Create Work Order"
                                                >
                                                    <PlusCircle size={12} /> Work Order
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const bodyAndSubject = `${mail.subject} ${mail.text || ''}`;
                                                        const priceMatch = bodyAndSubject.match(/\$\s*([0-9]+(?:\.[0-9]{2})?)/) || bodyAndSubject.match(/(?:Total|Amount|Balance|Due)[:\s]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i);
                                                        const extractedAmount = priceMatch ? priceMatch[1] : '';
                                                        const vendor = encodeURIComponent(mail.senderName || mail.from || '');
                                                        const notes = encodeURIComponent(`From Email: ${mail.subject}\n\n${mail.text || ''}`);
                                                        const receiptUrl = mail.attachments?.[0]?.url ? encodeURIComponent(mail.attachments[0].url) : '';
                                                        navigate(`/admin/financials?tab=expenses&newExpense=true&vendor=${vendor}&amount=${extractedAmount}&notes=${notes}&receiptUrl=${receiptUrl}`);
                                                    }}
                                                    className={`px-2 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors ${isSelected ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'}`}
                                                    title="Create Expense"
                                                >
                                                    <Receipt size={12} /> Expense
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const bodyAndSubject = `${mail.subject} ${mail.text || ''}`;
                                                        const priceMatch = bodyAndSubject.match(/\$\s*([0-9]+(?:\.[0-9]{2})?)/) || bodyAndSubject.match(/(?:Total|Amount|Balance|Due)[:\s]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i);
                                                        const extractedAmount = priceMatch ? priceMatch[1] : '';
                                                        const vendor = encodeURIComponent(mail.senderName || mail.from || '');
                                                        const notes = encodeURIComponent(`Bill Subject: ${mail.subject}\n\n${mail.text || ''}`);
                                                        navigate(`/admin/financials?tab=payables&newPayable=true&vendor=${vendor}&amount=${extractedAmount}&notes=${notes}`);
                                                    }}
                                                    className={`px-2 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors ${isSelected ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100'}`}
                                                    title="Make Payable Bill"
                                                >
                                                    <Receipt size={12} /> Payable Bill
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const name = encodeURIComponent(mail.senderName || '');
                                                        const email = encodeURIComponent(mail.from || '');
                                                        navigate(`/admin/customers?new=true&name=${name}&email=${email}`);
                                                    }}
                                                    className={`px-2 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors ${isSelected ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100'}`}
                                                    title="Create Customer Profile"
                                                >
                                                    <UserPlus size={12} /> Customer
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Card>

                    {/* RIGHT COLUMN: FULLSCREEN EMAIL READER & REPLY WORKSPACE */}
                    <Card className={`flex-1 flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900 transition-transform duration-300 ${!isMobileThreadOpen ? 'translate-x-full md:translate-x-0 absolute md:relative pointer-events-none md:pointer-events-auto' : 'translate-x-0 relative'}`}>
                        {!selectedMail ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-4">
                                <Inbox size={64} className="opacity-20 text-indigo-500" />
                                <h4 className="font-extrabold text-slate-700 dark:text-slate-200 text-lg">Select an Inbound Email</h4>
                                <p className="text-xs max-w-sm text-slate-500">
                                    Click any email on the left inbox panel to read the full thread, convert to Work Orders, Expenses, or Payable Bills, and reply!
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                {/* Email Reader Toolbar Header */}
                                <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setIsMobileThreadOpen(false)} 
                                            className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
                                        >
                                            <ArrowLeft size={18}/>
                                        </button>
                                        <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                            THREAD ({emailThreadTimeline.length} Message{emailThreadTimeline.length > 1 ? 's' : ''})
                                        </span>
                                    </div>

                                    {/* Action Buttons Toolbar */}
                                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsReplyAllMode(false);
                                                setShowCcBcc(false);
                                                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                                            }}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                                        >
                                            <CornerUpLeft size={14} /> Reply
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsReplyAllMode(true);
                                                setShowCcBcc(true);
                                                if (selectedMail.cc) setEmailCc(selectedMail.cc);
                                                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                                            }}
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                                        >
                                            <CornerUpRight size={14} /> Reply All
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleCreateWorkOrderFromInboundEmail(selectedMail)}
                                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors ${
                                                selectedMailCtx.isWorkOrderEmail
                                                    ? 'bg-amber-600 hover:bg-amber-700 text-white font-black ring-2 ring-amber-400/40'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                        >
                                            <PlusCircle size={14} /> Work Order
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const bodyAndSubject = `${selectedMail.subject} ${selectedMail.text || ''}`;
                                                const priceMatch = bodyAndSubject.match(/\$\s*([0-9]+(?:\.[0-9]{2})?)/) || bodyAndSubject.match(/(?:Total|Amount|Balance|Due)[:\s]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i);
                                                const extractedAmount = priceMatch ? priceMatch[1] : '';
                                                const vendor = encodeURIComponent(selectedMail.senderName || selectedMail.from || '');
                                                const notes = encodeURIComponent(`From Email: ${selectedMail.subject}\n\n${selectedMail.text || ''}`);
                                                const receiptUrl = selectedMail.attachments?.[0]?.url ? encodeURIComponent(selectedMail.attachments[0].url) : '';
                                                navigate(`/admin/financials?tab=expenses&newExpense=true&vendor=${vendor}&amount=${extractedAmount}&notes=${notes}&receiptUrl=${receiptUrl}`);
                                            }}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                                        >
                                            <Receipt size={14} /> Expense
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const bodyAndSubject = `${selectedMail.subject} ${selectedMail.text || ''}`;
                                                const priceMatch = bodyAndSubject.match(/\$\s*([0-9]+(?:\.[0-9]{2})?)/) || bodyAndSubject.match(/(?:Total|Amount|Balance|Due)[:\s]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i);
                                                const extractedAmount = priceMatch ? priceMatch[1] : '';
                                                const vendor = encodeURIComponent(selectedMail.senderName || selectedMail.from || '');
                                                const notes = encodeURIComponent(`Bill Subject: ${selectedMail.subject}\n\n${selectedMail.text || ''}`);
                                                navigate(`/admin/financials?tab=payables&newPayable=true&vendor=${vendor}&amount=${extractedAmount}&notes=${notes}`);
                                            }}
                                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                                        >
                                            <Receipt size={14} /> Payable Bill
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const name = encodeURIComponent(selectedMail.senderName || '');
                                                const email = encodeURIComponent(selectedMail.from || '');
                                                navigate(`/admin/customers?new=true&name=${name}&email=${email}`);
                                            }}
                                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                                        >
                                            <UserPlus size={14} /> Customer
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteInboundEmail(selectedMail.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                            title="Delete Email Thread"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Main Email Scrollable Workspace: FULL THREAD TIMELINE */}
                                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/50" ref={scrollRef}>
                                    
                                    {/* Prominent Incoming Work Order Request Alert Banner */}
                                    {selectedMailCtx.isWorkOrderEmail && (
                                        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
                                            <div className="flex items-center gap-3.5">
                                                <div className="p-3 bg-amber-500 text-white rounded-xl shadow-sm shrink-0">
                                                    <Wrench size={22} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                                                            Incoming Work Order Request
                                                        </span>
                                                        {selectedMailCtx.customerName && (
                                                            <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-amber-300 dark:border-amber-700">
                                                                {selectedMailCtx.customerName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-black text-base text-slate-900 dark:text-white mt-0.5">
                                                        {selectedMailCtx.customerName ? `Work Order from ${selectedMailCtx.customerName}` : 'Incoming Work Order Dispatch'}
                                                    </h4>
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                                        Received from designated work order contact <span className="font-bold text-slate-800 dark:text-slate-100">({selectedMailCtx.contactName ? `${selectedMailCtx.contactName} - ` : ''}{selectedMail.from})</span>.
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCreateWorkOrderFromInboundEmail(selectedMail)}
                                                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all shrink-0 cursor-pointer"
                                            >
                                                <PlusCircle size={16} /> Turn into Work Order
                                            </button>
                                        </div>
                                    )}

                                    {/* Subject Title Card */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-2">
                                        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-snug">
                                            {selectedMail.subject || '(No Subject)'}
                                        </h2>
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                                            <span>Thread ID: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedMail.id}</span></span>
                                            <span>Original Received: <span className="font-bold text-slate-700 dark:text-slate-300">{new Date(selectedMail.receivedAt).toLocaleString()}</span></span>
                                        </div>
                                    </div>

                                    {/* FULL CHRONOLOGICAL THREAD TIMELINE */}
                                    <div className="space-y-5">
                                        {emailThreadTimeline.map((msg, idx) => {
                                            const isInbound = msg.type === 'inbound';
                                            return (
                                                <div 
                                                    key={msg.id || idx}
                                                    className={`border rounded-2xl p-5 shadow-sm space-y-4 transition-all ${isInbound ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60 ml-4 md:ml-8'}`}
                                                >
                                                    {/* Message Header */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${isInbound ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white'}`}>
                                                                {(msg.senderName || 'U')[0].toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                                                        {msg.senderName}
                                                                    </span>
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${isInbound ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                                                        {isInbound ? 'CUSTOMER INBOUND' : 'SUPPORT REPLY'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 font-medium">
                                                                    {msg.senderEmail} {msg.to ? `➔ To: ${msg.to}` : ''} {msg.cc ? `| CC: ${Array.isArray(msg.cc) ? msg.cc.join(', ') : msg.cc}` : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs text-slate-400 font-bold">
                                                            {new Date(msg.timestamp).toLocaleString()}
                                                        </span>
                                                    </div>

                                                    {/* Message Attachments */}
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block flex items-center gap-1.5">
                                                                <Paperclip size={14} className="text-indigo-500" />
                                                                Attachments ({msg.attachments.length}):
                                                            </span>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                {msg.attachments.map((att: any, aIdx: number) => {
                                                                    const filename = att.filename || att.name || `Attachment_${aIdx + 1}`;
                                                                    const isImg = (att.contentType || att.type || '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);
                                                                    return (
                                                                        <div key={aIdx} className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 shadow-xs space-y-1.5">
                                                                            {isImg && att.url ? (
                                                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="block max-h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                                                                    <img src={att.url} alt={filename} className="w-full h-24 object-cover hover:scale-105 transition-transform" />
                                                                                </a>
                                                                            ) : null}
                                                                            <div className="flex items-center justify-between gap-2 px-1">
                                                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={filename}>
                                                                                    {filename}
                                                                                </span>
                                                                                <a
                                                                                    href={att.url}
                                                                                    download={filename}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="px-2 py-1 bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-bold rounded flex items-center gap-1 shrink-0"
                                                                                >
                                                                                    <Download size={11} /> Download
                                                                                </a>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Message Content Body */}
                                                    <div className="text-slate-900 dark:text-slate-100 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                                        {msg.content || '(Empty Message Body)'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Integrated Email Reply Composer Container */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-lg space-y-3 mt-6">
                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                                <CornerUpLeft size={16} className="text-indigo-600 dark:text-indigo-400" />
                                                Reply to {selectedMail.senderName || selectedMail.from}
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => setShowCcBcc(prev => !prev)}
                                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                {showCcBcc ? 'Hide CC / BCC' : 'Show CC / BCC'}
                                            </button>
                                        </div>

                                        <form onSubmit={handleSend} className="space-y-3">
                                            {showCcBcc && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">CC Recipient(s)</label>
                                                        <input
                                                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                                            placeholder="email1@domain.com, email2@domain.com"
                                                            value={emailCc}
                                                            onChange={e => setEmailCc(e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">BCC Recipient(s)</label>
                                                        <input
                                                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                                            placeholder="bcc@domain.com"
                                                            value={emailBcc}
                                                            onChange={e => setEmailBcc(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <Textarea
                                                className="w-full p-4 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 dark:text-white min-h-[120px]"
                                                placeholder="Type your email reply..."
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                                rows={4}
                                            />

                                            {pendingAttachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                                    {pendingAttachments.map((file, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                                                            <Paperclip size={12} className="text-indigo-500" />
                                                            <span className="truncate max-w-[140px]">{file.name}</span>
                                                            <button type="button" onClick={() => removePendingAttachment(idx)} className="text-slate-400 hover:text-rose-500 ml-1">
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="file"
                                                        multiple
                                                        ref={fileInputRef}
                                                        onChange={handleFileChange}
                                                        className="hidden"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                                                    >
                                                        <Paperclip size={14} /> Attach Files
                                                    </button>
                                                    <label className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={includeSignature}
                                                            onChange={e => setIncludeSignature(e.target.checked)}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        Include Support Signature
                                                    </label>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={!newMessage.trim() || isSending}
                                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                                    Send Email Reply
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                /* SPLIT VIEW FOR TEAM CHAT AND CUSTOMER SMS */
                <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden relative">
                    
                    {/* LEFT BAR: THREADS */}
                    <Card className={`w-full md:w-80 lg:w-96 flex flex-col p-0 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl transition-transform duration-300 ${isMobileThreadOpen ? '-translate-x-full md:translate-x-0 absolute md:relative pointer-events-none md:pointer-events-auto' : 'translate-x-0 relative'}`}>
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
                                    {sortedCustomers.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map(c => (
                                        <button key={c.id} onClick={() => handleCustomerSelect(c.id)} className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-4 transition-all ${selectedCustomerId === c.id ? 'bg-primary-600 text-white shadow-lg' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${selectedCustomerId === c.id ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>{(c.name || 'C')[0]}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center">
                                                    <span className="block font-bold text-sm truncate">{c.name}</span>
                                                    {c.unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{c.unreadCount}</span>}
                                                </div>
                                                <p className={`text-xs truncate ${selectedCustomerId === c.id ? 'text-white/70' : 'text-slate-500'}`}>
                                                    {c.lastMsg ? c.lastMsg.content : c.phone}
                                                </p>
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
                                const isEditable = isOwnMessage && activeTab === 'team' && ((new Date().getTime() - new Date(msg.timestamp).getTime()) < 15 * 60 * 1000);
                                const canDelete = isOwnMessage || ['master_admin', 'admin', 'both'].includes(user?.role || '');
                                const isEditingThis = editingMessageId === msg.id;

                                return (
                                    <div key={msg.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group/msg animate-fade-in`}>
                                        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[88%] sm:max-w-[80%]`}>
                                            {!isOwnMessage && selectedPartnerId === 'all' && <span className="text-[10px] font-black text-slate-400 mb-1 ml-2 uppercase tracking-tighter">{msg.senderName}</span>}
                                            {isEditingThis ? (
                                                <div className="flex gap-2 items-center bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                                                    <input 
                                                        title="Edit Message"
                                                        aria-label="Edit Message Content"
                                                        className="bg-slate-100 dark:bg-slate-900 border-none rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 w-48 md:w-64"
                                                        value={editContent}
                                                        onChange={e => setEditContent(e.target.value)}
                                                    />
                                                    <button title="Save Edit" aria-label="Save Edit" onClick={() => handleSaveEdit(msg)} className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">
                                                        <CheckCircle2 size={16}/>
                                                    </button>
                                                    <button title="Cancel Edit" aria-label="Cancel Edit" onClick={() => setEditingMessageId(null)} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 transition-colors">
                                                        <X size={16}/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 w-full">
                                                    {isOwnMessage && (
                                                        <div className="flex items-center gap-1 opacity-70 group-hover/msg:opacity-100 transition-opacity shrink-0">
                                                            {isEditable && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }}
                                                                    className="p-1.5 text-slate-400 hover:text-blue-500 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 rounded-full shadow-xs border border-slate-200/50 dark:border-slate-700/50 transition-all cursor-pointer"
                                                                    title="Edit Message (within 15m)"
                                                                >
                                                                    <Edit size={12}/>
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleDeleteMessage(msg)}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-500 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 rounded-full shadow-xs border border-slate-200/50 dark:border-slate-700/50 transition-all cursor-pointer"
                                                                    title="Delete Message"
                                                                >
                                                                    <Trash2 size={12}/>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className={`px-4 md:px-5 py-2 md:py-3 rounded-2xl md:rounded-3xl shadow-sm text-sm leading-relaxed ${isOwnMessage ? 'bg-primary-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none border border-slate-100 dark:border-slate-700'}`}>
                                                        {msg.content && renderContentWithLinks(msg.content)} {msg.isEdited && <span className="text-[10px] opacity-70 italic ml-1">(edited)</span>}
                                                        {msg.attachments && msg.attachments.length > 0 && (
                                                            <div className={`mt-2 flex flex-col gap-2 ${msg.content ? 'pt-2 border-t border-white/20 dark:border-slate-700' : ''}`}>
                                                                {msg.attachments.map((att, idx) => {
                                                                    const isImg = att.type.startsWith('image/');
                                                                    return isImg ? (
                                                                        <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="block max-w-[240px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity">
                                                                            <img src={att.url} alt={att.name} className="max-h-[160px] w-full object-cover" />
                                                                        </a>
                                                                    ) : (
                                                                        <a key={idx} href={att.url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 p-2 rounded-lg text-xs border transition-colors ${isOwnMessage ? 'bg-primary-700 border-primary-500 text-white hover:bg-primary-800' : 'bg-slate-100 border-slate-200 dark:bg-slate-900 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                                                                            <FileText size={16} />
                                                                            <span className="truncate max-w-[150px] font-semibold">{att.name}</span>
                                                                        </a>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {!isOwnMessage && canDelete && (
                                                        <div className="flex items-center gap-1 opacity-70 group-hover/msg:opacity-100 transition-opacity shrink-0">
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleDeleteMessage(msg)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-500 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 rounded-full shadow-xs border border-slate-200/50 dark:border-slate-700/50 transition-all cursor-pointer"
                                                                title="Delete Message"
                                                            >
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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
                                                            } else if ((msg.timestamp as { toDate?: () => Date })?.toDate) {
                                                                d = (msg.timestamp as { toDate: () => Date }).toDate();
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
                                <form onSubmit={handleSend} className="flex flex-col gap-2 relative">
                                    {showEmojiPicker && (
                                        <div className="absolute bottom-16 left-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-3 w-80 sm:w-96 animate-fade-in">
                                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPickerTab('emojis')}
                                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${pickerTab === 'emojis' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500'}`}
                                                    >
                                                        <Smile size={14} /> Emojis
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPickerTab('stickers')}
                                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${pickerTab === 'stickers' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs' : 'text-slate-500'}`}
                                                    >
                                                        <Sparkles size={14} /> Stickers
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmojiPicker(false)}
                                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            {pickerTab === 'emojis' ? (
                                                <div className="max-h-60 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                                    {EMOJI_CATEGORIES.map((cat, cIdx) => (
                                                        <div key={cIdx}>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{cat.name}</span>
                                                            <div className="grid grid-cols-8 gap-1">
                                                                {cat.emojis.map((emoji, eIdx) => (
                                                                    <button
                                                                        key={eIdx}
                                                                        type="button"
                                                                        onClick={() => setNewMessage(prev => prev + emoji)}
                                                                        className="p-1.5 text-xl hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all hover:scale-125"
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="max-h-60 overflow-y-auto grid grid-cols-2 gap-2 custom-scrollbar p-1">
                                                    {STICKERS.map((sticker, sIdx) => (
                                                        <button
                                                            key={sIdx}
                                                            type="button"
                                                            onClick={() => {
                                                                setNewMessage(prev => (prev ? `${prev} ${sticker.text}` : sticker.text));
                                                                setShowEmojiPicker(false);
                                                            }}
                                                            className="p-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 rounded-2xl flex items-center gap-2 text-left transition-all group"
                                                        >
                                                            <span className="text-2xl group-hover:scale-110 transition-transform">{sticker.icon}</span>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-300 leading-snug">{sticker.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {pendingAttachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                                            {pendingAttachments.map((file, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 animate-fade-in">
                                                    {file.type.startsWith('image/') ? <Image size={14} className="text-blue-500" /> : <FileText size={14} className="text-emerald-500" />}
                                                    <span className="truncate max-w-[120px]">{file.name}</span>
                                                    <button type="button" onClick={() => removePendingAttachment(idx)} className="text-slate-400 hover:text-red-500 transition-colors ml-1" title="Remove file" aria-label="Remove file">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            {uploadingAttachments && (
                                                <div className="flex items-center gap-2 text-xs font-bold text-primary-600 dark:text-primary-400 px-2 py-1">
                                                    <RefreshCw className="animate-spin" size={14} />
                                                    <span>Uploading...</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex gap-2 md:gap-3 items-center">
                                        <input 
                                            type="file" 
                                            multiple 
                                            ref={fileInputRef} 
                                            onChange={handleFileChange} 
                                            className="hidden" 
                                            aria-label="Upload attachments"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()} 
                                            className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all shadow-sm shrink-0"
                                            title="Attach Photos or Documents"
                                            aria-label="Attach Photos or Documents"
                                        >
                                            <Paperclip size={20} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowEmojiPicker(prev => !prev)} 
                                            className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl transition-all shadow-sm flex items-center justify-center shrink-0 ${showEmojiPicker ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                            title="Emojis & Stickers"
                                            aria-label="Emojis & Stickers"
                                        >
                                            <Smile size={20} />
                                        </button>
                                        <input 
                                            className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 text-sm font-medium focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                                            placeholder={uploadingAttachments ? "Uploading attachments..." : "Type a message..."}
                                            value={newMessage}
                                            onChange={e => setNewMessage(e.target.value)}
                                            disabled={uploadingAttachments}
                                        />
                                        <button type="submit" disabled={(!newMessage.trim() && pendingAttachments.length === 0) || isSending} className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 shadow-lg transition-all disabled:opacity-50 shrink-0">
                                            {isSending ? <RefreshCw className="animate-spin" size={20}/> : <Send size={20}/>}
                                        </button>
                                    </div>
                                    {selectedPartnerId === 'all' && user?.role === 'master_admin' && (
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-2 px-3 py-2 mt-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                                            <div className="flex items-center">
                                                <label htmlFor="broadcastTarget" className="text-[10px] uppercase tracking-[0.1em] font-extrabold text-slate-400 dark:text-slate-500 mr-3">Audience:</label>
                                                <select
                                                    id="broadcastTarget"
                                                    aria-label="Broadcast Audience Target"
                                                    value={broadcastTarget}
                                                    onChange={e => setBroadcastTarget(e.target.value as 'all' | 'all_admins' | 'all_sales')}
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
            )}

            {/* HIGH-PRIORITY OVERLAY MODAL (z-[200] TO BE ABOVE THE LEFT NAV BAR z-[100]) */}
            {isThreadModalOpen && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                                        Inbound Email Reader &amp; Reply
                                    </h3>
                                    <p className="text-xs text-slate-400 font-semibold">
                                        Full thread details &amp; outbound delivery
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsThreadModalOpen(false);
                                    setIsReplyAllMode(false);
                                }}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Scrollable Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
                            {(() => {
                                if (!selectedMail) return <div className="p-8 text-center text-slate-400">Email not found.</div>;

                                return (
                                    <div className="space-y-6">
                                        <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                                            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
                                                {selectedMail.subject || '(No Subject)'}
                                            </h2>
                                            <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 items-center">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">From: {selectedMail.senderName || selectedMail.from} ({selectedMail.from})</span>
                                                <span>&bull;</span>
                                                <span>To: {selectedMail.to}</span>
                                                {selectedMail.cc && (
                                                    <>
                                                        <span>&bull;</span>
                                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">CC: {selectedMail.cc}</span>
                                                    </>
                                                )}
                                                <span>&bull;</span>
                                                <span>{new Date(selectedMail.receivedAt).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {selectedMail.attachments && selectedMail.attachments.length > 0 && (
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block flex items-center gap-1.5">
                                                    <Paperclip size={14} className="text-indigo-500" />
                                                    Email Attachments ({selectedMail.attachments.length}):
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                    {selectedMail.attachments.map((att: any, idx: number) => {
                                                        const filename = att.filename || att.name || `Attachment_${idx + 1}`;
                                                        const isImg = (att.contentType || att.type || '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);
                                                        return (
                                                            <div key={idx} className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-xs space-y-2">
                                                                {isImg && att.url ? (
                                                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="block max-h-32 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800">
                                                                        <img src={att.url} alt={filename} className="w-full h-24 object-cover hover:scale-105 transition-transform" />
                                                                    </a>
                                                                ) : null}
                                                                <div className="flex items-center justify-between gap-2 px-1">
                                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={filename}>
                                                                        {filename}
                                                                    </span>
                                                                    <a
                                                                        href={att.url}
                                                                        download={filename}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[11px] font-bold rounded flex items-center gap-1 shrink-0"
                                                                    >
                                                                        <Download size={12} /> Download
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            {selectedMail.text || selectedMail.html?.replace(/<[^>]*>?/gm, '') || '(Empty Message Body)'}
                                        </div>

                                        {emailReplies && emailReplies.length > 0 && (
                                            <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Mail size={14} className="text-indigo-500" />
                                                    Sent Email Replies History ({emailReplies.length}):
                                                </h4>
                                                {emailReplies.map((reply: any) => (
                                                    <div key={reply.id} className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-2xl space-y-2">
                                                        <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 font-bold">
                                                            <span>From: {reply.senderName} ({reply.senderEmail})</span>
                                                            <span className="text-[10px] text-slate-400 font-normal">{new Date(reply.sentAt).toLocaleString()}</span>
                                                        </div>
                                                        {reply.cc && reply.cc.length > 0 && (
                                                            <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                                                                CC: {reply.cc.join(', ')}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                            {reply.content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Messages;
