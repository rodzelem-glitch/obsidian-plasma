import React from 'react';
import { Scale, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import { LandingHeader } from './components/LandingHeader';
import { LandingFooter } from './components/LandingFooter';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-500/10 selection:text-indigo-600">
      <LandingHeader 
        backButton={{ label: 'Back to Home', href: 'https://tektrakker.com' }}
      />

      <header className="pt-40 pb-20 bg-slate-50 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-bold mb-6">
            <Scale size={16} /> Legal Framework
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
            Terms of <span className="text-indigo-600">Service</span>
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed max-w-2xl">
            By using TekTrakker, you agree to these terms. Please read them carefully as they govern your use of our software platform.
          </p>
          <p className="mt-4 text-sm text-slate-400 font-medium">Last Updated: May 9, 2026</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-20">
            <div className="space-y-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><Zap size={24} /></div>
                <h3 className="font-bold text-slate-900">Platform Usage</h3>
                <p className="text-sm text-slate-500 leading-relaxed">You agree to use TekTrakker only for lawful business operations and in compliance with all local trade regulations.</p>
            </div>
            <div className="space-y-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600"><ShieldCheck size={24} /></div>
                <h3 className="font-bold text-slate-900">Service Reliability</h3>
                <p className="text-sm text-slate-500 leading-relaxed">We aim for 99.9% uptime. While rare, maintenance windows are communicated at least 48 hours in advance.</p>
            </div>
            <div className="space-y-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600"><AlertCircle size={24} /></div>
                <h3 className="font-bold text-slate-900">Subscription Terms</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Monthly billing occurs on your anniversary date. Cancellation requires 30 days notice for standard accounts.</p>
            </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-12">
          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">1</span>
                Software License
            </h2>
            <p className="text-slate-600 leading-relaxed">
                TekTrakker grants you a non-exclusive, non-transferable, limited license to access and use our software-as-a-service platform for your business operations. You may not reverse engineer, decompile, or attempt to extract the source code of our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">2</span>
                Account Security
            </h2>
            <p className="text-slate-600 leading-relaxed">
                You are responsible for maintaining the confidentiality of your login credentials. Any activity that occurs under your account is your responsibility. You agree to notify TekTrakker immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">3</span>
                Termination of Service
            </h2>
            <p className="text-slate-600 leading-relaxed">
                We reserve the right to suspend or terminate access to our service for any user who violates these terms, fails to pay subscription fees, or engages in fraudulent or abusive behavior on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">4</span>
                Limitation of Liability
            </h2>
            <p className="text-slate-600 leading-relaxed">
                TekTrakker provides the platform on an "as is" basis. We are not liable for any indirect, incidental, or consequential damages resulting from your use of the software, including lost profits or business interruption.
            </p>
          </section>

          <section>
             <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                 <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">5</span>
                 Telephony, SMS, and AI Usage Billing
             </h2>
             <p className="text-slate-600 leading-relaxed">
                 For organizations using TekTrakker's platform-wide telephony, messaging (SMS/MMS), or generative AI integrations, usage-based fees will apply. Standard platform rates are charged monthly based on actual transmission volumes: outbound and inbound messages are charged at $0.02 per SMS, and voice calls at $0.03 per minute, unless otherwise specified in your subscription tier. You are solely responsible for all message content, obtaining proper customer opt-in/consent under TCPA and local A2P regulations, and protecting the platform against messaging spam or abuse. Failure to comply may result in immediate suspension of telephony services.
             </p>
           </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default TermsOfService;
