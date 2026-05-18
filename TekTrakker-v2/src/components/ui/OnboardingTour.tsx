
import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, SkipForward } from 'lucide-react';

interface TourStep {
    title: string;
    description: string;
    targetSelector?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    icon?: string;
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
        icon: '👋'
    },
    {
        title: 'Your Dashboard',
        description: 'This is your command center. See active jobs, team status, pending orders, and financial metrics at a glance.',
        targetSelector: '[data-tour="dashboard-metrics"]',
        position: 'bottom',
        icon: '📊'
    },
    {
        title: 'Navigation Sidebar',
        description: 'Use the left sidebar to access all platform modules — CRM, Scheduling, Financials, HR, and more. You can customize the order and hide sections you don\'t use.',
        targetSelector: '[data-tour="sidebar"]',
        position: 'right',
        icon: '🧭'
    },
    {
        title: 'Customer Management',
        description: 'Add your customers, track service history, manage equipment, and build lasting relationships — all from the Customers section.',
        targetSelector: '[data-tour="nav-customers"]',
        position: 'right',
        icon: '👥'
    },
    {
        title: 'Scheduling & Dispatch',
        description: 'Schedule jobs, dispatch technicians, and track field operations in real time from the Operations hub.',
        targetSelector: '[data-tour="nav-operations"]',
        position: 'right',
        icon: '📅'
    },
    {
        title: 'Financials',
        description: 'Create invoices, track expenses, manage proposals, and monitor your cash flow from the Financials section.',
        targetSelector: '[data-tour="nav-financials"]',
        position: 'right',
        icon: '💰'
    },
    {
        title: 'HR & Payroll',
        description: 'Manage employee records, handbooks, safety incidents, and generate payroll reports seamlessly.',
        targetSelector: '[data-tour="nav-hr"]',
        position: 'right',
        icon: '💼'
    },
    {
        title: 'Records & Assets',
        description: 'Keep track of physical inventory, tool assignments, and vehicle records.',
        targetSelector: '[data-tour="nav-records"]',
        position: 'right',
        icon: '📦'
    },
    {
        title: 'Sales & Marketing Hub',
        description: 'Launch email campaigns, send SMS blasts, and manage your online reputation from one centralized hub.',
        targetSelector: '[data-tour="nav-marketing-hub"]',
        position: 'right',
        icon: '📣'
    },
    {
        title: 'AI Worker & Reports',
        description: 'Leverage your Virtual AI Worker for automated follow-ups, and review advanced generated reports.',
        targetSelector: '[data-tour="nav-ai-reports"]',
        position: 'right',
        icon: '🤖'
    },
    {
        title: 'Settings & Integrations',
        description: 'Set up payment processing, connect third-party apps, configure your tax rates, and customize your branding in Settings.',
        targetSelector: '[data-tour="nav-settings"]',
        position: 'right',
        icon: '⚙️'
    },
    {
        title: 'You\'re All Set! 🚀',
        description: 'Explore at your own pace. If you ever need help, check the Settings page or reach out to our support team. Welcome aboard!',
        position: 'center',
        icon: '✅'
    }
];

const PAYMENTS_ONLY_STEPS: TourStep[] = [
    {
        title: 'Welcome to TekTrakker Payments! 🎉',
        description: 'Let\'s get you set up to start accepting payments. This quick tour will show you everything you need.',
        position: 'center',
        icon: '👋'
    },
    {
        title: 'Your Dashboard',
        description: 'Your dashboard shows unpaid invoices, active jobs, and financial metrics at a glance.',
        targetSelector: '[data-tour="dashboard-metrics"]',
        position: 'bottom',
        icon: '📊'
    },
    {
        title: 'Step 1: Set Up Payments',
        description: 'Before you can accept payments, complete the merchant onboarding. Click the green banner on your dashboard or go to Settings → Integrations.',
        targetSelector: '[data-tour="payment-setup-banner"]',
        position: 'bottom',
        icon: '💳'
    },
    {
        title: 'Create Proposals',
        description: 'Build detailed proposals with line items, send them to clients, and convert accepted proposals into invoices.',
        targetSelector: '[data-tour="nav-estimator"]',
        position: 'right',
        icon: '📝'
    },
    {
        title: 'Send Invoices & Get Paid',
        description: 'Create invoices, send them to customers, and collect payments via credit card, debit, or ACH bank transfer.',
        targetSelector: '[data-tour="nav-financials"]',
        position: 'right',
        icon: '💰'
    },
    {
        title: 'You\'re Ready! 🚀',
        description: 'Complete your payment setup from the dashboard, then start sending your first invoice. Welcome aboard!',
        position: 'center',
        icon: '✅'
    }
];

