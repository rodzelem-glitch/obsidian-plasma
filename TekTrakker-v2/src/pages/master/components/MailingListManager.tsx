import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from 'lib/firebase';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import { Upload, Plus, Trash2, Users, Tag, Search, Filter, Download } from 'lucide-react';
import { globalConfirm } from 'lib/globalConfirm';
import showToast from 'lib/toast';

export interface MailingListContact {
    email: string;
    name?: string;
    company?: string;
    city?: string;
    state?: string;
    tags?: string[];
    source?: string;
}

export interface MailingList {
    id: string;
    name: string;
    description?: string;
    contacts: MailingListContact[];
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
}

const MailingListManager: React.FC = () => {
    const [lists, setLists] = useState<MailingList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showListDetail, setShowListDetail] = useState<MailingList | null>(null);
    const [newListName, setNewListName] = useState('');
    const [newListDesc, setNewListDesc] = useState('');
    const [manualEmail, setManualEmail] = useState('');
    const [manualName, setManualName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsub = db.collection('platform_mailing_lists').orderBy('createdAt', 'desc').onSnapshot(snap => {
            setLists(snap.docs.map(d => ({ id: d.id, ...d.data() } as MailingList)));
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const handleCreateList = async () => {
        if (!newListName.trim()) return;
        await db.collection('platform_mailing_lists').add({
            name: newListName.trim(),
            description: newListDesc.trim(),
            contacts: [],
            tags: [],
            createdAt: new Date().toISOString()
        });
        setNewListName('');
        setNewListDesc('');
        setShowCreateModal(false);
        showToast.success('Mailing list created!');
    };

    const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>, listId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { showToast.warn('CSV must have a header row + data'); return; }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        const emailIdx = headers.findIndex(h => h.includes('email'));
        const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('company'));
        const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('org'));
        const cityIdx = headers.findIndex(h => h.includes('city'));
        const stateIdx = headers.findIndex(h => h.includes('state'));

        if (emailIdx === -1) { showToast.warn('CSV must have an "email" column'); return; }

        const newContacts: MailingListContact[] = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
            const email = cols[emailIdx]?.trim().toLowerCase();
            if (!email || !email.includes('@')) continue;
            newContacts.push({
                email,
                name: nameIdx >= 0 ? cols[nameIdx] : undefined,
                company: companyIdx >= 0 ? cols[companyIdx] : undefined,
                city: cityIdx >= 0 ? cols[cityIdx] : undefined,
                state: stateIdx >= 0 ? cols[stateIdx] : undefined,
                source: 'csv_import',
                tags: []
            });
        }

        if (newContacts.length === 0) { showToast.warn('No valid emails found in CSV'); return; }

        const listDoc = await db.collection('platform_mailing_lists').doc(listId).get();
        const existing: MailingListContact[] = listDoc.data()?.contacts || [];
        const existingEmails = new Set(existing.map(c => c.email));
        const deduped = newContacts.filter(c => !existingEmails.has(c.email));
        const merged = [...existing, ...deduped];

        await db.collection('platform_mailing_lists').doc(listId).update({
            contacts: merged,
            updatedAt: new Date().toISOString()
        });
        showToast.success(`Imported ${deduped.length} contacts (${newContacts.length - deduped.length} duplicates skipped)`);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleAddManualContact = async (listId: string) => {
        if (!manualEmail.includes('@')) { showToast.warn('Enter a valid email'); return; }
        const listDoc = await db.collection('platform_mailing_lists').doc(listId).get();
        const existing: MailingListContact[] = listDoc.data()?.contacts || [];
        if (existing.some(c => c.email === manualEmail.toLowerCase())) { showToast.warn('Already exists'); return; }
        existing.push({ email: manualEmail.toLowerCase(), name: manualName, source: 'manual', tags: [] });
        await db.collection('platform_mailing_lists').doc(listId).update({ contacts: existing, updatedAt: new Date().toISOString() });
        setManualEmail('');
        setManualName('');
        showToast.success('Contact added!');
    };

    const handleRemoveContact = async (listId: string, email: string) => {
        const listDoc = await db.collection('platform_mailing_lists').doc(listId).get();
        const existing: MailingListContact[] = listDoc.data()?.contacts || [];
        await db.collection('platform_mailing_lists').doc(listId).update({
            contacts: existing.filter(c => c.email !== email),
            updatedAt: new Date().toISOString()
        });
    };

    const handleDeleteList = async (id: string) => {
        if (await globalConfirm('Delete this entire mailing list?')) {
            await db.collection('platform_mailing_lists').doc(id).delete();
        }
    };

    const filteredContacts = useMemo(() => {
        if (!showListDetail) return [];
        return showListDetail.contacts.filter(c =>
            c.email.includes(searchTerm.toLowerCase()) ||
            (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.company || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [showListDetail, searchTerm]);

    if (isLoading) return <div className="text-center py-12 text-slate-500">Loading mailing lists...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Users size={20} className="text-primary-500" /> Mailing Lists
                </h2>
                <Button onClick={() => setShowCreateModal(true)} className="w-auto">
                    <Plus size={14} className="mr-2" /> New List
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lists.map(list => (
                    <Card key={list.id} interactive onClick={() => { setShowListDetail(list); setSearchTerm(''); }}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{list.name}</h3>
                                {list.description && <p className="text-xs text-slate-500 mt-1">{list.description}</p>}
                            </div>
                            <button title="Delete list" onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                                className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                            <span className="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-2 py-0.5 rounded-full font-bold">
                                {list.contacts.length} contacts
                            </span>
                            <span>{new Date(list.createdAt).toLocaleDateString()}</span>
                        </div>
                    </Card>
                ))}
                {lists.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500">
                        No mailing lists yet. Create one to get started.
                    </div>
                )}
            </div>

            {/* Create List Modal */}
            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Mailing List" size="sm">
                <div className="space-y-4">
                    <Input label="List Name" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="e.g. Q2 Outreach Prospects" />
                    <Input label="Description (optional)" value={newListDesc} onChange={e => setNewListDesc(e.target.value)} placeholder="Target audience description" />
                    <Button onClick={handleCreateList} className="w-full">Create List</Button>
                </div>
            </Modal>

            {/* List Detail Modal */}
            <Modal isOpen={!!showListDetail} onClose={() => setShowListDetail(null)} title={showListDetail?.name || 'List'} size="xl">
                {showListDetail && (
                    <div className="space-y-4">
                        {/* Add contacts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase text-slate-400">Add Manually</p>
                                <div className="flex gap-2">
                                    <input value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="email@example.com"
                                        className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                                    <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Name (opt)"
                                        className="w-32 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                                    <Button size="sm" onClick={() => handleAddManualContact(showListDetail.id)}><Plus size={14} /></Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase text-slate-400">Import CSV</p>
                                <input ref={fileRef} type="file" accept=".csv" title="Upload CSV file" onChange={e => handleCSVUpload(e, showListDetail.id)}
                                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
                                <p className="text-[10px] text-slate-400">CSV must have an "email" column. Optional: name, company, city, state</p>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search contacts..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" />
                        </div>

                        {/* Contact list */}
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-lg">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                    <tr>
                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">Email</th>
                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">Name</th>
                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">Company</th>
                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">Location</th>
                                        <th className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredContacts.map((c, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-white">{c.email}</td>
                                            <td className="px-4 py-2 text-sm text-slate-600">{c.name || '—'}</td>
                                            <td className="px-4 py-2 text-sm text-slate-600">{c.company || '—'}</td>
                                            <td className="px-4 py-2 text-sm text-slate-500">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                                            <td className="px-4 py-2">
                                                <button title="Remove contact" onClick={() => handleRemoveContact(showListDetail.id, c.email)}
                                                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredContacts.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No contacts in this list yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-400 text-right">{showListDetail.contacts.length} total contacts</p>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default MailingListManager;
