
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { useAppContext } from '../../context/AppContext';
import type { Organization } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import { Building, MapPin, Phone, Mail, Globe, ArrowLeft, Award, Star, Send, FileText, Heart, CheckCircle, Home, Briefcase } from 'lucide-react';
import { toast } from 'react-toastify';

const DefaultBanner: React.FC = () => (
    <div className="h-48 w-full bg-gray-200 dark:bg-gray-700 pattern-dots pattern-gray-400 pattern-bg-gray-200 pattern-size-4 pattern-opacity-20 dark:pattern-bg-gray-700 dark:pattern-gray-500" />
);

const StarRating: React.FC<{ rating: number; setRating: (r: number) => void; }> = ({ rating, setRating }) => (
    <div className="flex items-center justify-center gap-1 my-4">
        {[1, 2, 3, 4, 5].map(star => (
            <Star key={star} size={32} className={`cursor-pointer ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" onClick={() => setRating(star)} />
        ))}
    </div>
);

const ReviewModal: React.FC<{ isOpen: boolean; onClose: () => void; orgId: string; orgName: string }> = ({ isOpen, onClose, orgId, orgName }) => {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment || !name) { toast.warn("Please fill in all fields."); return; }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'reviews'), { orgId, orgName, rating, comment, customerName: name, createdAt: serverTimestamp(), status: 'pending' });
            toast.success("Thank you! Your review has been submitted for approval.");
            onClose();
        } catch (error) { toast.error("There was an error submitting your review."); } 
        finally { setIsSubmitting(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Leave a Review for ${orgName}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-center text-sm text-gray-600">How would you rate your experience?</p>
                <StarRating rating={rating} setRating={setRating} />
                <Input label="Your Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Jane Doe" required />
                <Textarea label="Your Review" value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience with this contractor..." required rows={4} />
                <div className="flex justify-end pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Review'}<Send size={16} className="ml-2"/></Button>
                </div>
            </form>
        </Modal>
    );
};

const QuoteModal: React.FC<{ isOpen: boolean; onClose: () => void; orgId: string; orgName: string }> = ({ isOpen, onClose, orgId, orgName }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !details) { toast.warn('Please fill out all fields.'); return; }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'leads'), { orgId, orgName, customerName: name, customerEmail: email, customerPhone: phone, projectDetails: details, status: 'New', source: 'Marketplace', createdAt: serverTimestamp() });
            toast.success(`Your quote request has been sent to ${orgName}!`);
            onClose();
        } catch (error) { console.error("Quote submission error:", error); toast.error('Failed to send quote request. Please try again.'); } 
        finally { setIsSubmitting(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Request a Quote from ${orgName}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                <Input label="Phone Number (Optional)" value={phone} onChange={e => setPhone(e.target.value)} />
                <Textarea label="Project Details" value={details} onChange={e => setDetails(e.target.value)} required rows={4} placeholder="Describe the work you need done..."/>
                <div className="flex justify-end pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">{isSubmitting ? 'Sending...' : 'Send Request'} <Send size={16}/></Button>
                </div>
            </form>
        </Modal>
    )
}

const PublicProfile: React.FC = () => {
    const { orgId } = useParams<{ orgId: string }>();
    const { state: { currentUser, customerProfile } } = useAppContext();
    const navigate = useNavigate();
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        const fetchOrg = async () => {
            if (!orgId) return;
            setLoading(true);
            try {
                const docRef = doc(db, 'organizations', orgId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const orgData = { id: docSnap.id, ...docSnap.data() } as Organization;
                    if (orgData.publicProfileEnabled) setOrg(orgData);
                    else setOrg(null);
                } else setOrg(null);
            } catch (error) { console.error("Error fetching organization:", error); }
            setLoading(false);
        };
        fetchOrg();
    }, [orgId]);

    useEffect(() => {
        setIsSaved(customerProfile?.savedProviders?.includes(orgId || '') || false);
    }, [customerProfile, orgId]);

    const handleSaveCompany = async () => {
        if (!currentUser || !customerProfile) {
            toast.info("Please log in or create an account to save companies.");
            navigate('/auth/login', { state: { from: { pathname: window.location.pathname } } });
            return;
        }
        if (!orgId) return;

        const customerRef = doc(db, 'customers', customerProfile.id);
        try {
            await updateDoc(customerRef, { savedProviders: arrayUnion(orgId) });
            setIsSaved(true);
            toast.success(`${org?.name} has been saved to your profile!`);
        } catch (error) { toast.error("Failed to save company."); }
    };

    const formatUrl = (url: string) => !url.startsWith('http') ? `https://${url}` : url;

    if (loading) return <div className="flex items-center justify-center h-screen">Loading profile...</div>;
    if (!org) return (
        <div className="text-center py-20">
            <h2 className="text-2xl font-bold">Profile Not Found</h2>
            <p className="text-gray-600 mb-6">This contractor profile is not available or has been disabled.</p>
            <Link to="/marketplace"><Button variant="secondary" className="flex items-center gap-2 mx-auto"><ArrowLeft size={16} />Back to Directory</Button></Link>
        </div>
    );

    return (
        <>
            <div className="bg-gray-50 dark:bg-gray-900">
                <div className="container mx-auto px-4 py-12">
                    <div className="mb-6"><Link to="/marketplace"><Button variant="outline" className="flex items-center gap-2 text-sm bg-white dark:bg-gray-800"><ArrowLeft size={16} />Back to Directory</Button></Link></div>
                    <Card className="overflow-hidden shadow-lg">
                        {org.bannerUrl ? <img src={org.bannerUrl} alt={`${org.name} banner`} className="h-48 w-full object-cover"/> : <DefaultBanner />}
                        <div className="p-6 md:flex items-end gap-6 -mt-20 z-10 relative">
                            <div className="h-32 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl flex items-center justify-center overflow-hidden border-4 border-white dark:border-gray-800 flex-shrink-0">
                                {org.logoUrl ? <img src={org.logoUrl} alt={`${org.name} Logo`} className="w-full h-full object-contain p-2"/> : <Building className="text-gray-400" size={64}/>}
                            </div>
                            <div className="mt-4 md:mt-0">
                                <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{org.name}</h1>
                                <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{org.industry}</p>
                                {org.isVerified && <div className="mt-2 flex items-center gap-1.5 text-sm font-bold text-green-600"><Award size={16} /><span>Verified Contractor</span></div>}
                            </div>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 space-y-8">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">About Us</h3>
                                    <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{org.publicDescription || 'No description provided.'}</p>
                                </div>

                                {(org.serviceTypes || org.specializations) && (
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Capabilities</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {org.serviceTypes && org.serviceTypes.length > 0 && (
                                                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                                                    <h4 className="font-bold mb-2 flex items-center gap-2 text-gray-700 dark:text-gray-200">Service Areas</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {org.serviceTypes.map(type => (
                                                            <span key={type} className="flex items-center gap-1.5 text-sm bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 px-2 py-1 rounded-full">
                                                                {type === 'Residential' ? <Home size={14}/> : <Briefcase size={14} />} {type}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {org.specializations && org.specializations.length > 0 && (
                                                 <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                                                    <h4 className="font-bold mb-2 flex items-center gap-2 text-gray-700 dark:text-gray-200">Specializations</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {org.specializations.map(spec => <span key={spec} className="text-sm bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded-full">{spec}</span>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Reviews & Ratings</h3>
                                    <div className="bg-gray-100 dark:bg-gray-800 p-4 md:p-8 rounded-lg text-center">
                                        <p className="font-bold text-gray-700 dark:text-gray-200">Have you worked with {org.name}?</p>
                                        <p className="text-sm text-gray-500 mb-4">Share your experience to help others in the community.</p>
                                        <Button onClick={() => setIsReviewModalOpen(true)}><Star size={16} className="mr-2"/>Leave a Review</Button>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Contact & Actions</h3>
                                <div className="space-y-3">
                                     {org.address && <div className="flex items-start gap-3 text-sm"><MapPin size={18} className="text-gray-400 mt-1 flex-shrink-0" /><span className="text-gray-700 dark:text-gray-300">{`${org.address.street}, ${org.address.city}, ${org.address.state} ${org.address.zip}`}</span></div>}
                                    {org.phone && <div className="flex items-center gap-3 text-sm"><Phone size={16} className="text-gray-400 flex-shrink-0" /><a href={`tel:${org.phone}`} className="text-primary-600 hover:underline">{org.phone}</a></div>}
                                    {org.email && <div className="flex items-center gap-3 text-sm"><Mail size={16} className="text-gray-400 flex-shrink-0" /><a href={`mailto:${org.email}`} className="text-primary-600 hover:underline">{org.email}</a></div>}
                                    {org.website && <div className="flex items-center gap-3 text-sm"><Globe size={16} className="text-gray-400 flex-shrink-0" /><a href={formatUrl(org.website)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Visit Website</a></div>}
                                </div>
                                <div className="pt-4 space-y-2">
                                    <Button onClick={() => setIsQuoteModalOpen(true)} className="w-full font-bold flex items-center justify-center gap-2"><FileText size={16}/>Request a Quote</Button>
                                    <Button onClick={handleSaveCompany} variant="secondary" className="w-full flex items-center justify-center gap-2" disabled={isSaved}> 
                                        <Heart size={16}/> {isSaved ? 'Saved to Profile' : 'Save for Later'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
            {org && <ReviewModal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} orgId={org.id} orgName={org.name} />}
            {org && <QuoteModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} orgId={org.id} orgName={org.name} />}
        </>
    );
};

export default PublicProfile;
