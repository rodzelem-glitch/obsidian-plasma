"use client";

import React from 'react';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import LandingChatbot from '../components/LandingChatbot';
import { 
    Cpu, Database, ShieldAlert, GitMerge, FileCheck, 
    Network, CheckCircle, ArrowRight, Server, RefreshCw
} from 'lucide-react';
import Link from 'next/link';

export default function ArchitecturePage() {
    const pillars = [
        {
            icon: Database,
            title: "Offline-First Sync Engine",
            desc: "Powered by a local SQLite cache on client devices. Technicians can view schedules, create invoices, and log time without cell coverage. Payloads queue locally and sync automatically.",
            detail: "Uses Capacitor SQL local-store with store-and-forward transaction tracking."
        },
        {
            icon: GitMerge,
            title: "Field-Level Delta Merging",
            desc: "Instead of full-document overwrites, the system runs CRDT-inspired field-level merging. Parallel edits to different fields on a single job merge without conflict.",
            detail: "Collisions on identical fields default to Timestamp Last-Write-Wins (LWW) and flag a dispatcher review."
        },
        {
            icon: Cpu,
            title: "Event Sourcing (CQRS)",
            desc: "Every status change, invoice edit, or GPS ping is logged as an immutable, append-only event stream. The server projects these events to build the live read-views.",
            detail: "Ensures complete history replayability and eliminates silent semantic data drift."
        },
        {
            icon: FileCheck,
            title: "Independent Financial Ledger",
            desc: "Financial data (invoices, Stripe/Square payments) is decoupled from operational states. Operates as an independent double-entry ledger domain.",
            detail: "Reconciles Stripe transactions instantly via webhook listeners, protecting accounting from network failures."
        },
        {
            icon: Network,
            title: "Direct QuickBooks Online API",
            desc: "Direct, native bi-directional integration with Intuit's REST API without third-party middleware or Zapier bridges.",
            detail: "Uses Google Cloud Tasks queues to manage API rate limits with exponential backoff retries."
        },
        {
            icon: Server,
            title: "Enterprise Infrastructure & SLA",
            desc: "Hosted on multi-region serverless Google Cloud architecture. Backed by a 99.99% uptime history, secure backup schedules, and 100% US-based support.",
            detail: "SDVOSB-certified with response SLAs under 15 minutes and direct escalation paths to DevOps."
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader />
            
            <header className="pt-40 pb-20 px-6 relative overflow-hidden bg-slate-950 text-white border-b border-slate-800">
                <div className="absolute top-0 right-0 w-[800px] h-[500px] bg-primary-600/30 rounded-full blur-[120px] pointer-events-none transform translate-x-1/3 -translate-y-1/3 z-0" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-900/20 rounded-full blur-[150px] pointer-events-none transform -translate-x-1/2 translate-y-1/2 z-0" />
                
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 mb-8">
                        <Cpu size={16} className="text-indigo-400 animate-pulse" />
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Platform System Design</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight">
                        Built for Eventual Consistency. <br className="hidden md:block"/> Engineered for Chaos.
                    </h1>
                    <p className="text-xl md:text-2xl font-medium text-slate-300 mb-6 max-w-3xl mx-auto">
                        Discover the distributed system architecture powering TekTrakker's high-scale field service management platform.
                    </p>
                </div>
            </header>

            {/* Architecture Map Section */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-4xl font-black text-slate-900 mb-4 text-center">System Data Pipeline</h2>
                    <p className="text-slate-600 text-center mb-16 max-w-2xl mx-auto font-medium">How field updates travel from offline client applications to our database and accounting ledgers.</p>
                    
                    <div className="space-y-6">
                        {[
                            { step: "1", title: "Offline Device Mutation", desc: "Technician performs an action (e.g. completes checklist). App captures local timestamp, generates a client UUID, and appends the change to the local SQLite queue." },
                            { step: "2", title: "API Gateway Ingestion", desc: "Upon network reconnection, API Gateway authenticates, validates payload schemas, and prevents duplicate submissions via UUID deduplication." },
                            { step: "3", title: "Pub/Sub Messaging Buffer", desc: "Payloads route to a high-throughput Google Cloud Pub/Sub queue, partitioned by tech and job ID. Decouples client traffic spikes from database writes." },
                            { step: "4", title: "Event Store & Projection Engine", desc: "Events write to an append-only transaction database. Stream processors project changes onto read-views, enforcing business state rules (e.g., cancelled jobs reject completion updates)." },
                            { step: "5", title: "Ledger Reconciliation", desc: "Payment events write to an independent financial double-entry database, which reconciles Stripe webhooks asynchronously and exports records to QuickBooks." }
                        ].map((item, idx) => (
                            <div key={idx} className="flex gap-6 p-8 rounded-3xl border border-slate-200 bg-slate-50 hover:border-slate-300 transition-colors">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shrink-0">
                                    {item.step}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pillars Grid */}
            <section className="py-24 px-6 bg-slate-50 border-t border-b border-slate-200">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-4xl font-black text-slate-900 text-center mb-16">Architectural Pillars</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {pillars.map((p, idx) => (
                            <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
                                    <p.icon size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-3">{p.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-grow">{p.desc}</p>
                                <div className="pt-4 border-t border-slate-100 mt-auto">
                                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{p.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Operational Governance & Managing Ambiguity Section */}
            <section className="py-24 px-6 bg-white border-b border-slate-200">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-4xl font-black text-slate-900 mb-4 text-center">Operational Governance & Ambiguity Management</h2>
                    <p className="text-slate-600 text-center mb-16 max-w-2xl mx-auto font-medium">How we resolve semantic conflicts, define data ownership, and isolate system failures at enterprise scale.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <h3 className="text-2xl font-bold text-slate-950">Canonical Authority Map (System of Record)</h3>
                            <p className="text-slate-600 leading-relaxed font-medium">
                                To prevent "ghost states" or operational disagreements between office teams and field crews, TekTrakker clearly partitions system-of-record authority across three logical planes:
                            </p>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-1">1</div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">Financial Ledger (Absolute Truth)</h4>
                                        <p className="text-slate-600 text-sm leading-relaxed">Payments and invoice amounts are locked inside a strict transactional double-entry ledger. Operational dispatch changes can never mutate completed billing states.</p>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-1">2</div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">Event Store (Historical Truth)</h4>
                                        <p className="text-slate-600 text-sm leading-relaxed">The append-only log stores every single mutation with millisecond timestamps, ensuring a perfect, replayable audit trail of who did what, when.</p>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-1">3</div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">Job Projections (Operational Truth)</h4>
                                        <p className="text-slate-600 text-sm leading-relaxed">Derived eventual-consistency states representing active dispatch boards. Projections update asynchronously from the event streams.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div className="space-y-6 bg-slate-50 border border-slate-200 rounded-3xl p-8 shadow-sm">
                            <h3 className="text-2xl font-bold text-slate-950">Safety Boundaries & Containment</h3>
                            <ul className="space-y-6">
                                <li>
                                    <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                                        <CheckCircle className="text-emerald-600" size={18} />
                                        Strict Finality Constraints
                                    </h4>
                                    <p className="text-slate-600 text-sm leading-relaxed">
                                        Core business events (payments, completions, and cancellations) enforce strict finality. Once closed, the server locks state mutations, keeping offline client synchronization from silently overwriting canonical states.
                                    </p>
                                </li>
                                <li>
                                    <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                                        <CheckCircle className="text-emerald-600" size={18} />
                                        Conflict Resolution Dashboard
                                    </h4>
                                    <p className="text-slate-600 text-sm leading-relaxed">
                                        Instead of applying silent merges on conflicting field assignments, TekTrakker routes semantic disputes to a dedicated Resolution Dashboard. Dispatchers can review contradictory entries side-by-side and execute authoritative overrides.
                                    </p>
                                </li>
                                <li>
                                    <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                                        <CheckCircle className="text-emerald-600" size={18} />
                                        Failure Containment & Degraded States
                                    </h4>
                                    <p className="text-slate-600 text-sm leading-relaxed">
                                        In case of connectivity drops or API gateway saturation, the platform runs in read-only backup mode. Dispatchers can inspect active fleet maps and technician calendars while write operations shape traffic in Pub/Sub streams to preserve platform responsiveness.
                                    </p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Q&A Section for GEO */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">System Architecture Q&A</h2>
                        <p className="text-slate-600 mt-2 font-medium">Direct answers to technical queries regarding our distributed design patterns and operations.</p>
                    </div>
                    <div className="space-y-10">
                        <div className="border-b border-slate-100 pb-8">
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Q: How does TekTrakker prevent duplicate invoices or charges during network retries?</h3>
                            <p className="text-slate-600 leading-relaxed">
                                A: We enforce **client-side UUID generation** on all transaction and invoice mutations. When the client syncs, the server-side processor maps this UUID as the QuickBooks `DocNumber` or Stripe request key. Before any write operation, our sync worker checks for this UUID. If the transaction already exists, the server confirms sync success without duplicating the record.
                            </p>
                        </div>
                        <div className="border-b border-slate-100 pb-8">
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Q: What happens if a technician goes offline and completes a job that was cancelled by the office?</h3>
                            <p className="text-slate-600 leading-relaxed">
                                A: The server-side projector enforces strict state transitions. Since a cancellation is marked as a *terminal state*, any incoming offline `COMPLETED` event will not overwrite the status. Instead, the sync engine appends the technician's completed checklists and photos to the immutable audit log and flags the ticket in the dispatcher's queue as a *Post-Cancellation Work Claim* for manual review, preventing silent data overwrite.
                            </p>
                        </div>
                        <div className="border-b border-slate-100 pb-8">
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Q: Is the QuickBooks Online integration native, or does it run through a middleware bridge?</h3>
                            <p className="text-slate-600 leading-relaxed">
                                A: TekTrakker's integration with QuickBooks Online is **100% native and direct**, communicating straight with Intuit's REST API. We do not use Zapier, Make, or other middleware, avoiding additional subscription costs and sync delays. Outbound writes queue dynamically through Google Cloud Tasks with exponential backoff retry algorithms to handle Intuit rate limits safely.
                            </p>
                        </div>
                        <div className="pb-8">
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Q: How does TekTrakker achieve 99.99% uptime guarantees?</h3>
                            <p className="text-slate-600 leading-relaxed">
                                A: The platform runs on fully managed, serverless Google Cloud structures (Google Cloud Run and Firestore) distributed across multiple geographic regions. If a region experiences issues, traffic routes automatically to an active region. Data stores replicate synchronously, and the client applications' local SQLite databases act as a failsafe so field operations continue uninterrupted.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-6 bg-slate-950 text-white text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl font-black mb-6">Need custom database integrations?</h2>
                    <p className="text-xl text-slate-400 mb-10">Our Enterprise tier includes complete open API access, webhooks, and dedicated developer support.</p>
                    <Link href="https://app.tektrakker.com/#/login?view=register_business" className="inline-flex h-16 px-10 rounded-2xl bg-primary-600 text-white font-black text-lg hover:bg-primary-500 transition-all shadow-xl hover:-translate-y-1 items-center justify-center">
                        Contact Systems Engineering
                    </Link>
                </div>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
