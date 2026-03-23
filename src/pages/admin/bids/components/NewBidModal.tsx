
import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';

interface NewBidModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (title: string) => void;
    isProcessing: boolean;
}

const NewBidModal: React.FC<NewBidModalProps> = ({ isOpen, onClose, onSubmit, isProcessing }) => {
    const [title, setTitle] = useState('');

    const handleSubmit = () => {
        if (title) {
            onSubmit(title);
            setTitle('');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Start New Proposal">
            <div className="space-y-4">
                <Input 
                    label="Project Title" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="e.g., HVAC Upgrade for City Hall"
                />
                <div className="flex justify-end space-x-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isProcessing || !title}>
                        {isProcessing ? 'Creating...' : 'Start'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default NewBidModal;
