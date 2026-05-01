import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Bot, Clock, CheckCircle, AlertCircle, FileText, Download, Activity } from 'lucide-react';

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
  }, [state.currentUser]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading your AI reports...</div>;
  }

  const handleDownload = (task: AiTask) => {
    if (!task.resultMarkdown) return;
    const blob = new Blob([task.resultMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Report_${new Date(task.queuedAt).getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
        <div className="lg:col-span-1 space-y-4">
            {tasks.length === 0 ? (
                <Card className="text-center py-12">
                    <Bot size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">No Reports Yet</h3>
                    <p className="text-sm text-slate-500 mt-2">Ask the Virtual Worker to research your history or generate a complex report to get started.</p>
                </Card>
            ) : (
                <div className="space-y-3 h-[calc(100vh-200px)] overflow-y-auto pr-2 pb-8">
                    {tasks.map(task => (
                        <div 
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTask?.id === task.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-medium text-slate-500">
                                    {new Date(task.queuedAt).toLocaleDateString()} {new Date(task.queuedAt).toLocaleTimeString()}
                                </span>
                                {task.status === 'Pending' && <span className="flex items-center text-xs font-bold text-amber-500"><Clock size={12} className="mr-1"/> Queued</span>}
                                {task.status === 'Processing' && <span className="flex items-center text-xs font-bold text-blue-500 animate-pulse"><Activity size={12} className="mr-1"/> {task.progress}%</span>}
                                {task.status === 'Completed' && <span className="flex items-center text-xs font-bold text-emerald-500"><CheckCircle size={12} className="mr-1"/> Ready</span>}
                                {task.status === 'Failed' && <span className="flex items-center text-xs font-bold text-red-500"><AlertCircle size={12} className="mr-1"/> Failed</span>}
                            </div>
                            <h4 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2">
                                {task.prompt}
                            </h4>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Report Viewer */}
        <div className="lg:col-span-2">
            {selectedTask ? (
                <Card className="h-full min-h-[500px] flex flex-col">
                    <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Report Details</h2>
                            <p className="text-sm text-slate-500 italic mt-1">"{selectedTask.prompt}"</p>
                        </div>
                        {selectedTask.status === 'Completed' && (
                            <Button variant="outline" size="sm" onClick={() => handleDownload(selectedTask)}>
                                <Download size={16} className="mr-2" /> Download .md
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {selectedTask.status === 'Pending' && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 py-20">
                                <Clock size={48} className="animate-pulse" />
                                <p>Task is queued for processing...</p>
                            </div>
                        )}
                        
                        {selectedTask.status === 'Processing' && (
                            <div className="flex flex-col items-center justify-center h-full text-indigo-400 space-y-4 py-20">
                                <Bot size={48} className="animate-bounce" />
                                <p>Virtual Worker is actively researching ({selectedTask.progress}%)...</p>
                                <div className="w-64 bg-slate-100 dark:bg-slate-700 rounded-full h-2 mt-4" title={`Progress: ${selectedTask.progress}%`}>
                                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" {...{ style: { width: `${selectedTask.progress}%` } as React.CSSProperties }}></div>
                                </div>
                            </div>
                        )}

                        {selectedTask.status === 'Failed' && (
                            <div className="flex flex-col items-center justify-center h-full text-red-400 space-y-4 py-20">
                                <AlertCircle size={48} />
                                <p>Task Failed</p>
                                <p className="text-sm text-slate-500 max-w-md text-center">{selectedTask.error}</p>
                            </div>
                        )}

                        {selectedTask.status === 'Completed' && selectedTask.resultMarkdown && (
                            <div className="prose prose-sm md:prose-base prose-indigo dark:prose-invert max-w-none">
                                {/* Simple text render for now, ideally use ReactMarkdown */}
                                <div className="whitespace-pre-wrap font-sans">
                                    {selectedTask.resultMarkdown}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            ) : (
                <div className="h-full min-h-[500px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400">
                    <div className="text-center">
                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Select a report to view details</p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default VirtualWorkerReports;
