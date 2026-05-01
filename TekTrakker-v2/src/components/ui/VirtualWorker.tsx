import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Image as ImageIcon, Loader2, Mic, MicOff, Volume2, VolumeX, PhoneCall, PhoneOff } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
    timestamp: Date;
}

const VirtualWorker: React.FC = () => {
    const { state } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [messageMsg, setMessageMsg] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init-msg',
            role: 'assistant',
            content: "Hi! I'm your AI Worker. Ready to automate some tasks? You can ask me to schedule a job, create a customer, or append notes to an existing account.",
            timestamp: new Date()
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);
    const [pendingImageMimeType, setPendingImageMimeType] = useState<string | null>(null);
    const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);

    const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isConversationalMode, setIsConversationalMode] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Refs for state access inside Speech callbacks (which are bound once on mount)
    const isTypingRef = useRef(isTyping);
    const messagesRef = useRef(messages);
    const isConversationalModeRef = useRef(isConversationalMode);
    const isVoiceEnabledRef = useRef(isVoiceEnabled);
    const isListeningRef = useRef(isListening);

    useEffect(() => {
        isTypingRef.current = isTyping;
        messagesRef.current = messages;
        isConversationalModeRef.current = isConversationalMode;
        isVoiceEnabledRef.current = isVoiceEnabled;
        isListeningRef.current = isListening;
    }, [isTyping, messages, isConversationalMode, isVoiceEnabled, isListening]);

    useEffect(() => {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            
            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                
                if (isConversationalModeRef.current) {
                    setMessageMsg(transcript);
                    submitDirectMessage(transcript, null, null, null);
                } else {
                    setMessageMsg(transcript);
                }
            };
            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech Recognition Error", event.error);
                setIsListening(false);
            };
            recognitionRef.current.onend = () => {
                if (isConversationalModeRef.current && !isTypingRef.current) {
                     // Automatically restart listening if in conversational mode and NOT typing
                     try {
                         recognitionRef.current.start();
                     } catch(e) {}
                } else {
                    setIsListening(false);
                }
            };
        }
    }, []);

    const toggleListening = (conversational: boolean = false) => {
        if (!recognitionRef.current) return alert('Speech recognition is not supported in this browser.');
        if (isListeningRef.current) {
            setIsConversationalMode(false);
            try { recognitionRef.current.stop(); } catch(e) {}
            setIsListening(false);
        } else {
            setIsConversationalMode(conversational);
            if (conversational) setIsVoiceEnabled(true); // Auto-enable text-to-speech for conversational mode
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.warn("Speech recognition already started");
                setIsListening(true);
            }
        }
    };

    const speakText = (text: string) => {
        if (!isVoiceEnabledRef.current || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        
        // Basic cleanup of markdown formatting for purely voice
        const cleanText = text.replace(/[*_~`]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Auto-resume microphone in conversational mode after AI finishes speaking
        utterance.onend = () => {
            if (isConversationalModeRef.current && recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                    setIsListening(true);
                } catch(e) {}
            }
        };

        window.speechSynthesis.speak(utterance);
    };
    const orgName = state.currentOrganization?.name || 'Your Company';
    const brandColor = state.currentOrganization?.primaryColor || '#2563eb';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            setPendingImagePreview(result);
            const base64 = result.split(',')[1];
            setPendingImageBase64(base64);
            setPendingImageMimeType(file.type);
        };
        reader.readAsDataURL(file);
    };

    const submitDirectMessage = async (
        text: string, 
        imgBase64Payload: string | null = pendingImageBase64, 
        imgMimePayload: string | null = pendingImageMimeType, 
        imgPreview: string | null = pendingImagePreview
    ) => {
        if (!text.trim() || isTypingRef.current) return;
        
        // Pause listening while processing
        if (isConversationalModeRef.current && recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch(e) {}
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            imageUrl: imgPreview || undefined,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setMessageMsg('');
        setPendingImageBase64(null);
        setPendingImageMimeType(null);
        setPendingImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsTyping(true);

        try {
            const functions = getFunctions();
            const agentAction = httpsCallable(functions, 'aiAgentController');
            const chatHistory = messagesRef.current
                .filter(m => m.id !== 'init-msg')
                .map(m => ({ 
                    role: m.role === 'assistant' ? 'model' : 'user', 
                    content: m.content 
                }));
            const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            const result = await agentAction({ 
                prompt: userMsg.content, 
                history: chatHistory,
                timeZone: userTimeZone,
                imagePayload: imgBase64Payload ? {
                    inlineData: {
                        data: imgBase64Payload,
                        mimeType: imgMimePayload
                    }
                } : null
            });
            const data = result.data as { reply: string, toolExecuted: string | null };
            
            const reply: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.reply || "Done!",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, reply]);
            
            if (isVoiceEnabledRef.current && data.reply) {
                // If it's conversational mode, speakText will automatically trigger recognition.start() inside its utterance.onend block
                speakText(data.reply);
            } else if (isConversationalModeRef.current && recognitionRef.current) {
                // Not speaking, but we need to resume listening
                try {
                    recognitionRef.current.start();
                    setIsListening(true);
                } catch(e) {}
            }
        } catch (error) {
            console.error("AI Communication Error", error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm experiencing a high volume of requests right now and my connection timed out. Could you please try sending that again?",
                timestamp: new Date()
            }]);
            if (isConversationalModeRef.current && recognitionRef.current) {
                try { recognitionRef.current.start(); setIsListening(true); } catch(e) {}
            }
        } finally {
            setIsTyping(false);
        }
    }

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        await submitDirectMessage(messageMsg);
    };

    if (!state.currentUser || !state.currentOrganization) {
        return null;
    }

    if (!state.currentOrganization.virtualWorkerEnabled) {
        return null;
    }

    // Optional: Hide if not an employee or admin. (Assume all users utilizing Layouts are eligible for now)

    return (
        <div className="fixed bottom-[120px] md:bottom-8 right-4 md:right-8 z-[100] flex flex-col items-end">
            <style>{`
                .brand-bg { background-color: ${brandColor} !important; }
                .brand-ring { --tw-ring-color: ${brandColor} !important; }
                .anim-delay-0 { animation-delay: 0ms !important; }
                .anim-delay-150 { animation-delay: 150ms !important; }
                .anim-delay-300 { animation-delay: 300ms !important; }
            `}</style>
            
            {/* The Chat Window */}
            {isOpen && (
                <div className="mb-4 w-full sm:w-[360px] md:w-[400px] h-[500px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 transition-all transform origin-bottom-right animate-in fade-in zoom-in duration-200">
                    
                    {/* Header */}
                    <div className="p-4 text-white flex justify-between items-center relative overflow-hidden brand-bg">
                        {/* Decorative background glow */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl pointer-events-none"></div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-inner">
                                <Bot size={22} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight tracking-tight shadow-sm">AI Worker</h3>
                                <p className="text-xs opacity-90 font-medium">{orgName} Automated Assistant</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-black/20 rounded-full transition-colors focus:outline-none relative z-10"
                            title="Close Window"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div 
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                                        msg.role === 'user' 
                                            ? 'text-white rounded-br-sm brand-bg' 
                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-sm'
                                    }`}
                                >
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    {msg.imageUrl && (
                                        <img src={msg.imageUrl} alt="Attached" className="mt-2 max-w-full h-auto rounded-lg shadow-sm border border-black/10" />
                                    )}
                                    <p className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-white/70' : 'text-slate-400'}`}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce anim-delay-0" />
                                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce anim-delay-150" />
                                    <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce anim-delay-300" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                        {pendingImagePreview && (
                            <div className="mb-2 relative inline-block">
                                <img src={pendingImagePreview} alt="Preview" className="h-16 w-auto rounded border border-slate-200 shadow-sm" />
                                <button title="Remove attached photo" onClick={() => {
                                    setPendingImagePreview(null); setPendingImageBase64(null); setPendingImageMimeType(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }} className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors shadow-sm"><X size={12}/></button>
                            </div>
                        )}
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full pr-1 pl-4 py-1 focus-within:ring-2 focus-within:ring-opacity-50 transition-all brand-ring">
                            <input
                                type="text"
                                value={messageMsg}
                                onChange={(e) => setMessageMsg(e.target.value)}
                                placeholder="Command your AI worker..."
                                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm py-2 dark:text-white"
                            />
                            <input type="file" title="Upload Image" aria-label="Upload Image File" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-primary-500 transition-colors" title="Attach Photo">
                                <ImageIcon size={18} />
                            </button>
                            <button type="button" onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2 transition-colors ${isVoiceEnabled ? 'text-green-500' : 'text-slate-400 hover:text-primary-500'}`} title={isVoiceEnabled ? "Voice Output Active" : "Enable Voice Output"}>
                                {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                            </button>
                            <button type="button" onClick={() => toggleListening(false)} className={`p-2 transition-colors ${isListening && !isConversationalMode ? 'text-blue-500 animate-pulse' : 'text-slate-400 hover:text-primary-500'}`} title={isListening && !isConversationalMode ? "Listening (Single Message)..." : "Dictate Single Message"}>
                                {isListening && !isConversationalMode ? <Mic size={18} /> : <MicOff size={18} />}
                            </button>
                            <button type="button" onClick={() => toggleListening(true)} className={`p-2 transition-colors ${isConversationalMode ? 'text-green-500 animate-pulse' : 'text-slate-400 hover:text-primary-500'}`} title={isConversationalMode ? "Hands-Free Conversation Active" : "Start Hands-Free Conversation"}>
                                {isConversationalMode ? <PhoneCall size={18} /> : <PhoneOff size={18} />}
                            </button>
                            <button 
                                type="submit" 
                                disabled={!messageMsg.trim() || isTyping}
                                className="p-2.5 text-white rounded-full transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center shadow-md cursor-pointer brand-bg"
                                title="Send Command"
                            >
                                {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Floating Action Button (FAB) relative wrapper to ensure icon animations look right */}
            <div className="relative">
                {/* Ping animation behind the button to draw attention optionally */}
                {!isOpen && (
                    <div className="absolute inset-0 rounded-full animate-ping opacity-20 brand-bg"></div>
                )}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 focus:outline-none group overflow-hidden relative brand-bg"
                    aria-label="Toggle AI Worker Chat"
                    title="Toggle AI Worker Chat"
                >
                    {/* Glassmorphism shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 transform -translate-x-full group-hover:animate-shimmer pointer-events-none"></div>
                    
                    <div className={`transition-transform duration-300 absolute ${isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}>
                        <Bot size={28} />
                    </div>
                    <div className={`transition-transform duration-300 absolute ${isOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`}>
                        <X size={28} />
                    </div>
                </button>
            </div>
            
        </div>
    );
};

export default VirtualWorker;
