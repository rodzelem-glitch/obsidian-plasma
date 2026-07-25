import React from 'react';
import { Network, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Metadata } from 'next';
import CloseButton from './CloseButton';
import { LandingFooter } from '../components/LandingFooter';

export const metadata: Metadata = {
    title: 'Master Services & Franchise Agreement | TekTrakker Legal',
    description: 'Official White-Label Master Services and Franchise Agreement details for the TekTrakker platform.',
    robots: {
        index: false,
        follow: true,
    },
};

export default function FranchiseAgreementPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-300">
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-black text-xl text-indigo-600 dark:text-indigo-400 cursor-pointer">
                        <Network /> TekTrakker
                    </Link>
                    <CloseButton />
                </div>
            </header>

            <main className="max-w-4xl mx-auto py-12 px-6">
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 md:p-12 prose prose-slate dark:prose-invert max-w-none">
                    
                    <div className="flex items-center gap-3 mb-8 pb-8 border-b border-slate-200 dark:border-slate-700">
                        <ShieldCheck size={40} className="text-indigo-600 dark:text-indigo-400" />
                        <div>
                            <h1 className="text-3xl font-black mb-1 mt-0 text-slate-900 dark:text-white">White-Label Master Services and Franchise Agreement</h1>
                            <p className="text-sm text-slate-500 m-0 uppercase tracking-wider font-bold">Standard Platform License Term</p>
                        </div>
                    </div>

                    <p>This White-Label Master Services and Franchise Agreement (&quot;Agreement&quot;) is effectively incorporated by digital execution between <strong>TekTrakker (&quot;Licensor&quot;)</strong> and the enrolling party (&quot;Licensee&quot;, &quot;Franchisee&quot;).</p>

                    <h3 className="text-xl font-bold mt-6 mb-2 text-slate-900 dark:text-white">1. GRANT OF LICENSE & TERRITORY</h3>
                    <p><strong>1.1 White-Label Rights:</strong> Subject to the terms and conditions herein, Licensor grants Licensee a non-exclusive, non-transferable, revocable license to market, sell, and distribute the TekTrakker platform under the Licensee&apos;s custom branding (&quot;White-Label Platform&quot;).</p>
                    <p className="mt-2"><strong>1.2 Scope and Restrictions:</strong> Licensee is strictly prohibited from attempting to reverse-engineer, decompile, or otherwise extract the underlying proprietary source code of the Licensor&apos;s software.</p>
                    <p className="mt-2"><strong>1.3 Territory and Business Types:</strong> Licensee&apos;s rights are strictly constrained geographically and demographically to the selections submitted during enrollment. <strong>Territory requests are NOT guaranteed to be exclusive.</strong> Licensor explicitly retains the right to authorize other franchisees in overlapping or identical territories at its sole, absolute discretion. Franchisee waives any claims of geographical monopolization or territory infringement. Licensor holds the right to terminate accounts that purposely exceed their permitted boundaries.</p>

                    <h3 className="text-xl font-bold mt-6 mb-2 text-slate-900 dark:text-white">2. TERM & TERMINATION</h3>
                    <p><strong>2.1 Initial Term:</strong> This Agreement shall commence upon initial payment and digitally capturing signature and remain in effect for a strict minimum period of <strong>one (1) year</strong> (&quot;Initial Term&quot;).</p>
                    <p className="mt-2"><strong>2.2 Renewal:</strong> Following the Initial Term, this Agreement shall automatically renew on a month-to-month basis unless terminated by either party with thirty (30) days&apos; written notice.</p>
                    <p className="mt-2"><strong>2.3 Termination for Convenience by Licensor:</strong> Licensor reserves the explicit right to terminate this agreement at any time, for any reason or no reason, upon written notice, without further liability to Licensee.</p>

                    <h3 className="text-xl font-bold mt-6 mb-2 text-slate-900 dark:text-white">3. FEES & PAYMENTS</h3>
                    <p><strong>3.1 Initial Setup and First Month Retainer:</strong> At the time of signing and initial enrollment, Licensee must remit a completely and absolutely <strong>NON-REFUNDABLE sum of $2,500.00</strong>. This fee is comprised of a $1,500.00 infrastructure provisioning fee (covering custom DNS routing, brand setup, and data migration) and a $1,000.00 retainer for the first operating month.</p>
                    <p className="mt-2"><strong>3.2 Monthly Subscription:</strong> Following the first month, Licensee agrees to pay a flat franchise fee of <strong>$1,000.00 per month</strong>.</p>
                    <p className="mt-2"><strong>3.3 Usage Overages:</strong> Licensee agrees to pay an additional <strong>$10.00 per active end-user per month</strong> dynamically billed to the Licensee&apos;s master payment method on file.</p>

                    <h3 className="text-xl font-bold mt-6 mb-2 text-red-600 dark:text-red-400">4. DEFAULT & REVERSION (SECURITY INTEREST)</h3>
                    <p className="font-bold">By signing the digital contract during setup, you explicitly acknowledge and grant the following reversion security interest:</p>
                    <p className="mt-2"><strong>4.1 Payment Default:</strong> If Licensee falls more than <strong>fifteen (15) days in arrears</strong> on any Monthly Subscription or Per-User Fee, Licensor shall issue a secondary Notice of Default alerting the Franchisee of immediate actions.</p>
                    <p className="mt-2"><strong>4.2 Forfeiture and Transfer of Assets:</strong> If Licensee fails to cure the aforementioned default within five (5) days post-notification, Licensee materially breaches this Agreement and forcibly forfeits all rights, claims, and capabilities to the White-Label Platform.</p>
                    <p className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/50 mt-4">
                        <strong>4.3 Ownership Transfer:</strong> Upon forfeiture, ALL end-user accounts, data silhouettes, customer relationships, and recurring payment streams generated under the Licensee&apos;s white-label instance shall immediately and permanently revert to the sole ownership of the Licensor (TekTrakker). Licensor possesses the irrevocable right to migrate sub-users directly to native TekTrakker billing. Licensee expressly waives any claim to damages, lost profits, or data ownership regarding this defaulting reversion outcome.
                    </p>

                    <h3 className="text-xl font-bold mt-6 mb-2 text-slate-900 dark:text-white">5. ARTIFICIAL INTELLIGENCE &quot;BRING-YOUR-OWN-KEY&quot; (BYOK)</h3>
                    <p><strong>5.1 Setup:</strong> The platform incorporates advanced AI features. Licensee may configure their own API keys via the Master Dashboard to assume all AI costs directly. If skipped, requests execute across the Master network and will be evaluated and billed continuously.</p>

                    <h3 className="text-xl font-bold mt-6 mb-2 text-slate-900 dark:text-white">6. INDEMNIFICATION</h3>
                    <p>Licensee agrees to indemnify, defend, and hold harmless Licensor against any claims, losses, damages, or liabilities arising out of Licensee&apos;s marketing efforts, interactions with end-users, or failure to comply with local/federal labor and consumer compliance laws. Licensor accepts no liability for how Franchisee&apos;s end-users consume or manipulate the data software.</p>

                </div>
            </main>
            <LandingFooter />
        </div>
    );
}
