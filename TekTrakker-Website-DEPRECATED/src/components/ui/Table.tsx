import React from 'react';

interface TableProps {
    headers: string[];
    children: React.ReactNode;
}

const Table: React.FC<TableProps> = ({ headers, children }) => {
    return (
        <div className="relative overflow-x-auto custom-scrollbar touch-pan-x rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-[1]">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-4 md:px-6 py-3 text-left text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 text-slate-900 dark:text-gray-100 divide-y divide-slate-100 dark:divide-slate-700/50 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50 dark:[&>tr:hover]:bg-slate-700/30 [&>tr]:min-h-[48px]">
                    {children}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
