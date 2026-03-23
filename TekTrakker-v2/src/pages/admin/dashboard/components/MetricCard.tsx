
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/ui/Card';

const MetricCard: React.FC<{ title: string; value: string | number; path: string; icon: any; color: string }> = ({ title, value, path, icon: Icon, color }) => {
    const navigate = useNavigate();
    return (
        <Card 
            className="flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            onClick={() => navigate(path)}
        >
            <div className={`p-2 rounded-full mb-2 ${color} bg-opacity-10`}>
                <Icon size={20} className={color.replace('bg-', 'text-')} />
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white group-hover:scale-110 transition-transform duration-200">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-1">{title}</p>
        </Card>
    );
}

export default MetricCard;
