import React, { useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { getFirestore, doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import showToast from 'lib/toast';
import { Sliders, Plus, Trash2, Layout, List, Eye } from 'lucide-react';
import DynamicPluginRenderer from 'components/ui/DynamicPluginRenderer';

interface WidgetConfig {
    id: string;
    type: 'stat' | 'form_input' | 'checklist';
    title: string;
    placeholder?: string;
    valueType?: 'string' | 'number';
    options?: string[];
}

const CustomizationsTab: React.FC = () => {
    const { state } = useAppContext();
    const [selectedSection, setSelectedSection] = useState<'work_orders' | 'dashboard' | 'customer_details'>('work_orders');
    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states for new widget
    const [type, setType] = useState<'stat' | 'form_input' | 'checklist'>('stat');
    const [title, setTitle] = useState('');
    const [placeholder, setPlaceholder] = useState('');
    const [valueType, setValueType] = useState<'string' | 'number'>('string');
    const [newOption, setNewOption] = useState('');
    const [options, setOptions] = useState<string[]>([]);

    const orgId = state.currentOrganization?.id || 'demo-org';
    const isDemo = state.isDemoMode;

    useEffect(() => {
        if (isDemo || orgId === 'demo-org') {
            const saved = localStorage.getItem(`demo-customizations-${selectedSection}`);
            if (saved) {
                setWidgets(JSON.parse(saved));
            } else {
                if (selectedSection === 'work_orders') {
                    setWidgets([
                        {
                            id: 'widget-refrig',
                            type: 'stat',
                            title: 'Refrigerant Recovered Today (Lbs)',
                            placeholder: '0'
                        },
                        {
                            id: 'widget-cert',
                            type: 'form_input',
                            title: 'HVAC EPA Certification Number',
                            placeholder: 'Enter EPA-608 Universal ID...',
                            valueType: 'string'
                        },
                        {
                            id: 'widget-safety-check',
                            type: 'checklist',
                            title: 'Dynamic Safety Briefing Compliance Checklist',
                            options: [
                                'Check ladder placement & stability',
                                'Verify high-voltage power lockout tagout',
                                'Confirm proper protective equipment (PPE)'
                            ]
                        }
                    ]);
                } else {
                    setWidgets([]);
                }
            }
            setLoading(false);
            return;
        }

        const db = getFirestore();
        const docRef = doc(db, 'organizations', orgId, 'customizations', selectedSection);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setWidgets(docSnap.data().widgets || []);
            } else {
                setWidgets([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error loading widgets: ", error);
            showToast.error("Failed to load custom widgets.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [orgId, selectedSection, isDemo]);

    const handleAddOption = () => {
        if (newOption && !options.includes(newOption)) {
            setOptions([...options, newOption]);
            setNewOption('');
        }
    };

    const handleRemoveOption = (index: number) => {
        setOptions(options.filter((_, i) => i !== index));
    };

    const adminEmail = state.currentUser?.email || 'platform@tektrakker.com';

    const handleSaveWidgets = async (updatedWidgets: WidgetConfig[]) => {
        if (isDemo || orgId === 'demo-org') {
            localStorage.setItem(`demo-customizations-${selectedSection}`, JSON.stringify(updatedWidgets));
            setWidgets(updatedWidgets);
            showToast.success("Customization saved in demo mode.");
            return;
        }

        const db = getFirestore();
        const docRef = doc(db, 'organizations', orgId, 'customizations', selectedSection);

        try {
            await setDoc(docRef, { widgets: updatedWidgets }, { merge: true });

            // Create security audit email document to dispatch to admin
            const mailRef = doc(collection(db, 'mail'));
            await setDoc(mailRef, {
                to: adminEmail,
                message: {
                    from: 'TekTrakker Security Portal <no-reply@tektrakker.com>',
                    subject: `[TekTrakker Audit] Organization Custom Layout Modified: ${selectedSection}`,
                    text: `Hello,\n\nThe organization customization layouts for the section "${selectedSection}" have been updated by an administrator (Org ID: ${orgId}).\n\n- Updated Section: ${selectedSection}\n- Modified By: ${adminEmail}\n- Total Widgets Defined: ${updatedWidgets.length}\n\nBest regards,\nTekTrakker Platform Security`,
                    html: `<p>Hello,</p>
                           <p>The organization customization layouts for the section <strong>"${selectedSection}"</strong> have been updated by an administrator (<strong>Org ID: ${orgId}</strong>).</p>
                           <ul>
                               <li><strong>Updated Section:</strong> <code>${selectedSection}</code></li>
                               <li><strong>Modified By:</strong> ${adminEmail}</li>
                               <li><strong>Total Widgets Defined:</strong> ${updatedWidgets.length}</li>
                           </ul>
                           <p>These layout configurations are loaded dynamically in the respective views for your organization.</p>
                           <hr/>
                           <p><em>This is an automated security audit report.</em></p>`
                }
            });

            showToast.success("Organization custom widgets updated successfully & audit report emailed!");
        } catch (error) {
            console.error("Error saving widgets: ", error);
            showToast.error("Failed to save changes. Verify Firestore permissions.");
        }
    };

    const handleCreateWidget = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) {
            showToast.error("Please enter a title for the widget.");
            return;
        }

        const newWidget: WidgetConfig = {
            id: `widget-${Date.now()}`,
            type,
            title,
            ...(type === 'stat' && { placeholder: placeholder || '0' }),
            ...(type === 'form_input' && { placeholder, valueType }),
            ...(type === 'checklist' && { options })
        };

        const updated = [...widgets, newWidget];
        handleSaveWidgets(updated);

        setTitle('');
        setPlaceholder('');
        setValueType('string');
        setOptions([]);
        setNewOption('');
    };

    const handleDeleteWidget = (id: string) => {
        const updated = widgets.filter(w => w.id !== id);
        handleSaveWidgets(updated);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <Layout className="w-5 h-5 text-indigo-500" />
                                Multi-Tenant Layout Sandboxing
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">Configure tenant-level custom widgets and forms stored entirely as schema configurations in Firestore.</p>
                        </div>
                    </div>

                    <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-900 rounded-xl mb-6 border border-slate-100 dark:border-slate-800">
                        {(['work_orders', 'dashboard', 'customer_details'] as const).map(section => (
                            <button
                                key={section}
                                type="button"
                                onClick={() => setSelectedSection(section)}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                    selectedSection === section
                                        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-slate-700'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                }`}
                            >
                                {section.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="py-12 text-center text-slate-400">Loading widgets schema...</div>
                    ) : widgets.length === 0 ? (
                        <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 text-xs">
                            No custom widgets defined for this section. Create one using the form on the right!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {widgets.map((widget) => (
                                <div key={widget.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{widget.title}</h4>
                                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full">
                                            {widget.type}
                                        </span>
                                        {widget.type === 'checklist' && (
                                            <span className="text-[10px] text-slate-400 ml-2">
                                                ({widget.options?.length || 0} items)
                                            </span>
                                        )}
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => handleDeleteWidget(widget.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Eye className="w-4 h-4 text-emerald-500" />
                        Layout Preview
                    </h3>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
                        <DynamicPluginRenderer sectionId={selectedSection} />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <form onSubmit={handleCreateWidget} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-2">
                        <Plus className="w-5 h-5 text-indigo-500" />
                        Create Custom Widget
                    </h3>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Widget Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="w-full rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-sm h-10 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                        >
                            <option value="stat">Stat Card (Metric)</option>
                            <option value="form_input">Form Field (Input)</option>
                            <option value="checklist">Compliance Checklist</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Title / Label</label>
                        <Input
                            placeholder="e.g. EPA Registration Number"
                            value={title}
                            onChange={(e: any) => setTitle(e.target.value)}
                        />
                    </div>

                    {type === 'stat' && (
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Default Stat Value</label>
                            <Input
                                placeholder="e.g. 0 or N/A"
                                value={placeholder}
                                onChange={(e: any) => setPlaceholder(e.target.value)}
                            />
                        </div>
                    )}

                    {type === 'form_input' && (
                        <>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Input Placeholder</label>
                                <Input
                                    placeholder="e.g. Type Universal ID..."
                                    value={placeholder}
                                    onChange={(e: any) => setPlaceholder(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Value Type</label>
                                <select
                                    value={valueType}
                                    onChange={(e) => setValueType(e.target.value as any)}
                                    className="w-full rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-sm h-10 px-3 focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                >
                                    <option value="string">Text</option>
                                    <option value="number">Number</option>
                                </select>
                            </div>
                        </>
                    )}

                    {type === 'checklist' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Checklist Items</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="e.g. Verify pressure levels"
                                    value={newOption}
                                    onChange={(e: any) => setNewOption(e.target.value)}
                                    onKeyPress={(e: any) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                                />
                                <Button type="button" onClick={handleAddOption} className="px-3">Add</Button>
                            </div>
                            <div className="space-y-1 max-h-40 overflow-y-auto pt-1">
                                {options.map((opt, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                        <span className="dark:text-slate-300">{opt}</span>
                                        <button type="button" onClick={() => handleRemoveOption(i)} className="text-slate-400 hover:text-red-500">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Button type="submit" variant="primary" className="w-full mt-4 flex items-center justify-center gap-2 py-2">
                        <Plus className="w-4 h-4" /> Add Widget to View
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default CustomizationsTab;