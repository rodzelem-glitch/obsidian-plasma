
import React from 'react';
// @ts-ignore
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
// @ts-ignore
import L from 'leaflet';
import { User } from 'types';

const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  map.flyTo(center, 12, { animate: true, duration: 1.5 });
  return null;
}

interface TrackingMapProps {
    techs: any[];
    center: [number, number];
}

const TrackingMap: React.FC<TrackingMapProps> = ({ techs, center }) => {
    return (
        <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden relative z-0">
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
                                icon: icon
                            } as any)}
                        >
                            <Popup>
                                <div className="text-sm font-sans">
                                    <strong className="block text-base">{tech.firstName} {tech.lastName}</strong>
                                    <span className={`text-xs px-1 rounded ${tech.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {tech.isOnline ? 'Online' : 'Offline'}
                                    </span>
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
