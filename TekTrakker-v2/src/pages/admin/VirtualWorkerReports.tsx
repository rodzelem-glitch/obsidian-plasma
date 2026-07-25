import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { 
    Bot, Clock, CheckCircle, AlertCircle, FileText, Download, Activity, 
    ArrowLeft, Share2, Trash2, Send, Mail, MessageSquare, Search
} from 'lucide-react';
import { showToast } from '../../lib/toast';
import { globalConfirm } from '../../lib/globalConfirm';

interface AiTask {
  id: string;
  prompt: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  progress: number;
  queuedAt: string;
  completedAt?: string;
  resultMarkdown?: string;
  error?: string;
}

const VirtualWorkerReports: React.FC = () => {
  const { state } = useAppContext();
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AiTask | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareType, setShareType] = useState<'messaging' | 'email'>('messaging');
  const [searchMember, setSearchMember] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const reportContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = state.currentUser;
    if (!user || !user.organizationId) return;

    const unsub = db.collection('organizations')
      .doc(user.organizationId)
      .collection('aiLongTasks')
      .orderBy('queuedAt', 'desc')
      .onSnapshot((snap) => {
        const loadedTasks = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AiTask[];
        setTasks(loadedTasks);
        
        // Handle deep linking via reportId query param
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const reportId = params.get('reportId');
        if (reportId && !selectedTask) {
            const found = loadedTasks.find(t => t.id === reportId);
            if (found) setSelectedTask(found);
        }

        // If a task is currently selected, update it
        if (selectedTask) {
            const updated = loadedTasks.find(t => t.id === selectedTask.id);
            if (updated) setSelectedTask(updated);
        }
        
        setLoading(false);
      }, (err) => {
        console.error("Failed to fetch long tasks", err);
        setLoading(false);
      });

    return () => unsub();
  }, [state.currentUser, selectedTask]);

  const handleDelete = async (task: AiTask) => {
    if (!await globalConfirm("Are you sure you want to delete this report? This action cannot be undone.")) return;
    
    try {
        const user = state.currentUser;
        if (!user || !user.organizationId) return;

        await db.collection('organizations')
            .doc(user.organizationId)
            .collection('aiLongTasks')
            .doc(task.id)
            .delete();
            
        showToast.success("Report deleted successfully.");
        if (selectedTask?.id === task.id) setSelectedTask(null);
    } catch (err) {
        console.error("Delete failed", err);
        showToast.error("Failed to delete report.");
    }
  };

  const handleShareEmail = async () => {
    if (!shareEmail.trim()) {
        showToast.warn("Please enter an email address.");
        return;
    }
    // Mocking email sending
    showToast.success(`Report shared with ${shareEmail}`);
    setShareEmail('');
    setIsShareModalOpen(false);
  };

  const handleShareMessaging = async (targetUserId: string, targetName: string) => {
    if (!selectedTask || !state.currentUser || !state.currentOrganization) return;

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const msg = {
        id: msgId,
        organizationId: state.currentOrganization.id,
        senderId: state.currentUser.id,
        senderName: `${state.currentUser.firstName} ${state.currentUser.lastName}`,
        receiverId: targetUserId,
        content: `I've generated an AI report for: "${selectedTask.prompt}". You can view it here: #REPORT-${selectedTask.id}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        read: false,
        type: 'text',
        deliveryStatus: 'sent'
    };

    try {
        await db.collection('messages').doc(msgId).set(cleanUndefinedFields(msg));
        showToast.success(`Report shared with ${targetName}`);
        setIsShareModalOpen(false);
    } catch (err) {
        console.error("Messaging share failed", err);
        showToast.error("Failed to share in messaging.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading your AI reports...</div>;
  }

  const handleDownload = async (task: AiTask) => {
    if (!task.resultMarkdown || !reportContentRef.current) return;
    setIsDownloading(true);
    try {
      // @ts-ignore - html2pdf has no types available right now
      const html2pdf = (await import('html2pdf.js')).default;
      
      const element = reportContentRef.current;
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Clean up clone styles for PDF generation (making sure it's printable light mode)
      clone.style.boxShadow = 'none';
      clone.style.margin = '0';
      clone.style.padding = '32px';
      clone.style.width = '790px'; // standard Letter width
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.backgroundColor = '#ffffff';
      clone.style.color = '#0b0f19';
      
      // Force light mode
      clone.classList.remove('dark', 'dark:prose-invert');
      clone.classList.add('prose-slate');
      
      // Clean up dark mode specific text colors and bg classes from all nested elements
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el: any) => {
        // Remove tailwind dark classes
        el.classList.forEach((className: string) => {
          if (className.startsWith('dark:')) {
            el.classList.remove(className);
          }
        });
        
        // Remove generic text-white / text-slate-100 etc. that would make text invisible on white background
        if (el.classList.contains('text-white') || el.classList.contains('text-slate-100') || el.classList.contains('text-slate-200')) {
          el.classList.remove('text-white', 'text-slate-100', 'text-slate-200');
          el.style.color = '#0b0f19';
        }
        
        // Adjust background colors to be printable
        if (el.classList.contains('bg-slate-900') || el.classList.contains('bg-slate-800') || el.classList.contains('bg-slate-950') || el.classList.contains('bg-indigo-950')) {
          el.classList.remove('bg-slate-900', 'bg-slate-800', 'bg-slate-950', 'bg-indigo-950');
          el.style.backgroundColor = '#f8fafc';
          el.style.color = '#0b0f19';
        }
        
        // Ensure tables and borders look good
        if (el.tagName === 'TABLE' || el.tagName === 'TH' || el.tagName === 'TD') {
          el.style.borderColor = '#cbd5e1';
          el.style.color = '#0b0f19';
        }
      });
      
      // Temporarily append clone to body to compute styles
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '-9999px';
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);
      
      const cleanPrompt = task.prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date(task.queuedAt).toISOString().split('T')[0];
      const fileName = `AI_Report_${cleanPrompt}_${dateStr}.pdf`;
      
      const opt: any = {
        margin:       [0.4, 0.4, 0.4, 0.4], // 0.4in margins
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 790, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      const pdfDataUri = await html2pdf().from(clone).set(opt).output('datauristring');
      const { downloadFile } = await import('../../lib/downloadHelper');
      await downloadFile(pdfDataUri, fileName);
      
      document.body.removeChild(wrapper);
      showToast.success("PDF report downloaded successfully.");
    } catch (err) {
      console.error("Failed to generate/download PDF:", err);
      showToast.error("Failed to download PDF report.");
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredMembers = state.users.filter(u => 
    u.id !== state.currentUser?.id && 
    u.status !== 'archived' &&
    (u.firstName + ' ' + u.lastName).toLowerCase().includes(searchMember.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bot className="text-indigo-500" />
            Virtual Worker Reports
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            View long-form research, historical analytics, and generated records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task List */}
        <div className={`lg:col-span-1 space-y-4 ${selectedTask ? 'hidden lg:block' : 'block'}`}>
            {tasks.length === 0 ? (
                <Card className="text-center py-12">
                    <Bot size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">No Reports Yet</h3>
                    <p className="text-sm text-slate-500 mt-2">Ask the Virtual Worker to research your history or generate a complex report to get started.</p>
                </Card>
            ) : (
                <div className="space-y-3 h-[calc(100vh-200px)] overflow-y-auto pr-2 pb-8 custom-scrollbar">
                    {tasks.map(task => (
                        <div 
                            key={task.id}
                            className={`group relative text-left w-full p-4 rounded-xl border transition-all ${selectedTask?.id === task.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300'}`}
                        >
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setIsShareModalOpen(true); }}
                                    className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:text-indigo-600 shadow-sm transition-colors"
                                    title="Share Report"
                                >
                                    <Share2 size={14} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(task); }}
                                    className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:text-red-600 shadow-sm transition-colors"
                                    title="Delete Report"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            
                            <button type="button" className="text-left w-full cursor-pointer appearance-none" onClick={() => setSelectedTask(task)}>
                                <div className="flex justify-between items-start mb-2 pr-12">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {new Date(task.queuedAt).toLocaleDateString()} {new Date(task.queuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2 leading-snug flex-1">
                                        {task.prompt}
                                    </h4>
                                    <div>
                                        {task.status === 'Pending' && <span className="flex items-center text-[10px] font-black uppercase text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded"><Clock size={10} className="mr-1"/></span>}
                                        {task.status === 'Processing' && <span className="flex items-center text-[10px] font-black uppercase text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded animate-pulse"><Activity size={10} className="mr-1"/></span>}
                                        {task.status === 'Completed' && <span className="flex items-center text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded"><CheckCircle size={10} className="mr-1"/></span>}
                                        {task.status === 'Failed' && <span className="flex items-center text-[10px] font-black uppercase text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded"><AlertCircle size={10} className="mr-1"/></span>}
                                    </div>
                                </div>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Report Viewer */}
        <div className={`lg:col-span-2 ${selectedTask ? 'block' : 'hidden lg:block'}`}>
            {selectedTask ? (
                <Card className="h-full min-h-[500px] flex flex-col p-0 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:justify-between items-start border-b border-slate-100 dark:border-slate-700 p-6 gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="flex-1">
                            <button 
                                onClick={() => setSelectedTask(null)} 
                                className="lg:hidden flex items-center text-sm text-indigo-500 hover:text-indigo-600 mb-2 font-bold uppercase tracking-wider"
                            >
                                <ArrowLeft size={16} className="mr-1" /> Back to Reports
                            </button>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Report Details</h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">"{selectedTask.prompt}"</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {selectedTask.status === 'Completed' && (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => setIsShareModalOpen(true)} className="rounded-lg shadow-sm border-slate-200">
                                        <Share2 size={16} className="mr-2" /> Share
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleDownload(selectedTask)} 
                                        disabled={isDownloading}
                                        className="rounded-lg shadow-sm border-slate-200"
                                    >
                                        <Download size={16} className="mr-2" /> 
                                        {isDownloading ? 'Generating PDF...' : 'Download PDF'}
                                    </Button>
                                </>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleDelete(selectedTask)} className="rounded-lg shadow-sm border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300">
                                <Trash2 size={16} className="mr-2" /> Delete
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900 custom-scrollbar">
                        {selectedTask.status === 'Pending' && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 py-20">
                                <Clock size={64} className="animate-pulse text-slate-300" />
                                <p className="font-bold text-lg">Task is queued for processing...</p>
                            </div>
                        )}
                        
                        {selectedTask.status === 'Processing' && (
                            <div className="flex flex-col items-center justify-center h-full text-indigo-400 space-y-4 py-20">
                                <Activity size={64} className="animate-spin text-indigo-300" />
                                <p className="font-bold text-lg">Virtual Worker is researching ({selectedTask.progress}%)...</p>
                                <div className="w-64 bg-slate-100 dark:bg-slate-800 rounded-full h-3 mt-4 overflow-hidden border border-slate-200 dark:border-slate-700">
                                    {(() => {
                                        const progressStyle = { width: `${selectedTask.progress}%` };
                                        return <div className="bg-indigo-500 h-full transition-all duration-500" style={progressStyle}></div>;
                                    })()}
                                </div>
                            </div>
                        )}

                        {selectedTask.status === 'Failed' && (
                            <div className="flex flex-col items-center justify-center h-full text-red-400 space-y-4 py-20">
                                <AlertCircle size={64} className="text-red-300" />
                                <h3 className="text-xl font-bold">Report Generation Failed</h3>
                                <p className="text-sm text-slate-500 max-w-md text-center bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">{selectedTask.error}</p>
                            </div>
                        )}

                        {selectedTask.status === 'Completed' && selectedTask.resultMarkdown && (
                            <div ref={reportContentRef} className="prose prose-slate prose-indigo dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                    {selectedTask.resultMarkdown}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </Card>
            ) : (
                <div className="h-full min-h-[500px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center text-slate-400 bg-slate-50/30">
                    <div className="text-center max-w-sm">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                            <FileText size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">Select a Report</h3>
                        <p className="text-sm text-slate-400 mt-2">Click on a report from the list on the left to view the detailed research and findings.</p>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Share Modal */}
      <Modal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        title="Share AI Report"
        size="md"
      >
        <div className="space-y-6 pt-4">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button 
                    onClick={() => setShareType('messaging')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${shareType === 'messaging' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <MessageSquare size={18} /> Team Chat
                </button>
                <button 
                    onClick={() => setShareType('email')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${shareType === 'email' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Mail size={18} /> External Email
                </button>
            </div>

            {shareType === 'messaging' ? (
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input 
                            placeholder="Search team members..." 
                            value={searchMember}
                            onChange={(e) => setSearchMember(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                        <button 
                            onClick={() => handleShareMessaging('all', 'Broadcast')}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">#</div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Broadcast Channel</p>
                                <p className="text-xs text-slate-500">Share with the entire organization</p>
                            </div>
                            <Send size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                        </button>
                        {filteredMembers.map(member => (
                            <button 
                                key={member.id}
                                onClick={() => handleShareMessaging(member.id, `${member.firstName} ${member.lastName}`)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
                                    {member.firstName?.charAt(0) || ''}{member.lastName?.charAt(0) || ''}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{member.firstName} {member.lastName}</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{member.role}</p>
                                </div>
                                <Send size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Send this report as a formatted markdown attachment or link to an external contact.</p>
                    <div className="space-y-2">
                        <label htmlFor="shareEmailInput" className="text-xs font-black uppercase tracking-widest text-slate-400">Recipient Email</label>
                        <Input 
                            id="shareEmailInput"
                            type="email" 
                            placeholder="e.g. partner@example.com" 
                            value={shareEmail}
                            onChange={(e) => setShareEmail(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleShareEmail} className="w-full h-12 rounded-xl">
                        <Send size={18} className="mr-2" /> Send Email Invitation
                    </Button>
                </div>
            )}
        </div>
      </Modal>
    </div>
  );
};

export default VirtualWorkerReports;
