import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import { PhoneIncoming, User, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CallListener: React.FC = () => {
    const { state } = useAppContext();
    const [activeCall, setActiveCall] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!state.currentOrganization || !state.currentUser) return;

        const callsRef = collection(db, 'organizations', state.currentOrganization.id, 'active_calls');
        // Listen for new ringing calls in the last few minutes
        const recentTime = new Date(Date.now() - 5 * 60000); // 5 minutes ago
        
        const q = query(
            callsRef, 
            where('status', '==', 'ringing')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                // Find the most recent ringing call
                const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
                
                // Sort client-side to avoid needing a composite index immediately
                calls.sort((a, b) => {
                    const timeA = a.timestamp?.toMillis() || 0;
                    const timeB = b.timestamp?.toMillis() || 0;
                    return timeB - timeA;
                });

                const latestCall = calls[0];
                
                // Only show if it's recent
                if (latestCall.timestamp && latestCall.timestamp.toMillis() > recentTime.getTime()) {
                    setActiveCall(latestCall);
                } else {
                    setActiveCall(null);
                }
            } else {
                setActiveCall(null);
            }
        });

        return () => unsubscribe();
    }, [state.currentOrganization]);

    const handleDismiss = async () => {
        if (!activeCall || !state.currentOrganization) return;
        try {
            await updateDoc(doc(db, 'organizations', state.currentOrganization.id, 'active_calls', activeCall.id), {
                status: 'dismissed'
            });
            setActiveCall(null);
        } catch (e) {
            console.error("Failed to dismiss call", e);
            setActiveCall(null);
        }
    };

    const handleAnswer = async () => {
        if (!activeCall || !state.currentOrganization) return;
        
        // If it's a known customer, route to their profile
        if (activeCall.customerId) {
            navigate(`/admin/customers/${activeCall.customerId}`);
        } else {
            // Route to customers list or a new lead form
            navigate(`/admin/customers`);
        }
        
        // Mark as answered/handled
        try {
            await updateDoc(doc(db, 'organizations', state.currentOrganization.id, 'active_calls', activeCall.id), {
                status: 'answered'
            });
            setActiveCall(null);
        } catch (e) {
            console.error("Failed to update call status", e);
        }
    };

    if (!activeCall) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-emerald-500 overflow-hidden w-80">
                <div className="bg-emerald-500 text-white p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2 font-bold animate-pulse">
                        <PhoneIncoming size={18} />
                        <span>Incoming Call...</span>
                    </div>
                    <button onClick={handleDismiss} className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors" aria-label="Dismiss call" title="Dismiss call">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="p-5">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center">
                            <User size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-900 dark:text-white text-lg">
                                {activeCall.customerName || 'Unknown Caller'}
                            </h4>
                            <p className="text-sm font-bold text-slate-500">
                                {activeCall.phoneNumber}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={handleDismiss}
                            className="flex-1 py-2 rounded-xl font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                        >
                            Dismiss
                        </button>
                        <button 
                            onClick={handleAnswer}
                            className="flex-1 py-2 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors text-sm shadow-md shadow-emerald-500/20"
                        >
                            Answer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
