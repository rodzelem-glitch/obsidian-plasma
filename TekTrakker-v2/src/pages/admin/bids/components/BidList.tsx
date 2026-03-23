
import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { FileText, PlusCircle, Trash2, ArrowRight } from 'lucide-react';
import { Bid } from 'types';

interface BidListProps {
    bids: Bid[];
    onSelect: (bid: Bid) => void;
    onDelete: (e: React.MouseEvent, bidId: string) => void;
    onNew: () => void;
}

const BidList: React.FC<BidListProps> = ({ bids, onSelect, onDelete, onNew }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bids.map(bid => (
                <Card key={bid.id} className="cursor-pointer hover:border-blue-500 transition-colors group relative" onClick={() => onSelect(bid)}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(e, bid.id); }} 
                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 z-10"
                        title="Delete Bid"
                    >
                        <Trash2 size={16}/>
                    </button>
                    <div className="p-3 bg-slate-100 rounded-lg group-hover:bg-blue-50 w-fit mb-4"><FileText size={24} className="text-slate-500 group-hover:text-blue-600"/></div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">{bid.title}</h3>
                    <p className="text-xs text-slate-500 mb-4">{bid.solicitationNumber || 'Pending'} • {new Date(bid.createdAt).toLocaleDateString()}</p>
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-600">Open Workspace <ArrowRight size={14}/></div>
                </Card>
            ))}
            {bids.length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl">
                    <p className="text-slate-500 font-bold text-lg">No active bids found.</p>
                    <Button onClick={onNew}>Create First Bid</Button>
                </div>
            )}
        </div>
    );
};

export default BidList;
