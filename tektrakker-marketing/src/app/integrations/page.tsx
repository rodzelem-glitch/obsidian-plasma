"use client";

import React from 'react';
import { resourcesData } from '../data/content';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import LandingChatbot from '../components/LandingChatbot';
import { Network, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function IntegrationsPage() {
    const data = resourcesData['integrations'];

    const integrations = [
        { name: "QuickBooks Online", category: "Accounting", description: "Bi-directional sync for invoices, payments, and chart of accounts." },
        { name: "QuickBooks Desktop", category: "Accounting", description: "Direct integration for desktop-based accounting workflows." },
        { name: "Xero", category: "Accounting", description: "Push invoices and receive payment updates seamlessly." },
        { name: "Sage", category: "Accounting", description: "Enterprise-grade financial management and reporting." },
        { name: "FreshBooks", category: "Accounting", description: "Simple invoicing and expense tracking sync." },
        { name: "Mailchimp", category: "Marketing", description: "Automatically sync customer data for targeted email campaigns." },
        { name: "HubSpot", category: "CRM", description: "Keep marketing and sales teams in sync with field operations." },
        { name: "Salesforce", category: "CRM", description: "Enterprise-grade customer relationship management sync." },
        { name: "ActiveCampaign", category: "Marketing", description: "Trigger complex marketing automations based on job status." },
        { name: "Klaviyo", category: "Marketing", description: "Data-driven email and SMS marketing campaigns." },
        { name: "Twilio", category: "Communications", description: "Power all outbound SMS and voice communications." },
        { name: "RingCentral", category: "Communications", description: "Log all incoming calls and texts against customer records." },
        { name: "Mailgun", category: "Communications", description: "Reliable transactional email delivery for invoices and alerts." },
        { name: "SendGrid", category: "Communications", description: "Scalable email marketing and notification infrastructure." },
        { name: "Slack", category: "Communications", description: "Get real-time notifications for booked jobs and payments." },
        { name: "Microsoft Teams", category: "Communications", description: "Keep your back-office team informed of field updates." },
        { name: "Stripe", category: "Payments", description: "Secure credit card processing and vaulting." },
        { name: "Square", category: "Payments", description: "Process field payments through Square hardware and gateways." },
        { name: "PayPal", category: "Payments", description: "Offer flexible payment options to your customers." },
        { name: "Plaid", category: "Payments", description: "Enable secure ACH bank transfers for large invoices." },
        { name: "Authorize.Net", category: "Payments", description: "Legacy payment gateway support for established businesses." },
        { name: "Nextdoor", category: "Social", description: "Automatically publish completed jobs to local neighborhood feeds." },
        { name: "Facebook", category: "Social", description: "Omni-channel marketing directly from the field app." },
        { name: "Instagram", category: "Social", description: "Visually showcase completed projects and generate new leads." },
        { name: "TikTok", category: "Social", description: "Publish engaging video content of your completed jobs." },
        { name: "LinkedIn", category: "Social", description: "Showcase commercial projects to B2B clients." },
        { name: "Pinterest", category: "Social", description: "Share visual portfolios for landscaping and remodeling." },
        { name: "Google Calendar", category: "Scheduling", description: "Sync technician schedules with their personal calendars." },
        { name: "Outlook Calendar", category: "Scheduling", description: "Two-way sync for Microsoft 365 users." },
        { name: "Apple Calendar", category: "Scheduling", description: "Native iCloud calendar synchronization for iOS." },
        { name: "Calendly", category: "Scheduling", description: "Allow customers to book their own appointments online." },
        { name: "Zapier", category: "Automation", description: "Connect to over 5,000+ apps to automate repetitive tasks." },
        { name: "Make", category: "Automation", description: "Advanced visual workflow automation for custom needs." },
        { name: "Angi Leads", category: "Lead Generation", description: "Automatically import and respond to high-intent customer leads." },
        { name: "Thumbtack", category: "Lead Generation", description: "Seamlessly pull incoming service requests directly to your dispatch board." },
        { name: "HomeAdvisor", category: "Lead Generation", description: "Sync incoming leads instantly to your dispatch board." },
        { name: "ServiceMagic", category: "Lead Generation", description: "Automated importing of regional service requests." },
        { name: "Google Local Services", category: "Lead Generation", description: "Capture Google Guaranteed leads directly into your funnel." },
        { name: "Yelp", category: "Marketing", description: "Automate review requests and manage your local reputation." },
        { name: "Podium", category: "Marketing", description: "Automate text-based review generation and communication." },
        { name: "Broadly", category: "Marketing", description: "Build your online reputation through automated feedback." },
        { name: "CallRail", category: "Marketing", description: "Track marketing attribution through dynamic phone numbers." },
        { name: "Gusto", category: "Payroll", description: "Push timesheets and commission data directly to payroll." },
        { name: "ADP", category: "Payroll", description: "Enterprise payroll and human resources synchronization." },
        { name: "Paychex", category: "Payroll", description: "Seamless export of technician hours and overtime." },
        { name: "Fleetio", category: "Fleet Management", description: "Track vehicle maintenance and dispatch efficiency." },
        { name: "Samsara", category: "Fleet Management", description: "Real-time GPS tracking and dashcam integration." },
        { name: "Motive", category: "Fleet Management", description: "ELD compliance and automated fleet tracking." },
        { name: "CompanyCam", category: "Documentation", description: "Sync job site photos instantly to customer profiles." },
        { name: "DocuSign", category: "Legal", description: "Secure digital signatures for high-value contracts." },
        { name: "PandaDoc", category: "Legal", description: "Automated proposal generation and e-signatures." },
        { name: "Google Analytics", category: "Analytics", description: "Track conversion rates on your booking widgets." },
        { name: "Meta Pixel", category: "Analytics", description: "Optimize ad spend based on actual booked revenue." },
        { name: "JobTread", category: "Project Management", description: "Sync complex construction projects with field execution." },
        { name: "Procore", category: "Project Management", description: "Enterprise construction management synchronization." },
        { name: "Hover", category: "Estimating", description: "Import precise 3D property measurements for accurate quotes." },
        { name: "EagleView", category: "Estimating", description: "High-resolution aerial roof measurements and reports." },
        { name: "LennoxPros", category: "Supplier", description: "Live pricing and availability for HVAC equipment." },
        { name: "Ferguson", category: "Supplier", description: "Direct catalog integration for plumbing and HVAC supplies." },
        { name: "Reece", category: "Supplier", description: "Real-time material costs and ordering." },
        { name: "Watsco Ventures", category: "Supplier", description: "Seamless procurement for HVAC contractors." },
        { name: "Zendesk", category: "Support", description: "Turn customer support tickets into dispatchable jobs." },
        { name: "Intercom", category: "Support", description: "Live chat widget integration for instant booking." },
        { name: "RevenueCat", category: "Payments", description: "Manage mobile in-app purchases and recurring app subscriptions." }
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader backButton={{ label: 'Back to Home', href: '/' }} />
            
            <header className="pt-40 pb-20 px-6 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900 border border-primary-800 mb-8">
                        <Network size={16} className="text-primary-400" />
                        <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">Ecosystem</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">{data.title}</h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10">{data.description}</p>
                </div>
            </header>

            <section className="py-24 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {integrations.map((int, i) => (
                        <div key={i} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-lg hover:-translate-y-2 transition-transform duration-300">
                            <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full mb-4 uppercase tracking-wider">{int.category}</span>
                            <h3 className="text-2xl font-bold text-slate-900 mb-3">{int.name}</h3>
                            <p className="text-slate-600 leading-relaxed">{int.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-black mb-8 text-center text-slate-900">Why Integration Matters</h2>
                    <div className="prose prose-lg prose-slate text-slate-600 mx-auto">
                        <p className="leading-relaxed">{data.deepDive}</p>
                    </div>
                </div>
            </section>

            <section className="py-20 px-6 bg-primary-50 text-center">
                <h2 className="text-3xl font-black text-slate-900 mb-6">Don&apos;t see your favorite tool?</h2>
                <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto">Our Open API allows your developers to connect TekTrakker to virtually any system on earth.</p>
                <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex h-14 px-8 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition-all items-center gap-2">
                    Request an Integration <ArrowRight size={18} />
                </Link>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
