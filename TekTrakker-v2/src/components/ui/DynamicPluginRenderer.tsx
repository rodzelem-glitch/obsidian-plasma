import React, { useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import Card, { CardHeader, CardTitle, CardContent } from './Card';
import Button from './Button';
import Input from './Input';
import Spinner from './Spinner';
import showToast from 'lib/toast';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface WidgetConfig {
    id: string;
    type: 'stat' | 'form_input' | 'checklist';
    title: string;
    placeholder?: string;
    valueType?: 'string' | 'number';
    options?: string[];
}

interface DynamicPluginRendererProps {
    sectionId: string;
}

const DynamicPluginRenderer: React.FC<DynamicPluginRendererProps> = ({ sectionId }) => {
    const { state } = useAppContext();
    const [loading, setLoading] = useState(true);
    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [checklistData, setChecklistData] = useState<Record<string, boolean>>({});

    const orgId = state.currentOrganization?.id || 'demo-org';
    const isDemo = state.isDemoMode;

    useEffect(() => {
        if (isDemo || orgId === 'demo-org') {
            setTimeout(() => {
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
                setLoading(false);
            }, 500);
            return;
        }

        const db = getFirestore();
        const configDocRef = doc(db, 'organizations', orgId, 'customizations', sectionId);

        const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setWidgets(data.widgets || []);
            } else {
                setWidgets([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching dynamic plugins: ", error);
            showToast.error("Failed to load organization dynamic widgets.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [orgId, sectionId, isDemo]);

    const handleFormChange = (id: string, val: string) => {
        setFormData(prev => ({ ...prev, [id]: val }));
    };

    const handleChecklistToggle = (widgetId: string, optionIdx: number) => {
        const key = `${widgetId}-${optionIdx}`;
        setChecklistData(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmitData = (e: React.FormEvent) => {
        e.preventDefault();
        showToast.success("Successfully logged organization-specific parameters!");
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Spinner size="lg" />
            </div>
        );
    }

    if (widgets.length === 0) {
        return (
            <div className="bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-medium">No custom widgets created yet for this section.</p>
                <p className="text-xs text-slate-400 mt-1">Add dynamic widgets from settings to tailor your view.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmitData} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {widgets.map((widget) => {
                    if (widget.type === 'stat') {
                        return (
                            <div 
                                key={widget.id} 
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/60 p-6 rounded-2xl border border-blue-100 dark:border-slate-700 shadow-sm relative overflow-hidden flex items-center justify-between transition-transform hover:scale-[1.02] duration-300"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/10 rounded-full blur-xl"></div>
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest leading-none mb-2">{widget.title}</h4>
                                    <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{formData[widget.id] || widget.placeholder || '0'}</span>
                                </div>
                                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                            </div>
                        );
                    }

                    if (widget.type === 'form_input') {
                        return (
                            <Card key={widget.id} className="shadow-sm border-slate-200 dark:border-slate-800 hover:-translate-y-0.5 transition-transform duration-300">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-bold text-slate-800 dark:text-white">{widget.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Input
                                        type={widget.valueType === 'number' ? 'number' : 'text'}
                                        placeholder={widget.placeholder}
                                        value={formData[widget.id] || ''}
                                        onChange={(e: any) => handleFormChange(widget.id, e.target.value)}
                                        className="h-10"
                                    />
                                </CardContent>
                            </Card>
                        );
                    }

                    if (widget.type === 'checklist') {
                        return (
                            <Card key={widget.id} className="md:col-span-2 shadow-sm border-slate-200 dark:border-slate-800">
                                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <CardTitle className="text-sm font-bold text-slate-800 dark:text-white">{widget.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <ul className="space-y-3">
                                        {(widget.options || []).map((option, idx) => {
                                            const activeKey = `${widget.id}-${idx}`;
                                            const isChecked = !!checklistData[activeKey];
                                            return (
                                                <li 
                                                    key={idx} 
                                                    onClick={() => handleChecklistToggle(widget.id, idx)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                                                        isChecked 
                                                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                                                    />
                                                    <span className={isChecked ? 'line-through opacity-80' : ''}>{option}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </CardContent>
                            </Card>
                        );
                    }

                    return null;
                })}
            </div>
            <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" className="px-6 py-2 shadow-md">
                    Save Dynamics
                </Button>
            </div>
        </form>
    );
};

export default DynamicPluginRenderer;
