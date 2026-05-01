
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from 'lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppContext } from 'context/AppContext';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import showToast from 'lib/toast';

import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import Modal from 'components/ui/Modal';
import Spinner from 'components/ui/Spinner';
import Card from 'components/ui/Card';
import SignaturePad from 'components/ui/SignaturePad';
import DocumentPreview from 'components/ui/DocumentPreview';

import { DollarSign, CheckCircle, Lightbulb, User, Phone, Mail, MapPin, Calendar, Clock, Loader2, Zap } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { PRICE_BOOKS } from 'lib/pricebooks';
import type { Organization, ServiceItem, Customer } from 'types';
import { formatAddress } from 'lib/utils';

interface ServiceOption {
    name: string;
    description: string;
    baseCost: number;
    avgLabor: number;
    total?: number;
}

const FieldProposal: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [problemDesc, setProblemDesc] = useState('');
    const [goodOption, setGoodOption] = useState<ServiceOption | null>(null);
    const [betterOption, setBetterOption] = useState<ServiceOption | null>(null);
    const [bestOption, setBestOption] = useState<ServiceOption | null>(null);
    const [selectedOption, setSelectedOption] = useState<ServiceOption | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [proposalGenerated, setProposalGenerated] = useState(false);
    const [customerSignature, setCustomerSignature] = useState('');
    const [employeeSignature, setEmployeeSignature] = useState('');
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedServiceItem, setSelectedServiceItem] = useState<ServiceItem | null>(null);
    const [showServiceItemModal, setShowServiceItemModal] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [manualItems, setManualItems] = useState<ServiceItem[]>([]);
    const [notes, setNotes] = useState('');
    const [apiKey, setApiKey] = useState<string | null>(null);

    const proposalRef = useRef<HTMLDivElement>(null);

    const organizationId = state.currentUser?.organizationId;

    useEffect(() => {
        const fetchApiKey = async () => {
            try {
                const functions = getFunctions();
                const getApiKeyCallable = httpsCallable(functions, 'getApiKey');
                const result = await getApiKeyCallable();
                const key = (result.data as { apiKey: string }).apiKey;
                setApiKey(key);
            } catch (error) {
                console.error("Error fetching API key:", error);
            }
        };
        fetchApiKey();
    }, []);

    useEffect(() => {
        if (!state.currentUser) {
            navigate('/login');
            return;
        }
        const fetchUserData = async () => {
            if (organizationId) {
                const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
                if (orgDoc.exists()) {
                    setOrganization(orgDoc.data() as Organization);
                }
            }
        };
        fetchUserData();
    }, [state.currentUser, organizationId, navigate]);

    // This is a placeholder for how you might select a customer
    // In a real app, this would likely come from search or a specific job context
    useEffect(() => {
        const fetchCustomer = async () => {
            // Replace with actual customer ID or search logic
            const customerId = 'YOUR_CUSTOMER_ID'; 
            if (customerId && organizationId) {
                const customerDoc = await getDoc(doc(db, 'organizations', organizationId, 'customers', customerId));
                if (customerDoc.exists()) {
                    setCustomer({ ...customerDoc.data(), id: customerDoc.id } as Customer);
                }
            }
        };
        // fetchCustomer(); // Uncomment and implement customer selection
    }, [organizationId]);


    const handleAIEstimate = async () => {
            if (!problemDesc.trim() || !apiKey) {
                showToast.warn("API key or problem description is missing.");
                return;
            }
            setIsThinking(true);
            try {
                const ai = new GoogleGenerativeAI(apiKey);
                const model = ai.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
                const prompt = `Expert Service Estimator: Generate tiered repair options for: "${problemDesc}". Return a JSON object with keys "good", "better", "best". Each key should contain an array of objects with properties: name, description, baseCost (number), avgLabor (number). Ensure valid JSON.`;
                
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                
                // Clean the response to ensure it's valid JSON
                const cleanText = text.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(cleanText);

                setGoodOption(parsed.good[0] || null);
                setBetterOption(parsed.better[0] || null);
                setBestOption(parsed.best[0] || null);
                setProposalGenerated(true);

            } catch (error) {
                console.error("Error generating AI estimate:", error);
                showToast.error("Failed to generate AI estimate. Please try again or manually create options.");
            } finally {
                setIsThinking(false);
            }
    };

    const calculateTotal = (option: ServiceOption) => {
        return (option.baseCost + option.avgLabor) * quantity;
    };

    const handleOptionSelect = (option: ServiceOption | null) => {
        setSelectedOption(option);
    };

    const handleAddServiceItem = (item: ServiceItem) => {
        setSelectedServiceItem(item);
        setQuantity(1); // Reset quantity
        setShowServiceItemModal(true);
    };

    const confirmAddServiceItem = () => {
        if (selectedServiceItem) {
            setManualItems(prev => [...prev, { ...selectedServiceItem, quantity: quantity }]);
            setShowServiceItemModal(false);
            setSelectedServiceItem(null);
            setQuantity(1);
        }
    };

    const removeManualItem = (index: number) => {
        setManualItems(prev => prev.filter((_, i) => i !== index));
    };

    const generatePdf = async () => {
        if (!proposalRef.current) return;

        setIsSubmitting(true);
        const input = proposalRef.current;
        const canvas = await html2canvas(input, {});
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save("service_proposal.pdf");
        setIsSubmitting(false);
    };

    const handleSubmitProposal = async () => {
        if (!selectedOption && manualItems.length === 0) {
            showToast.warn("Please select an AI option or add manual service items.");
            return;
        }
        if (!customerSignature || !employeeSignature) {
            showToast.warn("Both customer and employee signatures are required.");
            return;
        }
        if (!organization || !state.currentUser || !customer) {
            showToast.error("Missing organization, user, or customer data.");
            return;
        }

        setIsSubmitting(true);

        try {
            const proposalData = {
                organizationId: organization.id,
                customerId: customer.id,
                customerName: customer.name,
                employeeId: state.currentUser.id,
                employeeName: `${state.currentUser.firstName} ${state.currentUser.lastName}`,
                problemDescription: problemDesc,
                selectedOption: selectedOption ? { ...selectedOption, total: calculateTotal(selectedOption) } : null,
                manualItems: manualItems.map(item => ({ ...item, total: (item.cost || 0) * item.quantity })),
                totalAmount: selectedOption ? calculateTotal(selectedOption) : manualItems.reduce((acc, item) => acc + (item.cost || 0) * (item.quantity || 1), 0),
                customerSignature: customerSignature,
                employeeSignature: employeeSignature,
                notes: notes,
                status: 'Accepted', // Or 'Pending'
                createdAt: new Date().toISOString(),
            };

            await runTransaction(db, async (transaction) => {
                const proposalRef = doc(db, 'organizations', organization.id, 'proposals', Math.random().toString(36).substring(7));
                transaction.set(proposalRef, proposalData);

                // Optionally, update customer with proposal history
                const customerRef = doc(db, 'organizations', organization.id, 'customers', customer.id);
                transaction.update(customerRef, {
                    serviceHistory: arrayUnion({
                        proposalId: proposalRef.id,
                        date: new Date().toISOString(),
                        service: selectedOption?.name || 'Custom Service',
                        amount: proposalData.totalAmount,
                        status: 'Accepted'
                    })
                });
            });

            showToast.success("Proposal submitted successfully!");
            navigate('/dashboard'); // Or a confirmation page
        } catch (error) {
            console.error("Error submitting proposal:", error);
            showToast.error("Failed to submit proposal. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const industryPricebook = useMemo(() => {
        const industryKey = organization?.industry?.toLowerCase() as keyof typeof PRICE_BOOKS;
        return PRICE_BOOKS[industryKey] || PRICE_BOOKS.General;
    }, [organization?.industry]);


    const brandColor = organization?.primaryColor || '#2563eb';


    if (!state.currentUser || !organization) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-slate-900">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <style>{`
                .brand-border { border-color: ${brandColor} !important; }
                .brand-bg { background-color: ${brandColor} !important; }
                .brand-text { color: ${brandColor} !important; }
            `}</style>
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-4 md:p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4 brand-border">
                    Create Service Proposal
                </h1>

                {/* Customer Info Section (Placeholder) */}
                <Card className="mb-6 bg-blue-50 border-blue-200 text-blue-800">
                    <h2 className="text-xl font-semibold flex items-center mb-2">
                        <User className="mr-2" size={20} /> Customer Information
                    </h2>
                    {customer ? (
                        <div>
                            <p><strong>Name:</strong> {customer.name}</p>
                            <p><strong>Email:</strong> {customer.email}</p>
                            <p><strong>Phone:</strong> {customer.phone}</p>
                            <p><strong>Address:</strong> {formatAddress(customer.address)}</p>
                        </div>
                    ) : (
                        <p className="text-sm">No customer selected. Integrate customer search/selection here.</p>
                    )}
                </Card>

                {/* Problem Description */}
                <div className="mb-6">
                    <Textarea
                        label="Describe the problem or service needed"
                        value={problemDesc}
                        onChange={(e) => setProblemDesc(e.target.value)}
                        rows={4}
                        placeholder="e.g., 'AC unit not cooling, leaking water from evaporator coil', 'Water heater not producing hot water'"
                    />
                    <Button
                        onClick={handleAIEstimate}
                        disabled={isThinking || !problemDesc.trim()}
                        className="mt-4 w-full brand-bg"
                    >
                        {isThinking ? (
                            <span className="flex items-center justify-center">
                                <Loader2 className="animate-spin mr-2" size={20} /> Generating Options...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center">
                                <Lightbulb className="mr-2" size={20} /> Get AI Estimate Options
                            </span>
                        )}
                    </Button>
                </div>

                {/* AI Generated Options */}
                {proposalGenerated && (
                    <div className="mb-6 p-6 border rounded-lg bg-gray-50">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <Zap className="mr-2 text-yellow-500" size={24} /> AI Recommended Solutions
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[goodOption, betterOption, bestOption].map((option, index) => option && (
                                <Card
                                    key={index}
                                    className={`cursor-pointer border-2 ${selectedOption?.name === option.name ? `border-blue-500 shadow-lg` : 'border-gray-200 hover:border-gray-300'}`}
                                    onClick={() => handleOptionSelect(option)}
                                >
                                    <h3 className="font-bold text-lg mb-2 brand-text">{option.name}</h3>
                                    <p className="text-sm text-gray-600 mb-3">{option.description}</p>
                                    <p className="text-xl font-bold text-gray-900">${calculateTotal(option).toFixed(2)}</p>
                                    <p className="text-xs text-gray-500">Includes materials & labor</p>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Manual Service Items */}
                <div className="mb-6 p-6 border rounded-lg bg-gray-50">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Manual Service Items</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {industryPricebook.map((item: ServiceItem, index) => (
                            <Button
                                key={index}
                                onClick={() => handleAddServiceItem(item)}
                                variant="secondary"
                                className="justify-start text-left h-auto py-3 px-4"
                            >
                                <span className="font-semibold">{item.name}</span>
                                <span className="text-sm text-gray-500 block">${item.cost?.toFixed(2)}</span>
                            </Button>
                        ))}
                    </div>

                    {manualItems.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="text-lg font-semibold mb-2">Added Items:</h3>
                            {manualItems.map((item, index) => (
                                <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                                    <span>{item.name} (x{item.quantity})</span>
                                    <span>${((item.cost || 0) * (item.quantity || 1)).toFixed(2)}</span>
                                    <Button variant="danger" size="sm" onClick={() => removeManualItem(index)}>Remove</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div className="mb-6">
                    <Textarea
                        label="Additional Notes for Proposal"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Any specific customer requests, warranty info, etc."
                    />
                </div>

                {/* Signatures */}
                <div className="mb-6 p-6 border rounded-lg bg-gray-50">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Signatures</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Customer Signature</label>
                            <SignaturePad onEnd={data => setCustomerSignature(data)} />
                            <Button variant="secondary" onClick={() => setCustomerSignature('')} className="mt-2 w-full">Clear</Button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Employee Signature</label>
                            <SignaturePad onEnd={data => setEmployeeSignature(data)} />
                            <Button variant="secondary" onClick={() => setEmployeeSignature('')} className="mt-2 w-full">Clear</Button>
                        </div>
                    </div>
                </div>

                {/* Total and Submit */}
                <div className="flex justify-between items-center bg-gray-200 p-4 rounded-lg mb-6">
                    <span className="text-2xl font-bold text-gray-900">
                        Total: ${(selectedOption ? calculateTotal(selectedOption) : manualItems.reduce((acc, item) => acc + (item.cost || 0) * (item.quantity || 1), 0)).toFixed(2)}
                    </span>
                    <Button
                        onClick={handleSubmitProposal}
                        disabled={isSubmitting || (!selectedOption && manualItems.length === 0) || !customerSignature || !employeeSignature}
                        className="py-3 px-4 md:px-8 text-lg font-bold"
                        style={{ backgroundColor: brandColor }}
                    >
                        {isSubmitting ? <Spinner size="sm" /> : 'Submit Proposal'}
                    </Button>
                </div>

                {/* PDF Preview Button */}
                <div className="text-center mt-6">
                    <Button onClick={() => setShowPreviewModal(true)} variant="outline">Preview PDF</Button>
                </div>
            </div>

            {/* Service Item Quantity Modal */}
            <Modal
                isOpen={showServiceItemModal}
                onClose={() => setShowServiceItemModal(false)}
                title={`Add ${selectedServiceItem?.name}`}
            >
                <div className="p-4">
                    <Input
                        label="Quantity"
                        type="number"
                        value={quantity}
                        onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                    />
                    <div className="mt-4 flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setShowServiceItemModal(false)}>Cancel</Button>
                        <Button onClick={confirmAddServiceItem} className="brand-bg">Add Item</Button>
                    </div>
                </div>
            </Modal>


            {/* PDF Preview Modal */}
            <Modal
                isOpen={showPreviewModal}
                onClose={() => setShowPreviewModal(false)}
                title="Proposal Preview"
                size="lg"
            >
                <div className="p-4 overflow-auto max-h-[80vh]">
                    <div className="bg-white p-4 md:p-8 shadow-lg mx-auto w-[210mm] min-h-[297mm]" ref={proposalRef}>
                        {/* Proposal Content for PDF */}
                        <div className="text-center mb-8">
                            {organization?.logoUrl && <img src={organization.logoUrl} alt="Logo" className="h-16 mx-auto mb-4" />}
                            <h1 className="text-3xl font-bold brand-text">{organization?.name}</h1>
                            <p className="text-gray-600">{formatAddress(organization?.address)}</p>
                            <p className="text-gray-600">{organization?.phone} | {organization?.email}</p>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2 brand-border">Service Proposal</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
                            <div>
                                <p className="font-semibold">Customer:</p>
                                <p>{customer?.name}</p>
                                <p>{formatAddress(customer?.address)}</p>
                                <p>{customer?.phone}</p>
                                <p>{customer?.email}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold">Date:</p>
                                <p>{new Date().toLocaleDateString()}</p>
                                <p className="font-semibold mt-2">Prepared By:</p>
                                <p>{state.currentUser?.firstName} {state.currentUser?.lastName}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="font-bold text-lg mb-2 brand-text">Problem/Service Description:</h3>
                            <p className="text-gray-700">{problemDesc}</p>
                        </div>

                        {(selectedOption || manualItems.length > 0) && (
                            <div className="mb-6">
                                <h3 className="font-bold text-lg mb-2 brand-text">Proposed Solution:</h3>
                                {selectedOption && (
                                    <div className="border p-4 rounded-lg mb-4 brand-border">
                                        <h4 className="font-semibold text-lg">{selectedOption.name}</h4>
                                        <p className="text-gray-700">{selectedOption.description}</p>
                                        <p className="font-bold text-xl mt-2">Price: ${calculateTotal(selectedOption).toFixed(2)}</p>
                                    </div>
                                )}
                                {manualItems.length > 0 && (
                                    <div className="border p-4 rounded-lg brand-border">
                                        <h4 className="font-semibold text-lg mb-2">Custom Items:</h4>
                                        {manualItems.map((item, index) => (
                                            <div key={index} className="flex justify-between py-1 text-gray-700">
                                                <span>{item.name} (x{item.quantity})</span>
                                                <span>${((item.cost || 0) * (item.quantity || 1)).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        <p className="font-bold text-xl mt-2 text-right">Subtotal: ${manualItems.reduce((acc, item) => acc + (item.cost || 0) * (item.quantity || 1), 0).toFixed(2)}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {notes && (
                            <div className="mb-6">
                                <h3 className="font-bold text-lg mb-2 brand-text">Additional Notes:</h3>
                                <p className="text-gray-700">{notes}</p>
                            </div>
                        )}

                        <div className="flex justify-between items-center border-t pt-4 mt-8 brand-border">
                            <span className="text-2xl font-bold text-gray-900">
                                Grand Total: ${(selectedOption ? calculateTotal(selectedOption) : manualItems.reduce((acc, item) => acc + (item.cost || 0) * (item.quantity || 1), 0)).toFixed(2)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 text-sm">
                            <div>
                                <p className="font-semibold mb-2">Customer Acceptance:</p>
                                {customerSignature && <img src={customerSignature} alt="Customer Signature" className="w-48 border-b pb-2 mb-2" />}
                                <p className="text-gray-700">X_______________________________</p>
                                <p className="text-gray-700">Date: {new Date().toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold mb-2">Employee Acceptance:</p>
                                {employeeSignature && <img src={employeeSignature} alt="Employee Signature" className="w-48 border-b pb-2 mb-2 ml-auto" />}
                                <p className="text-gray-700">X_______________________________</p>
                                <p className="text-gray-700">Date: {new Date().toLocaleDateString()}</p>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 text-center mt-8">Thank you for your business!</p>
                    </div>
                </div>
                <div className="p-4 border-t flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>Close</Button>
                    <Button onClick={generatePdf} disabled={isSubmitting} className="brand-bg">
                        {isSubmitting ? <Spinner size="sm" /> : 'Download PDF'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default FieldProposal;
