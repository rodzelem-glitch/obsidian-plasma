
import React, { useState, useEffect } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import { ShiftLog, ShiftEdit } from 'types';

interface EditShiftModalProps {
    log: ShiftLog | null;
    onClose: () => void;
    onSave: (log: ShiftLog, edit: ShiftEdit) => void;
    currentUser: any;
}

const EditShiftModal: React.FC<EditShiftModalProps> = ({ log, onClose, onSave, currentUser }) => {
    const [editReason, setEditReason] = useState('');
    const [editClockIn, setEditClockIn] = useState('');
    const [editClockOut, setEditClockOut] = useState('');

    useEffect(() => {
        if (log) {
            setEditClockIn(formatDateTimeForInput(log.clockIn));
            setEditClockOut(formatDateTimeForInput(log.clockOut));
            setEditReason('');
        }
    }, [log]);

    const formatDateTimeForInput = (isoString: string | null | undefined) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!log) return;

        const newClockInIso = new Date(editClockIn).toISOString();
        const newClockOutIso = editClockOut ? new Date(editClockOut).toISOString() : undefined;

        const editRecord: ShiftEdit = {
            timestamp: new Date().toISOString(),
            adminName: `${currentUser?.firstName} ${currentUser?.lastName}`,
            originalClockIn: log.clockIn,
            originalClockOut: log.clockOut || undefined,
            newClockIn: newClockInIso,
            newClockOut: newClockOutIso,
            reason: editReason
        };

        const updatedLog: ShiftLog = {
            ...log,
            clockIn: newClockInIso,
            clockOut: newClockOutIso,
            edits: [editRecord, ...(log.edits || [])]
        };

        onSave(updatedLog, editRecord);
        onClose();
    };
    
    return (
        <Modal isOpen={!!log} onClose={onClose} title="Adjust Shift Hours">
            <form onSubmit={handleSave} className="space-y-4">
                <Input label="Clock In Time" type="datetime-local" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} required />
                <Input label="Clock Out Time" type="datetime-local" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} />
                <Textarea label="Reason for Change (Required)" value={editReason} onChange={(e: any) => setEditReason(e.target.value)} required />
                <div className="flex justify-end gap-4 pt-4">
                    <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </div>
            </form>
        </Modal>
    );
};

export default EditShiftModal;
