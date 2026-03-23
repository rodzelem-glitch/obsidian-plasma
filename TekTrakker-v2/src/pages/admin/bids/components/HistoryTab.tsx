
import React from 'react';
import Button from 'components/ui/Button';
import { RefreshCw, Globe } from 'lucide-react';
import { Bid, BidDoc } from 'types';

interface HistoryTabProps {
    bid: Bid;
    onSearch: () => void;
    isSearching: boolean;
    onDownload: (doc: BidDoc) => void;
}

const HistoryTab: React.FC<HistoryTabProps> = ({ bid, onSearch, isSearching, onDownload }) => {

    const sanitizeHtmlContent = (htmlString: string): string => {
        // The border issue was caused by nested <body> tags, not the content's own styles.
        // By extracting only the body's content, we can preserve the internal styling (like for tables) without affecting the container.
        const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        return bodyMatch ? bodyMatch[1] : htmlString;
    };

    return (
        <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-xl text-center dark:bg-slate-800">
                <h3 className="font-black text-lg mb-2 text-slate-900 dark:text-white">Market Research & Historical Data</h3>
                <p className="text-sm text-slate-500 mb-6">Search public records for this solicitation.</p>
                <Button onClick={onSearch} disabled={isSearching || !bid.agency} className="flex items-center justify-center gap-2">
                    {isSearching ? <RefreshCw className="animate-spin" size={16}/> : <Globe size={16}/>}
                    {isSearching ? 'Searching...' : 'Search Historical Data'}
                </Button>
            </div>
            {bid.generatedDocs?.filter(d => d.title.includes('History')).map((doc, i) => (
                <div key={i} className="rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                    <div className="bg-slate-100 dark:bg-slate-700 p-3 font-bold flex justify-between items-center text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700">
                        <span>{doc.title}</span>
                        <button onClick={() => onDownload(doc)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
                            Download
                        </button>
                    </div>
                    <div 
                        className="p-4 prose dark:prose-invert max-w-none overflow-y-auto max-h-96 custom-scrollbar"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(doc.content) }} 
                    />
                </div>
            ))}
        </div>
    );
};

export default HistoryTab;
