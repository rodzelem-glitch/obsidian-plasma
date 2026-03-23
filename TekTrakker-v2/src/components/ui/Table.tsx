import React from 'react';

interface TableProps {
    headers: string[];
    children: React.ReactNode;
}

const Table: React.FC<TableProps> = ({ headers, children }) => {
    return (
        <div className="relative overflow-x-auto custom-scrollbar touch-pan-x">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-4 md:px-6 py-3 text-left text-[10px] md:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {children}
                </tbody>
            </table>
        </div>
    );
};

export default Table;