
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import { auth, db } from 'lib/firebase';
import type { 
    User, Organization, PlatformSettings, Job, Customer, MembershipPlan, Project, Proposal, ServiceAgreement, Expense, EquipmentRental, Subcontractor, Applicant, BusinessDocument, Vehicle, Review, Message
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
    
    const unsubscribeData = useCallback(() => {
        dataSubscriptions.current.forEach(unsub => unsub());
        dataSubscriptions.current = [];
    }, []);

    const getRedirectPath = useCallback((user: User | null, isMasterAdmin: boolean): string => {
        if (!user) return '/login';

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
        console.log(`[Navigation-Context] User: ${user.email}, Role: ${user.role}, Org: ${user.organizationId} -> Path: ${path}`);
        return path;
    }, []);

    const startDemo = useCallback((role: 'admin' | 'employee' | 'customer' | 'sales') => {
        if (!sessionStorage.getItem('preDemoPath')) {
            sessionStorage.setItem('preDemoPath', window.location.pathname + window.location.search + window.location.hash);
        }
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

        const jobs = JSON.parse(JSON.stringify(APEX_MOCK_JOBS));
        const jobIndex = jobs.findIndex((j: Job) => j.id === 'apex-job-2');
        if (jobIndex !== -1 && mockUser) {
            jobs[jobIndex].appointmentTime = new Date().toISOString();
            jobs[jobIndex].assignedTechnicianId = mockUser.id;
            jobs[jobIndex].assignedTechnicianName = `${mockUser.firstName} ${mockUser.lastName}`;
        }

        dispatch({
            type: 'START_DEMO',
            payload: {
                currentUser: mockUser,
                currentOrganization: APEX_MOCK_ORG,
                users: APEX_MOCK_USERS as User[],
                jobs: jobs as Job[],
                customers: APEX_MOCK_CUSTOMERS as Customer[],
                membershipPlans: APEX_MOCK_PLANS as MembershipPlan[],
                projects: APEX_MOCK_PROJECTS as Project[],
                proposals: APEX_MOCK_PROPOSALS as Proposal[],
                serviceAgreements: APEX_MOCK_AGREEMENTS as ServiceAgreement[],
                applicants: MOCK_DEMO_APPLICANTS as Applicant[],
                documents: MOCK_DEMO_DOCUMENTS as BusinessDocument[],
                vehicles: MOCK_DEMO_VEHICLES as Vehicle[],
                reviews: MOCK_DEMO_REVIEWS as Review[],
                subcontractors: MOCK_DEMO_SUBCONTRACTORS as Subcontractor[],
                expenses: MOCK_DEMO_EXPENSES as Expense[],
                rentals: MOCK_DEMO_RENTALS as EquipmentRental[],
            }
        });
    }, [unsubscribeData]);

    const startApexDemo = useCallback((role: 'admin' | 'employee') => {
        startDemo(role);
    }, [startDemo]);

    const exitDemo = useCallback(() => {
        const isSales = state.currentUser?.role === 'platform_sales';
        const preDemoPath = sessionStorage.getItem('preDemoPath');

        sessionStorage.removeItem('preDemoPath');

        const currentPath = window.location.pathname + window.location.search + window.location.hash;

        if (preDemoPath) {
            if (preDemoPath === currentPath) {
                window.location.reload();
            } else {
                window.location.href = preDemoPath;
            }
        } else if (isSales) {
            window.location.href = '/sales/dashboard';
        } else {
            window.location.href = '/pro';
        }
    }, [state.currentUser?.role]);

    useEffect(() => {
        if (state.isDemoMode) {
            return;
        }

        // Failsafe timeout: If Firebase auth completely hangs and never fires onAuthStateChanged
        // (common on fresh Android installs due to IndexedDB init), force loading to false so the user isn't stuck.
        const fallbackTimer = setTimeout(() => {
            if (state.loading) {
                console.warn("[AppFailsafe] Firebase onAuthStateChanged timed out. Forcing UI to load.");
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        }, 3500);

        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            clearTimeout(fallbackTimer);
            unsubscribeData();
            if (user) {
                dispatch({ type: 'SET_LOADING', payload: true });
                try {
                    // Profile Fetch with Timeout
                    const fetchProfile = async () => {
                        let userDoc = await db.collection('users').doc(user.uid).get();
                        
                        if (!userDoc.exists) {
                            if (user.email === 'rodzelem@gmail.com') {
                                console.warn("Master UID profile missing! Cloning auth data to correct UID endpoint for Security Rules...");
                                // This physically maps the SuperAdmin identity exactly to the UID so Security Rules `isMaster()` evaluates structurally true
                                await db.collection('users').doc(user.uid).set({
                                    id: user.uid, uid: user.uid, email: 'rodzelem@gmail.com',
                                    role: 'master_admin', status: 'active',
                                    firstName: 'Master', lastName: 'Admin', organizationId: 'platform'
                                });
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
                            if (user.email === 'rodzelem@gmail.com' && userData.role !== 'master_admin') {
                                console.warn("Degraded admin profile detected! Forcing Master Elevation...");
                                await db.collection('users').doc(user.uid).set({
                                    ...userData,
                                    role: 'master_admin',
                                    organizationId: 'platform'
                                }, { merge: true });
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

                            dispatch({ type: 'LOGIN_SUCCESS', payload: { user: userData, organization: orgData, isMasterAdmin } });
                        } else {
                            // User exists in Auth but not in Firestore - likely a brand new registration
                            // We don't log out yet, wait for Login.tsx to handle the redirect part
                            dispatch({ type: 'SET_LOADING', payload: false });
                        }
                    };

                    // Race between fetch and 12s timeout
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12000));
                    try {
                        await Promise.race([fetchProfile(), timeoutPromise]);
                    } catch (raceErr) {
                        console.error("Auth initialization timed out or failed:", raceErr);
                        dispatch({ type: 'SET_LOADING', payload: false });
                        // If it's a real account (not just registered), log out to clear the hang
                        if (new Date().getTime() - new Date(user.metadata.creationTime || 0).getTime() > 30000) {
                             dispatch({ type: 'LOGOUT' });
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    dispatch({ type: 'SET_LOADING', payload: false });
                    dispatch({ type: 'LOGOUT' });
                }
            } else {
                dispatch({ type: 'SET_LOADING', payload: false });
                dispatch({ type: 'LOGOUT' });
            }
        });
        return () => unsubscribeAuth();
    }, [unsubscribeData, state.isDemoMode, dispatch]);

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

        newSubscriptions.push(db.collection('platformSettings').onSnapshot(s => {
            if (!s.empty) dispatch({ type: 'SET_PLATFORM_SETTINGS', payload: {id: s.docs[0].id, ...s.docs[0].data()} as PlatformSettings });
        }));

        if (isMasterAdmin) {
            newSubscriptions.push(db.collection('franchises').onSnapshot(s => dispatch({ type: 'SET_FRANCHISES', payload: s.docs.map(d => ({ id: d.id, ...d.data() })) })));
        }

        const isFranchiseAdmin = currentUser.role === 'franchise_admin';

        // Fetch all organizations for any admin-type user to see linked partner details.
        if (isMasterAdmin) {
            newSubscriptions.push(db.collection('organizations').onSnapshot(s => dispatch({ type: 'SET_ALL_ORGANIZATIONS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as Organization)) })));
        } else if (!isCustomer) {
            if (currentUser.franchiseId) {
                newSubscriptions.push(db.collection('organizations').where('franchiseId', '==', currentUser.franchiseId).onSnapshot(s => dispatch({ type: 'SET_ALL_ORGANIZATIONS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as Organization)) })));
            } else {
                // If the user belongs to the core tektrakker instance, filter out remote franchise orgs
                newSubscriptions.push(db.collection('organizations').onSnapshot(s => {
                    const allOrgs = s.docs.map(d => ({ id: d.id, ...d.data() } as Organization));
                    dispatch({ type: 'SET_ALL_ORGANIZATIONS', payload: allOrgs.filter(o => !o.franchiseId || o.franchiseId === 'tektrakker_core') });
                }));
            }
        }

        if (isMasterAdmin) {
            // Master admins get all users
            newSubscriptions.push(db.collection('users').onSnapshot(s => dispatch({ type: 'SET_USERS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as User)) })));
        } else if (isFranchiseAdmin && currentUser.franchiseId) {
            // Franchise admins get all users within their franchise silhouette
            newSubscriptions.push(db.collection('users').where('franchiseId', '==', currentUser.franchiseId).onSnapshot(s => dispatch({ type: 'SET_USERS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as User)) })));
        } else if (!isCustomer) {
            // Other org members get users from their own org
            const targetOrgId = isSales 
                ? (currentOrganization?.id || currentUser.organizationId)
                : currentUser.organizationId;
            if (targetOrgId) {
                newSubscriptions.push(db.collection('users').where('organizationId', '==', targetOrgId).onSnapshot(s => dispatch({ type: 'SET_USERS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as User)) })));
            }
        }

        const orgIdForCollections = (currentOrganization?.id && currentOrganization.id !== 'platform')
            ? currentOrganization.id
            : (currentUser.organizationId && currentUser.organizationId !== 'platform' && currentUser.organizationId !== 'unaffiliated' ? currentUser.organizationId : undefined);

        // Platform-Level Admins & Sales Representatives must securely pipe cross-tenant messages dynamically
        if (currentOrganization?.id === 'platform' && currentUser.id && (isMasterAdmin || isSales)) {
            const maskedIdentity = currentUser.role === 'master_admin' ? 'rodzelem@gmail.com' : undefined;
            const receiverIds = Array.from(new Set([currentUser.id, currentUser.email, maskedIdentity, 'all', 'all_sales', 'all_admins'].filter(Boolean)));
            newSubscriptions.push(db.collection('messages').where('receiverId', 'in', receiverIds)
                .onSnapshot(s => dispatch({ type: 'MERGE_MESSAGES', payload: s.docs.map(d => ({ ...d.data(), id: d.id })) as Message[] }), e => console.warn(e)));
                
            const senderIds = Array.from(new Set([currentUser.id, currentUser.email, maskedIdentity, 'all'].filter(Boolean)));
            newSubscriptions.push(db.collection('messages').where('senderId', 'in', senderIds)
                .onSnapshot(s => dispatch({ type: 'MERGE_MESSAGES', payload: s.docs.map(d => ({ ...d.data(), id: d.id })) as Message[] }), e => console.warn(e)));
        }
        
        if (orgIdForCollections || isCustomer) {
            const collections: Record<string, string> = {
                'notifications': 'SET_NOTIFICATIONS', 'messages': 'SET_MESSAGES', 'customers': 'SET_CUSTOMERS', 'proposals': 'SET_PROPOSALS', 'jobs': 'SET_JOBS', 
                'inventory': 'SET_INVENTORY', 'refrigerantCylinders': 'SET_CYLINDERS', 'refrigerantTransactions': 'SET_REF_TRANSACTIONS', 'toolMaintenanceLogs': 'SET_TOOL_LOGS',
                'incidentReports': 'SET_INCIDENTS', 'proposalPresets': 'SET_PROPOSAL_PRESETS', 'projects': 'SET_PROJECTS', 'documents': 'SET_DOCUMENTS', 'reviews': 'SET_REVIEWS',
                'workSchedules': 'SET_SCHEDULES', 'membershipPlans': 'SET_MEMBERSHIP_PLANS', 'serviceAgreements': 'SET_AGREEMENTS', 'partOrders': 'SET_PART_ORDERS',
                'shopOrders': 'SET_SHOP_ORDERS', 'marketingCampaigns': 'SET_CAMPAIGNS', 'appointments': 'SET_APPOINTMENTS', 'bids': 'SET_BIDS', 'expenses': 'SET_EXPENSES',
                'inspectionTemplates': 'SET_INSPECTION_TEMPLATES', 'vehicles': 'SET_VEHICLES', 'applicants': 'SET_APPLICANTS',
                'subcontractors': 'SET_SUBCONTRACTORS', 'vehicleLogs': 'SET_VEHICLE_LOGS', 'teams': 'SET_TEAMS'
            };

            const internalOnly = [
                'inventory', 'refrigerantCylinders', 'refrigerantTransactions', 'toolMaintenanceLogs',
                'incidentReports', 'proposalPresets', 'projects', 'workSchedules', 'partOrders',
                'shopOrders', 'marketingCampaigns', 'bids', 'expenses', 'inspectionTemplates', 'vehicles', 'applicants',
                'users', 'subcontractors', 'vehicleLogs', 'shiftLogs', 'teams'
            ];

            const customerPersonalData = ['jobs', 'proposals', 'appointments', 'serviceAgreements', 'messages', 'notifications', 'customers', 'documents', 'reviews'];

            Object.entries(collections).forEach(([collection, actionType]) => {
                if (isCustomer && internalOnly.includes(collection)) return;

                let query;
                
                if (isCustomer && customerPersonalData.includes(collection)) {
                    // Statically valid queries for Firestore security rules (exact == match)
                    query = db.collection(collection).where('customerEmail', '==', currentUser.email);
                    
                    if (collection === 'customers') {
                        query = db.collection(collection).where('email', '==', currentUser.email);
                    }
                } else if (orgIdForCollections) {
                    query = db.collection(collection).where('organizationId', '==', orgIdForCollections);
                    
                    if (['messages', 'notifications'].includes(collection)) {
                        query = query.orderBy('createdAt', 'desc').limit(100);
                    }
                } else {
                    return;
                }
                
                newSubscriptions.push(query.onSnapshot(s => {
                    const payload = s.docs.map(d => ({ ...d.data(), id: d.id }));
                    dispatch({ type: actionType, payload } as unknown as Action);
                }, (error) => {
                    console.error(`Subscription failed for ${collection}:`, error);
                }));

                // Fallback by name is disabled for customers because it violates Firestore security rules (isCustomerOwner does not allow reading by customerName)
            });

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
        state.isMasterAdmin, 
        state.currentOrganization?.id, 
        state.isDemoMode, 
        unsubscribeData,
        dispatch
    ]);

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

