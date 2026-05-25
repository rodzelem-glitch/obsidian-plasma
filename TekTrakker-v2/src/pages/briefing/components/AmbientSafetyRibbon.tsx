import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { extractJobSafetyContext, generateSafetyPrompt } from './workflow/safetyRules';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Job, User } from '../../../types';

interface AmbientSafetyRibbonProps {
  job: Job;
  currentUser: User | null;
}

export const AmbientSafetyRibbon: React.FC<AmbientSafetyRibbonProps> = ({ job, currentUser }) => {
  const [safetyTip, setSafetyTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchSafetyTip = async () => {
      setLoading(true);
      try {
        const context = extractJobSafetyContext(job, currentUser);
        
        // Cache tips in session storage to avoid unnecessary AI requests
        const cachedTip = sessionStorage.getItem(`safety_tip_${job.id}`);
        if (cachedTip) {
          setSafetyTip(cachedTip);
          return;
        }

        const functions = getFunctions();
        const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
        const prompt = generateSafetyPrompt(context);

        const result = await callGeminiAI({
          prompt,
          modelName: "gemini-3.5-flash"
        });

        const tip = (result.data as { text: string }).text.trim();
        setSafetyTip(tip);
        sessionStorage.setItem(`safety_tip_${job.id}`, tip);
      } catch (err) {
        console.error("Failed to generate passive safety reminder:", err);
        // Fail silently so we never interrupt the technician's active job screen
      } finally {
        setLoading(false);
      }
    };

    fetchSafetyTip();
  }, [job, currentUser]);

  if (!safetyTip && !loading) return null;

  return (
    <div className="mx-5 mt-4 overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 transition-all duration-300">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Glow indicator changes color slightly */}
        <div className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 shrink-0">
            Safety Co-Pilot
          </span>
          <span className="text-slate-300 dark:text-slate-700 shrink-0">|</span>
          
          {loading ? (
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-48 animate-pulse" />
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate leading-none">
              {safetyTip}
            </p>
          )}
        </div>
        
        <Shield size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
      </div>
    </div>
  );
};

export default AmbientSafetyRibbon;
