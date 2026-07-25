"use client";

import React from 'react';

export default function CloseButton() {
    return (
        <button 
            onClick={() => window.close()} 
            className="text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors text-slate-800 dark:text-slate-200"
        >
            Close Window
        </button>
    );
}
