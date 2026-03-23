
import React, { useState } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Star, Sparkles, Trash2, Globe, MessageSquare } from 'lucide-react';
import { db } from 'lib/firebase';
import type { Review } from 'types';
import { globalConfirm } from "lib/globalConfirm";

const ReviewHub: React.FC = () => {
    const { state } = useAppContext();
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    const reviews = state.reviews || [];

    const handleGenerateResponse = async (review: Review) => {
        setGeneratingId(review.id);
        try {
            const functions = getFunctions();
            const generateResponseFn = httpsCallable(functions, 'generateReviewResponse');
            const result = await generateResponseFn({ review });
            const data = result.data as any;
            await db.collection('reviews').doc(review.id).update({ aiDraft: data.text });
        } catch(e: any) {
            console.error(e);
            alert("Failed to generate response.");
        } finally {
            setGeneratingId(null);
        }
    };
    
    const handleSaveResponse = async (review: Review, content: string) => {
        await db.collection('reviews').doc(review.id).update({
            responded: true,
            responseContent: content,
            aiDraft: null
        });
    };

    const handleDeleteReview = async (reviewId: string) => {
        if (!await globalConfirm("Permanently delete this review?")) return;
        try {
            await db.collection('reviews').doc(reviewId).delete();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Reviews</h2>
                    <p className="text-gray-600 dark:text-gray-400">Manage and respond to reviews left by your customers on TekTrakker.</p>
                </div>
            </header>
            
            {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-lg mb-4">
                        <MessageSquare size={48} className="text-primary-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Reviews Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                        Reviews from your customers will appear here automatically. 
                        Encourage your customers to leave feedback after a completed job!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reviews.map(review => (
                        <Card key={review.id} className="flex flex-col h-full relative group">
                            <button onClick={() => handleDeleteReview(review.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1">
                                <Trash2 size={16}/>
                            </button>
                            <div className="flex justify-between items-start mb-4 pr-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                                        <Globe size={16} className="text-blue-500"/>
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white">{review.customerName}</p>
                                        <p className="text-xs text-gray-500">{review.date}</p>
                                    </div>
                                </div>
                                <div className="flex gap-0.5">
                                    {[1,2,3,4,5].map(star => (
                                        <Star key={star} size={14} className={star <= review.rating ? "text-yellow-400 fill-current" : "text-gray-300"} />
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 flex-1">"{review.content}"</p>
                            {review.responded ? (
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800">
                                    <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1">Responded</p>
                                    <p className="text-xs text-green-800 dark:text-green-300 italic">"{review.responseContent}"</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {review.aiDraft ? (
                                        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                                            <textarea className="w-full text-xs p-2 rounded bg-white dark:bg-slate-800 h-20 mb-2" defaultValue={review.aiDraft} id={`response-${review.id}`} />
                                            <Button onClick={() => { const el = document.getElementById(`response-${review.id}`) as HTMLTextAreaElement; handleSaveResponse(review, el.value); }} className="h-8 text-xs bg-purple-600 w-full">Post Response</Button>
                                        </div>
                                    ) : (
                                        <Button variant="secondary" onClick={() => handleGenerateResponse(review)} disabled={generatingId === review.id} className="w-full text-xs flex items-center justify-center gap-2">
                                            <Sparkles size={14}/> {generatingId === review.id ? 'Writing...' : 'Draft AI Response'}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReviewHub;
