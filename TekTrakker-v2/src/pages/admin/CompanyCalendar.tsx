import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { EventDropArg } from '@fullcalendar/core';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import Select from 'components/ui/Select';
import { 
    Calendar, Clock, MapPin, Users, Plus, Search, Filter, 
    Video, X, Trash2, Edit2, CalendarDays, CheckCircle, 
    Briefcase, AlertCircle, Sparkles, UserCheck, CheckSquare,
    Copy, Check
} from 'lucide-react';

interface CompanyEvent {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    type: 'meeting' | 'training' | 'social' | 'holiday' | 'other';
    startDate: string; // ISO String
    endDate: string; // ISO String
    location: string;
    isVirtual: boolean;
    virtualLink: string;
    attendees: string[]; // User IDs
    createdBy: string;
    createdAt: string;
}

const EVENT_TYPES = [
    { value: 'meeting', label: 'Meeting', color: '#4f46e5', bgClass: 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' },
    { value: 'training', label: 'Training', color: '#10b981', bgClass: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
    { value: 'social', label: 'Social Event', color: '#8b5cf6', bgClass: 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' },
    { value: 'holiday', label: 'Company Holiday', color: '#f59e0b', bgClass: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
    { value: 'other', label: 'Other', color: '#64748b', bgClass: 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
];

const CompanyCalendar: React.FC = () => {
    const { state } = useAppContext();
    const { t } = useLanguage();
    const { currentUser, currentOrganization, isDemoMode, users, jobs } = state;
    
    const orgId = currentOrganization?.id || currentUser?.organizationId || 'demo-org-1766848718439';
    
    // --- STATE MANAGEMENT ---
    const [events, setEvents] = useState<CompanyEvent[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['meeting', 'training', 'social', 'holiday', 'other']);
    const [showJobsOverlay, setShowJobsOverlay] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const isInitialLoad = useRef(true);
    
    // Modals
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CompanyEvent | null>(null);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'apple' | 'google' | 'outlook'>('apple');
    
    // Event Form
    const [eventForm, setEventForm] = useState<Partial<CompanyEvent>>({
        title: '',
        type: 'meeting',
        description: '',
        location: '',
        isVirtual: false,
        virtualLink: '',
        attendees: [],
        startDate: '',
        endDate: '',
    });

    const isPlatformAdmin = currentUser?.role === 'admin' || currentUser?.role === 'both' || currentUser?.role === 'master_admin';

    // Build the dynamic sync URL
    const syncUrl = `https://us-central1-tektrakker.cloudfunctions.net/userCalendarFeed?userId=${currentUser?.id || 'demo-user-id'}&orgId=${orgId}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(syncUrl);
        setCopied(true);
        showToast.success("Calendar subscription URL copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    // --- MOCK INITIAL DATA ---
    const getMockEvents = (): CompanyEvent[] => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 2);
        nextDay.setHours(14, 0, 0, 0);

        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 5);
        nextWeek.setHours(16, 30, 0, 0);

        return [
            {
                id: 'evt-mock-1',
                organizationId: orgId,
                title: 'Q2 All-Hands Company Sync',
                description: 'Quarterly review of platform performance, technician achievements, and summer strategy update.',
                type: 'meeting',
                startDate: tomorrow.toISOString(),
                endDate: new Date(tomorrow.getTime() + 90 * 60 * 1000).toISOString(), // 1.5 hrs
                location: 'Main Office Conference Room A',
                isVirtual: true,
                virtualLink: 'https://meet.google.com/abc-defg-hij',
                attendees: users.slice(0, 3).map(u => u.id),
                createdBy: currentUser?.id || 'demo-admin-id',
                createdAt: new Date().toISOString(),
            },
            {
                id: 'evt-mock-2',
                organizationId: orgId,
                title: 'OSHA & Ladder Safety Certification',
                description: 'Mandatory workforce training session covering commercial rooftop access and vehicle hazard staging.',
                type: 'training',
                startDate: nextDay.toISOString(),
                endDate: new Date(nextDay.getTime() + 120 * 60 * 1000).toISOString(), // 2 hrs
                location: 'Training Annex Workshop',
                isVirtual: false,
                virtualLink: '',
                attendees: users.filter(u => u.role === 'employee').map(u => u.id),
                createdBy: currentUser?.id || 'demo-admin-id',
                createdAt: new Date().toISOString(),
            },
            {
                id: 'evt-mock-3',
                organizationId: orgId,
                title: 'Memorial Day Weekend BBQ',
                description: 'Pre-holiday get together! Families welcome, catered lunch provided. Celebrate our amazing field teams!',
                type: 'social',
                startDate: nextWeek.toISOString(),
                endDate: new Date(nextWeek.getTime() + 180 * 60 * 1000).toISOString(), // 3 hrs
                location: 'Riverside Corporate Park - Pavillion B',
                isVirtual: false,
                virtualLink: '',
                attendees: users.map(u => u.id),
                createdBy: currentUser?.id || 'demo-admin-id',
                createdAt: new Date().toISOString(),
            },
            {
                id: 'evt-mock-4',
                organizationId: orgId,
                title: 'Independence Day Observance',
                description: 'Official corporate holiday. Emergency on-call dispatching schedules active.',
                type: 'holiday',
                startDate: '2026-07-04T00:00:00.000Z',
                endDate: '2026-07-04T23:59:59.000Z',
                location: 'All Office Locations Closed',
                isVirtual: false,
                virtualLink: '',
                attendees: [],
                createdBy: currentUser?.id || 'demo-admin-id',
                createdAt: new Date().toISOString(),
            }
        ];
    };

    // --- DB DATA SYNC ---
    useEffect(() => {
        isInitialLoad.current = true;
        setIsLoading(true);
        if (isDemoMode) {
            // Load from LocalStorage or pre-fill with Mock Events
            const localData = localStorage.getItem(`company_events_${orgId}`);
            if (localData) {
                try {
                    setEvents(JSON.parse(localData));
                } catch {
                    const mocks = getMockEvents();
                    setEvents(mocks);
                    localStorage.setItem(`company_events_${orgId}`, JSON.stringify(mocks));
                }
            } else {
                const mocks = getMockEvents();
                setEvents(mocks);
                localStorage.setItem(`company_events_${orgId}`, JSON.stringify(mocks));
            }
            setIsLoading(false);
        } else {
            // Wait for real organization details if not in demo mode
            if (!currentOrganization?.id && !currentUser?.organizationId) {
                setIsLoading(true);
                return;
            }

            // Firestore Sync
            const unsub = db.collection('events')
                .where('organizationId', '==', orgId)
                .onSnapshot(snapshot => {
                    const loadedEvents: CompanyEvent[] = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as CompanyEvent));
                    
                    if (loadedEvents.length === 0 && isInitialLoad.current) {
                        isInitialLoad.current = false;
                        // Prefill Firestore with mocks for first-time use
                        const mocks = getMockEvents();
                        mocks.forEach(async (m) => {
                            const { id, ...data } = m;
                            await db.collection('events').doc(id).set(cleanUndefinedFields(data)).catch(() => {});
                        });
                        setEvents(mocks);
                    } else {
                        isInitialLoad.current = false;
                        setEvents(loadedEvents);
                    }
                    setIsLoading(false);
                }, error => {
                    console.error("Firestore events subscription error:", error);
                    isInitialLoad.current = false;
                    // Local fallback on error
                    const localData = localStorage.getItem(`company_events_${orgId}`);
                    setEvents(localData ? JSON.parse(localData) : getMockEvents());
                    setIsLoading(false);
                });
                
            return () => unsub();
        }
    }, [orgId, isDemoMode, currentOrganization?.id, currentUser?.organizationId]);

    // Save Helper
    const saveEventsToStorage = (updatedEvents: CompanyEvent[]) => {
        setEvents(updatedEvents);
        if (isDemoMode) {
            localStorage.setItem(`company_events_${orgId}`, JSON.stringify(updatedEvents));
        }
    };

    // --- FILTERED COMPUTATIONS ---
    const filteredEvents = useMemo(() => {
        return events.filter(evt => {
            const matchesType = selectedTypes.includes(evt.type);
            const matchesSearch = searchQuery === '' || 
                evt.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                evt.location.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [events, selectedTypes, searchQuery]);

    // Format Calendar Items
    const calendarEvents = useMemo(() => {
        const list: any[] = filteredEvents.map(evt => {
            const typeConfig = EVENT_TYPES.find(t => t.value === evt.type);
            return {
                id: evt.id,
                title: evt.title,
                start: evt.startDate,
                end: evt.endDate,
                color: typeConfig?.color || '#64748b',
                extendedProps: {
                    type: 'company_event',
                    eventData: evt
                }
            };
        });

        // Overlay technician jobs if toggled
        if (showJobsOverlay) {
            jobs.forEach(job => {
                if (job.appointmentTime) {
                    const startStr = job.appointmentTime;
                    // Job durations average 2 hours
                    const end = new Date(new Date(startStr).getTime() + 120 * 60 * 1000).toISOString();
                    
                    list.push({
                        id: `job-overlay-${job.id}`,
                        title: `🔧 Job: ${job.customerName || 'Service Ticket'} (${job.assignedTechnicianName || 'Unassigned'})`,
                        start: startStr,
                        end: end,
                        color: '#0ea5e9', // Sky blue for jobs
                        extendedProps: {
                            type: 'field_job',
                            jobData: job
                        }
                    });
                }
            });
        }

        return list;
    }, [filteredEvents, showJobsOverlay, jobs]);

    // Get upcoming events list
    const upcomingEvents = useMemo(() => {
        const now = new Date().getTime();
        return events
            .filter(evt => new Date(evt.startDate).getTime() > now)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .slice(0, 5);
    }, [events]);

    // --- HANDLERS ---
    const handleEventClick = (info: any) => {
        const { type, eventData, jobData } = info.event.extendedProps;
        if (type === 'company_event') {
            setSelectedEvent(eventData);
            setIsDetailsModalOpen(true);
        } else if (type === 'field_job') {
            showToast.info(`Field ticket for ${jobData.customerName} on ${new Date(jobData.appointmentTime).toLocaleDateString()}`);
        }
    };

    const handleEventDrop = async (info: EventDropArg) => {
        const { type, eventData } = info.event.extendedProps;
        if (type !== 'company_event') {
            info.revert();
            return;
        }

        const newStart = info.event.start;
        const newEnd = info.event.end || new Date(newStart!.getTime() + 60 * 60 * 1000); // 1hr default if missing

        const updatedEvent: CompanyEvent = {
            ...eventData,
            startDate: newStart!.toISOString(),
            endDate: newEnd.toISOString()
        };

        try {
            if (isDemoMode) {
                const newEventsList = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
                saveEventsToStorage(newEventsList);
            } else {
                const { id, ...data } = updatedEvent;
                await db.collection('events').doc(id).update(cleanUndefinedFields(data));
            }
            showToast.success(`Rescheduled: "${updatedEvent.title}"`);
        } catch (e) {
            console.error(e);
            showToast.error("Failed to update event slot.");
            info.revert();
        }
    };

    const handleDateSelect = (selectInfo: any) => {
        if (!isPlatformAdmin) return;
        
        // Open modal with prefilled dates
        const startIso = selectInfo.startStr.includes('T') 
            ? selectInfo.startStr 
            : `${selectInfo.startStr}T09:00:00`;
            
        const endIso = selectInfo.endStr.includes('T') 
            ? selectInfo.endStr 
            : `${selectInfo.startStr}T10:00:00`;

        setEventForm({
            title: '',
            type: 'meeting',
            description: '',
            location: '',
            isVirtual: false,
            virtualLink: '',
            attendees: [],
            startDate: startIso.slice(0, 16),
            endDate: endIso.slice(0, 16),
        });
        setSelectedEvent(null);
        setIsEventModalOpen(true);
    };

    const handleCreateNewClick = () => {
        const now = new Date();
        const start = new Date(now.getTime() + 60 * 60 * 1000);
        start.setMinutes(0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        setEventForm({
            title: '',
            type: 'meeting',
            description: '',
            location: '',
            isVirtual: false,
            virtualLink: '',
            attendees: [],
            startDate: new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            endDate: new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        });
        setSelectedEvent(null);
        setIsEventModalOpen(true);
    };

    const handleEditClick = (evt: CompanyEvent) => {
        setEventForm({
            ...evt,
            startDate: evt.startDate.slice(0, 16),
            endDate: evt.endDate.slice(0, 16)
        });
        setIsDetailsModalOpen(false);
        setIsEventModalOpen(true);
    };

    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventForm.title || !eventForm.startDate || !eventForm.endDate) {
            showToast.warn("Please complete all required fields.");
            return;
        }

        const startIso = new Date(eventForm.startDate).toISOString();
        const endIso = new Date(eventForm.endDate).toISOString();

        if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
            showToast.error("End date/time must be after the start date/time.");
            return;
        }

        const targetId = selectedEvent?.id || `evt-${Date.now()}`;
        const newEvent: CompanyEvent = {
            id: targetId,
            organizationId: orgId,
            title: eventForm.title,
            type: eventForm.type as CompanyEvent['type'],
            description: eventForm.description || '',
            location: eventForm.location || '',
            isVirtual: !!eventForm.isVirtual,
            virtualLink: eventForm.isVirtual ? (eventForm.virtualLink || '') : '',
            attendees: eventForm.attendees || [],
            startDate: startIso,
            endDate: endIso,
            createdBy: selectedEvent?.createdBy || currentUser?.id || 'admin-id',
            createdAt: selectedEvent?.createdAt || new Date().toISOString()
        };

        try {
            if (isDemoMode) {
                const alreadyExists = events.some(e => e.id === targetId);
                const newList = alreadyExists 
                    ? events.map(e => e.id === targetId ? newEvent : e) 
                    : [...events, newEvent];
                saveEventsToStorage(newList);
            } else {
                const { id, ...data } = newEvent;
                await db.collection('events').doc(id).set(cleanUndefinedFields(data), { merge: true });
            }
            showToast.success(selectedEvent ? "Event updated successfully!" : "Corporate event scheduled!");
            setIsEventModalOpen(false);
        } catch (err) {
            console.error(err);
            showToast.error("Error saving corporate event.");
        }
    };

    const handleDeleteClick = async (evt: CompanyEvent) => {
        if (!window.confirm(`Are you sure you want to cancel the scheduled event "${evt.title}"?`)) return;
        
        try {
            if (isDemoMode) {
                const newList = events.filter(e => e.id !== evt.id);
                saveEventsToStorage(newList);
            } else {
                await db.collection('events').doc(evt.id).delete();
            }
            showToast.success("Corporate event cancelled.");
            setIsDetailsModalOpen(false);
            setIsEventModalOpen(false);
        } catch (err) {
            console.error(err);
            showToast.error("Error removing event.");
        }
    };

    const toggleTypeSelection = (type: string) => {
        setSelectedTypes(prev => 
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Submenu Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50">
                    <p className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">{t("Scheduled Meetings")}</p>
                    <div className="mt-2 flex justify-between items-baseline">
                        <p className="text-3xl font-black text-indigo-900 dark:text-indigo-200">
                            {events.filter(e => e.type === 'meeting').length}
                        </p>
                        <span className="text-[10px] text-indigo-500 font-bold bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full">{t("Core")}</span>
                    </div>
                </Card>
                <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50">
                    <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{t("Workforce Trainings")}</p>
                    <div className="mt-2 flex justify-between items-baseline">
                        <p className="text-3xl font-black text-emerald-900 dark:text-emerald-200">
                            {events.filter(e => e.type === 'training').length}
                        </p>
                        <span className="text-[10px] text-emerald-500 font-bold bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">{t("Safety")}</span>
                    </div>
                </Card>
                <Card className="bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/50">
                    <p className="text-xs font-extrabold text-purple-700 dark:text-purple-400 uppercase tracking-wider">{t("Social Events")}</p>
                    <div className="mt-2 flex justify-between items-baseline">
                        <p className="text-3xl font-black text-purple-900 dark:text-purple-200">
                            {events.filter(e => e.type === 'social').length}
                        </p>
                        <span className="text-[10px] text-purple-500 font-bold bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">{t("Culture")}</span>
                    </div>
                </Card>
                <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50">
                    <p className="text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider">{t("Company Holidays")}</p>
                    <div className="mt-2 flex justify-between items-baseline">
                        <p className="text-3xl font-black text-amber-900 dark:text-amber-200">
                            {events.filter(e => e.type === 'holiday').length}
                        </p>
                        <span className="text-[10px] text-amber-500 font-bold bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">{t("Annual")}</span>
                    </div>
                </Card>
            </div>

            {/* Split Screen Calendar Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Left Control Sidebar */}
                <div className="w-full lg:w-1/4 space-y-6">
                    
                    {/* Action Card */}
                    {isPlatformAdmin && (
                        <button 
                            onClick={handleCreateNewClick}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-sm font-black transition-all shadow-md active:scale-95 cursor-pointer border-none"
                        >
                            <Plus size={18} /> {t("Schedule Company Event")}
                        </button>
                    )}

                    <button 
                        onClick={() => setIsSyncModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-sm font-black transition-all shadow-md active:scale-95 cursor-pointer border-none mt-2"
                    >
                        <Sparkles size={18} /> {t("Sync Calendar to Phone")}
                    </button>

                    {/* Filter Panel */}
                    <Card className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
                        <h3 className="font-extrabold text-slate-800 dark:text-white mb-4 flex items-center gap-2 text-sm tracking-wide uppercase">
                            <Filter size={16} className="text-indigo-500" /> {t("Filters & Overlay")}
                        </h3>
                        
                        {/* Search */}
                        <div className="relative mb-5">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input 
                                type="text"
                                placeholder={t("Search events...")}
                                className="pl-9 pr-3 py-2 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Event Types Toggles */}
                        <div className="space-y-2.5 mb-6">
                            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">{t("Event Types")}</p>
                            {EVENT_TYPES.map(type => {
                                const isChecked = selectedTypes.includes(type.value);
                                return (
                                    <label key={type.value} className="flex items-center gap-2.5 cursor-pointer select-none">
                                        <input 
                                            type="checkbox"
                                            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                            checked={isChecked}
                                            onChange={() => toggleTypeSelection(type.value)}
                                        />
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: type.color }} />
                                            {t(type.label)}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>

                        <hr className="border-slate-200 dark:border-slate-700/80 mb-5" />

                        {/* Dispatch Overlay Toggle */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">{t("Show Field Tickets")}</p>
                                    <p className="text-[10px] text-slate-400">{t("Display technician dispatch logs")}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={showJobsOverlay}
                                        onChange={() => setShowJobsOverlay(!showJobsOverlay)}
                                    />
                                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            {showJobsOverlay && (
                                <div className="bg-sky-50 border border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30 rounded-xl p-3 text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                                    {t("💡 Light-blue bars indicate technician job assignments, assisting corporate booking slots.")}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Upcoming Events Card */}
                    <Card className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm hidden lg:block">
                        <h3 className="font-extrabold text-slate-800 dark:text-white mb-4 flex items-center gap-2 text-sm tracking-wide uppercase">
                            <CalendarDays size={16} className="text-indigo-500" /> {t("Upcoming Events")}
                        </h3>
                        {upcomingEvents.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center p-4">{t("No future corporate events planned.")}</p>
                        ) : (
                            <div className="space-y-4">
                                {upcomingEvents.map(evt => {
                                    const typeConfig = EVENT_TYPES.find(t => t.value === evt.type);
                                    return (
                                        <div 
                                            key={evt.id} 
                                            onClick={() => { setSelectedEvent(evt); setIsDetailsModalOpen(true); }}
                                            className="group p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 justify-between">
                                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${typeConfig?.bgClass || ''}`}>
                                                    {t(typeConfig?.label || '')}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {new Date(evt.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mt-2 truncate group-hover:text-indigo-500 transition-colors">
                                                {evt.title}
                                            </h4>
                                            <p className="text-[10px] text-slate-400 truncate mt-1 flex items-center gap-1">
                                                <MapPin size={10} /> {evt.location || (evt.isVirtual ? t("Virtual Room") : 'TBD')}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                </div>

                {/* Right Calendar Panel */}
                <div className="w-full lg:w-3/4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-sm overflow-hidden relative">
                    
                    {/* FullCalendar Custom Theme Overrides */}
                    <style dangerouslySetInnerHTML={{__html: `
                        .fc .fc-toolbar-title { font-size: 1.15rem; font-weight: 900; color: #1e293b; letter-spacing: -0.025em; }
                        .dark .fc .fc-toolbar-title { color: #f8fafc; }
                        .fc .fc-button-primary { background: #4f46e5 !important; border-color: #4f46e5 !important; font-weight: 800; font-size: 0.8rem; border-radius: 10px; padding: 6px 12px; }
                        .fc .fc-button-primary:hover { background: #4338ca !important; border-color: #4338ca !important; }
                        .fc .fc-button-primary:disabled { background: #94a3b8 !important; border-color: #94a3b8 !important; opacity: 0.5; }
                        .fc .fc-button-primary:not(:disabled):active, .fc .fc-button-primary:not(:disabled).fc-button-active { background: #3730a3 !important; border-color: #3730a3 !important; }
                        .fc-theme-standard td, .fc-theme-standard th { border-color: #e2e8f0; }
                        .dark .fc-theme-standard td, .dark .fc-theme-standard th { border-color: #334155; }
                        .fc-theme-standard .fc-scrollgrid { border-color: #cbd5e1; border-radius: 16px; overflow: hidden; }
                        .dark .fc-theme-standard .fc-scrollgrid { border-color: #475569; }
                        .fc-event { border-radius: 8px; font-weight: 700; border: none !important; box-shadow: 0 2px 4px rgba(0,0,0,0.04); font-size: 0.72rem; padding: 2.5px 5px; cursor: pointer; transition: transform 0.15s ease; }
                        .fc-event:hover { transform: scale(1.02); filter: brightness(0.95); }
                        .fc-col-header-cell-cushion { color: #64748b; font-weight: 700; font-size: 0.8rem; padding: 8px 4px; }
                        .dark .fc-col-header-cell-cushion { color: #94a3b8; }
                        .fc-daygrid-day-number { color: #475569; font-weight: 600; font-size: 0.78rem; padding: 6px; }
                        .dark .fc-daygrid-day-number { color: #cbd5e1; }
                        .fc-daygrid-day.fc-day-today { background: rgba(99, 102, 241, 0.06) !important; }
                        .dark .fc-daygrid-day.fc-day-today { background: rgba(99, 102, 241, 0.15) !important; }
                        .fc-timegrid-slot-label-cushion { font-weight: 600; font-size: 0.72rem; color: #64748b; }
                        .dark .fc-timegrid-slot-label-cushion { color: #94a3b8; }
                    `}} />

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-[550px] space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                            <p className="text-xs text-slate-400 font-bold">Synchronizing company bookings...</p>
                        </div>
                    ) : (
                        <FullCalendar
                            plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
                            initialView="dayGridMonth"
                            headerToolbar={{
                                left: 'prev,next today',
                                center: 'title',
                                right: 'dayGridMonth,timeGridWeek,timeGridDay'
                            }}
                            events={calendarEvents}
                            editable={isPlatformAdmin}
                            selectable={isPlatformAdmin}
                            selectMirror={true}
                            dayMaxEvents={3}
                            eventClick={handleEventClick}
                            eventDrop={handleEventDrop}
                            select={handleDateSelect}
                            height={620}
                        />
                    )}
                </div>

            </div>

            {/* --- DETAILED VIEW MODAL --- */}
            {isDetailsModalOpen && selectedEvent && (
                <Modal 
                    isOpen={isDetailsModalOpen} 
                    onClose={() => setIsDetailsModalOpen(false)} 
                    title={t("Company Event Details")}
                    size="md"
                >
                    <div className="space-y-5">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                            
                            {/* Title & Badge */}
                            <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
                                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white leading-tight">
                                    {selectedEvent.title}
                                </h3>
                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                    EVENT_TYPES.find(t => t.value === selectedEvent.type)?.bgClass
                                }`}>
                                    {t(EVENT_TYPES.find(t => t.value === selectedEvent.type)?.label || '')}
                                </span>
                            </div>

                            {/* Time details */}
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-4">
                                <Clock size={14} /> 
                                <span>
                                    {new Date(selectedEvent.startDate).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                                </span>
                                <span className="text-slate-400 font-medium">{t("to")}</span>
                                <span>
                                    {new Date(selectedEvent.endDate).toLocaleTimeString(undefined, { timeStyle: 'short' })}
                                </span>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-4">
                                {selectedEvent.description || t("No description provided.")}
                            </p>

                            <hr className="border-slate-200 dark:border-slate-800 my-4" />

                            {/* Logistics info */}
                            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-slate-400 shrink-0" />
                                    <span><strong>{t("Location:")}</strong> {selectedEvent.location || t("Not Specified")}</span>
                                </div>

                                {selectedEvent.isVirtual && (
                                    <div className="flex items-center gap-2">
                                        <Video size={14} className="text-emerald-500 shrink-0" />
                                        <span>
                                            <strong>{t("Google Meet:")}</strong>{' '}
                                            <a 
                                                href={selectedEvent.virtualLink} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline"
                                            >
                                                {t("Join virtual conference")}
                                            </a>
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-start gap-2 pt-2">
                                    <Users size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                    <div className="space-y-1">
                                        <strong>{t("Invited Attendees")} ({selectedEvent.attendees.length}):</strong>
                                        {selectedEvent.attendees.length === 0 ? (
                                            <p className="text-[10px] text-slate-400 italic mt-0.5">{t("Open attendance (all staff)")}</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {selectedEvent.attendees.map(uid => {
                                                    const u = users.find(e => e.id === uid);
                                                    return u ? (
                                                        <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                            <UserCheck size={10} className="text-slate-400" />
                                                            {u.firstName || u.email || ''} {(u.lastName || '')[0] || ''}.
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
                            {isPlatformAdmin ? (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleDeleteClick(selectedEvent)}
                                        className="px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-950/20 rounded-xl hover:bg-red-100 transition-all border-none cursor-pointer"
                                    >
                                        {t("Cancel Event")}
                                    </button>
                                    <button 
                                        onClick={() => handleEditClick(selectedEvent)}
                                        className="px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl hover:bg-indigo-100 transition-all border-none cursor-pointer flex items-center gap-1"
                                    >
                                        <Edit2 size={12} /> {t("Edit Details")}
                                    </button>
                                </div>
                            ) : (
                                <div />
                            )}
                            <Button onClick={() => setIsDetailsModalOpen(false)}>{t("Done")}</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* --- CREATE / EDIT FORM MODAL --- */}
            {isEventModalOpen && (
                <Modal 
                    isOpen={isEventModalOpen} 
                    onClose={() => setIsEventModalOpen(false)} 
                    title={selectedEvent ? t("Modify Corporate Event") : t("Schedule Corporate Event")}
                    size="md"
                >
                    <form onSubmit={handleSaveEvent} className="space-y-4">
                        
                        {/* Event Title */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                {t("Event Title *")}
                            </label>
                            <input 
                                type="text"
                                required
                                placeholder={t("e.g. Mandatory Safety Review")}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                value={eventForm.title}
                                onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                            />
                        </div>

                        {/* Grid Type & Attendees */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Type */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                    {t("Event Type")}
                                </label>
                                <Select 
                                    value={eventForm.type || 'meeting'}
                                    onChange={e => setEventForm({ ...eventForm, type: e.target.value as CompanyEvent['type'] })}
                                    className="w-full mb-0 rounded-xl"
                                >
                                    {EVENT_TYPES.map(tOption => (
                                        <option key={tOption.value} value={tOption.value}>{t(tOption.label)}</option>
                                    ))}
                                </Select>
                            </div>

                            {/* Attendees */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                    {t("Required Attendees")}
                                </label>
                                <Select 
                                    multiple
                                    value={eventForm.attendees || []}
                                    onChange={e => {
                                        const options = e.target.options;
                                        const values: string[] = [];
                                        for (let i = 0; i < options.length; i++) {
                                            if (options[i].selected) {
                                                values.push(options[i].value);
                                            }
                                        }
                                        setEventForm({ ...eventForm, attendees: values });
                                    }}
                                    className="w-full mb-0 rounded-xl h-24 text-xs font-medium"
                                >
                                    {users.filter(u => u.role !== 'customer').map(u => (
                                        <option key={u.id} value={u.id}>
                                            👤 {u.firstName} {u.lastName} ({u.role ? t(u.role.replace('_', ' ')) : t('Staff')})
                                        </option>
                                    ))}
                                </Select>
                                <p className="text-[10px] text-slate-400 mt-1">{t("Hold Ctrl (Windows) / Cmd (Mac) to select multiple.")}</p>
                            </div>

                        </div>

                        {/* Dates grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Start */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                    {t("Start Date & Time *")}
                                </label>
                                <input 
                                    type="datetime-local"
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={eventForm.startDate}
                                    onChange={e => setEventForm({ ...eventForm, startDate: e.target.value })}
                                />
                            </div>

                            {/* End */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                    {t("End Date & Time *")}
                                </label>
                                <input 
                                    type="datetime-local"
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={eventForm.endDate}
                                    onChange={e => setEventForm({ ...eventForm, endDate: e.target.value })}
                                />
                            </div>

                        </div>

                        {/* Location / Logistics */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                {t("Event Location / Room")}
                            </label>
                            <input 
                                type="text"
                                placeholder={t("e.g. Conference Room A, HQ Annex, or Outdoor Park")}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                value={eventForm.location}
                                onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                            />
                        </div>

                        {/* Virtual Toggle */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox"
                                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    checked={eventForm.isVirtual || false}
                                    onChange={e => setEventForm({ ...eventForm, isVirtual: e.target.checked })}
                                />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <Video size={15} className="text-indigo-500" /> {t("Virtual Conference Option (Google Meet, Zoom, etc.)")}
                                </span>
                            </label>
                            
                            {eventForm.isVirtual && (
                                <div className="mt-3">
                                    <input 
                                        type="url"
                                        placeholder="https://meet.google.com/xyz-123"
                                        required={eventForm.isVirtual}
                                        className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        value={eventForm.virtualLink || ''}
                                        onChange={e => setEventForm({ ...eventForm, virtualLink: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                                {t("Event Details & Description")}
                            </label>
                            <textarea 
                                rows={3}
                                placeholder={t("Describe the topics, agenda, or prerequisites...")}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                value={eventForm.description}
                                onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                            />
                        </div>

                        {/* Footer Controls */}
                        <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800 mt-4">
                            {selectedEvent ? (
                                <button 
                                    type="button" 
                                    onClick={() => handleDeleteClick(selectedEvent)}
                                    className="px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-950/20 rounded-xl hover:bg-red-100 transition-all border-none cursor-pointer flex items-center gap-1"
                                >
                                    <Trash2 size={13} /> {t("Cancel Event")}
                                </button>
                            ) : (
                                <div />
                            )}
                            
                            <div className="flex gap-2">
                                <Button type="button" variant="secondary" onClick={() => setIsEventModalOpen(false)}>
                                    {t("Discard")}
                                </Button>
                                <Button type="submit" variant="primary">
                                    {selectedEvent ? t("Save Changes") : t("Publish Event")}
                                </Button>
                            </div>
                        </div>

                    </form>
                </Modal>
            )}

            {/* Sync Calendar to Phone Modal */}
            <Modal
                isOpen={isSyncModalOpen}
                onClose={() => setIsSyncModalOpen(false)}
                title={t("Sync Calendar to Your Phone")}
            >
                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-4">
                        <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-300">
                                {t("Dynamic iCalendar Subscription Feed")}
                            </h4>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400/90 mt-1 leading-relaxed">
                                {t("Subscribe once, and your personal phone or computer calendar will automatically stay synced in real-time with all of your assigned jobs and company events.")}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            {t("Your Private Subscription URL")}
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <input
                                    type="text"
                                    readOnly
                                    value={syncUrl}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono py-3 px-4 rounded-xl pr-10 focus:outline-none"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-extrabold text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase select-none">
                                    {t("Private")}
                                </span>
                            </div>
                            <button
                                onClick={handleCopyLink}
                                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black transition-all cursor-pointer border-none shadow-sm active:scale-95 ${
                                    copied
                                        ? "bg-emerald-600 text-white"
                                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                                }`}
                            >
                                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                                {copied ? t("Copied") : t("Copy")}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal">
                            {t("⚠️ Keep this link secure. Anyone with access to this link can view your calendar feed.")}
                        </p>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="border-b border-slate-200 dark:border-slate-800 flex gap-2">
                        <button
                            onClick={() => setActiveTab('apple')}
                            className={`pb-3 text-xs font-black px-2 relative transition-all border-none bg-transparent cursor-pointer ${
                                activeTab === 'apple'
                                    ? "text-indigo-600 dark:text-indigo-400"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                            }`}
                        >
                            {t("Apple (iPhone / Mac)")}
                            {activeTab === 'apple' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('google')}
                            className={`pb-3 text-xs font-black px-2 relative transition-all border-none bg-transparent cursor-pointer ${
                                activeTab === 'google'
                                    ? "text-indigo-600 dark:text-indigo-400"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                            }`}
                        >
                            {t("Google Calendar")}
                            {activeTab === 'google' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('outlook')}
                            className={`pb-3 text-xs font-black px-2 relative transition-all border-none bg-transparent cursor-pointer ${
                                activeTab === 'outlook'
                                    ? "text-indigo-600 dark:text-indigo-400"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                            }`}
                        >
                            {t("Outlook")}
                            {activeTab === 'outlook' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                            )}
                        </button>
                    </div>

                    {/* Tab Instructions Content */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl min-h-[160px] flex flex-col justify-center">
                        {activeTab === 'apple' && (
                            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                                <p className="font-extrabold text-slate-800 dark:text-slate-200">
                                    {t("To subscribe on your iPhone or iPad:")}
                                </p>
                                <ol className="list-decimal pl-5 space-y-2">
                                    <li>{t("Copy the private subscription URL shown above.")}</li>
                                    <li>{t("Open the ")}<strong>{t("Settings")}</strong>{t(" app on your iOS device.")}</li>
                                    <li>{t("Scroll down and select ")}<strong>{t("Calendar")}</strong>{t(" (or select ")}<strong>{t("Apps > Calendar")}</strong>{t(" depending on iOS version).")}</li>
                                    <li>{t("Tap ")}<strong>{t("Calendar Accounts")}</strong>{t(" (or ")}<strong>{t("Accounts")}</strong>{t("), then tap ")}<strong>{t("Add Account")}</strong>{t(".")}</li>
                                    <li>{t("Select ")}<strong>{t("Other")}</strong>{t(" at the bottom of the list.")}</li>
                                    <li>{t("Tap ")}<strong>{t("Add Subscribed Calendar")}</strong>{t(".")}</li>
                                    <li>{t("Paste the copied link into the ")}<strong>{t("Server")}</strong>{t(" input box and tap ")}<strong>{t("Next")}</strong>{t(".")}</li>
                                    <li>{t("Verify settings, turn off credentials requirement, and tap ")}<strong>{t("Save")}</strong>{t(" in the top right.")}</li>
                                </ol>
                                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                                    <p className="font-extrabold text-slate-800 dark:text-slate-200">
                                        {t("To subscribe on a Mac:")}
                                    </p>
                                    <ol className="list-decimal pl-5 mt-2 space-y-2">
                                        <li>{t("Open the Calendar app on your Mac.")}</li>
                                        <li>{t("Select ")}<strong>{t("File")}</strong>{t(" > ")}<strong>{t("New Calendar Subscription...")}</strong>{t(" from the menu bar.")}</li>
                                        <li>{t("Paste the copied URL, then click ")}<strong>{t("Subscribe")}</strong>{t(".")}</li>
                                        <li>{t("Choose a friendly name (e.g. 'TekTrakker'), and set the Auto-refresh rate to ")}<strong>{t("Every hour")}</strong>{t(" for the best experience.")}</li>
                                    </ol>
                                </div>
                            </div>
                        )}

                        {activeTab === 'google' && (
                            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                                <p className="font-extrabold text-slate-800 dark:text-slate-200">
                                    {t("To subscribe using Google Calendar (Web & Android):")}
                                </p>
                                <ol className="list-decimal pl-5 space-y-2">
                                    <li>{t("Copy the private subscription URL shown above.")}</li>
                                    <li>{t("Open ")}<a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-extrabold underline">{t("Google Calendar")}</a>{t(" in your desktop browser.")}</li>
                                    <li>{t("In the left-hand column, find the ")}<strong>{t("Other calendars")}</strong>{t(" section.")}</li>
                                    <li>{t("Click the ")}<strong>{t("+")}</strong>{t(" (Add) button next to Other calendars, and select ")}<strong>{t("From URL")}</strong>{t(".")}</li>
                                    <li>{t("Paste the copied link into the URL input field.")}</li>
                                    <li>{t("Click ")}<strong>{t("Add calendar")}</strong>{t(". The calendar will appear under 'Other calendars'.")}</li>
                                    <li>{t("Android devices will automatically sync this calendar under your Google Account settings.")}</li>
                                </ol>
                            </div>
                        )}

                        {activeTab === 'outlook' && (
                            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                                <p className="font-extrabold text-slate-800 dark:text-slate-200">
                                    {t("To subscribe using Outlook / Office 365:")}
                                </p>
                                <ol className="list-decimal pl-5 space-y-2">
                                    <li>{t("Copy the private subscription URL shown above.")}</li>
                                    <li>{t("Log into your mail account at ")}<a href="https://outlook.live.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-extrabold underline">{t("Outlook.com")}</a>{t(" or your company Outlook Web App.")}</li>
                                    <li>{t("Switch to the ")}<strong>{t("Calendar")}</strong>{t(" view using the sidebar navigation.")}</li>
                                    <li>{t("Click ")}<strong>{t("Add Calendar")}</strong>{t(" (located in the left calendar list panel).")}</li>
                                    <li>{t("Select ")}<strong>{t("Subscribe from Web")}</strong>{t(" from the menu options.")}</li>
                                    <li>{t("Paste the copied link in the URL box.")}</li>
                                    <li>{t("Enter a friendly name (e.g. 'TekTrakker Schedule'), pick a color / icon, and click ")}<strong>{t("Import")}</strong>{t(".")}</li>
                                </ol>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-850">
                        <Button
                            onClick={() => setIsSyncModalOpen(false)}
                            className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-850 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors border-none text-xs font-extrabold cursor-pointer"
                        >
                            {t("Close")}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CompanyCalendar;
