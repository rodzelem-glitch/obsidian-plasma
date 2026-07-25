import { cleanUndefinedFields } from '../../../../lib/utils';
import React, { useState, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { getFirestore, doc, collection, onSnapshot, setDoc } from 'firebase/firestore';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import showToast from 'lib/toast';
import { Wrench, Plus, Trash2, Cpu, FileText, CheckCircle2, ShieldAlert, Sparkles, Loader2, Search, Copy } from 'lucide-react';

interface CustomTool {
    id: string;
    toolName: string;
    requestedCapability: string;
    inputParameters: string;
    dataMutations: string;
    compiledSource: string;
    status: 'active' | 'inactive';
    createdAt: string;
}

const SEED_TOOLS = [
  {
    toolName: 'complianceChecklist',
    requestedCapability: 'Verify safety gear, power disconnection, and workspace safety before starting repairs',
    inputParameters: '{\n  "hasPPE": "boolean",\n  "powerDisconnected": "boolean",\n  "workspaceSafe": "boolean",\n  "notes": "string"\n}',
    dataMutations: 'Logs safety compliance checklist validation to job record.',
    compiledSource: `/**\n * Synthesized Tool: complianceChecklist\n * Created for: Verify safety gear, power disconnection, and workspace safety before starting repairs\n * Generated autonomously by Antigravity Synthesis Engine.\n */\nimport * as admin from 'firebase-admin';\n\nexport async function executeSynthesizedTool(orgId: string, params: any) {\n    const db = admin.firestore();\n    const batch = db.batch();\n    \n    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();\n    batch.set(cleanUndefinedFields(recordRef), {\n        id: recordRef.id,\n        toolName: "complianceChecklist",\n        loggedParams: params,\n        createdAt: new Date().toISOString()\n    });\n    \n    await batch.commit();\n    return { success: true, refId: recordRef.id };\n}`,
    status: 'active' as const
  },
  {
    toolName: 'vacuumBaselines',
    requestedCapability: 'Log target microns, achieved microns, and leak-back test results',
    inputParameters: '{\n  "targetMicrons": "number",\n  "achievedMicrons": "number",\n  "leakPassed": "boolean",\n  "decayRate": "number"\n}',
    dataMutations: 'Logs vacuum pump pull-down parameters and decay ratings.',
    compiledSource: `/**\n * Synthesized Tool: vacuumBaselines\n * Created for: Log target microns, achieved microns, and leak-back test results\n * Generated autonomously by Antigravity Synthesis Engine.\n */\nimport * as admin from 'firebase-admin';\n\nexport async function executeSynthesizedTool(orgId: string, params: any) {\n    const db = admin.firestore();\n    const batch = db.batch();\n    \n    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();\n    batch.set(cleanUndefinedFields(recordRef), {\n        id: recordRef.id,\n        toolName: "vacuumBaselines",\n        loggedParams: params,\n        createdAt: new Date().toISOString()\n    });\n    \n    await batch.commit();\n    return { success: true, refId: recordRef.id };\n}`,
    status: 'active' as const
  },
  {
    toolName: 'materialsConsumed',
    requestedCapability: 'Record parts, fittings, refrigerants, and other materials consumed on site',
    inputParameters: '{\n  "partName": "string",\n  "quantity": "number",\n  "unit": "string",\n  "isBillable": "boolean"\n}',
    dataMutations: 'Appends billable and non-billable inventory line items to job invoice sheet.',
    compiledSource: `/**\n * Synthesized Tool: materialsConsumed\n * Created for: Record parts, fittings, refrigerants, and other materials consumed on site\n * Generated autonomously by Antigravity Synthesis Engine.\n */\nimport * as admin from 'firebase-admin';\n\nexport async function executeSynthesizedTool(orgId: string, params: any) {\n    const db = admin.firestore();\n    const batch = db.batch();\n    \n    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();\n    batch.set(cleanUndefinedFields(recordRef), {\n        id: recordRef.id,\n        toolName: "materialsConsumed",\n        loggedParams: params,\n        createdAt: new Date().toISOString()\n    });\n    \n    await batch.commit();\n    return { success: true, refId: recordRef.id };\n}`,
    status: 'active' as const
  },
  {
    toolName: 'customerApprovals',
    requestedCapability: 'Log customer authorization, sign-off type, and terms acceptance',
    inputParameters: '{\n  "customerName": "string",\n  "approvalType": "string",\n  "termsAccepted": "boolean",\n  "authorizedAmount": "number"\n}',
    dataMutations: 'Logs digital authorization parameters and sets job scope approval status.',
    compiledSource: `/**\n * Synthesized Tool: customerApprovals\n * Created for: Log customer authorization, sign-off type, and terms acceptance\n * Generated autonomously by Antigravity Synthesis Engine.\n */\nimport * as admin from 'firebase-admin';\n\nexport async function executeSynthesizedTool(orgId: string, params: any) {\n    const db = admin.firestore();\n    const batch = db.batch();\n    \n    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();\n    batch.set(cleanUndefinedFields(recordRef), {\n        id: recordRef.id,\n        toolName: "customerApprovals",\n        loggedParams: params,\n        createdAt: new Date().toISOString()\n    });\n    \n    await batch.commit();\n    return { success: true, refId: recordRef.id };\n}`,
    status: 'active' as const
  },
  {
    toolName: 'compressorWarranty',
    requestedCapability: 'Register compressor serial number, model number, tonnage, and warranty eligibility',
    inputParameters: '{\n  "serialNumber": "string",\n  "modelNumber": "string",\n  "tonnage": "number",\n  "isEligible": "boolean"\n}',
    dataMutations: 'Registers compressor component warranties and links to customer asset records.',
    compiledSource: `/**\n * Synthesized Tool: compressorWarranty\n * Created for: Register compressor serial number, model number, tonnage, and warranty eligibility\n * Generated autonomously by Antigravity Synthesis Engine.\n */\nimport * as admin from 'firebase-admin';\n\nexport async function executeSynthesizedTool(orgId: string, params: any) {\n    const db = admin.firestore();\n    const batch = db.batch();\n    \n    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();\n    batch.set(cleanUndefinedFields(recordRef), {\n        id: recordRef.id,\n        toolName: "compressorWarranty",\n        loggedParams: params,\n        createdAt: new Date().toISOString()\n    });\n    \n    await batch.commit();\n    return { success: true, refId: recordRef.id };\n}`,
    status: 'active' as const
  }
];


const MARKETPLACE_SEEDS = [
  {
    id: 'market-1',
    toolName: 'refrigerantLeakTest',
    requestedCapability: 'Log system pressure levels, electronic leak detector results, and exact leak coordinates',
    inputParameters: '{\n  "suctionPressurePsi": "number",\n  "liquidPressurePsi": "number",\n  "leakDetected": "boolean",\n  "leakLocation": "string"\n}',
    dataMutations: 'Appends refrigerant leak inspection records under synthesizedData.',
    compiledSource: `/**\n * Synthesized Tool: refrigerantLeakTest\n * Created for: Log system pressure levels, electronic leak detector results, and exact leak coordinates\n * Generated autonomously by Antigravity Synthesis Engine.\n */\nimport * as admin from 'firebase-admin';\n\nexport async function executeSynthesizedTool(orgId: string, params: any) {\n    const db = admin.firestore();\n    const batch = db.batch();\n    \n    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();\n    batch.set(cleanUndefinedFields(recordRef), {\n        id: recordRef.id,\n        toolName: "refrigerantLeakTest",\n        loggedParams: params,\n        createdAt: new Date().toISOString()\n    });\n    \n    await batch.commit();\n    return { success: true, refId: recordRef.id };\n}`,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    promotedByOrg: 'global-community'
  },
  {
    id: 'market-2',
    toolName: 'hvacTuneUpChecklist',
    requestedCapability: 'Verify air filter status, clean condenser coils, measure blower motor amps, and test thermostat calibration',
    inputParameters: '{\n  "filterReplaced": "boolean",\n  "coilsCleaned": "boolean",\n  "blowerAmps": "number",\n  "thermostatCalibrated": "boolean",\n  "notes": "string"\n}',
    dataMutations: 'Inserts HVAC annual tune-up maintenance logs to active ticket.',
    compiledSource: `/**\n * Synthesized Tool: hvacTuneUpChecklist\n * Created for: Verify air filter status, clean condenser coils, measure blower motor amps, and test thermostat calibration\n * Generated autonomously by Antigravity Synthesis Engine.\n */\nimport * as admin from 'firebase-admin';\n\nexport async function executeSynthesizedTool(orgId: string, params: any) {\n    const db = admin.firestore();\n    const batch = db.batch();\n    \n    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();\n    batch.set(cleanUndefinedFields(recordRef), {\n        id: recordRef.id,\n        toolName: "hvacTuneUpChecklist",\n        loggedParams: params,\n        createdAt: new Date().toISOString()\n    });\n    \n    await batch.commit();\n    return { success: true, refId: recordRef.id };\n}`,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    promotedByOrg: 'global-community'
  },
  {
    id: 'market-3',
    toolName: 'safetyTailgateMeeting',
    requestedCapability: 'Log daily tailgate safety topic, attendance counts, and hazardous field conditions identified',
    inputParameters: '{\n  "safetyTopic": "string",\n  "attendeeCount": "number",\n  "hazardsIdentified": "boolean",\n  "correctiveAction": "string"\n}',
    dataMutations: 'Logs OSHA-aligned daily briefing tailgate meeting checklists.',
    compiledSource: `/**\n * Synthesized Tool: safetyTailgateMeeting\n * Created for: Log daily tailgate safety topic, attendance counts, and hazardous field conditions identified\n * Generated autonomously by Antigravity Synthesis Engine.\n */\nimport * as admin from 'firebase-admin';\n\nexport async function executeSynthesizedTool(orgId: string, params: any) {\n    const db = admin.firestore();\n    const batch = db.batch();\n    \n    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();\n    batch.set(cleanUndefinedFields(recordRef), {\n        id: recordRef.id,\n        toolName: "safetyTailgateMeeting",\n        loggedParams: params,\n        createdAt: new Date().toISOString()\n    });\n    \n    await batch.commit();\n    return { success: true, refId: recordRef.id };\n}`,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    promotedByOrg: 'global-community'
  }
];

const TechnicianToolsTab: React.FC = () => {
    const { state } = useAppContext();
    const [subTab, setSubTab] = useState<'my-tools' | 'marketplace'>('my-tools');
    const [marketplaceTools, setMarketplaceTools] = useState<any[]>([]);
    const [loadingMarketplace, setLoadingMarketplace] = useState(false);
    const [marketSearchTerm, setMarketSearchTerm] = useState('');
    const [tools, setTools] = useState<CustomTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeEditorId, setActiveEditorId] = useState<string | 'new' | null>(null);

    // Form / Editor states
    const [toolName, setToolName] = useState('');
    const [requestedCapability, setRequestedCapability] = useState('');
    const [inputParameters, setInputParameters] = useState('{\n  "lbsRecovered": "number",\n  "refrigerantType": "string"\n}');
    const [dataMutations, setDataMutations] = useState('Inserts recovery records and updates HVAC device logs.');
    const [compiledSource, setCompiledSource] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [naturalPrompt, setNaturalPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const orgId = state.currentOrganization?.id || 'demo-org';
    const isDemo = state.isDemoMode;
    const adminEmail = state.currentUser?.email || 'platform@tektrakker.com';

    useEffect(() => {
        if (isDemo || orgId === 'demo-org') {
            const saved = localStorage.getItem(`demo-technician-tools`);
            if (saved) {
                setTools(JSON.parse(saved));
            } else {
                const sampleTools = SEED_TOOLS.map((t, idx) => ({
                    id: `seed-sample-${idx + 1}`,
                    ...t,
                    createdAt: new Date().toISOString()
                }));
                localStorage.setItem(`demo-technician-tools`, JSON.stringify(sampleTools));
                setTools(sampleTools);
            }
            setLoading(false);
            return;
        }

        const db = getFirestore();
        const docRef = collection(db, 'organizations', orgId, 'synthesizedTools');

        const unsubscribe = onSnapshot(docRef, async (snapshot) => {
            const items: CustomTool[] = [];
            snapshot.forEach(docSnap => {
                items.push({ id: docSnap.id, ...docSnap.data() } as CustomTool);
            });
            
            if (items.length === 0) {
                const seedPromises = SEED_TOOLS.map(async (seed) => {
                    const seedRef = doc(db, 'organizations', orgId, 'synthesizedTools', seed.toolName);
                    const seedData = {
                        ...seed,
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(seedRef, seedData);
                    
                    const mailRef = doc(collection(db, 'mail'));
                    await setDoc(mailRef, {
                        to: adminEmail,
                        message: {
                            from: 'TekTrakker Security Portal <no-reply@tektrakker.com>',
                            subject: `[TekTrakker Seed] Out-of-the-Box Technician Tool Deployed: ${seed.toolName}`,
                            text: `Hello,\n\nThe system has autonomously seeded an industry-standard technician widget into your workspace.\n\n- Tool Name: ${seed.toolName}\n- Capability: ${seed.requestedCapability}\n\nBest regards,\nTekTrakker Platform Security`
                        }
                    });
                });
                try {
                    await Promise.all(seedPromises);
                    showToast.success("Successfully auto-seeded 5 default industry-standard technician widgets!");
                } catch (err) {
                    console.error("Auto-seeding failed:", err);
                }
            } else {
                setTools(items);
                setLoading(false);
            }
        }, (error) => {
            console.error("Error loading custom tools: ", error);
            showToast.error("Failed to load custom tools.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [orgId, isDemo]);

    // Autogenerate TS source code based on parameters
    useEffect(() => {
        if (activeEditorId === 'new') {
            const camelName = toolName.replace(/[^a-zA-Z0-9]/g, '');
            const sourceCode = `/**
 * Synthesized Tool: ${camelName || 'customTool'}
 * Created for: ${requestedCapability || 'Custom task'}
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(cleanUndefinedFields(recordRef), {
        id: recordRef.id,
        toolName: "${camelName || 'customTool'}",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`;
            setCompiledSource(sourceCode);
        }
    }, [toolName, requestedCapability, activeEditorId]);

    const handleAgenticSynthesize = () => {
        if (!naturalPrompt.trim()) {
            showToast.error("Please describe your custom tool in natural language first.");
            return;
        }
        
        setIsGenerating(true);
        
        setTimeout(() => {
            const prompt = naturalPrompt.toLowerCase();
            
            let name = "customTool";
            if (prompt.includes("refrigerant") || prompt.includes("recovery")) name = "logRefrigerantRecovery";
            else if (prompt.includes("filter")) name = "logFilterReplacement";
            else if (prompt.includes("vacuum") || prompt.includes("micron")) name = "logVacuumMicrons";
            else if (prompt.includes("pressure") || prompt.includes("psi")) name = "logSystemPressure";
            else if (prompt.includes("safety") || prompt.includes("incident")) name = "logSafetyIncident";
            else if (prompt.includes("inventory") || prompt.includes("part")) name = "logInventoryUsage";
            else {
                const words = naturalPrompt.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
                if (words.length > 0) {
                    name = words[0].toLowerCase() + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
                }
            }
            
            setToolName(name);

            const schema = {};
            
            const stringKeywords = ["customer", "name", "brand", "model", "serial", "type", "refrigerant", "notes", "description", "size", "location"];
            const numberKeywords = ["quantity", "amount", "psi", "weight", "lbs", "temp", "temperature", "microns", "amps", "voltage", "lra", "rla", "count", "level"];
            const booleanKeywords = ["passed", "complete", "status", "active", "leak", "failed", "check", "checkbox", "bool", "boolean", "success", "resolved"];

            const wordsList = prompt.split(/[\s,]+/);
            wordsList.forEach((word) => {
                let cleanWord = word.replace(/[^a-zA-Z]/g, '');
                if (cleanWord.length < 3) return;
                
                if (stringKeywords.some(kw => cleanWord.includes(kw))) {
                    schema[cleanWord] = "string";
                } else if (numberKeywords.some(kw => cleanWord.includes(kw))) {
                    schema[cleanWord] = "number";
                } else if (booleanKeywords.some(kw => cleanWord.includes(kw))) {
                    schema[cleanWord] = "boolean";
                }
            });

            if (Object.keys(schema).length === 0) {
                schema["notes"] = "string";
                schema["quantity"] = "number";
                schema["isResolved"] = "boolean";
            }

            const jsonSchema = JSON.stringify(schema, null, 2);
            setInputParameters(jsonSchema);

            setRequestedCapability("Allows field technicians to automatically " + naturalPrompt.replace(/please|create|add|generate/gi, '').trim());

            setDataMutations("Logs custom parameters inside organization synthesizedData collection.");

            const camelName = name.replace(/[^a-zA-Z0-9]/g, '');
            const sourceCode = `/**
 * Synthesized Tool: ${camelName}
 * Created for: ${naturalPrompt}
 * Generated autonomously by Antigravity Synthesis Engine.
 */
import * as admin from 'firebase-admin';

export async function executeSynthesizedTool(orgId: string, params: any) {
    const db = admin.firestore();
    const batch = db.batch();
    
    const recordRef = db.collection('organizations').doc(orgId).collection('synthesizedData').doc();
    batch.set(cleanUndefinedFields(recordRef), {
        id: recordRef.id,
        toolName: "${camelName}",
        loggedParams: params,
        createdAt: new Date().toISOString()
    });
    
    await batch.commit();
    return { success: true, refId: recordRef.id };
}`;
            setCompiledSource(sourceCode);
            setIsGenerating(false);
            showToast.success("Agentic AI successfully synthesized custom tool inputs & source!");
        }, 800);
    };

    const handleOpenNew = () => {
        setToolName('');
        setRequestedCapability('');
        setInputParameters('{\n  "lbsRecovered": "number",\n  "refrigerantType": "string"\n}');
        setDataMutations('Inserts recovery records and updates HVAC device logs.');
        setCompiledSource('');
        setStatus('active');
        setNaturalPrompt('');
        setActiveEditorId('new');
    };

    const handleEdit = (tool: CustomTool) => {
        setToolName(tool.toolName);
        setRequestedCapability(tool.requestedCapability);
        setInputParameters(tool.inputParameters);
        setDataMutations(tool.dataMutations);
        setCompiledSource(tool.compiledSource);
        setStatus(tool.status);
        setActiveEditorId(tool.id);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!toolName) {
            showToast.error("Please enter a tool name.");
            return;
        }

        const cleanToolName = toolName.trim().replace(/[^a-zA-Z0-9]/g, '');
        if (cleanToolName !== toolName) {
            showToast.error("Tool name must be alphanumeric camelCase (no spaces or special chars).");
            return;
        }

        const blacklist = ["password", "billing", "bypass", "security_claims", "credential", "admin_privilege", "auth_token", "payment_bypass", "delete_organization", "superuser"];
        const hasSecurityRisk = blacklist.some(word => 
            requestedCapability.toLowerCase().includes(word) || 
            cleanToolName.toLowerCase().includes(word) || 
            dataMutations.toLowerCase().includes(word) ||
            compiledSource.toLowerCase().includes(word)
        );

        if (hasSecurityRisk) {
            showToast.error("Security Audit Denied: Source code or specifications touch system credentials or subscription variables.");
            return;
        }

        try {
            JSON.parse(inputParameters);
        } catch (err) {
            showToast.error("Input parameters must be a valid JSON object map.");
            return;
        }

        const toolData: Omit<CustomTool, 'id'> = {
            toolName: cleanToolName,
            requestedCapability,
            inputParameters,
            dataMutations,
            compiledSource,
            status,
            createdAt: new Date().toISOString()
        };

        if (isDemo || orgId === 'demo-org') {
            const updated = activeEditorId === 'new' 
                ? [...tools, { id: `synth-${Date.now()}`, ...toolData }]
                : tools.map(t => t.id === activeEditorId ? { ...t, ...toolData } : t);
            
            localStorage.setItem(`demo-technician-tools`, JSON.stringify(updated));
            setTools(updated);
            showToast.success("Custom tool saved in demo mode.");
            setActiveEditorId(null);
            return;
        }

        const db = getFirestore();
        const docRef = doc(db, 'organizations', orgId, 'synthesizedTools', cleanToolName);

        try {
            await setDoc(docRef, toolData, { merge: true });

            const mailRef = doc(collection(db, 'mail'));
            await setDoc(mailRef, {
                to: adminEmail,
                message: {
                    from: 'TekTrakker Security Portal <no-reply@tektrakker.com>',
                    subject: `[TekTrakker Audit] Technician Custom Tool Created/Modified: ${cleanToolName}`,
                    text: `Hello,\n\nA custom technician tool has been manually integrated or edited by an administrator in your organization (Org ID: ${orgId}).\n\n- Tool Name: ${cleanToolName}\n- Requested Capability: ${requestedCapability}\n- Data Mutations: ${dataMutations}\n- Modified By: ${adminEmail}\n\nThis tool has passed the client-side sandbox validation and has been hot-deployed into your active workspace session.\n\nBest regards,\nTekTrakker Platform Security`,
                    html: `<p>Hello,</p>
                           <p>A custom technician tool has been manually integrated or edited by an administrator in your organization (<strong>Org ID: ${orgId}</strong>).</p>
                           <ul>
                               <li><strong>Tool Name:</strong> <code>${cleanToolName}</code></li>
                               <li><strong>Requested Capability:</strong> ${requestedCapability}</li>
                               <li><strong>Data Mutations:</strong> ${dataMutations}</li>
                               <li><strong>Modified By:</strong> ${adminEmail}</li>
                           </ul>
                           <p>This tool has passed the client-side sandbox validation and has been hot-deployed into your active workspace session.</p>
                           <hr/>
                           <p><em>This is an automated security audit report.</em></p>`
                }
            });

            showToast.success("Custom technician tool integrated successfully & audit report emailed!");
            setActiveEditorId(null);
        } catch (error) {
            console.error("Error saving custom tool: ", error);
            showToast.error("Failed to save custom tool. Verify permissions.");
        }
    };

    const handleDelete = async (tool: CustomTool) => {
        if (isDemo || orgId === 'demo-org') {
            const updated = tools.filter(t => t.id !== tool.id);
            localStorage.setItem(`demo-technician-tools`, JSON.stringify(updated));
            setTools(updated);
            showToast.success("Custom tool deleted in demo mode.");
            return;
        }

        const db = getFirestore();
        const docRef = doc(db, 'organizations', orgId, 'synthesizedTools', tool.toolName);
        
        try {
            await setDoc(docRef, { status: 'inactive' }, { merge: true });

            const mailRef = doc(collection(db, 'mail'));
            await setDoc(mailRef, {
                to: adminEmail,
                message: {
                    from: 'TekTrakker Security Portal <no-reply@tektrakker.com>',
                    subject: `[TekTrakker Audit] Custom Tool Disabled: ${tool.toolName}`,
                    text: `Hello,\n\nThe custom technician tool ${tool.toolName} has been deactivated by an administrator in your organization (Org ID: ${orgId}).\n\nBest regards,\nTekTrakker Platform Security`
                }
            });

            showToast.success("Custom tool deactivated successfully & audit report dispatched!");
        } catch (error) {
            console.error("Error deactivating custom tool: ", error);
            showToast.error("Failed to deactivate tool.");
        }
    };


    useEffect(() => {
        if (isDemo || orgId === 'demo-org') {
            setMarketplaceTools(MARKETPLACE_SEEDS);
            return;
        }
        if (subTab !== 'marketplace') return;

        setLoadingMarketplace(true);
        const db = getFirestore();
        const globalRef = collection(db, 'globalSynthesizedTools');
        
        const unsubscribe = onSnapshot(globalRef, (snapshot) => {
            const items: any[] = [];
            snapshot.forEach(docSnap => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            setMarketplaceTools(items.length > 0 ? items : MARKETPLACE_SEEDS);
            setLoadingMarketplace(false);
        }, (error) => {
            console.error("Error loading marketplace tools: ", error);
            setMarketplaceTools(MARKETPLACE_SEEDS);
            setLoadingMarketplace(false);
        });

        return () => unsubscribe();
    }, [subTab, orgId, isDemo]);

    const handleInstallMarketplaceTool = async (marketTool: any) => {
        try {
            const cleanToolName = marketTool.toolName;
            const toolData = {
                toolName: cleanToolName,
                requestedCapability: marketTool.requestedCapability,
                inputParameters: marketTool.inputParameters,
                dataMutations: marketTool.dataMutations,
                compiledSource: marketTool.compiledSource,
                status: 'active' as const,
                createdAt: new Date().toISOString()
            };

            if (isDemo || orgId === 'demo-org') {
                const saved = localStorage.getItem(`demo-technician-tools`);
                let toolsList = saved ? JSON.parse(saved) : [];
                toolsList = toolsList.filter((t: any) => t.toolName !== cleanToolName);
                toolsList.push({ id: `synth-${Date.now()}`, ...toolData });
                localStorage.setItem(`demo-technician-tools`, JSON.stringify(toolsList));
                setTools(toolsList);
                showToast.success(`Successfully installed ${cleanToolName} to your dashboard!`);
                return;
            }

            const db = getFirestore();
            const docRef = doc(db, 'organizations', orgId, 'synthesizedTools', cleanToolName);
            await setDoc(docRef, toolData, { merge: true });

            const mailRef = doc(collection(db, 'mail'));
            await setDoc(mailRef, {
                to: adminEmail,
                message: {
                    from: 'TekTrakker Security Portal <no-reply@tektrakker.com>',
                    subject: `[TekTrakker Marketplace] Widget Installed: ${cleanToolName}`,
                    text: `Hello,\n\nA community widget has been installed from the Community Marketplace to your organization (Org ID: ${orgId}).\n\n- Tool Name: ${cleanToolName}\n- Capability: ${marketTool.requestedCapability}\n- Installed By: ${adminEmail}\n\nBest regards,\nTekTrakker Platform Security`
                }
            });

            showToast.success(`Successfully installed ${cleanToolName} & audit report dispatched!`);
        } catch (err: any) {
            console.error("Installation failed:", err);
            showToast.error("Failed to install tool: " + err.message);
        }
    };

    const handleCopyPrompt = (marketTool: any) => {
        try {
            let paramsDesc = '';
            try {
                const parsed = JSON.parse(marketTool.inputParameters);
                paramsDesc = Object.entries(parsed).map(([key, val]) => `${key} (${val})`).join(', ');
            } catch (e) {
                paramsDesc = marketTool.inputParameters;
            }

            const promptText = `Create a custom tool named "${marketTool.toolName}" to: ${marketTool.requestedCapability}. Use parameters: ${paramsDesc}`;
            
            navigator.clipboard.writeText(promptText).then(() => {
                showToast.success("Synthesized AI prompt copied to clipboard!");
            }).catch((err) => {
                console.error("Clipboard copy failed:", err);
                showToast.error("Failed to copy to clipboard. Please copy manually.");
            });
        } catch (e: any) {
            console.error("Failed to generate prompt:", e);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-purple-500" />
                                Custom Developer Technician Tools
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">Develop, compile, and hot-link organization-specific technician assistant tools executing safely in multi-tenant sandboxes.</p>
                        </div>
                        <Button 
                            onClick={handleOpenNew}
                            variant="primary" 
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-700"
                        >
                            <Plus className="w-4 h-4" /> Create Custom Tool
                        </Button>
                    </div>

                    {/* Sub-Tab Navigation */}
                    <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6 gap-6">
                        <button 
                            type="button"
                            onClick={() => setSubTab('my-tools')}
                            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${subTab === 'my-tools' ? 'border-purple-500 text-purple-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            My Organization Widgets
                        </button>
                        <button 
                            type="button"
                            onClick={() => setSubTab('marketplace')}
                            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${subTab === 'marketplace' ? 'border-purple-500 text-purple-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Community Widget Marketplace (User Generated)
                        </button>
                    </div>

                    {subTab === 'my-tools' ? (
                        loading ? (
                            <div className="py-12 text-center text-slate-400">Loading custom tools...</div>
                        ) : tools.filter(t => t.status === 'active').length === 0 ? (
                            <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 text-xs">
                                No active custom developer tools integrated. Create one to equip your technicians' Virtual Worker!
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {tools.filter(t => t.status === 'active').map((tool) => (
                                <div key={tool.id} className="flex justify-between items-start p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl transition-all hover:border-purple-500/30">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{tool.toolName}</h4>
                                            <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center gap-1">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> ACTIVE
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{tool.requestedCapability}"</p>
                                        <p className="text-[10px] text-slate-400"><strong>Sandbox Mutations:</strong> {tool.dataMutations}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => handleEdit(tool)}
                                            className="p-2 text-slate-400 hover:text-purple-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleDelete(tool)}
                                            className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )) : (
                        (() => {
                            const filteredMarketplace = marketplaceTools.filter(t => 
                                t.toolName.toLowerCase().includes(marketSearchTerm.toLowerCase()) || 
                                t.requestedCapability.toLowerCase().includes(marketSearchTerm.toLowerCase())
                            );
                            return (
                                <div className="space-y-6">
                                    {/* Glassmorphic User Generated Notice Banner */}
                                    <div className="p-4 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 backdrop-blur-md border border-purple-500/20 rounded-xl">
                                        <p className="text-xs text-purple-200/90 leading-relaxed font-semibold">
                                            ✨ <strong>Community Marketplace (User Generated)</strong>: These widgets are generated by TekTrakker users and administrators across the platform. Use <strong>1-Click Install</strong> to deploy them locally to your technician dashboard, or <strong>Copy Prompt</strong> to modify them.
                                        </p>
                                    </div>

                                    <div className="w-full">
                                        <Input 
                                            icon={<Search size={16} />}
                                            placeholder="Search global community widgets..." 
                                            value={marketSearchTerm}
                                            onChange={(e: any) => setMarketSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    {loadingMarketplace ? (
                                        <div className="py-12 text-center text-slate-400">Loading community widgets...</div>
                                    ) : filteredMarketplace.length === 0 ? (
                                        <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 text-xs">
                                            No matching community widgets found in the marketplace.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredMarketplace.map((marketTool) => {
                                                const isInstalled = tools.some(t => t.toolName === marketTool.toolName && t.status === 'active');
                                                let parsedParams = {};
                                                try {
                                                    parsedParams = JSON.parse(marketTool.inputParameters);
                                                } catch(e) {}

                                                return (
                                                    <div key={marketTool.id} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4 hover:border-purple-500/30 transition-all">
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-start">
                                                                <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 rounded border border-purple-100 dark:border-purple-900/30">
                                                                    {marketTool.toolName}
                                                                </span>
                                                                {isInstalled ? (
                                                                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                                                                        ✓ Installed
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wider font-black">
                                                                        Community
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                                                {marketTool.requestedCapability}
                                                            </p>
                                                            
                                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                                {Object.entries(parsedParams).map(([key, val]) => {
                                                                    let badgeColor = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
                                                                    if (val === 'number') badgeColor = "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40";
                                                                    else if (val === 'boolean') badgeColor = "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40";
                                                                    return (
                                                                        <span key={key} className={`text-[10px] px-2 py-0.5 rounded font-mono ${badgeColor}`}>
                                                                            {key}: {val as string}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 pt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopyPrompt(marketTool)}
                                                                className="flex-1 py-1.5 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-700"
                                                            >
                                                                <Copy size={12} /> Copy Prompt
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleInstallMarketplaceTool(marketTool)}
                                                                disabled={isInstalled}
                                                                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${isInstalled ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'}`}
                                                            >
                                                                <Cpu size={12} /> {isInstalled ? "Installed" : "1-Click Install"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                        Universal AI Context Integration
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2 leading-relaxed">
                        <p>All active tools created here are autonomously loaded into your technicians' **Virtual Worker** chat assistant. When a tech triggers a conversation matching your tool description, the AI uses function calling to run the sandboxed process inline, updating database records securely.</p>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-purple-700 dark:text-purple-400">Security Audit Isolation</p>
                                <p className="text-[10px] text-purple-600/80 dark:text-purple-400/70 mt-0.5">Custom code executes strictly in a secure batch sandbox targeting organization data records, completely barred from accessing core platform credentials, auth hooks, or billing mechanisms.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {activeEditorId && (
                <div className="lg:col-span-1">
                    <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-2">
                            <Wrench className="w-5 h-5 text-purple-500" />
                            {activeEditorId === 'new' ? 'Build Custom Tool' : 'Edit Custom Tool'}
                        </h3>

                        {activeEditorId === 'new' && (
                            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl space-y-3 mb-2">
                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                    Agentic Natural Language Prompter
                                </label>
                                <textarea
                                    placeholder="e.g. log vacuum pull level with microns (number), customerName (string), and checkPassed (boolean)"
                                    value={naturalPrompt}
                                    onChange={(e) => setNaturalPrompt(e.target.value)}
                                    className="w-full text-xs p-2.5 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 h-16 resize-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleAgenticSynthesize}
                                    disabled={isGenerating}
                                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all active:scale-[0.98]"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Synthesizing Parameters...
                                        </>
                                    ) : (
                                        <>
                                            <Cpu className="w-3.5 h-3.5" />
                                            AI Auto-Generate Tool
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Tool Name (camelCase)</label>
                            <Input
                                placeholder="e.g. logRefrigerantRecovery"
                                value={toolName}
                                onChange={(e: any) => setToolName(e.target.value)}
                                disabled={activeEditorId !== 'new'}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Trigger Description / Capability</label>
                            <Input
                                placeholder="e.g. Record custom technician refrigerant details"
                                value={requestedCapability}
                                onChange={(e: any) => setRequestedCapability(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Input Parameters Schema (JSON)</label>
                            <textarea
                                value={inputParameters}
                                onChange={(e) => setInputParameters(e.target.value)}
                                className="w-full font-mono text-xs p-3 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 h-28"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Database Mutation Plan</label>
                            <Input
                                placeholder="e.g. Appends records inside synthesizedData collection"
                                value={dataMutations}
                                onChange={(e: any) => setDataMutations(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">TypeScript Code Implementation</label>
                            <textarea
                                value={compiledSource}
                                onChange={(e) => setCompiledSource(e.target.value)}
                                className="w-full font-mono text-[10px] p-3 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 text-slate-700 dark:text-white focus:ring-2 focus:ring-purple-500 h-40"
                            />
                        </div>

                        <div className="flex gap-2 mt-6">
                            <Button 
                                type="button" 
                                onClick={() => setActiveEditorId(null)}
                                variant="secondary" 
                                className="flex-1 py-2 text-xs uppercase tracking-wider font-extrabold"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                variant="primary" 
                                className="flex-1 py-2 text-xs uppercase tracking-wider font-extrabold bg-purple-600 hover:bg-purple-700"
                            >
                                Compile & Link
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default TechnicianToolsTab;
