import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowLeft, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

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
      }
    ]
  }
];

const FAQAccordion: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-white/10 rounded-xl bg-white/5 overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-5 text-left hover:bg-white/5 transition-colors focus:outline-none"
      >
        <h3 className="text-lg font-medium text-white pr-4">{question}</h3>
        <div className={`shrink-0 text-sky-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={20} />
        </div>
      </button>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-5 pt-0 text-slate-400 leading-relaxed border-t border-white/5 mt-2">
          {answer}
        </div>
      </div>
    </div>
  );
};

const FAQ: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform shadow-[0_0_20px_rgba(14,165,233,0.3)]">
                  <span className="text-white font-black text-xl tracking-tighter">T</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">TekTrakker</span>
          </Link>
          <div className="flex gap-4">
              <Link to="/" className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                  <ArrowLeft size={16} /> Back to Home
              </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="pt-40 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-sky-500/20 blur-[120px] rounded-[100%] pointer-events-none" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sky-400 text-sm font-medium mb-6 animate-fade-in-up">
            <HelpCircle size={16} /> FAQ Center
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6 animate-fade-in-up" style={{animationDelay: '100ms'}}>
            Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-500">Questions</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 leading-relaxed mb-8 animate-fade-in-up" style={{animationDelay: '150ms'}}>
            Everything you need to know about setting up and running your field service business on TekTrakker.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pb-24 relative z-10">
        <div className="space-y-16">
          {FAQS.map((category, catIdx) => (
            <section key={catIdx} className="animate-fade-in-up" style={{animationDelay: `${200 + (catIdx * 100)}ms`}}>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-black border border-indigo-500/30">
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

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/5 py-12 px-6 relative z-10 w-full">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center -rotate-6">
                      <span className="text-white font-black text-sm">T</span>
                  </div>
                  <span className="text-slate-400 font-semibold text-sm">© 2026 TekTrakker Inc.</span>
              </div>
              <div className="flex gap-6 text-sm text-slate-500">
                  <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                  <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
                  <a href="https://app.tektrakker.com/login" className="hover:text-white transition-colors">Sign In</a>
              </div>
          </div>
      </footer>
    </div>
  );
};

export default FAQ;
