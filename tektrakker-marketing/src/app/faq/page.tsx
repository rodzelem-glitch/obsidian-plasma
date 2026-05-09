"use client";

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';

const FAQS = [
  {
    category: 'General',
    questions: [
      {
        question: "What exactly is TekTrakker?",
        answer: "TekTrakker is an all-in-one software platform for trade services like HVAC, Plumbing, and Electrical. It helps you schedule jobs, track technician GPS in real-time, generate invoices, create proposals, and seamlessly pass jobs to partner businesses through our B2B Contractor Marketplace."
      },
      {
        question: "Is there a mobile app?",
        answer: "Yes! TekTrakker is built as a Progressive Web App (PWA) with native Capacitor support. Both field technicians and customers can install it directly on their phones for offline capabilities, push notifications, and GPS tracking."
      },
      {
        question: "Is my data secure?",
        answer: "Absolutely. We secure all sensitive customer and payment data using industry-standard AES encryption. We also maintain a comprehensive Compliance Registry to ensure your internal operations align with trade standards."
      }
    ]
  },
  {
    category: 'Field Operations',
    questions: [
      {
        question: "How does the geofenced time tracking work?",
        answer: "Our mobile app utilizes your device's background GPS to automatically punch technicians in and out when they cross a geofence radius around the customer's site. This guarantees accurate payroll without any manual entry."
      },
      {
        question: "What is Kiosk Mode?",
        answer: "Kiosk Mode is a feature designed for warehouse workers, apprentices, or shop staff who don't have their own device login. You can set up a tablet in the breakroom, and staff can clock in or out securely using their unique 4-digit PIN."
      },
      {
        question: "Can technicians generate quotes in the field?",
        answer: "Yes, our AI-powered estimating tool allows technicians to instantly generate beautiful Good, Better, and Best options for the customer while standing in their living room. Once the customer signs digitally, it instantly syncs to the back office."
      }
    ]
  },
  {
    category: 'The Consumer Vault & Marketing',
    questions: [
      {
        question: "What is the Consumer Vault?",
        answer: "The Consumer Vault is a free homeowner portal that acts as a digital filing cabinet for your customers. They can log in to view past service reports, operating manuals, warranties, and easily request new service from you with one tap."
      },
      {
        question: "Do you really provide free leads?",
        answer: "Yes! Because we host the Consumer Vault, homeowners often look for specialized trade pros in their area. We distribute these high-quality, local leads directly to your dispatch board with zero ad spend or per-lead fees attached."
      }
    ]
  },
  {
    category: 'Billing & Subcontracting',
    questions: [
      {
        question: "How does the B2B Contractor Marketplace work?",
        answer: "If you're booked out for 3 weeks but still receiving calls, you can push those jobs to a trusted Partner Organization within TekTrakker. Or, you can hire subcontractors and let them use the app to log notes directly to your customer's job file."
      },
      {
        question: "Can I manage 1099s through the platform?",
        answer: "We offer a flexible Document Creator that connects your subcontractor network to dynamic forms. While we don't file the taxes directly, we aggregate all custom payments so you can generate perfect 1099 statements internally."
      },
      {
        question: "What is the fee for the Contractor Bid Network?",
        answer: "There are no upfront fees to join the network. When you successfully complete a job passed to you by a partner, a small platform commission is automatically deducted from the final invoice, ensuring everyone wins."
      }
    ]
  },
  {
    category: 'AI & Automation',
    questions: [
      {
        question: "What is the AI Omni-Channel Marketing tool?",
        answer: "Our AI Marketing engine automatically formats your project photos and descriptions into perfect social media posts for Facebook, Instagram, and LinkedIn. It even schedules them for peak engagement times with one click."
      },
      {
        question: "How accurate is the AI Estimating?",
        answer: "The AI learns from your specific business history. It analyzes past win rates and material costs to suggest the most profitable 'Good, Better, Best' tiers, helping technicians close bigger deals more consistently."
      }
    ]
  },
  {
    category: 'Franchising & Licensing',
    questions: [
      {
        question: "Can I white-label TekTrakker for my own franchise?",
        answer: "Yes! We offer a full PAAS (Platform as a Service) license. You can run the entire system on your own custom domain with your own branding, colors, and logos. We handle the heavy engineering while you focus on growing your network."
      },
      {
        question: "What is the 'Default Clause' in the franchise agreement?",
        answer: "To ensure platform stability and brand protection, we require timely subscription payments. If an organization falls significantly behind, the system may automatically revert end-user data to the master admin to ensure customer service continuity."
      }
    ]
  },
  {
    category: 'Security & Compliance',
    questions: [
      {
        question: "Is TekTrakker HIPAA or SOC2 compliant?",
        answer: "We are currently SOC2 Type 1 compliant and are in the process of auditing for SOC2 Type 2. We employ rigorous data segregation and encryption-at-rest for all PII (Personally Identifiable Information)."
      },
      {
        question: "Who owns my customer data?",
        answer: "You do. 100%. TekTrakker acts as a data processor. You can export your data in various formats (CSV, JSON, PDF) at any time. We never sell or share your data with third-party marketing companies."
      }
    ]
  }
];

const FAQAccordion: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-5 text-left hover:bg-slate-50 transition-colors focus:outline-none"
      >
        <h3 className="text-lg font-bold text-slate-900 pr-4">{question}</h3>
        <div className={`shrink-0 text-primary-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={20} />
        </div>
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-5 pt-0 text-slate-600 leading-relaxed border-t border-slate-100 mt-2 font-medium">
          {answer}
        </div>
      </div>
    </div>
  );
};


export default function FAQ() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-primary-500/30 selection:text-primary-900">
      <LandingHeader 
        backButton={{ label: 'Back to Home', href: '/' }}
      />

      {/* Header */}
      <header className="pt-40 pb-20 px-6 relative overflow-hidden bg-white border-b border-slate-200">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary-500/10 blur-[120px] rounded-[100%]" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-sm font-bold mb-8 animate-fade-in [animation-duration:1s]">
            <HelpCircle size={16} /> FAQ Center
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-8 animate-fade-in leading-tight [animation-delay:100ms] [animation-fill-mode:both]">
            Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-indigo-600">Questions</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-8 font-medium animate-fade-in [animation-delay:150ms] [animation-fill-mode:both]">
            Everything you need to know about setting up and running your field service business on TekTrakker.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-24 relative z-10">
        <div className="space-y-16">
          {FAQS.map((category, catIdx) => (
            <section 
              key={catIdx} 
              className="animate-fade-in [animation-fill-mode:both]"
            >
              <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-4">
                <span className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-black border border-indigo-200">
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

      <LandingFooter />
    </div>
  );
}
