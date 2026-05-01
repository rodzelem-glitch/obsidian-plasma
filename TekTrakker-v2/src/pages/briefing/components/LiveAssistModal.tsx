
import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, PhoneCall, Loader2, Zap } from 'lucide-react';
import { Job } from '../../../types';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
        { role: 'assistant', content: 'Master Tech Voice Engine active. How can I help you with this repair?' }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    const context = jobContext || (job ? `${job.tasks?.join(', ')} for ${job.customerName}. Unit: ${job.hvacBrand || 'Unknown'}` : 'General diagnostics');

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
        // Priorities: Google US English Female -> Microsoft Zira -> Any Female -> First available
        const femaleVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Zira') || v.name.includes('Female'));
        
        if (femaleVoice) {
            utterance.voice = femaleVoice;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
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
            
            // Using gemini-3-pro-preview for master-level tech advice
            const result = await callGeminiAI({ 
                prompt: userMsg,
                modelName: "gemini-3.1-pro-preview",
                config: {
                    systemInstruction: `You are TekTrakker Voice Supervisor, a master field technician coach. Context: ${context}. Your advice will be read aloud to a technician whose hands are busy. Be extremely technical but concise (max 2-3 sentences). Focus on safety and troubleshooting steps.`
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
            alert("Voice recognition is not supported in this browser.");
            return;
        }

        // @ts-ignore
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsVoiceActive(true);
        recognition.onend = () => setIsVoiceActive(false);
        
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                handleSend(transcript);
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech error:", event.error);
            setIsVoiceActive(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    // Cleanup speech on close
    useEffect(() => {
        return () => {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, []);

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
