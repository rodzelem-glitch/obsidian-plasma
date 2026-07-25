
import React from 'react';
// @ts-ignore
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
// @ts-ignore
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, User as UserIcon, Navigation } from 'lucide-react';

const techIcon = L.divIcon({
    html: `
        <div class="relative flex items-center justify-center w-10 h-10 bg-emerald-600 rounded-2xl text-white shadow-lg border-2 border-white dark:border-slate-900 transition-transform hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-600 rotate-45 border-r border-b border-white dark:border-slate-900"></div>
        </div>
    `,
    className: 'bg-transparent border-none',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

const vehicleIcon = L.divIcon({
    html: `
        <div class="relative flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-2xl text-white shadow-lg border-2 border-white dark:border-slate-900 transition-transform hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-truck"><path d="M14 18H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h11v11"/><path d="M14 18h1a2.5 2.5 0 0 0 2.5-2.5v-6H17"/><path d="m17 9.5 3 2.5v4.5h-3.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="14.5" cy="18" r="2.5"/></svg>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-600 rotate-45 border-r border-b border-white dark:border-slate-900"></div>
        </div>
    `,
    className: 'bg-transparent border-none',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  React.useEffect(() => {
    map.flyTo(center, 14, { animate: true, duration: 1.5 });
  }, [map, center]);

  return null;
}

interface TrackingMapProps {
    techs: any[];
    center: [number, number];
}

const TrackingMap: React.FC<TrackingMapProps> = ({ techs, center }) => {
    return (
        <div className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 overflow-hidden relative z-0 shadow-inner">
            <MapContainer {...({ center: center, zoom: 4, scrollWheelZoom: true, style: { height: "100%", width: "100%" } } as any)}>
                <ChangeView center={center} />
                <TileLayer
                    {...({
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    } as any)}
                />
                {techs.map((tech: any) => (
                    tech.location && (
                        <Marker 
                            key={tech.id} 
                            {...({
                                position: [tech.location.lat, tech.location.lng],
                                icon: tech.isFleet ? vehicleIcon : techIcon
                            } as any)}
                        >
                            <Popup {...({ className: "premium-popup" } as any)}>
                                <div className="p-1 min-w-[150px]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${tech.isFleet ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                                            {tech.isFleet ? <Truck size={14} /> : <UserIcon size={14} />}
                                        </div>
                                        <div>
                                            <strong className="block text-sm text-slate-900 dark:text-white leading-tight">{tech.firstName} {tech.lastName}</strong>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{tech.isFleet ? 'Fleet Vehicle' : (tech.companyLabel || 'Technician')}</span>
                                        </div>
                                    </div>
                                    
                                    {(tech.speed || 0) > 0 && (
                                        <div className="flex items-center gap-1 text-emerald-600 font-black text-xs mb-1">
                                            <Navigation size={10} className="rotate-45" /> {Math.round(tech.speed)} MPH
                                        </div>
                                    )}

                                    <div className="text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-1.5">
                                        Last updated: {new Date(tech.location.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}
            </MapContainer>
        </div>
    );
};

export default TrackingMap;
