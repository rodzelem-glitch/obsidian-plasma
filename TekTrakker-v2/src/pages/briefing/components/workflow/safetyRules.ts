import { Job, User } from '../../../../types';

export interface JobSafetyContext {
  careerField: string;
  isCommercial: boolean;
  jobScale: 'Basic' | 'Standard' | 'Heavy';
  summary: string;
}

export const extractJobSafetyContext = (job: Job, technician: User | null): JobSafetyContext => {
  const careerField = (technician as any)?.careerField || 'General';
  
  const jobText = `${job.title} ${job.description || ''} ${job.customerName || ''} ${job.address || ''}`.toLowerCase();
  const isCommercial = jobText.includes('inc') || 
                       jobText.includes('corp') || 
                       jobText.includes('commercial') || 
                       jobText.includes('warehouse') || 
                       jobText.includes('suite');

  let jobScale: 'Basic' | 'Standard' | 'Heavy' = 'Standard';
  const estimatedCost = job.invoice?.totalAmount || job.invoice?.amount || 0;
  
  if (estimatedCost < 300 && (jobText.includes('basic') || jobText.includes('maintenance') || jobText.includes('filter'))) {
    jobScale = 'Basic';
  } else if (estimatedCost > 5000 || jobText.includes('install') || jobText.includes('replacement')) {
    jobScale = 'Heavy';
  }

  return {
    careerField,
    isCommercial,
    jobScale,
    summary: `${job.title}: ${job.description || 'Basic Service'}`
  };
};

export const generateSafetyPrompt = (context: JobSafetyContext): string => {
  return `
You are an expert field operations safety manager at TekTrakker.
Generate a SINGLE, warm, conversational safety tip (max 2 sentences) for a technician based on these specifications:

- Technician Trade: ${context.careerField} (STRICT LIMITATION: Do NOT give advice outside this trade!)
- Scale: ${context.jobScale}
- Location Environment: ${context.isCommercial ? 'Commercial Facility' : 'Residential Home'}
- Job Overview: ${context.summary}

RULES FOR ADVICE LEVEL:
1. If Scale is 'Basic' and Environment is 'Residential', keep it light and basic (e.g., proper lift posture, checking for pets/slips, basic tool safety). Do NOT suggest heavy commercial gear, lockout-tagout panels, or respirators.
2. Ensure the advice is friendly, encouraging, and written as a passive "pro-tip reminder" rather than a blocker.
3. Start with an appropriate emoji corresponding to the trade (e.g. ⚡ for Electrician, 🪠 for Plumber, ❄️ for HVAC, 🔧 for Appliance/General).

Response format: Output ONLY the 2-sentence tip. No extra conversational filler.
`.trim();
};
