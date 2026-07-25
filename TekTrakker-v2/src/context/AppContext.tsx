import { cleanUndefinedFields } from '../lib/utils';
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useRef, useMemo, useCallback, useState } from 'react';
import { auth, db } from 'lib/firebase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { 
    User, Organization, PlatformSettings, Job, Customer, MembershipPlan, Project, Proposal, ServiceAgreement, Expense, EquipmentRental, Subcontractor, Applicant, BusinessDocument, Vehicle, Review, Message, Notification
} from 'types';
import { appReducer, Action } from './reducer';
import { AppState, initialState } from './state';
import {
    MOCK_DEMO_EXPENSES, MOCK_DEMO_RENTALS, MOCK_DEMO_SUBCONTRACTORS, 
    MOCK_DEMO_APPLICANTS, MOCK_DEMO_DOCUMENTS, MOCK_DEMO_VEHICLES, MOCK_DEMO_REVIEWS
} from 'lib/mockDemoData';
import {
    APEX_MOCK_ORG, APEX_MOCK_USERS, APEX_MOCK_CUSTOMERS, APEX_MOCK_JOBS,
    APEX_MOCK_PROJECTS, APEX_MOCK_PROPOSALS, APEX_MOCK_PLANS, APEX_MOCK_AGREEMENTS
} from 'lib/mock-data/apex-demo';

interface AppContextInterface {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  impersonateOrganization: (org: string | Organization | null) => Promise<void>;
  getRedirectPath: (user: User | null, isMasterAdmin: boolean) => string;
  startDemo: (role: 'admin' | 'employee' | 'customer' | 'sales') => void;
  startApexDemo: (role: 'admin' | 'employee') => void;
  exitDemo: () => void;
}

const AppContext = createContext<AppContextInterface | undefined>(undefined);

interface AppProviderProps { children: ReactNode; }

