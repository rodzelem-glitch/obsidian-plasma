
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from 'lib/firebase';
import type { Organization, Address } from 'types';
import { Phone, Calendar, Star, MapPin, CheckCircle, ArrowRight, ShieldCheck, Clock, ExternalLink, Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';

const formatAddress = (addr: Address | string | undefined): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
}

interface BlogPost {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    published: boolean;
    slug?: string;
}

const OrganizationPublicSite: React.FC = () => {
    const { orgId } = useParams<{ orgId: string }>();
    const navigate = useNavigate();
    const [org, setOrg] = useState<Organization | null>(null);
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrgAndBlog = async () => {
            if (!orgId) return;
            try {
                // Fetch Organization
                const doc = await db.collection('organizations').doc(orgId).get();
                if (doc.exists) {
                    const data = { ...doc.data(), id: doc.id } as Organization;
                    setOrg(data);
                    
                    // Fetch Blog Posts
                    const postsSnapshot = await db.collection('organizations').doc(orgId).collection('blogPosts')
                        .where('published', '==', true)
                        .get();
                    
                    const postsData = postsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
                    // Sort descending client side
                    postsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setBlogPosts(postsData);
                    
                    const city = data.address?.city || '';
                    const state = data.address?.state || '';
                    const zip = data.address?.zip || '';
                    const street = data.address?.street || '';

                    // --- SEO & AI GROUNDING OPTIMIZATION ---
                    document.title = `${data.name} | ${city}, ${state} | Verified Pro`;
                    
                    const metaDesc = document.querySelector('meta[name="description"]');
                    if (metaDesc) {
                        metaDesc.setAttribute('content', `Professional ${data.industry || 'Service'} in ${city}. Licensed & Insured. Book online with ${data.name}.`);
                    }

                    // Inject JSON-LD Schema for LocalBusiness (AI Readable)
                    const schemaTypeMap: Record<string, string> = {
                        'HVAC': 'HVACBusiness',
                        'Plumbing': 'Plumber',
                        'Electrical': 'Electrician',
                        'Roofing': 'RoofingContractor',
                        'Landscaping': 'LandscapeService',
                        'Painting': 'HousePainter',
                        'Cleaning': 'HouseCleaning',
                        'Contracting': 'GeneralContractor',
                        'Masonry': 'ProfessionalService',
                        'Telecommunications': 'LocalBusiness',
                        'Solar': 'ProfessionalService',
                        'Security': 'ProfessionalService',
                        'Pet Grooming': 'PetStore',
                        'General': 'GeneralContractor'
                    };

                    const schemaData = {
                        "@context": "https://schema.org",
                        "@type": schemaTypeMap[data.industry || 'General'] || "ProfessionalService",
                        "name": data.name,
                        "image": data.logoUrl,
                        "telephone": data.phone,
                        "email": data.email,
                        "url": window.location.href,
                        "address": {
                            "@type": "PostalAddress",
                            "streetAddress": street,
                            "addressLocality": city,
                            "addressRegion": state,
                            "postalCode": zip,
                            "addressCountry": "US"
                        },
                        "geo": {
                            "@type": "GeoCoordinates",
                            // Placeholder logic; in prod, use actual lat/long from DB
                            "latitude": "37.7749", 
                            "longitude": "-122.4194"
                        },
                        "priceRange": "$$",
                        "paymentAccepted": "Cash, Credit Card, Check",
                        "sameAs": [
                            data.socialLinks?.facebook,
                            data.socialLinks?.instagram,
                            data.socialLinks?.linkedin,
                            data.socialLinks?.x,
                            data.socialLinks?.youtube,
                            data.website
                        ].filter(Boolean),
                        "openingHoursSpecification": [
                            {
                                "@type": "OpeningHoursSpecification",
                                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                                "opens": "08:00",
                                "closes": "18:00"
                            }
                        ]
                    };

                    // Remove existing injected schema if any
                    const existingScript = document.getElementById('org-schema');
                    if (existingScript) existingScript.remove();

                    const script = document.createElement('script');
                    script.id = 'org-schema';
                    script.type = 'application/ld+json';
                    script.text = JSON.stringify(schemaData);
                    document.head.appendChild(script);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrgAndBlog();
        
        return () => {
            document.title = 'TekTrakker Platform';
            const script = document.getElementById('org-schema');
            if (script) script.remove();
        };
    }, [orgId]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div></div>;
    if (!org) return <div className="min-h-screen flex items-center justify-center bg-white text-gray-500">Organization not found.</div>;

    const brandColor = org.primaryColor || '#0284c7';
    const city = org.address?.city || 'YOUR AREA';
    const state = org.address?.state || '';
    const zip = org.address?.zip || '';
    const street = org.address?.street || '';

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900">
            {/* Top Bar */}
            <div className="bg-slate-900 text-white text-xs py-2 px-4 text-center font-medium tracking-wide">
                SERVING {city.toUpperCase()} AND SURROUNDING COMMUNITIES
            </div>

            {/* Nav */}
            <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-50">
                <style dangerouslySetInnerHTML={{ __html: `
                    .bg-org-brand { background-color: ${brandColor} !important; }
                    .text-org-brand { color: ${brandColor} !important; }
                ` }} />
                <div className="max-w-6xl mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {org.logoUrl ? (
                            <img src={org.logoUrl} alt={org.name} className="h-10 w-auto object-contain" />
                        ) : (
                            <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center font-black text-xl text-slate-400">{org.name[0]}</div>
                        )}
                        <span className="font-bold text-xl tracking-tight hidden sm:block">{org.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href={`tel:${org.phone}`} className="hidden md:flex items-center gap-2 font-bold text-slate-600 hover:text-slate-900">
                            <Phone size={18} /> {org.phone}
                        </a>
                        <button 
                            onClick={() => navigate(`/book?oid=${org.id}`)}
                            className="bg-org-brand text-white font-bold text-sm px-6 py-3 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            Book Online
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <header className="relative bg-slate-50 py-24 px-6 overflow-hidden">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-100/50 skew-x-12 translate-x-20" />
                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-sm mb-6">
                            <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(i => <Star key={i} size={12} fill="#fbbf24" className="text-amber-400" />)}
                            </div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Top Rated Pro</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black mb-6 leading-tight text-slate-900">
                            Professional {org.industry || 'Service'} Solutions.
                        </h1>
                        <p className="text-xl text-slate-500 mb-8 leading-relaxed">
                            Reliable, licensed, and insured experts serving {city}, {state}. We get the job done right the first time.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => navigate(`/book?oid=${org.id}`)}
                                className="bg-org-brand h-14 px-4 md:px-8 rounded-xl font-bold text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                Schedule Service <Calendar size={18} />
                            </button>
                            {org.website && (
                                <a 
                                    href={org.website} 
                                    target="_blank" 
                                    rel="nofollow noopener noreferrer"
                                    className="h-14 px-4 md:px-8 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    Visit Website <ExternalLink size={18} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Trust Badges */}
            <section className="py-12 border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-center md:justify-start gap-8 md:gap-16 grayscale opacity-60">
                    <div className="flex items-center gap-2 font-bold text-slate-800"><ShieldCheck size={24}/> Licensed & Insured</div>
                    <div className="flex items-center gap-2 font-bold text-slate-800"><Clock size={24}/> 24/7 Emergency</div>
                    <div className="flex items-center gap-2 font-bold text-slate-800"><Star size={24}/> 5-Star Rated</div>
                    <div className="flex items-center gap-2 font-bold text-slate-800"><MapPin size={24}/> Local Expert</div>
                </div>
            </section>

            {/* Features/Services */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-black text-slate-900 mb-4">Why Choose {org.name}?</h2>
                        <p className="text-slate-500 max-w-2xl mx-auto">We combine old-school craftsmanship with modern technology to deliver the best service experience in town.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { title: 'Upfront Pricing', desc: 'No hidden fees. You approve the price before we start work.', icon: CheckCircle },
                            { title: 'Certified Techs', desc: 'Our team is rigorously trained, background checked, and certified.', icon: ShieldCheck },
                            { title: 'Satisfaction Guarantee', desc: 'We stand behind our work. If you are not happy, we make it right.', icon: Star }
                        ].map((feat, i) => (
                            <div key={i} className="p-4 md:p-8 bg-slate-50 rounded-3xl hover:shadow-lg transition-shadow duration-300">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6 text-slate-900">
                                    <feat.icon size={24} className="text-org-brand" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feat.title}</h3>
                                <p className="text-slate-500 leading-relaxed">{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Blog Section */}
            {blogPosts.length > 0 && (
                <section className="py-24 px-6 bg-slate-50 border-t border-slate-100">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-black text-slate-900 mb-4">Latest Articles</h2>
                            <p className="text-slate-500 max-w-2xl mx-auto">Tips, news, and updates from the {org.name} team.</p>
                        </div>
                        <div className="space-y-12">
                            {blogPosts.map(post => (
                                <article key={post.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                                    <h3 className="text-2xl font-bold mb-2 text-slate-900">{post.title}</h3>
                                    <div className="text-sm font-medium text-slate-400 mb-6 uppercase tracking-wider">
                                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                                    </div>
                                    <div className="prose prose-slate max-w-none prose-a:text-org-brand prose-headings:font-bold" dangerouslySetInnerHTML={{ __html: post.content }} />
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA Section */}
            <section className="py-24 px-6 relative overflow-hidden">
                <div className="absolute inset-0 z-0 bg-org-brand"></div>
                <div className="absolute inset-0 bg-black/10 z-0"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10 text-white">
                    <h2 className="text-4xl md:text-5xl font-black mb-6">Ready to get started?</h2>
                    <p className="text-xl opacity-90 mb-10">Book your appointment online in less than 60 seconds.</p>
                    <button 
                        onClick={() => navigate(`/book?oid=${org.id}`)}
                        className="bg-white text-slate-900 h-16 px-10 rounded-full font-black text-lg shadow-2xl hover:scale-105 transition-transform"
                    >
                        Book Now
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="col-span-1 md:col-span-2">
                        <h4 className="text-white font-bold text-xl mb-4">{org.name}</h4>
                        <p className="mb-4 max-w-sm">{street}<br/>{city}, {state} {zip}</p>
                        <a href={`tel:${org.phone}`} className="text-white font-bold hover:underline">{org.phone}</a>
                        
                        {/* Social Icons */}
                        <div className="flex gap-4 mt-6">
                            {org.socialLinks?.facebook && <a href={org.socialLinks.facebook} title="Facebook" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Facebook size={20}/></a>}
                            {org.socialLinks?.instagram && <a href={org.socialLinks.instagram} title="Instagram" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Instagram size={20}/></a>}
                            {org.socialLinks?.linkedin && <a href={org.socialLinks.linkedin} title="LinkedIn" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Linkedin size={20}/></a>}
                            {org.socialLinks?.x && <a href={org.socialLinks.x} title="X (Twitter)" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Twitter size={20}/></a>}
                            {org.socialLinks?.youtube && <a href={org.socialLinks.youtube} title="YouTube" target="_blank" rel="noopener noreferrer" className="hover:text-white"><Youtube size={20}/></a>}
                        </div>
                    </div>
                    <div>
                        <h5 className="text-white font-bold mb-4 uppercase text-xs tracking-widest">Company</h5>
                        <ul className="space-y-2 text-sm">
                            <li><a href={org.website || `#/pro/${org.id}`} className="hover:text-white">About Us</a></li>
                            <li><a href={`/careers/${org.id}`} className="hover:text-white">Careers</a></li>
                            {org.reviewLink && (
                                <li>
                                    <a href={org.reviewLink} target="_blank" rel="nofollow noopener noreferrer" className="hover:text-white">Reviews</a>
                                </li>
                            )}
                        </ul>
                    </div>
                    <div>
                        <h5 className="text-white font-bold mb-4 uppercase text-xs tracking-widest">Services</h5>
                        <ul className="space-y-2 text-sm">
                            <li><span className="hover:text-white cursor-default">Repairs</span></li>
                            <li><span className="hover:text-white cursor-default">Maintenance</span></li>
                            <li><span className="hover:text-white cursor-default">Installations</span></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-800 text-center text-xs">
                    &copy; {new Date().getFullYear()} {org.name}. Powered by TekTrakker.
                </div>
            </footer>
        </div>
    );
};

export default OrganizationPublicSite;
