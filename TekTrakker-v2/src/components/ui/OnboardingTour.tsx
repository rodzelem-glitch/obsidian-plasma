import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, SkipForward } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface TourStep {
    title: string;
    description: string;
    targetSelector?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    mobileTargetSelector?: string;
    mobilePosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    icon?: string;
    expectedPath?: string;
}

interface OnboardingTourProps {
    isPaymentsOnly?: boolean;
    isTechView?: boolean;
    userId: string;
    onComplete: () => void;
}

const FULL_PLAN_STEPS: TourStep[] = [
    {
        title: 'Welcome to TekTrakker! 🎉',
        description: 'Let\'s take a quick tour of your new operations hub. This will only take a minute — and you can skip at any time.',
        position: 'center',
        icon: '👋',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Your Dashboard',
        description: 'This is your command center. See active jobs, team status, pending orders, and financial metrics at a glance.',
        targetSelector: '[data-tour="dashboard-metrics"]',
        position: 'bottom',
        icon: '📊',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Navigation Sidebar',
        description: 'Use the left sidebar to access all platform modules — CRM, Scheduling, Financials, HR, and more. You can customize the order and hide sections you don\'t use.',
        targetSelector: '[data-tour="sidebar"]',
        position: 'right',
        icon: '🧭',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Customer Management',
        description: 'Add your customers, track service history, manage equipment, and build lasting relationships — all from the Customers section.',
        targetSelector: '[data-tour="nav-customers"]',
        position: 'right',
        icon: '👥',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Scheduling & Dispatch',
        description: 'Schedule jobs, dispatch technicians, and track field operations in real time from the Operations hub.',
        targetSelector: '[data-tour="nav-operations"]',
        position: 'right',
        icon: '📅',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Financials',
        description: 'Create invoices, track expenses, manage proposals, and monitor your cash flow from the Financials section.',
        targetSelector: '[data-tour="nav-financials"]',
        position: 'right',
        icon: '💰',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'HR & Payroll',
        description: 'Manage employee records, handbooks, safety incidents, and generate payroll reports seamlessly.',
        targetSelector: '[data-tour="nav-hr"]',
        position: 'right',
        icon: '💼',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Records & Assets',
        description: 'Keep track of physical inventory, tool assignments, and vehicle records.',
        targetSelector: '[data-tour="nav-records"]',
        position: 'right',
        icon: '📦',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Sales & Marketing Hub',
        description: 'Launch email campaigns, send SMS blasts, and manage your online reputation from one centralized hub.',
        targetSelector: '[data-tour="nav-marketing-hub"]',
        position: 'right',
        icon: '📣',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'AI Worker & Reports',
        description: 'Leverage your Virtual AI Worker for automated follow-ups, and review advanced generated reports.',
        targetSelector: '[data-tour="nav-ai-reports"]',
        position: 'right',
        icon: '🤖',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Settings & Integrations',
        description: 'Set up payment processing, connect third-party apps, configure your tax rates, and customize your branding in Settings.',
        targetSelector: '[data-tour="nav-settings"]',
        position: 'right',
        icon: '⚙️',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'You\'re All Set! 🚀',
        description: 'Explore at your own pace. If you ever need help, check the Settings page or reach out to our support team. Welcome aboard!',
        position: 'center',
        icon: '✅',
        expectedPath: '/admin/dashboard'
    }
];

const PAYMENTS_ONLY_STEPS: TourStep[] = [
    {
        title: 'Welcome to TekTrakker Payments! 🎉',
        description: 'Let\'s get you set up to start accepting payments. This quick tour will show you everything you need.',
        position: 'center',
        icon: '👋',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Your Dashboard',
        description: 'Your dashboard shows unpaid invoices, active jobs, and financial metrics at a glance.',
        targetSelector: '[data-tour="dashboard-metrics"]',
        position: 'bottom',
        icon: '📊',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Step 1: Set Up Payments',
        description: 'Before you can accept payments, complete the merchant onboarding. Click the green banner on your dashboard or go to Settings → Integrations.',
        targetSelector: '[data-tour="payment-setup-banner"]',
        position: 'bottom',
        icon: '💳',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Create Proposals',
        description: 'Build detailed proposals with line items, send them to clients, and convert accepted proposals into invoices.',
        targetSelector: '[data-tour="nav-estimator"]',
        position: 'right',
        icon: '📝',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'Send Invoices & Get Paid',
        description: 'Create invoices, send them to customers, and collect payments via credit card, debit, or ACH bank transfer.',
        targetSelector: '[data-tour="nav-financials"]',
        position: 'right',
        icon: '💰',
        expectedPath: '/admin/dashboard'
    },
    {
        title: 'You\'re Ready! 🚀',
        description: 'Complete your payment setup from the dashboard, then start sending your first invoice. Welcome aboard!',
        position: 'center',
        icon: '✅',
        expectedPath: '/admin/dashboard'
    }
];