const PLATFORM_ORGANIZATION: Organization = {
    id: 'platform',
    name: 'Platform',
    phone: '',
    email: '',
    createdAt: new Date().toISOString(),
    ownerId: '',
    subscriptionStatus: 'active',
    stripeCustomerId: '',
    industries: [],
    profileImageUrl: '',
    coverImageUrl: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    address: { street: '', city: '', state: '', zip: '' },
    bio: '',
    features: {},
    branding: {},
    serviceableRegions: [],
    avgRating: 0,
    reviewCount: 0,
};

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const dataSubscriptions = useRef<(() => void)[]>([]);
    const usersSubscription = useRef<(() => void) | null>(null);
    const [syncTrigger, setSyncTrigger] = useState(0);
    const demoInitRequested = useRef(false);
    const demoModeRef = useRef(false);
    const navigate = useNavigate();

    // Keep the ref in sync with state so the auth callback can read it synchronously
    demoModeRef.current = state.isDemoMode || demoInitRequested.current;
    
    const unsubscribeData = useCallback(() => {
        dataSubscriptions.current.forEach(unsub => unsub());
        dataSubscriptions.current = [];
    }, []);

    const getRedirectPath = useCallback((user: User | null, isMasterAdmin: boolean): string => {
        if (!user) return '/login';
        if ((user.role as string) === 'kort_tester') return '/admin/kort-playground';

        if (isMasterAdmin || user.role === 'franchise_admin') return '/master/dashboard';
        if (user.role === 'platform_sales') return '/sales/dashboard';
        if (user.role === 'admin' || user.role === 'both' || user.role === 'supervisor') return '/admin/dashboard';
        if (user.role === 'customer') {
            if (!user.organizationId || user.organizationId === 'unaffiliated') {
                return '/marketplace';
            }
            return '/portal';
        }
        if (user.role === 'employee') return '/briefing';
        
        const path = (!user.organizationId || user.organizationId === 'unaffiliated' || !user.role) ? '/marketplace' : '/login';
        return path;
    }, []);


    const startDemo = useCallback((role: 'admin' | 'employee' | 'customer' | 'sales') => {
        // Set synchronous flag BEFORE dispatch to guard against auth race condition
        demoInitRequested.current = true;
        sessionStorage.setItem('activeDemoRole', role);

        if (!sessionStorage.getItem('preDemoPath')) {
            sessionStorage.setItem('preDemoPath', window.location.pathname + window.location.search + window.location.hash);
        }
        // Save the referrer so we can return the user to the originating site (e.g. tektrakker.com)
        if (!sessionStorage.getItem('preDemoReferrer') && document.referrer) {
            sessionStorage.setItem('preDemoReferrer', document.referrer);
        }
        
        // Guard against any pending onAuthStateChanged callbacks from firing
        // during the React render cycle where we transition into demo mode.
        demoInitRequested.current = true;
        
        unsubscribeData();
        
        let mockUser: User | undefined;
        if (role === 'employee') {
            mockUser = APEX_MOCK_USERS.find(u => u.id === 'apex-lead-tech-id');
        } else {
            mockUser = APEX_MOCK_USERS.find(u => u.role === role);
        }

        if (!mockUser) {
            console.error(`No mock user found for role: ${role}`);
            mockUser = APEX_MOCK_USERS[0];
        }

        // Deep clone mock user to prevent modifications
        const clonedCurrentUser = JSON.parse(JSON.stringify(mockUser));

        const jobs = JSON.parse(JSON.stringify(APEX_MOCK_JOBS));
        const jobIndex = jobs.findIndex((j: Job) => j.id === 'apex-job-2');
        if (jobIndex !== -1 && mockUser) {
            jobs[jobIndex].appointmentTime = new Date().toISOString();
            jobs[jobIndex].assignedTechnicianId = mockUser.id;
            jobs[jobIndex].assignedTechnicianName = `${mockUser.firstName} ${mockUser.lastName}`;
        }

        // Deep clone other interactive mock data to avoid mutating in-memory static arrays
        const clonedOrg = JSON.parse(JSON.stringify(APEX_MOCK_ORG));
        const clonedUsers = JSON.parse(JSON.stringify(APEX_MOCK_USERS));
        const clonedCustomers = JSON.parse(JSON.stringify(APEX_MOCK_CUSTOMERS));
        const clonedProposals = JSON.parse(JSON.stringify(APEX_MOCK_PROPOSALS));
        const clonedProjects = JSON.parse(JSON.stringify(APEX_MOCK_PROJECTS));
        const clonedAgreements = JSON.parse(JSON.stringify(APEX_MOCK_AGREEMENTS));
        const clonedPlans = JSON.parse(JSON.stringify(APEX_MOCK_PLANS));
        const clonedApplicants = JSON.parse(JSON.stringify(MOCK_DEMO_APPLICANTS));
        const clonedDocuments = JSON.parse(JSON.stringify(MOCK_DEMO_DOCUMENTS));
        const clonedVehicles = JSON.parse(JSON.stringify(MOCK_DEMO_VEHICLES));
        const clonedReviews = JSON.parse(JSON.stringify(MOCK_DEMO_REVIEWS));
        const clonedSubcontractors = JSON.parse(JSON.stringify(MOCK_DEMO_SUBCONTRACTORS));
        const clonedExpenses = JSON.parse(JSON.stringify(MOCK_DEMO_EXPENSES));
        const clonedRentals = JSON.parse(JSON.stringify(MOCK_DEMO_RENTALS));

        dispatch({
            type: 'START_DEMO',
            payload: {
                currentUser: clonedCurrentUser,
                currentOrganization: clonedOrg,
                users: clonedUsers as User[],
                jobs: jobs as Job[],
                customers: clonedCustomers as Customer[],
                membershipPlans: clonedPlans as MembershipPlan[],
                projects: clonedProjects as Project[],
                proposals: clonedProposals as Proposal[],
                serviceAgreements: clonedAgreements as ServiceAgreement[],
                applicants: clonedApplicants as Applicant[],
                documents: clonedDocuments as BusinessDocument[],
                vehicles: clonedVehicles as Vehicle[],
                reviews: clonedReviews as Review[],
                subcontractors: clonedSubcontractors as Subcontractor[],
                expenses: clonedExpenses as Expense[],
                rentals: clonedRentals as EquipmentRental[],
            }
        });
    }, [unsubscribeData]);

    const startApexDemo = useCallback((role: 'admin' | 'employee') => {
        startDemo(role);
    }, [startDemo]);

    // Clear any stale demo role from sessionStorage on fresh page loads.
    // Demo mode is ephemeral — if the page reloads, the user returns to the ApexDemo chooser.
    useEffect(() => {
        sessionStorage.removeItem('activeDemoRole');
    }, []);

    const exitDemo = useCallback(() => {
        // Set synchronous guard flag immediately
        demoInitRequested.current = true;
        
        const preDemoPath = sessionStorage.getItem('preDemoPath');
        const preDemoReferrer = sessionStorage.getItem('preDemoReferrer');
        
        // Clean up demo session storage
        sessionStorage.removeItem('preDemoPath');
        sessionStorage.removeItem('preDemoReferrer');
        sessionStorage.removeItem('activeDemoRole');

        // If they came from the marketing site, send them back there (cross-origin = full reload)
        if (preDemoReferrer && (preDemoReferrer.includes('tektrakker.com') && !preDemoReferrer.includes('app.tektrakker.com'))) {
            demoInitRequested.current = false;
            window.location.replace(preDemoReferrer);
            return;
        }

        const targetPath = preDemoPath || '/pro/apex';

        // Dispatch EXIT_DEMO to reset demo state but keep loading as true to avoid redirecting to login page
        dispatch({ type: 'EXIT_DEMO' });

        const performSessionRestore = async () => {
            const firebaseUser = auth.currentUser;
            if (firebaseUser) {
                try {
                    const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
                    if (userDoc.exists) {
                        const userData = { id: firebaseUser.uid, ...userDoc.data() } as User;
                        const isMasterAdmin = userData.role === 'master_admin' || userData.role === 'both';
                        const isSales = userData.role === 'platform_sales';

                        let orgData: any = undefined;
                        if (userData.organizationId) {
                            const orgDoc = await db.collection('organizations').doc(userData.organizationId).get();
                            if (orgDoc.exists) orgData = { id: userData.organizationId, ...orgDoc.data() } as Organization;
                        } else if (isMasterAdmin || isSales) {
                            orgData = PLATFORM_ORGANIZATION;
                        }

                        dispatch({
                            type: 'LOGIN_SUCCESS',
                            payload: {
                                user: userData,
                                organization: orgData,
                                isMasterAdmin
                            }
                        });

                        // Re-route back to dashboard cleanly (pre-demo path or default path for role)
                        const dest = getRedirectPath(userData, isMasterAdmin);
                        const finalPath = preDemoPath ? targetPath : dest;

                        if (finalPath.startsWith('http')) {
                            window.location.href = finalPath;
                        } else {
                            const cleanPath = finalPath.replace(/^(\/#\/|\/|#\/)/, '/');
                            navigate(cleanPath, { replace: true });
                        }

                        demoInitRequested.current = false;
                        return;
                    }
                } catch (err) {
                    console.error("[AppContext] Failed to restore real session on exit demo:", err);
                }
            }

            // Fallback: No real user found or fetch failed. Force redirect to login page.
            dispatch({ type: 'SET_LOADING', payload: false });
            if (targetPath.startsWith('http')) {
                window.location.href = targetPath;
            } else {
                const cleanPath = targetPath.replace(/^(\/#\/|\/|#\/)/, '/');
                navigate(cleanPath, { replace: true });
            }
            demoInitRequested.current = false;
        };

        performSessionRestore();
    }, [dispatch, navigate, getRedirectPath]);

    useEffect(() => {
        // Use the ref (not state) to decide whether to skip auth processing.
        // This prevents the effect from re-subscribing every time isDemoMode toggles,
        // which was the root cause of the "exit demo → re-enter demo → kicked to login" bug.
        if (demoModeRef.current) {
            return;
        }

        let isEffectActive = true;

        // Failsafe timeout: If Firebase auth completely hangs and never fires onAuthStateChanged
        // (common on fresh Android installs due to IndexedDB init), force loading to false so the user isn't stuck.
        const fallbackTimer = setTimeout(() => {
            if (state.loading && isEffectActive && !demoInitRequested.current) {
                console.warn("[AppFailsafe] Firebase onAuthStateChanged timed out. Forcing UI to load.");
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        }, 3500);

        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            clearTimeout(fallbackTimer);
            // Guard: if demo mode is active or being initialized, skip auth processing entirely.
            // Check both the ref and the synchronous flag to catch all race conditions.
            if (demoInitRequested.current || demoModeRef.current || !isEffectActive) return;
            unsubscribeData();
            if (user) {
                dispatch({ type: 'SET_LOADING', payload: true });
                try {
                    // Profile Fetch with Cache-First + Timeout
                    const fetchProfile = async () => {
                        let userDoc;
                        
                        // 1. Try cache first for instant offline/weak connection load
                        try {
                            userDoc = await db.collection('users').doc(user.uid).get({ source: 'cache' });
                            console.log("[AppContext] Cached user profile found:", userDoc.exists);
                        } catch (cacheErr) {
                            console.log("[AppContext] No user profile in cache. Reading from server...");
                        }

                        // 2. Fall back to standard server fetch if missing from cache
                        if (!userDoc || !userDoc.exists) {
                            try {
                                userDoc = await db.collection('users').doc(user.uid).get();
                            } catch (getErr) {
                                console.warn("[AppContext] Initial profile fetch failed/blocked:", getErr);
                                userDoc = { exists: false } as any;
                            }
                        }
                        
                        if (!userDoc.exists) {
                            if (user.email === 'rodzelem@gmail.com' || user.email === 'ryanvavrecan@gmail.com') {
                                console.warn("Master UID profile missing! Cloning auth data to correct UID endpoint for Security Rules...");
                                // This physically maps the SuperAdmin identity exactly to the UID so Security Rules `isMaster()` evaluates structurally true
                                await db.collection('users').doc(user.uid).set(cleanUndefinedFields({
                                    id: user.uid, uid: user.uid, email: user.email,
                                    role: 'master_admin', status: 'active',
                                    firstName: user.email === 'rodzelem@gmail.com' ? 'Master' : 'Ryan',
                                    lastName: user.email === 'rodzelem@gmail.com' ? 'Admin' : 'Vavrecan',
                                    organizationId: 'platform'
                                }));
                                userDoc = await db.collection('users').doc(user.uid).get();
                            } else {
                                // Wait 2 seconds to allow Login.tsx's batch.commit() to propagate across Firestore CDNs
                                await new Promise(resolve => setTimeout(resolve, 2000));
                                userDoc = await db.collection('users').doc(user.uid).get();
                            }
                        }

                        if (userDoc.exists) {
                            let userData = { id: user.uid, ...userDoc.data() } as User;
                            
                            // Agreesive Override: If the admin got trapped in a degraded fallback profile, forcibly elevate them.
                            if ((user.email === 'rodzelem@gmail.com' || user.email === 'ryanvavrecan@gmail.com') && userData.role !== 'master_admin') {
                                console.warn("Degraded admin profile detected! Forcing Master Elevation...");
                                await db.collection('users').doc(user.uid).set(cleanUndefinedFields({
                                    ...userData,
                                    role: 'master_admin',
                                    organizationId: 'platform'
                                }), { merge: true });
                                userData.role = 'master_admin';
                                userData.organizationId = 'platform';
                            }
                            
                            const isMasterAdmin = userData.role === 'master_admin';
                            const isSales = userData.role === 'platform_sales';
                            let orgData: Organization | undefined = undefined;

                            if (userData.organizationId) {
                                const orgDoc = await db.collection('organizations').doc(userData.organizationId).get();
                                if (orgDoc.exists) orgData = { id: userData.organizationId, ...orgDoc.data() } as Organization;
                            } else if (isMasterAdmin || isSales) {
                                orgData = PLATFORM_ORGANIZATION;
                            }

                            // MFA Session Interception
                            if ((userData as any).mfaEnabled) {
                                const isMfaVerified = sessionStorage.getItem('mfa_verified_' + user.uid) === 'true';
                                if (!isMfaVerified) {
                                    console.log("[AppContext] Intercepted session initialization: MFA challenge required for user:", user.uid);
                                    if (!isEffectActive || demoInitRequested.current) return;
                                    dispatch({ type: 'SET_LOADING', payload: false });
                                    return;
                                }
                            }

                            if (!isEffectActive || demoInitRequested.current) return;
                            dispatch({ type: 'LOGIN_SUCCESS', payload: { user: userData, organization: orgData, isMasterAdmin } });

                            // Trigger background server sync to refresh profile data silently (SWR)
                            db.collection('users').doc(user.uid).get({ source: 'server' }).then(async (serverDoc) => {
                                if (serverDoc.exists && isEffectActive && !demoInitRequested.current) {
                                    console.log("[AppContext] Background profile refresh succeeded.");
                                    let serverUserData = { id: user.uid, ...serverDoc.data() } as User;
                                    
                                    if ((user.email === 'rodzelem@gmail.com' || user.email === 'ryanvavrecan@gmail.com') && serverUserData.role !== 'master_admin') {
                                        await db.collection('users').doc(user.uid).set(cleanUndefinedFields({
                                            ...serverUserData,
                                            role: 'master_admin',
                                            organizationId: 'platform'
                                        }), { merge: true });
                                        serverUserData.role = 'master_admin';
                                        serverUserData.organizationId = 'platform';
                                    }

                                    const sMaster = serverUserData.role === 'master_admin';
                                    const sSales = serverUserData.role === 'platform_sales';
                                    let sOrg: Organization | undefined = undefined;

                                    if (serverUserData.organizationId) {
                                        const orgDoc = await db.collection('organizations').doc(serverUserData.organizationId).get();
                                        if (orgDoc.exists) sOrg = { id: serverUserData.organizationId, ...orgDoc.data() } as Organization;
                                    } else if (sMaster || sSales) {
                                        sOrg = PLATFORM_ORGANIZATION;
                                    }

                                    dispatch({ type: 'LOGIN_SUCCESS', payload: { user: serverUserData, organization: sOrg, isMasterAdmin: sMaster } });
                                }
                            }).catch(err => {
                                console.warn("[AppContext] Background profile refresh failed/ignored:", err);
                            });
                        } else {
                            if (!isEffectActive || demoInitRequested.current) return;
                            // User exists in Auth but not in Firestore - likely a brand new registration
                            // We don't log out yet, wait for Login.tsx to handle the redirect part
                            dispatch({ type: 'SET_LOADING', payload: false });
                        }
                    };

                    // Race between fetch and 30s timeout (increased from 12s to tolerate slow cellular networks)
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000));
                    try {
                        await Promise.race([fetchProfile(), timeoutPromise]);
                    } catch (raceErr) {
                        if (!isEffectActive || demoInitRequested.current) return;
                        console.error("Auth initialization timed out or failed:", raceErr);
                        dispatch({ type: 'SET_LOADING', payload: false });
                        // If it's a real account (not just registered), log out to clear the hang
                        if (new Date().getTime() - new Date(user.metadata.creationTime || 0).getTime() > 30000) {
                             dispatch({ type: 'LOGOUT' });
                        }
                    }
                } catch (error) {
                    if (!isEffectActive || demoInitRequested.current) return;
                    console.error("Error fetching user data:", error);
                    dispatch({ type: 'SET_LOADING', payload: false });
                    dispatch({ type: 'LOGOUT' });
                }
            } else {
                if (!isEffectActive || demoInitRequested.current) return;
                
                // Clear any cached MFA verification tokens from session storage upon sign out
                for (let i = sessionStorage.length - 1; i >= 0; i--) {
                    const key = sessionStorage.key(i);
                    if (key && key.startsWith('mfa_verified_')) {
                        sessionStorage.removeItem(key);
                    }
                }

                dispatch({ type: 'SET_LOADING', payload: false });
                dispatch({ type: 'LOGOUT' });
            }
        });
        return () => {
            isEffectActive = false;
            unsubscribeAuth();
        };
    }, [unsubscribeData, dispatch]);

    const linkedSubcontractorOrgsKey = useMemo(() => {
        return (state.subcontractors || [])
            .filter(s => s.handshakeStatus === 'Linked' && s.linkedOrgId)
            .map(s => s.linkedOrgId)
            .sort()
            .join(',');
    }, [state.subcontractors]);

    useEffect(() => {
        const currentUser = state.currentUser;

        if (state.isDemoMode || !currentUser) {
            unsubscribeData();
            return;
        }

        const { isMasterAdmin, currentOrganization } = state;
        const isCustomer = currentUser.role === 'customer';
        const isSales = currentUser.role === 'platform_sales';
        
        const newSubscriptions: (() => void)[] = [];

        newSubscriptions.push(db.collection('platformSettings').doc('global').onSnapshot(s => {
            if (s.exists) dispatch({ type: 'SET_PLATFORM_SETTINGS', payload: {id: s.id, ...s.data()} as PlatformSettings });
        }, e => console.warn(e)));

        if (isMasterAdmin) {
            newSubscriptions.push(db.collection('franchises').onSnapshot(s => dispatch({ type: 'SET_FRANCHISES', payload: s.docs.map(d => ({ id: d.id, ...d.data() })) }), e => {
                console.error("Franchises subscription failed:", e);
                toast.error("Permission denied for Franchises");
            }));
        }

        // Fetch all organizations for any admin-type user to see linked partner details.
        if (isMasterAdmin) {
            newSubscriptions.push(db.collection('organizations').onSnapshot(s => dispatch({ type: 'SET_ALL_ORGANIZATIONS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as Organization)) }), e => {
                console.error("Organizations subscription failed:", e);
                toast.error("Access Denied: You do not have permission to view all organizations.");
            }));
        } else if (!isCustomer) {
            if (currentUser.franchiseId) {
                newSubscriptions.push(db.collection('organizations').where('franchiseId', '==', currentUser.franchiseId).onSnapshot(s => dispatch({ type: 'SET_ALL_ORGANIZATIONS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as Organization)) }), e => console.warn(e)));
            } else {
                // If the user belongs to the core tektrakker instance, filter out remote franchise orgs
                newSubscriptions.push(db.collection('organizations').onSnapshot(s => {
                    const allOrgs = s.docs.map(d => ({ id: d.id, ...d.data() } as Organization));
                    dispatch({ type: 'SET_ALL_ORGANIZATIONS', payload: allOrgs.filter(o => !o.franchiseId || o.franchiseId === 'tektrakker_core') });
                }, e => console.warn(e)));
            }
        }

        const orgIdForCollections = (currentOrganization?.id && currentOrganization.id !== 'unaffiliated')
            ? currentOrganization.id
            : (currentUser.organizationId && currentUser.organizationId !== 'unaffiliated' ? currentUser.organizationId : undefined);

        const handleMessageSnapshot = (s: any) => {
            s.docChanges().forEach((change: any) => {
                if (change.type === 'removed') {
                    dispatch({ type: 'DELETE_MESSAGE', payload: change.doc.id });
                }
            });
            dispatch({ type: 'MERGE_MESSAGES', payload: s.docs.map((d: any) => ({ ...d.data(), id: d.id })) as Message[] });
        };

        const handleNotificationSnapshot = (s: any) => {
            s.docChanges().forEach((change: any) => {
                if (change.type === 'removed') {
                    dispatch({ type: 'DELETE_NOTIFICATION', payload: change.doc.id });
                }
            });
            dispatch({ type: 'MERGE_NOTIFICATIONS', payload: s.docs.map((d: any) => ({ ...d.data(), id: d.id })) as Notification[] });
        };

        // Platform-Level Admins & Sales Representatives must securely pipe cross-tenant messages dynamically
        if (currentUser.id && (isMasterAdmin || isSales)) {
            const maskedIdentity = currentUser.role === 'master_admin' ? 'rodzelem@gmail.com' : undefined;
            const receiverIds = Array.from(new Set([currentUser.id, currentUser.email, maskedIdentity, 'all', 'all_sales', 'all_admins'].filter(Boolean)));
            newSubscriptions.push(db.collection('messages').where('receiverId', 'in', receiverIds)
                .onSnapshot(handleMessageSnapshot, e => console.warn(e)));
                
            const senderIds = Array.from(new Set([currentUser.id, currentUser.email, maskedIdentity].filter(Boolean)));
            newSubscriptions.push(db.collection('messages').where('senderId', 'in', senderIds)
                .onSnapshot(handleMessageSnapshot, e => console.warn(e)));
                
            if (isMasterAdmin) {
                // Also get direct notifications addressed to the Master Admin
                const notifUserIds = Array.from(new Set([currentUser.id, currentUser.email, 'rodzelem@gmail.com', 'ryanvavrecan@gmail.com'].filter(Boolean)));
                newSubscriptions.push(db.collection('notifications').where('userId', 'in', notifUserIds)
                    .orderBy('createdAt', 'desc').limit(100)
                    .onSnapshot(handleNotificationSnapshot, e => console.warn(e)));
            }
        }
        
        if (orgIdForCollections || isCustomer) {
            const collections: Record<string, string> = {
                'notifications': 'MERGE_NOTIFICATIONS', 'messages': 'MERGE_MESSAGES', 'customers': 'SET_CUSTOMERS', 'proposals': 'SET_PROPOSALS', 'jobs': 'SET_JOBS', 
                'inventory': 'SET_INVENTORY', 'refrigerantCylinders': 'SET_CYLINDERS', 'refrigerantTransactions': 'SET_REF_TRANSACTIONS', 'toolMaintenanceLogs': 'SET_TOOL_LOGS',
                'incidentReports': 'SET_INCIDENTS', 'proposalPresets': 'SET_PROPOSAL_PRESETS', 'projects': 'SET_PROJECTS', 'documents': 'SET_DOCUMENTS', 'reviews': 'SET_REVIEWS',
                'workSchedules': 'SET_SCHEDULES', 'membershipPlans': 'SET_MEMBERSHIP_PLANS', 'serviceAgreements': 'SET_AGREEMENTS', 'partOrders': 'SET_PART_ORDERS',
                'shopOrders': 'SET_SHOP_ORDERS', 'marketingCampaigns': 'SET_CAMPAIGNS', 'appointments': 'SET_APPOINTMENTS', 'bids': 'SET_BIDS', 'expenses': 'SET_EXPENSES',
                'inspectionTemplates': 'SET_INSPECTION_TEMPLATES', 'vehicles': 'SET_VEHICLES', 'applicants': 'SET_APPLICANTS',
                'subcontractors': 'SET_SUBCONTRACTORS', 'vehicleLogs': 'SET_VEHICLE_LOGS', 'teams': 'SET_TEAMS',
                'serviceLocations': 'SET_SERVICE_LOCATIONS', 'equipment': 'SET_EQUIPMENT'
            };

            const internalOnly = [
                'inventory', 'refrigerantCylinders', 'refrigerantTransactions', 'toolMaintenanceLogs',
                'incidentReports', 'proposalPresets', 'projects', 'workSchedules', 'partOrders',
                'shopOrders', 'marketingCampaigns', 'bids', 'expenses', 'inspectionTemplates', 'vehicles', 'applicants',
                'users', 'subcontractors', 'vehicleLogs', 'shiftLogs', 'teams'
            ];

            const customerPersonalData = ['jobs', 'proposals', 'appointments', 'serviceAgreements', 'messages', 'notifications', 'customers', 'documents', 'reviews', 'serviceLocations', 'equipment'];

            const isSubcontractor = currentUser && currentUser.role === 'Subcontractor';
            const subcontractorAllowed = ['jobs', 'messages', 'notifications', 'documents', 'inspectionTemplates', 'customers', 'inventory', 'refrigerantCylinders'];

            Object.entries(collections).forEach(([collection, actionType]) => {
                if (isCustomer && internalOnly.includes(collection)) return;
                if (isSubcontractor && !subcontractorAllowed.includes(collection)) return;

                console.log("[AppContext-Debug] Subscribing to:", collection, "for org:", orgIdForCollections);

                if (orgIdForCollections && collection === 'messages') {
                    if (isSubcontractor) {
                        const myIds = Array.from(new Set([currentUser.id, currentUser.email].filter(Boolean)));
                        newSubscriptions.push(
                            db.collection('messages')
                                .where('organizationId', '==', orgIdForCollections)
                                .where('receiverId', 'in', myIds)
                                .onSnapshot(handleMessageSnapshot, e => console.warn("Subcontractor received messages failed:", e))
                        );
                        newSubscriptions.push(
                            db.collection('messages')
                                .where('organizationId', '==', orgIdForCollections)
                                .where('senderId', 'in', myIds)
                                .onSnapshot(handleMessageSnapshot, e => console.warn("Subcontractor sent messages failed:", e))
                        );
                        return;
                    }

                    // Securely subscribe to messages in the organization:
                    // 1. Customer messages (shared)
                    newSubscriptions.push(
                        db.collection('messages')
                            .where('organizationId', '==', orgIdForCollections)
                            .where('type', 'in', ['sms', 'email', 'customer-log', 'call'])
                            .onSnapshot(handleMessageSnapshot, e => console.warn("Customer messages subscription failed:", e))
                    );

                    // 2. Team messages where user is receiver or broadcast target
                    const receiverIds = Array.from(new Set([currentUser.id, currentUser.email, 'all', 'all_sales', 'all_admins'].filter(Boolean)));
                    newSubscriptions.push(
                        db.collection('messages')
                            .where('organizationId', '==', orgIdForCollections)
                            .where('receiverId', 'in', receiverIds)
                            .onSnapshot(handleMessageSnapshot, e => console.warn("Received team messages subscription failed:", e))
                    );

                    // 3. Team messages where user is sender
                    const senderIds = Array.from(new Set([currentUser.id, currentUser.email].filter(Boolean)));
                    newSubscriptions.push(
                        db.collection('messages')
                            .where('organizationId', '==', orgIdForCollections)
                            .where('senderId', 'in', senderIds)
                            .onSnapshot(handleMessageSnapshot, e => console.warn("Sent team messages subscription failed:", e))
                    );
                    return;
                }

                let query;
                
                if (isCustomer && customerPersonalData.includes(collection)) {
                    // Statically valid queries for Firestore security rules (exact == match)
                    query = db.collection(collection).where('customerEmail', '==', currentUser.email);
                    
                    if (collection === 'customers') {
                        query = db.collection(collection).where('email', '==', currentUser.email);
                    }
                } else if (orgIdForCollections) {
                    if (collection === 'jobs' && isSubcontractor) {
                        query = db.collection('jobs')
                                  .where('organizationId', '==', orgIdForCollections)
                                  .where('assignedTechnicianId', '==', currentUser.id);
                    } else if (collection === 'documents' && isSubcontractor) {
                        const subcontractorDocs = new Map<string, any>();
                        const handleSubcontractorDocSnapshot = (s: any) => {
                            s.docs.forEach((doc: any) => {
                                subcontractorDocs.set(doc.id, { ...doc.data(), id: doc.id });
                            });
                            s.docChanges().forEach((change: any) => {
                                if (change.type === 'removed') {
                                    subcontractorDocs.delete(change.doc.id);
                                }
                            });
                            dispatch({ type: 'SET_DOCUMENTS', payload: Array.from(subcontractorDocs.values()) });
                        };

                        newSubscriptions.push(
                            db.collection('documents')
                              .where('organizationId', '==', orgIdForCollections)
                              .where('subcontractorId', '==', currentUser.id)
                              .onSnapshot(handleSubcontractorDocSnapshot, e => console.warn("Subcontractor documents sync failed:", e))
                        );

                        newSubscriptions.push(
                            db.collection('documents')
                              .where('organizationId', '==', orgIdForCollections)
                              .where('type', '==', 'Waiver Template')
                              .onSnapshot(handleSubcontractorDocSnapshot, e => console.warn("Subcontractor waiver templates sync failed:", e))
                        );
                        return;
                    } else if (collection === 'subcontractors') {
                        const subDocs = new Map<string, any>();
                        const handleSubSnapshot = (s: any) => {
                            s.docs.forEach((doc: any) => {
                                subDocs.set(doc.id, { ...doc.data(), id: doc.id });
                            });
                            s.docChanges().forEach((change: any) => {
                                if (change.type === 'removed') {
                                    subDocs.delete(change.doc.id);
                                }
                            });
                            dispatch({ type: 'SET_SUBCONTRACTORS', payload: Array.from(subDocs.values()) });
                        };

                        newSubscriptions.push(
                            db.collection('subcontractors')
                              .where('organizationId', '==', orgIdForCollections)
                              .onSnapshot(handleSubSnapshot, e => console.warn("Outgoing subcontractors subscription failed:", e))
                        );

                        newSubscriptions.push(
                            db.collection('subcontractors')
                              .where('linkedOrgId', '==', orgIdForCollections)
                              .onSnapshot(handleSubSnapshot, e => console.warn("Incoming subcontractors subscription failed:", e))
                        );
                        return;
                    } else {
                        query = db.collection(collection).where('organizationId', '==', orgIdForCollections);
                    }
                    
                    if (['messages', 'notifications'].includes(collection)) {
                        query = query.orderBy('createdAt', 'desc').limit(100);
                    }
                } else {
                    return;
                }
                
                newSubscriptions.push(query.onSnapshot(s => {
                    if (actionType === 'MERGE_MESSAGES') {
                        handleMessageSnapshot(s);
                        return;
                    }
                    if (actionType === 'MERGE_NOTIFICATIONS') {
                        handleNotificationSnapshot(s);
                        return;
                    }
                    let payload = s.docs.map(d => ({ ...d.data(), id: d.id }));
                    if (collection === 'jobs' || collection === 'proposals') {
                        payload = payload.filter((item: any) => !item.deleted);
                        
                        // Scoping for standard users based on divisions
                        const isScopedUser = currentUser && ['employee', 'Technician', 'Subcontractor'].includes(currentUser.role);
                        const assignedDivs = currentUser?.assignedDivisions || [];
                        if (isScopedUser && assignedDivs.length > 0) {
                            payload = payload.filter((item: any) => !item.divisionId || assignedDivs.includes(item.divisionId));
                        }
                    }
                    dispatch({ type: actionType, payload } as unknown as Action);
                }, (error) => {
                    console.error(`Subscription failed for ${collection}:`, error);
                }));

                // Fallback by name is disabled for customers because it violates Firestore security rules (isCustomerOwner does not allow reading by customerName)
            });

            // NEW: Global Subscriptions for Master Admins
            // Since messages/notifications are siloed by organizationId, 
            // Master Admins need a direct listener for things specifically addressed to them or global aliases.
            if (isMasterAdmin) {
                const globalMessageTargets = ['rodzelem@gmail.com', 'ryanvavrecan@gmail.com', 'all', 'all_admins'];
                newSubscriptions.push(db.collection('messages')
                    .where('receiverId', 'in', globalMessageTargets)
                    .orderBy('createdAt', 'desc').limit(100)
                    .onSnapshot(handleMessageSnapshot, e => console.error("Global messages subscription failed:", e))
                );
                
                newSubscriptions.push(db.collection('notifications')
                    .where('userId', 'in', globalMessageTargets)
                    .orderBy('createdAt', 'desc').limit(100)
                    .onSnapshot(handleNotificationSnapshot, e => console.error("Global notifications subscription failed:", e))
                );
            }

            // NEW: Fetch warranty claims as a subcollection
            if (orgIdForCollections && !isCustomer) {
                newSubscriptions.push(db.collection('organizations')
                    .doc(orgIdForCollections)
                    .collection('warrantyClaims')
                    .onSnapshot(s => {
                        const payload = s.docs.map(d => ({ ...d.data(), id: d.id }));
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        dispatch({ type: 'SET_WARRANTY_CLAIMS', payload: payload as unknown as any[] } as unknown as Action);
                    }, error => console.error("Warranty claims subscription failed:", error))
                );
            }

            // NEW: Fetch external jobs assigned to this organization
            if (orgIdForCollections && !isCustomer) {
                newSubscriptions.push(db.collection('jobs')
                    .where('assignedPartnerId', '==', orgIdForCollections)
                    .onSnapshot(s => {
                        const payload = s.docs.map(d => ({ ...d.data(), id: d.id } as Job));
                        dispatch({ type: 'SET_EXTERNAL_JOBS', payload });
                    }, error => console.error("External jobs subscription failed:", error))
                );

                newSubscriptions.push(db.collection('shiftLogs')
                    .where('organizationId', '==', orgIdForCollections)
                    .onSnapshot(s => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const payload = s.docs.map(d => ({ ...d.data(), id: d.id } as any));
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const groupedByUser = payload.reduce((acc: any, log: any) => {
                            if (!acc[log.userId]) acc[log.userId] = [];
                            acc[log.userId].push(log);
                            return acc;
                        }, {});
                        Object.entries(groupedByUser).forEach(([userId, logs]) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            dispatch({ type: 'SET_SHIFT_LOGS', payload: { userId, logs: logs as any[] } });
                        });
                    }, error => console.error("Shift logs subscription failed:", error))
                );
            }
        }
        
        dataSubscriptions.current = newSubscriptions;

        return () => {
            unsubscribeData();
        };

    }, [
        state.currentUser?.id, 
        state.currentUser?.role, 
        state.currentUser?.email, 
        state.currentUser?.organizationId,
        state.currentUser?.franchiseId,
        state.isMasterAdmin, 
        state.currentOrganization?.id,
        state.isDemoMode,
        unsubscribeData,
        dispatch,
        syncTrigger
    ]);

    // Separate useEffect for users subscription to avoid rebuilding all subscriptions when state.subcontractors updates
    useEffect(() => {
        const currentUser = state.currentUser;
        if (state.isDemoMode || !currentUser) {
            if (usersSubscription.current) {
                usersSubscription.current();
                usersSubscription.current = null;
            }
            return;
        }

        const { isMasterAdmin, currentOrganization } = state;
        const isCustomer = currentUser.role === 'customer';
        const isSales = currentUser.role === 'platform_sales';

        if (usersSubscription.current) {
            usersSubscription.current();
            usersSubscription.current = null;
        }

        if (isMasterAdmin) {
            // Master admins get all users
            usersSubscription.current = db.collection('users').onSnapshot(
                s => dispatch({ type: 'SET_USERS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as User)) }), 
                e => {
                    console.error("Users subscription failed:", e);
                    toast.error("Permission denied for Users list");
                }
            );
        } else if (currentUser.role === 'franchise_admin' && currentUser.franchiseId) {
            // Franchise admins get all users within their franchise silhouette
            usersSubscription.current = db.collection('users')
                .where('franchiseId', '==', currentUser.franchiseId)
                .onSnapshot(
                    s => dispatch({ type: 'SET_USERS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as User)) }), 
                    e => console.warn(e)
                );
        } else if (!isCustomer) {
            console.log("[AppContext-Debug] Users subscription setup. role:", currentUser.role, "org:", currentUser.organizationId);
            const targetOrgId = isSales 
                ? (currentOrganization?.id || currentUser.organizationId)
                : currentUser.organizationId;
            if (targetOrgId) {
                const targetOrgIds = [targetOrgId];
                (state.subcontractors || []).forEach(sub => {
                    if (sub.handshakeStatus === 'Linked' && sub.linkedOrgId) {
                        targetOrgIds.push(sub.linkedOrgId);
                    }
                });
                const queryOrgIds = Array.from(new Set(targetOrgIds)).slice(0, 30);
                console.log("[AppContext-Debug] Subscribing to users with org IDs:", queryOrgIds);
                const usersQuery = queryOrgIds.length === 1
                    ? db.collection('users').where('organizationId', '==', queryOrgIds[0])
                    : db.collection('users').where('organizationId', 'in', queryOrgIds);
                usersSubscription.current = usersQuery.onSnapshot(
                    s => {
                        console.log("[AppContext-Debug] Users query succeeded. Count:", s.size, "queryOrgIds:", queryOrgIds);
                        dispatch({ type: 'SET_USERS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as User)) });
                    },
                    e => console.error("[AppContext-Debug] Users subscription failed:", e)
                );
            }
        }

        return () => {
            if (usersSubscription.current) {
                usersSubscription.current();
                usersSubscription.current = null;
            }
        };
    }, [
        state.currentUser?.id,
        state.currentUser?.organizationId,
        state.currentUser?.role,
        state.currentOrganization?.id,
        state.isDemoMode,
        linkedSubcontractorOrgsKey,
        dispatch
    ]);

    // NEW: Capacitor AppState Listener for background sync recovery
    useEffect(() => {
        let isMounted = true;
        const initCapacitor = async () => {
            try {
                const { App: CapacitorApp } = await import(/* @vite-ignore */ '@capacitor/app');
                if (!isMounted) return;
                CapacitorApp.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) {
                        console.log('App resumed, refreshing data subscriptions...');
                        setSyncTrigger(prev => prev + 1);
                    }
                });
            } catch (e) {
                // Not running in Capacitor, ignore safely
            }
        };
        initCapacitor();
        return () => {
            isMounted = false;
        };
    }, []);

    const impersonateOrganization = useCallback(async (org: string | Organization | null) => {
        if (state.isDemoMode) return;
        if (!org) {
            if (state.currentUser?.organizationId) {
                const orgDoc = await db.collection('organizations').doc(state.currentUser.organizationId).get();
                if (orgDoc.exists) dispatch({ type: 'SET_CURRENT_ORGANIZATION', payload: { id: state.currentUser.organizationId, ...orgDoc.data() } as Organization });
            } else if (state.isMasterAdmin || state.currentUser?.role === 'platform_sales') {
                dispatch({ type: 'SET_CURRENT_ORGANIZATION', payload: PLATFORM_ORGANIZATION });
            }
            return;
        }
        if (typeof org === 'string') {
            const orgDoc = await db.collection('organizations').doc(org).get();
            if (orgDoc.exists) dispatch({ type: 'SET_CURRENT_ORGANIZATION', payload: { id: org, ...orgDoc.data() } as Organization });
        } else dispatch({ type: 'SET_CURRENT_ORGANIZATION', payload: org });
    }, [state.currentUser?.organizationId, state.isMasterAdmin, state.currentUser?.role, state.isDemoMode, dispatch]);

    const contextValue = useMemo(() => ({ 
        state, dispatch, impersonateOrganization, getRedirectPath, startDemo, startApexDemo, exitDemo 
    }), [state, dispatch, impersonateOrganization, getRedirectPath, startDemo, startApexDemo, exitDemo]);

    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
    return context;
};

