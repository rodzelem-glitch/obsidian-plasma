
import React, { useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';

const getWeatherCondition = (code: number) => {
    if (code === 0) return 'Clear Sky';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    if (code <= 82) return 'Showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Clear';
};

const getWeatherIcon = (condition: string) => {
    const c = condition.toLowerCase();
    if (c.includes('cloud')) return '☁️';
    if (c.includes('rain') || c.includes('shower')) return '🌧️';
    if (c.includes('thunder')) return '⚡';
    if (c.includes('snow')) return '❄️';
    if (c.includes('fog')) return '🌫️';
    return '☀️';
};

const WeatherWidget: React.FC = () => {
    const { state } = useAppContext();
    const [weather, setWeather] = useState<{temp: number, condition: string, high: number, low: number, lat?: number, lng?: number, city?: string} | null>(null);
    
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const getCoords = (): Promise<{lat: number, lng: number}> => {
                    return new Promise((resolve) => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                                () => resolve({ lat: state.currentUser?.location?.lat || 29.4241, lng: state.currentUser?.location?.lng || -98.4936 }),
                                { timeout: 5000 }
                            );
                        } else {
                            resolve({ lat: state.currentUser?.location?.lat || 29.4241, lng: state.currentUser?.location?.lng || -98.4936 });
                        }
                    });
                };

                const coords = await getCoords();
                const lat = coords.lat;
                const lng = coords.lng;
                // Using the platform-wide API key provided by the SaaS owner
                const apiKey = state.currentOrganization?.settings?.openWeatherApiKey || '06306b0cb08710418c31224005d40c6f';

                try {
                    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=imperial`);
                    if (!res || !res.ok) throw new Error('OpenWeather API failed');
                    const data = await res.json();
                    
                    const city = data.name || 'Local Weather';
                    
                    setWeather({
                        temp: Math.round(data.main.temp),
                        condition: data.weather[0].main,
                        high: Math.round(data.main.temp_max),
                        low: Math.round(data.main.temp_min),
                        lat, lng, city
                    });
                } catch (e) {
                    setWeather({ temp: 72, condition: 'Clear', high: 80, low: 65, lat, lng, city: 'Local Weather' });
                }
            } catch (error) {
                // Failsafe default if the network totally blocks the request
                setWeather({ temp: 72, condition: 'Sunny', high: 82, low: 65 });
            }
        };
        fetchWeather();
    }, [state.currentUser?.location]);

    if (!weather) return <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-6"></div>;

    return (
        <a 
            href={`https://weather.com/weather/today/l/${weather.lat || 29.4241},${weather.lng || -98.4936}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-6 bg-gradient-to-br from-primary-500 to-primary-700 text-white border-none shadow-lg rounded-xl p-4 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all"
        >
            <div className="flex justify-between items-center px-2">
                <div>
                    <div className="text-[10px] text-blue-200 uppercase tracking-widest font-black mb-1 opacity-80 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {weather.city || 'Local Area'}
                    </div>
                    <div className="text-4xl font-bold">{weather.temp}°</div>
                    <div className="font-medium text-blue-100 text-lg">{weather.condition}</div>
                    <div className="text-xs text-blue-200 mt-1 font-mono">H: {weather.high}°  L: {weather.low}°</div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-6xl filter drop-shadow-md">
                        {getWeatherIcon(weather.condition)}
                    </div>
                    <div className="text-[10px] text-white/50 uppercase font-black tracking-wider mt-1">See Details &rsaquo;</div>
                </div>
            </div>
        </a>
    );
};

export default WeatherWidget;
