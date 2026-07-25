import { cleanUndefinedFields } from '../lib/utils';
import showToast from "lib/toast";
import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { auth, db, functions } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { User, Organization, PlatformSettings } from 'types';
import { CheckCircle, AlertTriangle, Lock, Key, Loader2 } from 'lucide-react';
import { LogoIcon, Logo } from 'components/ui/Logo';
import { LoginForm } from 'components/auth/LoginForm';
import { ForgotPasswordForm } from 'components/auth/ForgotPasswordForm';
import { UserRegistrationForm } from 'components/auth/UserRegistrationForm';
import { BusinessRegistrationForm } from 'components/auth/BusinessRegistrationForm';
import { verifyTOTP } from 'lib/totp';

const LoginPage: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'login' | 'register_business' | 'register_user' | 'forgot_password' | 'mfa_challenge'>('login');
  
  // MFA login interception state
  const [mfaUser, setMfaUser] = useState<User | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  
  // Business Registration Steps
  const [bizRegStep, setBizRegStep] = useState<1 | 2>(1);
  
  const [userType, setUserType] = useState<'staff' | 'customer'>('staff');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Biometric Login State & Logic
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(() => {
      return localStorage.getItem('biometric_login_enabled') === 'true';
  });
  const hasBypassedBiometrics = useRef(false);

  const triggerBiometricLogin = async (isManual = false) => {
      if (!Capacitor.isNativePlatform()) return;
      setError('');
      setIsLoading(true);
      if (isManual) {
          hasBypassedBiometrics.current = false;
      }
      try {
          const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
          
          // Verify that biometric credentials actually exist before triggering scanner
          const savedResult = await NativeBiometric.isCredentialsSaved({
              server: "tektrakker-v2.firebaseauth"
          });
          if (!savedResult.isSaved) {
              throw new Error("No saved biometric credentials found on this device. Please sign in manually first to enable biometric login.");
          }

          const avail = await NativeBiometric.isAvailable();
          if (!avail.isAvailable) {
              throw new Error("Biometrics not available on this device.");
          }

          // Request biometric verification first before accessing credentials
          await NativeBiometric.verifyIdentity({
              reason: "Authenticate to retrieve your secure credentials",
              title: "Biometric Sign In",
              subtitle: "Unlock your stored login details",
              description: "Please authenticate to sign in to TekTrakker"
          });
          
          const creds = await NativeBiometric.getCredentials({
              server: "tektrakker-v2.firebaseauth"
          });
          
          if (!creds.username || !creds.password) {
              throw new Error("No saved credentials found for biometric login.");
          }
          
          setEmail(creds.username);
          setPassword(creds.password);
          
          const firebaseCreds = await auth.signInWithEmailAndPassword(creds.username, creds.password);
          const uid = firebaseCreds.user?.uid;
          
          if (uid) {
              const userDoc = await db.collection('users').doc(uid).get();
              if (userDoc.exists) {
                  const userData = userDoc.data() as User;
                  if (userData?.mfaEnabled) {
                      setMfaUser(userData);
                      setView('mfa_challenge');
                      setIsLoading(false);
                      return;
                  }
                  await processLoggedInUser(uid, creds.username, userData);
              } else {
                  setError("User profile not properly initialized. Please contact support.");
              }
          }
          setIsLoading(false);
      } catch (err: any) {
          console.error("Biometric login failed", err);
          hasBypassedBiometrics.current = true; // Prevent further automatic triggers
          const errorMsg = err.message || "";
          if (
              !errorMsg.toLowerCase().includes("cancel") && 
              !errorMsg.toLowerCase().includes("user cancel") && 
              !errorMsg.toLowerCase().includes("biometric authentification cancelled")
          ) {
              setError(errorMsg || "Biometric authentication failed.");
          }
          setIsLoading(false);
      }
  };

  useEffect(() => {
      const justLoggedOut = localStorage.getItem('just_logged_out') === 'true';
      if (justLoggedOut) {
          localStorage.removeItem('just_logged_out');
          hasBypassedBiometrics.current = true;
      }

      if (hasBypassedBiometrics.current) {
          return;
      }

      if (view === 'login' && isBiometricEnabled && Capacitor.isNativePlatform()) {
          const timer = setTimeout(() => {
              triggerBiometricLogin();
          }, 600);
          return () => clearTimeout(timer);
      }
  }, [view, isBiometricEnabled]);
  
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Customer Specific Reg State
  const [userAddress, setUserAddress] = useState('');
  const [userCity, setUserCity] = useState('');
  const [userState, setUserState] = useState('');
  const [userZip, setUserZip] = useState('');
  const [userServiceNeed, setUserServiceNeed] = useState('Community');
  const [inviteLoaded, setInviteLoaded] = useState(false);

  // Org Signup Plan State
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'growth' | 'enterprise' | 'payments_only'>('starter');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResendBtn, setShowResendBtn] = useState(false);

  const handleResendVerification = async () => {
      setIsLoading(true);
      setError('');
      setSuccessMsg('');
      try {
          const trimmedEmail = email.trim().toLowerCase();
          const creds = await auth.signInWithEmailAndPassword(trimmedEmail, password);
          if (creds.user) {
              await creds.user.sendEmailVerification();
              await auth.signOut();
              setSuccessMsg("Verification email resent successfully! Please check your inbox.");
              setShowResendBtn(false);
          }
      } catch (err: any) {
          setError(err.message || "Failed to resend verification email.");
      } finally {
          setIsLoading(false);
      }
  };

  // Branding State
  const [brandedOrgName, setBrandedOrgName] = useState('TekTrakker');
  const [brandColor, setBrandColor] = useState('#2563eb'); 
  const [isBranded, setIsBranded] = useState(false);
  const [referredOrgId, setReferredOrgId] = useState<string | null>(null);

  // Near Me Orgs
  const [selectedNearbyOrg] = useState<string>('');

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

  // Listen for active sessions requiring MFA verification
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user && !state.isDemoMode) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data() as User;
                    if (userData?.mfaEnabled) {
                        const isVerified = sessionStorage.getItem('mfa_verified_' + user.uid) === 'true';
                        if (!isVerified) {
                            setMfaUser(userData);
                            setView('mfa_challenge');
                            setIsLoading(false);
                        }
                    }
                }
            } catch (err) {
                console.warn("MFA auto-intercept check skipped", err);
            }
        }
    });
    return () => unsubscribe();
  }, [state.isDemoMode]);

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
          setView(viewParam as 'login' | 'register_user' | 'register_business');
      }

      if (paramEmail) setEmail(paramEmail);
      if (paramName) setUserName(paramName);
      if (paramUserType === 'customer' || paramUserType === 'staff') setUserType(paramUserType as 'customer' | 'staff');

      // Check for pre-selected plan param (from marketing landing pages)
      const planParam = searchParams.get('plan');
      if (planParam && ['starter', 'growth', 'enterprise', 'payments_only'].includes(planParam)) {
          setSelectedPlan(planParam as 'starter' | 'growth' | 'enterprise' | 'payments_only');
          // Auto-open business registration if plan is specified
          if (!viewParam) setView('register_business');
      }

      // 2. Fetch platform settings for public pages
      if (!state.platformSettings) {
          db.collection('platformSettings').doc('global').get().then(docSnapshot => {
              if (docSnapshot.exists) {
                  const settings = {id: docSnapshot.id, ...docSnapshot.data()} as PlatformSettings;
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

  useEffect(() => {
      if (view !== 'register_user' || !email) return;

      const trimmedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return;

      const token = searchParams.get('token');
      if (!token) return;

      const checkInvite = async () => {
          try {
              const checkUserInviteFn = functions.httpsCallable('checkUserInvite');
              const res = await checkUserInviteFn({ email: trimmedEmail, token });
              const data = res.data as any;
              if (data && data.exists) {
                  setInviteLoaded(true);
                  if (data.firstName || data.lastName) {
                      setUserName(`${data.firstName} ${data.lastName}`.trim());
                  }
                  if (data.phone) setUserPhone(data.phone);
                  if (data.role) {
                      setUserType(data.role === 'customer' ? 'customer' : 'staff');
                  }
                  if (data.organizationId) {
                      setReferredOrgId(data.organizationId);
                  }
                  if (data.address) {
                      if (data.address.street) setUserAddress(data.address.street);
                      if (data.address.city) setUserCity(data.address.city);
                      if (data.address.state) setUserState(data.address.state);
                      if (data.address.zip) setUserZip(data.address.zip);
                  }
              } else {
                  setInviteLoaded(false);
              }
          } catch (err) {
              console.warn("Failed to check user invite details:", err);
          }
      };

      checkInvite();
  }, [email, view, searchParams]);

  const processLoggedInUser = async (uid: string, trimmedEmail: string, userData: User) => {
      // UPDATE LOGIN TIMESTAMP & LOG CUSTOMER PORTAL ACCESS
      try {
          const nowIso = new Date().toISOString();
          await db.collection('users').doc(uid).update(cleanUndefinedFields({ lastLoginAt: nowIso }));

          if (userData.role === 'customer' || (userData as any).customerId) {
              const custId = (userData as any).customerId || (await (async () => {
                  const snap = await db.collection('customers')
                      .where('email', '==', trimmedEmail.toLowerCase())
                      .limit(1)
                      .get()
                      .catch(() => null);
                  return snap && !snap.empty ? snap.docs[0].id : null;
              })());

              if (custId) {
                  const commEntry = {
                      id: `comm-login-${Date.now()}`,
                      type: 'portal_login',
                      title: 'Customer Portal Login',
                      subtitle: `Logged in via Portal`,
                      content: `Customer logged into portal account at ${new Date().toLocaleString()}`,
                      badgeLabel: 'Portal Login',
                      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
                      timestamp: nowIso,
                      senderName: userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : 'Customer'
                  };
                  await db.collection('customers').doc(custId).collection('communications').doc(commEntry.id).set(cleanUndefinedFields(commEntry)).catch(() => {});
              }
          }
      } catch (updateErr) {
          console.warn("Failed to update lastLoginAt or log customer portal login", updateErr);
      }
      
      // 1. SELF-HEALING: Normalize Email Casing
      if (userData.email && userData.email !== userData.email.toLowerCase()) {
          const lcEmail = userData.email.toLowerCase().trim();
          await db.collection('users').doc(uid).update(cleanUndefinedFields({ email: lcEmail }));
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
                          await db.collection('customers').doc(match.id).update(cleanUndefinedFields({ userId: uid }));
                      }
                  }
              }
          } catch (cErr) {
              console.warn("Customer self-heal link failed", cErr);
          }
      }

      // 3. SELF-HEALING: Clean up duplicate invite document if it exists
      try {
          if (uid !== trimmedEmail) {
              const inviteDoc = await db.collection('users').doc(trimmedEmail).get();
              if (inviteDoc.exists) {
                  // The user has a real profile but the invite document is still lingering
                  await db.collection('users').doc(trimmedEmail).delete().catch(() => {});
                  console.log("Cleaned up stale invite document for:", trimmedEmail);
              }
          }
      } catch (err) {
          console.warn("Failed to cleanup stale invite", err);
      }

      if (userData.role === 'platform_sales') {
          navigate('/sales/dashboard');
          return;
      }

      // Account repair check for existing users (Staff/Invite flow)
      if (userData.role === 'customer' || userData.role === 'employee' || userData.role === 'Subcontractor' || userData.role === 'Technician' || !userData.organizationId || userData.organizationId === 'unaffiliated') {
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
                  if (inviteData && inviteData.role !== 'customer') {
                      if (inviteData.organizationId && inviteData.organizationId !== userData.organizationId) {
                          console.log("Repairing staff/admin account from invite:", inviteDoc.id);
                           const updateData: any = {
                               role: inviteData.role || userData.role,
                               organizationId: inviteData.organizationId,
                               firstName: inviteData.firstName || userData.firstName,
                               lastName: inviteData.lastName || userData.lastName
                           };
                           if (inviteData.franchiseId) {
                               updateData.franchiseId = inviteData.franchiseId;
                           }
                           await db.collection('users').doc(uid).update(cleanUndefinedFields(updateData));
                           await db.collection('users').doc(inviteDoc.id).delete();
                           
                           // Proceed with the repaired user data instead of reloading
                           const repairedUser = {
                               ...userData,
                               role: inviteData.role || userData.role,
                               organizationId: inviteData.organizationId,
                               firstName: inviteData.firstName || userData.firstName,
                               lastName: inviteData.lastName || userData.lastName,
                               ...(inviteData.franchiseId ? { franchiseId: inviteData.franchiseId } : {})
                           };
                          processLoggedInUser(uid, trimmedEmail, repairedUser);
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
          navigate('/admin/dashboard', { replace: true });
      } else if (userData.role === 'master_admin' || userData.role === 'franchise_admin') {
          navigate('/master/dashboard', { replace: true });
      } else if ((userData.role as string) === 'kort_tester') {
          navigate('/admin/kort-playground', { replace: true });
      } else if (userData.role === 'customer') {
            if (!userData.organizationId || userData.organizationId === 'unaffiliated') {
                navigate('/marketplace', { replace: true });
            } else {
                navigate('/portal', { replace: true });
            }
      } else if (userData.role === 'employee' || userData.role === 'Subcontractor' || userData.role === 'Technician') {
            if (!userData.organizationId || userData.organizationId === 'unaffiliated') {
                navigate('/marketplace', { replace: true });
            } else {
                navigate('/briefing', { replace: true });
            }
      } else {
          navigate('/marketplace', { replace: true });
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowResendBtn(false);
    setIsLoading(true);
    
    try {
        const trimmedEmail = email.trim().toLowerCase();
        const creds = await auth.signInWithEmailAndPassword(trimmedEmail, password);
        const uid = creds.user?.uid;

        if (uid) {
             const creationTimeStr = creds.user?.metadata?.creationTime;
             const userCreationTime = creationTimeStr ? new Date(creationTimeStr).getTime() : Date.now();
             const cutoffTime = new Date('2026-06-11T07:35:00Z').getTime();

             if (creds.user && !creds.user.emailVerified && trimmedEmail !== 'rodzelem@gmail.com' && trimmedEmail !== 'ryanvavrecan@gmail.com' && userCreationTime >= cutoffTime) {
                 const isPasswordProvider = creds.user.providerData.some(p => p.providerId === 'password');
                 if (isPasswordProvider) {
                     await auth.signOut();
                     setError("Please verify your email address before logging in. A verification link was sent to " + trimmedEmail + ".");
                     setShowResendBtn(true);
                     setIsLoading(false);
                     return;
                 }
             }
             try {
                  const userDoc = await db.collection('users').doc(uid).get();
                  if (userDoc.exists) {
                      const userData = userDoc.data() as User;
                      
                      // Update biometric credentials securely on successful manual login
                      if (localStorage.getItem('biometric_login_enabled') === 'true' && Capacitor.isNativePlatform()) {
                          try {
                              const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
                              await NativeBiometric.setCredentials({
                                  username: trimmedEmail,
                                  password: password,
                                  server: "tektrakker-v2.firebaseauth"
                              });
                          } catch (bioSaveErr) {
                              console.warn("Failed to update biometric credentials on successful manual login", bioSaveErr);
                          }
                      }

                      if (userData?.mfaEnabled) {
                          setMfaUser(userData);
                          setView('mfa_challenge');
                          setIsLoading(false);
                          return;
                      }
                      await processLoggedInUser(uid, trimmedEmail, userData);
                  } else {
                      setError("User profile not properly initialized. Please contact support.");
                  }
             } catch (fetchErr) {
                 console.error("Profile Fetch Error:", fetchErr);
                 setError((fetchErr as Error).message || "Profile Fetch Error. Please check your network connection.");
             }
        }
        setIsLoading(false);
    } catch (authError: unknown) {
        console.error("Login Error:", authError);
        setError((authError as Error).message || "Invalid credentials. Please try again.");
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
              } catch {
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
              // Disable and clear biometrics since Google accounts cannot use the email/password biometric store
              if (Capacitor.isNativePlatform()) {
                  try {
                      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
                      await NativeBiometric.deleteCredentials({
                          server: "tektrakker-v2.firebaseauth"
                      });
                  } catch (bioErr) {
                      console.warn("Failed to clear biometric credentials on Google login", bioErr);
                  }
              }
              localStorage.setItem('biometric_login_enabled', 'false');
              setIsBiometricEnabled(false);

              const userDoc = await db.collection('users').doc(uid).get();
              if (userDoc.exists) {
                  const userData = userDoc.data() as User;
                  if (userData?.mfaEnabled) {
                      setMfaUser(userData);
                      setView('mfa_challenge');
                      setIsLoading(false);
                      return;
                  }
                  await processLoggedInUser(uid, trimmedEmail, userData);
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
                            ...inviteData,
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
                            preferences: { theme: 'dark', ...(inviteData.preferences || {}) },
                            hireDate: inviteData.hireDate || new Date().toISOString(),
                            payRate: inviteData.payRate || 0,
                            ptoAccrued: inviteData.ptoAccrued || 0,
                            marketingConsent: { 
                                sms: true, 
                                email: true, 
                                agreedAt: new Date().toISOString(), 
                                source: 'GoogleSignIn',
                                gclid: localStorage.getItem('tt_gclid') || null
                            } as unknown as User['marketingConsent'],
                            lastLoginAt: new Date().toISOString(),
                            gclid: localStorage.getItem('tt_gclid') || null
                        };

                        await db.collection('users').doc(uid).set(cleanUndefinedFields(newUserProfile), { merge: true });
                       await db.collection('users').doc(inviteDoc.id).delete().catch(() => {});
                       processLoggedInUser(uid, trimmedEmail, newUserProfile);
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
                               gclid: localStorage.getItem('tt_gclid') || null
                           } as unknown as User['marketingConsent'],
                           lastLoginAt: new Date().toISOString(),
                           gclid: localStorage.getItem('tt_gclid') || null
                       };
                       await db.collection('users').doc(uid).set(cleanUndefinedFields(newUserProfile), { merge: true });
                       processLoggedInUser(uid, trimmedEmail, newUserProfile);
                   }
              }
          }
          setIsLoading(false);
      } catch (err: unknown) {
          console.error("Google Login Error:", err);
          setError((err as Error).message || "Google Single Sign-On failed.");
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
      } catch (err: unknown) {
          setError((err as Error).message || "Failed to send reset email.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!termsAccepted) {
          setError("You must agree to the Terms of Service and Privacy Policy to register.");
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
              try {
                  await user.sendEmailVerification();
              } catch (verifyErr) {
                  console.warn("Failed to send verification email:", verifyErr);
              }
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
              
              // SECURITY ENFORCEMENT: Staff MUST have an invite
              // Prevent users from clicking "Employee" registration and creating uninvited accounts
              const hasValidStaffInvite = existingData && existingData.role && existingData.role !== 'customer';
              if (userType === 'staff' && !hasValidStaffInvite && normalizedEmail !== 'rodzelem@gmail.com' && normalizedEmail !== 'ryanvavrecan@gmail.com') {
                  // Rollback the created auth user
                  await user.delete().catch(() => {});
                  throw new Error("Staff registration requires an active staff invite for this email address. Please contact your administrator or use the exact email address the invite was sent to.");
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
                  sms: consentGiven,
                  email: true,
                  agreedAt: new Date().toISOString(),
                  source: 'Registration',
                  gclid: localStorage.getItem('tt_gclid') || null
              };

               const newUserProfile: any = {
                   ...(existingData || {}),
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
                   preferences: { theme: 'dark', ...(existingData?.preferences || {}) },
                   hireDate: existingData?.hireDate || new Date().toISOString(),
                   payRate: existingData?.payRate || 0,
                   ptoAccrued: existingData?.ptoAccrued || 0,
                   handbookSignedDate: existingData?.handbookSignedDate || null,
                   address: safeAddress || existingData?.address || null, // Now guaranteed object or null
                   marketingConsent: marketingConsent as unknown as User['marketingConsent'],
                   lastLoginAt: new Date().toISOString(), // Set initial login time
                   gclid: localStorage.getItem('tt_gclid') || null,
                   
                   // Portal invitation scoping data
                   customerPortalRole: existingData?.customerPortalRole || null,
                   allowedLocationIds: existingData?.allowedLocationIds || [],
                   customerId: existingData?.customerId || null
               };

              // CREATE PROFILE (Even if invite failed)
              try {
                  // Explicitly use .set to create the profile, relying on 'allow create' rules
                  await db.collection('users').doc(user.uid).set(cleanUndefinedFields(newUserProfile), { merge: true });
              } catch (profileError) {
                  console.error("Profile creation failed:", profileError);
                  throw new Error("Failed to create user profile. Please contact support.", { cause: profileError });
              }
              
              // Delete invite if we found it to clean up
              if (foundInviteId) {
                  await db.collection('users').doc(foundInviteId).delete().catch(() => {});
              }
              
              if (userType === 'customer') {
                  try {
                      if (existingData?.customerId) {
                          console.log("Secondary portal user, skipping customer doc creation/merge");
                          try {
                              const parentCustDoc = await db.collection('customers').doc(existingData.customerId).get();
                              if (parentCustDoc.exists) {
                                  const parentCust = parentCustDoc.data();
                                  const updatedContacts = (parentCust.contacts || []).map((c: any) => 
                                      c.email.trim().toLowerCase() === normalizedEmail ? { ...c, portalUserStatus: 'active' } : c
                                  );
                                  await db.collection('customers').doc(existingData.customerId).update(cleanUndefinedFields({ contacts: updatedContacts }));
                              }
                          } catch (updateErr) {
                              console.warn("Could not update contact status to active in parent customer doc:", updateErr);
                          }
                      } else {
                          // Standard merge/create logic for primary customer
                          const orgId = newUserProfile.organizationId;
                          let existingDoc: any = null;
                          
                          // Try matching by Email
                          const emailQuery = await db.collection('customers')
                              .where('email', '==', normalizedEmail)
                              .where('organizationId', '==', orgId)
                              .get();
                          
                          if (!emailQuery.empty) {
                              existingDoc = emailQuery.docs[0];
                          } 
                          
                          // Try case-insensitive matching by searching all customers in this Org
                          const orgSnap = await db.collection('customers')
                              .where('organizationId', '==', orgId)
                              .get();
                          
                          existingDoc = orgSnap.docs.find(d => 
                              (d.data().email || '').toLowerCase().trim() === normalizedEmail
                          );

                          // Fallback: Try matching by Phone if email match failed
                          if (!existingDoc && userPhone) {
                              const cleanPhone = userPhone.replace(/\D/g, '');
                              existingDoc = orgSnap.docs.find(d => {
                                  const dPhone = (d.data().phone || '').replace(/\D/g, '');
                                  return dPhone && dPhone === cleanPhone;
                              });
                          }
                          
                          if (existingDoc) {
                              // Found an existing record
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
                                  marketingConsent: marketingConsent as unknown as User['marketingConsent'],
                                  lastLoginAt: new Date().toISOString()
                              });
                              console.log("Merged with existing customer profile:", existingDoc.id);
                          } else {
                              // No existing record, create a new one using UID as ID
                              const custRef = db.collection('customers').doc(user.uid);
                              await custRef.set(cleanUndefinedFields({
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
                                  marketingConsent: marketingConsent as unknown as User['marketingConsent'],
                                  isNew: true
                              }), { merge: true });
                          }
                      }
                  } catch (custErr) {
                      console.error("Error during customer link/create:", custErr);
                  }
              }

              // EMAIL NOTIFICATION
              await db.collection('mail').add(cleanUndefinedFields({
                  to: ['platform@tektrakker.com', 'ryanvavrecan@gmail.com'],
                  message: {
                      subject: `[New User] ${userType} Registration`,
                      text: `A new ${userType} user has registered.\n\nName: ${newUserProfile.firstName} ${newUserProfile.lastName}\nEmail: ${normalizedEmail}\nRole: ${newUserProfile.role}\nOrganization ID: ${newUserProfile.organizationId}`
                  },
                  organizationId: 'platform',
                  type: 'SystemAlert',
                  createdAt: new Date().toISOString()
              }));

              // SUCCESS - Redirect to Login (User's preferred flow)
              // SIGN OUT to ensure clean login
              await auth.signOut();
              dispatch({ type: 'LOGOUT' });
              
              setSuccessMsg("Registration successful! A verification link was sent. Please verify your email before logging in.");
              setIsLoading(false);
              
              // Move to login view via internal state AND clean URL
              setView('login');
              navigate('/login', { replace: true });
          }
      } catch (err: unknown) {
          console.error("Registration failed:", err);
          setError((err as Error).message || "Registration failed. Please try again.");
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
      if (!termsAccepted) {
          setError("You must agree to the SaaS Agreement and Privacy Policy to proceed.");
          return;
      }
      setError('');

      const isIOS = Capacitor.getPlatform() === 'ios';

      if (isValidPromo || !isIOS) {
          // If promo bypass is active, or if registering on Web/Android, skip card capture entirely
          handleRegisterBusiness(e);
      } else {
          // On iOS, App Store guidelines mandate Apple IAP biometric subscription
          setBizRegStep(2);
      }
  };

  const handleRegisterBusiness = async (e: React.FormEvent) => {
      if (e) e.preventDefault();
      
      const isIOS = Capacitor.getPlatform() === 'ios';

      // No credit card validation is performed during free trial registration on Web/Android
      // iOS users perform in-app purchase natively through Apple App Store sheet
      
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
             
          } catch (err: unknown) {
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
              try {
                  await user.sendEmailVerification();
              } catch (verifyErr) {
                  console.warn("Failed to send verification email:", verifyErr);
              }
              const trialDays = 14;
              
              // For promos, we set expiry to X months from now. For regular trial, 14 days.
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
                  paymentMethodAttached: isIOS && !isValidPromo, 
                  isFreeAccess: isValidPromo,
                  promoCode: isValidPromo ? promoCode.toUpperCase() : null,
                  unlockAllFeatures: selectedPlan === 'enterprise',
                  enabledPanels: {
                      inventory: true,
                      marketing: true,
                      memberships: true,
                      documents: true,
                      time_tracking: true
                  },
                  gclid: localStorage.getItem('tt_gclid') || null,
                  marketingConsent: {
                      sms: consentGiven,
                      email: true,
                      agreedAt: new Date().toISOString(),
                      source: 'Registration',
                      gclid: localStorage.getItem('tt_gclid') || null
                  }
              };

              const nameParts = ownerName.trim().split(' ');
              const marketingConsent = {
                  sms: consentGiven,
                  email: true,
                  agreedAt: new Date().toISOString(),
                  source: 'Registration',
                  gclid: localStorage.getItem('tt_gclid') || null
              };

              const newUserProfile: User = {
                  id: user.uid, uid: user.uid, organizationId: orgId, email: normalizedEmail,
                  firstName: nameParts[0] || 'Admin', lastName: nameParts.slice(1).join(' ') || '',
                  phone: businessPhone.trim() || '',
                  role: (normalizedEmail === 'rodzelem@gmail.com' || normalizedEmail === 'ryanvavrecan@gmail.com' ? 'master_admin' : 'both') as User['role'], 
                  status: 'active', username: normalizedEmail.split('@')[0],
                  preferences: { theme: 'dark' }, payRate: 0, ptoAccrued: 0,
                  marketingConsent: marketingConsent as unknown as User['marketingConsent'],
                  lastLoginAt: new Date().toISOString(), // Set initial login time
                  gclid: localStorage.getItem('tt_gclid') || null
              };
              
              const batch = db.batch();
              batch.set(cleanUndefinedFields(orgRef), newOrgData);
              batch.set(cleanUndefinedFields(db.collection('users')).doc(user.uid), newUserProfile); 
              await batch.commit();
              
              // EMAIL NOTIFICATION TO PLATFORM
              await db.collection('mail').add(cleanUndefinedFields({
                  to: ['platform@tektrakker.com', 'ryanvavrecan@gmail.com'],
                  message: {
                      subject: `[New Organization] ${newOrgData.name} ${isValidPromo ? '(Promo Bypass)' : '(Paid)'}`,
                      text: `A new organization has signed up.\n\nOrg Name: ${newOrgData.name}\nAdmin: ${newUserProfile.firstName} ${newUserProfile.lastName}\nEmail: ${normalizedEmail}\nPlan: ${selectedPlan}\nPayment Info Collected: ${!isValidPromo ? 'YES' : 'NO (Promo Code: ' + promoCode + ', Duration: ' + promoDurationMonths + 'mo)'}\nSource: Public Site Registration`
                  },
                  organizationId: 'platform',
                  type: 'SystemAlert',
                  createdAt: new Date().toISOString()
              }));

              // WELCOME EMAIL TO NEW BUSINESS
              const welcomeSubject = `Welcome to TekTrakker, ${newUserProfile.firstName}! 🎉 Let's get your business started`;
              const loginUrl = `${window.location.origin}/#/login`;
              const currentYear = new Date().getFullYear();
              const welcomeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 24px;
      margin: 0;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .content {
      padding: 32px 24px;
    }
    .intro {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 24px;
    }
    .step-card {
      background: #f1f5f9;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      border-left: 4px solid #3b82f6;
    }
    .step-card.highlighted {
      background: #ecfdf5;
      border-left-color: #10b981;
    }
    .step-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .step-badge.blue {
      background-color: #dbeafe;
      color: #1e40af;
    }
    .step-badge.green {
      background-color: #d1fae5;
      color: #065f46;
    }
    .step-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 8px 0;
    }
    .step-desc {
      font-size: 13px;
      line-height: 1.5;
      color: #475569;
      margin: 0;
    }
    .fee-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      border-radius: 6px;
      overflow: hidden;
    }
    .fee-table th, .fee-table td {
      padding: 8px 12px;
      font-size: 12px;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
    }
    .fee-table th {
      background-color: #d1fae5;
      color: #065f46;
      font-weight: 700;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 16px 0;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Welcome to TekTrakker! 🎉</h1>
      </div>
      <div class="content">
        <p class="intro">
          Hi <strong>${newUserProfile.firstName}</strong>,<br><br>
          Thank you for choosing TekTrakker to power your trade business. We're excited to help you eliminate operational chaos and scale your business efficiently.<br><br>
          To get the system working properly for <strong>${newOrgData.name}</strong>, please complete these essential setup steps in your <strong>Settings</strong> panel:
        </p>

        <!-- Step 1 -->
        <div class="step-card">
          <div class="step-badge blue">Step 1: Profile Setup</div>
          <h3 class="step-title">Complete Your Business Profile</h3>
          <p class="step-desc">
            Go to <strong>Settings &gt; Profile</strong>. Enter your company contact info, NAICS code, and upload business verification documents (EIN, Tax ID) for legal compliance.
          </p>
        </div>

        <!-- Step 2 -->
        <div class="step-card">
          <div class="step-badge blue">Step 2: Operations</div>
          <h3 class="step-title">Configure Operations & Taxes</h3>
          <p class="step-desc">
            Go to <strong>Settings &gt; Operations</strong>. Enter your local sales tax rate (required for accurate pricing and invoicing). Here, you can also set custom prefixes and starting numbers for invoices and proposals.
          </p>
        </div>

        <!-- Step 3 -->
        <div class="step-card highlighted">
          <div class="step-badge green">Step 3: Payments (Crucial)</div>
          <h3 class="step-title">Activate TekTrakker Payment Processing</h3>
          <p class="step-desc">
            Process credit cards and ACH bank transfers natively within the platform to get paid faster. Go to <strong>Settings &gt; Integrations</strong>, click <strong>TekTrakker Payment Processing</strong>, and select <strong>Start In-App Application</strong>. The white-labeled merchant onboarding takes less than 5 minutes.
          </p>
          <table class="fee-table">
            <thead>
              <tr>
                <th>Payment Type</th>
                <th>Rate / Flat Fee</th>
                <th>Monthly Minimum</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Credit & Debit Cards</strong></td>
                <td>2.7% + $0.25 per transaction</td>
                <td>$25.00</td>
              </tr>
              <tr>
                <td><strong>ACH / Bank Transfers</strong></td>
                <td>$1.25 flat per transaction</td>
                <td>$25.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Step 4 -->
        <div class="step-card">
          <div class="step-badge blue">Step 4: Integrations (SMTP & Widgets)</div>
          <h3 class="step-title">Configure Custom Email & Website Widgets</h3>
          <p class="step-desc">
            Go to <strong>Settings &gt; Integrations</strong> to connect essential communications and web tools:
            <br>• <strong>Custom Email (SMTP):</strong> Enter your email server details (Host, Port, Username, Password) so all proposals, invoices, and updates are sent directly from your own business email address instead of the platform default.
            <br>• <strong>Website Widgets:</strong> Copy the widget embed codes for the <strong>Online Booking Widget</strong> and the <strong>Hiring/Job Application Widget</strong> to paste directly onto your company website, enabling customers to request jobs and applicants to apply for jobs online.
          </p>
        </div>

        <!-- Step 5 -->
        <div class="step-card">
          <div class="step-badge blue">Step 5: Branding</div>
          <h3 class="step-title">Upload Company Branding</h3>
          <p class="step-desc">
            Go to <strong>Settings &gt; Branding</strong>. Upload your logo and letterhead, and set your brand color. This ensures all generated invoices, proposals, and customer portals look customized and premium.
          </p>
        </div>

        <!-- Step 6 -->
        <div class="step-card">
          <div class="step-badge blue">Step 6: Legal Terms</div>
          <h3 class="step-title">Define Legal & Warranties</h3>
          <p class="step-desc">
            Go to <strong>Settings &gt; Legal</strong>. Save your terms and conditions, workmanship/parts warranties, and NDAs so they automatically attach to customer proposals and invoices.
          </p>
        </div>

        <!-- Step 7 -->
        <div class="step-card">
          <div class="step-badge blue">Step 7: Team Dispatch</div>
          <h3 class="step-title">Invite Your Workforce</h3>
          <p class="step-desc">
            Go to <strong>Workforce &gt; Add Employee</strong>. Register your field technicians and office staff. Setting their roles (e.g., employee, supervisor) allows you to schedule and dispatch jobs to them.
          </p>
        </div>

        <div class="btn-container">
          <a href="${loginUrl}" class="btn" style="color: #ffffff !important;">Go to Dashboard</a>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated onboarding message sent to new registered accounts.</p>
        <p>&copy; ${currentYear} TekTrakker. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

              await db.collection('mail_queue').add(cleanUndefinedFields({
                  to: normalizedEmail,
                  message: {
                      subject: welcomeSubject,
                      html: welcomeHtml
                  },
                  organizationId: orgId,
                  type: 'WelcomeOnboarding',
                  createdAt: new Date().toISOString()
              }));

              // SUCCESS - Redirect to Login (User's preferred flow)
              await auth.signOut();
              dispatch({ type: 'LOGOUT' });
              
              setSuccessMsg("Business registered successfully! A verification link was sent. Please verify your email before logging in.");
              setIsLoading(false);
              
              // Move to login view via internal state AND clean URL
              setView('login');
              navigate('/login', { replace: true });
          }
      } catch (regError: unknown) {
          setError(`${(regError as Error).message}`);
          setIsLoading(false);
      }
  };

  const handleVerifyMfaChallenge = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!mfaUser) {
          setError("Session expired. Please try signing in again.");
          setView('login');
          return;
      }
      if (!mfaCode || mfaCode.length !== 6) {
          setError("Verification code must be exactly 6 digits.");
          return;
      }
      
      setError('');
      setIsVerifyingMfa(true);
      try {
          const secret = (mfaUser as any).mfaSecret || '';
          const isVerified = await verifyTOTP(secret, mfaCode);
           if (isVerified) {
              // Store verification token in sessionStorage
              sessionStorage.setItem('mfa_verified_' + mfaUser.id, 'true');
              
              // Fetch organization data to dispatch LOGIN_SUCCESS
              const isMasterAdmin = mfaUser.role === 'master_admin';
              const isSales = mfaUser.role === 'platform_sales';
              let orgData: any = undefined;

              if (mfaUser.organizationId && mfaUser.organizationId !== 'unaffiliated') {
                  const orgDoc = await db.collection('organizations').doc(mfaUser.organizationId).get();
                  if (orgDoc.exists) orgData = { id: mfaUser.organizationId, ...orgDoc.data() };
              } else if (isMasterAdmin || isSales) {
                  orgData = {
                      id: 'platform',
                      name: 'Platform',
                      createdAt: new Date().toISOString(),
                      subscriptionStatus: 'active'
                  };
              }

              // Dispatch LOGIN_SUCCESS globally
              dispatch({ 
                  type: 'LOGIN_SUCCESS', 
                  payload: { user: mfaUser, organization: orgData, isMasterAdmin } 
              });
              
              // Proceed to login success redirect
              await processLoggedInUser(mfaUser.id, mfaUser.email || '', mfaUser);
          } else {
              setError("Invalid verification code. Please check your authenticator and try again.");
          }
      } catch (err: any) {
          setError("MFA Verification Failed: " + err.message);
      } finally {
          setIsVerifyingMfa(false);
      }
  };

  const handleCancelMfaChallenge = async () => {
      await auth.signOut();
      dispatch({ type: 'LOGOUT' });
      setMfaUser(null);
      setMfaCode('');
      setError('');
      setView('login');
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
        <div role="button" aria-label="Go to Home" title="Go to Home" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') window.location.href = '/'; }} className="text-center mb-8 cursor-pointer" onClick={() => window.location.href = '/'}>
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
            <p className="text-slate-400 text-sm mb-8">
                {view === 'mfa_challenge' 
                    ? 'Verify your identity to proceed' 
                    : view === 'login' 
                        ? 'Sign in to access your dashboard' 
                        : view === 'register_business' 
                            ? 'Start your 14-day free trial' 
                            : 'Create your account'}
            </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-4 md:p-8 rounded-3xl shadow-2xl">
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                    {showResendBtn && (
                        <button 
                            type="button" 
                            onClick={handleResendVerification}
                            className="text-xs text-blue-400 hover:text-blue-300 font-bold self-start mt-1 underline"
                        >
                            Resend Verification Email
                        </button>
                    )}
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
                    biometricEnabled={isBiometricEnabled && Capacitor.isNativePlatform()}
                    handleBiometricLogin={() => triggerBiometricLogin(true)}
                />
            )}

            {view === 'mfa_challenge' && (
                <form onSubmit={handleVerifyMfaChallenge} className="space-y-6">
                    <div className="text-center space-y-3">
                        <div className="inline-flex p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl animate-pulse">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Security Verification</h3>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                            Enter the 6-digit verification code from your authenticator app for <span className="font-semibold text-indigo-300 select-all">{mfaUser?.email}</span>.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="mfa-code" className="block text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">
                                Verification Code
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                    <Key className="w-5 h-5" />
                                </div>
                                <input 
                                    id="mfa-code"
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder="000000" 
                                    value={mfaCode} 
                                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                    required
                                    className="w-full pl-12 pr-4 py-4 rounded-xl font-bold bg-slate-950 border border-slate-800 text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xl tracking-[0.5em] text-center transition-all shadow-inner"
                                    autoComplete="one-time-code"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <style>{`.mfa-btn { background-color: ${brandColor}; }`}</style>
                        <button 
                            type="submit" 
                            disabled={isVerifyingMfa || mfaCode.length !== 6}
                            className="w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 mfa-btn cursor-pointer"
                        >
                            {isVerifyingMfa ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                'Verify & Continue'
                            )}
                        </button>

                        <button 
                            type="button" 
                            onClick={handleCancelMfaChallenge}
                            className="w-full py-3.5 rounded-xl font-bold text-slate-400 hover:text-white bg-slate-800/20 hover:bg-slate-800/40 border border-slate-800/60 transition-colors text-xs cursor-pointer"
                        >
                            Cancel and Sign Out
                        </button>
                    </div>
                </form>
            )}

            {view === 'register_user' && (
                <UserRegistrationForm 
                    userType={userType} setUserType={setUserType} userName={userName} setUserName={setUserName} 
                    userPhone={userPhone} setUserPhone={setUserPhone} email={email} setEmail={setEmail} 
                    password={password} setPassword={setPassword} userAddress={userAddress} setUserAddress={setUserAddress} 
                    userCity={userCity} setUserCity={setUserCity} userState={userState} setUserState={setUserState} 
                    userZip={userZip} setUserZip={setUserZip} userServiceNeed={userServiceNeed} setUserServiceNeed={setUserServiceNeed} 
                    consentGiven={consentGiven} setConsentGiven={setConsentGiven} 
                    termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} brandedOrgName={brandedOrgName}
                    handleRegisterUser={handleRegisterUser} 
                    isLoading={isLoading} brandColor={brandColor} setView={setView} 
                    inviteLoaded={inviteLoaded}
                />
            )}

            {view === 'register_business' && (
                <BusinessRegistrationForm 
                    bizRegStep={bizRegStep} setBizRegStep={setBizRegStep} businessName={businessName} setBusinessName={setBusinessName} 
                    ownerName={ownerName} setOwnerName={setOwnerName} businessPhone={businessPhone} setBusinessPhone={setBusinessPhone} 
                    email={email} setEmail={setEmail} password={password} setPassword={setPassword} promoCode={promoCode} setPromoCode={setPromoCode}
                    selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} platformSettings={state.platformSettings} 
                    consentGiven={consentGiven} setConsentGiven={setConsentGiven} 
                    termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted}
                    ccName={ccName} setCcName={setCcName} 
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
