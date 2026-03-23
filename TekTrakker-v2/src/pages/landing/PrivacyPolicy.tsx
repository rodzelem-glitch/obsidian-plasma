
import React from 'react';
import { Logo } from '../../components/ui/Logo';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
              <Logo className="h-10 w-auto" />
          </div>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-black mb-8">Privacy Policy</h1>
        <div className="prose prose-slate max-w-none">
            <p className="text-sm text-slate-500 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">1. Introduction</h3>
            <p>Welcome to TekTrakker. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website (regardless of where you visit it from) and tell you about your privacy rights and how the law protects you.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">2. Data We Collect</h3>
            <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
                <li><strong>Contact Data</strong> includes billing address, delivery address, email address and telephone numbers.</li>
                <li><strong>Transaction Data</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
                <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform and other technology on the devices you use to access this website.</li>
            </ul>

            <h3 className="text-xl font-bold mt-6 mb-2">3. How We Use Your Data</h3>
            <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
                <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                <li>Where we need to comply with a legal or regulatory obligation.</li>
            </ul>

            <h3 className="text-xl font-bold mt-6 mb-2">4. Data Security</h3>
            <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">5. Third-Party Links</h3>
            <p>This website may include links to third-party websites, plug-ins and applications. Clicking on those links or enabling those connections may allow third parties to collect or share data about you. We do not control these third-party websites and are not responsible for their privacy statements.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">6. Contact Details</h3>
            <p>If you have any questions about this privacy policy or our privacy practices, please contact us at: <a href="mailto:privacy@tektrakker.com" className="text-blue-600 hover:underline">privacy@tektrakker.com</a>.</p>
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

export default PrivacyPolicy;
