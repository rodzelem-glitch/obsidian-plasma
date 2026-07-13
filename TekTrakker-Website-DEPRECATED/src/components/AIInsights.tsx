import React, { useState } from 'react';
import { EquipmentAsset, ToolMaintenanceLog } from 'types';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface Props {
  equipment: EquipmentAsset;
  logs: ToolMaintenanceLog[];
}

const AIInsights: React.FC<Props> = ({ equipment, logs }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInsight = async () => {
    setLoading(true);
    try {
      const functions = getFunctions();
      const callGeminiAI = httpsCallable(functions, 'callGeminiAI');

      const prompt = `Analyze this industrial equipment and its maintenance history.
      Equipment: ${JSON.stringify(equipment)}
      Maintenance Logs: ${JSON.stringify(logs)}
      
      Provide a concise 3-bullet point prediction for potential future failures and maintenance recommendations.`;

      // Using gemini-3.1-pro-preview for technical reasoning
      const result = await callGeminiAI({ 
        prompt,
        modelName: "gemini-3.1-pro-preview"
      });

      const data = result.data as { text: string };
      setInsight(data.text || 'No insights available.');
    } catch (error) {
      console.error('Error generating AI insights:', error);
      setInsight('Error generating insights. Please check AI service status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/10 dark:border-purple-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-purple-800 dark:text-purple-300">AI Predictive Insights</h2>
        <button 
          onClick={generateInsight}
          disabled={loading}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Analyzing...' : 'Get Predictions'}
        </button>
      </div>

      {insight && (
        <div className="prose prose-sm max-w-none text-purple-900 dark:text-purple-200 bg-white dark:bg-gray-800 p-4 rounded shadow-inner whitespace-pre-wrap">
          {insight}
        </div>
      )}
    </div>
  );
};

export default AIInsights;
