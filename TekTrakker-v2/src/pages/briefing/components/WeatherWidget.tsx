
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
    const [weather, setWeather] = useState<{temp: number, condition: string, high: number, low: number} | null>(null);
    
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const lat = state.currentUser?.location?.lat || 29.4241;
                const lng = state.currentUser?.location?.lng || -98.4936;
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`);
                const data = await res.json();
                
                if (data.current_weather && data.daily && data.daily.temperature_2m_max && data.daily.temperature_2m_max.length > 0) {
                    setWeather({
                        temp: Math.round(data.current_weather.temperature),
                        condition: getWeatherCondition(data.current_weather.weathercode),
                        high: Math.round(data.daily.temperature_2m_max[0]),
                        low: Math.round(data.daily.temperature_2m_min[0])
                    });
                } else {
                     setWeather({ temp: 72, condition: 'Clear', high: 80, low: 65 });
                }
            } catch (error) {
                setWeather({ temp: 82, condition: 'Sunny', high: 95, low: 75 });
            }
        };
        fetchWeather();
    }, [state.currentUser?.location]);

    if (!weather) return <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-6"></div>;

    return (
        <div className="mb-6 bg-gradient-to-br from-primary-500 to-primary-700 text-white border-none shadow-lg rounded-xl p-4">
            <div className="flex justify-between items-center px-2">
                <div>
                    <div className="text-4xl font-bold">{weather.temp}°</div>
                    <div className="font-medium text-blue-100 text-lg">{weather.condition}</div>
                    <div className="text-xs text-blue-200 mt-1 font-mono">H: {weather.high}°  L: {weather.low}°</div>
                </div>
                <div className="text-6xl filter drop-shadow-md">
                    {getWeatherIcon(weather.condition)}
                </div>
            </div>
        </div>
    );
};

export default WeatherWidget;
