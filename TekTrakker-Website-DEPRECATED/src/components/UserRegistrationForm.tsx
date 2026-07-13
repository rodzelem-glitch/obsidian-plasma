import React from 'react';
import { InputField, SelectField } from './AuthFields';

interface UserRegistrationFormProps {
    userType: 'staff' | 'customer';
    setUserType: (type: 'staff' | 'customer') => void;
    userName: string;
    setUserName: (val: string) => void;
    userPhone: string;
    setUserPhone: (val: string) => void;
    email: string;
    setEmail: (val: string) => void;
    password: string;
    setPassword: (val: string) => void;
    userAddress: string;
    setUserAddress: (val: string) => void;
    userCity: string;
    setUserCity: (val: string) => void;
    userState: string;
    setUserState: (val: string) => void;
    userZip: string;
    setUserZip: (val: string) => void;
    userServiceNeed: string;
    setUserServiceNeed: (val: string) => void;
    consentGiven: boolean;
    setConsentGiven: (val: boolean) => void;
    handleRegisterUser: (e: React.FormEvent) => void;
    isLoading: boolean;
    brandColor: string;
    setView: (view: any) => void;
}

export const UserRegistrationForm: React.FC<UserRegistrationFormProps> = ({
    userType, setUserType, userName, setUserName, userPhone, setUserPhone,
    email, setEmail, password, setPassword, userAddress, setUserAddress,
    userCity, setUserCity, userState, setUserState, userZip, setUserZip,
    userServiceNeed, setUserServiceNeed, consentGiven, setConsentGiven,
    handleRegisterUser, isLoading, brandColor, setView
}) => (
    <form onSubmit={handleRegisterUser} className="space-y-4">
        {/* Tabs removed as userType is now passed from the previous selection */}

        <InputField id="full-name" name="name" label="Full Name" value={userName} onChange={(e: any) => setUserName(e.target.value)} required brandColor={brandColor} />
        <InputField id="user-phone" name="phone" type="tel" label="Mobile Phone" value={userPhone} onChange={(e: any) => setUserPhone(e.target.value)} required brandColor={brandColor} />
        <InputField id="email" name="email" type="email" label="Email Address" value={email} onChange={(e: any) => setEmail(e.target.value)} required brandColor={brandColor} />
        <InputField id="password" name="password" type="password" label="Create Password" value={password} onChange={(e: any) => setPassword(e.target.value)} required autoComplete="new-password" brandColor={brandColor} />

        {userType === 'customer' && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Service Location</p>
                <InputField id="address" name="address" label="Street Address" value={userAddress} onChange={(e: any) => setUserAddress(e.target.value)} brandColor={brandColor} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <InputField id="city" name="city" label="City" value={userCity} onChange={(e: any) => setUserCity(e.target.value)} brandColor={brandColor} />
                    <InputField id="state" name="state" label="State" value={userState} onChange={(e: any) => setUserState(e.target.value)} brandColor={brandColor} />
                    <InputField id="zip" name="zip" label="Zip" value={userZip} onChange={(e: any) => setUserZip(e.target.value)} brandColor={brandColor} />
                </div>
                <SelectField 
                    id="service-need" 
                    label="Primary Interest" 
                    value={userServiceNeed} 
                    onChange={(e: any) => setUserServiceNeed(e.target.value)} 
                    options={[
                        { value: 'Repair', label: 'Repairs & Service' },
                        { value: 'Install', label: 'New Installation' },
                        { value: 'Maintenance', label: 'Maintenance Plan' },
                        { value: 'Community', label: 'Community / Other' }
                    ]}
                    brandColor={brandColor}
                />
            </div>
        )}
        
        <div className="flex items-start gap-3 mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <input type="checkbox" id="consent" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)} className="mt-1 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" />
            <label htmlFor="consent" className="text-xs text-slate-400">
                I agree to the <a href="#/terms" target="_blank" className="text-blue-400 hover:underline">Terms of Service</a> and consent to receive automated SMS/Email notifications regarding my account and services.
            </label>
        </div>

        <style>{`.reg-brand-button { background-color: ${brandColor}; }`}</style>
        <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform mt-6 reg-brand-button"
        >
            {isLoading ? 'Creating Account...' : 'Register'}
        </button>
        <button type="button" onClick={() => setView('login')} className="w-full text-xs text-slate-500 hover:text-white mt-4">Back to Login</button>
    </form>
);
