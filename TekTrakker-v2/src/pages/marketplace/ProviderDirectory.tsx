import showToast from "lib/toast";

import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from 'lib/firebase';
import { Organization, IndustryVertical, Review } from 'types';
import { Logo } from 'components/ui/Logo';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import Card from 'components/ui/Card';
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import { Search, MapPin, Star, Building2, Briefcase, MessageSquare, BadgeCheck, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';

const ALL_INDUSTRIES: IndustryVertical[] = [
    'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General', 
    'Cleaning', 'Painting', 'Roofing', 'Contracting', 'Masonry',
    'Telecommunications', 'Solar', 'Security', 'Pet Grooming'
];

interface ProviderData extends Organization {
    reviewCount: number;
    averageRating: number | null;
}

const ProviderDirectory: React.FC = () => {
    const navigate = useNavigate();
    const { state, dispatch } = useAppContext();
    const { currentUser } = state;

    const handleLogout = async () => {
        try {
            await auth.signOut();
            dispatch({ type: 'LOGOUT' });
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const [providers, setProviders] = useState<ProviderData[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [industryFilter, setIndustryFilter] = useState<string>('All');
    const [cityFilter, setCityFilter] = useState('');
    const [subcontractingFilter, setSubcontractingFilter] = useState(false);
    const [sortBy, setSortBy] = useState<'rating' | 'name'>('rating');

    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [contactOrg, setContactOrg] = useState<Organization | null>(null);
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactMessage, setContactMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [bookingOrg, setBookingOrg] = useState<Organization | null>(null);
    const [bookingDate, setBookingDate] = useState('');
    const [bookingTime, setBookingTime] = useState('');


    useEffect(() => {
        const fetchProviders = async () => {
            setLoading(true);
            try {
                const orgsSnap = await db.collection('organizations')
                    .where('subscriptionStatus', '==', 'active')
                    .where('settings.publicProfile', '==', true)
                    .limit(50)
                    .get();
                
                const orgs = orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));

                if (orgs.length === 0) {
                    setProviders([]);
                    setLoading(false);
                    return;
                }

                const reviewsSnap = await db.collection('reviews').where('organizationId', 'in', orgs.map(o => o.id)).get();
                const reviews = reviewsSnap.docs.map(d => d.data() as Review);

                const providersWithReviews = orgs.map(org => {
                    const orgReviews = reviews.filter(r => r.organizationId === org.id);
                    const reviewCount = orgReviews.length;
                    const averageRating = reviewCount > 0 
                        ? orgReviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount
                        : null;
                    return { ...org, reviewCount, averageRating };
                });

                setProviders(providersWithReviews);
            } catch (error) {
                console.error("Error fetching directory:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProviders();
    }, []);

    const filteredAndSortedProviders = useMemo(() => {
        let result = providers;

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(lower));
        }
        if (industryFilter !== 'All') {
            result = result.filter(p => p.industry === industryFilter);
        }
        if (cityFilter) {
            const lowerCity = cityFilter.toLowerCase();
            result = result.filter(p => 
                p.address?.city.toLowerCase().includes(lowerCity) ||
                p.address?.zip.toLowerCase().includes(lowerCity)
            );
        }
        if (subcontractingFilter) {
            result = result.filter(p => p.acceptsSubcontracting);
        }

        result.sort((a, b) => {
            if (sortBy === 'rating') {
                return (b.averageRating ?? 0) - (a.averageRating ?? 0);
            }
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            }
            return 0;
        });

        return result;
    }, [searchTerm, industryFilter, cityFilter, subcontractingFilter, sortBy, providers]);

    const handleOpenContactModal = (org: Organization) => {
        setContactOrg(org);
        if (currentUser) {
            setContactName(`${currentUser.firstName} ${currentUser.lastName}`);
            setContactEmail(currentUser.email);
            setContactPhone(currentUser.phone || '');
        }
        setIsContactModalOpen(true);
    };

    const closeContactModal = () => {
        setIsContactModalOpen(false);
        setContactOrg(null);
        setContactName('');
        setContactEmail('');
        setContactPhone('');
        setContactMessage('');
    }

    const handleOpenBookingModal = (org: Organization) => {
        setBookingOrg(org);
        if (currentUser) {
            setContactName(`${currentUser.firstName} ${currentUser.lastName}`);
            setContactEmail(currentUser.email);
            setContactPhone(currentUser.phone || '');
        }
        setIsBookingModalOpen(true);
    };

    const closeBookingModal = () => {
        setIsBookingModalOpen(false);
        setBookingOrg(null);
        setContactName('');
        setContactEmail('');
        setContactPhone('');
        setContactMessage('');
        setBookingDate('');
        setBookingTime('');
    }

    const handleSendContactMessage = async () => {
        if (!contactName || !contactEmail || !contactMessage) {
            showToast.warn("Please fill out all required fields.");
            return;
        }
        if (!contactOrg || !contactOrg.id) {
            showToast.warn("There was a problem identifying the provider. Please close the form and try again.");
            console.error("handleSendContactMessage failed: Missing contactOrg or contactOrg.id", { contactOrg });
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
                    organizationId: contactOrg.id,
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
            console.error("Failed to send message:", { rawError: error, contactOrg });
            let errorMessage = "An unknown error occurred.";
            
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && error.message) {
                errorMessage = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
            } else if (error && error.error) {
                if (typeof error.error === 'string') {
                    errorMessage = error.error;
                } else if (typeof error.error.message === 'string') {
                    errorMessage = error.error.message;
                }
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
        if (!bookingOrg || !bookingOrg.id) {
            showToast.warn("There was a problem identifying the provider. Please close the form and try again.");
            console.error("handleSendBookingRequest failed: Missing bookingOrg or bookingOrg.id", { bookingOrg });
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
                    organizationId: bookingOrg.id,
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
            console.error("Failed to send booking request:", { rawError: error, bookingOrg });
            let errorMessage = "An unknown error occurred.";
            
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && error.message) {
                errorMessage = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
            } else if (error && error.error) {
                if (typeof error.error === 'string') {
                    errorMessage = error.error;
                } else if (typeof error.error.message === 'string') {
                    errorMessage = error.error.message;
                }
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


    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
            <header className="bg-slate-900 py-3 px-4 sm:px-6 lg:px-8 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link to="/marketplace" aria-label="Back to marketplace home">
                        <Logo className="h-9 w-auto text-white" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {currentUser ? (
                            <>
                                <span className="text-white text-sm hidden sm:inline-block">Welcome, {currentUser.firstName}</span>
                                <Button variant="secondary" size="sm" onClick={() => navigate('/')}>Dashboard</Button>
                                <Button variant="outline" size="sm" onClick={handleLogout} className="border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white">Sign Out</Button>
                            </>
                        ) : (
                            <Button variant="secondary" size="sm" onClick={() => navigate('/login')}>Provider Login</Button>
                        )}
                    </div>
                </div>
            </header>

            <div className="bg-slate-900 text-white py-20 px-6 text-center relative overflow-hidden">
                 <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
                <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight">Find Trusted Pros</h1>
                    <p className="text-lg text-slate-300">Connect with top-rated commercial and residential service providers in your area.</p>
                    
                    <div className="bg-white p-2 rounded-2xl shadow-xl flex flex-col md:flex-row gap-2 max-w-2xl mx-auto mt-8">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                            <input 
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-none bg-slate-50 text-slate-900 focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder="Search by name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 md:max-w-xs relative">
                            <MapPin className="absolute left-3 top-3.5 text-slate-400" size={20} />
                            <input 
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-none bg-slate-50 text-slate-900 focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder="City or Zip"
                                value={cityFilter}
                                onChange={e => setCityFilter(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="w-full md:w-64 space-y-6">
                        <Card className="sticky top-24">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Briefcase size={18} /> Industry
                            </h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="industry" checked={industryFilter === 'All'} onChange={() => setIndustryFilter('All')} className="text-primary-600 focus:ring-primary-500" />
                                    <span className="text-sm text-gray-600 dark:text-gray-300">All Industries</span>
                                </label>
                                {ALL_INDUSTRIES.map(ind => (
                                    <label key={ind} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="industry" checked={industryFilter === ind} onChange={() => setIndustryFilter(ind)} className="text-primary-600 focus:ring-primary-500" />
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{ind}</span>
                                    </label>
                                ))}
                            </div>
                        </Card>
                        
                        <Card className="sticky top-[420px]">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Building2 size={18} /> Subcontracting
                            </h3>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={subcontractingFilter} onChange={(e) => setSubcontractingFilter(e.target.checked)} className="text-primary-600 focus:ring-primary-500 rounded border-slate-300" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Available for B2B Overflow</span>
                            </label>
                            <p className="text-xs text-slate-500 mt-2 ml-6">Only show businesses that accept subcontractor roles.</p>
                        </Card>
                    </div>

                    <div className="flex-1">
                        <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {filteredAndSortedProviders.length} Providers Found
                            </h2>
                            <div className="flex items-center gap-2">
                                <label htmlFor="sort-by" className="text-sm font-medium text-slate-600 dark:text-slate-400">Sort by:</label>
                                <Select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'rating' | 'name')} className="text-sm">
                                    <option value="rating">Top Rated</option>
                                    <option value="name">Name (A-Z)</option>
                                </Select>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-20 text-slate-500">Loading directory...</div>
                        ) : filteredAndSortedProviders.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
                                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No providers found</h3>
                                <p className="text-slate-500">Try adjusting your search criteria, or check back later!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {filteredAndSortedProviders.map(org => (
                                    <div key={org.id} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col md:flex-row gap-6">
                                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-xl flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <img src={org.settings?.publicLogoUrl || org.logoUrl || '/img/logo_placeholder.png'} alt={`${org.name} logo`} className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.src = '/img/logo_placeholder.png'; }} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex flex-col sm:flex-row justify-between items-start">
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 hover:text-primary-600 transition-colors">
                                                        <Link to={`/marketplace/${org.id}`}>{org.name}</Link>
                                                    </h3>
                                                    <div className="flex wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 mb-2">
                                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{org.industry}</span>
                                                        <span className="hidden sm:inline">•</span>
                                                        {org.address && <span className="flex items-center gap-1"><MapPin size={14} /> {org.address?.city}, {org.address?.state}</span>}
                                                    </div>
                                                    {org.settings?.publicDescription && (
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mt-3">
                                                            {org.settings.publicDescription}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right flex-shrink-0 mt-2 sm:mt-0">
                                                    {org.averageRating !== null ? (
                                                        <div className="flex items-center gap-1 text-amber-400 font-bold text-sm justify-end">
                                                            <Star size={16} fill="currentColor" />
                                                            <span>{org.averageRating.toFixed(1)}</span>
                                                            <span className="text-slate-400 font-normal ml-1">({org.reviewCount})</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">No Reviews Yet</div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {((org.settings?.publicCredentials && org.settings.publicCredentials.length > 0) || org.isVerified || org.isLeadingPro || org.acceptsSubcontracting) && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {org.isVerified && (
                                                        <div className="flex items-center bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-semibold px-2 py-1 rounded-full">
                                                            <BadgeCheck size={14} className="mr-1.5" />
                                                            <span>Verified Pro</span>
                                                        </div>
                                                    )}
                                                    {org.isLeadingPro && (
                                                        <div className="flex items-center bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-bold px-2 py-1 rounded-full border border-amber-300 dark:border-amber-700 shadow-sm">
                                                            <Star size={14} className="mr-1 drop-shadow-sm fill-current" />
                                                            <span>Leading Pro</span>
                                                        </div>
                                                    )}
                                                    {org.acceptsSubcontracting && (
                                                        <div className="flex items-center bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-2 py-1 rounded-full border border-indigo-300 dark:border-indigo-700 shadow-sm">
                                                            <Briefcase size={14} className="mr-1 drop-shadow-sm" />
                                                            <span>Accepts Subcontracting B2B</span>
                                                        </div>
                                                    )}
                                                    {org.settings?.publicCredentials?.map((cred, index) => (
                                                        <div key={index} className="flex items-center bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 text-xs font-semibold px-2 py-1 rounded-full">
                                                            <BadgeCheck size={14} className="mr-1.5" />
                                                            <span>{cred}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                                <Button onClick={() => navigate(`/marketplace/${org.id}`)} className="flex-1 md:flex-none px-6">View Profile</Button>
                                                <Button variant="outline" onClick={() => handleOpenBookingModal(org)} className="flex-1 md:flex-none px-6">
                                                    <Calendar size={16} className="mr-2"/>
                                                    Book Appointment
                                                </Button>
                                                <Button variant="secondary" onClick={() => handleOpenContactModal(org)} className="flex-1 md:flex-none px-6">
                                                    <MessageSquare size={16} className="mr-2"/>
                                                    Contact
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={isContactModalOpen} onClose={closeContactModal} title={`Contact ${contactOrg?.name}`}>
                 <div className="space-y-4">
                    <p className='text-sm text-slate-500'>Your message will be sent directly to {contactOrg?.name}.</p>
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

             <Modal isOpen={isBookingModalOpen} onClose={closeBookingModal} title={`Book Appointment with ${bookingOrg?.name}`}>
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
        </div>
    );
};

export default ProviderDirectory;
