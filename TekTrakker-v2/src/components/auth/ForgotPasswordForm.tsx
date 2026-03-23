import React from 'react';
import { InputField } from './AuthFields';

interface ForgotPasswordFormProps {
    email: string;
    setEmail: (val: string) => void;
    handleForgotPassword: (e: React.FormEvent) => void;
    isLoading: boolean;
    brandColor: string;
    setView: (view: any) => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
    email, setEmail, handleForgotPassword, isLoading, brandColor, setView
}) => (
    <form onSubmit={handleForgotPassword} className="space-y-4">
        <p className="text-sm text-slate-400 mb-4">Enter your email address and we will send you a link to reset your password.</p>
        <InputField id="email" name="email" type="email" label="Email Address" value={email} onChange={(e: any) => setEmail(e.target.value)} required brandColor={brandColor} />
        <button type="submit" disabled={isLoading} className="w-full py-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-50 shadow-lg shadow-blue-500/20 transition-all">
            {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
        <button type="button" onClick={() => setView('login')} className="w-full text-xs text-slate-500 hover:text-white mt-4">Back to Login</button>
    </form>
);
