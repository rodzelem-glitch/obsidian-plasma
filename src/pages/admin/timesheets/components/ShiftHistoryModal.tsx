import React from 'react';
import { ShiftLog } from 'types';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';

interface ShiftHistoryModalProps {
    log: ShiftLog | null;
    onClose: () => void;
}

const ShiftHistoryModal: React.FC<ShiftHistoryModalProps> = ({ log, onClose }) => {
    if (!log || !log.edits || log.edits.length === 0) return null;

    return (
        <Modal isOpen={!!log} onClose={onClose} title="Shift Edit History">
            <div className="space-y-4">
                {log.edits.map((edit, index) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                        <p className="text-xs text-gray-500">{new Date(edit.timestamp).toLocaleString()}</p>
                        <p className="text-sm font-bold">Changed by: {edit.adminName}</p>
                        <p className="text-sm">Reason: {edit.reason}</p>
                        <div className="text-xs mt-2 space-y-1">
                            <p>Original: {new Date(edit.originalClockIn).toLocaleTimeString()} - {edit.originalClockOut ? new Date(edit.originalClockOut).toLocaleTimeString() : 'N/A'}</p>
                            <p>New: {new Date(edit.newClockIn).toLocaleTimeString()} - {edit.newClockOut ? new Date(edit.newClockOut).toLocaleTimeString() : 'N/A'}</p>
                        </div>
                    </div>
                ))}
                <div className="flex justify-end pt-4">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ShiftHistoryModal;
