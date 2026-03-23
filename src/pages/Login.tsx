
import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { User, Organization, PlatformSettings } from 'types';
import { CheckCircle, ShieldCheck, Smartphone } from 'lucide-react';
import { LogoIcon, Logo } from 'components/ui/Logo';
import { LoginForm } from 'components/auth/LoginForm';
import { ForgotPasswordForm } from 'components/auth/ForgotPasswordForm';
import { UserRegistrationForm } from 'components/auth/UserRegistrationForm';
import { BusinessRegistrationForm } from 'components/auth/BusinessRegistrationForm';

const LoginPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'login' | 'register_business' | 'register_user' | 'forgot_password'>('login');
  
  // Business Registration Steps
  const [bizRegStep, setBizRegStep] = useState<1 | 2>(1);
  
  const [userType, setUserType] = useState<'staff' | 'customer'>('staff');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Business Reg State
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isValidPromo, setIsValidPromo] = useState(false);
  const [promoDurationMonths, setPromoDurationMonths] = useState(12);

  // Payment Mock State
  const [ccName, setCcName] = useState('');
  const [ccNumber, setCcNumber] = useState('');
  const [ccExp, setCcExp] = useState('');
  const [ccCvc, setCcCvc] = useState('');

  // User Reg State
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  
  // Consent Checkboxes
  const [consentGiven, setConsentGiven] = useState(false);
  
  // Customer Specific Reg State
  const [userAddress, setUserAddress] = useState('');
  const [userCity, setUserCity] = useState('');
  const [userState, setUserState] = useState('');
  const [userZip, setUserZip] = useState('');
  const [userServiceNeed, setUserServiceNeed] = useState('Community');

  // Org Signup Plan State
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'growth' | 'enterprise'>('starter');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Branding State
  const [brandedOrgName, setBrandedOrgName] = useState('TekTrakker');
  const [brandColor, setBrandColor] = useState('#2563eb'); 
  const [isBranded, setIsBranded] = useState(false);
  const [referredOrgId, setReferredOrgId] = useState<string | null>(null);

  // Near Me Orgs
  const [selectedNearbyOrg, setSelectedNearbyOrg] = useState<string>('');

  const handleVerifyPromo = async () => {
      if (!promoCode.trim()) return;
      setIsLoading(true);
      setError('');
      try {
          const qSnap = await db.collection('promoCodes')
            .where('code', '==', promoCode.trim().toUpperCase())
            .where('isActive', '==', true)
            .limit(1)
            .get();
          
          if (!qSnap.empty) {
              const promoData = qSnap.docs[0].data();
              setIsValidPromo(true);
              setPromoDurationMonths(promoData.durationMonths || 12);
              setSuccessMsg(`Promo code applied successfully! Billing info bypassed for ${promoData.durationMonths || 12} months.`);
          } else {
              setIsValidPromo(false);
              setError("Invalid or expired promo code.");
          }
      } catch (err) {
          console.error("Promo verify error", err);
          setError("Failed to verify promo code.");
      } finally {
          setIsLoading(false);
      }
  };

  // Fail-safe to unlock UI if global state clears
  useEffect(() => {
    if (!state.loading && isLoading) {
      setIsLoading(false);
    }
  }, [state.loading]);

  useEffect(() => {
      // 1. Check for 'view' param
      const viewParam = searchParams.get('view');
      if (viewParam === 'register_business' || viewParam === 'register_user' || viewParam === 'login') {
          setView(viewParam as any);
      }

      // 2. Fetch platform settings for public pages
      if (!state.platformSettings) {
          db.collection('platformSettings').limit(1).get().then(snapshot => {
              if (!snapshot.empty) {
                  const settings = {id: snapshot.docs[0].id, ...snapshot.docs[0].data()} as PlatformSettings;
                  dispatch({ type: 'SET_PLATFORM_SETTINGS', payload: settings });
              }
          }).catch(console.error);
      }

      // 3. Check for 'oid' param
      const oid = searchParams.get('oid');
      if (oid) {
          setReferredOrgId(oid);
          const fetchOrg = async () => {
              try {
                  const doc = await db.collection('organizations').doc(oid).get();
                  if (doc.exists) {
                      const data = doc.data();
                      if (data) {
                          setBrandedOrgName(data.name || 'TekTrakker');
                          if (data.primaryColor) setBrandColor(data.primaryColor);
                          setIsBranded(true);
                      }
                  }
              } catch (e) {
                  console.warn("Branding load failed", e);
              }
          };
          fetchOrg();
      }
  }, [searchParams, dispatch, state.platformSettings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
        const trimmedEmail = email.trim().toLowerCase();
        const creds = await auth.signInWithEmailAndPassword(trimmedEmail, password);
        const uid = creds.user?.uid;

        if (uid) {
             // Wrapped in try/catch to safely handle potential permission issues with profile fetching
             try {
                 const userDoc = await db.collection('users').doc(uid).get();
                 
                 if (userDoc.exists) {
                     const userData = userDoc.data() as User;

                     // UPDATE LOGIN TIMESTAMP
                     try {
                        await db.collection('users').doc(uid).update({
                            lastLoginAt: new Date().toISOString()
                        });
                     } catch (updateErr) {
                         console.warn("Failed to update lastLoginAt", updateErr);
                     }
                     
                     if (userData.role === 'platform_sales') {
                         window.location.href = '/#/sales/dashboard';
                         window.location.reload();
                         return;
                     }

                     // Account repair check for existing users
                     if (userData.role === 'employee' || !userData.organizationId || userData.organizationId === 'unaffiliated') {
                          try {
                              let inviteDoc = await db.collection('users').doc(trimmedEmail).get();
                              
                              if (!inviteDoc.exists) {
                                   const qSnap = await db.collection('users').where('email', '==', trimmedEmail).get();
                                   if (!qSnap.empty) {
                                       const found = qSnap.docs.find(d => d.id !== uid);
                                       if (found) inviteDoc = found;
                                   }
                              }

                              if (inviteDoc.exists && inviteDoc.id !== uid) {
                                  const inviteData = inviteDoc.data();
                                  if (inviteData && (inviteData.role !== userData.role || (inviteData.organizationId && inviteData.organizationId !== userData.organizationId))) {
                                      await db.collection('users').doc(uid).update({
                                          role: inviteData.role || 'employee',
                                          organizationId: inviteData.organizationId || 'unaffiliated',
                                          firstName: inviteData.firstName || userData.firstName,
                                          lastName: inviteData.lastName || userData.lastName
                                      });
                                      await db.collection('users').doc(inviteDoc.id).delete();
                                      window.location.reload(); 
                                      return;
                                  }
                              }
                          } catch (repairErr) {
                              console.warn("Account repair check skipped", repairErr);
                          }
                     }
                 }
             } catch (fetchErr) {
                 console.error("Profile Fetch Error:", fetchErr);
             }
        }
        
        setTimeout(() => {
            if (isLoading) setIsLoading(false);
        }, 12000);
    } catch (authError: any) {
        console.error("Login Error:", authError);
        setError(authError.message || "Invalid credentials. Please try again.");
        setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccessMsg('');
      setIsLoading(true);
      try {
          await auth.sendPasswordResetEmail(email.trim().toLowerCase());
          setSuccessMsg("Reset link sent! Please check your email inbox.");
      } catch (err: any) {
          setError(err.message || "Failed to send reset email.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!consentGiven) {
          setError("You must agree to receive communications to register.");
          return;
      }
      setError('');
      setIsLoading(true);
      
      const normalizedEmail = email.trim().toLowerCase();
      let finalOrgId = referredOrgId || selectedNearbyOrg;

      if (userType === 'customer' && !finalOrgId && userZip) {
          try {
              const orgsSnap = await db.collection('organizations').where('zip', '==', userZip).limit(1).get();
              if (!orgsSnap.empty) {
                  finalOrgId = orgsSnap.docs[0].id;
              }
          } catch (err) {
              console.warn("Auto-match org failed", err);
          }
      }

      try {
          const userCredential = await auth.createUserWithEmailAndPassword(normalizedEmail, password);
          const user = userCredential.user;

          if (user) {
              let existingData: any = null;
              let foundInviteId = '';
              
              // Wait for auth propagation to ensure rules allow reading invite
              await new Promise(r => setTimeout(r, 4000));

              // 1. Try direct fetch by Email ID
              try {
                  // Try explicit lowercase ID first (standard)
                  let inviteDoc = await db.collection('users').doc(normalizedEmail).get();
                  if (inviteDoc.exists) {
                      existingData = inviteDoc.data();
                      foundInviteId = inviteDoc.id;
                  } 
              } catch (e) {
                 console.warn("Invite direct lookup failed. Permissions likely blocked until profile created.", e);
              }
              
              // 2. Fallback: Query by email field if direct lookup failed
              if (!existingData) {
                  try {
                       const qSnap = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
                       if (!qSnap.empty) {
                           const found = qSnap.docs.find(d => d.id !== user.uid);
                           if (found) {
                               existingData = found.data();
                               foundInviteId = found.id;
                           }
                       }
                  } catch (queryErr) {
                      console.warn("Invite query failed (often expected for new users):", queryErr);
                  }
              }
              
              const nameParts = userName.trim().split(' ');
              
              // Construct address strictly to ensure no undefined values
              // Use null for missing values to satisfy Firestore
              const safeAddress = userType === 'customer' 
                  ? {
                      street: userAddress || '',
                      city: userCity || '',
                      state: userState || '',
                      zip: userZip || ''
                  }
                  : null; // Changed from undefined to null

              // Use invite data if found, otherwise default to unaffiliated
              const targetOrgId = existingData?.organizationId || finalOrgId || 'unaffiliated';
              
              const marketingConsent = {
                  sms: true,
                  email: true,
                  agreedAt: new Date().toISOString(),
                  source: 'Registration'
              };

              const newUserProfile: User = {
                  id: user.uid,
                  uid: user.uid,
                  organizationId: targetOrgId,
                  email: normalizedEmail,
                  firstName: nameParts[0] || existingData?.firstName || (normalizedEmail.split('@')[0]),
                  lastName: nameParts.slice(1).join(' ') || existingData?.lastName || '',
                  phone: userPhone || existingData?.phone || '',
                  role: (existingData?.role || (userType === 'customer' ? 'customer' : 'employee')) as User['role'],
                  status: 'active',
                  username: normalizedEmail.split('@')[0],
                  preferences: { theme: 'dark' },
                  hireDate: existingData?.hireDate || new Date().toISOString(),
                  payRate: existingData?.payRate || 0,
                  ptoAccrued: existingData?.ptoAccrued || 0,
                  handbookSignedDate: existingData?.handbookSignedDate || null,
                  address: safeAddress, // Now guaranteed object or null
                  marketingConsent: marketingConsent as any,
                  lastLoginAt: new Date().toISOString() // Set initial login time
              };

              // CREATE PROFILE (Even if invite failed)
              try {
                  // Explicitly use .set to create the profile, relying on 'allow create' rules
                  await db.collection('users').doc(user.uid).set(newUserProfile, { merge: true });
              } catch (profileError) {
                  console.error("Profile creation failed:", profileError);
                  throw new Error("Failed to create user profile. Please contact support.");
              }
              
              // Delete invite if we found it to clean up
              if (foundInviteId) {
                  await db.collection('users').doc(foundInviteId).delete().catch(() => {});
              }
              
              if (userType === 'customer') {
                  const custRef = db.collection('customers').doc(user.uid);
                  await custRef.set({
                      id: user.uid,
                      organizationId: newUserProfile.organizationId,
                      name: newUserProfile.firstName + (newUserProfile.lastName ? ' ' + newUserProfile.lastName : ''),
                      email: normalizedEmail,
                      customerType: 'Residential',
                      phone: userPhone || '',
                      address: userAddress || '',
                      city: userCity || '',
                      state: userState || '',
                      zip: userZip || '',
                      hvacSystem: { brand: '', type: 'Unknown' },
                      serviceHistory: [],
                      notes: `Joined via Portal. Interest: ${userServiceNeed}`,
                      marketingConsent: marketingConsent as any
                  }, { merge: true });
              }

              // EMAIL NOTIFICATION
              await db.collection('mail').add({
                  to: ['platform@tektrakker.com', 'ryanvavrecan@gmail.com'],
                  message: {
                      subject: `[New User] ${userType} Registration`,
                      text: `A new ${userType} user has registered.\n\nName: ${newUserProfile.firstName} ${newUserProfile.lastName}\nEmail: ${normalizedEmail}\nRole: ${newUserProfile.role}\nOrganization ID: ${newUserProfile.organizationId}`
                  },
                  organizationId: 'platform',
                  type: 'SystemAlert',
                  createdAt: new Date().toISOString()
              });

              let orgData: Organization = { id: 'unaffiliated', name: 'No Provider' } as Organization;
              try {
                  if (newUserProfile.organizationId && newUserProfile.organizationId !== 'unaffiliated') {
                      const orgDoc = await db.collection('organizations').doc(newUserProfile.organizationId).get();
                      if (orgDoc.exists) {
                          orgData = { ...orgDoc.data(), id: orgDoc.id } as Organization;
                      }
                  }
              } catch(e) {}
              
              dispatch({ type: 'LOGIN', payload: { user: newUserProfile, currentOrganization: orgData } });
          }
      } catch (err: any) {
          console.error(err);
          setError(err.message || "Registration failed.");
          setIsLoading(false);
      }
  };
  
  const handleNextStepBusiness = (e: React.FormEvent) => {
      e.preventDefault();
      // Validate Step 1
      if (!businessName || !ownerName || !email || !password || !businessPhone) {
          setError("Please fill out all required fields.");
          return;
      }
      if (!consentGiven) {
          setError("You must agree to the terms to proceed.");
          return;
      }
      setError('');

      if (isValidPromo) {
          // If bypass code is correct, skip CC step and register directly
          handleRegisterBusiness(e);
      } else {
          setBizRegStep(2);
      }
  };

  const handleRegisterBusiness = async (e: React.FormEvent) => {
      if (e) e.preventDefault();
      
      // Validate Step 2 (Only if NOT bypassing)
      if (!isValidPromo && (!ccNumber || !ccExp || !ccCvc)) {
          setError("Payment information is required for account setup.");
          return;
      }
      
      setError('');
      setIsLoading(true);
      const normalizedEmail = email.trim().toLowerCase();

      try {
          const userCredential = await auth.createUserWithEmailAndPassword(normalizedEmail, password);
          const user = userCredential.user;
          
          if (user) {
              const trialDays = 30;
              const monthsToFuture = isValidPromo ? promoDurationMonths : 1; 
              
              // For promos, we set expiry to X months from now. For regular trial, 30 days.
              const expiryDateObj = new Date();
              if (isValidPromo) {
                  expiryDateObj.setMonth(expiryDateObj.getMonth() + promoDurationMonths);
              } else {
                  expiryDateObj.setDate(expiryDateObj.getDate() + trialDays);
              }
              
              const expiryDate = expiryDateObj.toISOString().split('T')[0];
              const orgRef = db.collection('organizations').doc();
              const orgId = orgRef.id;

              const newOrgData: Organization = {
                  id: orgId,
                  name: businessName.trim() || 'New Organization',
                  phone: businessPhone.trim() || '',
                  email: normalizedEmail,
                  subscriptionStatus: isValidPromo ? 'active' : 'trial',
                  plan: selectedPlan,
                  subscriptionExpiryDate: expiryDate,
                  createdAt: new Date().toISOString(),
                  paymentMethodAttached: !isValidPromo, 
                  isFreeAccess: isValidPromo,
                  promoCode: isValidPromo ? promoCode.toUpperCase() : null,
                  enabledPanels: {
                      inventory: true,
                      marketing: true,
                      memberships: true,
                      documents: true,
                      time_tracking: true
                  }
              };

              const nameParts = ownerName.trim().split(' ');
              const marketingConsent = {
                  sms: true,
                  email: true,
                  agreedAt: new Date().toISOString(),
                  source: 'Registration'
              };

              const newUserProfile: User = {
                  id: user.uid, uid: user.uid, organizationId: orgId, email: normalizedEmail,
                  firstName: nameParts[0] || 'Admin', lastName: nameParts.slice(1).join(' ') || '',
                  phone: businessPhone.trim() || '',
                  role: (normalizedEmail === 'rodzelem@gmail.com' ? 'master_admin' : 'both') as User['role'], 
                  status: 'active', username: normalizedEmail.split('@')[0],
                  preferences: { theme: 'dark' }, payRate: 0, ptoAccrued: 0,
                  marketingConsent: marketingConsent as any,
                  lastLoginAt: new Date().toISOString() // Set initial login time
              };
              
              const batch = db.batch();
              batch.set(orgRef, newOrgData);
              batch.set(db.collection('users').doc(user.uid), newUserProfile); 
              await batch.commit();
              
              // EMAIL NOTIFICATION TO PLATFORM
              await db.collection('mail').add({
                  to: ['platform@tektrakker.com', 'ryanvavrecan@gmail.com'],
                  message: {
                      subject: `[New Organization] ${newOrgData.name} ${isValidPromo ? '(Promo Bypass)' : '(Paid)'}`,
                      text: `A new organization has signed up.\n\nOrg Name: ${newOrgData.name}\nAdmin: ${newUserProfile.firstName} ${newUserProfile.lastName}\nEmail: ${normalizedEmail}\nPlan: ${selectedPlan}\nPayment Info Collected: ${!isValidPromo ? 'YES' : 'NO (Promo Code: ' + promoCode + ', Duration: ' + promoDurationMonths + 'mo)'}\nSource: Public Site Registration`
                  },
                  organizationId: 'platform',
                  type: 'SystemAlert',
                  createdAt: new Date().toISOString()
              });

              dispatch({ type: 'LOGIN', payload: { user: newUserProfile, currentOrganization: newOrgData } });
          }
      } catch (regError: any) {
          setError(`${regError.message}`);
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start p-4 font-sans relative overflow-y-auto py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full blur-[120px] mix-blend-screen opacity-20" style={{ backgroundColor: brandColor }} />
          <div className="absolute bottom-[0%] -right-[10%] w-[60vw] h-[60vw] bg-indigo-600/10 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-8 cursor-pointer" onClick={() => navigate('/')}>
            {isBranded ? (
                <>
                    <div className="inline-flex items-center justify-center p-4 rounded-2xl shadow-2xl shadow-blue-500/20 mb-6 bg-slate-900 border border-slate-700">
                        <LogoIcon className="w-16 h-16" />
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">{brandedOrgName}</h1>
                </>
            ) : (
                <div className="flex justify-center mb-6">
                    <Logo className="h-20 w-auto" />
                </div>
            )}
            <p className="text-slate-400 text-sm mb-8">{view === 'login' ? 'Sign in to access your dashboard' : view === 'register_business' ? 'Start your 14-day free trial' : 'Create your account'}</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-4 md:p-8 rounded-3xl shadow-2xl">
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                    <ShieldCheck size={16} /> {error}
                </div>
            )}
            {successMsg && (
                <div className="bg-green-500/10 border border-green-500/50 text-green-200 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                    <CheckCircle size={16} /> {successMsg}
                </div>
            )}

            {view === 'login' && (
                <LoginForm 
                    email={email} setEmail={setEmail} 
                    password={password} setPassword={setPassword} 
                    handleLogin={handleLogin} isLoading={isLoading} 
                    brandColor={brandColor} setView={setView} setUserType={setUserType} 
                />
            )}

            {view === 'register_user' && (
                <UserRegistrationForm 
                    userType={userType} setUserType={setUserType} userName={userName} setUserName={setUserName} 
                    userPhone={userPhone} setUserPhone={setUserPhone} email={email} setEmail={setEmail} 
                    password={password} setPassword={setPassword} userAddress={userAddress} setUserAddress={setUserAddress} 
                    userCity={userCity} setUserCity={setUserCity} userState={userState} setUserState={setUserState} 
                    userZip={userZip} setUserZip={setUserZip} userServiceNeed={userServiceNeed} setUserServiceNeed={setUserServiceNeed} 
                    consentGiven={consentGiven} setConsentGiven={setConsentGiven} handleRegisterUser={handleRegisterUser} 
                    isLoading={isLoading} brandColor={brandColor} setView={setView} 
                />
            )}

            {view === 'register_business' && (
                <BusinessRegistrationForm 
                    bizRegStep={bizRegStep} setBizRegStep={setBizRegStep} businessName={businessName} setBusinessName={setBusinessName} 
                    ownerName={ownerName} setOwnerName={setOwnerName} businessPhone={businessPhone} setBusinessPhone={setBusinessPhone} 
                    email={email} setEmail={setEmail} password={password} setPassword={setPassword} promoCode={promoCode} setPromoCode={setPromoCode}
                    selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} platformSettings={state.platformSettings} 
                    consentGiven={consentGiven} setConsentGiven={setConsentGiven} ccName={ccName} setCcName={setCcName} 
                    ccNumber={ccNumber} setCcNumber={setCcNumber} ccExp={ccExp} setCcExp={setCcExp} ccCvc={ccCvc} setCcCvc={setCcCvc} 
                    handleNextStepBusiness={handleNextStepBusiness} handleRegisterBusiness={handleRegisterBusiness} isLoading={isLoading} 
                    brandColor={brandColor} setView={setView} 
                    handleVerifyPromo={handleVerifyPromo} isValidPromo={isValidPromo}
                />
            )}

            {view === 'forgot_password' && (
                <ForgotPasswordForm 
                    email={email} setEmail={setEmail} handleForgotPassword={handleForgotPassword} 
                    isLoading={isLoading} brandColor={brandColor} setView={setView} 
                />
            )}

        </div>

        <div className="mt-8 flex justify-center">
            <a href="/tektrakker.zip" className="flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-slate-300 hover:text-white" download>
                <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Smartphone size={20} className="text-blue-400"/>
                </div>
                <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Direct Download</p>
                    <p className="text-sm font-bold">TekTrakker Android APK</p>
                </div>
            </a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