const TECH_VIEW_STEPS: TourStep[] = [
    {
        title: 'Welcome to Tech View! 🔧',
        description: 'This is your dedicated field app. Let\'s quickly review the tools you need to crush it today.',
        position: 'center',
        icon: '👋',
        expectedPath: '/briefing'
    },
    {
        title: 'Daily Briefing',
        description: 'Start here. See your assigned jobs, HR updates, weather forecasts, and routing information for the day.',
        targetSelector: '[data-tour="nav-briefing"]',
        position: 'top',
        icon: '📱',
        expectedPath: '/briefing'
    },
    {
        title: 'Time & GPS Tracking',
        description: 'Clock in, track your drive time, and log breaks. The app uses GPS to verify on-site arrivals automatically.',
        targetSelector: '[data-tour="nav-timelog"]',
        position: 'top',
        icon: '⏱️',
        expectedPath: '/briefing'
    },
    {
        title: 'Field Tools',
        description: 'Access diagnostic calculators, manuals, and technical references right when you need them.',
        targetSelector: '[data-tour="nav-tools"]',
        position: 'top',
        icon: '🛠️',
        expectedPath: '/briefing'
    },
    {
        title: 'You\'re Ready to Roll! 🚀',
        description: 'Stay safe out there, and let the office know if you need any support via the Chat tab!',
        position: 'center',
        icon: '✅',
        expectedPath: '/briefing'
    }
];

