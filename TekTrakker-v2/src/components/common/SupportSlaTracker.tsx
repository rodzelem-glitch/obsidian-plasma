import React, { useState, useEffect, useMemo } from 'react';
import { db } from 'lib/firebase';
import { 
    Clock, ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, 
    Filter, Mail, User 
} from 'lucide-react';
import showToast from 'lib/toast';
import type { SupportTicket } from 'types';

export const SupportSlaTracker: React.FC = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState<Date>(new Date());
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'approaching' | 'breached' | 'resolved'>('all');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    // Live 1-second clock ticker for SLA countdown timers
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Subscribe to supportTickets collection
    useEffect(() => {
        setLoading(true);
        const unsub = db.collection('supportTickets')
            .onSnapshot((snapshot) => {
                const fetched: SupportTicket[] = [];
                snapshot.forEach(doc => {
                    fetched.push({ id: doc.id, ...doc.data() } as SupportTicket);
                });
                // Sort by targetDueDate ascending (most urgent first)
                fetched.sort((a, b) => new Date(a.targetDueDate).getTime() - new Date(b.targetDueDate).getTime());
                setTickets(fetched);
                setLoading(false);
            }, (error) => {
                console.error("Error subscribing to supportTickets:", error);
                setLoading(false);
            });

        return () => unsub();
    }, []);

    // Helper to calculate SLA status & remaining time
    const getTicketSlaInfo = (ticket: SupportTicket) => {
        if (ticket.status === 'Resolved') {
            return {
                status: 'resolved' as const,
                label: 'Resolved',
                badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                remainingText: ticket.resolvedAt ? `Resolved on ${new Date(ticket.resolvedAt).toLocaleDateString()}` : 'Resolved',
                diffMs: 0
            };
        }

        const targetTime = new Date(ticket.targetDueDate).getTime();
        const diffMs = targetTime - now.getTime();
        const totalSlaMs = (ticket.slaHours || 24) * 3600 * 1000;

        if (diffMs <= 0) {
            const overdueMs = Math.abs(diffMs);
            const overdueMins = Math.floor(overdueMs / 60000);
            const overdueHours = Math.floor(overdueMins / 60);
            const remainingMins = overdueMins % 60;
            return {
                status: 'breached' as const,
                label: 'SLA Breached',
                badgeBg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 animate-pulse',
                remainingText: `Overdue by ${overdueHours > 0 ? `${overdueHours}h ` : ''}${remainingMins}m`,
                diffMs
            };
        }

        // Approaching breach if <= 25% of SLA window remains
        const isApproaching = diffMs <= (totalSlaMs * 0.25);
        
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        
        let remainingStr = '';
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            const remHours = hours % 24;
            remainingStr = `${days}d ${remHours}h ${mins}m left`;
        } else {
            remainingStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        if (isApproaching) {
            return {
                status: 'approaching' as const,
                label: 'Approaching SLA Breach',
                badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                remainingText: remainingStr,
                diffMs
            };
        }

        return {
            status: 'on_track' as const,
            label: 'On Track',
            badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            remainingText: remainingStr,
            diffMs
        };
    };

    // Filter tickets
    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            const info = getTicketSlaInfo(ticket);

            // Plan filter
            if (planFilter !== 'all' && ticket.plan !== planFilter) return false;

            // Status filter
            if (statusFilter === 'open' && ticket.status === 'Resolved') return false;
            if (statusFilter === 'approaching' && info.status !== 'approaching') return false;
            if (statusFilter === 'breached' && info.status !== 'breached') return false;
            if (statusFilter === 'resolved' && ticket.status !== 'Resolved') return false;

            return true;
        });
    }, [tickets, statusFilter, planFilter, now]);

    // Statistics counts
    const stats = useMemo(() => {
        let openCount = 0;
        let onTrackCount = 0;
        let approachingCount = 0;
        let breachedCount = 0;
        let resolvedCount = 0;

        tickets.forEach(t => {
            if (t.status === 'Resolved') {
                resolvedCount++;
            } else {
                openCount++;
                const info = getTicketSlaInfo(t);
                if (info.status === 'breached') breachedCount++;
                else if (info.status === 'approaching') approachingCount++;
                else onTrackCount++;
            }
        });

        return { openCount, onTrackCount, approachingCount, breachedCount, resolvedCount };
    }, [tickets, now]);

    const handleMarkResolved = async (ticketId: string) => {
        setResolvingId(ticketId);
        try {
            await db.collection('supportTickets').doc(ticketId).update({
                status: 'Resolved',
                resolvedAt: new Date().toISOString()
            });
            showToast.success("Support ticket marked as resolved!");
        } catch (error) {
            console.error("Failed to resolve ticket:", error);
            showToast.error("Could not update ticket status.");
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                        <Clock size={14} className="animate-spin" style={{ animationDuration: '6s' }} /> Support Guidelines & SLA Monitor
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Live Support Response Timers
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Real-time SLA guidelines tracking for Starter (3 Days), Growth (24 Hours), and Enterprise (1-2 Hours).
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                        🕒 {now.toLocaleTimeString()}
                    </span>
                </div>
            </div>

            {/* Metrics KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Tickets</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.openCount}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">On Track</p>
                        <ShieldCheck size={16} className="text-emerald-500" />
                    </div>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.onTrackCount}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/30">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Approaching SLA</p>
                        <AlertTriangle size={16} className="text-amber-500" />
                    </div>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.approachingCount}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-200 dark:border-red-800/30">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Breached SLA</p>
                        <ShieldAlert size={16} className="text-red-500" />
                    </div>
                    <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{stats.breachedCount}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resolved</p>
                        <CheckCircle2 size={16} className="text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">{stats.resolvedCount}</p>
                </div>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {(['all', 'open', 'approaching', 'breached', 'resolved'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setStatusFilter(tab)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all capitalize whitespace-nowrap ${
                                statusFilter === tab 
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            {tab === 'all' ? 'All Tickets' : tab}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400" />
                    <select 
                        value={planFilter} 
                        onChange={e => setPlanFilter(e.target.value)}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none"
                    >
                        <option value="all">All Subscription Plans</option>
                        <option value="enterprise">Enterprise (1-2 Hours)</option>
                        <option value="growth">Growth (24 Hours)</option>
                        <option value="starter">Starter (3 Days)</option>
                        <option value="payments_only">Payments Only</option>
                    </select>
                </div>
            </div>

            {/* Ticket Cards List */}
            {loading ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                    Loading live SLA tickets...
                </div>
            ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <ShieldCheck size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No support tickets match the selected filter.</p>
                    <p className="text-xs text-slate-400 mt-1">All support response times are within guidelines.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTickets.map(ticket => {
                        const slaInfo = getTicketSlaInfo(ticket);
                        const isResolved = ticket.status === 'Resolved';

                        return (
                            <div 
                                key={ticket.id} 
                                className={`p-5 rounded-2xl border transition-all ${
                                    slaInfo.status === 'breached' 
                                        ? 'bg-red-500/5 border-red-500/30 dark:bg-red-950/10' 
                                        : slaInfo.status === 'approaching'
                                        ? 'bg-amber-500/5 border-amber-500/30 dark:bg-amber-950/10'
                                        : isResolved
                                        ? 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800'
                                        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 shadow-sm'
                                }`}
                            >
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                                                {ticket.organizationName}
                                            </span>
                                            <span className="text-[10px] font-extrabold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                                                {ticket.plan} Plan
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                {ticket.slaLabel}
                                            </span>
                                        </div>

                                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                            {ticket.subject}
                                        </h4>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed max-w-3xl">
                                            {ticket.description}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-3">
                                            <span className="flex items-center gap-1">
                                                <User size={12} /> {ticket.customerName} ({ticket.customerEmail})
                                            </span>
                                            <span>
                                                Submitted: {new Date(ticket.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Timer & Actions Column */}
                                    <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                                        <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${slaInfo.badgeBg}`}>
                                            <Clock size={14} />
                                            <span>{slaInfo.remainingText}</span>
                                        </div>

                                        {!isResolved && (
                                            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                                <a 
                                                    href={`mailto:${ticket.customerEmail}?subject=Re: [TekTrakker Support] ${encodeURIComponent(ticket.subject)}`}
                                                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                                                >
                                                    <Mail size={13} /> Reply
                                                </a>
                                                <button
                                                    onClick={() => handleMarkResolved(ticket.id)}
                                                    disabled={resolvingId === ticket.id}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1"
                                                >
                                                    <CheckCircle2 size={13} /> Resolve
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SupportSlaTracker;
