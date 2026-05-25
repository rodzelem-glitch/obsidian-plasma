"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, DollarSign, Smartphone, FileText, Award, MapPin, 
  TrendingUp, Users, Share2, Wand2, Bot, Activity, ShieldAlert, 
  PhoneCall, Mail, Plus, Trash, Play, Check, RotateCcw, 
  MessageSquare, Clock, ArrowRight, Shield, AlertTriangle, 
  Eye, Send, Search, Volume2, Sparkles, AlertCircle, Trash2,
  ChevronRight, Award as RibbonIcon
} from 'lucide-react';

export function FeatureVisualizer({ slug }: { slug: string }) {
  // --- 1. SCHEDULING & DISPATCH STATE ---
  const [scheduledTech, setScheduledTech] = useState<string | null>(null);
  const [schedulingSuccess, setSchedulingSuccess] = useState(false);

  // --- 2. INVOICING & PAYMENTS STATE ---
  const [invoiceItems, setInvoiceItems] = useState([
    { id: 1, name: 'AC Maintenance Fee', price: 85, selected: true },
    { id: 2, name: 'Dual Run Capacitor', price: 145, selected: false },
    { id: 3, name: 'R-410A Refrigerant (2 lbs)', price: 180, selected: false },
    { id: 4, name: 'Labor Charge (1.5 Hours)', price: 150, selected: false },
  ]);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  // --- 3. MOBILE APP STATE ---
  const [mobileStep, setMobileStep] = useState(1);
  const [mobileTimer, setMobileTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);

  // --- 4. ESTIMATING STATE ---
  const [selectedTier, setSelectedTier] = useState<'good' | 'better' | 'best'>('better');
  const [tierOptions, setTierOptions] = useState({
    warranty: false,
    maintenance: false,
  });
  const [proposalAccepted, setProposalAccepted] = useState(false);
  const [signatureText, setSignatureText] = useState('');

  // --- 5. MEMBERSHIPS STATE ---
  const [membershipTier, setMembershipTier] = useState<'bronze' | 'silver' | 'gold'>('silver');

  // --- 6. GEOFENCED TIMECARD STATE ---
  const [truckPos, setTruckPos] = useState(10); // 10% to 90%
  const [geofenceStatus, setGeofenceStatus] = useState<'idle' | 'driving' | 'inside'>('idle');

  // --- 7. ANALYTICS STATE ---
  const [analyticsMetric, setAnalyticsMetric] = useState<'revenue' | 'techs' | 'roi'>('revenue');

  // --- 8. CLIENT CRM STATE ---
  const [crmQuery, setCrmQuery] = useState('');
  const [selectedCrmClient, setSelectedCrmClient] = useState<string | null>('John Smith');
  const [crmNotes, setCrmNotes] = useState([
    { date: '2026-05-10', tech: 'Sarah Jenkins', note: 'Replaced AC compressor fan blades' },
    { date: '2026-04-12', tech: 'David Carter', note: 'Flushed condensate drainage blockages' }
  ]);
  const [newCrmNote, setNewCrmNote] = useState('');

  // --- 9. BID NETWORK STATE ---
  const [bidState, setBidState] = useState<'idle' | 'broadcasting' | 'received' | 'accepted'>('idle');
  const [receivedBids, setReceivedBids] = useState<any[]>([]);

  // --- 10. AI OMNI MARKETING STATE ---
  const [marketingJob, setMarketingJob] = useState('ac-replace');
  const [marketingPlatform, setMarketingPlatform] = useState<'fb' | 'insta' | 'google'>('fb');
  const [isMarketingApproved, setIsMarketingApproved] = useState(false);

  // --- 11. AI ESTIMATING STATE ---
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiEstimatingState, setAiEstimatingState] = useState<'idle' | 'thinking' | 'done'>('idle');
  const [aiEstimateItems, setAiEstimateItems] = useState<any[]>([]);

  // --- 12. VIRTUAL WORKER STATE ---
  const [vwChat, setVwChat] = useState<any[]>([
    { sender: 'client', text: 'Hi! Do you have any plumbers available tomorrow morning?' }
  ]);
  const [vwState, setVwState] = useState<'awaiting' | 'replied' | 'booked'>('awaiting');

  // --- 13. ANTIGRAVITY AI STATE ---
  const [antigravityPrompt, setAntigravityPrompt] = useState<'inefficiencies' | 'error' | null>(null);
  const [isAntigravityRunning, setIsAntigravityRunning] = useState(false);

  // --- 14. OSHA REMINDERS STATE ---
  const [oshaHazards, setOshaHazards] = useState({
    voltage: false,
    attic: false,
    gas: false,
  });
  const [oshaAcknowledged, setOshaAcknowledged] = useState<Record<string, boolean>>({});

  // --- 15. RINGCENTRAL TELEPHONY STATE ---
  const [dialedDigits, setDialedDigits] = useState('');
  const [rcCallState, setRcCallState] = useState<'idle' | 'ringing' | 'connected'>('idle');
  const [rcTab, setRcTab] = useState<'dial' | 'sms'>('dial');
  const [smsChat, setSmsChat] = useState([
    { sender: 'client', text: 'Hey Roderick, is the tech still coming at 2 PM today?' },
    { sender: 'you', text: 'Yes, Tech Dave is finishing his current job and will be there exactly at 2 PM.' }
  ]);
  const [newSms, setNewSms] = useState('');

  // --- 16. DRIP EMAIL STATE ---
  const [dripWaitDays, setDripWaitDays] = useState(2);
  const [selectedDripTemplate, setSelectedDripTemplate] = useState<'followup' | 'review' | 'seasonal'>('followup');

  // --- 17. CUSTOM TOOLS MARKETPLACE STATE ---
  const [customFields, setCustomFields] = useState([
    { id: 1, type: 'text', label: 'Equipment Model Number' },
    { id: 2, type: 'photo', label: 'Before Repair Photo' }
  ]);
  const [publishedToolName, setPublishedToolName] = useState('Standard HVAC Diagnostic Tool');
  const [isToolPublished, setIsToolPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);


  // --- APP-TIMER FOR FIELD APP ---
  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setMobileTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- INVOICING CALCULATOR ---
  const invoiceSubtotal = invoiceItems.filter(i => i.selected).reduce((sum, item) => sum + item.price, 0);
  const invoiceTax = invoiceSubtotal * 0.0825;
  const invoiceTotal = invoiceSubtotal + invoiceTax;

  const handleToggleInvoiceItem = (id: number) => {
    setInvoiceItems(invoiceItems.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const handlePayInvoice = () => {
    setPaymentStatus('processing');
    setTimeout(() => {
      setPaymentStatus('success');
    }, 1500);
  };

  // --- FIELD APP ACTIONS ---
  const handleMobilePhotoUpload = () => {
    setPhotoProgress(10);
    const interval = setInterval(() => {
      setPhotoProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setPhotoUploaded(true);
          return 100;
        }
        return prev + 15;
      });
    }, 200);
  };

  // --- ESTIMATING CALCULATOR ---
  const tierPrices = { good: 4200, better: 6500, best: 9800 };
  let basePrice = tierPrices[selectedTier];
  if (tierOptions.warranty) basePrice += 500;
  if (tierOptions.maintenance) basePrice += 228; // $19 * 12

  // --- GEOFENCE ANIMATION ---
  const handleDriveTruck = () => {
    if (geofenceStatus === 'inside') {
      setTruckPos(10);
      setGeofenceStatus('idle');
      return;
    }
    setGeofenceStatus('driving');
    let pos = 10;
    const interval = setInterval(() => {
      pos += 4;
      setTruckPos(pos);
      if (pos >= 76) {
        clearInterval(interval);
        setGeofenceStatus('inside');
      }
    }, 100);
  };

  // --- BID NETWORK ACTION ---
  const handleBroadcastBid = () => {
    setBidState('broadcasting');
    setReceivedBids([]);
    setTimeout(() => {
      setReceivedBids([
        { id: 1, name: 'Apex Plumbing Inc.', rating: '4.9', bid: 720, eta: '30 mins' }
      ]);
    }, 1200);
    setTimeout(() => {
      setReceivedBids(prev => [
        ...prev,
        { id: 2, name: 'QuickFlow Sewer & Drain', rating: '4.6', bid: 680, eta: '1 hr' }
      ]);
    }, 2400);
    setTimeout(() => {
      setReceivedBids(prev => [
        ...prev,
        { id: 3, name: 'Elite Pipeline Operations', rating: '5.0', bid: 790, eta: '15 mins' }
      ]);
      setBidState('received');
    }, 3600);
  };

  // --- AI ESTIMATING ---
  const handleAiEstimate = (preset: string) => {
    setAiPrompt(preset);
    setAiEstimatingState('thinking');
    setTimeout(() => {
      if (preset.includes('HVAC')) {
        setAiEstimateItems([
          { code: 'AC-3TON-REP', desc: 'Carrier Comfort 3-Ton Split Air Conditioner Condenser', qty: 1, rate: 2950, total: 2950 },
          { code: 'COP-PIPE-15FT', desc: 'Refrigerant Copper Piping Line Set (15ft x 3/8x3/4)', qty: 1, rate: 180, total: 180 },
          { code: 'LABOR-TECH-2', desc: 'Elite Installer On-Site Labor (Dual Crew)', qty: 6, rate: 125, total: 750 },
          { code: 'PERMIT-HVAC', desc: 'City Structural HVAC Permitting & Compliance', qty: 1, rate: 150, total: 150 },
        ]);
      } else {
        setAiEstimateItems([
          { code: 'PLUMB-MAIN-R', desc: 'Sewer Line Pipe Replacement (SDR-35 PVC High Durability)', qty: 10, rate: 85, total: 850 },
          { code: 'COP-FIT-MAIN', desc: 'Heavy Duty Lead-Free Copper Adaptors & Couplings', qty: 4, rate: 35, total: 140 },
          { code: 'LABOR-PLUMB', desc: 'Licensed Master Plumber Field Labor', qty: 3, rate: 160, total: 480 },
        ]);
      }
      setAiEstimatingState('done');
    }, 1800);
  };

  // --- VIRTUAL WORKER BOOKING ---
  const handleVwBook = () => {
    setVwChat(prev => [
      ...prev,
      { sender: 'you', text: 'I would like to book the 9:00 AM slot with Tech Sarah.' },
      { sender: 'worker', text: 'Excellent choice! I have booked Tech Sarah for tomorrow at 9:00 AM. A calendar invitation and secure dispatch SMS confirmation have been sent to you!' }
    ]);
    setVwState('booked');
  };

  // --- ANTIGRAVITY AI ACTION ---
  const handleAntigravityTrigger = (type: 'inefficiencies' | 'error') => {
    setAntigravityPrompt(type);
    setIsAntigravityRunning(true);
    setTimeout(() => {
      setIsAntigravityRunning(false);
    }, 2000);
  };

  // --- RINGCENTRAL SYSTEM ---
  const handleDialClick = (digit: string) => {
    setDialedDigits(prev => prev + digit);
  };

  const handleSimulateCall = () => {
    setRcCallState('ringing');
  };

  const handleAcceptCall = () => {
    setRcCallState('connected');
  };

  const handleSendSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSms.trim()) return;
    setSmsChat(prev => [...prev, { sender: 'you', text: newSms }]);
    setNewSms('');
    setTimeout(() => {
      setSmsChat(prev => [...prev, { sender: 'client', text: 'Awesome, thanks! See you soon.' }]);
    }, 1200);
  };


  return (
    <div className="w-full bg-slate-950/50 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Title / Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 relative z-10">
        <div>
          <span className="text-xs font-semibold text-primary-400 bg-primary-500/10 border border-primary-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
            Interactive visual sandbox
          </span>
          <h3 className="text-2xl font-black text-white mt-2">Try The Live Feature Simulator</h3>
        </div>
        
        {/* Reset Control */}
        <button 
          onClick={() => {
            // Full Reset
            setScheduledTech(null);
            setSchedulingSuccess(false);
            setPaymentStatus('idle');
            setInvoiceItems(items => items.map((item, idx) => ({ ...item, selected: idx === 0 })));
            setMobileStep(1);
            setMobileTimer(0);
            setIsTimerRunning(false);
            setPhotoUploaded(false);
            setPhotoProgress(0);
            setSelectedTier('better');
            setTierOptions({ warranty: false, maintenance: false });
            setProposalAccepted(false);
            setSignatureText('');
            setMembershipTier('silver');
            setTruckPos(10);
            setGeofenceStatus('idle');
            setReceivedBids([]);
            setBidState('idle');
            setIsMarketingApproved(false);
            setAiPrompt('');
            setAiEstimatingState('idle');
            setAiEstimateItems([]);
            setVwChat([{ sender: 'client', text: 'Hi! Do you have any plumbers available tomorrow morning?' }]);
            setVwState('awaiting');
            setAntigravityPrompt(null);
            setOshaHazards({ voltage: false, attic: false, gas: false });
            setOshaAcknowledged({});
            setDialedDigits('');
            setRcCallState('idle');
            setRcTab('dial');
            setNewSms('');
          }}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-2xl transition-all"
        >
          <RotateCcw size={14} /> Reset Sandbox
        </button>
      </div>

      <div className="flex-1 w-full flex items-center justify-center min-h-[360px] relative z-10">
        
        {/* ========================================================================= */}
        {/* 1. SCHEDULING & DISPATCH VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'scheduling-dispatch' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h4 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <Calendar size={16} /> Drag & Drop Fleet Dispatch Timeline
            </h4>
            
            {/* Grid Layout */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-bold text-slate-400">
                Staff
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-bold text-slate-400">
                9:00 AM
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-bold text-slate-400">
                12:00 PM
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs font-bold text-slate-400">
                3:00 PM
              </div>

              {/* Rows */}
              {['Tech Bob', 'Tech Dave', 'Tech Sarah'].map((tech) => (
                <React.Fragment key={tech}>
                  <div className="bg-slate-900 border border-slate-800/50 rounded-xl p-3 text-left text-xs font-bold text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> {tech}
                  </div>
                  {['9:00 AM', '12:00 PM', '3:00 PM'].map((time) => {
                    const isBooked = scheduledTech === `${tech}-${time}`;
                    return (
                      <button
                        key={time}
                        disabled={schedulingSuccess}
                        onClick={() => {
                          setScheduledTech(`${tech}-${time}`);
                          setSchedulingSuccess(true);
                        }}
                        className={`border rounded-xl p-2 text-[10px] min-h-[44px] transition-all flex flex-col items-center justify-center ${
                          isBooked 
                            ? 'bg-blue-600 border-blue-500 text-white font-bold animate-pulse'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 text-slate-500'
                        }`}
                      >
                        {isBooked ? (
                          <div className="flex flex-col items-center">
                            <span className="font-extrabold text-[9px] uppercase tracking-wide">Emergency Leak</span>
                            <span className="text-[8px] opacity-75">Scheduled</span>
                          </div>
                        ) : (
                          <span>+ Assign Here</span>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Pending jobs area */}
            {!schedulingSuccess ? (
              <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center rounded-xl font-black">
                    🚨
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-white">Emergency Pipe Leak Repair</p>
                    <p className="text-[10px] text-slate-400">Austin Country Club Region • $450 Est.</p>
                  </div>
                </div>
                <div className="text-xs font-bold text-blue-400 animate-bounce">
                  ← Click any calendar slot to assign job!
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold">
                  <Check size={20} />
                </div>
                <div>
                  <h5 className="text-sm font-black text-white">Job Dispatched Successfully!</h5>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Notification pushed to {scheduledTech?.split('-')[0]}. Client text notification dispatched.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. INVOICING & PAYMENTS VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'invoicing-payments' && (
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3">
              <DollarSign size={16} /> Live In-Field Invoice Estimator
            </h4>

            {/* Checkbox item options */}
            <div className="flex flex-col gap-2">
              {invoiceItems.map((item) => (
                <label 
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    item.selected 
                      ? 'bg-slate-950 border-emerald-500/40 text-white' 
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={item.selected}
                      disabled={paymentStatus !== 'idle'}
                      onChange={() => handleToggleInvoiceItem(item.id)}
                      className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
                    />
                    <span className="text-xs font-bold">{item.name}</span>
                  </div>
                  <span className="text-xs font-black">${item.price.toFixed(2)}</span>
                </label>
              ))}
            </div>

            {/* Summary math block */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60 text-xs flex flex-col gap-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span>${invoiceSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Sales Tax (8.25%)</span>
                <span>${invoiceTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-black border-t border-slate-800 pt-2 text-sm">
                <span>Total Balance</span>
                <span className="text-emerald-400">${invoiceTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Pay buttons */}
            {paymentStatus === 'idle' && (
              <button
                disabled={invoiceSubtotal === 0}
                onClick={handlePayInvoice}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                <Smartphone size={16} /> Process Card/Wallet Payment
              </button>
            )}

            {paymentStatus === 'processing' && (
              <button
                disabled
                className="w-full h-12 rounded-xl bg-emerald-850 text-slate-300 font-bold text-sm flex items-center justify-center gap-3"
              >
                <div className="w-5 h-5 rounded-full border-2 border-slate-400 border-t-white animate-spin" />
                Encrypting Token & Authorizing Fund Split...
              </button>
            )}

            {paymentStatus === 'success' && (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold mx-auto mb-2">
                  <Check size={20} />
                </div>
                <h5 className="text-sm font-black text-white">Payment Authorized Successfully!</h5>
                <p className="text-[10px] text-slate-400 mt-1">
                  Receipt #TT-94921 dispatched via transactional email/SMS. Financial books synced with QuickBooks Online.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. FIELD SERVICE APP VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'field-service-app' && (
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[32px] p-4 shadow-2xl relative">
            {/* Phone Ear Piece / Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-950 rounded-full flex items-center justify-center">
              <div className="w-8 h-1 bg-slate-800 rounded-full" />
            </div>

            <div className="w-full bg-slate-950 rounded-[24px] overflow-hidden pt-6 pb-4 px-4 border border-slate-800 text-left">
              {/* Internal Screen Header */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                <div className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                  <Smartphone size={10} className="text-sky-500" /> TekTrakker Tech Mobile
                </div>
                <div className="text-[9px] font-bold text-sky-500 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 uppercase tracking-widest">
                  Active
                </div>
              </div>

              {/* Steps Navigation Content */}
              {mobileStep === 1 && (
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Current Dispatch</span>
                    <h5 className="text-xs font-black text-white mt-0.5">AC Compression Failure</h5>
                    <p className="text-[10px] text-slate-400 mt-1">123 Maple Avenue, Westlake TX</p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setMobileStep(2);
                      setIsTimerRunning(true);
                    }}
                    className="w-full h-11 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <Play size={12} fill="white" /> Start Driving (Notify Client)
                  </button>
                </div>
              )}

              {mobileStep === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Driving En Route</span>
                      <h5 className="text-xs font-black text-white mt-0.5">ETA: 4 minutes</h5>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  </div>

                  <button
                    onClick={() => setMobileStep(3)}
                    className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <MapPin size={12} /> Confirm On-Site (Clock-in)
                  </button>
                </div>
              )}

              {mobileStep === 3 && (
                <div className="flex flex-col gap-3">
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-500 uppercase">On-Site Work Session</span>
                      <h5 className="text-xs font-black text-white mt-0.5">Diagnosing Air Handler</h5>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      <Clock size={10} className="text-emerald-500" /> {formatTime(mobileTimer)}
                    </div>
                  </div>

                  {/* Photo upload mock */}
                  {!photoUploaded ? (
                    <button
                      onClick={handleMobilePhotoUpload}
                      disabled={photoProgress > 0}
                      className="w-full h-11 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-slate-400 hover:border-slate-700 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                    >
                      {photoProgress > 0 ? (
                        <span>Uploading Diagnostic Photo ({photoProgress}%)</span>
                      ) : (
                        <>
                          <Share2 size={12} /> Click to Upload Repair Photo
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-950 flex items-center justify-center text-lg border border-slate-800">
                        ❄️
                      </div>
                      <div className="text-[10px]">
                        <p className="font-bold text-white">compressor_intake.jpg</p>
                        <p className="text-emerald-500 flex items-center gap-0.5 mt-0.5">
                          <Check size={8} /> Saved & Synced (Offline cache OK)
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setIsTimerRunning(false);
                      setMobileStep(4);
                    }}
                    className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-black text-xs transition-all flex items-center justify-center gap-2"
                  >
                    Complete Job Order
                  </button>
                </div>
              )}

              {mobileStep === 4 && (
                <div className="text-center py-4 flex flex-col items-center">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center rounded-2xl mb-3">
                    <Check size={24} />
                  </div>
                  <h5 className="text-sm font-black text-white">Job Finalized!</h5>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                    Total labor duration: {formatTime(mobileTimer)}. Timesheets synchronized, diagnostic reports compiled.
                  </p>
                  
                  <button
                    onClick={() => {
                      setMobileStep(1);
                      setMobileTimer(0);
                      setPhotoUploaded(false);
                      setPhotoProgress(0);
                    }}
                    className="mt-4 text-[10px] text-sky-400 hover:text-sky-300 font-bold border-b border-sky-400/20"
                  >
                    Simulate Another Run
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. ESTIMATING & PROPOSALS VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'estimating-proposals' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <FileText size={16} /> Interactive Good-Better-Best Sales Proposal
            </h4>

            {!proposalAccepted ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {[
                  { key: 'good', name: 'Good (Standard)', price: 4200, desc: 'Single-stage condenser, 1-yr system warranty coverage.' },
                  { key: 'better', name: 'Better (Comfort)', price: 6500, desc: 'Two-stage high-efficiency AC, 5-yr warranty, WiFi smart thermostat.' },
                  { key: 'best', name: 'Best (Premium)', price: 9800, desc: 'Variable capacity system, 10-yr warranty, smart thermostat, whole-house filter.' }
                ].map((tier) => {
                  const isActive = selectedTier === tier.key;
                  return (
                    <button
                      key={tier.key}
                      onClick={() => setSelectedTier(tier.key as any)}
                      className={`rounded-xl border p-4 text-left transition-all flex flex-col justify-between min-h-[160px] ${
                        isActive 
                          ? 'bg-slate-950 border-pink-500 text-white shadow-lg shadow-pink-500/5' 
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <h5 className={`text-xs font-black ${isActive ? 'text-pink-400' : 'text-slate-300'}`}>{tier.name}</h5>
                        <p className="text-[10px] text-slate-400 mt-2 leading-normal">{tier.desc}</p>
                      </div>
                      <p className="text-base font-black mt-4 text-white">${tier.price.toLocaleString()}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-pink-950/20 border border-pink-500/30 rounded-xl p-6 text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-extrabold mx-auto mb-3 animate-bounce">
                  <Check size={24} />
                </div>
                <h5 className="text-base font-black text-white">Proposal Signed & Approved!</h5>
                <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                  Option: <span className="font-bold text-pink-400 uppercase">{selectedTier}</span> accepted for total of{' '}
                  <span className="font-extrabold text-white">${basePrice.toLocaleString()}</span>. Signature verified: "{signatureText || 'Customer Signed'}".
                </p>
              </div>
            )}

            {!proposalAccepted && (
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={tierOptions.warranty}
                      onChange={(e) => setTierOptions({ ...tierOptions, warranty: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-pink-500 focus:ring-pink-500/20 w-4 h-4"
                    />
                    Add Lifetime Extended Warranty (+$500)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={tierOptions.maintenance}
                      onChange={(e) => setTierOptions({ ...tierOptions, maintenance: e.target.checked })}
                      className="rounded border-slate-800 bg-slate-950 text-pink-500 focus:ring-pink-500/20 w-4 h-4"
                    />
                    Add 1-Yr Preventative Maintenance Plan (+$19/mo)
                  </label>
                </div>

                <div className="flex flex-col items-end w-full md:w-auto">
                  <span className="text-[10px] font-bold text-slate-500">DYNAMIC PROPOSAL TOTAL</span>
                  <span className="text-xl font-black text-white mt-0.5">${basePrice.toLocaleString()}</span>
                </div>
              </div>
            )}

            {!proposalAccepted && (
              <div className="mt-4 flex flex-col md:flex-row gap-3">
                <input 
                  type="text"
                  placeholder="Type Full Name to Authorize..."
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  className="flex-1 h-12 bg-slate-950 border border-slate-800 rounded-xl px-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 transition-colors"
                />
                <button
                  disabled={!signatureText.trim()}
                  onClick={() => setProposalAccepted(true)}
                  className="h-12 px-6 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Accept & Sign Proposal <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. SERVICE AGREEMENTS (MEMBERSHIPS) VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'service-agreements' && (
          <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center text-left">
            {/* Control Panel */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                <Award size={16} /> Select Membership Tier
              </h4>

              {['bronze', 'silver', 'gold'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setMembershipTier(tier as any)}
                  className={`flex justify-between items-center p-3 rounded-xl border transition-all text-left ${
                    membershipTier === tier
                      ? 'bg-slate-900 border-red-500/40 text-white font-black'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                      membershipTier === tier ? 'border-red-500 bg-red-500' : 'border-slate-800'
                    }`} />
                    <span className="text-xs font-black uppercase">{tier} Membership</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-400">
                    {tier === 'bronze' ? '$15/mo' : tier === 'silver' ? '$29/mo' : '$49/mo'}
                  </span>
                </button>
              ))}
            </div>

            {/* Display Card Mockup */}
            <div className="flex justify-center">
              <div className={`w-72 aspect-[1.58/1] rounded-2xl p-5 relative overflow-hidden shadow-2xl border transition-all duration-500 flex flex-col justify-between text-white bg-gradient-to-br ${
                membershipTier === 'bronze' 
                  ? 'from-amber-900/60 via-amber-950/40 to-slate-950 border-amber-900/40 shadow-amber-950/10'
                  : membershipTier === 'silver'
                  ? 'from-slate-700/60 via-slate-800/40 to-slate-950 border-slate-700/40 shadow-slate-900/10'
                  : 'from-amber-400/20 via-yellow-600/10 to-slate-950 border-amber-500/30 shadow-amber-500/5'
              }`}>
                {/* Shiny reflex overlay */}
                <div className="absolute top-0 left-0 w-full h-[50%] bg-white/5 skew-y-12 pointer-events-none transform -translate-y-8" />

                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TekTrakker Member</h5>
                    <p className={`text-lg font-black mt-0.5 tracking-tight uppercase ${
                      membershipTier === 'gold' ? 'text-amber-400' : 'text-white'
                    }`}>{membershipTier} Club</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-900/60 border border-slate-800/80 flex items-center justify-center font-bold text-xs">
                    🏆
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">EXCLUSIVE PRIVILEGES</div>
                  <div className="flex flex-col gap-0.5 mt-1.5">
                    {membershipTier === 'bronze' && (
                      <>
                        <span className="text-[10px] font-bold text-slate-200 flex items-center gap-1"><Check size={8} /> 5% Off Any Service Invoices</span>
                        <span className="text-[10px] font-bold text-slate-200 flex items-center gap-1"><Check size={8} /> 1 Annual AC/Heat System Tuning</span>
                      </>
                    )}
                    {membershipTier === 'silver' && (
                      <>
                        <span className="text-[10px] font-bold text-slate-200 flex items-center gap-1"><Check size={8} /> 10% Off Any Service Invoices</span>
                        <span className="text-[10px] font-bold text-slate-200 flex items-center gap-1"><Check size={8} /> 2 Annual Comprehensive Tuning Reviews</span>
                        <span className="text-[10px] font-bold text-slate-200 flex items-center gap-1"><Check size={8} /> Waived Emergency Trip Surcharges</span>
                      </>
                    )}
                    {membershipTier === 'gold' && (
                      <>
                        <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1"><Check size={8} /> 15% Off Any Service Invoices</span>
                        <span className="text-[10px] font-bold text-slate-200 flex items-center gap-1"><Check size={8} /> 2 Comprehensive Tuning Audits + 1 Plumbing</span>
                        <span className="text-[10px] font-bold text-slate-200 flex items-center gap-1"><Check size={8} /> Guaranteed Priority 4-Hr Dispatch SLA</span>
                        <span className="text-[10px] font-bold text-slate-200 flex items-center gap-1"><Check size={8} /> Extended Lifetime Warranty on Parts</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. GEOFENCED TIMECARD VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'geofenced-time-tracking' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
              <MapPin size={16} /> Passthrough Geofence Timecard Automation
            </h4>

            {/* Visual Block neighborhood */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative min-h-[160px] overflow-hidden flex items-center justify-between mb-6">
              
              {/* Geofence Ring around customer */}
              <div className="absolute right-12 w-32 h-32 rounded-full border-2 border-dashed border-orange-500/40 flex items-center justify-center bg-orange-500/5 animate-pulse">
                <span className="text-[8px] font-extrabold text-orange-500/60 uppercase tracking-widest absolute top-2">Geofence Boundary</span>
              </div>

              {/* Road lane line */}
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-dashed border-t border-slate-800/80 -translate-y-1/2 z-0" />

              {/* Truck Marker pin */}
              <div 
                style={{ left: `${truckPos}%` }}
                className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-10 flex flex-col items-center gap-1 cursor-pointer"
              >
                <div className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[8px] font-extrabold text-white uppercase whitespace-nowrap">
                  Tech Dave (Truck #4)
                </div>
                <div className="text-2xl animate-bounce">
                  🚚
                </div>
              </div>

              {/* Customer House */}
              <div className="relative z-10 flex flex-col items-center gap-1 right-2">
                <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-xl shadow-lg">
                  🏠
                </div>
                <span className="text-[9px] font-bold text-slate-400">123 Maple St</span>
              </div>
            </div>

            {/* Controls and feedback */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <button
                onClick={handleDriveTruck}
                disabled={geofenceStatus === 'driving'}
                className="w-full md:w-auto h-12 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2"
              >
                <Play size={12} fill="white" />
                {geofenceStatus === 'idle' && 'Simulate Dispatch Drive'}
                {geofenceStatus === 'driving' && 'Moving along route...'}
                {geofenceStatus === 'inside' && 'Reset Simulation Position'}
              </button>

              <div className="text-right">
                {geofenceStatus === 'idle' && (
                  <span className="text-xs font-bold text-slate-500">State: Stationary (Off-duty)</span>
                )}
                {geofenceStatus === 'driving' && (
                  <span className="text-xs font-bold text-amber-500 animate-pulse">State: En Route (GPS Monitoring Active)</span>
                )}
                {geofenceStatus === 'inside' && (
                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl px-4 py-2 text-left flex items-center gap-2">
                    <Check size={14} className="text-emerald-500" />
                    <div>
                      <span className="text-xs font-black text-white">Auto-Clocked In!</span>
                      <p className="text-[9px] text-slate-400">Arrived in geofence. Job card marked 'On-Site' automatically.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 7. ANALYTICS & REPORTING VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'analytics-reporting' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
              <TrendingUp size={16} /> Real-Time Operations Analytics Platform
            </h4>

            {/* Metric Tab Selector */}
            <div className="flex gap-2 mb-6">
              {[
                { key: 'revenue', name: 'Sales Growth' },
                { key: 'techs', name: 'Technician Leaderboard' },
                { key: 'roi', name: 'Lead Acquisition ROI' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAnalyticsMetric(tab.key as any)}
                  className={`px-4 py-2 text-xs font-black rounded-xl border transition-all ${
                    analyticsMetric === tab.key
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* Display Graph Context */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 min-h-[160px] flex flex-col justify-between">
              {analyticsMetric === 'revenue' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400">Total Revenue YTD</span>
                    <span className="text-base font-black text-white">$142,880.00 <span className="text-xs text-emerald-400">(+22.4%)</span></span>
                  </div>
                  {/* Dynamic SVG Line Graph */}
                  <svg className="w-full h-20 mt-4 text-purple-500 overflow-visible" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path 
                      d="M0,18 Q15,16 30,12 T60,8 T90,3 T100,0" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                    />
                    <path 
                      d="M0,18 Q15,16 30,12 T60,8 T90,3 T100,0 L100,20 L0,20 Z" 
                      fill="url(#purpleGlow)" 
                    />
                    <defs>
                      <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="flex justify-between text-[8px] font-bold text-slate-500 mt-2">
                    <span>JAN</span>
                    <span>FEB</span>
                    <span>MAR</span>
                    <span>APR</span>
                    <span>MAY</span>
                  </div>
                </div>
              )}

              {analyticsMetric === 'techs' && (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-slate-400 block border-b border-slate-900 pb-2">Completed Jobs & Ticket Size Average</span>
                  {[
                    { name: 'Sarah Jenkins', completed: 42, size: '$480 avg', pct: 90 },
                    { name: 'David Carter', completed: 36, size: '$420 avg', pct: 75 },
                    { name: 'Roderick Stone', completed: 32, size: '$540 avg', pct: 68 }
                  ].map((tech) => (
                    <div key={tech.name} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-300">
                        <span>{tech.name} <span className="opacity-55">({tech.completed} jobs)</span></span>
                        <span>{tech.size}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div style={{ width: `${tech.pct}%` }} className="h-full bg-purple-500 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analyticsMetric === 'roi' && (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-bold text-slate-400 block border-b border-slate-900 pb-2">Advertising Channels ROI Multiplier</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-500">Google Local Services</p>
                      <h5 className="text-lg font-black text-emerald-400 mt-1">4.8x</h5>
                      <span className="text-[8px] text-slate-400">High Conversion</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-500">Facebook Local Ads</p>
                      <h5 className="text-lg font-black text-emerald-400 mt-1">3.2x</h5>
                      <span className="text-[8px] text-slate-400">Brand Awareness</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-500">Local Paper Mailers</p>
                      <h5 className="text-lg font-black text-amber-500 mt-1">1.8x</h5>
                      <span className="text-[8px] text-slate-400">Steady Volume</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 8. CLIENT CRM & EQUIPMENT HISTORY VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'client-management-crm' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <Users size={16} /> Searchable CRM Record & Equipment Files
            </h4>

            {/* Mock Client Query Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              <input 
                type="text"
                placeholder="Search CRM by Client Name or Equipment Serial..."
                value={crmQuery}
                onChange={(e) => setCrmQuery(e.target.value)}
                className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            {/* Record results list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: 'John Smith', address: '123 Maple St', phone: '512-555-0199', serial: 'RH-99882' },
                { name: 'Alice Cooper', address: '456 Oak Lane', phone: '512-555-0144', serial: 'CAR-88221' },
                { name: 'Sarah Connor', address: '789 Pine Drive', phone: '512-555-0122', serial: 'RHE-77112' }
              ].filter(c => c.name.toLowerCase().includes(crmQuery.toLowerCase()) || c.serial.toLowerCase().includes(crmQuery.toLowerCase())).map((client) => {
                const isSelected = selectedCrmClient === client.name;
                return (
                  <button
                    key={client.name}
                    onClick={() => {
                      setSelectedCrmClient(client.name);
                    }}
                    className={`border rounded-xl p-3 text-left transition-all flex flex-col justify-between min-h-[90px] ${
                      isSelected
                        ? 'bg-slate-950 border-teal-500 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <h5 className="text-xs font-black text-white">{client.name}</h5>
                      <p className="text-[9px] text-slate-500 mt-1">{client.address}</p>
                    </div>
                    <span className="text-[9px] font-bold text-teal-400 uppercase tracking-widest mt-2">{client.serial}</span>
                  </button>
                );
              })}
            </div>

            {/* Folder timeline for selected client */}
            {selectedCrmClient && (
              <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-900 pb-2 mb-3">
                  Historical Job Log: {selectedCrmClient}
                </span>

                <div className="flex flex-col gap-3 max-h-[120px] overflow-y-auto pr-2">
                  {crmNotes.map((note, idx) => (
                    <div key={idx} className="text-[10px] text-left border-l-2 border-slate-800 pl-3">
                      <div className="flex justify-between font-bold text-slate-400">
                        <span>{note.date} • {note.tech}</span>
                      </div>
                      <p className="text-slate-300 mt-1 leading-normal">{note.note}</p>
                    </div>
                  ))}
                </div>

                {/* Quick Add Note input */}
                <div className="mt-3 border-t border-slate-900 pt-3 flex gap-2">
                  <input 
                    type="text"
                    placeholder="Append new technician field entry..."
                    value={newCrmNote}
                    onChange={(e) => setNewCrmNote(e.target.value)}
                    className="flex-1 h-9 bg-slate-900 border border-slate-800 rounded-lg px-3 text-[10px] text-white focus:outline-none focus:border-teal-500"
                  />
                  <button
                    onClick={() => {
                      if (!newCrmNote.trim()) return;
                      setCrmNotes([
                        { date: new Date().toISOString().split('T')[0], tech: 'Tech Roderick (You)', note: newCrmNote },
                        ...crmNotes
                      ]);
                      setNewCrmNote('');
                    }}
                    className="h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] flex items-center justify-center"
                  >
                    Add Log
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 9. CONTRACTOR BID NETWORK VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'contractor-bid-network' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <Share2 size={16} /> B2B Contractor Capacity Bid Network
            </h4>

            {bidState === 'idle' && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[180px]">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center text-xl mb-4">
                  📡
                </div>
                <h5 className="text-sm font-black text-white">Broadcast Subcontract Request</h5>
                <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
                  Overbooked for the week? Broadcast your overflow emergency jobs to licensed network partners nearby.
                </p>
                <button
                  onClick={handleBroadcastBid}
                  className="mt-5 h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2"
                >
                  Broadcast Sewer Repair (Budget: $800) <ArrowRight size={14} />
                </button>
              </div>
            )}

            {bidState === 'broadcasting' && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[180px]">
                <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin flex items-center justify-center mb-4" />
                <h5 className="text-sm font-black text-white animate-pulse">Pinging Verified Network Subcontractors...</h5>
                <p className="text-xs text-slate-400 mt-1">Routing spatial RFQs via secure partner endpoints.</p>
              </div>
            )}

            {(bidState === 'received' || bidState === 'accepted') && (
              <div className="flex flex-col gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Broadcast Job: <span className="font-bold text-white">Main Line Sewer Burst</span></span>
                  <span className="text-blue-400 font-extrabold uppercase animate-pulse">Bidding Open</span>
                </div>

                <div className="flex flex-col gap-2">
                  {receivedBids.map((bid) => (
                    <div key={bid.id} className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                          {bid.name} <span className="text-[10px] text-amber-400">★ {bid.rating}</span>
                        </h5>
                        <p className="text-[9px] text-slate-500 mt-1">Available to dispatch in: {bid.eta}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-white">${bid.bid}</span>
                        {bidState === 'accepted' ? (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase">
                            Escrow Active
                          </span>
                        ) : (
                          <button
                            onClick={() => setBidState('accepted')}
                            className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition-colors"
                          >
                            Accept & Lock
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 10. AI OMNI-CHANNEL MARKETING VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'ai-omni-channel-marketing' && (
          <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center text-left">
            {/* Generator Settings */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                <Wand2 size={16} /> Generate Marketing Campaign
              </h4>

              <div className="flex flex-col gap-2">
                {[
                  { key: 'ac-replace', name: 'Westlake AC Install', summary: 'Carrier replacement compressor photo uploaded.' },
                  { key: 'drain-clog', name: 'Plumbing Sewer Unclog', summary: 'Mainline root block cleared.' }
                ].map((job) => (
                  <button
                    key={job.key}
                    onClick={() => {
                      setMarketingJob(job.key);
                      setIsMarketingApproved(false);
                    }}
                    className={`p-3 rounded-xl border transition-all text-left flex flex-col ${
                      marketingJob === job.key
                        ? 'bg-slate-900 border-fuchsia-500/40 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black">{job.name}</span>
                    <span className="text-[10px] text-slate-500 mt-1">{job.summary}</span>
                  </button>
                ))}
              </div>

              {/* Platform Selector */}
              <div className="flex gap-2 mt-2">
                {['fb', 'insta', 'google'].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setMarketingPlatform(platform as any)}
                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg border uppercase tracking-wider transition-all ${
                      marketingPlatform === platform
                        ? 'bg-fuchsia-600 border-fuchsia-500 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {platform === 'fb' ? 'Facebook' : platform === 'insta' ? 'Instagram' : 'Google Biz'}
                  </button>
                ))}
              </div>
            </div>

            {/* Display Mock Phone Social Preview */}
            <div className="flex justify-center">
              <div className="w-64 bg-slate-900 border border-slate-800 rounded-[28px] p-3 shadow-2xl relative">
                <div className="w-full bg-slate-950 rounded-[20px] overflow-hidden border border-slate-800 text-left text-xs p-3">
                  
                  {/* Platform Indicator */}
                  <div className="flex justify-between items-center border-b border-slate-900 pb-2 mb-3">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      {marketingPlatform === 'fb' ? 'Facebook Page' : marketingPlatform === 'insta' ? 'Instagram Feed' : 'Google Map Profile'}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                  </div>

                  {/* Body Content */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-6 h-6 rounded-full bg-slate-850 flex items-center justify-center font-bold text-[8px]">
                      🏗️
                    </div>
                    <div>
                      <p className="font-extrabold text-[10px] text-white">Austin AC & Plumbing</p>
                      <p className="text-[8px] text-slate-500">Sponsored • Westlake Area</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-300 leading-relaxed font-normal mb-3">
                    {marketingJob === 'ac-replace' ? (
                      "Beat the summer heat! ❄️ We just wrapped up a complete high-efficiency AC condenser installation in Westlake. Keeping local homes cool and electricity bills low! Call for seasonal checkups! #Carrier #ACRepair #AustinHVAC"
                    ) : (
                      "Roots causing drain backup? 🛠️ Plumbers just cleared a major main line blockage. Flow restored and plumbing lines cleaned and treated. Tap to book emergency plumbers today! #DrainCleaning #Plumbers #EmergencyService"
                    )}
                  </p>

                  <div className="w-full aspect-[4/3] bg-slate-900 rounded-lg flex items-center justify-center text-2xl border border-slate-800">
                    {marketingJob === 'ac-replace' ? '❄️ AC Unit' : '💧 Pipes'}
                  </div>

                  <div className="mt-4">
                    {!isMarketingApproved ? (
                      <button
                        onClick={() => setIsMarketingApproved(true)}
                        className="w-full h-9 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black text-[10px] transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check size={10} /> Approve & Post Campaign
                      </button>
                    ) : (
                      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg py-2 px-3 text-center text-emerald-400 font-bold text-[9px]">
                        Published to Channels!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 11. AI-POWERED ESTIMATING VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'ai-powered-estimating' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <Sparkles size={16} /> Natural Language AI Pricebook Compiler
            </h4>

            {/* Presets selectors */}
            <div className="flex gap-2 mb-4">
              <button
                disabled={aiEstimatingState === 'thinking'}
                onClick={() => handleAiEstimate('HVAC: Install 3-ton split system, copper line set, 6 hours labor, pull structural permit.')}
                className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-white font-bold text-[10px] transition-all text-left"
              >
                Preset 1: HVAC Replacements
              </button>
              <button
                disabled={aiEstimatingState === 'thinking'}
                onClick={() => handleAiEstimate('Plumbing: Replaced 10 feet leaking sewer pipe, 4 copper fittings, 3 hours master plumber labor.')}
                className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-white font-bold text-[10px] transition-all text-left"
              >
                Preset 2: Plumbing Pipelines
              </button>
            </div>

            {/* Query display */}
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80 mb-4">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Dictated Field Request Input</span>
              <p className="text-xs text-white italic font-normal">
                {aiPrompt || '"Click one of the preset prompts above to simulate natural language parsing..."'}
              </p>
            </div>

            {/* Parsing State */}
            {aiEstimatingState === 'thinking' && (
              <div className="bg-slate-950 border border-slate-855 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[140px]">
                <div className="w-10 h-10 rounded-full border-2 border-slate-800 border-t-pink-500 animate-spin mb-3" />
                <span className="text-xs font-bold text-slate-400">AI Parsing Input & Cross-referencing Inventory pricebook Database...</span>
              </div>
            )}

            {aiEstimatingState === 'done' && (
              <div className="bg-slate-950 border border-slate-855 rounded-xl p-4 flex flex-col gap-3">
                <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest border-b border-slate-900 pb-2">Itemized Draft Estimate Compiled</span>

                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                  {aiEstimateItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] border-b border-slate-900 pb-1.5">
                      <div className="text-left">
                        <span className="font-extrabold text-white text-[10px]">{item.desc}</span>
                        <p className="text-[8px] text-slate-500 mt-0.5">Code: {item.code} • Qty: {item.qty} @ ${item.rate}/ea</p>
                      </div>
                      <span className="font-bold text-slate-200">${item.total}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center border-t border-slate-900 pt-3 text-xs font-black">
                  <span className="text-slate-400">ESTIMATED PROPOSAL TOTAL</span>
                  <span className="text-pink-400 text-sm">
                    ${aiEstimateItems.reduce((sum, i) => sum + i.total, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 12. AI VIRTUAL WORKER VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'ai-virtual-worker' && (
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-left">
            {/* Header */}
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm">
                  🤖
                </div>
                <div>
                  <h5 className="text-xs font-black text-white">TekTrakker AI Virtual Worker</h5>
                  <p className="text-[9px] text-emerald-400 flex items-center gap-0.5 mt-0.5"><span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Online (24/7 Dispatch active)</p>
                </div>
              </div>
            </div>

            {/* Conversation Feed */}
            <div className="p-4 flex flex-col gap-3 max-h-[220px] overflow-y-auto min-h-[160px]">
              {vwChat.map((msg, idx) => {
                const isClient = msg.sender === 'client';
                return (
                  <div 
                    key={idx}
                    className={`flex flex-col max-w-[80%] ${
                      isClient ? 'self-start items-start' : 'self-end items-end ml-auto'
                    }`}
                  >
                    <span className="text-[8px] font-bold text-slate-500 mb-1">
                      {isClient ? 'Homeowner Customer' : 'AI Dispatch Agent'}
                    </span>
                    <div className={`p-3 rounded-2xl text-xs leading-normal ${
                      isClient 
                        ? 'bg-slate-950 border border-slate-800 text-slate-200' 
                        : 'bg-violet-600 text-white font-medium'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions Footer */}
            {vwState === 'awaiting' && (
              <div className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
                <button
                  onClick={() => {
                    setVwChat(prev => [
                      ...prev,
                      { sender: 'worker', text: 'Hi! Yes, we have licensed plumbers ready. I have two open service scheduling slots tomorrow: 9:00 AM with Tech Sarah, or 1:00 PM with Tech Dave. Which slot would you like to reserve?' }
                    ]);
                    setVwState('replied');
                  }}
                  className="flex-1 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-[10px] flex items-center justify-center transition-colors"
                >
                  Simulate Live AI Auto-Response
                </button>
              </div>
            )}

            {vwState === 'replied' && (
              <div className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
                <button
                  onClick={handleVwBook}
                  className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center transition-colors"
                >
                  Select & Book 9:00 AM Appointment
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 13. ANTIGRAVITY AI ASSISTANT VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'antigravity-ai' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl text-left font-mono">
            {/* Cyan Header */}
            <div className="bg-slate-950 p-4 border-b border-cyan-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center text-xs font-black">
                  AG
                </div>
                <div>
                  <h5 className="text-xs font-black text-white tracking-widest">ANTIGRAVITY NATIVE AI ENGINE</h5>
                  <p className="text-[8px] text-cyan-400 mt-0.5 uppercase">SYSTEM LEVEL: SAAS CORE v2 • COGNITIVE LAYER CO-PILOT</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[8px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" /> CORE READY
              </div>
            </div>

            {/* Shell Command buttons */}
            <div className="p-4 bg-slate-950/40 border-b border-slate-900 flex gap-2">
              <button
                disabled={isAntigravityRunning}
                onClick={() => handleAntigravityTrigger('inefficiencies')}
                className="px-3 py-1.5 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 bg-cyan-950/10 text-cyan-400 font-bold text-[9px] transition-all text-left flex items-center gap-1"
              >
                <TrendingUp size={10} /> Analyze Schedule Latency
              </button>
              <button
                disabled={isAntigravityRunning}
                onClick={() => handleAntigravityTrigger('error')}
                className="px-3 py-1.5 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 bg-cyan-950/10 text-cyan-400 font-bold text-[9px] transition-all text-left flex items-center gap-1"
              >
                <Activity size={10} /> Diagnose Heat Pump Error Code
              </button>
            </div>

            {/* analytical console log */}
            <div className="p-4 bg-slate-950 text-slate-300 text-[10px] min-h-[140px] max-h-[180px] overflow-y-auto leading-relaxed">
              {isAntigravityRunning ? (
                <div className="flex flex-col gap-1.5 animate-pulse text-cyan-500/75">
                  <p>&gt; Antigravity: Intercepting workspace events...</p>
                  <p>&gt; Compiling context nodes and active timesheets data...</p>
                  <p>&gt; Syncing spatial mapping registers...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {!antigravityPrompt ? (
                    <div className="text-slate-500 italic">
                      &gt; Awaiting Antigravity instruction triggers... Click a cognitive campaign button above.
                    </div>
                  ) : antigravityPrompt === 'inefficiencies' ? (
                    <>
                      <p className="text-cyan-400 font-bold">&gt; Antigravity Schedule Optimization Analysis Complete:</p>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 mt-1 text-[9px] flex flex-col gap-1 text-slate-300">
                        <p className="text-white font-extrabold flex items-center gap-1"><Check size={10} className="text-emerald-400" /> Dispatch recommendation found</p>
                        <p className="mt-1 leading-normal">
                          - Alert: Tech Dave is delayed 25 mins on job #482 due to part delays.
                          <br />- Remedy: Auto-divert pending residential water heater job at 123 Maple St to Tech Sarah.
                          <br />- Impact: Saves 18 miles travel, avoids SLA violation penalty of $250, levels fleet capacity.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-cyan-400 font-bold">&gt; Antigravity HVAC Technical Diagnostics Guide:</p>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 mt-1 text-[9px] flex flex-col gap-1 text-slate-300">
                        <p className="text-white font-extrabold flex items-center gap-1">⚠️ Error code E4: High Refrigerant Pressure Cutout</p>
                        <p className="mt-1 leading-normal">
                          1. Outdoor Fan: Verify condenser fan capacitor is functional (rated 45 microfarad).
                          <br />2. Air Blockage: Ensure outdoor coils are thoroughly cleared of leaf/dirt obstruction.
                          <br />3. Coolant Level: Verify subcooling calculation does not exceed 12°F (overcharge risks).
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 14. OSHA SAFETY REMINDERS VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'osha-safety-reminders' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-left">
            
            {/* Pulse Ribbon warning depending on hazard selections */}
            <div className={`p-4 border-b transition-all duration-350 flex items-center justify-between text-xs font-black ${
              oshaHazards.voltage 
                ? 'bg-amber-950/60 border-amber-500/30 text-amber-400'
                : oshaHazards.gas
                ? 'bg-red-950/60 border-red-500/30 text-red-400'
                : oshaHazards.attic
                ? 'bg-orange-950/60 border-orange-500/30 text-orange-400'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="animate-bounce" />
                <span>
                  {oshaHazards.voltage && '⚠️ OSHA SAFETY DIRECTIVE: Arc Flash Category 4 Electrical Hazards'}
                  {!oshaHazards.voltage && oshaHazards.gas && '🚨 OSHA HAZARD REMINDER: Natural Gas Pipe Line Purge Safety'}
                  {!oshaHazards.voltage && !oshaHazards.gas && oshaHazards.attic && '⚠️ OSHA CONFINED SPACE WARNING: Restricted Attic Ventilation'}
                  {!oshaHazards.voltage && !oshaHazards.gas && !oshaHazards.attic && '✅ AMBIENT WORKSPACE CHECK: Zero Active High-Risk Warnings'}
                </span>
              </div>
              
              {(oshaHazards.voltage || oshaHazards.gas || oshaHazards.attic) && (
                <span className="text-[9px] uppercase tracking-wider bg-slate-900/80 px-2 py-0.5 border border-current rounded-full">
                  Risk Alert Active
                </span>
              )}
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Select active hazards */}
              <div className="flex flex-col gap-3">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Configure On-Site Hazard Profile</h5>
                
                {[
                  { key: 'voltage', name: 'High Voltage Board (480V)', icon: '⚡' },
                  { key: 'gas', name: 'Natural Gas Line Repair', icon: '🔥' },
                  { key: 'attic', name: 'Confined Space Attic Visit', icon: '📦' }
                ].map((item) => {
                  const isActive = oshaHazards[item.key as keyof typeof oshaHazards];
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setOshaHazards({
                          ...oshaHazards,
                          [item.key]: !isActive
                        });
                        setOshaAcknowledged({
                          ...oshaAcknowledged,
                          [item.key]: false
                        });
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        isActive
                          ? 'bg-slate-950 border-slate-700 text-white font-extrabold'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs flex items-center gap-2"><span>{item.icon}</span> {item.name}</span>
                      <span className="text-[10px] text-slate-500">{isActive ? 'Active' : 'Add Risk'}</span>
                    </button>
                  );
                })}
              </div>

              {/* Display smart reminders */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[160px]">
                <div>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-900 pb-2 mb-3">
                    Smart OSHA Compliance Guidance
                  </span>

                  <div className="text-[10px] text-slate-300 leading-relaxed font-normal flex flex-col gap-1.5">
                    {oshaHazards.voltage && (
                      <p className="flex items-start gap-1"><span className="text-amber-500">•</span> Gloves: Class 0 Insulated gloves + leather protection sleeves required.</p>
                    )}
                    {oshaHazards.gas && (
                      <p className="flex items-start gap-1"><span className="text-red-500">•</span> Vent: Thoroughly exhaust zone. Spark-proof tooling only.</p>
                    )}
                    {oshaHazards.attic && (
                      <p className="flex items-start gap-1"><span className="text-orange-500">•</span> CO: Monitor oxygen levels. Maintain continuous air intake supply.</p>
                    )}
                    {!oshaHazards.voltage && !oshaHazards.gas && !oshaHazards.attic && (
                      <p className="text-slate-500 italic">No hazardous risks configured. Standard trade tools and basic safety glasses recommended.</p>
                    )}
                  </div>
                </div>

                {(oshaHazards.voltage || oshaHazards.gas || oshaHazards.attic) && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setOshaAcknowledged({
                          ...oshaAcknowledged,
                          voltage: oshaHazards.voltage ? true : oshaAcknowledged.voltage,
                          gas: oshaHazards.gas ? true : oshaAcknowledged.gas,
                          attic: oshaHazards.attic ? true : oshaAcknowledged.attic,
                        });
                      }}
                      className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check size={12} /> Acknowledge On-Site Directives
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 15. RINGCENTRAL TELEPHONY INTEGRATION VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'ringcentral-telephony' && (
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[32px] p-4 shadow-2xl relative">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-950 rounded-full flex items-center justify-center">
              <div className="w-8 h-1 bg-slate-800 rounded-full" />
            </div>

            <div className="w-full bg-slate-950 rounded-[24px] overflow-hidden pt-6 pb-4 px-4 border border-slate-800 text-left text-xs min-h-[300px] flex flex-col justify-between">
              
              {/* Internal Tab header */}
              <div>
                <div className="flex gap-2 border-b border-slate-900 pb-2 mb-3">
                  <button 
                    onClick={() => setRcTab('dial')}
                    className={`text-[10px] font-black uppercase tracking-wider pb-1 transition-all border-b-2 ${
                      rcTab === 'dial' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'
                    }`}
                  >
                    Dialpad Dialer
                  </button>
                  <button 
                    onClick={() => setRcTab('sms')}
                    className={`text-[10px] font-black uppercase tracking-wider pb-1 transition-all border-b-2 ${
                      rcTab === 'sms' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500'
                    }`}
                  >
                    Client SMS Thread
                  </button>
                </div>

                {rcTab === 'dial' && rcCallState === 'idle' && (
                  <div className="flex flex-col items-center">
                    {/* Dial screen */}
                    <div className="w-full h-11 bg-slate-900 rounded-xl border border-slate-800 mb-3 flex items-center justify-end px-3 font-mono text-base font-extrabold text-white">
                      {dialedDigits || 'Enter digits...'}
                    </div>

                    {/* Numeric keypad */}
                    <div className="grid grid-cols-3 gap-2.5 max-w-[180px] w-full">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                        <button
                          key={digit}
                          onClick={() => handleDialClick(digit)}
                          className="w-11 h-11 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-colors flex items-center justify-center"
                        >
                          {digit}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleSimulateCall}
                      className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-wider mt-4 flex items-center justify-center gap-1.5"
                    >
                      <PhoneCall size={12} /> Simulate Incoming Call
                    </button>
                  </div>
                )}

                {rcTab === 'dial' && rcCallState === 'ringing' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center my-6 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg animate-pulse mb-3">
                      📞
                    </div>
                    <h5 className="font-extrabold text-white">Incoming Client Call</h5>
                    <p className="text-[9px] text-slate-400 mt-1">Caller: Roderick Smith (Active CRM)</p>
                    <p className="text-[8px] text-slate-500 italic mt-0.5">RingCentral ID: #RC-9481</p>

                    <div className="flex gap-2 w-full mt-4">
                      <button
                        onClick={handleAcceptCall}
                        className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center transition-colors"
                      >
                        Accept & Screen Pop
                      </button>
                      <button
                        onClick={() => setRcCallState('idle')}
                        className="flex-1 h-9 rounded-lg bg-red-650 hover:bg-red-600 text-white font-bold text-[10px] flex items-center justify-center transition-colors"
                      >
                        Decline Call
                      </button>
                    </div>
                  </div>
                )}

                {rcTab === 'dial' && rcCallState === 'connected' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-left">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                      <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Connected Call</span>
                      <span className="text-[8px] font-mono text-slate-500">00:14 secs</span>
                    </div>

                    <h5 className="font-black text-white text-[11px]">Roderick Smith CRM File</h5>
                    
                    <div className="bg-slate-950 rounded-lg p-2.5 mt-2 flex flex-col gap-1.5 text-[9px] border border-slate-850">
                      <p className="text-slate-400">Address: <span className="text-white font-bold">123 Maple St</span></p>
                      <p className="text-slate-400">Active Proposals: <span className="text-pink-400 font-extrabold">Better Package ($6,500)</span></p>
                      <p className="text-slate-400">Asset Record: <span className="text-white font-bold">Carrier AC (Serial: RH-99)</span></p>
                    </div>

                    <button
                      onClick={() => setRcCallState('idle')}
                      className="w-full h-8 rounded-lg bg-red-650 hover:bg-red-600 text-white font-bold text-[10px] mt-3"
                    >
                      Disconnect Call
                    </button>
                  </div>
                )}

                {rcTab === 'sms' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {smsChat.map((msg, idx) => {
                        const isYou = msg.sender === 'you';
                        return (
                          <div 
                            key={idx}
                            className={`flex flex-col max-w-[80%] ${
                              isYou ? 'self-end items-end ml-auto' : 'self-start items-start'
                            }`}
                          >
                            <div className={`p-2.5 rounded-xl text-[10px] leading-relaxed ${
                              isYou
                                ? 'bg-indigo-600 text-white font-medium'
                                : 'bg-slate-900 border border-slate-800 text-slate-300'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Send input */}
                    <form onSubmit={handleSendSms} className="flex gap-1.5 border-t border-slate-900 pt-2.5">
                      <input 
                        type="text"
                        placeholder="Send SMS back to client..."
                        value={newSms}
                        onChange={(e) => setNewSms(e.target.value)}
                        className="flex-1 h-8 bg-slate-900 border border-slate-800 rounded-lg px-2 text-[9px] text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center"
                      >
                        <Send size={10} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 16. DRIP EMAIL CAMPAIGNS VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'drip-email-campaigns' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
              <Mail size={16} /> Automated Lead Nurturing & Follow-up Flowchart
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              
              {/* dragger flowchart canvas */}
              <div className="bg-slate-950 border border-slate-855 rounded-xl p-4 flex flex-col gap-3 min-h-[180px] justify-between relative overflow-hidden">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-900 pb-2">
                  Campaign Sequence: {selectedDripTemplate === 'followup' ? 'Estimate Follow-up' : selectedDripTemplate === 'review' ? 'Google Review Campaign' : 'Spring Maintenance'}
                </span>

                <div className="flex flex-col items-center gap-2 relative z-10 text-[10px]">
                  {/* Step 1 */}
                  <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 font-bold w-full text-center">
                    🟢 Trigger: Proposal Emailed
                  </div>

                  <div className="w-0.5 h-3 bg-slate-800" />

                  {/* Step 2 Wait Node */}
                  <button 
                    onClick={() => {
                      setDripWaitDays(prev => prev === 2 ? 1 : prev === 1 ? 3 : 2);
                    }}
                    className="bg-slate-900/50 border border-dashed border-teal-500/30 hover:border-teal-500/60 px-3 py-1 text-[9px] font-mono text-teal-400 rounded-md transition-all animate-pulse"
                  >
                    ⏰ Wait {dripWaitDays} Day{dripWaitDays > 1 ? 's' : ''} (Click to toggle duration)
                  </button>

                  <div className="w-0.5 h-3 bg-slate-800" />

                  {/* Step 3 Email */}
                  <div 
                    className="bg-teal-600 px-3 py-1.5 rounded-lg text-white font-black w-full text-center transition-all flex items-center justify-center gap-1 shadow-lg shadow-teal-600/10"
                  >
                    Send Email: "{selectedDripTemplate === 'followup' ? 'Nudge #1: Still Thinking?' : selectedDripTemplate === 'review' ? 'Review Invitation' : 'Spring Air Filter tuneup'}"
                  </div>
                </div>
              </div>

              {/* Template editor mockup preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[180px] flex flex-col justify-between">
                <div>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-900 pb-2 mb-3">
                    Active Email Template Preview
                  </span>

                  <div className="bg-slate-900 border border-slate-855 rounded-lg p-3 text-[9px] text-slate-300 font-sans leading-relaxed">
                    <p className="font-extrabold text-white text-[10px] border-b border-slate-800 pb-1.5 mb-2">
                      Subject: {selectedDripTemplate === 'followup' ? 'Need any help with your TekTrakker Quote?' : selectedDripTemplate === 'review' ? 'How did we do? Tell us your feedback!' : 'Spring is coming! Time for your AC Air filter change!'}
                    </p>
                    <p className="mt-1 font-normal">
                      {selectedDripTemplate === 'followup' && (
                        "Hi [Client First Name], Roderick here! Just following up to see if you have any questions about the AC proposal we sent over. We have active technician crews in your neighborhood this week!"
                      )}
                      {selectedDripTemplate === 'review' && (
                        "Hi [Client First Name]! We hope you loved our recent plumbing service. Could you spare 30 seconds to rate us on Google? It really helps our local business family grow! Thank you!"
                      )}
                      {selectedDripTemplate === 'seasonal' && (
                        "Hi [Client First Name]! Heat waves are on the horizon. As a VIP member, your spring system checkup is fully covered! Tap to schedule your visit before slots fill up."
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {[
                    { key: 'followup', name: 'Nurture' },
                    { key: 'review', name: 'Reviews' },
                    { key: 'seasonal', name: 'Seasonal' }
                  ].map((temp) => (
                    <button
                      key={temp.key}
                      onClick={() => {
                        setSelectedDripTemplate(temp.key as any);
                      }}
                      className={`flex-1 h-8 rounded-lg border text-[9px] font-extrabold transition-all flex items-center justify-center ${
                        selectedDripTemplate === temp.key
                          ? 'bg-teal-600 border-teal-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {temp.name}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 17. CUSTOM TOOLS MARKETPLACE VISUALIZER */}
        {/* ========================================================================= */}
        {slug === 'custom-tools-marketplace' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left">
            <h4 className="text-sm font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
              <Plus size={16} className="text-teal-400" /> Dynamic Custom Tool & App Builder Canvas
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              
              {/* Left Panel: Creator Canvas */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between min-h-[380px] relative overflow-hidden">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      Tool Workspace
                    </span>
                    <span className="text-[8px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded font-mono">
                      v2.0 Beta
                    </span>
                  </div>

                  {/* Tool Name Input */}
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-widest">Tool Name</label>
                    <input 
                      type="text"
                      value={publishedToolName}
                      onChange={(e) => setPublishedToolName(e.target.value)}
                      placeholder="e.g. Standard HVAC Diagnostic Tool"
                      className="w-full h-8 bg-slate-900 border border-slate-800 rounded-lg px-2.5 text-[10px] text-white font-bold focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Drag-and-drop Elements Palette */}
                  <div>
                    <label className="text-[9px] text-slate-500 font-bold block mb-1.5 uppercase tracking-widest">Add Field Elements</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { type: 'text', name: 'Text Input' },
                        { type: 'photo', name: 'Photo Capture' },
                        { type: 'signature', name: 'Signature Box' },
                        { type: 'slider', name: 'PSI/Value Slider' },
                        { type: 'checkbox', name: 'Safety Toggle' }
                      ].map((item) => (
                        <button
                          key={item.type}
                          onClick={() => {
                            if (customFields.length >= 6) return;
                            setCustomFields([
                              ...customFields, 
                              { id: Date.now(), type: item.type, label: `Custom ${item.name}` }
                            ]);
                          }}
                          className="h-7 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 rounded-md text-[9px] text-slate-300 font-semibold flex items-center justify-start px-2 gap-1.5 transition-all"
                        >
                          <Plus size={10} className="text-teal-400" />
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Canvas Fields */}
                  <div className="flex flex-col gap-2 mt-2">
                    <label className="text-[9px] text-slate-500 font-bold block uppercase tracking-widest">Active Canvas Fields ({customFields.length}/6)</label>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {customFields.map((field) => (
                        <div 
                          key={field.id} 
                          className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between gap-2 group hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-[8px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono uppercase">
                              {field.type}
                            </span>
                            <input 
                              type="text"
                              value={field.label}
                              onChange={(e) => {
                                const updated = customFields.map(f => f.id === field.id ? { ...f, label: e.target.value } : f);
                                setCustomFields(updated);
                              }}
                              className="bg-transparent border-b border-transparent focus:border-teal-500/50 hover:border-slate-800 text-[10px] text-slate-200 font-bold px-1 py-0.5 flex-1 min-w-0 focus:outline-none"
                            />
                          </div>
                          <button 
                            onClick={() => {
                              setCustomFields(customFields.filter(f => f.id !== field.id));
                            }}
                            className="text-slate-500 hover:text-red-400 p-1"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-[8px] text-slate-500 border-t border-slate-900 pt-3 flex justify-between items-center mt-2">
                  <span>Changes auto-save inside Workspace</span>
                  <button 
                    onClick={() => {
                      setCustomFields([
                        { id: 1, type: 'text', label: 'Equipment Model Number' },
                        { id: 2, type: 'photo', label: 'Before Repair Photo' }
                      ]);
                      setIsToolPublished(false);
                    }}
                    className="text-slate-400 hover:text-white underline font-medium text-[8px]"
                  >
                    Reset Canvas
                  </button>
                </div>
              </div>

              {/* Right Panel: Tablet Mockup Preview */}
              <div className="flex items-center justify-center">
                <div className="relative w-[260px] h-[380px] bg-slate-950 border-[5px] border-slate-800 rounded-[28px] shadow-2xl flex flex-col justify-between overflow-hidden">
                  
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-3.5 bg-slate-800 rounded-b-lg z-20 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                  </div>

                  {/* Device Header */}
                  <div className="px-3 pt-4 pb-1.5 border-b border-slate-900 bg-slate-900/10 flex items-center justify-between text-[7px] text-slate-400 font-mono tracking-wider relative z-10">
                    <span className="font-bold text-[8px] text-teal-400">TekTrakker Fleet v2</span>
                    <span className="flex items-center gap-1 text-[7px]">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                      ONLINE
                    </span>
                  </div>

                  {/* Device Body (Scrollable dynamic fields) */}
                  <div className="p-3 flex-1 overflow-y-auto space-y-2.5 text-left custom-scrollbar">
                    {isToolPublished ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-3 animate-fade-in">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 animate-bounce">
                          <Check size={20} />
                        </div>
                        <h5 className="text-[11px] font-black text-white mb-1">✨ Successfully Published!</h5>
                        <p className="text-[8px] text-slate-400 mb-4 leading-normal">
                          "${publishedToolName || 'Custom Fleet Tool'}" is now live across all 42 technician devices in your active fleet.
                        </p>
                        
                        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 w-full text-[8px] text-left text-slate-400 space-y-1">
                          <span className="font-black text-slate-300 block border-b border-slate-900 pb-1 mb-1 uppercase tracking-wider">Fleet Synced Logs</span>
                          <div className="flex items-center justify-between text-[7px] font-mono">
                            <span>📱 Austin Crew (18)</span>
                            <span className="text-emerald-400 font-bold">ACTIVE</span>
                          </div>
                          <div className="flex items-center justify-between text-[7px] font-mono">
                            <span>📱 Dallas Crew (24)</span>
                            <span className="text-emerald-400 font-bold">ACTIVE</span>
                          </div>
                          <div className="flex items-center justify-between text-[7px] font-mono">
                            <span>⏰ Sync Speed</span>
                            <span className="text-slate-200">0.24 seconds</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => setIsToolPublished(false)}
                          className="mt-4 text-[8px] text-teal-400 underline font-black uppercase tracking-wider"
                        >
                          Modify / Edit Elements
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="border-b border-slate-900 pb-1">
                          <h5 className="text-[10px] font-black text-white truncate">{publishedToolName || 'Untitled Diagnostic Tool'}</h5>
                          <span className="text-[7px] text-slate-500 block uppercase">Technician Mobile Interface Preview</span>
                        </div>

                        {customFields.length === 0 ? (
                          <div className="h-[180px] flex flex-col items-center justify-center text-center text-slate-600 gap-1">
                            <Bot size={20} />
                            <span className="text-[8px]">Canvas is empty.<br/>Add items on the left to build.</span>
                          </div>
                        ) : (
                          <div className="space-y-2.5 pb-2">
                            {customFields.map((field) => (
                              <div key={field.id} className="space-y-1">
                                {field.type === 'text' && (
                                  <>
                                    <label className="text-[8px] text-slate-400 font-bold block">{field.label}</label>
                                    <input 
                                      type="text" 
                                      disabled 
                                      placeholder="Technician input field..." 
                                      className="w-full h-7 bg-slate-900 border border-slate-800/80 rounded-md px-2 text-[8px] text-slate-600 cursor-not-allowed" 
                                    />
                                  </>
                                )}
                                {field.type === 'photo' && (
                                  <>
                                    <label className="text-[8px] text-slate-400 font-bold block">{field.label}</label>
                                    <div className="w-full h-11 bg-slate-900 border border-dashed border-slate-800 rounded-md flex items-center justify-center text-slate-600 gap-1 cursor-not-allowed">
                                      <Smartphone size={12} />
                                      <span className="text-[7px] font-medium">Capture Photo (Tap to Camera)</span>
                                    </div>
                                  </>
                                )}
                                {field.type === 'signature' && (
                                  <>
                                    <label className="text-[8px] text-slate-400 font-bold block">{field.label}</label>
                                    <div className="w-full h-9 bg-slate-900 border border-slate-855 rounded-md flex items-center justify-center text-slate-600/80 font-mono text-[7px] cursor-not-allowed">
                                      [Finger Signature Capture]
                                    </div>
                                  </>
                                )}
                                {field.type === 'slider' && (
                                  <>
                                    <label className="text-[8px] text-slate-400 font-bold block">{field.label}</label>
                                    <div className="w-full bg-slate-900 border border-slate-800/60 rounded-md p-1.5 flex items-center gap-1.5">
                                      <input type="range" disabled className="w-full accent-teal-500/60 cursor-not-allowed" />
                                      <span className="text-[7px] text-slate-500 font-mono">0%</span>
                                    </div>
                                  </>
                                )}
                                {field.type === 'checkbox' && (
                                  <div className="flex items-center gap-1.5 py-0.5">
                                    <input type="checkbox" disabled className="accent-teal-500 cursor-not-allowed" />
                                    <label className="text-[8px] text-slate-400 font-bold">{field.label}</label>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Device Footer Action Button */}
                  {!isToolPublished && (
                    <div className="p-2.5 border-t border-slate-900 bg-slate-950 relative z-10">
                      {isPublishing ? (
                        <button 
                          disabled 
                          className="w-full h-8 bg-slate-800 text-slate-400 font-bold text-[9px] rounded-lg cursor-wait flex items-center justify-center gap-1"
                        >
                          <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          Deploying to Active Fleet...
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            setIsPublishing(true);
                            setTimeout(() => {
                              setIsPublishing(false);
                              setIsToolPublished(true);
                            }, 1200);
                          }}
                          disabled={customFields.length === 0}
                          className="w-full h-8 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-teal-500/10 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          🚀 Publish Tool to Fleet
                        </button>
                      )}
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
