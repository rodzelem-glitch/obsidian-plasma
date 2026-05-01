import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from 'lib/firebase';
import { MailX, CheckCircle, ArrowLeft } from 'lucide-react';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';

const Unsubscribe: React.FC = () => {
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email');
    
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleUnsubscribe = async () => {
        if (!email) return;
        setStatus('loading');
        try {
            await db.collection('unsubscribes').doc(email).set({
                email,
                unsubscribedAt: new Date().toISOString()
            });
            setStatus('success');
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    if (!email) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center shadow-lg rounded-2xl border-none">
                    <MailX size={48} className="mx-auto text-gray-400 mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
                    <p className="text-gray-500 mb-6">We couldn't find an email address to unsubscribe. Please check the link from your email.</p>
                </Card>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full p-8 text-center shadow-lg rounded-2xl border-none">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex mx-auto items-center justify-center mb-6">
                        <CheckCircle size={32} className="text-green-600" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-2">Unsubscribed Successfully</h1>
                    <p className="text-gray-500 mb-6">
                        <strong>{email}</strong> has been removed from our mailing list. You will no longer receive marketing communications. (Important account updates may still be sent).
                    </p>
                    <Button onClick={() => window.location.href = '/'} variant="secondary" className="w-full">
                        Return to Homepage
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 text-center shadow-lg rounded-2xl border-none">
                <div className="w-16 h-16 bg-red-50 rounded-full flex mx-auto items-center justify-center mb-6">
                    <MailX size={32} className="text-red-500" />
                </div>
                <h1 className="text-2xl font-black text-gray-900 mb-2">Email Preferences</h1>
                <p className="text-gray-500 mb-6">
                    Are you sure you want to unsubscribe <strong>{email}</strong> from all marketing communications?
                </p>
                
                <div className="space-y-3">
                    <Button 
                        onClick={handleUnsubscribe} 
                        disabled={status === 'loading'}
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                        {status === 'loading' ? 'Processing...' : 'Yes, Unsubscribe Me'}
                    </Button>
                    <Button 
                        onClick={() => window.location.href = '/'} 
                        variant="ghost" 
                        className="w-full"
                    >
                        Cancel
                    </Button>
                </div>
                
                {status === 'error' && (
                    <p className="text-red-600 text-sm mt-4 font-medium">Something went wrong. Please try again.</p>
                )}
            </Card>
        </div>
    );
};

export default Unsubscribe;
