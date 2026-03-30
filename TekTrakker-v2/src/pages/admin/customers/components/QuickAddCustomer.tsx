
import React, { useState } from 'react';
import Button from '../../../../components/ui/Button';
import { useAppContext } from '../../../../context/AppContext';
import { db } from '../../../../lib/firebase';
import type { Customer } from '../../../../types';

interface QuickAddCustomerProps {
    onCustomerCreated: (customerId: string) => void;
}

const QuickAddCustomer: React.FC<QuickAddCustomerProps> = ({ onCustomerCreated }) => {
    const { state } = useAppContext(); // Removed dispatch
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleAddCustomer = async () => {
        if (!state.currentOrganization) return;
        if (!name) {
            alert("Name is required.");
            return;
        }

        setIsSaving(true);
        try {
            const newCustomer: Customer = {
                id: `cust-${Date.now()}`,
                organizationId: state.currentOrganization.id,
                name,
                phone,
                email,
                address: '',
                customerType: 'Residential', // Default
                hvacSystem: { brand: 'N/A', type: 'N/A' },
                serviceHistory: [],
                createdAt: new Date().toISOString()
            };

            // Save to Firestore. The real-time listener in AppContext/CustomerManagement
            // will pick this up and update the UI automatically.
            await db.collection('customers').doc(newCustomer.id).set(newCustomer);

            // Notify Admins of the new customer
            const { notifyAdmins } = await import('../../../../lib/notificationService');
            await notifyAdmins(state.currentOrganization.id, {
                title: "New Customer Added",
                body: `${name} has been added to the database.`,
                type: 'new_customer',
                data: { customerId: newCustomer.id }
            });

            onCustomerCreated(newCustomer.id);
            
            setName('');
            setPhone('');
            setEmail('');
        } catch (error) {
            console.error("Error creating customer:", error);
            alert("Failed to create customer. Please check your connection.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick Add Customer</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                    type="text"
                    placeholder="Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="p-2 border rounded-md"
                />
                <input
                    type="text"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="p-2 border rounded-md"
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="p-2 border rounded-md"
                />
            </div>
            <Button onClick={handleAddCustomer} disabled={isSaving} className="mt-4">
                {isSaving ? 'Adding...' : 'Add Customer'}
            </Button>
        </div>
    );
};

export default QuickAddCustomer;
