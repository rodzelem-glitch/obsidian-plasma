
import React from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import Toggle from 'components/ui/Toggle';
import { CreditCard, Mail, Code, Copy } from 'lucide-react';

interface IntegrationsTabProps {
    paypalClientId: string;
    setPaypalClientId: (val: string) => void;
    stripePublicKey: string;
    setStripePublicKey: (val: string) => void;
    squareAppId: string;
    setSquareAppId: (val: string) => void;
    squareLocId: string;
    setSquareLocId: (val: string) => void;
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
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    paypalClientId, setPaypalClientId,
    stripePublicKey, setStripePublicKey,
    squareAppId, setSquareAppId,
    squareLocId, setSquareLocId,
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
    copyWidgetCode
}) => {
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
