import React from 'react';

export const InputField = ({ label, id, name, type = "text", value, onChange, placeholder, required = false, autoComplete, brandColor }: any) => (
    <div className="mb-5">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">{label}</label>
        <input 
            id={id}
            name={name}
            type={type} 
            value={value} 
            onChange={onChange} 
            required={required}
            placeholder={placeholder}
            autoComplete={autoComplete}
            style={brandColor ? { borderColor: `${brandColor}40` } : {}}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 text-white px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-slate-500 hover:border-slate-600"
        />
    </div>
);

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
