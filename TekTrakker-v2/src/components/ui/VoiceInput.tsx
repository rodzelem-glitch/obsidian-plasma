import showToast from "lib/toast";
import React, { useState, useRef } from 'react';
import { Mic, StopCircle as StopIcon } from 'lucide-react';

export const VoiceInput = ({ onResult }: { onResult: (text: string) => void }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const toggleListening = () => {
        if (isListening) { 
            recognitionRef.current?.stop(); 
            setIsListening(false); 
            return; 
        }
        
        if (!('webkitSpeechRecognition' in window)) { 
            showToast.warn("Speech recognition is not supported in this browser."); 
            return; 
        }

        // @ts-ignore
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true; 
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
            let newText = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) { 
                if (event.results[i].isFinal) {
                    newText += event.results[i][0].transcript; 
                }
            }
            if (newText.trim()) {
                onResult(newText.trim());
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognition.onend = () => setIsListening(false);
        
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    return (
        <button 
            type="button" 
            onClick={toggleListening} 
            className={`p-2 rounded-full transition-colors ${isListening ? 'text-red-600 bg-red-50 animate-pulse' : 'text-slate-400 hover:text-slate-600'}`}
            title="Voice Input"
        >
            {isListening ? <StopIcon size={18} /> : <Mic size={18} />}
        </button>
    );
};