// Interactive tutorials for specific training hub tasks
const CUSTOM_TOURS: Record<string, TourStep[] | { admin: TourStep[], tech: TourStep[] }> = {
    'dispatch-job': [
        {
            title: 'Operations Dashboard 📅',
            description: 'Let\'s create and dispatch a new job. First, click on "Operations" in the sidebar menu (or bottom menu on mobile).',
            targetSelector: '[data-tour="nav-operations"]',
            position: 'right',
            icon: '📅',
            expectedPath: '/admin/operations'
        },
        {
            title: 'Book a New Job 📝',
            description: 'Now, click the "+ Book" button in the top right to open the job details creator.',
            targetSelector: '[data-tour="book-job-btn"]',
            position: 'bottom',
            icon: '📝',
            expectedPath: '/admin/operations'
        },
        {
            title: 'Dispatch the Technician! 🚀',
            description: 'Select your customer, choose a technician, add job notes, and click "Dispatch!" to notify them in the field.',
            targetSelector: '[data-tour="dispatch-submit-btn"]',
            position: 'left',
            icon: '🚀',
            expectedPath: '/admin/operations'
        }
    ],
    'tech-clocking-in': [
        {
            title: 'Open Time Log ⏱️',
            description: 'Now, click on the "Time" tab in the bottom mobile nav bar (or timesheets section) to open time log.',
            targetSelector: '[data-tour="nav-timelog"]',
            position: 'top',
            icon: '⏱️',
            expectedPath: '/briefing/timelog'
        },
        {
            title: 'Clock In!',
            description: 'Tap the green "Clock In" button to begin your shift and activate geofenced tracking.',
            targetSelector: '[data-tour="clock-in-btn"]',
            position: 'top',
            icon: '🟢',
            expectedPath: '/briefing/timelog'
        }
    ],
    'build-proposal': {
        admin: [
            {
                title: 'Open Proposal Builder 📝',
                description: 'Let\'s create a tiered Good/Better/Best proposal. First, select a customer to link to this proposal.',
                targetSelector: '[data-tour="proposal-customer-select"]',
                position: 'bottom',
                icon: '👥',
                expectedPath: '/admin/proposal'
            },
            {
                title: 'Start Building ➕',
                description: 'Click "Start Building" to open the tiered options designer.',
                targetSelector: '[data-tour="proposal-start-building-btn"]',
                position: 'bottom',
                icon: '➕',
                expectedPath: '/admin/proposal'
            },
            {
                title: 'Add Items manually 🛠️',
                description: 'Click "Manual Entry" (or use AI Generator) to add parts and labor to your proposal.',
                targetSelector: '[data-tour="proposal-manual-btn"]',
                position: 'bottom',
                icon: '🛠️',
                expectedPath: '/admin/proposal'
            },
            {
                title: 'Review & Present 📊',
                description: 'Click "Review & Present" to view the Good/Better/Best tiers comparison page.',
                targetSelector: '[data-tour="proposal-next-step-btn"]',
                position: 'bottom',
                icon: '📊',
                expectedPath: '/admin/proposal'
            },
            {
                title: 'Customer Signature ✍️',
                description: 'Have the customer select their preferred tier option and sign in the capture pad.',
                targetSelector: '[data-tour="proposal-sig-pad"]',
                position: 'top',
                icon: '✍️',
                expectedPath: '/admin/proposal'
            },
            {
                title: 'Accept & Sign 💾',
                description: 'Click the "Sign & Accept" button to finalize the proposal and convert it to a paid invoice.',
                targetSelector: '[data-tour="proposal-submit-btn"]',
                position: 'top',
                icon: '💾',
                expectedPath: '/admin/proposal'
            }
        ],
        tech: [
            {
                title: 'Open Estimator Tab 📝',
                description: 'Tap the "Estimator" tab in your bottom navigation bar to build a field proposal.',
                targetSelector: '[data-tour="nav-proposal"]',
                position: 'top',
                icon: '📝',
                expectedPath: '/briefing/proposal'
            },
            {
                title: 'Select Customer 👥',
                description: 'Choose a customer from the dropdown selector to link to this estimate proposal.',
                targetSelector: '[data-tour="proposal-customer-select"]',
                position: 'bottom',
                icon: '👥',
                expectedPath: '/briefing/proposal'
            },
            {
                title: 'Start Building ➕',
                description: 'Click "Start Building" to open the Goods / Better / Best tiered options designer.',
                targetSelector: '[data-tour="proposal-start-building-btn"]',
                position: 'bottom',
                icon: '➕',
                expectedPath: '/briefing/proposal'
            },
            {
                title: 'Add Items manually 🛠️',
                description: 'Tap "Manual Entry" (or use AI Generator) to add parts and labor to your proposal.',
                targetSelector: '[data-tour="proposal-manual-btn"]',
                position: 'bottom',
                icon: '🛠️',
                expectedPath: '/briefing/proposal'
            },
            {
                title: 'Review & Present 📊',
                description: 'Once you added your items, click "Review & Present" to view the Good/Better/Best tiers comparison.',
                targetSelector: '[data-tour="proposal-next-step-btn"]',
                position: 'bottom',
                icon: '📊',
                expectedPath: '/briefing/proposal'
            },
            {
                title: 'Customer Signature ✍️',
                description: 'Present the device to your customer so they can select their tier option and sign in the box.',
                targetSelector: '[data-tour="proposal-sig-pad"]',
                position: 'top',
                icon: '✍️',
                expectedPath: '/briefing/proposal'
            },
            {
                title: 'Accept & Sign 💾',
                description: 'Click the "Sign & Accept" button to finalize the proposal and convert it to a paid invoice.',
                targetSelector: '[data-tour="proposal-submit-btn"]',
                position: 'top',
                icon: '💾',
                expectedPath: '/briefing/proposal'
            }
        ]
    },
    'org-setup': [
        {
            title: 'Organization Settings ⚙️',
            description: 'Click "Settings" at the bottom of the sidebar to access customization options.',
            targetSelector: '[data-tour="nav-settings"]',
            position: 'right',
            icon: '⚙️',
            expectedPath: '/admin/settings'
        },
        {
            title: 'Configure Branding 🎨',
            description: 'Upload your company logo and adjust primary colors to white-label invoices and technician layouts.',
            targetSelector: '[data-tour="settings-branding-section"]',
            position: 'bottom',
            icon: '🎨',
            expectedPath: '/admin/settings'
        }
    ],
    'crm-guide': [
        {
            title: 'Customer Directory 👥',
            description: 'First, click on "Customer Center" in the sidebar to open the CRM dashboard.',
            targetSelector: '[data-tour="nav-customers"]',
            position: 'right',
            icon: '👥',
            expectedPath: '/admin/customers'
        },
        {
            title: 'Add New Customer ➕',
            description: 'Click "+ Quick Add" in the top header to reveal the quick customer profile form.',
            targetSelector: '[data-tour="quick-add-customer-btn"]',
            position: 'bottom',
            icon: '➕',
            expectedPath: '/admin/customers'
        },
        {
            title: 'Save Customer Profile 💾',
            description: 'Fill in the customer name, contact details, and click "Add Customer" to save their CRM vault entry.',
            targetSelector: '[data-tour="save-customer-btn"]',
            position: 'top',
            icon: '💾',
            expectedPath: '/admin/customers'
        }
    ],
    'invoicing-guide': [
        {
            title: 'Financial Center 💰',
            description: 'Click "Financials" in the sidebar to open invoice summaries and accounts receivable.',
            targetSelector: '[data-tour="nav-financials"]',
            position: 'right',
            icon: '💰',
            expectedPath: '/admin/financials'
        },
        {
            title: 'Invoice Ledger 📊',
            description: 'Review pending invoices, Stripe processing statuses, and aging balances.',
            targetSelector: '[data-tour="financials-invoices-tab"]',
            position: 'bottom',
            icon: '📊',
            expectedPath: '/admin/financials'
        }
    ],
    'messaging-guide': {
        admin: [
            {
                title: 'Briefing Chat Hub 💬',
                description: 'Click "Messages" in the sidebar to enter the team chat hub.',
                targetSelector: '[data-tour="nav-messages"]',
                position: 'right',
                icon: '💬',
                expectedPath: '/admin/messages'
            },
            {
                title: 'Active Threads 👥',
                description: 'Select any technician or customer channel to read past text logs and dispatch updates.',
                targetSelector: '[data-tour="chat-threads-list"]',
                position: 'bottom',
                icon: '👥',
                expectedPath: '/admin/messages'
            }
        ],
        tech: [
            {
                title: 'Open Chat Tab 💬',
                description: 'Tap the "Chat" tab in your bottom navigation bar to communicate with the back office.',
                targetSelector: '[data-tour="nav-messages"]',
                position: 'top',
                icon: '💬',
                expectedPath: '/briefing/messages'
            },
            {
                title: 'Active Threads 👥',
                description: 'Select any active thread to check messages and chat in real-time.',
                targetSelector: '[data-tour="chat-threads-list"]',
                position: 'top',
                icon: '👥',
                expectedPath: '/briefing/messages'
            }
        ]
    },
    'analytics-guide': [
        {
            title: 'Go to Dashboard 📈',
            description: 'Click on "Dashboard" in the sidebar to review active widgets.',
            targetSelector: '[data-tour="nav-dashboard"]',
            position: 'right',
            icon: '📈',
            expectedPath: '/admin/dashboard'
        },
        {
            title: 'Analyze Metrics Grid 📊',
            description: 'Check active jobs, team online statuses, monthly recurring revenue, and unpaid invoices at a glance.',
            targetSelector: '[data-tour="dashboard-metrics"]',
            position: 'bottom',
            icon: '📊',
            expectedPath: '/admin/dashboard'
        }
    ],
    'tech-workflow': [
        {
            title: 'Briefing Dashboard 📋',
            description: 'Click the "Briefing" tab to inspect your assigned route and weather announcements.',
            targetSelector: '[data-tour="nav-briefing"]',
            position: 'top',
            icon: '📋',
            expectedPath: '/briefing'
        },
        {
            title: 'Open Assigned Job 🛠️',
            description: 'Select any active job card under "My Route" to open the interactive field workflow modal.',
            targetSelector: '[data-tour="tech-route-jobs"]',
            position: 'top',
            icon: '🛠️',
            expectedPath: '/briefing'
        },
        {
            title: 'Navigate Workflow 📍',
            description: 'Follow step-by-step diagnostic forms, refrigerant records, and photo uploads. Click "Next" to advance.',
            targetSelector: '[data-tour="tech-workflow-next-btn"]',
            position: 'top',
            icon: '📍'
        },
        {
            title: 'Complete and Close 💾',
            description: 'Once all items are completed, sign off and tap "Complete Job" to clock out of this job site.',
            targetSelector: '[data-tour="tech-workflow-complete-btn"]',
            position: 'top',
            icon: '💾'
        }
    ],
    'tech-tools': [
        {
            title: 'Open Tools Tab 🛠️',
            description: 'Tap the "Tools" tab in your bottom navigation bar.',
            targetSelector: '[data-tour="nav-tools"]',
            position: 'top',
            icon: '🛠️',
            expectedPath: '/briefing/tools'
        },
        {
            title: 'Select Sizing Calculators 🧮',
            description: 'Run diagnostic formulas and BTU/multimeter sizing tasks with these pre-built field modules.',
            targetSelector: '[data-tour="tech-calculators-list"]',
            position: 'top',
            icon: '🧮',
            expectedPath: '/briefing/tools'
        }
    ],
    'gov-bid-helper': [
        {
            title: 'Public Bid Optimization 🏢',
            description: 'Click "Bid Optimization" in the sidebar to search government contract opportunities.',
            targetSelector: '[data-tour="nav-contracts"]',
            position: 'right',
            icon: '🏢',
            expectedPath: '/admin/contracts'
        },
        {
            title: 'Search RFPs 🔍',
            description: 'Use the text filter input to crawl federal and state HVAC/plumbing project requests.',
            targetSelector: '[data-tour="contracts-search-input"]',
            position: 'bottom',
            icon: '🔍',
            expectedPath: '/admin/contracts'
        }
    ],
    'records-assets': [
        {
            title: 'Open Core Assets Vault 📦',
            description: 'Click "Records and assets" in the sidebar to review fleet inventory.',
            targetSelector: '[data-tour="nav-records"]',
            position: 'right',
            icon: '📦',
            expectedPath: '/admin/records'
        },
        {
            title: 'Manage EPA Logs & Fleet 🚛',
            description: 'Review EPA refrigerant logs, fleet vehicle logs, and custom organization document vaults.',
            targetSelector: '[data-tour="records-tabs-container"]',
            position: 'bottom',
            icon: '🚛',
            expectedPath: '/admin/records'
        }
    ]
};

