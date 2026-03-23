
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppContext } from '../context/AppContext';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const LandingChatbot: React.FC = () => {
    const { state } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hi there! I can answer questions about TekTrakker features, pricing, and how we help service businesses grow. What can I help you with?' }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // This is where we will store the training data once loaded
    const [trainingData, setTrainingData] = useState('');

    useEffect(() => {
        // In a real app, you might fetch this from a file or CDN. For this demo, we'll embed it.
        const adminData = `# TekTrakker AI Training Data - Admin Role...`; // Content from TRAINING_DATA_ADMIN.md
        const techData = `# TekTrakker AI Training Data - Technician Role...`; // Content from TRAINING_DATA_TECHNICIAN.md
        const customerData = `# TekTrakker AI Training Data - Customer Role...`; // Content from TRAINING_DATA_CUSTOMER.md
        setTrainingData(`${adminData}\n\n${techData}\n\n${customerData}`);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isThinking) return;
        
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsThinking(true);

        try {
            const functions = getFunctions();
            const chatbotFunction = httpsCallable(functions, 'callLandingChatbot');
            
            const plans = (state.platformSettings?.plans || {}) as any;
            const pricingContext = `
                Starter Plan: $${plans.starter?.monthly || 99}/mo. Includes ${plans.starter?.maxUsers || 3} users.
                Growth Plan: $${plans.growth?.monthly || 249}/mo. Includes ${plans.growth?.maxUsers || 10} users.
                Enterprise Plan: $${plans.enterprise?.monthly || 499}/mo. Includes ${plans.enterprise?.maxUsers || 20} users.
            `;

            const systemPrompt = `
                You are the TekTrakker AI Assistant. Your goal is to help potential customers understand our Field Service management software.
                
                **Core Values:** Efficiency, Transparency, Community building.
                **Target Audience:** HVAC, Plumbing, Electrical, and other trade professionals.
                
                **Pricing:**
                ${pricingContext}

                **FULL PLATFORM DOCUMENTATION FOR YOUR REFERENCE:**
                ---
                ${trainingData}
                ---
                
                Answer questions based on the documentation provided. Be helpful, concise, and encourage users to start a free trial.
            `;

            const result = await chatbotFunction({
                prompt: userMsg,
                systemInstruction: systemPrompt
            });

            const data = result.data as { text: string };
            setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);

        } catch (error) {
            console.error("Chatbot Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again." }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <>
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50"
                >
                    <MessageSquare size={28} />
                </button>
            )}

            {isOpen && (
                <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border flex flex-col z-50">
                    <div className="bg-indigo-600 p-4 rounded-t-2xl flex justify-between items-center text-white">
                        <div className="flex items-center gap-2"><Bot size={20} /><span className="font-bold">TekTrakker Assistant</span></div>
                        <button onClick={() => setIsOpen(false)}><X size={18}/></button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isThinking && <div className="flex justify-start"><div className="p-3 rounded-2xl bg-white dark:bg-slate-800"><Loader2 className="w-4 h-4 animate-spin"/></div></div>}
                    </div>

                    <div className="p-3 border-t bg-white dark:bg-slate-900 rounded-b-2xl">
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                placeholder="Type your question..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                            />
                            <button onClick={handleSend} disabled={!input.trim() || isThinking} className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center p-0 disabled:opacity-50">
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default LandingChatbot;
