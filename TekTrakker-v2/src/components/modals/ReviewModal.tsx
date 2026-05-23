import showToast from "lib/toast";

import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import { Star } from 'lucide-react';
import { db } from 'lib/firebase';
import type { Review } from 'types';

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    organizationId: string | null;
    organizationName: string | null;
    customerId: string | null;
    customerName: string | null;
    onReviewSubmitted: (newReview: Review) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, organizationId, organizationName, customerId, customerName, onReviewSubmitted }) => {
    const [rating, setRating] = useState(5);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!organizationId || !customerId || !customerName || !content) {
            showToast.warn('Missing required information to submit a review.');
            return;
        }

        setIsSubmitting(true);
        try {
            const newReview: Omit<Review, 'id'> = {
                organizationId,
                customerId,
                customerName,
                rating,
                content,
                date: new Date().toISOString(),
                status: 'approved', // Auto-approved for now
            };

            const docRef = await db.collection('reviews').add(newReview);
            
            onReviewSubmitted({ ...newReview, id: docRef.id });
            
            // Reset form and close modal
            setContent('');
            setRating(5);
            onClose();

        } catch (error) {
            console.error("Error submitting review:", error);
            showToast.warn("There was an error submitting your review. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Review ${organizationName || 'Provider'}`}>
            <div className="space-y-4">
                <p className="text-sm text-slate-500">Your feedback helps other customers and allows this provider to improve.</p>
                <div>
                    <div id="rating-label" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Overall Rating</div>
                    <div className="flex items-center gap-1 text-amber-400" role="group" aria-labelledby="rating-label">
                        {[1, 2, 3, 4, 5].map(i => (
                            <button
                                type="button"
                                key={i}
                                className="cursor-pointer transition-transform hover:scale-110 p-0 border-none bg-transparent"
                                onClick={() => setRating(i)}
                                aria-label={`Rate ${i} stars`}
                            >
                                <Star 
                                    size={32} 
                                    fill={i <= rating ? "currentColor" : "none"}
                                />
                            </button>
                        ))}
                    </div>
                </div>
                <Textarea 
                    label="Share your experience"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="What did you like? What could be improved?"
                    rows={5}
                    required
                />
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !content.trim()}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Review'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ReviewModal;
