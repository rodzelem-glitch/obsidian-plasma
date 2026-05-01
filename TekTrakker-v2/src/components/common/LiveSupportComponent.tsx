import React, { useState, useRef, useEffect } from 'react';
import { X, Video, PhoneOff } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import Draggable from 'react-draggable';

interface LiveSupportFloatingButtonProps {
    variant?: 'nav' | 'floating';
}

export const LiveSupportFloatingButton: React.FC<LiveSupportFloatingButtonProps> = ({ variant = 'floating' }) => {
    const { state } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHidden, setIsHidden] = useState(false);

    const nodeRef = useRef(null);
    const isDragging = useRef({ x: 0, y: 0 });
    
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedPos = localStorage.getItem('live-support-pos');
            if (savedPos) {
                try {
                    setPosition(JSON.parse(savedPos));
                } catch (e) { console.error(e); }
            }
            if (localStorage.getItem('live-support-hidden') === 'true') {
                setIsHidden(true);
            }
        }
    }, []);

    const handleHide = () => {
        if (window.confirm("Hide the Live Support widget? You can unhide it anytime from your Profile (click your avatar at the top right) under the Security tab.")) {
            setIsHidden(true);
            localStorage.setItem('live-support-hidden', 'true');
        }
    };

    if (!state.currentUser || isHidden) return null;

    const roomName = `TekTrakker-Live-Support-${state.currentOrganization?.id || 'GLOBAL'}`;

    const chatWindow = isOpen && (
        <div className="fixed inset-4 sm:inset-12 z-[9999] bg-black rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-800">
            <div className="bg-gray-900 text-white p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <h3 className="font-bold">{state.currentUser?.role === 'platform_sales' ? 'Live Sales Demo Room' : 'Live Support: Office Link'}</h3>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={handleHide}
                        className="p-2 hover:bg-black/20 rounded-lg transition-colors focus:outline-none"
                        title="Hide Live Support Widget"
                    >
                        <span className="text-xs font-bold px-1">HIDE</span>
                    </button>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="text-gray-400 hover:text-white p-1"
                        title="Close Live Support"
                        aria-label="Close Live Support"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 bg-black w-full relative">
                <iframe 
                    allow="camera; microphone; fullscreen; display-capture; autoplay" 
                    src={`https://meet.jit.si/${roomName}?userInfo.displayName="${encodeURIComponent(state.currentUser.firstName + ' ' + state.currentUser.lastName)}"&config.prejoinPageEnabled=false&config.disableDeepLinking=true`}
                    className="w-full h-full border-0 absolute inset-0"
                    title="Live Support Room"
                ></iframe>
            </div>

            <div className="bg-gray-900 p-3 flex justify-center border-t border-gray-800">
                <button 
                    onClick={() => setIsOpen(false)}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2"
                >
                    <PhoneOff size={18} /> End Call
                </button>
            </div>
        </div>
    );

    if (variant === 'nav') {
        return (
            <div className="relative">
                <button 
                    onClick={() => setIsOpen(!isOpen)} 
                    className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors relative" 
                    title={state.currentUser?.role === 'platform_sales' ? 'Live Sales Demo' : 'Live Video Assistance'}
                >
                    <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                    {state.currentUser.role === 'customer' && (
                        <div className="absolute top-1 right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white"></span>
                        </div>
                    )}
                </button>
                {chatWindow}
            </div>
        );
    }

    return (
        <>
            {/* The Floating Bubble */}
            <div className={isOpen ? 'hidden' : 'block'}>
                <Draggable 
                    nodeRef={nodeRef} 
                    bounds="html"
                    position={position}
                    onStart={(e, data) => { isDragging.current = { x: data.x, y: data.y }; }}
                    onStop={(e, data) => {
                        const dx = Math.abs(data.x - isDragging.current.x);
                        const dy = Math.abs(data.y - isDragging.current.y);
                        if (dx < 5 && dy < 5) {
                            setIsOpen(true);
                        } else {
                            const newPos = { x: data.x, y: data.y };
                            setPosition(newPos);
                            localStorage.setItem('live-support-pos', JSON.stringify(newPos));
                        }
                    }}
                >
                    <div 
                        ref={nodeRef}
                        className="fixed bottom-[24px] right-[24px] md:bottom-[24px] md:right-[24px] z-[990] bg-purple-600 hover:bg-purple-700 text-white rounded-full p-4 shadow-xl hover:shadow-2xl transition-shadow cursor-grab active:cursor-grabbing flex items-center justify-center touch-none group"
                        title={state.currentUser?.role === 'platform_sales' ? 'Live Sales Demo' : 'Live Video Assistance'}
                    >
                        <Video size={24} />
                        {state.currentUser.role === 'customer' && (
                            <div className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                            </div>
                        )}
                    </div>
                </Draggable>
            </div>

            {/* The Video overlay window */}
            {chatWindow}
        </>
    );
};
