import React from 'react';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import LandingChatbot from '../components/LandingChatbot';

export default function EULAPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <LandingHeader />
            
            <header className="pt-40 pb-20 px-6 bg-slate-950 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-600/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">End User License Agreement</h1>
                    <p className="text-xl text-slate-400 mb-10">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                </div>
            </header>

            <section className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <div className="prose prose-lg prose-slate text-slate-600">
                        <p className="lead">
                            This End User License Agreement (&quot;EULA&quot;) is a legal agreement between you (&quot;User&quot; or &quot;You&quot;) and TekTrakker Inc. (&quot;Company,&quot; &quot;We,&quot; or &quot;Us&quot;) governing your use of the TekTrakker software, web applications, mobile applications, and associated services (collectively, the &quot;Software&quot;).
                        </p>
                        
                        <p>
                            By installing, copying, or otherwise using the Software, you agree to be bound by the terms of this EULA. If you do not agree to the terms of this EULA, do not install or use the Software.
                        </p>

                        <h3>1. Grant of License</h3>
                        <p>
                            Subject to your compliance with the terms of this EULA, TekTrakker grants you a revocable, non-exclusive, non-transferable, limited license to download, install, and use the Software strictly in accordance with the terms of this Agreement and our Terms of Service.
                        </p>

                        <h3>2. Restrictions on Use</h3>
                        <p>
                            You agree not to, and you will not permit others to:
                        </p>
                        <ul>
                            <li>License, sell, rent, lease, assign, distribute, transmit, host, outsource, disclose or otherwise commercially exploit the Software.</li>
                            <li>Modify, make derivative works of, disassemble, decrypt, reverse compile or reverse engineer any part of the Software.</li>
                            <li>Remove, alter or obscure any proprietary notice (including any notice of copyright or trademark) of TekTrakker or its affiliates, partners, suppliers or the licensors of the Software.</li>
                            <li>Use the Software for any purpose that is illegal or prohibited by this Agreement.</li>
                        </ul>

                        <h3>3. Intellectual Property</h3>
                        <p>
                            The Software, including without limitation all copyrights, patents, trademarks, trade secrets, and other intellectual property rights are, and shall remain, the sole and exclusive property of TekTrakker Inc.
                        </p>

                        <h3>4. Updates and Maintenance</h3>
                        <p>
                            TekTrakker may from time to time provide enhancements or improvements to the features/functionality of the Software, which may include patches, bug fixes, updates, upgrades, and other modifications (&quot;Updates&quot;). Updates may modify or delete certain features and/or functionalities of the Software. You agree that TekTrakker has no obligation to (i) provide any Updates, or (ii) continue to provide or enable any particular features and/or functionalities of the Software to you.
                        </p>

                        <h3>5. Term and Termination</h3>
                        <p>
                            This EULA shall remain in effect until terminated by you or TekTrakker. TekTrakker may, in its sole discretion, at any time and for any or no reason, suspend or terminate this EULA with or without prior notice. This EULA will terminate immediately, without prior notice from TekTrakker, in the event that you fail to comply with any provision of this EULA.
                        </p>

                        <h3>6. Limitation of Liability</h3>
                        <p>
                            Notwithstanding any damages that you might incur, the entire liability of TekTrakker and any of its suppliers under any provision of this EULA and your exclusive remedy for all of the foregoing shall be limited to the amount actually paid by you for the Software. To the maximum extent permitted by applicable law, in no event shall TekTrakker or its suppliers be liable for any special, incidental, indirect, or consequential damages whatsoever.
                        </p>

                        <h3>7. Contact Information</h3>
                        <p>
                            If you have any questions about this EULA, please contact us at legal@tektrakker.com.
                        </p>
                    </div>
                </div>
            </section>

            <LandingFooter />
            <LandingChatbot />
        </div>
    );
}
