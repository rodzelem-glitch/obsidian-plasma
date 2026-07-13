
import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if already installed or dismissed recently (optional logic, keeping simple for now)
      setIsVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 z-50 animate-fade-in">
        <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-4 rounded-xl shadow-2xl flex items-center justify-between border border-gray-700 dark:border-gray-200">
            <div className="flex items-center gap-3">
                <div className="bg-primary-600 p-2 rounded-lg text-white">
                    <Download size={20} />
                </div>
                <div>
                    <p className="font-bold text-sm">Install TekTrakker</p>
                    <p className="text-xs opacity-80">Add to home screen for offline access</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setIsVisible(false)} 
                    className="p-1.5 text-gray-400 hover:text-white dark:hover:text-gray-600 transition-colors"
                >
                    <X size={18} />
                </button>
                <button 
                    onClick={handleInstall} 
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                    Install
                </button>
            </div>
        </div>
    </div>
  );
};

export default PWAInstallPrompt;
