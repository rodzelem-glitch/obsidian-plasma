import showToast from "lib/toast";

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
import { db } from 'lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

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
    const [isGeneratingAIPricing, setIsGeneratingAIPricing] = useState(false);

    const [isConverting, setIsConverting] = useState(false);
    const navigate = useNavigate();

    const functions = getFunctions();
    // Increase client-side timeout to match the 9-minute backend timeout
    const generateBidDocument = httpsCallable(functions, 'generateBidDocument', { timeout: 540000 });
    const searchHistoricalBidData = httpsCallable(functions, 'searchHistoricalBidData', { timeout: 540000 });
    const suggestBidPricing = httpsCallable(functions, 'suggestBidPricing', { timeout: 540000 });

    // --- Inputs Tab Handlers ---
    const handleSaveAnswers = (newAnswers: Record<string, string>) => {
        const updatedQuestions = (bid.questions || []).map(q => ({
            ...q,
            answer: newAnswers[q.id] !== undefined ? newAnswers[q.id] : q.answer
        }));
        onUpdate({ questions: updatedQuestions });
        showToast.warn('Answers saved!');
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
        if (!await globalConfirm(`This will generate a complete, ready-to-submit bid package using AI based on your answers and pricing. This will use credits from your token bucket. Continue?`)) return;

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
            showToast.warn('Package generated successfully!');
        } catch (error: any) {
            console.error('Error generating documents:', error);
            if (error.message && (error.message.includes('429') || error.message.includes('Resource exhausted'))) {
                showToast.warn('AI Service is currently busy. Please try again in a few moments.');
            } else {
                showToast.warn(`Failed to generate documents: ${error.message}`);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGlobalEdit = async (prompt: string) => {
        if (!await globalConfirm(`Applying this global AI edit will use credits from your token bucket. Continue?`)) return;

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
            showToast.warn('Edits applied successfully!');
        } catch (error: any) {
            console.error('Error editing documents:', error);
            if (error.message && (error.message.includes('429') || error.message.includes('Resource exhausted'))) {
                showToast.warn('AI Service is currently busy. Please try again in a few moments.');
            } else {
                showToast.warn(`Failed to apply global edit: ${error.message}`);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleEditDoc = async (docIndex: number, prompt: string) => {
        if (!await globalConfirm(`Editing this specific document with AI will use credits from your token bucket. Continue?`)) return;

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
            showToast.warn('Document edited successfully!');
        } catch (error: any) {
            console.error('Error editing document:', error);
            if (error.message && (error.message.includes('429') || error.message.includes('Resource exhausted'))) {
                showToast.warn('AI Service is currently busy. Please try again in a few moments.');
            } else {
                showToast.warn(`Failed to edit document: ${error.message}`);
            }
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
            showToast.warn('Failed to search historical data.');
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleGenerateAIPricing = async () => {
        if (!await globalConfirm(`This will analyze historical data and current pricing schemes to recommend competitive prices for your line items. It will use credits from your token bucket. Continue?`)) return;

        setIsGeneratingAIPricing(true);
        try {
            const result = await suggestBidPricing({ bid: getCleanBidPayload() });
            const { updatedLineItems } = result.data as { updatedLineItems: BidLineItem[] };
            
            if (updatedLineItems && updatedLineItems.length > 0) {
                onUpdate({ lineItems: updatedLineItems });
                showToast.success('AI pricing recommendations applied!');
            } else {
                showToast.warn('No pricing recommendations were generated.');
            }
        } catch (error: any) {
            console.error('Error generating AI pricing:', error);
            if (error.message && (error.message.includes('429') || error.message.includes('Resource exhausted'))) {
                showToast.error('AI Service is currently busy. Please try again in a few moments.');
            } else {
                showToast.error(`Failed to generate AI pricing: ${error.message}`);
            }
        } finally {
            setIsGeneratingAIPricing(false);
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
            // Extract embedded <style> tags so they go in <head> for proper Word rendering
            const sRgx = /<style[\s\S]*?<\/style>/gi;
            const sMtch = doc.content.match(sRgx) || [];
            const bodyOnly = doc.content.replace(sRgx, '');
            const hStyles = sMtch.join('\n');

            const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
                "xmlns:w='urn:schemas-microsoft-com:office:word' "+
                "xmlns='http://www.w3.org/TR/REC-html40'>"+
                "<head><meta charset='utf-8'><title>TekTrakker</title>" + hStyles + "</head><body>";
            const footer = "</body></html>";
            const sourceHTML = header + bodyOnly + footer;
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

    const handleConvertToProject = async () => {
        if (!await globalConfirm(`This will create a new Project using the details and pricing from this Bid. Continue?`)) return;

        setIsConverting(true);
        try {
            const projectData = {
                organizationId: bid.organizationId,
                customerId: '', // Can be updated by user later
                customerName: bid.agency || 'Unknown Agency',
                name: bid.title,
                status: 'Planning',
                startDate: new Date().toISOString(),
                endDate: bid.dueDate || '',
                budget: bid.totalValue || bid.lineItems?.reduce((acc, item) => acc + (item.totalPrice || 0), 0) || 0,
                description: bid.summary || 'Converted from bid package',
                createdAt: serverTimestamp(),
                projectTasks: (bid.lineItems || []).map((item, index) => ({
                    id: `task-${Date.now()}-${index}`,
                    description: item.description,
                    status: 'Pending',
                    isBenchmark: false,
                    order: index
                })),
                files: bid.files || [],
            };

            const docRef = await addDoc(collection(db, 'projects'), projectData);
            
            await onUpdate({ projectId: docRef.id });

            showToast.success('Project created successfully!');
            navigate('/admin/projects'); 
            onClose(); // close the bid workspace
        } catch (error: any) {
            console.error('Error converting to project:', error);
            showToast.error(`Failed to convert: ${error.message}`);
        } finally {
            setIsConverting(false);
        }
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
                    onGenerateAIPricing={handleGenerateAIPricing}
                    isGeneratingAIPricing={isGeneratingAIPricing}
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
                bid={bid}
                isConverting={isConverting}
                onConvertToProject={handleConvertToProject}
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
