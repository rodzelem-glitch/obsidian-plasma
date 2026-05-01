import showToast from "lib/toast";
import React, { useState, useRef } from 'react';
import { Network, ArrowRight, CheckCircle2, ShieldCheck, Mail, Lock, Building, Map, CreditCard, ChevronLeft, Globe, Loader2 } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';

const FranchiseOpportunities: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Account
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    // Step 2: Franchise Details
    const [franchiseName, setFranchiseName] = useState('');
    const [domain, setDomain] = useState('');
    const [brandColor, setBrandColor] = useState('#3b82f6');
    const [territory, setTerritory] = useState('');
    const [businessTypes, setBusinessTypes] = useState('');

    // Step 3: Signature
    const signatureRef = useRef<HTMLCanvasElement>(null);
    const [signatureData, setSignatureData] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = signatureRef.current;
        if (canvas) {
            canvas.getContext('2d')?.beginPath();
            setSignatureData(canvas.toDataURL());
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = signatureRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        // @ts-ignore
        const clientX = e.clientX || e.touches[0].clientX;
        // @ts-ignore
        const clientY = e.clientY || e.touches[0].clientY;

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
    };

    const clearSignature = () => {
        const canvas = signatureRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setSignatureData('');
        }
    };

    const handleSubmit = async () => {
        if (!signatureData) {
            showToast.warn('Please sign the agreement to proceed.');
            return;
        }

        try {
            setLoading(true);

            // 1. For demonstration and security, we create the auth user
            const credential = await auth.createUserWithEmailAndPassword(email, password);
            if (!credential.user) throw new Error("Failed to create auth user");

            // 2. Create the Franchise Silhouette
            const franchiseRef = await db.collection('franchises').add({
                name: franchiseName,
                ownerUserId: credential.user.uid,
                branding: {
                    customDomain: domain,
                    primaryColorHex: brandColor,
                    logoUrl: '' // Can upload later
                },
                apiKeys: {
                    activeProvider: 'tektrakker'
                },
                constraints: {
                    territoryStates: territory.split(',').map(s => s.trim()),
                    allowedBusinessTypes: businessTypes.split(',').map(s => s.trim())
                },
                billing: {
                    agreementSigned: true,
                    setupFeePaid: true,
                    monthlyFee: 1000,
                    perUserFee: 10,
                    signatureBase64: signatureData
                },
                createdAt: new Date().toISOString()
            });

            // 3. Create the User Document as Franchise Admin
            await db.collection('users').doc(credential.user.uid).set({
                id: credential.user.uid,
                email: email,
                firstName: firstName,
                lastName: lastName,
                role: 'franchise_admin',
                franchiseId: franchiseRef.id,
                organizationId: 'master_admin_placeholder', // Skips standard org enforcement
                createdAt: new Date().toISOString()
            });

            showToast.warn('Welcome aboard! Your Franchise Portal is being provisioned. Please contact our DNS team to point your domain.');
            navigate('/master/dashboard');

        } catch (e: any) {
            console.error("Signup error:", e);
            if (e.code === 'auth/email-already-in-use') {
                showToast.warn('That email is already registered. Please use a different email or log in.');
            } else if (e.code === 'auth/weak-password') {
                showToast.warn('The password is too weak. Please use at least 6 characters.');
            } else {
                showToast.warn('Error processing enrollment transaction: ' + e.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-xl text-primary-600 dark:text-primary-400 cursor-pointer" onClick={() => navigate('/')}>
                        <Network /> TekTrakker White-Label
                    </div>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-4 py-12">
                <div className="max-w-4xl w-full">
                    {/* Stepper Header */}
                    <div className="flex items-center justify-center mb-12">
                        {[1, 2, 3, 4].map(num => (
                            <React.Fragment key={num}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= num ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                    {num}
                                </div>
                                {num < 4 && <div className={`w-16 h-1 ${step > num ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">

                        {/* STEP 1: PITCH & ACCOUNT */}
                        {step === 1 && (
                            <div className="p-8 md:p-12 animate-fade-in">
                                <div className="text-center mb-10">
                                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Build your own business. <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">Grow for yourself.</span></h1>
                                    <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
                                        Stop making everyone else rich. Step out of the truck and into ownership with a fully established, turnkey operational system designed to help you build generational wealth under your own trusted local brand.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
                                    <div className="space-y-8">
                                        <div className="flex gap-4 group">
                                            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-primary-200 transition-all">
                                                <Building className="text-primary-600 dark:text-primary-400" size={32} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-black text-xl text-slate-900 dark:text-white mb-1">True Ownership & Generational Wealth</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">We provide the enterprise dispatching, automated billing, and AI infrastructure. You build an asset with absolute equity that can be passed down to your kids.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 group">
                                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-emerald-200 transition-all">
                                                <Globe className="text-emerald-600 dark:text-emerald-400" size={32} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-black text-xl text-slate-900 dark:text-white mb-1">Your Name, Your Brand</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Unlike traditional franchises that rent you a brand name, our system is 100% white-labeled. The customers see your logo, your colors, and your custom domain.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 group">
                                            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-indigo-200 transition-all">
                                                <Network className="text-indigo-600 dark:text-indigo-400" size={32} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-black text-xl text-slate-900 dark:text-white mb-1">Turnkey Corporate Infrastructure</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Instantly access our custom-built CRM, routing algorithms, payroll tracking, and consumer financing hooks. Skip the 5-year learning curve and start operating on day one.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <h3 className="font-bold text-xl mb-6 dark:text-white flex items-center gap-2"><Lock size={20} /> Create Master Account</h3>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3" />
                                                <input type="text" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3" />
                                            </div>
                                            <input type="email" placeholder="Business Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3" />
                                            <input type="password" placeholder="Secure Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3" />
                                            <button
                                                disabled={!email || !password || !firstName || !lastName}
                                                onClick={() => setStep(2)}
                                                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 mt-4 transition-all disabled:opacity-50"
                                            >
                                                Configure Branding <ArrowRight size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: BRANDING & TERRITORY */}
                        {step === 2 && (
                            <div className="p-8 md:p-12 animate-fade-in relative">
                                <button onClick={() => setStep(1)} className="absolute top-8 left-8 text-slate-400 hover:text-slate-600 flex items-center gap-1"><ChevronLeft size={20} /> Back</button>

                                <div className="text-center mb-10 max-w-2xl mx-auto mt-8">
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Carve Your Territory.</h2>
                                    <p className="text-slate-500">Define your white-labeled brand identity and geographical constraints.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                                    <div className="space-y-5">
                                        <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">Franchise Identity</h3>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Franchise Name</label>
                                            <input type="text" value={franchiseName} onChange={e => setFranchiseName(e.target.value)} placeholder="e.g. Apex Field Services" className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Custom Domain Target</label>
                                            <input type="text" value={domain} onChange={e => setDomain(e.target.value)} placeholder="portal.apexservices.com" className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Brand Primary Color</label>
                                            <div className="flex gap-3 mt-1">
                                                <input type="color" title="Brand Primary Color" aria-label="Brand Primary Color" placeholder="Color Picker" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-12 h-12 rounded cursor-pointer" />
                                                <input type="text" title="Brand Primary Color Hex" aria-label="Brand Primary Color Hex" placeholder="#3B82F6" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 uppercase font-mono text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-5">
                                        <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2"><Map size={18} /> Territory Request</h3>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Requested US States (Not Guaranteed Exclusive)</label>
                                            <input type="text" value={territory} onChange={e => setTerritory(e.target.value)} placeholder="FL, GA, SC" className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase">Target Industries</label>
                                            <input type="text" value={businessTypes} onChange={e => setBusinessTypes(e.target.value)} placeholder="HVAC, Plumbing" className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 flex justify-center">
                                    <button
                                        disabled={!franchiseName || !domain}
                                        onClick={() => setStep(3)}
                                        className="w-full max-w-md bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        Review Master Agreement <ArrowRight size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: CONTRACT & SIGNATURE */}
                        {step === 3 && (
                            <div className="p-8 md:p-12 animate-fade-in relative">
                                <button onClick={() => setStep(2)} className="absolute top-8 left-8 text-slate-400 hover:text-slate-600 flex items-center gap-1"><ChevronLeft size={20} /> Back</button>

                                <div className="text-center mb-8 max-w-2xl mx-auto mt-8">
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Master Services Agreement</h2>
                                    <p className="text-slate-500">Please review and digitally sign the 1-Year Franchise Agreement.</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 h-64 overflow-y-auto mb-8 text-sm text-slate-700 dark:text-slate-300 space-y-4 shadow-inner">
                                    <h3 className="font-bold text-lg">1. GRANT OF LICENSE</h3>
                                    <p>Subject to the terms herein, TekTrakker grants {franchiseName || '[Franchisee]'} a revocable license to distribute the platform.</p>

                                    <h3 className="font-bold text-lg">2. FEES & PAYMENTS</h3>
                                    <p>A non-refundable setup fee of $1,500 is due at signing. Subscription is $1,000/month flat fee plus $10/active user. Term is 1-year minimum.</p>

                                    <h3 className="font-bold text-lg text-red-600">3. DEFAULT CLAUSE</h3>
                                    <p>If {franchiseName || '[Franchisee]'} is over 15 days in arrears, ALL end-users, data, and recurring revenue pipelines revert to TekTrakker master ownership. You expressly waive damage claims.</p>

                                    <p className="text-xs text-slate-400 pt-8 italic">Full digital contract applies. <a href="/#/franchise-agreement" target="_blank" className="text-primary-600 hover:underline">Click here to read the full Master Service Agreement</a>. By signing this document, you acknowledge reading and understanding all reversion clauses.</p>
                                </div>

                                <div className="max-w-md mx-auto">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Digital Signature (Draw below)</label>
                                    <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden relative">
                                        <canvas
                                            ref={signatureRef}
                                            width={400}
                                            height={150}
                                            className="w-full h-full cursor-crosshair touch-none"
                                            onMouseDown={startDrawing}
                                            onMouseUp={stopDrawing}
                                            onMouseOut={stopDrawing}
                                            onMouseMove={draw}
                                            onTouchStart={startDrawing}
                                            onTouchEnd={stopDrawing}
                                            onTouchMove={draw}
                                        />
                                        <div className="absolute bottom-2 right-2 flex gap-2">
                                            <button onClick={clearSignature} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded">Clear</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 flex justify-center">
                                    <button
                                        disabled={!signatureData}
                                        onClick={() => setStep(4)}
                                        className="w-full max-w-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        Sign & Proceed to Payment <CheckCircle2 size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: PAYMENT MOCK */}
                        {step === 4 && (
                            <div className="p-8 md:p-12 animate-fade-in relative text-center">
                                <button onClick={() => setStep(3)} className="absolute top-8 left-8 text-slate-400 hover:text-slate-600 flex items-center gap-1"><ChevronLeft size={20} /> Back</button>

                                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CreditCard size={40} />
                                </div>

                                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Finalize Setup & Remit Payment</h2>
                                <p className="text-slate-500 mb-8 max-w-md mx-auto">To initiate your DNS configuration and compile your white-label instance, the non-refundable deployment payment is required immediately.</p>

                                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 max-w-md mx-auto border border-slate-200 dark:border-slate-700 mb-8 shadow-sm text-left">
                                    <div className="flex justify-between items-center mb-4 text-sm font-medium">
                                        <span className="text-slate-500">Product Line</span>
                                        <span className="text-slate-900 dark:text-white text-right">White-Label PAAS License</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-4 text-sm font-medium border-b border-dashed border-slate-200 dark:border-slate-600 pb-4">
                                        <span className="text-slate-500">Contract Term</span>
                                        <span className="text-slate-900 dark:text-white text-right font-bold text-red-600 dark:text-red-400">12 Months (Minimum)</span>
                                    </div>

                                    <div className="flex justify-between items-center mt-4 mb-2 text-sm font-medium">
                                        <span className="text-slate-600 dark:text-slate-400">Infrastructure Setup Fee</span>
                                        <span className="text-slate-900 dark:text-white text-right">$1,500.00</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-4 text-sm font-medium">
                                        <span className="text-slate-600 dark:text-slate-400">First Month Retainer</span>
                                        <span className="text-slate-900 dark:text-white text-right">$1,000.00</span>
                                    </div>

                                    <div className="border-t-2 border-slate-200 dark:border-slate-700 pt-4 flex justify-between items-center font-black text-xl">
                                        <span className="text-slate-900 dark:text-white">Total Due Today</span>
                                        <span className="text-primary-600 dark:text-primary-400">$2,500.00</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-3 text-center uppercase tracking-wide">100% NON-REFUNDABLE PURSUANT TO SECTION 3</p>
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="w-full max-w-md mx-auto bg-[#0070BA] hover:bg-[#005ea6] text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all shadow-lg shadow-blue-500/30"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : 'Pay $2,500 with PayPal & Launch'}
                                </button>
                                <p className="text-xs text-slate-400 mt-4 max-w-md mx-auto">This simulates the Stripe/PayPal redirect. Clicking immediately charges $2,500 and launches the provisioning architecture.</p>
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
};

export default FranchiseOpportunities;
