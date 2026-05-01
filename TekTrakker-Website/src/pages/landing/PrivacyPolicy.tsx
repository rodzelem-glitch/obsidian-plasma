
import React from 'react';
import { Logo } from '../../components/ui/Logo';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pt-safe">
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
              <a href="https://app.tektrakker.com/login" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  <span className="font-medium font-sans">Back</span>
              </a>
              <Logo className="h-8 w-auto" />
              <div className="w-[72px]"></div> {/* Spacer for centering */}
          </div>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-black mb-8">Privacy Policy</h1>
        <div className="prose prose-slate max-w-none">
            <p className="text-sm text-slate-500 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
            
            <h3 className="text-xl font-bold mt-8 mb-2 italic text-primary-600">Google Play Store & Mobile App Disclosure</h3>
            <p className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm mb-6">
                This section specifically addresses requirements for users of our mobile application available on the Google Play Store. We are committed to transparency regarding the tracking and usage of sensitive data.
            </p>

            <h3 className="text-xl font-bold mt-6 mb-2">1. Introduction</h3>
            <p>Welcome to TekTrakker. We respect your privacy and are committed to protecting your personal data. This privacy policy informs you how we handle your personal data across our web and mobile applications.</p>
            
            <h3 className="text-xl font-bold mt-6 mb-2">2. Data We Collect</h3>
            <p>We collect and process the following categories of data to provide our services:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
                <li><strong>Identity & Contact Data:</strong> Includes your name, email address, telephone number, and business address. This is used for account management and service delivery.</li>
                <li><strong>Location Data (Precise & Background):</strong> 
                    <p className="text-sm mt-1">Our mobile application handles precise location data to enable field service features. We collect GPS coordinates for: </p>
                    <ul className="list-circle pl-5 mt-1 text-sm space-y-1">
                        <li>Tracking technician arrival at job sites.</li>
                        <li>Automated mileage tracking for accurate billing and payroll.</li>
                        <li>Fleet dispatching and safety monitoring.</li>
                    </ul>
                    <p className="text-sm mt-1 font-bold text-primary-700 italic">Notice on Background Location: Location data may be collected even when the app is closed or not in use, if permission is granted, to maintain accurate "Clock In" status and safety tracking during active work shifts.</p>
                </li>
                <li><strong>Camera & Media Access:</strong> We request access to your device camera and photo gallery to allow you to:
                    <ul className="list-circle pl-5 mt-1 text-sm space-y-1">
                        <li>Document job site conditions and completed work.</li>
                        <li>Upload profile pictures.</li>
                        <li>Upload receipts for expense management.</li>
                    </ul>
                </li>
                <li><strong>ATS & Recruitment Data:</strong> We collect applicant resumes, work history, and contact metadata submitted through our integrated Career Pages for hiring validation.</li>
                <li><strong>AI Chatbot & Automation Data:</strong> Transcripts of interactions with our embedded public widgets and AI assistants are stored to refine generative output and resolve service inquiries.</li>
                <li><strong>SMS & Communication Records:</strong> Metadata related to automated transactional SMS, including timestamps and A2P 10DLC routing verifications, are logged for compliance and analytics.</li>
                <li><strong>Technical Data:</strong> Includes IP address, login data, device type, operating system, and unique device identifiers used for security and push notifications.</li>
            </ul>
            
            <h3 className="text-xl font-bold mt-6 mb-2">3. How We Use Your Data</h3>
            <p>We use your data strictly for legitimate business purposes:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Service Performance:</strong> Managing appointments, invoices, public marketplace requests, and job history.</li>
                <li><strong>Communication:</strong> Sending service updates via Email/SMS and push notifications.</li>
                <li><strong>Machine Learning:</strong> Non-personally identifiable aggregate data may be used to train our AI estimators and predictive dispatch models. Additionally, we actively track AI token and resource usage across our platforms to manage stability. We expressly reserve the right to limit, restrict, or suspend access to AI features at any time based on excessive usage or cost constraints at our sole discretion.</li>
                <li><strong>Legal Compliance:</strong> Meeting tax and regulatory requirements for field service documentation and recruitment.</li>
            </ul>

            <h3 className="text-xl font-bold mt-6 mb-2">4. Third-Party Service Providers</h3>
            <p>We share data with trusted third-party providers to maintain our infrastructure:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Google Cloud/Firebase:</strong> Secure data storage and authentication.</li>
                <li><strong>OpenAI/Anthropic:</strong> Processing of de-identified inputs for our pricing and chatbot engines.</li>
                <li><strong>Google Maps API:</strong> Mapping and location services.</li>
                <li><strong>Payment Processors (Stripe/PayPal):</strong> Transaction handling.</li>
                <li><strong>Communication APIs (Twilio):</strong> SMS and telephony services.</li>
            </ul>

            <h3 className="text-xl font-bold mt-6 mb-2">5. Data Retention & Deletion</h3>
            <p>We retain your personal data only as long as necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.</p>
            <p className="mt-2 font-bold">Account Deletion Request:</p>
            <p>Users may request the deletion of their account and all associated personal data at any time. To request deletion, please email us directly at <a href="mailto:platform@tektrakker.com" className="text-blue-600 hover:underline">platform@tektrakker.com</a>. We will process your request within 30 days, subject to legal retention requirements.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">6. Children's Privacy</h3>
            <p>Our platform is NOT intended for children under the age of 13. We do not knowingly collect personal data from children. If we learn we have collected data from a child under 13, we will delete it immediately.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">7. Data Security</h3>
            <p>We have implemented industry-standard encryption and security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way.</p>

            <h3 className="text-xl font-bold mt-6 mb-2">8. Contact Details</h3>
            <p>If you have any questions about this privacy policy or our privacy practices, please contact us at:</p>
            <p className="font-bold">TekTrakker Privacy Team</p>
            <a href="mailto:platform@tektrakker.com" className="text-blue-600 hover:underline">platform@tektrakker.com</a>

            <div className="mt-12 bg-blue-50 dark:bg-blue-900/10 p-8 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4">Google Play Data Safety Summary</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                    To help you understand our data practices at a glance, we provide this summary which corresponds to the Data Safety labels you see in the Google Play Store.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Data Collected
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">Approximate Location, Precise Location, Name, Email, Phone Number, Photos/Videos, File Metadata, Device IDs.</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span> Data Shared
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">We do not sell your data. We share only necessary data with service providers (Firebase, Google Maps) to keep the app functional.</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-2 h-2 bg-purple-500 rounded-full"></span> Security Practices
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">Data is encrypted in transit. Your data is stored in secure Google Cloud data centers.</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-2 h-2 bg-orange-500 rounded-full"></span> User Rights
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">You can request data deletion at any time by contacting us.</p>
                        </div>
                    </div>
                </div>
            </div>
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
