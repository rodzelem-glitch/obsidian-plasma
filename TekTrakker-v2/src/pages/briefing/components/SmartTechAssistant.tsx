
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, Maximize, Minimize, Image as ImageIcon } from 'lucide-react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import { db, storage } from 'lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAppContext } from 'context/AppContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface SmartTechAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    initialPrompt?: string;
    jobId?: string;
    organizationId?: string;
}

interface Message {
    id: string;
    text?: string;
    imageUrl?: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

const SmartTechAssistant: React.FC<SmartTechAssistantProps> = ({ isOpen, onClose, initialPrompt, jobId, organizationId }) => {
    const { state } = useAppContext();
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (state.isDemoMode || !jobId || !organizationId) {
            setMessages([]);
            return;
        }

        const q = query(
            collection(db, `organizations/${organizationId}/jobs/${jobId}/ai_messages`),
            orderBy('timestamp'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages: Message[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    text: data.text,
                    imageUrl: data.imageUrl,
                    sender: data.sender,
                    timestamp: data.timestamp.toDate(),
                };
            });
            setMessages(fetchedMessages);
        }, (err) => {
            console.error("Firestore Snapshot Error:", err);
            setError("Could not load chat history. Check permissions or network.");
        });

        return () => unsubscribe();
    }, [jobId, organizationId, state.isDemoMode]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if ((!prompt.trim() && !imageFile) || isLoading) return;

        const userMessageText = prompt.trim();
        const userMessage: Message = {
            id: Date.now().toString(),
            text: userMessageText,
            imageUrl: imagePreview || undefined,
            sender: 'user',
            timestamp: new Date(),
        };

        setIsLoading(true);
        setError(null);
        setMessages(prev => [...prev, userMessage]);
        setPrompt('');
        setImageFile(null);
        setImagePreview(null);

        if (state.isDemoMode) {
            setTimeout(() => {
                const aiMessage: Message = {
                    id: Date.now().toString() + '-ai',
                    text: `This is a simulated AI response to: "${userMessageText}". In a real environment, this would be a contextual answer based on job data and service history.`,
                    sender: 'ai',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, aiMessage]);
                setIsLoading(false);
            }, 1200);
            return;
        }

        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');

            let imagePayload = null;
            let downloadUrl: string | undefined = undefined;

            if (imageFile) {
                const storageRef = ref(storage, `ai_chats/${organizationId}/${jobId}/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(storageRef, imageFile);
                downloadUrl = await getDownloadURL(snapshot.ref);

                const base64Image = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageFile);
                });
                imagePayload = { data: base64Image, mimeType: imageFile.type };
            }
            
            if (jobId && organizationId) {
                const messageData: any = {
                    text: userMessage.text,
                    sender: userMessage.sender,
                    timestamp: userMessage.timestamp,
                };
                if (downloadUrl) {
                    messageData.imageUrl = downloadUrl;
                }
                await addDoc(collection(db, `organizations/${organizationId}/jobs/${jobId}/ai_messages`), messageData);
            }

            const result = await callGeminiAI({
                prompt: userMessage.text || "Analyze this image.",
                modelName: "gemini-3-pro-image-preview",
                image: imagePayload
            });

            const data = result.data as { text: string };
            const aiText = data.text;

            if (jobId && organizationId) {
                await addDoc(collection(db, `organizations/${organizationId}/jobs/${jobId}/ai_messages`), {
                    text: aiText,
                    sender: 'ai',
                    timestamp: new Date(),
                });
            }

        } catch (error: any) {
            console.error("Error sending message to AI:", error);
            setError("An error occurred. Please try again.");
             setPrompt(userMessageText);
             setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        } finally {
            setIsLoading(false);
        }
    };
    
     const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const { primaryColor } = state.currentOrganization || { primaryColor: '#2563eb' };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Smart Tech Assistant" size={isMaximized ? "full" : "md"}>
            <div className={`flex flex-col h-[600px] ${isMaximized ? 'lg:h-[calc(100vh-80px)]' : ''} bg-gray-50 dark:bg-slate-800`}>
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Tech Assistant</h3>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsMaximized(!isMaximized)}>
                            {isMaximized ? <Minimize size={20} /> : <Maximize size={20} />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X size={20} />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-100 dark:bg-slate-900">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg shadow-md ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 dark:bg-slate-700 dark:text-gray-100'}`}>
                                {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded" className="max-w-xs h-auto rounded-md mb-2" />}
                                {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                                <span className="block text-xs mt-1 opacity-70">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                    {isLoading && <div className="flex justify-start"><div className="p-3 rounded-lg shadow-md bg-white dark:bg-slate-700"><Loader2 className="animate-spin" size={20} /></div></div>}
                    <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800">
                    {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
                    {imagePreview && (
                        <div className="mb-3 relative w-24 h-24">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                            <Button type="button" size="icon" variant="danger" onClick={removeImage} className="absolute -top-2 -right-2 h-6 w-6 rounded-full"><X size={16} /></Button>
                        </div>
                    )}
                    <div className="flex items-end space-x-2">
                        <input type="file" accept="image/*" style={{ display: 'none' }} id={`image-upload-${jobId || 'new'}`} onChange={handleImageChange} />
                        <Button type="button" variant="secondary" size="icon" onClick={() => document.getElementById(`image-upload-${jobId || 'new'}`)?.click()}><ImageIcon size={20} /></Button>
                        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask a question..." className="flex-1" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} />
                        <Button onClick={handleSendMessage} disabled={isLoading || (!prompt.trim() && !imageFile)} style={{ backgroundColor: primaryColor }}><Send size={20} /></Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default SmartTechAssistant;
