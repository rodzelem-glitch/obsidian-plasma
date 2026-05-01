import showToast from "lib/toast";
import React, { useState, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
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
  const { state, dispatch, getRedirectPath } = useAppContext();
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
      // 1. Check for registration/invite params
      const viewParam = searchParams.get('view');
      const paramEmail = searchParams.get('email');
      const paramName = searchParams.get('name');
      const paramUserType = searchParams.get('userType');

      // If landing on /register or explicitly passed, show registration
      if (viewParam === 'register_user' || window.location.hash.includes('/register')) {
          setView('register_user');
      } else if (viewParam === 'register_business' || viewParam === 'login') {
          setView(viewParam as any);
      }

      if (paramEmail) setEmail(paramEmail);
      if (paramName) setUserName(paramName);
      if (paramUserType === 'customer' || paramUserType === 'staff') setUserType(paramUserType as any);

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

  const processLoggedInUser = async (uid: string, trimmedEmail: string, userData: User) => {
      // UPDATE LOGIN TIMESTAMP
      try {
          await db.collection('users').doc(uid).update({ lastLoginAt: new Date().toISOString() });
      } catch (updateErr) {
          console.warn("Failed to update lastLoginAt", updateErr);
      }
      
      // 1. SELF-HEALING: Normalize Email Casing
      if (userData.email && userData.email !== userData.email.toLowerCase()) {
          const lcEmail = userData.email.toLowerCase().trim();
          await db.collection('users').doc(uid).update({ email: lcEmail });
      }

      // 2. SELF-HEALING: Link Customer Record if missing
      if (userData.role === 'customer' && userData.organizationId && userData.organizationId !== 'unaffiliated') {
          try {
              const searchEmail = (userData.email || trimmedEmail).toLowerCase().trim();
              const uidDoc = await db.collection('customers').doc(uid).get();
              if (!uidDoc.exists) {
                  const linkedSnap = await db.collection('customers').where('userId', '==', uid).get();
                  if (linkedSnap.empty) {
                      const orgId = userData.organizationId;
                      const orgSnap = await db.collection('customers').where('organizationId', '==', orgId).get();
                      const match = orgSnap.docs.find(d => (d.data().email || '').toLowerCase().trim() === searchEmail);
                      if (match) {
                          console.log("Self-healing link during login for:", searchEmail);
                          await db.collection('customers').doc(match.id).update({ userId: uid });
                      }
                  }
              }
          } catch (cErr) {
              console.warn("Customer self-heal link failed", cErr);
          }
      }

      if (userData.role === 'platform_sales') {
          window.location.href = '/#/sales/dashboard';
          window.location.reload();
          return;
      }

      // Account repair check for existing users (Staff/Invite flow)
      if (userData.role !== 'customer' && (userData.role === 'employee' || !userData.organizationId || userData.organizationId === 'unaffiliated')) {
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
                  if (inviteData && (inviteData.role === 'employee' || inviteData.role === 'admin' || inviteData.role === 'supervisor')) {
                      if (inviteData.organizationId && inviteData.organizationId !== userData.organizationId) {
                          console.log("Repairing staff/admin account from invite:", inviteDoc.id);
                          await db.collection('users').doc(uid).update({
                              role: inviteData.role || userData.role,
                              organizationId: inviteData.organizationId,
                              firstName: inviteData.firstName || userData.firstName,
                              lastName: inviteData.lastName || userData.lastName
                          });
                          await db.collection('users').doc(inviteDoc.id).delete();
                          window.location.reload(); 
                          return;
                      }
                  }
              }
          } catch (repairErr) {
              console.warn("Account repair check skipped", repairErr);
          }
      }

      // Force imperative routing because the global AppContext lifecycle intersection is randomly stalling
      if (userData.role === 'admin' || userData.role === 'both' || userData.role === 'supervisor') {
          window.location.href = '/#/admin/dashboard';
          window.location.reload();
      } else if (userData.role === 'master_admin' || userData.role === 'franchise_admin') {
          window.location.href = '/#/master/dashboard';
          window.location.reload();
      } else if (userData.role === 'customer') {
            if (!userData.organizationId || userData.organizationId === 'unaffiliated') {
                window.location.href = '/#/marketplace';
            } else {
                window.location.href = '/#/portal';
            }
            window.location.reload();
      } else if (userData.role === 'employee') {
          window.location.href = '/#/briefing';
          window.location.reload();
      } else {
          window.location.href = '/#/marketplace';
          window.location.reload();
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
        const trimmedEmail = email.trim().toLowerCase();
        const creds = await auth.signInWithEmailAndPassword(trimmedEmail, password);
        const uid = creds.user?.uid;

        if (uid) {
             try {
                 const userDoc = await db.collection('users').doc(uid).get();
                 if (userDoc.exists) {
                     await processLoggedInUser(uid, trimmedEmail, userDoc.data() as User);
                 } else {
                     setError("User profile not properly initialized. Please contact support.");
                 }
             } catch (fetchErr) {
                 console.error("Profile Fetch Error:", fetchErr);
             }
        }
        setIsLoading(false);
    } catch (authError: any) {
        console.error("Login Error:", authError);
        setError(authError.message || "Invalid credentials. Please try again.");
        setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      setError('');
      setIsLoading(true);
      try {
          // Dynamic import of firebase compat bits to prevent module loading issues
          const importedFb = await import('firebase/compat/app');
          let result;

          if (Capacitor.isNativePlatform()) {
              const { SocialLogin } = await import('@capgo/capacitor-social-login');

              // Clear any stale tokens that cause Android Error 16 (Reauth Failed)
              try {
                  await SocialLogin.logout({ provider: 'google' });
              } catch (e) {
                  // Ignore logout errors if they weren't logged in
              }

              const authRes = await SocialLogin.login({
                  provider: 'google',
                  options: {
                      scopes: ['profile', 'email']
                  }
              });

              if (!authRes.result || !('idToken' in authRes.result) || !authRes.result.idToken) {
                 throw new Error("Native Google Sign-In failed to return an identity token.");
              }

              const credential = importedFb.default.auth.GoogleAuthProvider.credential(authRes.result.idToken as string);
              result = await auth.signInWithCredential(credential);
          } else {
              const provider = new importedFb.default.auth.GoogleAuthProvider();
              result = await auth.signInWithPopup(provider);
          }
          
          const uid = result.user?.uid;
          const trimmedEmail = (result.user?.email || '').trim().toLowerCase();

          if (uid) {
              const userDoc = await db.collection('users').doc(uid).get();
              if (userDoc.exists) {
                  await processLoggedInUser(uid, trimmedEmail, userDoc.data() as User);
              } else {
                  // User does NOT exist yet. Did they have an invite waiting?
                  let inviteDoc = await db.collection('users').doc(trimmedEmail).get();
                  if (!inviteDoc.exists) {
                       const qSnap = await db.collection('users').where('email', '==', trimmedEmail).get();
                       if (!qSnap.empty) {
                           const found = qSnap.docs.find(d => d.id !== uid);
                           if (found) inviteDoc = found;
                       }
                  }

                  if (inviteDoc.exists) {
                       const inviteData = inviteDoc.data() as User;
                       // Convert invite into a true profile!
                       const newUserProfile: User = {
                           id: uid,
                           uid: uid,
                           organizationId: inviteData.organizationId || 'unaffiliated',
                           email: trimmedEmail,
                           firstName: result.user?.displayName?.split(' ')[0] || inviteData.firstName || trimmedEmail.split('@')[0],
                           lastName: result.user?.displayName?.split(' ').slice(1).join(' ') || inviteData.lastName || '',
                           phone: result.user?.phoneNumber || inviteData.phone || '',
                           role: inviteData.role || 'employee',
                           status: 'active',
                           username: trimmedEmail.split('@')[0],
                           preferences: { theme: 'dark' },
                           hireDate: inviteData.hireDate || new Date().toISOString(),
                           payRate: inviteData.payRate || 0,
                           ptoAccrued: inviteData.ptoAccrued || 0,
                           marketingConsent: { 
                               sms: true, 
                               email: true, 
                               agreedAt: new Date().toISOString(), 
                               source: 'GoogleSignIn',
                               gclid: localStorage.getItem('tt_gclid') || undefined
                           } as any,
                           lastLoginAt: new Date().toISOString(),
                           gclid: localStorage.getItem('tt_gclid') || undefined
                       };

                       await db.collection('users').doc(uid).set(newUserProfile, { merge: true });
                       await db.collection('users').doc(inviteDoc.id).delete().catch(() => {});
                       window.location.reload(); 
                   } else {
                       // New Google User - Unaffiliated Customer Default
                       const newUserProfile: User = {
                           id: uid,
                           uid: uid,
                           organizationId: 'unaffiliated',
                           email: trimmedEmail,
                           firstName: result.user?.displayName?.split(' ')[0] || trimmedEmail.split('@')[0],
                           lastName: result.user?.displayName?.split(' ').slice(1).join(' ') || '',
                           phone: result.user?.phoneNumber || '',
                           role: 'customer',
                           status: 'active',
                           username: trimmedEmail.split('@')[0],
                           preferences: { theme: 'dark' },
                           payRate: 0,
                           ptoAccrued: 0,
                           marketingConsent: { 
                               sms: true, 
                               email: true, 
                               agreedAt: new Date().toISOString(), 
                               source: 'GoogleSignIn',
                               gclid: localStorage.getItem('tt_gclid') || undefined
                           } as any,
                           lastLoginAt: new Date().toISOString(),
                           gclid: localStorage.getItem('tt_gclid') || undefined
                       };
                       await db.collection('users').doc(uid).set(newUserProfile, { merge: true });
                       window.location.reload();
                   }
              }
          }
          setIsLoading(false);
      } catch (err: any) {
          console.error("Google Login Error:", err);
          setError(err.message || "Google Single Sign-On failed.");
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
                  source: 'Registration',
                  gclid: localStorage.getItem('tt_gclid') || undefined
              };

              const newUserProfile: User = {
                  id: user.uid,
                  uid: user.uid,
                  organizationId: targetOrgId,
                  email: normalizedEmail,
                  firstName: nameParts[0] || existingData?.firstName || (normalizedEmail.split('@')[0]),
                  lastName: nameParts.slice(1).join(' ') || existingData?.lastName || '',
                  phone: userPhone || existingData?.phone || '',
                   role: (userType === 'customer' ? 'customer' : (existingData?.role || (userType === 'staff' ? 'employee' : 'employee'))) as User['role'],
                  status: 'active',
                  username: normalizedEmail.split('@')[0],
                  preferences: { theme: 'dark' },
                  hireDate: existingData?.hireDate || new Date().toISOString(),
                  payRate: existingData?.payRate || 0,
                  ptoAccrued: existingData?.ptoAccrued || 0,
                  handbookSignedDate: existingData?.handbookSignedDate || null,
                  address: safeAddress, // Now guaranteed object or null
                  marketingConsent: marketingConsent as any,
                  lastLoginAt: new Date().toISOString(), // Set initial login time
                  gclid: localStorage.getItem('tt_gclid') || undefined
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
                  // NEW: Merge logic to prevent duplicate customers
                  try {
                      const orgId = newUserProfile.organizationId;
                      let existingDoc: any = null;
                      
                      // 1. Try matching by Email
                      const emailQuery = await db.collection('customers')
                          .where('email', '==', normalizedEmail)
                          .where('organizationId', '==', orgId)
                          .get();
                      
                      if (!emailQuery.empty) {
                          existingDoc = emailQuery.docs[0];
                      } 
                      
                      // 1. Try case-insensitive matching by searching all customers in this Org
                      // This avoids issues with Admin-entered casing (e.g. User@Ex.Com vs user@ex.com)
                      const orgSnap = await db.collection('customers')
                          .where('organizationId', '==', orgId)
                          .get();
                      
                      existingDoc = orgSnap.docs.find(d => 
                          (d.data().email || '').toLowerCase().trim() === normalizedEmail
                      );

                      // 2. Fallback: Try matching by Phone if email match failed
                      if (!existingDoc && userPhone) {
                          const cleanPhone = userPhone.replace(/\D/g, '');
                          existingDoc = orgSnap.docs.find(d => {
                              const dPhone = (d.data().phone || '').replace(/\D/g, '');
                              return dPhone && dPhone === cleanPhone;
                          });
                      }
                      
                      if (existingDoc) {
                          // Found an existing record (e.g. from an manual entry or invite)
                          await existingDoc.ref.update({
                              userId: user.uid, // Link the customer record to this Auth user
                              firstName: newUserProfile.firstName,
                              lastName: newUserProfile.lastName,
                              name: `${newUserProfile.firstName} ${newUserProfile.lastName}`.trim(),
                              phone: userPhone || existingDoc.data().phone || '',
                              address: userAddress || existingDoc.data().address || '',
                              city: userCity || existingDoc.data().city || '',
                              state: userState || existingDoc.data().state || '',
                              zip: userZip || existingDoc.data().zip || '',
                              marketingConsent: marketingConsent as any,
                              lastLoginAt: new Date().toISOString()
                          });
                          console.log("Merged with existing customer profile:", existingDoc.id);
                      } else {
                          // No existing record, create a new one using UID as ID
                          const custRef = db.collection('customers').doc(user.uid);
                          await custRef.set({
                              id: user.uid,
                              userId: user.uid,
                              organizationId: orgId,
                              name: `${newUserProfile.firstName} ${newUserProfile.lastName}`.trim(),
                              firstName: newUserProfile.firstName,
                              lastName: newUserProfile.lastName,
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
                              marketingConsent: marketingConsent as any,
                              isNew: true
                          }, { merge: true });
                      }
                  } catch (custErr) {
                      console.error("Error during customer link/create:", custErr);
                      // Fallback: Continue with user creation even if customer record fails
                  }
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
              } catch (e) { console.error(e); }
              
              // SUCCESS - Redirect to Login (User's preferred flow)
              // SIGN OUT to ensure clean login
              await auth.signOut();
              dispatch({ type: 'LOGOUT' });
              
              setSuccessMsg("Registration successful! You can now log in with your new credentials.");
              setIsLoading(false);
              
              // Move to login view via internal state AND clean URL
              setView('login');
              navigate('/login', { replace: true });
          }
      } catch (err: any) {
          console.error("Registration failed:", err);
          setError(err.message || "Registration failed. Please try again.");
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
      
      const isIOS = Capacitor.getPlatform() === 'ios';

      // Validate Step 2 (Only if NOT bypassing AND NOT on iOS where Apple IAP is mandatory)
      if (!isValidPromo && !isIOS) {
          if (!ccName || !ccNumber || !ccExp || !ccCvc) {
              setError("All payment information is required for account setup.");
              return;
          }
          
          // Strict formatting validations
          const cleanNumber = ccNumber.replace(/\D/g, '');
          if (cleanNumber.length < 15 || cleanNumber.length > 16) {
              setError("Please enter a valid 15 or 16-digit credit card number.");
              return;
          }
          
          if (!/^\d{2}\/\d{2}$/.test(ccExp)) {
              setError("Please enter a valid expiration date in MM/YY format.");
              return;
          }
          
          const cleanCvc = ccCvc.replace(/\D/g, '');
          if (cleanCvc.length < 3 || cleanCvc.length > 4) {
              setError("Please enter a valid 3 or 4-digit CVC/CVV security code.");
              return;
          }
      }
      
      setError('');
      setIsLoading(true);

      // --- APPLE REVENUECAT PURCHASE FLOW ---
      if (isIOS && !isValidPromo) {
          try {
             const { Purchases } = await import('@revenuecat/purchases-capacitor');
             // Map selectedPlan (starter|growth|enterprise) to the Product IDs Apple approved
             const productId = `tek_${selectedPlan}_${selectedPlan === 'starter' ? 99 : selectedPlan === 'growth' ? 249 : 499}`;
             
             // Get the product object from Apple's servers via RevenueCat
             const products = await Purchases.getProducts({ productIdentifiers: [productId] });
             if (products.products.length === 0) {
                 throw new Error("Product misconfigured in App Store.");
             }
             
             // Trigger native Apple IAP Sheet - Wait for user fingerprint/face ID
             await Purchases.purchaseStoreProduct({ product: products.products[0] });
             
          } catch (err: any) {
             console.error("Apple Purchase Failed", err);
             // If user cancels biometric sheet or card declines, halt the account creation!
             setError("Apple Purchase was cancelled or failed.");
             setIsLoading(false);
             return; 
          }
      }
      // --- END REVENUECAT VALIDATION ---

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
                  },
                  gclid: localStorage.getItem('tt_gclid') || undefined,
                  marketingConsent: {
                      sms: true,
                      email: true,
                      agreedAt: new Date().toISOString(),
                      source: 'Registration',
                      gclid: localStorage.getItem('tt_gclid') || undefined
                  }
              };

              const nameParts = ownerName.trim().split(' ');
              const marketingConsent = {
                  sms: true,
                  email: true,
                  agreedAt: new Date().toISOString(),
                  source: 'Registration',
                  gclid: localStorage.getItem('tt_gclid') || undefined
              };

              const newUserProfile: User = {
                  id: user.uid, uid: user.uid, organizationId: orgId, email: normalizedEmail,
                  firstName: nameParts[0] || 'Admin', lastName: nameParts.slice(1).join(' ') || '',
                  phone: businessPhone.trim() || '',
                  role: (normalizedEmail === 'rodzelem@gmail.com' ? 'master_admin' : 'both') as User['role'], 
                  status: 'active', username: normalizedEmail.split('@')[0],
                  preferences: { theme: 'dark' }, payRate: 0, ptoAccrued: 0,
                  marketingConsent: marketingConsent as any,
                  lastLoginAt: new Date().toISOString(), // Set initial login time
                  gclid: localStorage.getItem('tt_gclid') || undefined
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

              // SUCCESS - Redirect to Login (User's preferred flow)
              await auth.signOut();
              dispatch({ type: 'LOGOUT' });
              
              setSuccessMsg("Business registered successfully! Please sign in to access your dashboard.");
              setIsLoading(false);
              
              // Move to login view via internal state AND clean URL
              setView('login');
              navigate('/login', { replace: true });
          }
      } catch (regError: any) {
          setError(`${regError.message}`);
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start p-4 font-sans relative overflow-y-auto py-12">
      <style>{`.custom-brand-bg { background-color: ${brandColor}; }`}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full blur-[120px] mix-blend-screen opacity-20 custom-brand-bg" />
          <div className="absolute bottom-[0%] -right-[10%] w-[60vw] h-[60vw] bg-indigo-600/10 rounded-full blur-[100px] mix-blend-screen" />
          
          {/* Desktop-only Mascot Companion */}
          <div className="hidden lg:block absolute bottom-0 right-[5%] z-0 pointer-events-none">
              <img 
                 src="/mascot.png" 
                 alt="Antigravity Mascot" 
                 className="h-[550px] w-auto object-contain opacity-80 drop-shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-all duration-500" 
              />
          </div>
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
                    handleLogin={handleLogin} handleGoogleLogin={handleGoogleLogin} isLoading={isLoading} 
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

            <div className="mt-8 text-center text-xs text-slate-500 space-y-3">
                {Capacitor.getPlatform() === 'ios' && (
                     <button 
                         type="button" 
                         onClick={async () => {
                             try {
                                 const { Purchases } = await import('@revenuecat/purchases-capacitor');
                                 await Purchases.restorePurchases();
                                 showToast.warn("Your purchases have been restored where applicable.");
                             } catch (e) {
                                 console.error(e);
                                 showToast.warn("No past purchases found or restoration failed.");
                             }
                         }}
                         className="font-bold border-b border-dashed border-slate-500 hover:text-blue-400 transition-colors"
                     >
                         Restore App Store Purchases
                     </button>
                )}
                <p>By continuing, you agree to the <button onClick={() => navigate('/terms')} className="text-blue-400 hover:underline">Terms of Service</button> and <button onClick={() => navigate('/privacy')} className="text-blue-400 hover:underline">Privacy Policy</button>.</p>
            </div>
        </div>


      </div>
    </div>
  );
};

export default LoginPage;
