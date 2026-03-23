
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import { auth, db } from 'lib/firebase';
import type { 
    User, Organization, PlatformSettings, Job, Customer, MembershipPlan, Project, Proposal, ServiceAgreement, Expense, EquipmentRental, Subcontractor, Applicant, BusinessDocument, Vehicle, Review
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
import { useNavigate } from 'react-router-dom';

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
    const navigate = useNavigate();
    
    const unsubscribeData = useCallback(() => {
        dataSubscriptions.current.forEach(unsub => unsub());
        dataSubscriptions.current = [];
    }, []);

    const getRedirectPath = useCallback((user: User | null, isMasterAdmin: boolean): string => {
        if (!user) return '/login';
        if (isMasterAdmin) return '/master/dashboard';
        if (user.role === 'platform_sales') return '/sales/dashboard';
        if (user.role === 'admin' || user.role === 'both' || user.role === 'supervisor') return '/admin/dashboard';
        if (user.role === 'customer') return '/portal';
        if (user.role === 'employee') return '/briefing';
        return '/briefing';
    }, []);

    const startDemo = useCallback((role: 'admin' | 'employee' | 'customer' | 'sales') => {
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
        dispatch({ type: 'EXIT_DEMO' });

        if (isSales) {
            navigate('/sales/dashboard');
        } else {
            navigate('/pro');
        }
        
        setTimeout(() => {
            window.location.reload();
        }, 100);
    }, [navigate, state.currentUser?.role]);

    useEffect(() => {
        if (state.isDemoMode) {
            return;
        }

        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            unsubscribeData();
            if (user) {
                dispatch({ type: 'SET_LOADING', payload: true });
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const userData = { id: user.uid, ...userDoc.data() } as User;
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
                        // User exists in Auth but not in Firestore
                        dispatch({ type: 'SET_LOADING', payload: false });
                        dispatch({ type: 'LOGOUT' });
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

        // Fetch all organizations for any admin-type user to see linked partner details.
        if (isMasterAdmin || !isCustomer) {
            newSubscriptions.push(db.collection('organizations').onSnapshot(s => dispatch({ type: 'SET_ALL_ORGANIZATIONS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as Organization)) })));
        }

        if (isMasterAdmin) {
            // Master admins get all users
            newSubscriptions.push(db.collection('users').onSnapshot(s => dispatch({ type: 'SET_USERS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as User)) })));
        } else if (!isCustomer) {
            // Other org members get users from their own org
            const targetOrgId = isSales 
                ? (currentOrganization?.id && currentOrganization.id !== 'platform' ? currentOrganization.id : undefined)
                : currentUser.organizationId;
            if (targetOrgId) {
                newSubscriptions.push(db.collection('users').where('organizationId', '==', targetOrgId).onSnapshot(s => dispatch({ type: 'SET_USERS', payload: s.docs.map(d => ({ id: d.id, ...d.data() } as User)) })));
            }
        }

        const orgIdForCollections = currentOrganization?.id && currentOrganization.id !== 'platform' 
            ? currentOrganization.id 
            : undefined;
        
        if (orgIdForCollections || isCustomer) {
            const collections: Record<string, string> = {
                'notifications': 'SET_NOTIFICATIONS', 'messages': 'SET_MESSAGES', 'customers': 'SET_CUSTOMERS', 'proposals': 'SET_PROPOSALS', 'jobs': 'SET_JOBS', 
                'inventory': 'SET_INVENTORY', 'refrigerantCylinders': 'SET_CYLINDERS', 'refrigerantTransactions': 'SET_REF_TRANSACTIONS', 'toolMaintenanceLogs': 'SET_TOOL_LOGS',
                'incidentReports': 'SET_INCIDENTS', 'proposalPresets': 'SET_PROPOSAL_PRESETS', 'projects': 'SET_PROJECTS', 'documents': 'SET_DOCUMENTS', 'reviews': 'SET_REVIEWS',
                'workSchedules': 'SET_SCHEDULES', 'membershipPlans': 'SET_MEMBERSHIP_PLANS', 'serviceAgreements': 'SET_AGREEMENTS', 'partOrders': 'SET_PART_ORDERS',
                'shopOrders': 'SET_SHOP_ORDERS', 'marketingCampaigns': 'SET_CAMPAIGNS', 'appointments': 'SET_APPOINTMENTS', 'bids': 'SET_BIDS', 'expenses': 'SET_EXPENSES',
                'inspectionTemplates': 'SET_INSPECTION_TEMPLATES', 'vehicles': 'SET_VEHICLES', 'applicants': 'SET_APPLICANTS',
                'subcontractors': 'SET_SUBCONTRACTORS'
            };

            const internalOnly = [
                'inventory', 'refrigerantCylinders', 'refrigerantTransactions', 'toolMaintenanceLogs',
                'incidentReports', 'proposalPresets', 'projects', 'workSchedules', 'partOrders',
                'shopOrders', 'marketingCampaigns', 'bids', 'expenses', 'inspectionTemplates', 'vehicles', 'applicants',
                'users', 'subcontractors'
            ];

            const customerPersonalData = ['jobs', 'proposals', 'appointments', 'serviceAgreements', 'messages', 'notifications', 'customers', 'documents', 'reviews'];

            Object.entries(collections).forEach(([collection, actionType]) => {
                if (isCustomer && internalOnly.includes(collection)) return;

                let query;
                
                if (isCustomer && customerPersonalData.includes(collection)) {
                    const emails = [currentUser.email];
                    if (currentUser.email?.toLowerCase() !== currentUser.email) {
                        emails.push(currentUser.email?.toLowerCase());
                    }
                    
                    query = db.collection(collection).where('customerEmail', 'in', emails);
                    
                    if (collection === 'customers') {
                        query = db.collection(collection).where('email', 'in', emails);
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
                    
                    if (['jobs', 'proposals'].includes(collection)) {
                        const mergeType = collection === 'jobs' ? 'MERGE_JOBS' : 'MERGE_PROPOSALS';
                        dispatch({ type: mergeType as any, payload });
                    } else {
                        dispatch({ type: actionType as any, payload });
                    }
                }, (error) => {
                    console.error(`Subscription failed for ${collection}:`, error);
                }));

                // Fallback: Also subscribe by name for jobs and proposals (legacy data)
                if (isCustomer && ['jobs', 'proposals'].includes(collection)) {
                    const fullName = (state.currentUser?.firstName + " " + state.currentUser?.lastName).trim();
                    if (fullName && fullName.length > 3) { // Avoid subscribing to empty names
                        const nameQuery = db.collection(collection).where('customerName', '==', fullName);
                        const mergeType = collection === 'jobs' ? 'MERGE_JOBS' : 'MERGE_PROPOSALS';
                        
                        newSubscriptions.push(nameQuery.onSnapshot(s => {
                            const payload = s.docs.map(d => ({ ...d.data(), id: d.id }));
                            dispatch({ type: mergeType as any, payload });
                        }, console.error));
                    }
                }
            });

            // NEW: Fetch external jobs assigned to this organization
            if (orgIdForCollections) {
                newSubscriptions.push(db.collection('jobs')
                    .where('assignedPartnerId', '==', orgIdForCollections)
                    .onSnapshot(s => {
                        const payload = s.docs.map(d => ({ ...d.data(), id: d.id } as Job));
                        dispatch({ type: 'SET_EXTERNAL_JOBS', payload });
                    }, error => console.error("External jobs subscription failed:", error))
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
