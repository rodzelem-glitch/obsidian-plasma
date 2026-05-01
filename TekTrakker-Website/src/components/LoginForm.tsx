import React from 'react';
import { InputField } from './AuthFields';
import { Users, Building2, UserCircle } from 'lucide-react';

interface LoginFormProps {
    email: string;
    setEmail: (val: string) => void;
    password: string;
    setPassword: (val: string) => void;
    handleLogin: (e: React.FormEvent) => void;
    handleGoogleLogin?: () => void;
    isLoading: boolean;
    brandColor: string;
    setView: (view: any) => void;
    setUserType: (type: any) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
    email, setEmail, password, setPassword, handleLogin, handleGoogleLogin, isLoading, brandColor, setView, setUserType
}) => (
    <form onSubmit={handleLogin} className="space-y-4">
        <InputField id="email" name="email" type="email" label="Email Address" value={email} onChange={(e: any) => setEmail(e.target.value)} required autoComplete="off" brandColor={brandColor} />
        <InputField id="password" name="password" type="password" label="Password" value={password} onChange={(e: any) => setPassword(e.target.value)} required autoComplete="new-password" brandColor={brandColor} />
        
        <div className="flex justify-end mb-4">
            <button type="button" onClick={() => setView('forgot_password')} className="text-xs text-blue-400 hover:text-blue-300 font-bold">Forgot Password?</button>
        </div>

        <style>{`.login-btn { background-color: ${brandColor}; }`}</style>
        <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 login-btn"
        >
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign In'}
        </button>

        {handleGoogleLogin && (
            <button 
                type="button" 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full mt-4 py-4 rounded-xl font-bold text-slate-800 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Sign in with Google
            </button>
        )}

        <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-center text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4">Create New Account</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <button 
                    type="button" 
                    onClick={() => { setView('register_user'); setUserType('customer'); }} 
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600 transition-all group"
                >
                    <UserCircle className="w-5 h-5 mb-2 text-slate-400 group-hover:text-blue-400 transition-colors" />
                    <span className="text-[10px] font-bold">Customer</span>
                </button>

                <button 
                    type="button" 
                    onClick={() => { setView('register_user'); setUserType('staff'); }} 
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600 transition-all group"
                >
                    <Users className="w-5 h-5 mb-2 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                    <span className="text-[10px] font-bold">Employee</span>
                </button>

                <button 
                    type="button" 
                    onClick={() => setView('register_business')} 
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600 transition-all group"
                >
                    <Building2 className="w-5 h-5 mb-2 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-[10px] font-bold">Business</span>
                </button>
            </div>
        </div>
    </form>
);
