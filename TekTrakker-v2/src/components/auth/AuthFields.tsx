import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const InputField = ({ label, id, name, type = "text", value, onChange, placeholder, required = false, autoComplete, brandColor }: any) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
        <div className="mb-5">
            <label htmlFor={id} className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">{label}</label>
            <div className="relative">
                <input 
                    id={id}
                    name={name}
                    type={inputType} 
                    value={value} 
                    onChange={onChange} 
                    required={required}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    style={brandColor ? { borderColor: `${brandColor}40` } : {}}
                    className={`w-full rounded-lg bg-slate-800 border border-slate-700 text-white ${isPassword ? 'pl-4 pr-12' : 'px-4'} py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-500 hover:border-slate-600`}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                        title={showPassword ? "Hide password" : "Show password"}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
        </div>
    );
};

export const SelectField = ({ label, id, value, onChange, options, required = false, brandColor }: any) => (
    <div className="mb-5">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">{label}</label>
        <select 
            id={id}
            value={value} 
            onChange={onChange} 
            required={required}
            style={brandColor ? { borderColor: `${brandColor}40` } : {}}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-500 hover:border-slate-600"
        >
            {options.map((opt: any) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);
