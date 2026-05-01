import React, { useState } from 'react';
import { ChevronDown, HelpCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Logo';
import { MarketingFooter } from '../../components/layout/MarketingFooter';

const FAQS = [
  {
    category: 'General Overview',
    questions: [
      { question: "What exactly is TekTrakker?", answer: "TekTrakker is a comprehensive field service management platform designed for HVAC, Plumbing, Electrical, and other trade services. It centralizes scheduling, dispatching, invoicing, quoting, and customer relationship management into a single, cloud-based interface." },
      { question: "Do I need to download a mobile app from the App Store?", answer: "No, but you can! TekTrakker is built as a Progressive Web App (PWA) which means you can install it directly from your web browser to your home screen. However, native Android and iOS versions are also available in their respective app stores." },
      { question: "Is my data secure?", answer: "Yes. All data is encrypted at rest and in transit using bank-grade AES-256 encryption. We utilize Google Cloud infrastructure to ensure compliance with modern data security standards." },
      { question: "Does TekTrakker work offline?", answer: "Yes! The mobile technician app utilizes local IndexedDB storage. Technicians can view job details, add notes, and capture signatures offline. The app automatically syncs all data to the cloud once an internet connection is re-established." }
    ]
  },
  {
    category: 'Field Operations',
    questions: [
      { question: "How does geofenced time tracking work?", answer: "Our mobile app utilizes your device's background GPS to automatically punch technicians in and out when they cross a geofence radius around the customer's site. This guarantees accurate payroll without manual entry." },
      { question: "What is Kiosk Mode?", answer: "Kiosk Mode is a feature designed for warehouse workers, apprentices, or shop staff who don't have their own device login. You can set up a tablet in the breakroom, and staff can clock in or out securely using their unique 4-digit PIN." },
      { question: "Can technicians generate quotes in the field?", answer: "Yes, our estimating tool allows technicians to instantly generate beautiful Good, Better, and Best options for the customer while standing in their living room. Once the customer signs digitally, it instantly syncs to the back office." },
      { question: "Can I track vehicle mileage?", answer: "Absolutely. The system can be configured to automatically log start and end coordinates based on time-clock punches, generating IRS-compliant mileage reports for your fleet." },
      { question: "Does it support photo attachments for jobs?", answer: "Yes, technicians can snap before/after photos, upload schematics, and attach them directly to the job profile. These photos can optionally be shared with the customer via the Consumer Vault." }
    ]
  },
  {
    category: 'The Consumer Vault & Marketing',
    questions: [
      { question: "What is the Consumer Vault?", answer: "The Consumer Vault is a free homeowner portal that acts as a digital filing cabinet for your customers. They can log in to view past service reports, operating manuals, warranties, and easily request new service from you with one tap." },
      { question: "Do you really provide free leads?", answer: "Yes! Because we host the Consumer Vault, homeowners often look for specialized trade pros in their area. We distribute these high-quality, local leads directly to your dispatch board with zero ad spend or per-lead fees attached." },
      { question: "Can I send marketing emails to my customers?", answer: "Yes. TekTrakker includes a built-in campaign manager. You can filter your customer database (e.g., 'customers with 10+ year old AC units') and dispatch targeted promotional emails or SMS messages." },
      { question: "Will my company logo appear on invoices?", answer: "Yes. You can customize your brand colors, logo, and messaging. All proposals, invoices, and automated emails will feature your company's branding front and center." }
    ]
  },
  {
    category: 'Billing & Payments',
    questions: [
      { question: "How do I get paid?", answer: "We integrate directly with Stripe to process credit cards, debit cards, and ACH transfers. Customers can pay via a secure link on their invoice, or technicians can swipe cards in the field." },
      { question: "Does TekTrakker sync with QuickBooks?", answer: "Yes, we offer seamless two-way synchronization with QuickBooks Online. Invoices, payments, and customer records are automatically mapped and synced to keep your accounting flawless." },
      { question: "Can I set up recurring service agreements?", answer: "Yes. You can sell monthly or annual maintenance agreements. The system will auto-bill the customer's saved payment method and automatically generate the recurring dispatch tickets." },
      { question: "Are there per-user fees?", answer: "Our pricing is transparent. Depending on your tier, we offer unlimited office users and scalable technician licenses so you aren't penalized for growing your team." }
    ]
  },
  {
    category: 'The AI Virtual Worker',
    questions: [
      { question: "What is the AI Virtual Worker Add-On?", answer: "It is an autonomous AI agent integrated directly into your back-office. It can analyze your schedule, answer customer emails, generate complex multi-day proposals, and audit your dispatch board for inefficiencies." },
      { question: "Does the AI interact directly with my customers?", answer: "You have full control. You can set the AI to 'Draft Mode' where it prepares emails for your review, or 'Autonomous Mode' where it handles routine customer inquiries instantly." },
      { question: "Is the AI trained on my business data?", answer: "Yes. The AI securely indexes your price book, past jobs, and company policies to ensure its responses and estimates are perfectly aligned with your standard operating procedures." }
    ]
  }
];

const FAQAccordion: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-50 transition-colors focus:outline-none"
      >
        <h3 className="text-lg font-bold text-slate-800 pr-4">{question}</h3>
        <div className={`shrink-0 text-primary-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={24} />
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-6 pt-0 text-slate-600 leading-relaxed text-lg border-t border-slate-100 mt-2">
          {answer}
        </div>
      </div>
    </div>
  );
};

const FAQ: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col selection:bg-primary-500 selection:text-white">
      <nav className="border-b border-slate-200 backdrop-blur-md fixed w-full z-50 bg-white/80">
          <div className="max-w-7xl mx-auto px-6 h-24 flex justify-between items-center">
              <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
                  <Logo className="h-14 w-auto text-primary-600" />
              </div>
              <div className="flex gap-4 items-center">
                  <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors">
                      <ArrowLeft size={16} /> Back to Home
                  </button>
                  <button onClick={() => window.location.href = 'https://app.tektrakker.com/login'} className="bg-primary-100 hover:bg-primary-200 text-primary-700 border border-primary-200 text-sm font-black px-4 md:px-8 py-3 rounded-full transition-all shadow-sm hidden sm:block">
                      Login
                  </button>
              </div>
          </div>
      </nav>

      <header className="pt-40 pb-20 px-6 relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-600/5 rounded-full blur-[120px] -z-10" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 text-primary-600 text-sm font-bold tracking-wide mb-6">
            <HelpCircle size={16} /> Help Center
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-8">
            Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">Questions</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Everything you need to know about setting up and running your field service business on TekTrakker.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-32 relative z-10 flex-grow w-full">
        <div className="space-y-16">
          {FAQS.map((category, catIdx) => (
            <section key={catIdx}>
              <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-4">
                <span className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center text-lg shadow-sm border border-primary-200">
                  {catIdx + 1}
                </span>
                {category.category}
              </h2>
              <div className="space-y-4">
                {category.questions.map((q, qIdx) => (
                  <FAQAccordion key={qIdx} question={q.question} answer={q.answer} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default FAQ;
