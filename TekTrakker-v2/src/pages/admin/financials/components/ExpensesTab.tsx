
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { Edit, Trash2, Paperclip, Camera as CameraIcon, Image as ImageIcon } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface ExpensesTabProps {
    allExpenses: any[];
    handleEditExpense: (exp: any) => void;
    handleDeleteExpense: (id: string, type: string) => void;
    setViewingReceipt: (url: string) => void;
    setIsExpenseModalOpen: (val: boolean) => void;
    setNewExpense: (val: any) => void;
    currentUser: any;
}

const ExpensesTab: React.FC<ExpensesTabProps> = ({
    allExpenses,
    handleEditExpense,
    handleDeleteExpense,
    setViewingReceipt,
    setIsExpenseModalOpen,
    setNewExpense,
    currentUser
}) => {
    const handleCapture = async (targetLogId: string, source: CameraSource) => {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: true,
                resultType: CameraResultType.Base64,
                source: source
            });
            
            if (image.base64String && (window as any).handleAttachReceipt) {
                const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
                (window as any).handleAttachReceipt(targetLogId, 'expense', dataUrl);
                alert("Receipt captured and attached!");
            }
        } catch (e: any) {
            console.error("Camera Error:", e);
            // Don't alert on cancel
            if (!e.message?.includes('User cancelled')) {
                alert(`Error matching: ${e.message}`);
            }
        }
    };

    return (
        <Card>
            <div className="flex justify-between mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white">Accounts Payable & Expenses</h3>
                <Button onClick={() => { 
                    setNewExpense({date: new Date().toISOString().split('T')[0], category: 'Materials', description: '', amount: 0, vendor: '', paidBy: currentUser?.firstName || 'Admin', projectId: ''}); 
                    setIsExpenseModalOpen(true); 
                }} className="w-auto text-xs">+ Add Expense</Button>
            </div>
            <Table headers={['Date', 'Vendor', 'Category', 'Description', 'Amount', 'Receipt', 'Actions']}>
                {allExpenses.map((exp: any) => (
                    <tr key={exp.id}>
                        <td className="px-6 py-4 text-sm text-gray-500">{exp.date}</td>
                        <td className="px-6 py-4 font-medium">{exp.vendor}</td>
                        <td className="px-6 py-4 text-sm">{exp.category}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{exp.description}</td>
                        <td className="px-6 py-4 font-bold text-red-600">-${(Number(exp.amount) || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-center group">
                            <div className="flex items-center justify-center gap-2">
                                {(exp.receiptData || exp.receiptUrl) ? (
                                    <button onClick={() => setViewingReceipt(exp.receiptData || exp.receiptUrl)} className="text-blue-500 hover:text-blue-700">
                                        <Paperclip size={18} />
                                    </button>
                                ) : (
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => handleCapture(exp.id, CameraSource.Camera)}
                                            className="text-slate-400 hover:text-primary-500 transition-colors flex flex-col items-center"
                                            title="Take Photo"
                                        >
                                            <CameraIcon size={18} />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (Capacitor.isNativePlatform()) {
                                                    handleCapture(exp.id, CameraSource.Photos);
                                                } else {
                                                    document.getElementById(`file-input-${exp.id}`)?.click();
                                                }
                                            }}
                                            className="text-slate-400 hover:text-primary-500 transition-colors flex flex-col items-center"
                                            title="Upload Image"
                                        >
                                            <ImageIcon size={18} />
                                        </button>
                                        <input 
                                            id={`file-input-${exp.id}`}
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file && (window as any).handleAttachReceipt) {
                                                    (window as any).handleAttachReceipt(exp.id, exp.type, file);
                                                    alert("Receipt uploaded and attached!");
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 flex gap-2">
                            <button onClick={() => handleEditExpense(exp)} className="text-blue-500 hover:text-blue-700 p-1"><Edit size={16}/></button>
                            <button onClick={() => handleDeleteExpense(exp.id, exp.type)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16}/></button>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default ExpensesTab;
