import React, { useState, useEffect } from 'react';
import type { User } from 'types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { QrCode, X, User as UserIcon } from 'lucide-react';
import EmployeeProfileModal from '../modals/EmployeeProfileModal';
import { auth, db } from 'lib/firebase';
import VirtualWorker from '../ui/VirtualWorker';
import { LiveSupportFloatingButton } from '../common/LiveSupportComponent';
import Modal from '../ui/Modal';

interface TopNavActionsProps {
    user: User;
    onLogout?: () => void;
}

const TopNavActions: React.FC<TopNavActionsProps> = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { state, dispatch } = useAppContext();
    const [showNotifications, setShowNotifications] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    useEffect(() => {
        setShowNotifications(false);
        setIsScannerOpen(false);
        setIsProfileModalOpen(false);
    }, [location.pathname]);

    const myNotifications = state.notifications.filter(n => n.userId === user.id);
    const unreadCount = myNotifications.filter(n => !n.read).length;

    const toggleTheme = () => {
        dispatch({ type: 'TOGGLE_THEME' });
    };

    useEffect(() => {
        let isMounted = true;
        let html5QrCode: any = null;

        const startScanner = async () => {
            if (!isScannerOpen) return;
            
            let attempts = 0;
            while (!document.getElementById('qr-reader-topnav') && attempts < 10) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }

            const container = document.getElementById('qr-reader-topnav');
            if (!container) return;

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
            } catch (e) { console.error(e); }

            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                if (!isMounted) return;
                
                html5QrCode = new Html5Qrcode("qr-reader-topnav");
                const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
                
                let startConfig: any = { facingMode: "environment" };
                try {
                    const devices = await Html5Qrcode.getCameras();
                    if (devices && devices.length > 0) {
                        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
                        if (backCamera) startConfig = backCamera.id;
                    }
                } catch (camErr) {
                    console.warn("getCameras failed, using environment mode", camErr);
                }

                await html5QrCode.start(startConfig, qrConfig,
                    (decodedText: string) => {
                        const cleanText = decodedText.trim();
                        let matched = false;

                        if (cleanText.includes('/#/asset/')) {
                            const parts = cleanText.split('/#/asset/');
                            if (parts.length > 1) {
                                navigate(`/asset/${parts[1]}`);
                                matched = true;
                            }
                        } 
                        if (!matched) {
                            const cyl = state.refrigerantCylinders?.find(c => c.tag?.toLowerCase() === cleanText.toLowerCase() || c.id === cleanText);
                            if (cyl) { navigate(`/admin/records?tab=inventory`); matched = true; }
                        }
                        if (!matched) {
                            const inventoryItem = state.inventory.find(i => (i.sku && i.sku.toLowerCase() === cleanText.toLowerCase()) || i.barcode === cleanText);
                            if (inventoryItem) { navigate(`/admin/records?tab=inventory&search=${encodeURIComponent(cleanText)}`); matched = true; }
                        }
                        if (!matched) {
                            const vehicle = state.vehicles.find(v => v.licensePlate.toLowerCase() === cleanText.toLowerCase() || v.vin?.toLowerCase() === cleanText.toLowerCase() || v.barcode === cleanText);
                            if (vehicle) { navigate(`/admin/records?tab=fleet&search=${encodeURIComponent(cleanText)}`); matched = true; }
                        }
                        if (!matched) {
                            const cleanTextLower = cleanText.toLowerCase();
                            for (const customer of state.customers) {
                                if (customer.equipment) {
                                    const asset = customer.equipment.find(e => e.id === cleanText || e.serial.toLowerCase() === cleanTextLower);
                                    if (asset) { navigate(`/asset/${customer.id}?assetId=${asset.id}`); matched = true; break; }
                                }
                            }
                        }

                        if (matched) {
                            html5QrCode.stop().then(() => setIsScannerOpen(false)).catch(() => setIsScannerOpen(false));
                        } else {
                            if (window.confirm(`No direct match found for "${cleanText}". Search inventory/records globally?`)) {
                                navigate(`/admin/records?tab=inventory&search=${encodeURIComponent(cleanText)}`);
                                html5QrCode.stop().then(() => setIsScannerOpen(false)).catch(() => setIsScannerOpen(false));
                            }
                        }
                    },
                    (errorMessage: string) => {}
                );
            } catch (err: any) {
                if (container) container.innerHTML = `<div class='p-4 text-red-500 text-center text-sm'>${err.message || 'Camera Error'}</div>`;
            }
        };

        if (isScannerOpen) startScanner();
        
        return () => { 
            isMounted = false;
            if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => {});
        };
    }, [isScannerOpen, navigate, state.inventory, state.vehicles, state.customers, state.refrigerantCylinders]);

    return (
        <>
            <div className="flex items-center space-x-1 sm:space-x-3">
                <VirtualWorker variant="nav" />
                <LiveSupportFloatingButton variant="nav" />
                <button onClick={() => setIsScannerOpen(true)} className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Scan QR/Barcode"><QrCode className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                <button onClick={() => setIsProfileModalOpen(true)} className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="My Profile"><UserIcon className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                <button onClick={toggleTheme} className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Toggle Theme">
                    {state.theme === 'dark' ? <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg> : <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>}
                </button>

                <div className="relative">
                    <button onClick={() => setShowNotifications(!showNotifications)} className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 relative transition-colors" title="Notifications">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                        {unreadCount > 0 && <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">{unreadCount}</span>}
                    </button>
                    <Modal isOpen={showNotifications} onClose={() => setShowNotifications(false)} title="Notifications" size="sm">
                        {unreadCount > 0 && (
                            <div className="flex justify-end mb-3">
                                <button className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors" onClick={() => {
                                    dispatch({type: 'MARK_ALL_READ', payload: user.id});
                                    myNotifications.filter(n => !n.read).forEach(n => {
                                        db.collection('notifications').doc(n.id).update({ read: true }).catch(console.error);
                                    });
                                }}>Mark all as read</button>
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            {myNotifications.filter(n => !n.read).length === 0 ? (
                                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No new alerts</div>
                            ) : myNotifications.filter(n => !n.read).map(n => (
                                <div key={n.id} className={`p-4 border rounded-xl dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${!n.read ? 'bg-primary-50/50 border-primary-100 dark:bg-primary-900/10 dark:border-primary-800/30' : 'border-slate-100'}`} onClick={() => { 
                                    dispatch({type:'MARK_NOTIFICATION_READ', payload: n.id}); 
                                    if (!n.read) db.collection('notifications').doc(n.id).update({ read: true }).catch(console.error);
                                    if(n.link) navigate(n.link); 
                                    setShowNotifications(false); 
                                }}>
                                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{n.title}</p>
                                    <p className="text-slate-600 dark:text-slate-400 mt-1 text-xs leading-relaxed">{n.message}</p>
                                </div>
                            ))}
                        </div>
                    </Modal>
                </div>
            </div>

            {isScannerOpen && (
                <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4">
                    <button onClick={() => setIsScannerOpen(false)} className="absolute top-4 right-4 text-white p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors" title="Close Scanner" aria-label="Close Scanner"><X size={24} /></button>
                    <h2 className="text-white text-xl font-bold mb-4">Scan QR or Barcode</h2>
                    <div id="qr-reader-topnav" className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl min-h-[300px] flex items-center justify-center">
                        <div className="p-8 text-center text-slate-500 animate-pulse">Initializing...</div>
                    </div>
                </div>
            )}

            {isProfileModalOpen && (
                <EmployeeProfileModal isOpen={true} onClose={() => setIsProfileModalOpen(false)} employee={user} isSelf={true} />
            )}
        </>
    );
};
export default TopNavActions;
