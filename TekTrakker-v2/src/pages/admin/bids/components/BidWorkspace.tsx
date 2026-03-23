
import React, { useState } from 'react';
import { Bid, BidDoc, BidLineItem, ProposalPreset, Organization } from 'types';
import BidWorkspaceHeader from './BidWorkspaceHeader';
import SetupTab from './SetupTab';
import InputsTab from './InputsTab';
import PricingTab from './PricingTab';
import GenerateTab from './GenerateTab';
import HistoryTab from './HistoryTab';
import { useAppContext } from 'context/AppContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { globalConfirm } from "lib/globalConfirm";

interface BidWorkspaceProps {
    bid: Bid;
    onClose: () => void;
    onUpdate: (updates: Partial<Bid>) => Promise<void>;
}

const BidWorkspace: React.FC<BidWorkspaceProps> = ({ bid, onClose, onUpdate }) => {
    const { state } = useAppContext();
    const [activeTab, setActiveTab] = React.useState<'setup' | 'inputs' | 'pricing' | 'generate' | 'history'>('setup');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const functions = getFunctions();
    // Increase client-side timeout to match the 9-minute backend timeout
    const generateBidDocument = httpsCallable(functions, 'generateBidDocument', { timeout: 540000 });
    const searchHistoricalBidData = httpsCallable(functions, 'searchHistoricalBidData', { timeout: 540000 });

    // --- Inputs Tab Handlers ---
    const handleSaveAnswers = (newAnswers: Record<string, string>) => {
        const updatedQuestions = (bid.questions || []).map(q => ({
            ...q,
            answer: newAnswers[q.id] !== undefined ? newAnswers[q.id] : q.answer
        }));
        onUpdate({ questions: updatedQuestions });
        alert('Answers saved!');
    };

    // --- Pricing Tab Handlers ---
    const handleLineItemUpdate = (id: string, field: keyof BidLineItem, value: any) => {
        const updatedItems = (bid.lineItems || []).map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'qty' || field === 'unitPrice') {
                    updatedItem.totalPrice = (updatedItem.qty || 0) * (updatedItem.unitPrice || 0);
                }
                return updatedItem;
            }
            return item;
        });
        onUpdate({ lineItems: updatedItems });
    };

    const handleLineItemDelete = (id: string) => {
        const updatedItems = (bid.lineItems || []).filter(item => item.id !== id);
        onUpdate({ lineItems: updatedItems });
    };

    const handleLineItemAdd = (item: Partial<BidLineItem>) => {
        const newItem: BidLineItem = { id: `item-${Date.now()}`, description: item.description || 'New Item', unit: item.unit || 'EA', qty: item.qty || 1, unitPrice: item.unitPrice || 0, totalPrice: (item.qty || 1) * (item.unitPrice || 0) };
        const updatedItems = [...(bid.lineItems || []), newItem];
        onUpdate({ lineItems: updatedItems });
    };

    const handleAddFromPricebook = (preset: ProposalPreset) => {
        const newItem: BidLineItem = { 
            id: `item-${Date.now()}`, 
            description: preset.name, 
            unit: 'EA', 
            qty: 1, 
            unitPrice: preset.baseCost || 0,
            totalPrice: preset.baseCost || 0
        };
        const updatedItems = [...(bid.lineItems || []), newItem];
        onUpdate({ lineItems: updatedItems });
    };

    // --- Generate/History Tab Handlers (Secure implementation) ---
    
    // Helper to strip heavy files before sending to cloud function
    const getCleanBidPayload = () => {
        const cleanBid = JSON.parse(JSON.stringify(bid));
        
        if (cleanBid.files) {
            cleanBid.files = cleanBid.files.map((f: any) => {
                if (f.dataUrl && f.dataUrl.startsWith('data:')) {
                    return { ...f, dataUrl: 'stripped-for-payload' };
                }
                return f;
            });
        }
        
        delete cleanBid.generatedDocs;
        return cleanBid;
    };

    const handleGenerate = async () => {
        const cost = 2.00;
        if (!await globalConfirm(`This will generate a complete, ready-to-submit bid package using AI based on your answers and pricing. The cost is $${cost.toFixed(2)} and will be added to your next invoice. Continue?`)) return;

        setIsGenerating(true);
        try {
            const result = await generateBidDocument({ 
                bid: getCleanBidPayload(), 
                orgContext: state.currentOrganization, // Pass the company details directly from global state
                prompt: 'Generate complete package' 
            });
            
            const { docs } = result.data as { docs: BidDoc[] };
            
            // Replace the entire document array with the new comprehensive package
            onUpdate({ generatedDocs: docs });
            alert('Package generated successfully!');
        } catch (error: any) {
            console.error('Error generating documents:', error);
            alert(`Failed to generate documents: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGlobalEdit = async (prompt: string) => {
        const cost = 2.00;
        if (!await globalConfirm(`Applying this global AI edit will cost $${cost.toFixed(2)} and will be added to your next invoice. Continue?`)) return;

        setIsGenerating(true);
        try {
            const result = await generateBidDocument({ 
                bid: getCleanBidPayload(),
                orgContext: state.currentOrganization, 
                prompt,
                isGlobalEdit: true
            });
            
            const { docs } = result.data as { docs: BidDoc[] };
            onUpdate({ generatedDocs: docs });
            alert('Edits applied successfully!');
        } catch (error: any) {
            console.error('Error editing documents:', error);
            alert(`Failed to apply global edit: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleEditDoc = async (docIndex: number, prompt: string) => {
        const cost = 2.00;
        if (!await globalConfirm(`Editing this specific document with AI will cost $${cost.toFixed(2)} and will be added to your next invoice. Continue?`)) return;

        setIsGenerating(true);
        try {
            const result = await generateBidDocument({ 
                bid: getCleanBidPayload(), 
                orgContext: state.currentOrganization,
                prompt,
                docIndex
            });
            
            const { docs } = result.data as { docs: BidDoc[] };
            const updatedDocs = [...(bid.generatedDocs || [])];
            updatedDocs[docIndex] = docs[0]; // The backend returns an array of 1 for specific doc edits
            
            onUpdate({ generatedDocs: updatedDocs });
            alert('Document edited successfully!');
        } catch (error: any) {
            console.error('Error editing document:', error);
            alert(`Failed to edit document: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSearch = async () => {
        setIsSearching(true);
        try {
            const result = await searchHistoricalBidData({ bid: getCleanBidPayload() });
            const { content } = result.data as { content: string };
            const newDoc: BidDoc = { title: 'Historical Research Report', content };
            onUpdate({ generatedDocs: [...(bid.generatedDocs || []), newDoc] });
        } catch (error: any) {
            console.error('Error searching historical data:', error);
            alert('Failed to search historical data.');
        } finally {
            setIsSearching(false);
        }
    };
    
    const downloadDocument = (doc: BidDoc) => {
        const isSpreadsheet = doc.title.toLowerCase().includes('financial') || doc.title.toLowerCase().includes('spreadsheet') || doc.title.toLowerCase().includes('pricing');
        let blob;
        let filename;
    
        if (isSpreadsheet) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = doc.content;
            const table = tempDiv.querySelector('table');
            if (table) {
                let csvContent = '';
                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                    const rowData = Array.from(row.querySelectorAll('th, td')).map(cell => `"${cell.textContent?.replace(/"/g, '""')}"`).join(',');
                    csvContent += rowData + '\r\n';
                });
                blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                filename = `${doc.title.replace(/ /g, '_')}.csv`; 
            } else {
                blob = new Blob([doc.content], { type: 'text/html' });
                filename = `${doc.title.replace(/ /g, '_')}.html`;
            }
        } else {
            const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
                "xmlns:w='urn:schemas-microsoft-com:office:word' "+
                "xmlns='http://www.w3.org/TR/REC-html40'>"+
                "<head><meta charset='utf-8'><title>TekTrakker</title></head><body>";
            const footer = "</body></html>";
            const sourceHTML = header + doc.content + footer;
            blob = new Blob([sourceHTML], { type: 'application/msword' });
            filename = `${doc.title.replace(/ /g, '_')}.doc`;
        }
    
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'setup': return <SetupTab bid={bid} onUpdate={onUpdate} />;
            case 'inputs': 
                const answers = (bid.questions || []).reduce((acc, q) => {
                    acc[q.id] = q.answer || '';
                    return acc;
                }, {} as Record<string, string>);
                return (
                    <InputsTab
                        questions={bid.questions || []}
                        answers={answers}
                        onSave={handleSaveAnswers}
                    />
                );
            case 'pricing': return (
                <PricingTab
                    lineItems={bid.lineItems || []}
                    onUpdate={handleLineItemUpdate}
                    onDelete={handleLineItemDelete}
                    onAdd={handleLineItemAdd}
                    pricebook={state.proposalPresets || []}
                    onAddFromPricebook={handleAddFromPricebook}
                />
            );
            case 'generate': return (
                <GenerateTab 
                    docs={bid.generatedDocs || []}
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    onGlobalEdit={handleGlobalEdit}
                    onEditDoc={handleEditDoc}
                    onDownload={downloadDocument}
                />
            );
            case 'history': return <HistoryTab bid={bid} onSearch={handleSearch} isSearching={isSearching} onDownload={downloadDocument} />;
            default: return null;
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl animate-fade-in">
            <BidWorkspaceHeader 
                bidTitle={bid.title} 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                onClose={onClose}
            />
            <div className="p-4 sm:p-6">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default BidWorkspace;