const TECH_VIEW_STEPS: TourStep[] = [
    {
        title: 'Welcome to Tech View! 🔧',
        description: 'This is your dedicated field app. Let\'s quickly review the tools you need to crush it today.',
        position: 'center',
        icon: '👋'
    },
    {
        title: 'Daily Briefing',
        description: 'Start here. See your assigned jobs, HR updates, weather forecasts, and routing information for the day.',
        targetSelector: '[data-tour="nav-briefing"]',
        position: 'top',
        icon: '📱'
    },
    {
        title: 'Time & GPS Tracking',
        description: 'Clock in, track your drive time, and log breaks. The app uses GPS to verify on-site arrivals automatically.',
        targetSelector: '[data-tour="nav-timelog"]',
        position: 'top',
        icon: '⏱️'
    },
    {
        title: 'Estimator & Invoices',
        description: 'Build professional proposals in the field, collect digital signatures, and seamlessly convert them into invoices.',
        targetSelector: '[data-tour="nav-proposal"]',
        position: 'top',
        icon: '📝'
    },
    {
        title: 'Payments & Orders',
        description: 'Accept credit cards on-site or send payment links. You can also log parts and request inventory directly from this tab.',
        targetSelector: '[data-tour="nav-payments"]',
        position: 'top',
        icon: '💳'
    },
    {
        title: 'Field Tools',
        description: 'Access diagnostic calculators, manuals, and technical references right when you need them.',
        targetSelector: '[data-tour="nav-tools"]',
        position: 'top',
        icon: '🛠️'
    },
    {
        title: 'You\'re Ready to Roll! 🚀',
        description: 'Stay safe out there, and let the office know if you need any support via the Chat tab!',
        position: 'center',
        icon: '✅'
    }
];

const OnboardingTour: React.FC<OnboardingTourProps> = ({ isPaymentsOnly, isTechView, userId, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(true);
    const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

    const steps = isTechView ? TECH_VIEW_STEPS : (isPaymentsOnly ? PAYMENTS_ONLY_STEPS : FULL_PLAN_STEPS);
    const step = steps[currentStep];

    const updateHighlight = useCallback(() => {
        if (step.targetSelector && step.position !== 'center') {
            const el = document.querySelector(step.targetSelector);
            if (el) {
                const rect = el.getBoundingClientRect();
                setHighlightRect(rect);
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }
        }
        setHighlightRect(null);
    }, [step]);

    useEffect(() => {
        updateHighlight();
        const timer = setTimeout(updateHighlight, 300);
        return () => clearTimeout(timer);
    }, [currentStep, updateHighlight]);

    useEffect(() => {
        const handleResize = () => updateHighlight();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateHighlight]);

    const handleSkip = () => {
        localStorage.setItem(`onboarding_complete_${userId}`, 'true');
        setIsVisible(false);
        onComplete();
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleSkip();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    if (!isVisible) return null;

    const isCenter = step.position === 'center' || !highlightRect;
    const progress = ((currentStep + 1) / steps.length) * 100;

    const getTooltipPosition = (): React.CSSProperties => {
        const padding = 16;
        const tooltipWidth = Math.min(380, window.innerWidth - padding * 2);
        const tooltipHeight = 240; // rough estimate for bounds checking

        let top = 0;
        let left = 0;

        if (isCenter || !highlightRect) {
            top = (window.innerHeight - tooltipHeight) / 2;
            left = (window.innerWidth - tooltipWidth) / 2;
        } else {
            switch (step.position) {
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

        // Global bounds checking to ensure it never bleeds off-screen
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
            {/* Overlay */}
            <div
                className="fixed inset-0 z-[10000] transition-opacity duration-300 pointer-events-auto"
                style={{ backgroundColor: (highlightRect && !isCenter) ? 'transparent' : 'rgba(0, 0, 0, 0.65)' }}
            />

            {/* Highlight cutout */}
            {highlightRect && !isCenter && (
                <div
                    className="fixed z-[10001] rounded-xl ring-4 ring-primary-500/60 shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all duration-300 pointer-events-none"
                    style={{
                        top: highlightRect.top - 6,
                        left: highlightRect.left - 6,
                        width: highlightRect.width + 12,
                        height: highlightRect.height + 12,
                        boxShadow: `0 0 0 9999px rgba(0,0,0,0.65), 0 0 30px rgba(99,102,241,0.3)`
                    }}
                />
            )}

            {/* Tooltip card */}
            <div
                style={getTooltipPosition()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-[fadeInScale_0.3s_ease-out]"
            >
                {/* Progress bar */}
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700">
                    <div
                        className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all duration-500 ease-out rounded-r-full"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="p-6">
                    {/* Step indicator */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{step.icon}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Step {currentStep + 1} of {steps.length}
                            </span>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Close tour"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                        {step.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                        {step.description}
                    </p>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleSkip}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <SkipForward size={14} />
                            Skip Tour
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
                                        Get Started
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

            {/* Keyframe animation */}
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
    const [showTour, setShowTour] = useState(false);

    useEffect(() => {
        if (!userId) return;
        const completed = localStorage.getItem(`onboarding_complete_${userId}`);
        if (!completed) {
            // Small delay to let the dashboard render first
            const timer = setTimeout(() => setShowTour(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [userId]);

    const completeTour = useCallback(() => {
        setShowTour(false);
    }, []);

    const restartTour = useCallback(() => {
        if (userId) {
            localStorage.removeItem(`onboarding_complete_${userId}`);
            setShowTour(true);
        }
    }, [userId]);

    return { showTour, completeTour, restartTour };
}
