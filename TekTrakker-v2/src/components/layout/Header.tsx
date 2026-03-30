
import React, { useState, useEffect } from 'react';
import type { User } from 'types';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
// import { Html5QrcodeScanner } from 'html5-qrcode'; // Commented out to prevent crash
import { QrCode, X, User as UserIcon } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { auth } from 'lib/firebase';
import { Logo } from '../ui/Logo';
import EmployeeProfileModal from '../modals/EmployeeProfileModal';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const myNotifications = state.notifications.filter(n => n.userId === user.id);
  const unreadCount = myNotifications.filter(n => !n.read).length;
  
  const companyName = state.currentOrganization?.name || 'TekTrakker';

  const toggleTheme = () => {
      dispatch({ type: 'TOGGLE_THEME' });
  };

    useEffect(() => {
        let isMounted = true;
        let html5QrCode: any = null;

        const startScanner = async () => {
            if (!isScannerOpen) return;
            
            // Wait for the DOM to render the qr-reader div
            let attempts = 0;
            while (!document.getElementById('qr-reader') && attempts < 10) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }

            const container = document.getElementById('qr-reader');
            if (!container) {
                console.error("Scanner container #qr-reader not found after 1s");
                return;
            }

            if (window.isSecureContext === false && !window.location.hostname.includes('localhost')) {
                container.innerHTML = "<div class='p-4 text-red-500 text-center'>HTTPS Required for Camera</div>";
                return;
            }
            
            try {
                const { Camera } = await import('@capacitor/camera');
                const permission = await Camera.requestPermissions({ permissions: ['camera'] });
                if (permission.camera !== 'granted') {
                    container.innerHTML = "<div class='p-4 text-red-500 text-center'>Camera Permission Denied</div>";
                    return;
                }
            } catch (e) {
                console.warn("Capacitor Camera permissions check skipped.");
            }

            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                if (!isMounted) return;
                
                html5QrCode = new Html5Qrcode("qr-reader");
                
                const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };
                
                // Try to find a back camera
                const devices = await Html5Qrcode.getCameras();
                let cameraId = null;
                if (devices && devices.length > 0) {
                    const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
                    cameraId = backCamera ? backCamera.id : devices[0].id;
                }

                const startConfig = cameraId ? cameraId : { facingMode: "environment" };

                await html5QrCode.start(
                    startConfig, 
                    qrConfig,
                    (decodedText: string) => {
                        const cleanText = decodedText.trim();
                        let matched = false;

                        // 1. Asset URL Check (QR Code)
                        if (cleanText.includes('/#/asset/')) {
                            const parts = cleanText.split('/#/asset/');
                            if (parts.length > 1) {
                                navigate(`/asset/${parts[1]}`);
                                matched = true;
                            }
                        } 
                        
                        if (!matched) {
                            // 2. Inventory Check (SKU or Barcode)
                            const inventoryItem = state.inventory.find(i => 
                                (i.sku && i.sku.toLowerCase() === cleanText.toLowerCase()) ||
                                (i.barcode && i.barcode === cleanText)
                            );
                            if (inventoryItem) {
                                navigate(`/admin/records?tab=inventory&search=${encodeURIComponent(cleanText)}`);
                                matched = true;
                            }
                        }

                        if (!matched) {
                            // 3. Vehicle Check (ID, License, Barcode)
                            const vehicle = state.vehicles.find(v => 
                                v.licensePlate.toLowerCase() === cleanText.toLowerCase() ||
                                v.vin?.toLowerCase() === cleanText.toLowerCase() ||
                                v.barcode === cleanText
                            );
                            if (vehicle) {
                                navigate(`/admin/records?tab=fleet&search=${encodeURIComponent(cleanText)}`);
                                matched = true;
                            }
                        }

                        if (!matched) {
                            // 4. Asset Direct Check (Serial or ID)
                            const cleanTextLower = cleanText.toLowerCase();
                            for (const customer of state.customers) {
                                if (customer.equipment) {
                                    const asset = customer.equipment.find(e => 
                                        e.id === cleanText || e.serial.toLowerCase() === cleanTextLower
                                    );
                                    if (asset) {
                                        navigate(`/asset/${customer.id}?assetId=${asset.id}`);
                                        matched = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (matched) {
                            html5QrCode.stop().then(() => setIsScannerOpen(false)).catch(() => setIsScannerOpen(false));
                        } else {
                            if (confirm(`No direct match found for "${cleanText}". Search inventory/records globally?`)) {
                                navigate(`/admin/records?tab=inventory&search=${encodeURIComponent(cleanText)}`);
                                html5QrCode.stop().then(() => setIsScannerOpen(false)).catch(() => setIsScannerOpen(false));
                            }
                        }
                    },
                    (errorMessage: string) => {
                        // Scan errors are normal when no QR code is in view
                    }
                );
            } catch (err: any) {
                console.error("Scanner failed to start", err);
                if (container) {
                    container.innerHTML = `<div class='p-4 text-red-500 text-center text-sm'>${err.message || 'Camera Error'}</div>`;
                }
            }
        };

        if (isScannerOpen) {
            startScanner();
        }
        
        return () => { 
            isMounted = false;
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(() => {});
            }
        };
    }, [isScannerOpen, navigate, state.inventory, state.vehicles, state.customers]);

  // Helper to check if user has access to Admin layout
  const canSeeAdmin = user.role === 'both' || user.role === 'supervisor' || user.role === 'admin' || user.role === 'master_admin';

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md fixed top-0 w-full z-[100] border-b border-gray-200 dark:border-gray-700 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
              <Logo className="h-12 w-auto" />
              {/* Optional Org Name Badge */}
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded hidden md:block max-w-[200px] truncate">
                  {companyName}
              </span>
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={() => setIsScannerOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title="Scan QR/Barcode" aria-label="Scan QR Code"><QrCode className="w-6 h-6" /></button>
            <button onClick={() => setIsProfileModalOpen(true)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title="My Profile" aria-label="My Profile"><UserIcon className="w-6 h-6" /></button>
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title="Toggle Theme" aria-label="Toggle Theme">
                {state.theme === 'dark' ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>}
            </button>

            <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 relative" title="Notifications" aria-label="Notifications">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                    {unreadCount > 0 && <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">{unreadCount}</span>}
                </button>
                {showNotifications && (
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setShowNotifications(false)}></div>
                        <div className="fixed top-16 right-4 w-80 max-w-[calc(100vw-20px)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-[75vh]">
                            <div className="p-3 border-b border-gray-200 dark:border-gray-700 font-bold text-gray-800 dark:text-white flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                                <span>Notifications</span>
                                {unreadCount > 0 && <span className="text-xs font-normal text-blue-500 cursor-pointer" onClick={() => dispatch({type: 'MARK_ALL_READ', payload: user.id})}>Mark all read</span>}
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                {myNotifications.length === 0 ? <div className="p-4 md:p-8 text-center text-gray-500 text-sm">No new alerts</div> : myNotifications.map(n => (
                                    <div key={n.id} className={`p-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${!n.read ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`} onClick={() => { dispatch({type:'MARK_NOTIFICATION_READ', payload: n.id}); if(n.link) navigate(n.link); setShowNotifications(false); }}>
                                        <p className="font-semibold text-gray-800 dark:text-white">{n.title}</p>
                                        <p className="text-gray-500 dark:text-gray-400 mt-1">{n.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {canSeeAdmin && (
                <button onClick={() => navigate('/admin/dashboard')} className="text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-600 px-3 py-1 rounded hover:bg-primary-50">Admin</button>
            )}
            <button onClick={onLogout} className="text-xs font-medium text-gray-600 dark:text-gray-300">Log Out</button>
          </div>
        </div>
      </div>

      {isScannerOpen && (
          <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4">
              <button 
                  onClick={() => setIsScannerOpen(false)} 
                  className="absolute top-4 right-4 text-white p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors" 
                  aria-label="Close Scanner"
              >
                  <X size={24} />
              </button>
              <h2 className="text-white text-xl font-bold mb-4">Scan QR or Barcode</h2>
              <div id="qr-reader" className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-8 text-center text-slate-500 animate-pulse">
                      Initializing camera...
                  </div>
              </div>
              <p className="text-slate-400 mt-6 text-sm text-center max-w-xs">
                  Position the code within the frame to scan automatically.
              </p>
          </div>
      )}

      {isProfileModalOpen && (
          <EmployeeProfileModal 
              isOpen={true} 
              onClose={() => setIsProfileModalOpen(false)} 
              employee={user}
              isSelf={true}
          />
      )}
    </header>
  );
};

export default Header;
