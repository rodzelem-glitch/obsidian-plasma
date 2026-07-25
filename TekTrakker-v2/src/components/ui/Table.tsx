import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface TableProps {
    headers: React.ReactNode[];
    children: React.ReactNode;
    limit?: number;
}

const getTextFromNode = (node: any): string => {
    if (!node) return '';
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node.map(getTextFromNode).join('');
    }
    if (node.props) {
        if (node.props.children) {
            return getTextFromNode(node.props.children);
        }
        if (node.props.value !== undefined) {
            return String(node.props.value);
        }
    }
    return '';
};

const Table: React.FC<TableProps> = ({ headers, children, limit }) => {
    const [sortColIndex, setSortColIndex] = useState<number | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

    const handleSort = (index: number) => {
        if (sortColIndex === index) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortColIndex(null);
                setSortDirection(null);
            } else {
                setSortDirection('asc');
            }
        } else {
            setSortColIndex(index);
            setSortDirection('asc');
        }
    };

    const getCellSortValue = (row: any, colIndex: number): { value: string; isCustom: boolean } => {
        if (!row || !row.props) return { value: '', isCustom: false };
        
        let targetRow = row;
        if (row.type === 'tbody') {
            const childrenArray = React.Children.toArray(row.props.children);
            const firstTr = childrenArray.find((c: any) => c && (c.type === 'tr' || (c.props && c.props.children))) || childrenArray[0];
            if (firstTr) {
                targetRow = firstTr;
            }
        }

        if (!targetRow || !targetRow.props || !targetRow.props.children) return { value: '', isCustom: false };
        const cells = React.Children.toArray(targetRow.props.children);
        const cell = cells[colIndex] as any;
        if (cell && cell.props) {
            if (cell.props['data-sort-value'] !== undefined) {
                return { value: String(cell.props['data-sort-value']), isCustom: true };
            }
            if (cell.props['data-value'] !== undefined) {
                return { value: String(cell.props['data-value']), isCustom: true };
            }
            if (cell.props.value !== undefined) {
                return { value: String(cell.props.value), isCustom: true };
            }
            // Check if immediate child has data-sort-value
            if (cell.props.children) {
                const childrenArray = React.Children.toArray(cell.props.children);
                for (const child of childrenArray) {
                    const c = child as any;
                    if (c && c.props) {
                        if (c.props['data-sort-value'] !== undefined) {
                            return { value: String(c.props['data-sort-value']), isCustom: true };
                        }
                        if (c.props['data-value'] !== undefined) {
                            return { value: String(c.props['data-value']), isCustom: true };
                        }
                    }
                }
            }
        }
        return { value: getTextFromNode(cell), isCustom: false };
    };

    const extractDate = (str: string): number | null => {
        const trimmed = str.trim();
        if (!trimmed) return null;

        // Try direct parse first
        const direct = Date.parse(trimmed);
        if (!isNaN(direct) && isNaN(Number(trimmed))) {
            return direct;
        }

        // Regex for MM/DD/YYYY or YYYY-MM-DD
        const datePattern = /\b(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})\b/;
        const match = trimmed.match(datePattern);
        if (match) {
            const parsed = Date.parse(match[0]);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }

        // Regex for Month DD, YYYY
        const monthPattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/i;
        const monthMatch = trimmed.match(monthPattern);
        if (monthMatch) {
            const parsed = Date.parse(monthMatch[0]);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }

        return null;
    };

    const rowElements = React.Children.toArray(children);

    if (sortColIndex !== null && sortDirection !== null) {
        rowElements.sort((rowA, rowB) => {
            const sortInfoA = getCellSortValue(rowA, sortColIndex);
            const sortInfoB = getCellSortValue(rowB, sortColIndex);
            
            const textA = sortInfoA.value.trim();
            const textB = sortInfoB.value.trim();

            // If it's a custom sort value and is numeric, sort numerically
            if (sortInfoA.isCustom || sortInfoB.isCustom) {
                const numA = Number(textA);
                const numB = Number(textB);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return sortDirection === 'asc' ? numA - numB : numB - numA;
                }
                // Otherwise sort as string
                return sortDirection === 'asc'
                    ? textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' })
                    : textB.localeCompare(textA, undefined, { numeric: true, sensitivity: 'base' });
            }

            // Try to parse as numbers (must be clean numeric values, not dates like "6/22/2026")
            const cleanA = textA.replace(/[$,%\s]/g, '');
            const cleanB = textB.replace(/[$,%\s]/g, '');
            const numA = cleanA !== '' ? Number(cleanA) : NaN;
            const numB = cleanB !== '' ? Number(cleanB) : NaN;
            if (!isNaN(numA) && numB !== null && !isNaN(numB)) {
                return sortDirection === 'asc' ? numA - numB : numB - numA;
            }

            // Try to parse as dates
            const dateValA = extractDate(textA);
            const dateValB = extractDate(textB);
            if (dateValA !== null || dateValB !== null) {
                const timeA = dateValA !== null ? dateValA : 0;
                const timeB = dateValB !== null ? dateValB : 0;
                return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
            }

            // Fallback to string comparison
            return sortDirection === 'asc'
                ? textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' })
                : textB.localeCompare(textA, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    const displayedRows = limit !== undefined ? rowElements.slice(0, limit) : rowElements;

    const hasTbodyChildren = displayedRows.some((el: any) => el && el.type === 'tbody');

    const renderedContent = hasTbodyChildren
        ? displayedRows.map((el: any) => {
            if (el && el.type === 'tbody') {
                return React.cloneElement(el, {
                    className: `bg-white dark:bg-slate-800 text-slate-900 dark:text-gray-100 divide-y divide-slate-100 dark:divide-slate-700/50 border-b border-slate-200 dark:border-slate-700 last:border-b-0 ${el.props.className || ''}`
                });
            }
            return el;
        })
        : (
            <tbody className="bg-white dark:bg-slate-800 text-slate-900 dark:text-gray-100 divide-y divide-slate-100 dark:divide-slate-700/50 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50 dark:[&>tr:hover]:bg-slate-700/30 [&>tr]:min-h-[48px]">
                {displayedRows}
            </tbody>
        );

    return (
        <div className="relative overflow-x-auto custom-scrollbar touch-pan-x rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-[1]">
                    <tr>
                        {headers.map((h, i) => {
                            const headerText = getTextFromNode(h);
                            const isSortable = headerText.trim() !== '' && 
                                               headerText.toLowerCase() !== 'actions' && 
                                               headerText.toLowerCase() !== 'options' &&
                                               headerText.toLowerCase() !== 'select' &&
                                               headerText.toLowerCase() !== 'checkbox';

                            return (
                                <th 
                                    key={i} 
                                    onClick={() => isSortable && handleSort(i)}
                                    className={`px-4 md:px-6 py-3 text-left text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap ${isSortable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 select-none' : ''}`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>{h}</span>
                                        {isSortable && (
                                            <span className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                                {sortColIndex === i ? (
                                                    sortDirection === 'asc' ? (
                                                        <ArrowUp size={12} className="text-primary-600 dark:text-primary-400" />
                                                    ) : (
                                                        <ArrowDown size={12} className="text-primary-600 dark:text-primary-400" />
                                                    )
                                                ) : (
                                                    <ArrowUpDown size={12} className="opacity-40" />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                {hasTbodyChildren ? renderedContent : renderedContent}
            </table>
        </div>
    );
};

export default Table;
