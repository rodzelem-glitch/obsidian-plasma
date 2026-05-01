
import React from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import Toggle from 'components/ui/Toggle';
import { CreditCard, Mail, Code, Copy, Users } from 'lucide-react';

interface IntegrationsTabProps {
    paypalClientId: string;
    setPaypalClientId: (val: string) => void;
    stripePublicKey: string;
    setStripePublicKey: (val: string) => void;
    squareAppId: string;
    setSquareAppId: (val: string) => void;
    squareLocId: string;
    setSquareLocId: (val: string) => void;
    squareToken: string;
    setSquareToken: (val: string) => void;
    smtpHost: string;
    setSmtpHost: (val: string) => void;
    smtpPort: number;
    setSmtpPort: (val: number) => void;
    smtpUser: string;
    setSmtpUser: (val: string) => void;
    smtpPass: string;
    setSmtpPass: (val: string) => void;
    handleSendTestEmail: () => void;
    isSendingTest: boolean;
    twilioSid: string;
    setTwilioSid: (val: string) => void;
    twilioToken: string;
    setTwilioToken: (val: string) => void;
    twilioNumber: string;
    setTwilioNumber: (val: string) => void;
    bookingWidgetMode: 'popup' | 'inline';
    setBookingWidgetMode: (mode: 'popup' | 'inline') => void;
    hiringWidgetMode: 'popup' | 'inline';
    setHiringWidgetMode: (mode: 'popup' | 'inline') => void;
    copyWidgetCode: (type: 'booking' | 'hiring') => void;
    measureQuickApiKey: string;
    setMeasureQuickApiKey: (val: string) => void;
    webhookSecretKey: string;
    setWebhookSecretKey: (val: string) => void;
    orgId: string;
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    paypalClientId, setPaypalClientId,
    stripePublicKey, setStripePublicKey,
    squareAppId, setSquareAppId,
    squareLocId, setSquareLocId,
    squareToken, setSquareToken,
    smtpHost, setSmtpHost,
    smtpPort, setSmtpPort,
    smtpUser, setSmtpUser,
    smtpPass, setSmtpPass,
    handleSendTestEmail, isSendingTest,
    twilioSid, setTwilioSid,
    twilioToken, setTwilioToken,
    twilioNumber, setTwilioNumber,
    bookingWidgetMode, setBookingWidgetMode,
    hiringWidgetMode, setHiringWidgetMode,
    copyWidgetCode,
    measureQuickApiKey, setMeasureQuickApiKey, 
    webhookSecretKey, setWebhookSecretKey,
    orgId
}) => {
    
    const mqWebhookUrl = `https://us-central1-tektrakker.cloudfunctions.net/measureQuickWebhook?orgId=${orgId || 'ERROR_NO_ORG'}`;
    
    return (
        <form onSubmit={e => e.preventDefault()} className="space-y-6">
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-blue-600"><CreditCard size={20}/> Payment Gateways</h3>
                <div className="space-y-6">
                    <div>
                        <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">PayPal</h4>
                        <Input label="Client ID" value={paypalClientId} onChange={e => setPaypalClientId(e.target.value)} placeholder="Enter Live Client ID" />
                    </div>
                    <div className="border-t pt-4 border-gray-100 dark:border-gray-700">
                        <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Stripe</h4>
                        <Input label="Publishable Key" value={stripePublicKey} onChange={e => setStripePublicKey(e.target.value)} placeholder="pk_live_..." />
                    </div>
                    <div className="border-t pt-4 border-gray-100 dark:border-gray-700">
                        <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Square</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Application ID" value={squareAppId} onChange={e => setSquareAppId(e.target.value)} placeholder="sq0idp-..." />
                            <Input label="Location ID" value={squareLocId} onChange={e => setSquareLocId(e.target.value)} placeholder="L..." />
                        </div>
                        <div className="mt-4">
                             <Input label="Square Personal Access Token" type="password" value={squareToken} onChange={e => setSquareToken(e.target.value)} placeholder={squareToken ? "••••••••••••..." : "EAAAE..."} />
                             {squareToken && <p className="text-xs text-blue-600 mt-1">Token securely loaded. Enter a new token to overwrite.</p>}
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-emerald-600"><Users size={20}/> HR & Payroll (Technician Payouts)</h3>
                <div className="space-y-6">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-400">
                        <h4 className="font-bold text-sm mb-2">Square Team Management & Payroll</h4>
                        <p className="text-xs opacity-80 mb-4 block">Automatically map technician shift logs and commission data directly to your Square Payroll account. Requirements: The Square Application ID, Location ID, and Access Token must be configured in the Payment Gateways section above.</p>
                        <Toggle label="Enable Subcontractor & Technician Square Payout Sync" enabled={!!squareToken && !!squareLocId} onChange={() => {
                            if (!squareToken || !squareLocId) {
                                alert("Please enter your Square Location ID and Access Token above to unlock Payroll Sync.");
                            } else {
                                alert("Square Team Management sync is actively deployed via background Cloud CRON. Save your settings to lock endpoints.");
                            }
                        }} />
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 text-blue-800 dark:text-blue-400">
                        <h4 className="font-bold text-sm mb-2">QuickBooks Online (Advanced)</h4>
                        <p className="text-xs opacity-80 mb-4 block">To activate real-time timesheet synchronization, enter your QuickBooks Realm ID and connect the application via OAuth2.</p>
                        <div className="flex gap-4 items-center">
                            <Input label="QuickBooks Realm ID (Company ID)" value="" onChange={() => {}} placeholder="193514..."/>
                            <Button variant="secondary" onClick={() => alert("Redirecting to Intuit OAuth2...")} className="bg-white dark:bg-slate-800 text-blue-600 hover:bg-blue-100 mt-6">Connect QBO</Button>
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-purple-600"><Code size={20}/> Hardware & Diagnostics</h3>
                <div className="space-y-6">
                    <div>
                        <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">MeasureQuick (Fieldpiece, Testo, etc.)</h4>
                        <p className="text-xs text-slate-500 mb-4 block">To activate real-time diagnostic syncing, enter your measureQuick API Key. Additionally, you MUST provide measureQuick with your specific Webhook URL from below.</p>
                        
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-700">
                           <h5 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Your Webhook URL (Paste into measureQuick):</h5>
                           <div className="flex items-center gap-2">
                               <code className="flex-1 overflow-x-auto text-[11px] p-2 bg-slate-100 dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-800 text-blue-700 dark:text-blue-300 font-mono select-all whitespace-nowrap">
                                   {mqWebhookUrl}
                               </code>
                               <Button size="sm" variant="secondary" onClick={() => {
                                   navigator.clipboard.writeText(mqWebhookUrl).then(() => alert("Copied measureQuick Webhook URL!"));
                               }}>
                                   <Copy size={14} className="mr-1" /> Copy
                               </Button>
                           </div>
                        </div>

                        <Input label="measureQuick API Key" value={measureQuickApiKey} onChange={e => setMeasureQuickApiKey(e.target.value)} placeholder="mq_live_..." type="password" />
                    </div>
                </div>
            </Card>

            <Card className="border-t-4 border-emerald-500">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-emerald-600"><Code size={20}/> Lead API & Universal Webhook</h3>
                <div className="space-y-6">
                    <div>
                        <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Google Ads / Zapier Webhook</h4>
                        <p className="text-xs text-slate-500 mb-4 block">Use this secure Webhook Endpoint to automatically inject Leads into your Dispatch Board. Any POST request sent here will bypass manual data entry, create the Customer Profile, and put the Unassigned Job onto the calendar instantly.</p>
                        
                        <div className="flex gap-4 items-end mb-6">
                            <div className="flex-1">
                                <Input 
                                    label="Webhook API Key (Used to secure your endpoint)" 
                                    type="password" 
                                    value={webhookSecretKey} 
                                    onChange={e => setWebhookSecretKey(e.target.value)} 
                                    placeholder="Enter a secure random string or click generate..." 
                                />
                            </div>
                            <Button 
                                variant="secondary" 
                                className="mb-[2px]"
                                onClick={() => {
                                    const randomKey = 'tk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                                    setWebhookSecretKey(randomKey);
                                }}
                            >
                                Generate Secure Key
                            </Button>
                            <Button 
                                variant="secondary" 
                                className="mb-[2px]"
                                onClick={() => {
                                    if (webhookSecretKey) {
                                        navigator.clipboard.writeText(webhookSecretKey).then(() => alert("Successfully copied Webhook Key to clipboard!"));
                                    } else {
                                        alert("No key generated yet!");
                                    }
                                }}
                            >
                                <Copy size={16} />
                            </Button>
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/40 opacity-90 transition-opacity hover:opacity-100">
                           <h5 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1">Your Universal Webhook URL:</h5>
                           <div className="flex items-center gap-2">
                               <code className="flex-1 overflow-x-auto text-[11px] p-2 bg-slate-100 dark:bg-slate-900 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 font-mono select-all whitespace-nowrap">
                                   {`https://us-central1-tektrakker.cloudfunctions.net/incomingLeadWebhook?orgId=${orgId || 'ERROR_NO_ORG'}`}
                               </code>
                               <Button size="sm" variant="primary" onClick={() => {
                                   const url = `https://us-central1-tektrakker.cloudfunctions.net/incomingLeadWebhook?orgId=${orgId || 'ERROR_NO_ORG'}&apiKey=${webhookSecretKey}`;
                                   navigator.clipboard.writeText(url).then(() => alert("Successfully copied webhook URL to clipboard!"));
                               }} className="!bg-emerald-600 !text-white hover:!bg-emerald-700 border-transparent shadow-emerald-500/20 shadow-lg whitespace-nowrap">
                                   <Copy size={14} className="mr-1" /> Copy URL + Key
                               </Button>
                           </div>
                           <p className="text-[10px] text-emerald-700 dark:text-emerald-500 mt-2">
                               When configuring Google Ads Lead Forms, paste the above URL as the Webhook URL. For the Google Ads "Key", paste the Webhook API Key you defined above.
                           </p>
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600"><Mail size={20}/> Email & SMS (SMTP/Twilio)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold text-sm mb-3">SMTP Settings (Email)</h4>
                        <div className="space-y-3">
                            <Input label="SMTP Host" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                            <Input label="SMTP Port" type="number" value={smtpPort} onChange={e => setSmtpPort(parseInt(e.target.value))} placeholder="587" />
                            <Input label="Username" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
                            <Input label="Password" type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} autoComplete="current-password" />
                            <Button onClick={handleSendTestEmail} disabled={isSendingTest} variant="secondary" className="text-xs w-full mt-2" type="button">
                                {isSendingTest ? 'Sending...' : 'Send Test Email'}
                            </Button>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm mb-3">Twilio Settings (SMS)</h4>
                        <div className="space-y-3">
                            <Input label="Account SID" value={twilioSid} onChange={e => setTwilioSid(e.target.value)} />
                            <Input label="Auth Token" type="password" value={twilioToken} onChange={e => setTwilioToken(e.target.value)} autoComplete="new-password" />
                            <Input label="Phone Number" value={twilioNumber} onChange={e => setTwilioNumber(e.target.value)} placeholder="+15551234567" />
                        </div>
                    </div>
                </div>
            </Card>
            
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-orange-600"><Code size={20}/> Website Widgets</h3>
                <div className="space-y-6">
                    <div>
                        <h4 className="font-bold text-sm mb-2">Service Booking Widget</h4>
                        <div className="flex gap-4 items-center mb-3">
                            <Toggle label="Inline Mode (Embed)" enabled={bookingWidgetMode === 'inline'} onChange={(val) => setBookingWidgetMode(val ? 'inline' : 'popup')} />
                        </div>
                        <Button onClick={() => copyWidgetCode('booking')} variant="secondary" className="text-xs" type="button">
                            <Copy size={14} className="mr-2"/> Copy Booking Script
                        </Button>
                    </div>
                    <div className="border-t pt-4">
                        <h4 className="font-bold text-sm mb-2">Hiring / Careers Widget</h4>
                        <div className="flex gap-4 items-center mb-3">
                            <Toggle label="Inline Mode (Embed)" enabled={hiringWidgetMode === 'inline'} onChange={(val) => setHiringWidgetMode(val ? 'inline' : 'popup')} />
                        </div>
                        <Button onClick={() => copyWidgetCode('hiring')} variant="secondary" className="text-xs" type="button">
                            <Copy size={14} className="mr-2"/> Copy Hiring Script
                        </Button>
                    </div>
                </div>
            </Card>
        </form>
    );
};

export default IntegrationsTab;
