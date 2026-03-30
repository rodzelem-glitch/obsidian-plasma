
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import { BusinessDocument } from 'types';
import { FileText, CheckCircle } from 'lucide-react';
import DOMPurify from 'dompurify';

const HRHandbookView: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser } = state;
    
    const policies = useMemo(() => 
        state.documents.filter(d => d.type === 'Policy' || d.type === 'Handbook'),
    [state.documents]);
    
    const [viewDoc, setViewDoc] = useState<BusinessDocument | null>(null);
    const [signatureName, setSignatureName] = useState('');

    const handleSign = async (docId: string) => {
        if (!currentUser || !signatureName) return;
        const timestamp = new Date().toISOString();
        
        const updatedSignedPolicies = {
            ...(currentUser.signedPolicies || {}),
            [docId]: timestamp
        };

        const legacyUpdate = docId === policies.find(p => p.type === 'Handbook')?.id ? { handbookSignedDate: timestamp } : {};

        try {
            await db.collection('users').doc(currentUser.id).update({ 
                signedPolicies: updatedSignedPolicies,
                ...legacyUpdate 
            });

            dispatch({ 
                type: 'UPDATE_EMPLOYEE', 
                payload: { ...currentUser, signedPolicies: updatedSignedPolicies, ...legacyUpdate } 
            });
            
            alert('Document Acknowledged.');
            setViewDoc(null);
            setSignatureName('');
        } catch (e) {
            alert("Failed to save signature.");
        }
    };

    return (
        <div className="space-y-6">
            {viewDoc && (
                <Modal isOpen={true} onClose={() => setViewDoc(null)} title={viewDoc.title}>
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded border border-gray-200 dark:border-gray-700 max-h-[60vh] overflow-y-auto">
                            {viewDoc.context ? (
                                <div className="text-center">
                                    <p className="mb-4">This document is a file upload.</p>
                                    <a href={viewDoc.context} download={viewDoc.title} className="text-blue-600 hover:underline font-bold" target="_blank" rel="noreferrer">Open/Download to Read</a>
                                </div>
                            ) : (
                                <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(viewDoc.content)}} />
                            )}
                        </div>
                        
                        {!currentUser?.signedPolicies?.[viewDoc.id] && (
                            <div className="border-t pt-4">
                                <p className="text-sm font-bold mb-2">I have read and agree to this policy.</p>
                                <div className="flex gap-2">
                                    <Input placeholder="Type full name to sign" value={signatureName} onChange={e => setSignatureName(e.target.value)} />
                                    <Button onClick={() => handleSign(viewDoc.id)} disabled={!signatureName}>Sign & Accept</Button>
                                </div>
                            </div>
                        )}
                        {currentUser?.signedPolicies?.[viewDoc.id] && (
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded flex items-center gap-2 text-green-700 dark:text-green-400">
                                <CheckCircle size={20} />
                                <span>Signed on {new Date(currentUser.signedPolicies[viewDoc.id]).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            <Card>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Required Policies & Handbooks</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {policies.map(doc => {
                        const isSigned = !!currentUser?.signedPolicies?.[doc.id];
                        return (
                            <div key={doc.id} className={`p-4 rounded-lg border flex justify-between items-center ${isSigned ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'}`}>
                                <div className="flex items-center gap-3">
                                    <FileText className={isSigned ? "text-green-500" : "text-gray-400"} size={24} />
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">{doc.title}</h4>
                                        <p className="text-xs text-gray-500">Updated: {new Date(doc.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <Button onClick={() => setViewDoc(doc)} variant="secondary" className="text-xs">
                                    {isSigned ? 'View' : 'Read & Sign'}
                                </Button>
                            </div>
                        );
                    })}
                    {policies.length === 0 && <p className="text-gray-500 italic col-span-2 text-center py-4">No policies assigned.</p>}
                </div>
            </Card>
        </div>
    );
};

export default HRHandbookView;
