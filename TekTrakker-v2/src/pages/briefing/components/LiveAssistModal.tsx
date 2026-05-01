import showToast from "lib/toast";

import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, PhoneCall, Loader2, Zap, Save } from 'lucide-react';
import { Job } from '../../../types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppContext } from '../../../context/AppContext';
import { db } from '../../../lib/firebase';
import { toast } from 'react-toastify';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface LiveAssistModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobContext?: string;
    job?: Job;
}

const LiveAssistModal: React.FC<LiveAssistModalProps> = ({ isOpen, onClose, jobContext, job }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hi, I\'m your assistant. How can I help?' }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    const { state } = useAppContext();
    const technicianName = state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}` : (job?.assignedTechnicianName || 'Technician');
    const context = jobContext || (job ? `Job for customer ${job.customerName}. Talking to technician: ${technicianName}. Unit: ${job.hvacBrand || 'Unknown'}` : `General diagnostics. Talking to technician: ${technicianName}`);

    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const saveTranscriptToJob = async () => {
        if (!job || !state.currentOrganization?.id || messages.length <= 1) return;
        try {
            const transcript = messages.map(m => `${m.role === 'assistant' ? 'AI' : technicianName}: ${m.content}`).join('\n');
            const newNote = {
                id: Date.now().toString(),
                text: `[AI Voice Assistant Log]\n\n${transcript}`,
                timestamp: new Date().toISOString(),
                authorName: state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}` : 'System'
            };
            
            const jobRef = db.collection('jobs').doc(job.id);
            const jobSnap = await jobRef.get();
            if (jobSnap.exists) {
                const jobData = jobSnap.data() as Job;
                const existingNotes = jobData.notes || [];
                await jobRef.update({
                    notes: [...existingNotes, newNote],
                    updatedAt: new Date().toISOString()
                });
                toast.success("Voice transcript saved to job notes!");
            }
        } catch (e) {
            console.error("Failed to save transcript:", e);
            toast.error("Failed to save transcript to job.");
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Handle AI Speech (TTS)
    const speakText = (text: string) => {
        if (!('speechSynthesis' in window)) return;
        
        window.speechSynthesis.cancel(); // Stop any current speech
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find a female voice
        const voices = window.speechSynthesis.getVoices();
        // Priorities: Natural/Premium voices -> Google US -> Fallback
        const premiumVoice = voices.find(v => 
            v.name.includes('Natural') || 
            v.name.includes('Premium') || 
            v.name.includes('Samantha') || 
            v.name.includes('Google US English')
        );
        
        if (premiumVoice) {
            utterance.voice = premiumVoice;
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
            // Pause microphone while the AI is talking to avoid echo
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { console.error(e); }
            }
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            // Resume listening if continuous mode is still toggled on
            if (isVoiceActive && recognitionRef.current) {
                try { recognitionRef.current.start(); } catch (e) { console.error(e); }
            }
        };
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    // Ensure voices are loaded (Chrome quirk)
    useEffect(() => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    }, []);

    const handleSend = async (textOverride?: string) => {
        const userMsg = textOverride || input.trim();
        if (!userMsg || isThinking) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsThinking(true);

        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            
            // Using gemini-3.1-pro-preview for master-level tech advice
            const result = await callGeminiAI({ 
                prompt: userMsg,
                modelName: "gemini-3.1-pro-preview",
                config: {
                    systemInstruction: `You are TekTrakker Voice Supervisor, a master field technician coach. Context: ${context}. Address the technician completely naturally by their name (${technicianName}). Your advice will be read aloud over a two-way radio to answers questions. You MUST act like a senior tech advisor. Be highly technical, but keep your responses EXTREMELY short and punchy (1-2 sentences maximum). Give direct instructions or troubleshooting steps without any fluff. E.g. "Check the secondary voltage. If it's zero, trace back to the transformer."`
                }
            });

            const data = result.data as { text: string };
            setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
            
            // Automatically speak the response
            speakText(data.text);

        } catch (error) {
            console.error("AI Assistant Error:", error);
            const errMsg = "Connection lost. Please try again.";
            setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
            speakText(errMsg);
        } finally {
            setIsThinking(false);
        }
    };

    // --- VOICE ENGINE LOGIC (STT) ---
    const toggleVoice = () => {
        if (isVoiceActive) {
            recognitionRef.current?.stop();
            setIsVoiceActive(false);
            return;
        }

        if (!('webkitSpeechRecognition' in window)) {
            showToast.warn("Voice recognition is not supported in this browser.");
            return;
        }

        // @ts-ignore
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsVoiceActive(true);
        recognition.onend = () => {
            // Keep it continuous unless explicitly toggled off
            if (isVoiceActive && !isSpeaking) {
                try { recognition.start(); } catch (e) { console.error(e); }
            }
        };
        
        recognition.onresult = (event: any) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            if (transcript) {
                handleSend(transcript);
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech error:", event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                setIsVoiceActive(false);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    // Cleanup speech and Auto-Save Temporary Audio Log on close
    useEffect(() => {
        return () => {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (recognitionRef.current) recognitionRef.current.stop();

            if (messagesRef.current.length > 2 && state.currentOrganization?.id) {
                const finalTranscript = messagesRef.current.map(m => `${m.role === 'assistant' ? 'AI' : technicianName}: ${m.content}`).join('\n');
                db.collection('organizations').doc(state.currentOrganization.id).collection('aiVoiceLogs').add({
                    jobId: job?.id || null,
                    jobName: job?.customerName || 'General Request',
                    technicianName: technicianName,
                    transcript: finalTranscript,
                    createdAt: new Date().toISOString()
                }).catch(e => console.error("Silent auto-save failed:", e));
            }
        };
    }, [state.currentOrganization?.id, job, technicianName]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Live AI Supervisor" size="lg">
            <div className="flex flex-col h-[75vh]">
                {/* Status Bar */}
                <div className="bg-indigo-600 p-4 rounded-xl mb-4 text-white shadow-lg flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full bg-white/20 flex items-center justify-center ${isVoiceActive ? 'animate-pulse bg-red-500/40' : ''}`}>
                        <Bot size={24}/>
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase opacity-70">Voice Engine Status</p>
                        <p className="text-sm font-bold truncate">
                            {isVoiceActive ? 'Listening for your question...' : isSpeaking ? 'AI Supervisor is speaking...' : 'Voice Mode Ready'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {job && messages.length > 1 && (
                            <button 
                                onClick={saveTranscriptToJob}
                                title="Save Transcript to Job Notes"
                                className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/20 hover:bg-white/30"
                            >
                                <Save size={20} />
                            </button>
                        )}
                         <button 
                            onClick={toggleVoice}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                isVoiceActive 
                                    ? 'bg-red-500 shadow-red-500/40 animate-bounce' 
                                    : 'bg-white/20 hover:bg-white/30'
                            }`}
                        >
                            {isVoiceActive ? <Mic size={24} /> : <MicOff size={24} />}
                        </button>
                    </div>
                </div>

                {/* Job Context Bubble */}
                <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg mb-4 flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                    <Zap size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Context: {context}</span>
                </div>

                {/* Messages List */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 px-1 mb-4 scroll-smooth custom-scrollbar">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium shadow-sm ${
                                msg.role === 'user' 
                                    ? 'bg-primary-600 text-white rounded-tr-none' 
                                    : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-tl-none text-slate-800 dark:text-slate-200'
                            }`}>
                                {msg.content}
                                {msg.role === 'assistant' && (
                                    <button 
                                        title="Speak Answer"
                                        onClick={() => speakText(msg.content)}
                                        className="block mt-2 text-indigo-500 hover:text-indigo-600 transition-colors"
                                    >
                                        <Volume2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {isThinking && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none flex gap-2 items-center">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                <span className="text-xs font-bold text-slate-400">AI Thinking...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Manual Input Footer */}
                <div className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <input 
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium placeholder-slate-400 px-3"
                        placeholder="Type a technical question or tap mic..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <Button 
                        onClick={() => handleSend()} 
                        disabled={!input.trim() || isThinking}
                        className="w-12 h-12 rounded-xl bg-indigo-600 shadow-indigo-500/20 shadow-lg p-0 flex items-center justify-center"
                    >
                        <Send size={20}/>
                    </Button>
                </div>
                
                <p className="text-[10px] text-center mt-3 text-slate-400 font-bold uppercase tracking-tighter">
                    Powered by TekTrakker Master Tech Engine
                </p>
            </div>
        </Modal>
    );
};

export default LiveAssistModal;
