import showToast from "lib/toast";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, functions } from 'lib/firebase';
import { Organization, Review, Customer, User } from 'types';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import Input from 'components/ui/Input';
import { 
    MapPin, Star, Phone, Globe, ShieldCheck, 
    MessageSquare, Link as LinkIcon, AlertTriangle, ArrowLeft, Wrench, Calendar, BadgeCheck, Briefcase,
    Facebook, Instagram, Linkedin, Twitter, Youtube
} from 'lucide-react';
import { formatAddress } from 'lib/utils';
import { useAppContext } from 'context/AppContext';
import { useReviewEligibility } from 'hooks/useReviewEligibility';

const ProviderProfile: React.FC = () => {
    const { orgId } = useParams<{ orgId: string }>();
    const navigate = useNavigate();
    const { state, dispatch } = useAppContext();
    const { currentUser, customers, currentOrganization, subcontractors } = state;
    
    const [org, setOrg] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isLinked, setIsLinked] = useState(false);
    const [isProcessingLink, setIsProcessingLink] = useState(false);

    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewData, setReviewData] = useState({ rating: 5, content: '' });
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactMessage, setContactMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [bookingDate, setBookingDate] = useState('');
    const [bookingTime, setBookingTime] = useState('');

    const { eligibility, checkEligibility } = useReviewEligibility(currentUser, orgId);

    useEffect(() => {
        const fetchOrgAndReviews = async () => {
            if (!orgId) return;
            setLoading(true);
            try {
                const doc = await db.collection('organizations').doc(orgId).get();
                if (doc.exists) {
                    const orgData = { id: doc.id, ...doc.data() } as Organization;
                    setOrg(orgData);
                    
                    const revSnap = await db.collection('reviews')
                        .where('organizationId', '==', orgId)
                        .where('status', '==', 'approved')
                        .orderBy('date', 'desc')
                        .get();
                    setReviews(revSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));

                    if (currentUser) {
                        const existingLink = customers.some(c => c.email === currentUser.email && c.organizationId === orgId);
                        setIsLinked(existingLink);
                    }
                } else {
                  setOrg(null);
                }
            } catch (e) {
                console.error("Error fetching org:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrgAndReviews();
    }, [orgId, currentUser, customers]);

    useEffect(() => {
        if (!loading && currentUser && orgId) {
            checkEligibility();
        }
    }, [loading, currentUser, orgId, checkEligibility]);

    const handleOpenContactModal = () => {
        if (currentUser) {
            setContactName(`${currentUser.firstName} ${currentUser.lastName}`);
            setContactEmail(currentUser.email);
            setContactPhone(currentUser.phone || '');
        }
        setIsContactModalOpen(true);
    };

    const closeContactModal = () => {
        setIsContactModalOpen(false);
        setContactName('');
        setContactEmail('');
        setContactPhone('');
        setContactMessage('');
    }

    const handleOpenBookingModal = () => {
        if (currentUser) {
            setContactName(`${currentUser.firstName} ${currentUser.lastName}`);
            setContactEmail(currentUser.email);
            setContactPhone(currentUser.phone || '');
        }
        setIsBookingModalOpen(true);
    };

    const closeBookingModal = () => {
        setIsBookingModalOpen(false);
        setContactName('');
        setContactEmail('');
        setContactPhone('');
        setContactMessage('');
        setBookingDate('');
        setBookingTime('');
    }

    const handleLinkAccount = async () => {
        if (!currentUser || !org) {
            navigate('/login?redirect=/marketplace/' + orgId);
            return;
        }

        if (isLinked) {
            navigate('/portal');
            return;
        }

        setIsProcessingLink(true);
        try {
            const primaryCustomerProfile = customers.find(c => c.email === currentUser.email);

            const newCustomerRecord: Omit<Customer, 'id'> = {
                organizationId: org.id,
                name: `${currentUser.firstName} ${currentUser.lastName}`,
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                email: currentUser.email,
                phone: primaryCustomerProfile?.phone || currentUser.phone || '',
                address: typeof primaryCustomerProfile?.address === 'string' ? primaryCustomerProfile.address : '',
                customerType: primaryCustomerProfile?.customerType || 'Residential',
                hvacSystem: primaryCustomerProfile?.hvacSystem || { brand: '', type: '' }, 
                serviceHistory: [],
                marketingConsent: primaryCustomerProfile?.marketingConsent || { sms: true, email: true, agreedAt: new Date().toISOString(), source: 'MarketplaceLink' }
            };
            
            const docRef = await db.collection('customers').add(newCustomerRecord);
            const newCustomer = { id: docRef.id, ...newCustomerRecord } as Customer;

            dispatch({ type: 'ADD_CUSTOMER', payload: newCustomer });
            setIsLinked(true);
            showToast.warn(`Successfully linked with ${org.name}!`);
            navigate('/portal');

        } catch (error) {
            console.error("Error linking account:", error);
            showToast.warn("There was an error linking your account.");
        } finally {
            setIsProcessingLink(false);
        }
    };
    
    const handleConnectSubcontractor = async () => {
        if (!currentOrganization || !org) return;
        setIsProcessingLink(true);
        try {
            // Check if subcontractor record already exists
            const existingSub = subcontractors?.find(s => s.linkedOrgId === org.id);
            const manageHandshake = functions.httpsCallable('manageHandshake');
            
            if (existingSub) {
                await manageHandshake({
                    action: 'request',
                    targetOrgId: org.id,
                    requestingOrgId: currentOrganization.id,
                    subcontractorId: existingSub.id
                });
                dispatch({ type: 'UPDATE_SUBCONTRACTOR', payload: { ...existingSub, handshakeStatus: 'Pending' } as any });
            } else {
                const subId = `sub-${Date.now()}`;
                const newSub = {
                    id: subId,
                    organizationId: currentOrganization.id,
                    companyName: org.name,
                    trade: org.industry || 'General',
                    email: org.email || '',
                    phone: org.phone || '',
                    linkedOrgId: org.id,
                    handshakeStatus: 'Pending',
                    status: 'Active'
                };
                await db.collection('subcontractors').doc(subId).set(newSub);
                dispatch({ type: 'ADD_SUBCONTRACTOR', payload: newSub as any });

                await manageHandshake({
                    action: 'request',
                    targetOrgId: org.id,
                    requestingOrgId: currentOrganization.id,
                    subcontractorId: subId
                });
            }
            showToast.warn(`Partnership request sent to ${org.name}!`);
        } catch (error: any) {
            console.error("Error connecting subcontractor:", error);
            showToast.warn("There was an error sending the partnership request: " + error.message);
        } finally {
            setIsProcessingLink(false);
        }
    };
    
    const submitReview = async () => {
        if (!currentUser || !org || !reviewData.content) return;
        setIsSubmittingReview(true);

        try {
            const customerForReview = customers.find(c => c.organizationId === orgId && c.email === currentUser.email);
            if (!customerForReview) {
                showToast.warn("Could not find a valid customer profile to submit this review.");
                return;
            }

            const newReview: Omit<Review, 'id'> = {
                organizationId: org.id,
                customerId: customerForReview.id,
                customerName: customerForReview.name,
                rating: reviewData.rating,
                content: reviewData.content,
                date: new Date().toISOString(),
                status: 'approved',
                platform: 'TekTrakker',
                responded: false
            };

            const docRef = await db.collection('reviews').add(newReview);
            setReviews([{ id: docRef.id, ...newReview } as Review, ...reviews]);
            checkEligibility();
            setIsReviewModalOpen(false);
            setReviewData({ rating: 5, content: '' });

        } catch (e) {
            console.error("Failed to submit review:", e);
            showToast.warn("Failed to submit review.");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleSendContactMessage = async () => {
        if (!contactName || !contactEmail || !contactMessage) {
            showToast.warn("Please fill out all required fields.");
            return;
        }
        if (!org || !org.id) {
            showToast.warn("There was a problem identifying the provider. Please close the form and try again.");
            console.error("handleSendContactMessage failed: Missing org or org.id", { org });
            return;
        }
        setIsSending(true);
        try {
            const functionUrl = 'https://us-central1-tektrakker.cloudfunctions.net/submitWidgetForm';
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    organizationId: org.id,
                    name: contactName,
                    email: contactEmail,
                    phone: contactPhone,
                    message: contactMessage,
                    type: 'marketplace_contact',
                    formType: 'marketplace_contact'
                }),
            });

            if (response.ok) {
                showToast.warn("Your message has been sent!");
                closeContactModal();
            } else {
                // Robust extraction
                const text = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(text);
                } catch {
                    errorData = { message: text || response.statusText || `Server Error (${response.status})` };
                }
                throw errorData;
            }
        } catch (error: any) {
            console.error("Failed to send message:", { rawError: error, org });
            let errorMessage = "An unknown error occurred.";
            
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && error.message) {
                errorMessage = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
            } else if (error && error.error) {
                errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
            } else {
                try {
                    errorMessage = JSON.stringify(error);
                } catch {
                    errorMessage = "An unreadable error occurred.";
                }
            }
            showToast.warn('There was an error sending your message: ' + errorMessage);
        } finally {
            setIsSending(false);
        }
    };

    const handleSendBookingRequest = async () => {
        if (!contactName || !contactEmail || !bookingDate || !contactMessage) {
            showToast.warn("Please fill out all required fields.");
            return;
        }
        if (!org || !org.id) {
            showToast.warn("There was a problem identifying the provider. Please close the form and try again.");
            console.error("handleSendBookingRequest failed: Missing org or org.id", { org });
            return;
        }
        setIsSending(true);
        try {
            const functionUrl = 'https://us-central1-tektrakker.cloudfunctions.net/submitWidgetForm';
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    organizationId: org.id,
                    name: contactName,
                    email: contactEmail,
                    phone: contactPhone,
                    message: contactMessage,
                    preferredDate: bookingDate,
                    preferredTime: bookingTime,
                    type: 'booking_request',
                    formType: 'booking_request'
                }),
            });

            if (response.ok) {
                showToast.warn("Your booking request has been sent!");
                closeBookingModal();
            } else {
                // Robust extraction
                const text = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(text);
                } catch {
                    errorData = { message: text || response.statusText || `Server Error (${response.status})` };
                }
                throw errorData;
            }
        } catch (error: any) {
            console.error("Failed to send booking request:", { rawError: error, org });
            let errorMessage = "An unknown error occurred.";
            
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && error.message) {
                errorMessage = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
            } else if (error && error.error) {
                errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
            } else {
                try {
                    errorMessage = JSON.stringify(error);
                } catch {
                    errorMessage = "An unreadable error occurred.";
                }
            }
            showToast.warn('There was an error sending your booking request: ' + errorMessage);
        } finally {
            setIsSending(false);
        }
    };

    if (loading) return <div className="p-20 text-center">Loading profile...</div>;
    if (!org) return <div className="p-20 text-center">Provider not found.</div>;
    
    const averageRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) : 0;
    const isPublic = org.settings?.publicProfile === true;
    const displayLogo = org.settings?.publicLogoUrl || org.logoUrl || '/img/logo_placeholder.png';

    const isViewingAsOrg = !!currentOrganization;
    const existingPartner = isViewingAsOrg ? subcontractors?.find(s => s.linkedOrgId === orgId) : null;
    const partnerStatus = existingPartner?.handshakeStatus;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-20">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <Button variant="ghost" onClick={() => navigate('/marketplace')} className="mb-4 text-sm">
                        <ArrowLeft size={16} className="mr-2" />
                        Back to Marketplace
                    </Button>
                    {!isPublic && (
                        <div className="p-4 mb-6 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-lg flex items-center gap-3">
                            <AlertTriangle className="text-yellow-600 dark:text-yellow-400" />
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">This provider does not have a public profile and may not be accepting new customers through the marketplace.</p>
                        </div>
                    )}
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <img src={displayLogo} alt={`${org.name} logo`} className="w-full h-full object-contain p-2" onError={(e) => { e.currentTarget.src = '/img/logo_placeholder.png'; }}/>
                        </div>
                        <div className="flex-1 space-y-4">
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center flex-wrap gap-3">
                                    {org.name}
                                    {org.isLeadingPro && (
                                        <div className="flex items-center bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wide">
                                            <Star size={14} className="mr-1.5 fill-current" />
                                            <span>Leading Pro</span>
                                        </div>
                                    )}
                                    {org.isVerified && !org.isLeadingPro && (
                                        <div className="flex items-center bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                                            <BadgeCheck size={14} className="mr-1.5" />
                                            <span>Verified</span>
                                        </div>
                                    )}
                                    {org.acceptsSubcontracting && (
                                        <div className="flex items-center bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                                            <Briefcase size={14} className="mr-1.5" />
                                            <span>Subcontracting B2B</span>
                                        </div>
                                    )}
                                </h1>
                                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm text-slate-500 font-medium">
                                    {org.address && <span className="flex items-center gap-1.5"><MapPin size={14} /> {formatAddress(org.address)}</span>}
                                    {org.website && <span className="flex items-center gap-1.5"><Globe size={14} /> <a href={org.website} target="_blank" rel="noreferrer" className="hover:underline">Website</a></span>}
                                </div>
                                {(org.socialLinks?.facebook || org.socialLinks?.instagram || org.socialLinks?.linkedin || org.socialLinks?.youtube || org.socialLinks?.x) && (
                                     <div className="flex flex-wrap gap-3 mt-3 text-slate-400">
                                         {org.socialLinks.facebook && <a href={org.socialLinks.facebook} target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors" title="Facebook"><Facebook size={18}/></a>}
                                         {org.socialLinks.instagram && <a href={org.socialLinks.instagram} target="_blank" rel="noreferrer" className="hover:text-pink-600 transition-colors" title="Instagram"><Instagram size={18}/></a>}
                                         {org.socialLinks.linkedin && <a href={org.socialLinks.linkedin} target="_blank" rel="noreferrer" className="hover:text-blue-500 transition-colors" title="LinkedIn"><Linkedin size={18}/></a>}
                                         {org.socialLinks.x && <a href={org.socialLinks.x} target="_blank" rel="noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors" title="X (Twitter)"><Twitter size={18}/></a>}
                                         {org.socialLinks.youtube && <a href={org.socialLinks.youtube} target="_blank" rel="noreferrer" className="hover:text-red-600 transition-colors" title="YouTube"><Youtube size={18}/></a>}
                                     </div>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Button 
                                    onClick={handleLinkAccount}
                                    disabled={isProcessingLink || !isPublic}
                                    className="px-4 md:px-8 py-3 text-sm font-black uppercase tracking-widest shadow-lg bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400"
                                    title={!isPublic ? "This provider cannot be linked at this time" : ""}
                                >
                                    <LinkIcon size={16} className="mr-2"/>
                                    {isProcessingLink ? 'Linking...' : (isLinked ? 'View My Dashboard' : 'Link My Account')}
                                </Button>
                                {isViewingAsOrg && currentOrganization.id !== org.id && org.acceptsSubcontracting && (
                                    <Button 
                                        onClick={handleConnectSubcontractor}
                                        disabled={isProcessingLink || partnerStatus === 'Pending' || partnerStatus === 'Linked'}
                                        className="px-4 md:px-8 py-3 text-sm font-black uppercase tracking-widest shadow-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400"
                                    >
                                        <Briefcase size={16} className="mr-2"/>
                                        {isProcessingLink ? 'Requesting...' : 
                                         partnerStatus === 'Linked' ? 'Partnered' : 
                                         partnerStatus === 'Pending' ? 'Request Sent' : 
                                         'Connect Subcontractor'}
                                    </Button>
                                )}
                                <Button variant="outline" onClick={handleOpenBookingModal}><Calendar size={16} className="mr-2"/>Book Appointment</Button>
                                <Button variant="secondary" onClick={handleOpenContactModal}><MessageSquare size={16} className="mr-2"/>Contact</Button>
                                <Button as="a" href={`tel:${org.phone}`} variant="outline" className="sm:ml-auto"><Phone size={16} className="mr-2"/> Call</Button>
                            </div>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-center min-w-[200px] w-full md:w-auto">
                             {reviews.length > 0 ? (
                                <>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white">{averageRating.toFixed(1)}</p>
                                    <div className="flex items-center justify-center gap-1 text-amber-400 my-1">
                                        {[1, 2, 3, 4, 5].map(i => <Star key={i} size={20} fill={averageRating >= i - 0.5 ? "currentColor" : "none"} />)}
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{reviews.length} Customer Reviews</p>
                                </> 
                            ) : (
                                <div className="py-4">
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">No Reviews Yet</p>
                                    <p className="text-xs text-slate-500">Be the first to share your experience.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-12">
                    <section>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">About {org.name}</h3>
                        <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
                            <p>{org.settings?.publicDescription || `A premier provider of ${org.industry} services, serving the community with pride and professionalism.`}</p>
                        </div>
                    </section>

                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <MessageSquare className="text-primary-600" /> Recent Reviews
                            </h3>
                             {currentUser && eligibility.checked && (
                                eligibility.canReview ? (
                                    <Button variant="secondary" size="sm" onClick={() => setIsReviewModalOpen(true)}>Write a Review</Button>
                                ) : eligibility.hasReviewed ? (
                                    <p className="text-sm text-slate-500 font-medium">You've already reviewed this provider.</p>
                                ) : (
                                    <p className="text-sm text-slate-500 font-medium">Link and complete a job to leave a review.</p>
                                )
                            )}
                        </div>
                        <div className="space-y-4">
                            {reviews.length > 0 ? reviews.map(rev => (
                                <div key={rev.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white text-sm">{rev.customerName}</p>
                                            <p className="text-xs text-slate-400">{new Date(rev.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex text-amber-400">
                                            {[...Array(5)].map((_, i) => <Star key={i} size={14} strokeWidth={1.5} fill={i < rev.rating ? "currentColor" : "none"} />)}
                                        </div>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm italic">"{rev.content}"</p>
                                </div>
                            )) : (
                                <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                                    No reviews yet. Be the first!
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="space-y-6">
                     <Card>
                        <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Wrench size={16}/> Services</h4>
                        {org.settings?.publicServices && org.settings.publicServices.length > 0 ? (
                             <ul className="space-y-3">
                                {org.settings.publicServices.map((service, index) => (
                                    <li key={index} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <Wrench size={14} className="text-sky-500" />
                                        <span>{service}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400">No services listed.</p>
                        )}
                    </Card>
                    <Card>
                        <h4 className="font-bold text-sm uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><ShieldCheck size={16}/> Credentials</h4>
                        {(org.settings?.publicCredentials && org.settings.publicCredentials.length > 0) || org.licenseNumber ? (
                             <ul className="space-y-3">
                                {org.settings?.publicCredentials?.map((cred, index) => (
                                    <li key={index} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <ShieldCheck size={18} className="text-emerald-500" />
                                        <span>{cred}</span>
                                    </li>
                                ))}
                                {org.licenseNumber && (
                                    <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <ShieldCheck size={18} className="text-emerald-500" />
                                        <span>Lic #{org.licenseNumber}</span>
                                    </li>
                                )}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400">No credentials listed.</p>
                        )}
                    </Card>
                </div>
            </div>

             <Modal isOpen={isContactModalOpen} onClose={closeContactModal} title={`Contact ${org.name}`}>
                <div className="space-y-4">
                    <p className='text-sm text-slate-500'>Your message will be sent directly to {org?.name}.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Your Name"
                            value={contactName}
                            onChange={e => setContactName(e.target.value)}
                            placeholder="John Doe"
                            required
                        />
                        <Input 
                            label="Your Email"
                            type="email"
                            value={contactEmail}
                            onChange={e => setContactEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <Input 
                        label="Your Phone (Optional)"
                        type="tel"
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                    />
                    <Textarea 
                        label="Your Message"
                        value={contactMessage} 
                        onChange={e => setContactMessage(e.target.value)} 
                        rows={5}
                        placeholder='Ask a question or request a consultation...'
                        required
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={closeContactModal}>Cancel</Button>
                        <Button onClick={handleSendContactMessage} disabled={isSending || !contactMessage || !contactName || !contactEmail}>
                            {isSending ? 'Sending...' : 'Send Message'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isBookingModalOpen} onClose={closeBookingModal} title={`Book Appointment with ${org?.name}`}>
                 <div className="space-y-4">
                    <p className='text-sm text-slate-500'>Request a new appointment. The provider will confirm with you directly.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Your Name"
                            value={contactName}
                            onChange={e => setContactName(e.target.value)}
                            placeholder="John Doe"
                            required
                        />
                        <Input 
                            label="Your Email"
                            type="email"
                            value={contactEmail}
                            onChange={e => setContactEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                     <Input 
                        label="Your Phone (Optional)"
                        type="tel"
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Preferred Date"
                            type="date"
                            value={bookingDate}
                            onChange={e => setBookingDate(e.target.value)}
                            required
                        />
                        <Input 
                            label="Preferred Time"
                            type="time"
                            value={bookingTime}
                            onChange={e => setBookingTime(e.target.value)}
                        />
                    </div>
                    <Textarea 
                        label="Briefly describe the issue"
                        value={contactMessage} 
                        onChange={e => setContactMessage(e.target.value)} 
                        rows={4}
                        placeholder='e.g., My AC is not cooling, or I need a quote for a new water heater.'
                        required
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={closeBookingModal}>Cancel</Button>
                        <Button onClick={handleSendBookingRequest} disabled={isSending || !contactMessage || !contactName || !contactEmail || !bookingDate}>
                            {isSending ? 'Sending Request...' : 'Send Booking Request'}
                        </Button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} title={`Review ${org.name}`}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Share your experience to help others.</p>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Rating</label>
                        <div className="flex items-center gap-1 text-amber-400">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} size={32} className="cursor-pointer" fill={i <= reviewData.rating ? "currentColor" : "none"} onClick={() => setReviewData({ ...reviewData, rating: i })} />
                            ))}
                        </div>
                    </div>
                    <Textarea label="Your Review" value={reviewData.content} onChange={e => setReviewData({ ...reviewData, content: e.target.value })} rows={5} />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={() => setIsReviewModalOpen(false)}>Cancel</Button>
                        <Button onClick={submitReview} disabled={isSubmittingReview || !reviewData.content}>{isSubmittingReview ? 'Submitting...' : 'Submit Review'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ProviderProfile;
