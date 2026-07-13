
import React from 'react';
import { ShieldCheck, FileText } from 'lucide-react';

const EULA: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 shadow-xl rounded-2xl overflow-hidden">
                <div className="bg-slate-900 text-white p-4 md:p-8">
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldCheck className="text-primary-400" size={32} />
                        <h1 className="text-3xl font-black tracking-tight">End User License Agreement (EULA)</h1>
                    </div>
                    <p className="text-slate-400">Last Updated: October 26, 2024</p>
                </div>
                
                <div className="p-4 md:p-8 space-y-8 text-slate-600 dark:text-slate-300 leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">1. Acceptance of Terms</h2>
                        <p>By downloading, installing, or using the TekTrakker software platform ("Software"), you agree to be bound by the terms of this End User License Agreement ("Agreement"). If you do not agree to the terms of this Agreement, do not install or use the Software.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">2. Grant of License</h2>
                        <p>TekTrakker grants you a revocable, non-exclusive, non-transferable, limited license to download, install, and use the Software solely for your personal or internal business purposes strictly in accordance with the terms of this Agreement.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">3. Restrictions</h2>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>You agree not to license, sell, rent, lease, assign, distribute, transmit, host, outsource, disclose, or otherwise commercially exploit the Software.</li>
                            <li>You agree not to modify, make derivative works of, disassemble, decrypt, reverse compile, or reverse engineer any part of the Software.</li>
                            <li>You agree not to remove, alter, or obscure any proprietary notice (including any notice of copyright or trademark) of TekTrakker or its affiliates.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">4. Intellectual Property</h2>
                        <p>The Software, including without limitation all copyrights, patents, trademarks, trade secrets, and other intellectual property rights are, and shall remain, the sole and exclusive property of TekTrakker.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">5. Data Privacy & Security</h2>
                        <p>TekTrakker values your privacy. Usage of the Software is also governed by our Privacy Policy. You agree that we may collect and use technical data and related information to improve our products and providing services to you.</p>
                        <p className="mt-2">For commercial users: You retain ownership of your business data (customer lists, pricing, etc.). TekTrakker creates backups and security measures but does not claim ownership of your generated content.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">6. Artificial Intelligence Services</h2>
                        <p>The Software includes generative artificial intelligence (AI) features. TekTrakker reserves the complete and unconditional right to restrict, rate-limit, monitor, suspend, or revoke access to any AI functionalities at any time, with or without prior notice, at our sole discretion, in order to manage platform costs or prevent abuse.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">7. Termination</h2>
                        <p>This Agreement shall remain in effect until terminated by you or TekTrakker. TekTrakker may, in its sole discretion, at any time and for any or no reason, suspend or terminate this Agreement with or without prior notice.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">8. Limitation of Liability</h2>
                        <p>In no event shall TekTrakker be liable for any special, incidental, indirect, or consequential damages whatsoever (including, but not limited to, damages for loss of profits, for loss of data or other information, for business interruption, for personal injury, for loss of privacy arising out of or in any way related to the use of or inability to use the Software).</p>
                    </section>

                    <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-sm font-bold">TekTrakker Platform Inc.</p>
                        <p className="text-sm">platform@tektrakker.com</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EULA;
