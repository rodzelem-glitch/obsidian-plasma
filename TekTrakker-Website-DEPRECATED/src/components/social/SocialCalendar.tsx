import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import { Share2, Clock, CheckCircle, Trash2 } from 'lucide-react';
import { EventDropArg } from '@fullcalendar/core';
import { Draggable } from '@fullcalendar/interaction';

interface SocialCalendarProps {
    orgId: string | null;
    isMaster?: boolean;
    templates: any[];
    onDataChanged: () => void;
}

const SocialCalendar: React.FC<SocialCalendarProps> = ({ orgId, isMaster, templates, onDataChanged }) => {
    const [selectedEvent, setSelectedEvent] = useState<any>(null);

    React.useEffect(() => {
        let draggable: Draggable | null = null;
        const containerEl = document.getElementById('external-events');
        if (containerEl) {
            draggable = new Draggable(containerEl, {
                itemSelector: '.fc-event',
                eventData: (eventEl) => {
                    const dataStr = eventEl.getAttribute('data-event');
                    return dataStr ? JSON.parse(dataStr) : null;
                }
            });
        }
        return () => {
            if (draggable) draggable.destroy();
        };
    }, [templates]);

    // Convert templates to FullCalendar event objects
    const events = templates
        .filter(t => t.status === 'scheduled' && t.scheduledFor)
        .map(t => ({
            id: t.id,
            title: t.name || 'Untitled Drop',
            start: t.scheduledFor,
            extendedProps: { ...t }
        }));

    const updateEventDate = async (id: string, newIsoStr: string) => {
        try {
            if (isMaster) {
                await db.collection('masterSocialMediaTemplates').doc(id).update({
                    scheduledFor: newIsoStr,
                    status: 'scheduled'
                });
            } else if (orgId) {
                await db.collection('organizations').doc(orgId).collection('socialMediaTemplates').doc(id).update({
                    scheduledFor: newIsoStr,
                    status: 'scheduled'
                });
            }
            onDataChanged();
        } catch (error) {
            console.error("Failed to reschedule event:", error);
        }
    };

    const handleEventDrop = (info: EventDropArg) => {
        if (!info.event.start) {
            info.revert();
            return;
        }
        updateEventDate(info.event.id, info.event.start.toISOString());
    };

    const handleEventReceive = (info: any) => {
        // Handle dragging an external draft item onto the calendar
        if (!info.event.start) {
            info.revert();
            return;
        }
        updateEventDate(info.event.id, info.event.start.toISOString());
        
        // Remove from UI temporarily (calendar will rerender onDataChanged)
        info.event.remove();
    };

    const handleEventClick = (info: any) => {
        setSelectedEvent(info.event.extendedProps);
    };

    // Render draggable drafts
    const drafts = templates.filter(t => t.status !== 'scheduled' || !t.scheduledFor);

    return (
        <div className="flex flex-col xl:flex-row gap-6 mt-6">
            
            {/* Left Sidebar: Unscheduled Drafts */}
            <div className="w-full xl:w-1/4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sticky top-6">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Share2 size={18}/> Drafts 
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full">{drafts.length}</span>
                    </h3>
                    
                    <div id="external-events" className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                        <p className="text-xs text-slate-500 mb-3 italic">Drag a draft onto the calendar to schedule it.</p>
                        
                        {drafts.length === 0 ? (
                            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-400 text-sm">
                                No unscheduled drafts.
                            </div>
                        ) : drafts.map(draft => (
                            <div 
                                key={draft.id} 
                                className="fc-event bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 cursor-grab hover:border-indigo-400 transition-colors shadow-sm"
                                data-event={JSON.stringify({ id: draft.id, title: draft.name })}
                            >
                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{draft.name || 'Untitled Draft'}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{draft.baseContent}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Pane: Full Calendar */}
            <div className="w-full xl:w-3/4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm overflow-hidden">
                <style dangerouslySetInnerHTML={{__html: `
                    .fc .fc-toolbar-title { font-size: 1.25rem; font-weight: bold; }
                    .fc .fc-button-primary { background: #4f46e5 !important; border-color: #4f46e5 !important; }
                    .fc .fc-button-primary:not(:disabled):active, .fc .fc-button-primary:not(:disabled).fc-button-active { background: #4338ca !important; border-color: #4338ca !important; }
                    .fc-theme-standard td, .fc-theme-standard th { border-color: var(--tw-border-slate-200); }
                    .dark .fc-theme-standard td, .dark .fc-theme-standard th { border-color: #334155; }
                    .fc-event { padding: 2px 4px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; border: none !important; background: #818cf8 !important; }
                    .fc-col-header-cell-cushion { color: #475569; }
                    .dark .fc-col-header-cell-cushion { color: #cbd5e1; }
                    .fc-daygrid-day-number { color: #64748b; }
                    .dark .fc-daygrid-day-number { color: #94a3b8; }
                `}} />

                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek'
                    }}
                    events={events}
                    editable={true}
                    droppable={true}
                    eventDrop={handleEventDrop}
                    drop={handleEventReceive}
                    eventClick={handleEventClick}
                    height={700}
                />
            </div>

            {/* Event Details Modal */}
            {selectedEvent && (
                <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)} title="Scheduled Drop" size="md">
                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{selectedEvent.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-bold mb-4">
                                <Clock size={14}/> 
                                {new Date(selectedEvent.scheduledFor).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
                            </div>

                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedEvent.baseContent}</p>
                            
                            {selectedEvent.mediaUrl && (
                                <img src={selectedEvent.mediaUrl} alt="Attached Media" className="mt-4 rounded-lg border border-slate-200 max-h-48 object-cover w-full" />
                            )}
                        </div>

                        <div className="flex justify-between items-center mt-6">
                            <Button variant="danger" onClick={async () => {
                                // Unschedule it
                                if (isMaster) {
                                    await db.collection('masterSocialMediaTemplates').doc(selectedEvent.id).update({ status: 'draft', scheduledFor: null });
                                } else if (orgId) {
                                    await db.collection('organizations').doc(orgId).collection('socialMediaTemplates').doc(selectedEvent.id).update({ status: 'draft', scheduledFor: null });
                                }
                                onDataChanged();
                                setSelectedEvent(null);
                            }}>
                                <Trash2 size={16} className="mr-2"/> Revert to Draft
                            </Button>
                            
                            <Button onClick={() => setSelectedEvent(null)}>Done</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SocialCalendar;
