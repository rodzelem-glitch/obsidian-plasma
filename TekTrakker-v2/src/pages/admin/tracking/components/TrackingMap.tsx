
import React from 'react';
// @ts-ignore
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
// @ts-ignore
import L from 'leaflet';
import { Truck, User as UserIcon, Navigation } from 'lucide-react';

const techIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3177/3177440.png",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
});

const vehicleIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/3063/3063822.png",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
});

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  map.flyTo(center, 14, { animate: true, duration: 1.5 });
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
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{tech.isFleet ? 'Fleet Vehicle' : 'Technician'}</span>
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