const OnboardingTour: React.FC<OnboardingTourProps> = ({ isPaymentsOnly, isTechView, userId, onComplete }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Read active custom tour if exists
    const [activeTour, setActiveTour] = useState<string | null>(() => sessionStorage.getItem('active_interactive_tour'));
    const savedStep = sessionStorage.getItem('interactive_tour_step');
    const initialStep = savedStep ? parseInt(savedStep, 10) : 0;

    const [currentStep, setCurrentStep] = useState(initialStep);
    const [isVisible, setIsVisible] = useState(true);
    const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

    // Sync state if sessionStorage changes or component remounts
    useEffect(() => {
        const syncTourState = () => {
            const tour = sessionStorage.getItem('active_interactive_tour');
            const step = sessionStorage.getItem('interactive_tour_step');
            setActiveTour(tour);
            setCurrentStep(step ? parseInt(step, 10) : 0);
            if (tour) {
                setIsVisible(true);
            } else {
                const completed = localStorage.getItem(`onboarding_complete_${userId}`) === 'true';
                setIsVisible(!completed);
            }
        };
        window.addEventListener('tour-started', syncTourState);
        return () => window.removeEventListener('tour-started', syncTourState);
    }, [userId]);

    // Get steps array based on activeTour or fallback to standard onboarding tours
    const steps = useMemo((): TourStep[] => {
        let tourSteps: TourStep[] = [];
        if (activeTour && CUSTOM_TOURS[activeTour]) {
            const config = CUSTOM_TOURS[activeTour];
            if (Array.isArray(config)) {
                tourSteps = [...config];
            } else {
                const isTech = location.pathname.startsWith('/briefing') || isTechView;
                tourSteps = isTech ? [...config.tech] : [...config.admin];
            }
        } else {
            tourSteps = isTechView ? [...TECH_VIEW_STEPS] : (isPaymentsOnly ? [...PAYMENTS_ONLY_STEPS] : [...FULL_PLAN_STEPS]);
        }

        // AUTO-LAYOUT SWITCHER LOGIC
        // If in Tech View but first step requires Admin Layout, prepending "Switch to Admin"
        const onTechPage = location.pathname.startsWith('/briefing');
        const firstStepPath = tourSteps[0]?.expectedPath;
        if (onTechPage && firstStepPath && firstStepPath.startsWith('/admin')) {
            tourSteps.unshift({
                title: 'Switch to Admin View ⚙️',
                description: 'This is an administrative task. Let\'s switch to the Admin panel first by clicking "Admin" in the top bar.',
                targetSelector: '[data-tour="switch-admin-btn"]',
                position: 'bottom',
                icon: '⚙️',
                expectedPath: '/admin/dashboard'
            });
        }

        // If in Admin View but first step requires Tech Layout, prepending "Switch to Tech"
        const onAdminPage = location.pathname.startsWith('/admin');
        if (onAdminPage && firstStepPath && firstStepPath.startsWith('/briefing')) {
            tourSteps.unshift({
                title: 'Switch to Tech View 🔧',
                description: 'This task is performed in mobile Tech View. Click the "Switch to Tech View" button at the bottom of the sidebar to go there.',
                targetSelector: '[data-tour="switch-tech-btn"]',
                position: 'top',
                icon: '🔧',
                expectedPath: '/briefing'
            });
        }

        return tourSteps;
    }, [activeTour, isTechView, isPaymentsOnly, location.pathname]);

    // Self-correcting step resolver to handle closed sidebar on mobile viewports
    const activeStep = useMemo((): TourStep => {
        const baseStep = steps[currentStep] || steps[0] || { title: '', description: '' };
        const isMobile = window.innerWidth < 1024;
        
        let targetSelector = baseStep.targetSelector;
        let position = baseStep.position;
        let description = baseStep.description;

        // Redirect selector to hamburger/toggle menu button if sidebar link is targeted but sidebar is hidden
        if (isMobile && targetSelector && (targetSelector.startsWith('[data-tour="nav-') || targetSelector === '[data-tour="switch-tech-btn"]') && 
            !targetSelector.startsWith('[data-tour="nav-briefing') && 
            !targetSelector.startsWith('[data-tour="nav-timelog') && 
            !targetSelector.startsWith('[data-tour="nav-tools') && 
            !targetSelector.startsWith('[data-tour="nav-messages')) {
            
            const sidebarEl = document.querySelector('[data-tour="sidebar"]');
            const isSidebarVisible = sidebarEl && sidebarEl.getBoundingClientRect().width > 0;
            
            if (!isSidebarVisible) {
                targetSelector = '[data-tour="menu-toggle-btn"]';
                position = 'bottom';
                const cleanTitle = baseStep.title.replace(/[\d📅⏱️📝👥💰💬📈📋🛠️🏢📦🎉⚙️]/g, '').trim();
                description = `Tap the menu icon in the top left first, then select ${cleanTitle}!`;
            }
        }

        return {
            ...baseStep,
            targetSelector,
            position,
            description
        };
    }, [steps, currentStep]);

    // Auto-advance step if location.pathname changes and matches the next step's expected path,
    // but ONLY if the expected paths are different (i.e. cross-page navigation transition)
    useEffect(() => {
        const nextStepIndex = currentStep + 1;
        if (nextStepIndex < steps.length) {
            const currentStepObj = steps[currentStep];
            const nextStep = steps[nextStepIndex];
            if (
                nextStep.expectedPath &&
                location.pathname === nextStep.expectedPath &&
                currentStepObj?.expectedPath !== nextStep.expectedPath
            ) {
                setCurrentStep(nextStepIndex);
                sessionStorage.setItem('interactive_tour_step', String(nextStepIndex));
            }
        }
    }, [location.pathname, currentStep, steps]);

    const updateHighlight = useCallback(() => {
        if (activeStep.targetSelector && activeStep.position !== 'center') {
            const el = document.querySelector(activeStep.targetSelector);
            if (el) {
                const rect = el.getBoundingClientRect();
                setHighlightRect((prev) => {
                    if (prev &&
                        prev.top === rect.top &&
                        prev.left === rect.left &&
                        prev.width === rect.width &&
                        prev.height === rect.height) {
                        return prev;
                    }
                    return rect;
                });
                
                const isElInViewport = (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );
                if (!isElInViewport) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                return;
            }
        }
        setHighlightRect((prev) => prev === null ? null : null);
    }, [activeStep]);

    // Periodically update highlights on resize, scroll, and content changes (handles async DOM updates)
    useEffect(() => {
        updateHighlight();

        const handleLayoutChange = () => {
            updateHighlight();
        };

        window.addEventListener('resize', handleLayoutChange);
        window.addEventListener('scroll', handleLayoutChange, { capture: true });

        const interval = setInterval(updateHighlight, 300);

        return () => {
            window.removeEventListener('resize', handleLayoutChange);
            window.removeEventListener('scroll', handleLayoutChange, { capture: true });
            clearInterval(interval);
        };
    }, [currentStep, updateHighlight]);

    const handleSkip = useCallback(() => {
        if (userId && !activeTour) localStorage.setItem(`onboarding_complete_${userId}`, 'true');
        sessionStorage.removeItem('active_interactive_tour');
        sessionStorage.removeItem('interactive_tour_step');
        setIsVisible(false);
        onComplete();
        // Dispatch window event so layouts update
        window.dispatchEvent(new Event('tour-started'));
    }, [userId, onComplete, activeTour]);

    // Sync skip on mobile for standard onboarding
    useEffect(() => {
        const handleResizeSkip = () => {
            if (window.innerWidth < 1024 && !activeTour) {
                handleSkip();
            }
        };
        handleResizeSkip(); // Check immediately on mount!
        window.addEventListener('resize', handleResizeSkip);
        return () => window.removeEventListener('resize', handleResizeSkip);
    }, [activeTour, handleSkip]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            const nextIdx = currentStep + 1;
            const nextStep = steps[nextIdx];
            
            // Auto navigate if step defines a path and we aren't there
            if (nextStep.expectedPath && location.pathname !== nextStep.expectedPath) {
                navigate(nextStep.expectedPath);
            }
            
            setCurrentStep(nextIdx);
            sessionStorage.setItem('interactive_tour_step', String(nextIdx));
        } else {
            handleSkip();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            const prevIdx = currentStep - 1;
            const prevStep = steps[prevIdx];
            
            if (prevStep.expectedPath && location.pathname !== prevStep.expectedPath) {
                navigate(prevStep.expectedPath);
            }
            
            setCurrentStep(prevIdx);
            sessionStorage.setItem('interactive_tour_step', String(prevIdx));
        }
    };

    if (!isVisible) return null;

    const isCenter = activeStep.position === 'center' || !highlightRect;
    const progress = ((currentStep + 1) / steps.length) * 100;

    const getTooltipPosition = (): React.CSSProperties => {
        const padding = 16;
        const tooltipWidth = Math.min(380, window.innerWidth - padding * 2);
        const tooltipHeight = 240; 

        let top: number;
        let left: number;

        if (isCenter || !highlightRect) {
            top = (window.innerHeight - tooltipHeight) / 2;
            left = (window.innerWidth - tooltipWidth) / 2;
        } else {
            const pos = activeStep.position || 'center';
            switch (pos) {
                case 'right':
                    top = Math.max(padding, highlightRect.top);
                    left = highlightRect.right + padding;
                    if (left + tooltipWidth > window.innerWidth) left = highlightRect.left - tooltipWidth - padding;
                    break;
                case 'bottom':
                    top = highlightRect.bottom + padding;
                    left = Math.max(padding, highlightRect.left);
                    if (top + tooltipHeight > window.innerHeight) top = highlightRect.top - tooltipHeight - padding;
                    break;
                case 'left':
                    top = Math.max(padding, highlightRect.top);
                    left = highlightRect.left - tooltipWidth - padding;
                    if (left < 0) left = highlightRect.right + padding;
                    break;
                case 'top':
                    top = highlightRect.top - tooltipHeight - padding;
                    left = Math.max(padding, highlightRect.left);
                    if (top < 0) top = highlightRect.bottom + padding;
                    break;
                default:
                    top = (window.innerHeight - tooltipHeight) / 2;
                    left = (window.innerWidth - tooltipWidth) / 2;
            }
        }

        if (left + tooltipWidth > window.innerWidth - padding) {
            left = window.innerWidth - tooltipWidth - padding;
        }
        if (left < padding) left = padding;

        if (top + tooltipHeight > window.innerHeight - padding) {
            top = window.innerHeight - tooltipHeight - padding;
        }
        if (top < padding) top = padding;

        return {
            position: 'fixed',
            top,
            left,
            width: tooltipWidth,
            zIndex: 10002
        };
    };

    return (
        <>
            <style>{`
                .tour-overlay-box {
                    background-color: ${highlightRect && !isCenter ? 'transparent' : 'rgba(0, 0, 0, 0.65)'};
                }
                .tour-highlight-box {
                    ${highlightRect && !isCenter ? `
                    top: ${highlightRect.top - 6}px;
                    left: ${highlightRect.left - 6}px;
                    width: ${highlightRect.width + 12}px;
                    height: ${highlightRect.height + 12}px;
                    box-shadow: 0 0 0 9999px rgba(0,0,0,0.65), 0 0 30px rgba(99,102,241,0.3);
                    ` : ''}
                }
                .tour-tooltip-box {
                    position: fixed;
                    top: ${getTooltipPosition().top}px;
                    left: ${getTooltipPosition().left}px;
                    width: ${getTooltipPosition().width}px;
                    z-index: 10002;
                }
                .tour-progress-bar {
                    width: ${progress}%;
                }
            `}</style>

            {/* Overlay */}
            <div className="fixed inset-0 z-[10000] transition-opacity duration-300 pointer-events-auto tour-overlay-box" />

            {/* Highlight cutout */}
            {highlightRect && !isCenter && (
                <div className="fixed z-[10001] rounded-xl ring-4 ring-primary-500/60 transition-all duration-300 pointer-events-none tour-highlight-box" />
            )}

            {/* Tooltip card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-[fadeInScale_0.3s_ease-out] tour-tooltip-box">
                {/* Progress bar */}
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700">
                    <div className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all duration-500 ease-out rounded-r-full tour-progress-bar" />
                </div>

                <div className="p-6">
                    {/* Step indicator */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{activeStep.icon || '🧭'}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {activeTour ? 'Guided Guide' : 'Onboarding Tour'} • Step {currentStep + 1} of {steps.length}
                            </span>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Close guide"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                        {activeStep.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                        {activeStep.description}
                    </p>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleSkip}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <SkipForward size={14} />
                            Exit Guide
                        </button>

                        <div className="flex items-center gap-2">
                            {currentStep > 0 && (
                                <button
                                    onClick={handleBack}
                                    className="inline-flex items-center gap-1 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                    Back
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="inline-flex items-center gap-1 px-5 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-xl transition-colors shadow-lg shadow-primary-500/20"
                            >
                                {currentStep === steps.length - 1 ? (
                                    <>
                                        <Sparkles size={16} />
                                        Finish Guide
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ChevronRight size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </>
    );
};

export default OnboardingTour;

export function useOnboardingTour(userId: string | undefined) {
    const [activeTour, setActiveTour] = useState<string | null>(null);

    const checkTour = useCallback(() => {
        const tour = sessionStorage.getItem('active_interactive_tour');
        setActiveTour(tour);
    }, []);

    useEffect(() => {
        checkTour();
        window.addEventListener('tour-started', checkTour);
        return () => {
            window.removeEventListener('tour-started', checkTour);
        };
    }, [checkTour]);

    const showTour = useMemo(() => {
        if (!userId) return false;
        // If an active custom tour is in progress, always show it!
        if (activeTour) return true;

        // Otherwise fallback to initial onboarding condition
        const completed = localStorage.getItem(`onboarding_complete_${userId}`) === 'true';
        return !completed;
    }, [userId, activeTour]);

    const completeTour = useCallback(() => {
        sessionStorage.removeItem('active_interactive_tour');
        sessionStorage.removeItem('interactive_tour_step');
        window.dispatchEvent(new Event('tour-started'));
    }, []);

    const restartTour = useCallback((tourId: string) => {
        sessionStorage.setItem('active_interactive_tour', tourId);
        sessionStorage.setItem('interactive_tour_step', '0');
        window.dispatchEvent(new Event('tour-started'));
    }, []);

    return { showTour, activeTour, completeTour, restartTour };
}
