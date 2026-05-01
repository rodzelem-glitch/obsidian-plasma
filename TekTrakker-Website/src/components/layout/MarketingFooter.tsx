import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook } from 'lucide-react';
import Logo from './Logo';

const TikTok = ({ size = 20, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a3 3 0 0 1-3-3v11a7 7 0 1 1-7-7" />
    </svg>
);

export const SupportModal: React.FC<{ onClose: () => void; onSubmit: (data: any) => Promise<void> }> = ({ onClose, onSubmit }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit({ name, email, message });
            setIsSubmitted(true);
        } catch (error) {
            console.error("Support form submission error:", error);
            alert("There was an error sending your message. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Contact Support</h3>
                    <p className="text-sm text-slate-500 mb-6">We typically respond within 24 hours.</p>
                    {isSubmitted ? (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 mb-2">Message Sent</h4>
                            <p className="text-slate-500 text-sm">We've received your request and will be in touch shortly.</p>
                            <button onClick={onClose} className="mt-6 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">Close</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" placeholder="John Doe" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" placeholder="john@example.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                                <textarea required value={message} onChange={e => setMessage(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all min-h-[100px] resize-y" placeholder="How can we help?"></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">{isSubmitting ? 'Sending...' : 'Send Message'}</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export const MarketingFooter: React.FC = () => {
    const [showSupportModal, setShowSupportModal] = useState(false);

    const handleSupportSubmit = async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
    };

    return (
        <>
            <footer className="bg-slate-950 border-t border-white/5 py-12 px-6 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all"><Logo className="h-8 w-auto text-white" /></div>
                    <div className="flex items-center gap-6 text-sm text-slate-500 font-medium">
                        <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
                        <Link to="/franchise" className="hover:text-white transition-colors">Franchise Info</Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                        <button onClick={() => setShowSupportModal(true)} className="hover:text-white transition-colors">Support</button>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://www.facebook.com/share/1AyPhsNeN3/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook" className="text-slate-500 hover:text-[#1877F2] transition-all hover:scale-110">
                            <Facebook size={20} />
                        </a>
                        <a href="https://twitter.com/TrakkerPlatform" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" title="X (Twitter)" className="text-slate-500 hover:text-white transition-all hover:scale-110">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>
                        </a>
                        <a href="https://www.tiktok.com/@tektrakker" target="_blank" rel="noopener noreferrer" aria-label="TikTok" title="TikTok" className="text-slate-500 hover:text-[#00f2fe] transition-all hover:scale-110">
                            <TikTok size={20} />
                        </a>
                    </div>
                    <div className="text-slate-600 text-xs font-medium">&copy; 2026 TekTrakker Inc. All rights reserved.</div>
                </div>
            </footer>
            {showSupportModal && <SupportModal onClose={() => setShowSupportModal(false)} onSubmit={handleSupportSubmit} />}
        </>
    );
};
