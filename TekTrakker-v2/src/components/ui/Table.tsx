import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface TableProps {
    headers: React.ReactNode[];
    children: React.ReactNode;
    limit?: number;
    className?: string;
    containerClassName?: string;
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

const Table: React.FC<TableProps> = ({ headers, children, limit, className, containerClassName }) => {
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

    const actionsColIndex = headers.findIndex((h) => {
        const text = getTextFromNode(h).trim().toLowerCase();
        return text === 'actions' || text === 'action' || text === 'options';
    });

    const processTrCell = (tr: any) => {
        if (!tr || !React.isValidElement(tr) || actionsColIndex === -1) return tr;
        const trProps = tr.props as any;
        if (!trProps || !trProps.children) return tr;

        const cells = React.Children.toArray(trProps.children);
        if (actionsColIndex >= cells.length) return tr;

        const updatedCells = cells.map((cell: any, idx) => {
            if (idx === actionsColIndex && React.isValidElement(cell)) {
                const cellProps = (cell as any).props || {};
                const existingClass = cellProps.className || '';
                if (!existingClass.includes('sticky')) {
                    return React.cloneElement(cell as React.ReactElement<any>, {
                        className: `${existingClass} md:sticky md:right-0 z-10 bg-white dark:bg-slate-800 md:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]`.trim()
                    });
                }
            }
            return cell;
        });

        return React.cloneElement(tr as React.ReactElement<any>, { children: updatedCells });
    };

    const displayedRows = limit !== undefined ? rowElements.slice(0, limit) : rowElements;

    const processedRows = displayedRows.map((el: any) => {
        if (!el) return el;
        if (el.type === 'tbody') {
            const tbodyChildren = React.Children.toArray(el.props.children);
            const processedChildren = tbodyChildren.map((child: any) => processTrCell(child));
            return React.cloneElement(el as React.ReactElement<any>, {
                className: `bg-white dark:bg-slate-800 text-slate-900 dark:text-gray-100 divide-y divide-slate-100 dark:divide-slate-700/50 border-b border-slate-200 dark:border-slate-700 last:border-b-0 ${el.props.className || ''}`,
                children: processedChildren
            });
        }
        return processTrCell(el);
    });

    const hasTbodyChildren = displayedRows.some((el: any) => el && el.type === 'tbody');

    const renderedContent = hasTbodyChildren ? processedRows : (
        <tbody className="bg-white dark:bg-slate-800 text-slate-900 dark:text-gray-100 divide-y divide-slate-100 dark:divide-slate-700/50 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50 dark:[&>tr:hover]:bg-slate-700/30 [&>tr]:min-h-[48px]">
            {processedRows}
        </tbody>
    );

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (!target) return;
        const { scrollTop, scrollHeight, clientHeight } = target;
        const isAtTop = scrollTop <= 1;
        const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1;
        const isNotScrollable = scrollHeight <= clientHeight + 2;

        // If the table cannot scroll vertically (e.g. 1-2 items) or has reached its scroll boundary in the scroll direction:
        if (isNotScrollable || (e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
            window.scrollBy({ top: e.deltaY, behavior: 'auto' });
        }
    };

    return (
        <div 
            onWheel={handleWheel}
            className={`relative overflow-x-auto overflow-y-auto max-h-[calc(100dvh-220px)] custom-scrollbar overscroll-x-contain overscroll-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${containerClassName || ''}`}
        >
            <table className={`min-w-full border-separate border-spacing-0 divide-y divide-slate-200 dark:divide-slate-700 ${className || ''}`}>
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-20 shadow-xs border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        {headers.map((h, i) => {
                            const headerText = getTextFromNode(h);
                            const isActionsCol = i === actionsColIndex;
                            const isSortable = !isActionsCol &&
                                               headerText.trim() !== '' && 
                                               headerText.toLowerCase() !== 'options' &&
                                               headerText.toLowerCase() !== 'select' &&
                                               headerText.toLowerCase() !== 'checkbox';

                            return (
                                <th 
                                    key={i} 
                                    onClick={() => isSortable && handleSort(i)}
                                    className={`sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 py-3 text-left text-[10px] md:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap ${isSortable ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 select-none' : ''} ${isActionsCol ? 'md:sticky md:right-0 top-0 z-30 bg-slate-200 dark:bg-slate-800 md:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]' : ''}`}
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
                {renderedContent}
            </table>
        </div>
    );
};

export default Table;
