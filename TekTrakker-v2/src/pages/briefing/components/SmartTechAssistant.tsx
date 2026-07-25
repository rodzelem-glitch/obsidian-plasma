import { cleanUndefinedFields } from '../../../lib/utils';

import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, Maximize, Minimize, Image as ImageIcon, Wrench, Cpu, ArrowLeft, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import { db, storage } from 'lib/firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { uploadFileToStorage } from 'lib/storageService';
import { useAppContext } from 'context/AppContext';
import showToast from 'lib/toast';

interface SmartTechAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    initialPrompt?: string;
    jobId?: string;
    organizationId?: string;
}

interface Message {
    id: string;
    text?: string;
    imageUrl?: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

const SmartTechAssistant: React.FC<SmartTechAssistantProps> = ({ isOpen, onClose, initialPrompt, jobId, organizationId }) => {
    const { state, dispatch } = useAppContext();
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (!file.type.startsWith('image/')) {
                showToast.warn("Attachment Failed: The Smart Tech Assistant currently only supports image files.");
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // Dynamic Technician Tools Phase 2 states
    const [activeTab, setActiveTab] = useState<'chat' | 'tools'>('chat');
    const [customTools, setCustomTools] = useState<any[]>([]);
    const [selectedTool, setSelectedTool] = useState<any | null>(null);
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [isRunningTool, setIsRunningTool] = useState(false);
    const [toolSuccess, setToolSuccess] = useState(false);
    const [lastExecutedTool, setLastExecutedTool] = useState<any | null>(null);
    const [lastExecutedParams, setLastExecutedParams] = useState<Record<string, any> | null>(null);
    const [lastExecutedRecordId, setLastExecutedRecordId] = useState<string>('');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    useEffect(() => {
        if (!state.currentUser) return;
        if (state.isDemoMode || !jobId || !organizationId) {
            setMessages([]);
            return;
        }

        const q = query(
            collection(db, `organizations/${organizationId}/jobs/${jobId}/ai_messages`),
            orderBy('timestamp'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages: Message[] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    text: data.text,
                    imageUrl: data.imageUrl,
                    sender: data.sender,
                    timestamp: data.timestamp.toDate(),
                };
            });
            setMessages(fetchedMessages);
        }, (err) => {
            console.error("Firestore Snapshot Error:", err);
            setError("Could not load chat history. Check permissions or network.");
        });

        return () => unsubscribe();
    }, [jobId, organizationId, state.isDemoMode]);

    // Query active custom tools from Firestore synthesizedTools
    useEffect(() => {
        if (!isOpen) return;
        
        const orgIdToUse = organizationId || state.currentOrganization?.id || 'demo-org';

        if (state.isDemoMode || orgIdToUse === 'demo-org') {
            const saved = localStorage.getItem(`demo-technician-tools`);
            if (saved) {
                setCustomTools(JSON.parse(saved).filter((t: any) => t.status === 'active'));
            } else {
                const sampleTools = [
                    {
                        id: 'seed-sample-1',
                        toolName: 'complianceChecklist',
                        requestedCapability: 'Verify safety gear, power disconnection, and workspace safety before starting repairs',
                        inputParameters: `{
  "hasPPE": "boolean",
  "powerDisconnected": "boolean",
  "workspaceSafe": "boolean",
  "notes": "string"
}`,
                        dataMutations: 'Logs safety compliance checklist validation to job record.',
                        compiledSource: `/**
 * Synthesized Tool: complianceChecklist
 * Created for: Verify safety gear, power disconnection, and workspace safety before starting repairs
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(cleanUndefinedFields(recordRef), {
        id: recordRef.id,
        toolName: "complianceChecklist",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`,
                        status: 'active',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'seed-sample-2',
                        toolName: 'vacuumBaselines',
                        requestedCapability: 'Log target microns, achieved microns, and leak-back test results',
                        inputParameters: `{
  "targetMicrons": "number",
  "achievedMicrons": "number",
  "leakPassed": "boolean",
  "decayRate": "number"
}`,
                        dataMutations: 'Logs vacuum pump pull-down parameters and decay ratings.',
                        compiledSource: `/**
 * Synthesized Tool: vacuumBaselines
 * Created for: Log target microns, achieved microns, and leak-back test results
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(cleanUndefinedFields(recordRef), {
        id: recordRef.id,
        toolName: "vacuumBaselines",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`,
                        status: 'active',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'seed-sample-3',
                        toolName: 'materialsConsumed',
                        requestedCapability: 'Record parts, fittings, refrigerants, and other materials consumed on site',
                        inputParameters: `{
  "partName": "string",
  "quantity": "number",
  "unit": "string",
  "isBillable": "boolean"
}`,
                        dataMutations: 'Appends billable and non-billable inventory line items to job invoice sheet.',
                        compiledSource: `/**
 * Synthesized Tool: materialsConsumed
 * Created for: Record parts, fittings, refrigerants, and other materials consumed on site
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(cleanUndefinedFields(recordRef), {
        id: recordRef.id,
        toolName: "materialsConsumed",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`,
                        status: 'active',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'seed-sample-4',
                        toolName: 'customerApprovals',
                        requestedCapability: 'Log customer authorization, sign-off type, and terms acceptance',
                        inputParameters: `{
  "customerName": "string",
  "approvalType": "string",
  "termsAccepted": "boolean",
  "authorizedAmount": "number"
}`,
                        dataMutations: 'Logs digital authorization parameters and sets job scope approval status.',
                        compiledSource: `/**
 * Synthesized Tool: customerApprovals
 * Created for: Log customer authorization, sign-off type, and terms acceptance
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(cleanUndefinedFields(recordRef), {
        id: recordRef.id,
        toolName: "customerApprovals",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`,
                        status: 'active',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'seed-sample-5',
                        toolName: 'compressorWarranty',
                        requestedCapability: 'Register compressor serial number, model number, tonnage, and warranty eligibility',
                        inputParameters: `{
  "serialNumber": "string",
  "modelNumber": "string",
  "tonnage": "number",
  "isEligible": "boolean"
}`,
                        dataMutations: 'Registers compressor component warranties and links to customer asset records.',
                        compiledSource: `/**
 * Synthesized Tool: compressorWarranty
 * Created for: Register compressor serial number, model number, tonnage, and warranty eligibility
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(cleanUndefinedFields(recordRef), {
        id: recordRef.id,
        toolName: "compressorWarranty",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`,
                        status: 'active',
                        createdAt: new Date().toISOString()
                    }
                ];
                localStorage.setItem(`demo-technician-tools`, JSON.stringify(sampleTools));
                setCustomTools(sampleTools.filter(t => t.status === 'active'));
            }
            return;
        }

        const q = query(
            collection(db, 'organizations', orgIdToUse, 'synthesizedTools')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: any[] = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.status === 'active') {
                    items.push({ id: docSnap.id, ...data });
                }
            });
            setCustomTools(items);
        }, (err) => {
            console.error("Error loading technician custom tools:", err);
        });

        return () => unsubscribe();
    }, [isOpen, organizationId, state.isDemoMode, state.currentOrganization]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if ((!prompt.trim() && !imageFile) || isLoading) return;

        const userMessageText = prompt.trim();
        const userMessage: Message = {
            id: Date.now().toString(),
            text: userMessageText,
            imageUrl: imagePreview || undefined,
            sender: 'user',
            timestamp: new Date(),
        };

        setIsLoading(true);
        setError(null);
        setMessages(prev => [...prev, userMessage]);
        setPrompt('');
        setImageFile(null);
        setImagePreview(null);

        if (state.isDemoMode) {
            setTimeout(() => {
                const aiMessage: Message = {
                    id: Date.now().toString() + '-ai',
                    text: `This is a simulated AI response to: "${userMessageText}". In a real environment, this would be a contextual answer based on job data and service history.`,
                    sender: 'ai',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, aiMessage]);
                setIsLoading(false);
            }, 1200);
            return;
        }

        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');

            let imagePayload = null;
            let downloadUrl: string | undefined = undefined;

            if (imageFile) {
                const path = `ai_chats/${organizationId}/${jobId}/${Date.now()}_${imageFile.name}`;
                downloadUrl = await uploadFileToStorage(path, imageFile);

                const base64Image = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageFile);
                });
                imagePayload = { data: base64Image, mimeType: imageFile.type };
            }
            
            if (jobId && organizationId) {
                const messageData: any = {
                    text: userMessage.text,
                    sender: userMessage.sender,
                    timestamp: userMessage.timestamp,
                };
                if (downloadUrl) {
                    messageData.imageUrl = downloadUrl;
                }
                await addDoc(collection(db, `organizations/${organizationId}/jobs/${jobId}/ai_messages`), messageData);
            }
            const systemInstruction = `You are the Omni-Manager AI for field technicians.
If the technician reports HVAC system vitals, Appliance Repair diagnostics (e.g. error codes, amp draw), or Garage Door metrics (e.g. IPPT, weight, door balance), you MUST extract them and output a JSON block at the VERY TOP of your response formatted exactly like this:
\`\`\`json
{
  "action": "update_vitals",
  "vitals": {
    "comp_rla": "15",
    "appliance_error": "OE",
    "garage_ippt": "115"
  }
}
\`\`\`
Followed by a friendly message confirming what you saved. Supported HVAC keys: comp_lra, comp_rla, comp_ohms_ground, comp_winding_ohms, contactor_coil_v, contactor_line_v, contactor_load_v, cap_herm_mfd, cap_fan_mfd, cond_fan_amps, cond_coil_status, defrost_board, reversing_valve, blower_amps, blower_cap_mfd, evap_coil_status, drain_pan, heat_strip_amps, gas_inlet_pressure, gas_manifold_pressure, flame_sensor_ua, inducer_amps, co_ppm, heat_exchanger, filter_size. Supported Appliance keys: appliance_error, appliance_brand, appliance_measured_amps. Supported Garage Door keys: garage_door_weight, garage_ippt, garage_force_up, garage_force_down.`;

            const completePrompt = `${systemInstruction}\n\nTechnician: ${userMessage.text || "Analyze this image."}`;

            const result = await callGeminiAI({
                prompt: completePrompt,
                modelName: "gemini-3.6-flash",
                image: imagePayload
            });

            const data = result.data as { text: string };
            let aiText = data.text;

            // Check for JSON action
            const jsonMatch = aiText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch && jobId && organizationId) {
                try {
                    const payload = JSON.parse(jsonMatch[1]);
                    if (payload.action === 'update_vitals' && payload.vitals) {
                        const jobRef = doc(db, `organizations/${organizationId}/jobs/${jobId}`);
                        const jobDoc = await getDoc(jobRef);
                        if (jobDoc.exists()) {
                            const job = jobDoc.data();
                            const existingReadings = job.toolReadings || [];
                            const otherReadings = existingReadings.filter((r: any) => r.type !== 'HVAC_Vitals');
                            const existingVitalsReading = existingReadings.find((r: any) => r.type === 'HVAC_Vitals');
                            
                            const mergedVitals = {
                                ...(existingVitalsReading?.data || {}),
                                ...payload.vitals
                            };

                            const newReading = {
                                id: existingVitalsReading?.id || `vitals_${Date.now()}`,
                                type: 'HVAC_Vitals',
                                timestamp: new Date().toISOString(),
                                data: mergedVitals,
                                performedBy: 'synthetic_ai'
                            };

                            await updateDoc(jobRef, {
                                toolReadings: [...otherReadings, newReading]
                            });
                            
                            dispatch({ type: 'UPDATE_JOB', payload: { ...job, id: jobId, toolReadings: [...otherReadings, newReading] } as any });
                        }
                        aiText = aiText.replace(jsonMatch[0], '').trim();
                        if (!aiText) aiText = "I have successfully logged those measurements into the HVAC System Vitals database for this job.";
                    }
                } catch (e) {
                    console.error("Failed to parse AI action payload", e);
                }
            }

            if (jobId && organizationId) {
                await addDoc(collection(db, `organizations/${organizationId}/jobs/${jobId}/ai_messages`), {
                    text: aiText,
                    sender: 'ai',
                    timestamp: new Date(),
                });
            }

        } catch (error: any) {
            console.error("Error sending message to AI:", error);
            setError("An error occurred. Please try again.");
             setPrompt(userMessageText);
             setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        } finally {
            setIsLoading(false);
        }
    };
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleExecuteCustomTool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTool) return;
        setIsRunningTool(true);
        setError(null);

        try {
            const orgIdToUse = organizationId || state.currentOrganization?.id || 'demo-org';
            
            // Build parameters payload, converting types securely
            const schema = JSON.parse(selectedTool.inputParameters || '{}');
            const parsedPayload: Record<string, any> = {};
            Object.keys(schema).forEach(key => {
                const type = schema[key];
                const rawVal = formValues[key];
                if (type === 'number') {
                    parsedPayload[key] = rawVal === '' ? 0 : Number(rawVal);
                } else if (type === 'boolean') {
                    parsedPayload[key] = Boolean(rawVal);
                } else {
                    parsedPayload[key] = String(rawVal === undefined ? '' : rawVal);
                }
            });

            let recordId = `data-${Date.now()}`;

            if (state.isDemoMode || orgIdToUse === 'demo-org') {
                // Demo Mode Execution Simulation
                await new Promise(resolve => setTimeout(resolve, 800));
                
                const existingData = JSON.parse(localStorage.getItem(`demo-synthesized-data`) || '[]');
                const newRecord = {
                    id: recordId,
                    toolName: selectedTool.toolName,
                    loggedParams: parsedPayload,
                    createdAt: new Date().toISOString(),
                    organizationId: orgIdToUse
                };
                existingData.push(newRecord);
                localStorage.setItem(`demo-synthesized-data`, JSON.stringify(existingData));
            } else {
                // Live Firestore sandbox mutation write under /organizations/{orgId}/synthesizedData
                const synthesizedDataRef = collection(db, 'organizations', orgIdToUse, 'synthesizedData');
                const recordRef = await addDoc(synthesizedDataRef, {
                    toolName: selectedTool.toolName,
                    loggedParams: parsedPayload,
                    createdAt: new Date().toISOString()
                });
                recordId = recordRef.id;

                // Append an action alert notification into the active job's chat feed
                if (jobId) {
                    const alertText = `[Physical Tool Execution] Technician ran widget "${selectedTool.toolName}" physically with parameters:\n${JSON.stringify(parsedPayload, null, 2)}\nDatabase sandbox reference ID: ${recordId}`;
                    await addDoc(collection(db, `organizations/${organizationId}/jobs/${jobId}/ai_messages`), {
                        text: alertText,
                        sender: 'user',
                        timestamp: new Date()
                    });

                    // Trigger simulated AI acknowledgment response
                    await addDoc(collection(db, `organizations/${organizationId}/jobs/${jobId}/ai_messages`), {
                        text: `Received notification: Physical execution of dynamic tool "${selectedTool.toolName}" logged successfully under reference ID ${recordId}. The context has been loaded into my active worker workspace.`,
                        sender: 'ai',
                        timestamp: new Date()
                    });
                }
            }

            setLastExecutedTool(selectedTool);
            setLastExecutedParams(parsedPayload);
            setLastExecutedRecordId(recordId);
            setToolSuccess(true);
        } catch (err: any) {
            console.error("Failed to run custom tool:", err);
            setError("Execution failed: " + err.message);
        } finally {
            setIsRunningTool(false);
        }
    };

    const handleGeneratePDFReport = async () => {
        if (!lastExecutedTool || !lastExecutedParams) return;
        setIsGeneratingPDF(true);
        try {
            // @ts-ignore - html2pdf has no types available right now
            const html2pdf = (await import('html2pdf.js')).default;
            
            const activeJob = state.jobs.find((j: any) => j.id === jobId) || state.jobs.find((j: any) => j.id === state.activeJobIdForWorkflow);
            const customerName = activeJob?.customerName || 'N/A';
            const jobAddress = activeJob?.address || 'N/A';
            const orgName = state.currentOrganization?.name || 'TekTrakker Service Provider';
            const orgEmail = state.currentOrganization?.email || 'N/A';
            const orgPhone = state.currentOrganization?.phone || 'N/A';
            
            // Build rows for parameters table
            const rows = Object.entries(lastExecutedParams).map(([key, val]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                return `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 10px; font-weight: 600; color: #334155; text-align: left;">${label}</td>
                        <td style="padding: 12px 10px; text-align: right; font-family: monospace; color: #0f172a;">${String(val)}</td>
                    </tr>
                `;
            }).join('');
            
            const container = document.createElement('div');
            container.innerHTML = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; line-height: 1.5;">
                    <!-- Header -->
                    <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: start;">
                        <div>
                           <h1 style="color: #7c3aed; margin: 0; font-size: 24px; font-weight: 800; tracking-wide; text-align: left;">TEKTRAKKER REPORT</h1>
                           <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; text-align: left;">Dynamically Synthesized Widget Data</p>
                        </div>
                        <div style="text-align: right;">
                           <p style="margin: 0; font-weight: bold; font-size: 14px; color: #0f172a;">${orgName}</p>
                           <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">${orgEmail} | ${orgPhone}</p>
                        </div>
                    </div>
                    
                    <!-- Meta Information -->
                    <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 12px; background: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 12px;">
                        <div style="flex: 1; text-align: left;">
                           <p style="margin: 0 0 6px 0; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Customer / Site</p>
                           <p style="margin: 0; font-weight: bold; color: #0f172a; font-size: 13px;">${customerName}</p>
                           <p style="margin: 4px 0 0 0; color: #475569;">${jobAddress}</p>
                        </div>
                        <div style="flex: 1; text-align: right;">
                           <p style="margin: 0 0 6px 0; color: #64748b; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Execution Details</p>
                           <p style="margin: 0; color: #475569;"><strong>Job ID:</strong> #${jobId ? jobId.slice(0, 8) : 'N/A'}</p>
                           <p style="margin: 4px 0 0 0; color: #475569;"><strong>Date Executed:</strong> ${new Date().toLocaleDateString()}</p>
                           <p style="margin: 4px 0 0 0; color: #475569;"><strong>Record ID:</strong> ${lastExecutedRecordId || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <!-- Tool info banner -->
                    <div style="border-left: 4px solid #7c3aed; background: #faf5ff; padding: 15px 20px; border-radius: 4px 12px 12px 4px; margin-bottom: 35px; text-align: left;">
                       <h3 style="color: #7c3aed; margin: 0 0 4px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Tool Name: ${lastExecutedTool.toolName}</h3>
                       <p style="margin: 0; font-size: 12px; color: #581c87; font-weight: 500; font-style: italic;">"${lastExecutedTool.requestedCapability}"</p>
                    </div>
                    
                    <!-- Parameters Table -->
                    <h3 style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; text-align: left;">Captured Parameters</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 50px;">
                       <thead>
                           <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1;">
                               <th style="text-align: left; padding: 10px 10px; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Parameter Name</th>
                               <th style="text-align: right; padding: 10px 10px; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Logged Value</th>
                           </tr>
                       </thead>
                       <tbody>
                           ${rows}
                       </tbody>
                    </table>
                    
                    <!-- Signatures -->
                    <div style="border-top: 1.5px dashed #e2e8f0; padding-top: 25px; margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #64748b;">
                       <div style="text-align: left;">
                           <p style="margin: 0; font-weight: bold;">TekTrakker Autonomous Audit Log</p>
                           <p style="margin: 3px 0 0 0;">Report compiled safely in sandboxed tenant environment.</p>
                       </div>
                       <div style="width: 220px; text-align: right;">
                           <div style="border-bottom: 1px solid #94a3b8; height: 35px; margin-bottom: 6px;"></div>
                           <p style="margin: 0; font-weight: bold; color: #0f172a; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Technician Signature</p>
                       </div>
                    </div>
                </div>
            `;
            
            const opt: any = {
                margin: 10,
                filename: `Report-${lastExecutedTool.toolName}-${lastExecutedRecordId || Date.now()}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            await html2pdf().from(container).set(opt).save();
            showToast.success("PDF Report generated and downloaded successfully!");
        } catch (err: any) {
            console.error("PDF generation failed:", err);
            showToast.error("Failed to generate PDF: " + err.message);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleSelectTool = (tool: any) => {
        setSelectedTool(tool);
        setToolSuccess(false);
        setError(null);
        
        // Initialize form values with defaults
        const schema = JSON.parse(tool.inputParameters || '{}');
        const initialForm: Record<string, any> = {};
        Object.keys(schema).forEach(key => {
            const type = schema[key];
            if (type === 'number') initialForm[key] = '';
            else if (type === 'boolean') initialForm[key] = false;
            else initialForm[key] = '';
        });
        setFormValues(initialForm);
    };

    const handleBackToTools = () => {
        setSelectedTool(null);
        setToolSuccess(false);
        setError(null);
    };
    const { primaryColor } = state.currentOrganization || { primaryColor: '#2563eb' };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Smart Tech Assistant" size={isMaximized ? "full" : "md"}>
            <div className={`flex flex-col h-[600px] ${isMaximized ? 'lg:h-[calc(100vh-80px)]' : ''} bg-gray-50 dark:bg-slate-800`}>
                
                {/* Modern Header with Tab Switching */}
                <div className="flex flex-col border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 pt-4 shadow-sm">
                    <div className="flex justify-between items-center pb-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                Smart Tech Briefing Assistant
                            </h3>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setIsMaximized(!isMaximized)} className="h-8 w-8 p-0 rounded-lg">
                                {isMaximized ? <Minimize size={18} /> : <Maximize size={18} />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-lg">
                                <X size={18} />
                            </Button>
                        </div>
                    </div>

                    {/* Premium Sliding Navigation Tabs */}
                    <div className="flex border-t border-slate-100 dark:border-slate-800 mt-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('chat')}
                            className={`flex-1 py-3 text-xs uppercase tracking-widest font-black transition-all border-b-2 flex items-center justify-center gap-2 ${
                                activeTab === 'chat'
                                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Send className="w-3.5 h-3.5" />
                            AI Chat Assistant
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('tools')}
                            className={`flex-1 py-3 text-xs uppercase tracking-widest font-black transition-all border-b-2 flex items-center justify-center gap-2 ${
                                activeTab === 'tools'
                                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            In-App Tools ({customTools.length})
                        </button>
                    </div>
                </div>

                {/* Tab content area */}
                <div className="flex-1 flex flex-col min-h-0">
                    {activeTab === 'chat' ? (
                        <div 
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className="flex-1 flex flex-col min-h-0 relative"
                        >
                            {dragActive && (
                                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-purple-500 rounded-b-2xl p-4 text-center animate-fade-in">
                                    <div className="p-4 bg-purple-500/10 rounded-full border border-purple-500/30 mb-3 animate-bounce">
                                        <ImageIcon className="w-10 h-10 text-purple-600" />
                                    </div>
                                    <p className="text-sm font-bold text-white uppercase tracking-wider">Drop Image to Attach</p>
                                    <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, GIF</p>
                                </div>
                            )}
                            {/* Standard Chat Interface */}
                            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-900">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                                        <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-full border border-purple-100 dark:border-purple-900/30">
                                            <Cpu className="w-10 h-10 text-purple-600 dark:text-purple-400 animate-pulse" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">How can I assist you with this job?</h4>
                                            <p className="text-xs text-slate-400 max-w-xs mt-1">Ask for diagnostic codes, vitals updates, appliance specifications, or structural schematics.</p>
                                        </div>
                                    </div>
                                )}
                                
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm ${
                                            msg.sender === 'user' 
                                                ? 'bg-purple-600 text-white rounded-br-none' 
                                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-100 dark:border-slate-800'
                                        }`}>
                                            {msg.imageUrl && (
                                                <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
                                                    <img src={msg.imageUrl} alt="Uploaded attachment" className="max-w-xs max-h-48 object-cover rounded-lg" />
                                                </a>
                                            )}
                                            {msg.text && <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                                            <span className="block text-[9px] mt-1.5 opacity-70 text-right font-semibold">
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                            <Loader2 className="animate-spin w-4 h-4 text-purple-600" />
                                            <span className="text-xs text-slate-400">Assistant is thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat Inputs */}
                            <div className="border-t border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
                                {error && <p className="text-xs text-red-500 mb-2 font-semibold flex items-center gap-1">⚠️ {error}</p>}
                                {imagePreview && (
                                    <div className="mb-3 relative w-20 h-20 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                        <img src={imagePreview} alt="Upload preview" className="w-full h-full object-cover" />
                                        <Button 
                                            type="button" 
                                            size="icon" 
                                            variant="danger" 
                                            onClick={removeImage} 
                                            className="absolute top-1 right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center"
                                        >
                                            <X size={12} />
                                        </Button>
                                    </div>
                                )}
                                <div className="flex items-end space-x-2">
                                    <input 
                                        type="file" 
                                        title="Upload Image" 
                                        accept="image/*" 
                                        className="hidden" 
                                        id={`image-upload-${jobId || 'new'}`} 
                                        onChange={handleImageChange} 
                                    />
                                    <Button 
                                        type="button" 
                                        variant="secondary" 
                                        size="icon" 
                                        onClick={() => document.getElementById(`image-upload-${jobId || 'new'}`)?.click()} 
                                        title="Upload Image"
                                        className="h-10 w-10 p-0 rounded-xl border border-slate-200 dark:border-slate-700"
                                    >
                                        <ImageIcon size={18} className="text-slate-400 dark:text-slate-300" />
                                    </Button>
                                    <Textarea 
                                        value={prompt} 
                                        onChange={(e) => setPrompt(e.target.value)} 
                                        placeholder="Ask a question..." 
                                        className="flex-1 text-xs min-h-[40px] max-h-24 resize-none rounded-xl" 
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} 
                                    />
                                    <Button 
                                        onClick={handleSendMessage} 
                                        disabled={isLoading || (!prompt.trim() && !imageFile)} 
                                        title="Send Message" 
                                        className="bg-purple-600 hover:bg-purple-700 text-white h-10 px-4 rounded-xl flex items-center justify-center gap-1.5"
                                    >
                                        <Send size={16} />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Physical Technician In-App Tools Dashboard */
                        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 dark:bg-slate-900 flex flex-col">
                            {selectedTool ? (
                                <div className="space-y-6 flex-1 flex flex-col">
                                    {/* Selected Tool Form view */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleBackToTools}
                                            className="p-2 text-slate-500 hover:text-purple-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                        </button>
                                        <div>
                                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-purple-600 dark:text-purple-400 block">ACTIVE TECHNICIAN WIDGET</span>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mt-0.5">{selectedTool.toolName}</h4>
                                        </div>
                                    </div>

                                    {toolSuccess ? (
                                        /* Premium visual success screen overlay */
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl shadow-sm">
                                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-full">
                                                <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
                                            </div>
                                            <div>
                                                <h4 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider">Tool Execution Complete</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
                                                    The physical tool executed safely within your sandboxed tenant container. Custom parameters have been committed under `/synthesizedData` and logged directly to the job chat thread.
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2 w-full max-w-xs mt-4">
                                                <Button 
                                                    onClick={handleGeneratePDFReport}
                                                    disabled={isGeneratingPDF}
                                                    variant="primary"
                                                    className="w-full py-2.5 text-xs uppercase tracking-wider font-extrabold bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-1.5"
                                                >
                                                    {isGeneratingPDF ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            Generating PDF...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FileText className="w-3.5 h-3.5" />
                                                            Download PDF Report
                                                        </>
                                                    )}
                                                </Button>
                                                <div className="flex gap-2 w-full">
                                                    <Button 
                                                        onClick={() => setToolSuccess(false)}
                                                        variant="secondary"
                                                        className="flex-1 py-2 text-xs uppercase tracking-wider font-extrabold"
                                                    >
                                                        Run Again
                                                    </Button>
                                                    <Button 
                                                        onClick={handleBackToTools}
                                                        variant="secondary"
                                                        className="flex-1 py-2 text-xs uppercase tracking-wider font-extrabold"
                                                    >
                                                        Back to Tools
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Form inputs based on schema */
                                        <form onSubmit={handleExecuteCustomTool} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 p-6 rounded-2xl shadow-sm space-y-4 flex-1 flex flex-col justify-between">
                                            <div className="space-y-4">
                                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MUTATION SCHEME</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">"{selectedTool.requestedCapability}"</p>
                                                </div>

                                                {error && <p className="text-xs text-red-500 font-semibold">⚠️ {error}</p>}

                                                {/* DYNAMIC FORM FIELDS */}
                                                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                                                    {Object.entries(JSON.parse(selectedTool.inputParameters || '{}')).map(([key, type]) => {
                                                        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                                        return (
                                                            <div key={key} className="space-y-1">
                                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">{label} ({String(type)})</label>
                                                                {type === 'boolean' ? (
                                                                    <div className="flex items-center gap-2.5 py-1">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            id={`param-${key}`}
                                                                            checked={formValues[key] || false}
                                                                            onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.checked }))}
                                                                            className="w-4 h-4 rounded text-purple-600 border-slate-300 focus:ring-purple-500 focus:ring-2"
                                                                        />
                                                                        <label htmlFor={`param-${key}`} className="text-xs font-semibold text-slate-500 dark:text-slate-400">Enable / True</label>
                                                                    </div>
                                                                ) : type === 'number' ? (
                                                                    <input 
                                                                        type="number"
                                                                        required
                                                                        value={formValues[key]}
                                                                        onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                                                                        placeholder={`Enter numeric ${label.toLowerCase()}`}
                                                                    />
                                                                ) : (
                                                                    <input 
                                                                        type="text"
                                                                        required
                                                                        value={formValues[key]}
                                                                        onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500"
                                                                        placeholder={`Enter ${label.toLowerCase()}`}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="pt-4 flex gap-3">
                                                <Button
                                                    type="button"
                                                    onClick={handleBackToTools}
                                                    variant="secondary"
                                                    className="flex-1 py-2 text-xs uppercase tracking-wider font-extrabold"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={isRunningTool}
                                                    variant="primary"
                                                    className="flex-1 py-2 text-xs uppercase tracking-wider font-extrabold bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-1.5"
                                                >
                                                    {isRunningTool ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            Executing Widget...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Cpu className="w-3.5 h-3.5" />
                                                            Execute Action
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            ) : (
                                /* List of Custom Developer Tools */
                                <div className="space-y-4 flex-1 flex flex-col">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Available In-App Technician Tools</h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">These widgets were autonomously synthesized or manually configured by admins, hot-linked directly to your interface.</p>
                                    </div>
                                    
                                    {customTools.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-slate-400">
                                            <Wrench className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                                            <p className="text-xs font-bold">No physical technician widgets active.</p>
                                            <p className="text-[10px] text-slate-500/80 mt-1 max-w-xs">Create custom tools in the Admin Settings panel under "Technician Tools" using the Agentic Prompter to see them here.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[420px] pr-1">
                                            {customTools.map((tool) => (
                                                <button
                                                    key={tool.id}
                                                    type="button"
                                                    onClick={() => handleSelectTool(tool)}
                                                    className="w-full text-left p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl shadow-sm hover:border-purple-500/40 hover:shadow-md transition-all flex items-center justify-between group active:scale-[0.99]"
                                                >
                                                    <div className="space-y-1.5 flex-1 pr-4">
                                                        <div className="flex items-center gap-2">
                                                            <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">{tool.toolName}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic font-medium line-clamp-2">"{tool.requestedCapability}"</p>
                                                        <div className="flex flex-wrap gap-2.5 pt-0.5">
                                                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">
                                                                Inputs: {Object.keys(JSON.parse(tool.inputParameters || '{}')).join(', ') || 'none'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default SmartTechAssistant;
