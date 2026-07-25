import React from 'react';
import { Shield, Lock, Eye, FileText } from 'lucide-react';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-500/10 selection:text-blue-600">
      <LandingHeader 
        backButton={{ label: 'Back to Home', href: 'https://tektrakker.com' }}
      />

      <header className="pt-40 pb-20 bg-slate-50 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-bold mb-6">
            <Shield size={16} /> Data Protection & Trust
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
            Privacy <span className="text-blue-600">Policy</span>
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed max-w-2xl">
            At TekTrakker, we take your operational data seriously. This policy outlines how we collect, protect, and use your information.
          </p>
          <p className="mt-4 text-sm text-slate-400 font-medium">Last Updated: May 9, 2026</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
            <div className="space-y-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600"><Lock size={24} /></div>
                <h3 className="font-bold text-slate-900">Encrypted Storage</h3>
                <p className="text-sm text-slate-500 leading-relaxed">All sensitive customer and financial data is encrypted at rest using AES-256 standards.</p>
            </div>
            <div className="space-y-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600"><Eye size={24} /></div>
                <h3 className="font-bold text-slate-900">Zero Data Selling</h3>
                <p className="text-sm text-slate-500 leading-relaxed">We never sell your customer lists or operational data to third-party marketing firms.</p>
            </div>
            <div className="space-y-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><FileText size={24} /></div>
                <h3 className="font-bold text-slate-900">Right to Export</h3>
                <p className="text-sm text-slate-500 leading-relaxed">You own your data. You can export your entire database at any time via the admin dashboard.</p>
            </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-12">
          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">1</span>
                Information We Collect
            </h2>
            <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>We collect information that you provide directly to us when you create an account, such as your name, business name, email address, and payment information. For field operations, we also collect:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Precise Location Data:</strong> Used to automate clock-ins and provide real-time GPS tracking for dispatching.</li>
                    <li><strong>Device Information:</strong> To ensure mobile app compatibility and security.</li>
                    <li><strong>Customer Data:</strong> Provided by you to manage job scheduling and invoicing.</li>
                </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">2</span>
                How We Use Your Data
            </h2>
            <p className="text-slate-600 leading-relaxed">
                Your data is primarily used to provide the TekTrakker service. This includes processing payments, optimizing technician routes, generating operational reports, and facilitating communication between you and your customers via the Consumer Vault.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">3</span>
                Background Location Services
            </h2>
            <p className="text-slate-600 leading-relaxed bg-amber-50 p-6 rounded-2xl border border-amber-100 italic">
                <strong>Important:</strong> Our mobile application requires background location access to enable automated time tracking and 'En Route' notifications. This data is only collected while a technician is actively on a shift and is never shared with third parties for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">4</span>
                Data Retention
            </h2>
            <p className="text-slate-600 leading-relaxed">
                We retain your business data as long as your account is active. If you choose to close your account, your data will be archived for 90 days before permanent deletion, unless otherwise required by law for tax or compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">5</span>
                Mobile Terms &amp; SMS Communications
            </h2>
            <p className="text-slate-600 leading-relaxed">
                If you opt-in to receive SMS notifications, updates, or support messages from TekTrakker, we will use your phone number solely for this purpose. <strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong> All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties or affiliates.
            </p>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default PrivacyPolicy;
