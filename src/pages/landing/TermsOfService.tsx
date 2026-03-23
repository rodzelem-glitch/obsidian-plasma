
import React from 'react';
import { Logo } from '../../components/ui/Logo';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
              <Logo className="h-10 w-auto" />
          </div>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-black mb-8">Terms of Service</h1>
        <div className="prose prose-slate max-w-none">
            <p className="text-sm text-slate-500 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">1. Acceptance of Terms</h3>
            <p>By accessing or using the TekTrakker platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">2. Subscription and Billing</h3>
            <p>TekTrakker is a subscription-based service. By subscribing, you agree to pay the fees associated with your chosen plan. All fees are billed in advance of the service period.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-4 px-4 py-2 bg-slate-50 border-l-4 border-slate-900">3. Refund and Cancellation Policy</h3>
            <p className="font-medium">Strict No-Refund Policy: TekTrakker does not offer refunds or credits for any partial subscription periods, plan downgrades, or unused months.</p>
            <p className="mt-2">Cancellation Access: If you choose to cancel your subscription, your account will remain active and accessible until the end of your current paid billing cycle. At the conclusion of that period, your access will be terminated, and no further charges will be applied.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">4. User Obligations</h3>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information when registering for our service.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">5. Intellectual Property</h3>
            <p>The TekTrakker platform, including its software, design, and content, is protected by intellectual property laws. You may not copy, modify, or distribute any part of our platform without prior written consent.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">6. Limitation of Liability</h3>
            <p>TekTrakker shall not be liable for any indirect, incidental, or consequential damages arising from your use of our platform. Our total liability to you shall not exceed the amount paid for the service in the preceding 12 months.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">7. Contact Information</h3>
            <p>If you have any questions regarding these terms, please contact us at: <a href="mailto:platform@tektrakker.com" className="text-blue-600 hover:underline">platform@tektrakker.com</a>.</p>
        </div>
      </div>
      <footer className="bg-slate-50 border-t border-slate-200 py-12 px-6 mt-12">
        <div className="max-w-7xl mx-auto text-center text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} TekTrakker Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;
