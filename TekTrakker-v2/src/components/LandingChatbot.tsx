
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

    const [trainingData, setTrainingData] = useState('');

    useEffect(() => {
        const platformFeatures = `
        # PLATFORM FEATURES
        - **Enterprise Dispatch Board**: Interactive Multi-Day scheduling grid. Drag and drop jobs across days.
        - **B2B Contractor Marketplace**: Subcontract jobs seamlessly between partner organizations.
        - **Consumer Vault**: 100% Free portal for homeowners to track warranties, save receipts, view history, and pay bills.
        - **Free Homeowner Leads**: The Consumer Vault feeds FREE local leads directly back to service pros.
        - **AI-Powered Estimating**: Intelligent quoting for instant Good/Better/Best proposals on the field.
        - **Geofenced Time Tracking**: Automatic GPS logging of tech arrival/departure for perfect payroll.
        - **Shared Device Kiosk Mode**: Easily support non-user employees (like warehouse staff or apprentices) who don't need a full software license. They can securely punch in and out using a PIN code on a shared company device.
        - **Automated Pay Tracking**: Timesheets are generated instantly from Kiosk Mode punches or field technician GPS records, making running payroll flawless and automatic.
        - **Recurring Memberships**: Service companies can put clients on auto-pay for maintenance agreements.
        - **Vendor & 1099 Management**: Generate specific tax forms for your subcontractors directly within the Document Creator.
        
        # TROUBLESHOOTING & SUPPORT
        - **App Crashing / Blue Screen / Won't Load**: If a user reports that their app is stuck loading, throwing errors, or showing a blue/white screen, instruct them to 'Clear App Data and Cache' in their browser or mobile device settings. This forces the offline database (IndexedDB) to wipe corrupted data.
        `;
        setTrainingData(platformFeatures);
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
                
                **Formatting Rules (CRITICAL):**
                1. NEVER output large block-paragraphs or walls of text. 
                2. ALWAYS use bullet points (using - or *), numbered lists, and extremely short sentences.
                3. Use explicit line breaks between sections to make it highly readable.
                4. Keep responses highly structured and easy to skim on mobile devices.

                **Pricing:**
                ${pricingContext}

                **FULL PLATFORM DOCUMENTATION FOR YOUR REFERENCE:**
                ---
                ${trainingData}
                ---
                
                Answer questions based on the documentation provided. Be helpful, concise, strictly formatted, and encourage users to start a free trial.
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
                    className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 hover:bg-indigo-700 transition-colors"
                >
                    <span className="sr-only">Open support chat</span>
                    <MessageSquare size={28} aria-hidden="true" />
                </button>
            )}

            {isOpen && (
                <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-96 h-[500px] max-h-[calc(100vh-80px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border flex flex-col z-50">
                    <div className="bg-indigo-600 p-4 rounded-t-2xl flex justify-between items-center text-white">
                        <div className="flex items-center gap-2"><Bot size={20} /><span className="font-bold">TekTrakker Assistant</span></div>
                        <button onClick={() => setIsOpen(false)}><X size={18}/></button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 border border-slate-100 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white'}`}>
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
