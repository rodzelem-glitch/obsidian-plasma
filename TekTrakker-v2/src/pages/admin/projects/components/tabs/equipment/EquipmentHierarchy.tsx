import { cleanUndefinedFields } from '../../../../../../lib/utils';
import React, { useState } from 'react';
import { Customer, ServiceLocation, EquipmentAsset, StoredFile } from 'types';
import { db, firebase } from 'lib/firebase';
import { getCurrentLocation } from 'lib/geolocation';
import { useAppContext } from 'context/AppContext';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, MapPin, Box, Link as LinkIcon, Building2, Map, Tag, Compass, Layers, Camera as CameraIcon, ImageIcon, X, Sparkles } from 'lucide-react';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import showToast from 'lib/toast';
import { useLanguage } from 'context/LanguageContext';
import { uploadFileToStorage } from 'lib/storageService';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import WebCameraModal from 'pages/briefing/components/WebCameraModal';
import LocationPhotosLayoutModal from 'components/modals/LocationPhotosLayoutModal';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { BarcodeScannerButton } from 'components/ui/BarcodeScanner';

import { EQUIPMENT_OPTIONS, LOCATION_OPTIONS } from '@/constants/industryNaming';

const PHYSICAL_LOCATION_OPTIONS = [
    'Roof', 'Mechanical Room', 'Walk-in Cooler', 'Walk-in Freezer', 
    'Kitchen', 'Exterior Wall', 'Behind Building', 'Ceiling Space', 
    'Attic', 'Tenant Space', 'Other'
];

interface Props {
    customer: Customer;
    autoOpenEquipmentId?: string | null;
    onClearAutoOpen?: () => void;
}

const EquipmentHierarchy: React.FC<Props> = ({ customer, autoOpenEquipmentId, onClearAutoOpen }) => {
    const [selectedLocationForLayout, setSelectedLocationForLayout] = useState<ServiceLocation | null>(null);
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const industry = state.currentOrganization?.industry || 'HVAC';
    
    const cleanListForFirestore = (list: any[]) => {
        return list.map((item: any) => {
            const cleaned = { ...item };
            Object.keys(cleaned).forEach(key => {
                if (cleaned[key] === undefined) {
                    delete cleaned[key];
                }
            });
            return cleaned;
        });
    };

    const equipmentOptions = EQUIPMENT_OPTIONS[industry] || EQUIPMENT_OPTIONS['default'];
    const locationOptions = LOCATION_OPTIONS[industry] || LOCATION_OPTIONS['default'];
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Partial<ServiceLocation> | null>(null);

    const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<Partial<EquipmentAsset> | null>(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [isResearching, setIsResearching] = useState(false);

    const [isWebCameraOpen, setIsWebCameraOpen] = useState(false);
    const [assetCameraTarget, setAssetCameraTarget] = useState<'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl' | null>(null);

    // Dynamic states for Refrigeration System Linking
    const [isLinkedToSystem, setIsLinkedToSystem] = useState(false);
    const [selectedSystemGroupId, setSelectedSystemGroupId] = useState('');
    const [newSystemGroupName, setNewSystemGroupName] = useState('');

    const [autoCreateThermostat, setAutoCreateThermostat] = useState(false);
    const [thermostatDetails, setThermostatDetails] = useState({
        name: 'Thermostat',
        brand: '',
        model: '',
        propertyId: '',
        physicalLocation: 'Interior Wall',
        exactPlacement: '',
        servesArea: ''
    });

    const [autoCreateAirHandler, setAutoCreateAirHandler] = useState(false);
    const [isResearchingAirHandler, setIsResearchingAirHandler] = useState(false);
    const [airHandlerDetails, setAirHandlerDetails] = useState({
        name: 'Air Handler',
        brand: '',
        model: '',
        serial: '',
        propertyId: '',
        physicalLocation: 'Interior Closet',
        exactPlacement: '',
        servesArea: '',
        year: '',
        tonnage: undefined as number | undefined,
        refrigerantType: '',
        heatType: '',
        electricityType: '',
        seerRating: '',
        filterType: ''
    });

    const locations = customer.serviceLocations || [];
    const equipment = customer.equipment || [];

    const getRootLocationId = (locId: string | null | undefined): string | null => {
        if (!locId) return null;
        let current = locations.find(l => l.id === locId);
        if (!current) return null;
        let limit = 0;
        while (current.parentId && limit < 100) {
            const parent = locations.find(l => l.id === current.parentId);
            if (!parent) break;
            current = parent;
            limit++;
        }
        return current.id;
    };

    React.useEffect(() => {
        if (autoOpenEquipmentId) {
            const eq = equipment.find(e => e.id === autoOpenEquipmentId);
            if (eq) {
                openEquipmentModal(eq.propertyId, eq);
            }
            onClearAutoOpen?.();
        }
    }, [autoOpenEquipmentId, equipment]);

    // Extract unique existing system groups for the currently selected location
    const uniqueSystemGroups = React.useMemo(() => {
        const groups: { id: string; name: string }[] = [];
        const seen = new Set<string>();
        const targetPropertyId = editingEquipment?.propertyId || '';
        equipment.forEach(e => {
            if (
                e.systemGroupId && 
                e.systemGroupName && 
                (e.propertyId || '') === targetPropertyId && 
                !seen.has(e.systemGroupId)
            ) {
                seen.add(e.systemGroupId);
                groups.push({ id: e.systemGroupId, name: e.systemGroupName });
            }
        });
        return groups;
    }, [equipment, editingEquipment?.propertyId]);

    const uniqueZones = React.useMemo(() => {
        const zones = new Set<string>();
        equipment.forEach(e => {
            if (e.zone) zones.add(e.zone);
        });
        return Array.from(zones);
    }, [equipment]);

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedNodes(newExpanded);
    };

    const handleSaveLocation = async () => {
        if (!editingLocation?.name) {
            showToast.error("Name is required");
            return;
        }

        let updatedLocations = [...locations];
        if (editingLocation.id) {
            updatedLocations = updatedLocations.map(l => l.id === editingLocation.id ? editingLocation as ServiceLocation : l);
        } else {
            const newLoc: ServiceLocation = {
                ...editingLocation,
                id: `loc-${Date.now()}`,
                address: editingLocation.address || customer.address || '',
            } as ServiceLocation;
            updatedLocations.push(newLoc);
        }

        try {
            const cleanedLocations = cleanListForFirestore(updatedLocations);
            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping location update.");
            } else {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ serviceLocations: cleanedLocations }));
            }
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: cleanedLocations } });
            setIsLocationModalOpen(false);
            showToast.success("Location saved");
        } catch (error) {
            console.error(error);
            showToast.error("Failed to save location");
        }
    };

    const handleDeleteLocation = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this location? Equipment in this location will become unassigned.")) return;
        
        const updatedLocations = locations.filter(l => l.id !== id);
        // Also remove parentId for children
        const finalLocations = updatedLocations.map(l => l.parentId === id ? { ...l, parentId: null } : l);
        
        // Remove propertyId and locationId for equipment
        const updatedEquipment = equipment.map(e => {
            const updates: any = {};
            if (e.propertyId === id) updates.propertyId = undefined;
            if (e.locationId === id) updates.locationId = undefined;
            return Object.keys(updates).length > 0 ? { ...e, ...updates } : e;
        });

        try {
            const cleanedLocations = cleanListForFirestore(finalLocations);
            const cleanedEquipment = cleanListForFirestore(updatedEquipment);
            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping location delete.");
            } else {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ 
                    serviceLocations: cleanedLocations,
                    equipment: cleanedEquipment
                }));
            }
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: cleanedLocations, equipment: cleanedEquipment } });
            showToast.success("Location deleted");
        } catch (error) {
            console.error(error);
            showToast.error("Failed to delete location");
        }
    };

    const handleBarcodeScanned = async (barcode: string) => {
        if (!barcode) return;

        let updatedEq = { ...editingEquipment, assetTag: barcode };

        const MOCK_BARCODE_CATALOG: Record<string, any> = {
            "026508930419": {
                brand: "Trane",
                model: "4TTR4036L1000A",
                serial: "TRN2026041999",
                type: "AC Condenser",
                condition: "Excellent",
                notes: "Scanned from original factory barcode. Trane XR14 Series 3-Ton AC Condenser.",
                tonnage: 3.0,
                seerRating: "14",
                refrigerantType: "R-410A",
                filterType: "N/A"
            },
            "783126300412": {
                brand: "Carrier",
                model: "58SB0A070E1712",
                serial: "CAR123984712",
                type: "Furnace",
                condition: "Excellent",
                notes: "Carrier Comfort 92% AFUE Gas Furnace. 70,000 BTU.",
                year: "2024",
                heatType: "Gas",
                electricityType: "115V / 1ph",
                filterType: "16x25x1"
            },
            "662578149204": {
                brand: "Lennox",
                model: "EL16XC1-036-230",
                serial: "LEN992384723",
                type: "Heat Pump",
                condition: "Good",
                notes: "Lennox Elite Series Single Stage Heat Pump.",
                tonnage: 3.0,
                seerRating: "16",
                refrigerantType: "R-410A",
                heatType: "Heat Pump"
            },
            "026508930129": {
                brand: "Honeywell",
                model: "T9 Smart Thermostat",
                serial: "HW-T9-2026",
                type: "Thermostat",
                condition: "Excellent",
                notes: "Honeywell Home T9 Smart Thermostat with Smart Room Sensor.",
                electricityType: "C-Wire Required"
            }
        };

        const localMatch = MOCK_BARCODE_CATALOG[barcode];
        if (localMatch) {
            updatedEq = {
                ...updatedEq,
                ...localMatch
            };
            setEditingEquipment(updatedEq);
            showToast.success(`Autofilled catalog details for barcode: ${barcode}`);
            return;
        }

        setIsResearching(true);
        try {
            const fns = getFunctions();
            const callGeminiAI = httpsCallable(fns, 'callGeminiAI');

            const prompt = `Senior HVAC & Appliance Technical Advisor.
Research and decode technical specs for this barcode / serial number / asset tag: "${barcode}"

Your task is to decode the model/serial numbers or look up standard specs to fill out the following properties:
1. "brand": The manufacturer/brand of the equipment (e.g. "Trane", "Carrier", "Lennox", "Goodman").
2. "model": The model number of the unit.
3. "serial": The serial number of the unit.
4. "type": The equipment type (e.g. "AC Condenser", "Furnace", "Heat Pump", "Thermostat").
5. "year": Manufacturing year, e.g. "2018".
6. "tonnage": Decode capacity/tonnage from model number BTUs (e.g. 024 = 2 tons, 036 = 3 tons, 042 = 3.5 tons, 048 = 4 tons, 060 = 5 tons). Return a number.
7. "refrigerantType": E.g. "R410A", "R22", "R134a", "R404A".
8. "heatType": E.g. "Gas", "Electric", "Heat Pump", "N/A".
9. "seerRating": Standard SEER rating for this model series (e.g. "14", "16", "21").
10. "electricityType": E.g. "230V / 1ph", "460V / 3ph", "115V / 1ph".
11. "filterType": Standard filter dimensions and type if it's a standard cabinet size (e.g., "20x25x1 MERV 11").

CRITICAL SAFETY RULES:
- DO NOT make up, guess, or hallucinate any information.
- Only return a value for a property if it is GUARANTEED or highly confident based on standard brand coding structures or verified manufacturer documentation.
- If a property cannot be confidently verified, set its value to null.

Return ONLY a valid JSON object matching this schema with NO markdown wrapper:
{
  "brand": string | null,
  "model": string | null,
  "serial": string | null,
  "type": string | null,
  "year": string | null,
  "tonnage": number | null,
  "refrigerantType": string | null,
  "heatType": string | null,
  "seerRating": string | null,
  "electricityType": string | null,
  "filterType": string | null
}`;

            const result: any = await callGeminiAI({
                prompt,
                modelName: 'gemini-3.6-flash',
                config: { response_mime_type: 'application/json' }
            });

            const cleanJson = (result.data?.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const specs = JSON.parse(cleanJson);

            const updatedSpecs: any = {};
            Object.keys(specs).forEach(key => {
                if (specs[key] !== null && specs[key] !== undefined && specs[key] !== '') {
                    updatedSpecs[key] = specs[key];
                }
            });

            if (Object.keys(updatedSpecs).length > 0) {
                setEditingEquipment({
                    ...updatedEq,
                    ...updatedSpecs
                });
                showToast.success("AI successfully decoded barcode details!");
            } else {
                setEditingEquipment(updatedEq);
                showToast.warn(`Barcode scanned: ${barcode}. Could not decode additional specifications.`);
            }
        } catch (error) {
            console.error(error);
            setEditingEquipment(updatedEq);
            showToast.warn(`Barcode scanned: ${barcode}. AI decoding failed.`);
        } finally {
            setIsResearching(false);
        }
    };

    const handleResearchSpecs = async () => {
        if (!editingEquipment?.model) {
            showToast.error("Model Number is required to research specifications.");
            return;
        }

        setIsResearching(true);
        try {
            const fns = getFunctions();
            const callGeminiAI = httpsCallable(fns, 'callGeminiAI');

            const brand = editingEquipment.brand || 'Unknown Brand';
            const model = editingEquipment.model;
            const serial = editingEquipment.serial || '';

            const prompt = `Senior HVAC & Appliance Technical Advisor.
Research and decode technical specs for this unit:
- Manufacturer/Brand: ${brand}
- Model Number: ${model}
- Serial Number: ${serial}

Your task is to decode the model/serial numbers or look up standard specs to fill out the following properties:
1. "year": Decode the manufacturing year from the serial number format (e.g., first 2 or 4 digits, or letter date code depending on brand). E.g. "2018".
2. "tonnage": Decode capacity/tonnage from model number BTUs (e.g. 024 = 2 tons, 036 = 3 tons, 042 = 3.5 tons, 048 = 4 tons, 060 = 5 tons). Return a number.
3. "refrigerantType": E.g. "R410A", "R22", "R134a", "R404A".
4. "heatType": E.g. "Gas", "Electric", "Heat Pump", "N/A".
5. "seerRating": Standard SEER rating for this model series (e.g. "14", "16", "21").
6. "electricityType": E.g. "230V / 1ph", "460V / 3ph", "115V / 1ph".
7. "filterType": Standard filter dimensions and type if it's a standard cabinet size (e.g., "20x25x1 MERV 11").

CRITICAL SAFETY RULES:
- DO NOT make up, guess, or hallucinate any information.
- Only return a value for a property if it is GUARANTEED or highly confident based on standard brand coding structures or verified manufacturer documentation.
- If a property cannot be confidently verified, set its value to null (do NOT make up placeholder values, guess years, or guess SEER ratings).
- If the serial number is blank or does not conform to date coding, set "year" to null.
- If the model is unrecognized or fake, set all spec fields to null.

Return ONLY a valid JSON object matching this schema with NO markdown wrapper:
{
  "year": string | null,
  "tonnage": number | null,
  "refrigerantType": string | null,
  "heatType": string | null,
  "seerRating": string | null,
  "electricityType": string | null,
  "filterType": string | null
}`;

            const result: any = await callGeminiAI({
                prompt,
                modelName: 'gemini-3.6-flash',
                config: { response_mime_type: 'application/json' }
            });

            const cleanJson = (result.data?.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const specs = JSON.parse(cleanJson);

            const hasSpecs = Object.values(specs).some(val => val !== null && val !== undefined && val !== '');

            if (!hasSpecs) {
                showToast.warn("No verified specifications could be confidently determined for this model/serial.");
                setIsResearching(false);
                return;
            }

            const updatedEq = { ...editingEquipment };
            let count = 0;

            if (specs.year && !updatedEq.year) {
                updatedEq.year = specs.year;
                count++;
            }
            if (specs.tonnage && (updatedEq.tonnage === undefined || updatedEq.tonnage === null)) {
                updatedEq.tonnage = Number(specs.tonnage);
                count++;
            }
            if (specs.refrigerantType && !updatedEq.refrigerantType) {
                updatedEq.refrigerantType = specs.refrigerantType;
                count++;
            }
            if (specs.heatType && !updatedEq.heatType) {
                updatedEq.heatType = specs.heatType;
                count++;
            }
            if (specs.seerRating && !updatedEq.seerRating) {
                updatedEq.seerRating = specs.seerRating;
                count++;
            }
            if (specs.electricityType && !updatedEq.electricityType) {
                updatedEq.electricityType = specs.electricityType;
                count++;
            }
            if (specs.filterType && !updatedEq.filterType) {
                updatedEq.filterType = specs.filterType;
                count++;
            }

            setEditingEquipment(updatedEq);
            if (count > 0) {
                showToast.success(`Successfully populated \${count} technical specifications!`);
            } else {
                showToast.info("AI lookup completed, but no new details were added (existing fields were preserved or no new confident specs found).");
            }
        } catch (error) {
            console.error(error);
            showToast.error("Failed to research specifications. Please try again.");
        } finally {
            setIsResearching(false);
        }
    };

    const handleResearchAirHandlerSpecs = async () => {
        if (!airHandlerDetails?.model) {
            showToast.error("Air Handler Model Number is required to research specifications.");
            return;
        }

        setIsResearchingAirHandler(true);
        try {
            const fns = getFunctions();
            const callGeminiAI = httpsCallable(fns, 'callGeminiAI');

            const brand = airHandlerDetails.brand || 'Unknown Brand';
            const model = airHandlerDetails.model;
            const serial = airHandlerDetails.serial || '';

            const prompt = `Senior HVAC & Appliance Technical Advisor.
Research and decode technical specs for this Air Handler / Fan Coil unit:
- Manufacturer/Brand: \${brand}
- Model Number: \${model}
- Serial Number: \${serial}

Your task is to decode the model/serial numbers or look up standard specs to fill out the following properties:
1. "year": Decode the manufacturing year from the serial number format (e.g., first 2 or 4 digits, or letter date code depending on brand). E.g. "2018".
2. "tonnage": Decode capacity/tonnage from model number BTUs (e.g. 024 = 2 tons, 036 = 3 tons, 042 = 3.5 tons, 048 = 4 tons, 060 = 5 tons). Return a number.
3. "refrigerantType": E.g. "R410A", "R22", "R134a", "R404A".
4. "heatType": E.g. "Electric", "Gas", "Heat Pump", "N/A".
5. "seerRating": Standard SEER rating for this model series (e.g. "14", "16", "21").
6. "electricityType": E.g. "230V / 1ph", "460V / 3ph", "115V / 1ph".
7. "filterType": Standard filter dimensions and type if it's a standard cabinet size (e.g., "20x25x1 MERV 11").

CRITICAL SAFETY RULES:
- DO NOT make up, guess, or hallucinate any information.
- Only return a value for a property if it is GUARANTEED or highly confident based on standard brand coding structures or verified manufacturer documentation.
- If a property cannot be confidently verified, set its value to null (do NOT make up placeholder values, guess years, or guess SEER ratings).
- If the serial number is blank or does not conform to date coding, set "year" to null.
- If the model is unrecognized or fake, set all spec fields to null.

Return ONLY a valid JSON object matching this schema with NO markdown wrapper:
{
  "year": string | null,
  "tonnage": number | null,
  "refrigerantType": string | null,
  "heatType": string | null,
  "seerRating": string | null,
  "electricityType": string | null,
  "filterType": string | null
}`;

            const result: any = await callGeminiAI({
                prompt,
                modelName: 'gemini-3.6-flash',
                config: { response_mime_type: 'application/json' }
            });

            const cleanJson = (result.data?.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const specs = JSON.parse(cleanJson);

            const hasSpecs = Object.values(specs).some(val => val !== null && val !== undefined && val !== '');

            if (!hasSpecs) {
                showToast.warn("No verified specifications could be confidently determined for this model/serial.");
                setIsResearchingAirHandler(false);
                return;
            }

            const updatedDetails = { ...airHandlerDetails };
            let count = 0;

            if (specs.year && !updatedDetails.year) {
                updatedDetails.year = specs.year;
                count++;
            }
            if (specs.tonnage && (updatedDetails.tonnage === undefined || updatedDetails.tonnage === null)) {
                updatedDetails.tonnage = Number(specs.tonnage);
                count++;
            }
            if (specs.refrigerantType && !updatedDetails.refrigerantType) {
                updatedDetails.refrigerantType = specs.refrigerantType;
                count++;
            }
            if (specs.heatType && !updatedDetails.heatType) {
                updatedDetails.heatType = specs.heatType;
                count++;
            }
            if (specs.electricityType && !updatedDetails.electricityType) {
                updatedDetails.electricityType = specs.electricityType;
                count++;
            }
            if (specs.seerRating && !updatedDetails.seerRating) {
                updatedDetails.seerRating = specs.seerRating;
                count++;
            }
            if (specs.filterType && !updatedDetails.filterType) {
                updatedDetails.filterType = specs.filterType;
                count++;
            }

            setAirHandlerDetails(updatedDetails);
            if (count > 0) {
                showToast.success(`Successfully populated \${count} technical specifications for the Air Handler!`);
            } else {
                showToast.info("AI lookup completed, but no new details were added.");
            }
        } catch (error) {
            console.error(error);
            showToast.error("Failed to research Air Handler specifications.");
        } finally {
            setIsResearchingAirHandler(false);
        }
    };

    const handleSaveEquipment = async () => {
        if (!editingEquipment?.brand || !editingEquipment?.model) {
            showToast.error("Brand and Model are required");
            return;
        }

        let sysId: string | undefined;
        let sysName: string | undefined;
        let sysRole: string | undefined;

        if (isLinkedToSystem) {
            if (selectedSystemGroupId === 'NEW') {
                if (!newSystemGroupName.trim()) {
                    showToast.error("System group name is required");
                    return;
                }
                sysId = `sys-${Date.now()}`;
                sysName = newSystemGroupName.trim();
            } else {
                const matchedGroup = uniqueSystemGroups.find(g => g.id === selectedSystemGroupId);
                if (matchedGroup) {
                    sysId = matchedGroup.id;
                    sysName = matchedGroup.name;
                } else {
                    showToast.error("Please select a valid system group");
                    return;
                }
            }
            sysRole = editingEquipment.systemGroupRole || 'Standalone';
        } else {
            sysId = undefined;
            sysName = undefined;
            sysRole = undefined;
        }

        const finalEq: EquipmentAsset = {
            ...editingEquipment,
            systemGroupId: sysId,
            systemGroupName: sysName,
            systemGroupRole: sysRole
        } as EquipmentAsset;

        let updatedEquipment = [...equipment];
        let rtuEq: EquipmentAsset;
        const rtuId = editingEquipment.id || `eq-${Date.now()}`;

        if (editingEquipment.id) {
            rtuEq = { ...finalEq } as EquipmentAsset;
            updatedEquipment = updatedEquipment.map(e => e.id === editingEquipment.id ? rtuEq : e);
        } else {
            rtuEq = {
                ...finalEq,
                id: rtuId,
                type: editingEquipment.type || 'System',
                serial: editingEquipment.serial || ''
            } as EquipmentAsset;
            updatedEquipment.push(rtuEq);
        }

        let thermostatId: string | null = null;
        if (autoCreateThermostat) {
            thermostatId = `eq-${Date.now() + 1}`;
            const thermostatEq: EquipmentAsset = {
                id: thermostatId,
                organizationId: customer.organizationId || rtuEq.organizationId,
                customerId: customer.id,
                name: thermostatDetails.name || 'Thermostat',
                brand: thermostatDetails.brand || rtuEq.brand || '',
                model: thermostatDetails.model || '',
                serial: '',
                type: 'Other',
                propertyId: thermostatDetails.propertyId || rtuEq.propertyId || '',
                physicalLocation: thermostatDetails.physicalLocation || 'Interior Wall',
                exactPlacement: thermostatDetails.exactPlacement || '',
                servesArea: thermostatDetails.servesArea || rtuEq.servesArea || '',
                linkedAssetIds: [rtuId]
            } as EquipmentAsset;

            // Link RTU to Thermostat
            rtuEq.linkedAssetIds = [...(rtuEq.linkedAssetIds || []), thermostatId];
            updatedEquipment = updatedEquipment.map(e => e.id === rtuId ? rtuEq : e);
            updatedEquipment.push(thermostatEq);
        }

        if (autoCreateAirHandler) {
            const airHandlerId = `eq-${Date.now() + 2}`;
            const airHandlerEq: EquipmentAsset = {
                id: airHandlerId,
                organizationId: customer.organizationId || rtuEq.organizationId,
                customerId: customer.id,
                name: airHandlerDetails.name || 'Air Handler',
                brand: airHandlerDetails.brand || rtuEq.brand || '',
                model: airHandlerDetails.model || '',
                serial: airHandlerDetails.serial || '',
                type: 'Air Handler',
                propertyId: airHandlerDetails.propertyId || rtuEq.propertyId || '',
                physicalLocation: airHandlerDetails.physicalLocation || 'Interior Closet',
                exactPlacement: airHandlerDetails.exactPlacement || '',
                servesArea: airHandlerDetails.servesArea || rtuEq.servesArea || '',
                year: airHandlerDetails.year || undefined,
                tonnage: airHandlerDetails.tonnage || undefined,
                refrigerantType: airHandlerDetails.refrigerantType || undefined,
                heatType: airHandlerDetails.heatType || undefined,
                electricityType: airHandlerDetails.electricityType || undefined,
                seerRating: airHandlerDetails.seerRating || undefined,
                filterType: airHandlerDetails.filterType || undefined,
                linkedAssetIds: [rtuId]
            } as EquipmentAsset;

            // Link RTU to Air Handler
            rtuEq.linkedAssetIds = [...(rtuEq.linkedAssetIds || []), airHandlerId];
            updatedEquipment = updatedEquipment.map(e => e.id === rtuId ? rtuEq : e);

            // Cross-link Thermostat to Air Handler if both are created
            if (autoCreateThermostat && thermostatId) {
                airHandlerEq.linkedAssetIds = [...(airHandlerEq.linkedAssetIds || []), thermostatId];
                updatedEquipment = updatedEquipment.map(e => {
                    if (e.id === thermostatId) {
                        return { ...e, linkedAssetIds: [...(e.linkedAssetIds || []), airHandlerId] };
                    }
                    return e;
                });
            }

            updatedEquipment.push(airHandlerEq);
        }

        try {
            const cleanedEquipment = cleanListForFirestore(updatedEquipment);
            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping equipment update.");
            } else {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ equipment: cleanedEquipment }));
            }
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: cleanedEquipment } });
            setIsEquipmentModalOpen(false);
            showToast.success("Equipment saved");
        } catch (error) {
            console.error(error);
            showToast.error("Failed to save equipment");
        }
    };

    const handleDeleteEquipment = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this equipment?")) return;
        const updatedEquipment = equipment.filter(e => e.id !== id);
        try {
            const cleanedEquipment = cleanListForFirestore(updatedEquipment);
            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping equipment delete.");
            } else {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ equipment: cleanedEquipment }));
            }
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: cleanedEquipment } });
            showToast.success("Equipment deleted");
        } catch (error) {
            console.error(error);
            showToast.error("Failed to delete equipment");
        }
    };

    const handleAssetPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl') => {
        const file = e.target.files?.[0];
        if (!file || !state.currentOrganization) return;
        
        try {
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : `photo-${Date.now()}.png`;
            const orgId = state.currentOrganization.id;
            const path = `organizations/${orgId}/customers/${customer.id}/equipment/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            
            const newFileReference: StoredFile = {
                id: `file-${Date.now()}`,
                organizationId: orgId,
                parentId: customer.id,
                parentType: 'customer',
                fileName: `Field Asset Photo - ${safeName}`,
                dataUrl: downloadUrl,
                fileType: file.type,
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser?.id || 'unknown',
            };
            
            if (!state.isDemoMode) {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                    files: firebase.firestore.FieldValue.arrayUnion(newFileReference)
                }));
            }
            
            dispatch({ 
                type: 'UPDATE_CUSTOMER', 
                payload: { 
                    ...customer,
                    files: [...(customer.files || []), newFileReference] 
                } 
            });
            
            setEditingEquipment(prev => prev ? {
                ...prev,
                [photoType]: downloadUrl,
                [`${photoType.replace('Url', 'Label')}`]: prev[`${photoType.replace('Url', 'Label')}` as keyof EquipmentAsset] || ''
            } : null);
            
            showToast.success("Photo uploaded successfully");
        } catch (err) {
            console.error(err);
            showToast.error("Photo upload failed");
        }
    };

    const handleAssetCameraTrigger = async (photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl') => {
        try {
            const isNative = Capacitor.isNativePlatform();
            if (isNative) {
                const image = await CapacitorCamera.getPhoto({
                    quality: 60,
                    allowEditing: false,
                    resultType: CameraResultType.DataUrl,
                    source: CameraSource.Camera,
                    saveToGallery: false
                });

                if (image.dataUrl) {
                    const response = await fetch(image.dataUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    
                    const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    await handleAssetPhotoUpload(mockEvent, photoType);
                }
            } else {
                setAssetCameraTarget(photoType);
                setIsWebCameraOpen(true);
            }
        } catch (e: any) {
            console.error("Camera error:", e);
            setAssetCameraTarget(photoType);
            setIsWebCameraOpen(true);
        }
    };

    const handleWebCameraCapture = async (dataUrl: string) => {
        if (!assetCameraTarget) return;
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
            await handleAssetPhotoUpload(mockEvent, assetCameraTarget);
        } catch (e) {
            console.error("Failed to process webcam capture:", e);
            showToast.error("Failed to process captured image");
        } finally {
            setIsWebCameraOpen(false);
            setAssetCameraTarget(null);
        }
    };

    const openLocationModal = (parentId?: string, loc?: Partial<ServiceLocation>) => {
        setEditingLocation(loc || { parentId: parentId || null, locationType: 'Building', name: '' });
        setIsLocationModalOpen(true);
    };

    const openEquipmentModal = (propertyId?: string, eq?: Partial<EquipmentAsset>) => {
        setEditingEquipment(eq || { propertyId: propertyId || '', brand: '', model: '', serial: '', type: 'System' });
        setIsLinkedToSystem(!!eq?.systemGroupId);
        setSelectedSystemGroupId(eq?.systemGroupId || '');
        setNewSystemGroupName('');
        setAutoCreateThermostat(false);
        setThermostatDetails({
            name: 'Thermostat',
            brand: eq?.brand || '',
            model: '',
            propertyId: '',
            physicalLocation: 'Interior Wall',
            exactPlacement: '',
            servesArea: eq?.servesArea || ''
        });
        setAutoCreateAirHandler(false);
        setAirHandlerDetails({
            name: 'Air Handler',
            brand: eq?.brand || '',
            model: '',
            serial: '',
            propertyId: '',
            physicalLocation: 'Interior Closet',
            exactPlacement: '',
            servesArea: eq?.servesArea || '',
            year: '',
            tonnage: undefined,
            refrigerantType: '',
            heatType: '',
            electricityType: '',
            seerRating: '',
            filterType: ''
        });
        setIsEquipmentModalOpen(true);
    };

    const renderEquipmentNode = (eq: EquipmentAsset, depth: number) => {
        return (
            <div key={eq.id} className="hierarchy-depth-node flex items-center justify-between py-2.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0" data-depth={depth}>
                <div className="flex items-center gap-3">
                    <Box size={16} className="text-blue-500 shrink-0" />
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{eq.name || `${eq.brand} ${eq.model}`}</span>
                            <span className={`text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full font-medium`}>{eq.type}</span>
                            {eq.condition && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${eq.condition === 'Excellent' || eq.condition === 'Good' ? 'bg-green-100 text-green-700' : eq.condition === 'Fair' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{eq.condition}</span>}
                            {eq.assetTag && (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-full font-mono flex items-center gap-0.5">
                                    <Tag size={10} /> {eq.assetTag}
                                </span>
                            )}
                            {eq.systemGroupId && (
                                <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full font-medium flex items-center gap-0.5">
                                    <Layers size={10} /> {eq.systemGroupName} ({eq.systemGroupRole || 'Member'})
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                            <div>SN: {eq.serial || 'N/A'} • Model: {eq.model}</div>
                            {(eq.year || eq.tonnage || eq.refrigerantType || eq.heatType || eq.electricityType || eq.seerRating || eq.filterType) && (
                                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5 flex-wrap pt-0.5 pb-0.5">
                                    {eq.year && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">Year: {eq.year}</span>}
                                    {eq.tonnage && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{eq.tonnage} Tons</span>}
                                    {eq.refrigerantType && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">Ref: {eq.refrigerantType}</span>}
                                    {eq.heatType && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">Heat: {eq.heatType}</span>}
                                    {eq.electricityType && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">Elec: {eq.electricityType}</span>}
                                    {eq.seerRating && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">SEER: {eq.seerRating}</span>}
                                    {eq.filterType && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">Filter: {eq.filterType}</span>}
                                </div>
                            )}
                            {(eq.physicalLocation || eq.exactPlacement || eq.servesArea) ? (
                                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1 flex-wrap">
                                    <MapPin size={10} className="text-slate-400 shrink-0" />
                                    {eq.physicalLocation && <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">{eq.physicalLocation}</span>}
                                    {eq.exactPlacement && <span className="text-slate-400">&gt; <span className="text-slate-500 italic">{eq.exactPlacement}</span></span>}
                                    {eq.servesArea && <span className="text-indigo-500 dark:text-indigo-400 ml-1">({t("Serves")}: {eq.servesArea})</span>}
                                </div>
                            ) : eq.location ? (
                                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <MapPin size={10} className="text-slate-400 shrink-0" /> {eq.location}
                                </div>
                            ) : null}
                            {eq.gpsPin && (
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                                    <Compass size={10} /> GPS: {eq.gpsPin.lat.toFixed(6)}, {eq.gpsPin.lng.toFixed(6)}
                                </div>
                            )}
                        </div>
                        {eq.linkedAssetIds && eq.linkedAssetIds.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-500">
                                <LinkIcon size={10} /> Linked to {eq.linkedAssetIds.length} item(s)
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 transition-opacity">
                    <button onClick={() => openEquipmentModal(eq.propertyId, eq)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors" title="Edit">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteEquipment(eq.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-slate-700 transition-colors" title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        );
    };

    const renderLocationNode = (loc: ServiceLocation, depth: number = 0) => {
        const isExpanded = expandedNodes.has(loc.id);
        const childLocations = locations.filter(l => l.parentId === loc.id);
        const childEquipment = equipment.filter(e => e.propertyId === loc.id || e.locationId === loc.id);
        const hasChildren = childLocations.length > 0 || childEquipment.length > 0;

        return (
            <div key={loc.id} className="border-b border-slate-200 dark:border-slate-700 last:border-0">
                <div className="hierarchy-depth-node flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group" data-depth={depth}>
                    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(loc.id); }} className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleExpand(loc.id)}>
                        <div className="w-5 flex justify-center text-slate-400">
                            {hasChildren ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <div className="w-4 h-4" />}
                        </div>
                        {loc.locationType === 'Campus' || loc.locationType === 'Property' ? <Map size={16} className="text-emerald-600 shrink-0" /> : <Building2 size={16} className="text-indigo-500 shrink-0" />}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{loc.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700 font-medium uppercase tracking-wider">{loc.locationType || 'Location'}</span>
                                {loc.photos && loc.photos.length > 0 && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title={`${loc.photos.length} Photo(s)`}>
                                        <CameraIcon size={10} /> {loc.photos.length}
                                    </span>
                                )}
                                {loc.layoutPhotoUrl && (
                                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400 flex items-center gap-0.5" title="Floor Plan Layout Available">
                                        <Map size={10} /> Plan
                                    </span>
                                )}
                            </div>
                            {loc.address && <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin size={10}/> {loc.address}</div>}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openLocationModal(loc.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors text-xs flex items-center gap-1 font-medium" title="Add Sub-Location">
                            <Plus size={12} /> <MapPin size={12}/>
                        </button>
                        <button onClick={() => openEquipmentModal(loc.id)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-xs flex items-center gap-1 font-medium" title="Add Equipment">
                            <Plus size={12} /> <Box size={12}/>
                        </button>
                        <button onClick={() => { setSelectedLocationForLayout(loc); setIsLayoutModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors text-xs flex items-center gap-1 font-medium border-r border-slate-200 dark:border-slate-700 pr-2 mr-1" title="Location Photos & Layout">
                            <ImageIcon size={12} /> Layout
                        </button>
                        <button onClick={() => openLocationModal(loc.parentId || undefined, loc)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors" title="Edit">
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteLocation(loc.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-slate-700 transition-colors" title="Delete">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {isExpanded && hasChildren && (
                    <div className="bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800/50">
                        {childLocations.map(child => renderLocationNode(child, depth + 1))}
                        {childEquipment.map(eq => renderEquipmentNode(eq, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    const rootLocations = locations.filter(l => !l.parentId || !locations.some(parent => parent.id === l.parentId));
    const unassignedEquipment = equipment.filter(e => (!e.propertyId && !e.locationId) || (e.propertyId && !locations.some(loc => loc.id === e.propertyId)) || (e.locationId && !locations.some(loc => loc.id === e.locationId)));

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <MapPin className="text-emerald-500" size={18} /> Asset Hierarchy
                </h4>
                <div className="flex items-center gap-2">
                    <Button onClick={() => openLocationModal()} variant="outline" size="sm" className="flex items-center gap-1"><Plus size={14}/> Add Location</Button>
                    <Button onClick={() => openEquipmentModal()} variant="outline" size="sm" className="flex items-center gap-1"><Plus size={14}/> Add Equipment</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                {rootLocations.length === 0 && unassignedEquipment.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <Box size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="font-medium">No locations or equipment configured.</p>
                        <p className="text-sm mt-1">Add a location or equipment item to start building your hierarchy.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {rootLocations.map(loc => renderLocationNode(loc, 0))}
                        
                        {unassignedEquipment.length > 0 && (
                            <div className="border-t-4 border-slate-100 dark:border-slate-800">
                                <div className="py-2 px-3 bg-slate-50 dark:bg-slate-800/80">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unassigned Equipment ({unassignedEquipment.length})</span>
                                </div>
                                <div>
                                    {unassignedEquipment.map(eq => renderEquipmentNode(eq, 0))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Location Modal */}
            <Modal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} title={editingLocation?.id ? "Edit Location" : "Add Location"} size="md">
                <div className="space-y-4">
                    <Select label="Location Type" value={editingLocation?.locationType || locationOptions[0]} onChange={e => setEditingLocation({...editingLocation, locationType: e.target.value})}>
                        {locationOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </Select>
                    <Input label="Name" value={editingLocation?.name || ''} onChange={e => setEditingLocation({...editingLocation, name: e.target.value})} placeholder="e.g. Main Campus, Building A" />
                    <Select label="Parent Location" value={editingLocation?.parentId || ''} onChange={e => setEditingLocation({...editingLocation, parentId: e.target.value || null})}>
                        <option value="">-- None (Root Level) --</option>
                        {locations.filter(l => l.id !== editingLocation?.id).map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.locationType || 'Location'})</option>
                        ))}
                    </Select>
                    <Input label="Address (Optional)" value={editingLocation?.address || ''} onChange={e => setEditingLocation({...editingLocation, address: e.target.value})} placeholder="Location specific address" />
                    <Input label="Notes" value={editingLocation?.notes || ''} onChange={e => setEditingLocation({...editingLocation, notes: e.target.value})} placeholder="Access details, etc." />
                    
                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSaveLocation} variant="primary" className="w-full">Save Location</Button>
                    </div>
                </div>
            </Modal>

            {/* Equipment Modal */}
            <Modal isOpen={isEquipmentModalOpen} onClose={() => setIsEquipmentModalOpen(false)} title={editingEquipment?.id ? "Edit Equipment" : "Add Equipment"} size="md">
                <div className="space-y-5 max-h-[80vh] overflow-y-auto px-1 custom-scrollbar">
                    {/* SECTION 1: Asset Core Details */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Box size={14} /> {t("Asset Identifiers")}</h5>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Asset Name" value={editingEquipment?.name || ''} onChange={e => setEditingEquipment({...editingEquipment, name: e.target.value})} placeholder="e.g. RTU-1, Freezer Condenser" />
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Input label="Asset Tag (Barcode/QR)" value={editingEquipment?.assetTag || ''} onChange={e => setEditingEquipment({...editingEquipment, assetTag: e.target.value})} placeholder="e.g. TK-RTU-000142" />
                                </div>
                                <BarcodeScannerButton onScan={handleBarcodeScanned} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Select label="Type" value={editingEquipment?.type || equipmentOptions[0]} onChange={e => setEditingEquipment({...editingEquipment, type: e.target.value})}>
                                {equipmentOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </Select>
                            <Select label="Condition" value={editingEquipment?.condition || ''} onChange={e => setEditingEquipment({...editingEquipment, condition: e.target.value as EquipmentAsset['condition']})}>
                                <option value="">-- Select --</option>
                                <option value="Excellent">Excellent</option>
                                <option value="Good">Good</option>
                                <option value="Fair">Fair</option>
                                <option value="Poor">Poor</option>
                                <option value="Critical">Critical</option>
                            </Select>
                            <Select label="System Status" value={editingEquipment?.status || 'Operational'} onChange={e => setEditingEquipment({...editingEquipment, status: e.target.value})}>
                                <option value="Operational">Operational</option>
                                <option value="Down">Down</option>
                                <option value="Waiting for Parts">Waiting for Parts</option>
                                <option value="Blower Motor Burnt Out">Blower Motor Burnt Out</option>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input label="Brand" value={editingEquipment?.brand || ''} onChange={e => setEditingEquipment({...editingEquipment, brand: e.target.value})} placeholder="e.g. Trane" />
                            <Input label="Model" value={editingEquipment?.model || ''} onChange={e => setEditingEquipment({...editingEquipment, model: e.target.value})} placeholder="Model #" />
                            <Input label="Serial Number" value={editingEquipment?.serial || ''} onChange={e => setEditingEquipment({...editingEquipment, serial: e.target.value})} placeholder="Serial #" />
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                disabled={isResearching || !editingEquipment?.model}
                                onClick={handleResearchSpecs}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-800 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                            >
                                <Sparkles size={14} className={isResearching ? "animate-spin" : ""} />
                                {isResearching ? "Researching Technical Specs (AI)..." : "Research & Auto-fill Specs (AI)"}
                            </button>
                        </div>
                    </div>

                    {/* SECTION: Technical Specifications */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Layers size={14} /> Technical Specifications</h5>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input 
                                label="Year" 
                                type="text"
                                value={editingEquipment?.year || ''} 
                                onChange={e => setEditingEquipment({...editingEquipment, year: e.target.value})} 
                                placeholder="e.g. 2018" 
                            />
                            <Input 
                                label="Tonnage (Size in Tons)" 
                                type="number"
                                step="any"
                                value={editingEquipment?.tonnage ?? ''} 
                                onChange={e => setEditingEquipment({...editingEquipment, tonnage: e.target.value === '' ? undefined : Number(e.target.value)})} 
                                placeholder="e.g. 3.5" 
                            />
                            <Input 
                                label="Refrigerant Type" 
                                type="text"
                                value={editingEquipment?.refrigerantType || ''} 
                                onChange={e => setEditingEquipment({...editingEquipment, refrigerantType: e.target.value})} 
                                placeholder="e.g. R410A, R22" 
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input 
                                label="Heat Type" 
                                type="text"
                                value={editingEquipment?.heatType || ''} 
                                onChange={e => setEditingEquipment({...editingEquipment, heatType: e.target.value})} 
                                placeholder="e.g. Gas, Electric, Heat Pump" 
                            />
                            <Input 
                                label="Electricity Type / Specs" 
                                type="text"
                                value={editingEquipment?.electricityType || ''} 
                                onChange={e => setEditingEquipment({...editingEquipment, electricityType: e.target.value})} 
                                placeholder="e.g. 230V / 1ph" 
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input 
                                label="SEER Rating" 
                                type="text"
                                value={editingEquipment?.seerRating || ''} 
                                onChange={e => setEditingEquipment({...editingEquipment, seerRating: e.target.value})} 
                                placeholder="e.g. 16, 21" 
                            />
                            <Input 
                                label="Filter Size & Type" 
                                type="text"
                                value={editingEquipment?.filterType || ''} 
                                onChange={e => setEditingEquipment({...editingEquipment, filterType: e.target.value})} 
                                placeholder="e.g. 20x25x1 MERV 11" 
                            />
                        </div>
                    </div>

                    {/* SECTION 2: Precise Location Hierarchy */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin size={14} /> {t("Precise Field Location Hierarchy")}</h5>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Select label="Parent Location (Site)" value={editingEquipment?.propertyId || ''} onChange={e => setEditingEquipment({...editingEquipment, propertyId: e.target.value})}>
                                <option value="">-- Unassigned --</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.name} ({l.locationType || 'Location'})</option>
                                ))}
                            </Select>
                            <Select label="Area (Physical Location)" value={editingEquipment?.physicalLocation || ''} onChange={e => setEditingEquipment({...editingEquipment, physicalLocation: e.target.value})}>
                                <option value="">-- Select Area --</option>
                                {PHYSICAL_LOCATION_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input label="Exact Placement (Detailed)" value={editingEquipment?.exactPlacement || ''} onChange={e => setEditingEquipment({...editingEquipment, exactPlacement: e.target.value})} placeholder="e.g. Front left corner on roof box" />
                            <Input label="Serves Area / Space" value={editingEquipment?.servesArea || ''} onChange={e => setEditingEquipment({...editingEquipment, servesArea: e.target.value})} placeholder="e.g. Dining room, Walk-in freezer box" />
                            <Input 
                                label="Zone (for Layout Filter)" 
                                value={editingEquipment?.zone || ''} 
                                onChange={e => setEditingEquipment({...editingEquipment, zone: e.target.value})} 
                                placeholder="e.g. Zone A, Kitchen" 
                                list="available-zones-list"
                            />
                            <datalist id="available-zones-list">
                                {uniqueZones.map(z => (
                                    <option key={z} value={z} />
                                ))}
                            </datalist>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="col-span-1">
                                <Input label="Sub-Location Label (Legacy)" value={editingEquipment?.location || ''} onChange={e => setEditingEquipment({...editingEquipment, location: e.target.value})} placeholder="e.g. Roof" />
                            </div>
                            <div className="col-span-2 grid grid-cols-1 gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <Input 
                                        label="GPS Latitude" 
                                        type="number" 
                                        step="any"
                                        value={editingEquipment?.gpsPin?.lat ?? ''} 
                                        onChange={e => {
                                            const currentPin = editingEquipment?.gpsPin || { lat: 0, lng: 0 };
                                            setEditingEquipment({...editingEquipment, gpsPin: { ...currentPin, lat: e.target.value === '' ? 0 : Number(e.target.value) }});
                                        }} 
                                        placeholder="29.4241"
                                    />
                                    <Input 
                                        label="GPS Longitude" 
                                        type="number" 
                                        step="any"
                                        value={editingEquipment?.gpsPin?.lng ?? ''} 
                                        onChange={e => {
                                            const currentPin = editingEquipment?.gpsPin || { lat: 0, lng: 0 };
                                            setEditingEquipment({...editingEquipment, gpsPin: { ...currentPin, lng: e.target.value === '' ? 0 : Number(e.target.value) }});
                                        }} 
                                        placeholder="-98.4936"
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={async () => {
                                        setGpsLoading(true);
                                        try {
                                            const loc = await getCurrentLocation();
                                            if (loc) {
                                                setEditingEquipment(prev => ({
                                                    ...prev,
                                                    gpsPin: { lat: loc.latitude, lng: loc.longitude }
                                                }));
                                                showToast.success("GPS Coordinates Captured!");
                                            } else {
                                                showToast.error("Failed to capture location. Please check device permissions.");
                                            }
                                        } catch (err) {
                                            showToast.error("Error capturing GPS coordinates.");
                                        } finally {
                                            setGpsLoading(false);
                                        }
                                    }}
                                    disabled={gpsLoading}
                                    className="flex items-center justify-center gap-1.5 py-1 px-3 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-800 rounded bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold h-8 transition-colors disabled:opacity-50"
                                >
                                    <MapPin size={14} className={gpsLoading ? "animate-bounce" : ""} />
                                    {gpsLoading ? "Capturing GPS..." : "Capture Device GPS"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: Refrigeration System Linkage */}
                    <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                checked={isLinkedToSystem}
                                onChange={(e) => {
                                    setIsLinkedToSystem(e.target.checked);
                                    if (e.target.checked && uniqueSystemGroups.length > 0 && !selectedSystemGroupId) {
                                        setSelectedSystemGroupId(uniqueSystemGroups[0].id);
                                    }
                                }}
                            />
                            <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                                <Layers size={15} /> Link to a Refrigeration / Split System Group
                            </span>
                        </label>

                        {isLinkedToSystem && (
                            <div className="pl-6 space-y-3 border-l-2 border-indigo-200 dark:border-indigo-800 mt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Select 
                                        label="System Group" 
                                        value={selectedSystemGroupId} 
                                        onChange={e => setSelectedSystemGroupId(e.target.value)}
                                    >
                                        {uniqueSystemGroups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                        <option value="NEW">-- Create New System Group --</option>
                                    </Select>

                                    <Select 
                                        label="Component Role in System" 
                                        value={editingEquipment?.systemGroupRole || 'Standalone'} 
                                        onChange={e => setEditingEquipment({...editingEquipment, systemGroupRole: e.target.value})}
                                    >
                                        <option value="Evaporator">Evaporator (Inside Box)</option>
                                        <option value="Condensing Unit">Condensing Unit (Outside / Roof)</option>
                                        <option value="Controller">Controller (Near Door / Wall)</option>
                                        <option value="Compressor">Compressor</option>
                                        <option value="Standalone">Standalone Component</option>
                                    </Select>
                                </div>

                                {selectedSystemGroupId === 'NEW' && (
                                    <Input 
                                        label="New System Group Name" 
                                        value={newSystemGroupName} 
                                        onChange={e => setNewSystemGroupName(e.target.value)} 
                                        placeholder="e.g. Walk-In Freezer #1, Deli Line System"
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* SECTION 4: Linked Legacy Equipment */}
                    <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Link to other Equipment (Legacy)</p>
                        <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50 space-y-2 custom-scrollbar">
                            {(() => {
                                const editingRoot = getRootLocationId(editingEquipment?.propertyId);
                                const eligibleEquipment = equipment.filter(e => {
                                    if (e.id === editingEquipment?.id) return false;
                                    const eRoot = getRootLocationId(e.propertyId);
                                    return editingRoot && eRoot && editingRoot === eRoot;
                                });
                                if (eligibleEquipment.length === 0) {
                                    return <p className="text-xs text-slate-500 text-center py-2">No other equipment to link</p>;
                                }

                                const equipmentByLocation: Record<string, any[]> = {};
                                const unassigned: any[] = [];
                                
                                eligibleEquipment.forEach((eq: any) => {
                                    if (eq.propertyId) {
                                        const loc = locations.find((l: any) => l.id === eq.propertyId);
                                        if (loc) {
                                            if (!equipmentByLocation[loc.id]) {
                                                equipmentByLocation[loc.id] = [];
                                            }
                                            equipmentByLocation[loc.id].push(eq);
                                            return;
                                        }
                                    }
                                    unassigned.push(eq);
                                });

                                return (
                                    <div className="space-y-2">
                                        {locations.map((loc: any) => {
                                            const groupEq = equipmentByLocation[loc.id] || [];
                                            if (groupEq.length === 0) return null;
                                            return (
                                                <details key={loc.id} className="group border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                                                    <summary className="flex items-center justify-between p-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                        <span className="flex items-center gap-1.5">
                                                            <MapPin size={12} className="text-blue-500" />
                                                            {loc.name} ({groupEq.length})
                                                        </span>
                                                        <ChevronDown size={14} className="transition-transform group-open:rotate-180 text-slate-400" />
                                                    </summary>
                                                    <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1 bg-slate-50 dark:bg-slate-900/50">
                                                        {groupEq.map((opt: any) => (
                                                            <label key={opt.id} className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="rounded border-slate-300"
                                                                    checked={editingEquipment?.linkedAssetIds?.includes(opt.id) || false}
                                                                    onChange={(e) => {
                                                                        const currentLinks = editingEquipment?.linkedAssetIds || [];
                                                                        if (e.target.checked) {
                                                                            setEditingEquipment({...editingEquipment, linkedAssetIds: [...currentLinks, opt.id]});
                                                                        } else {
                                                                            setEditingEquipment({...editingEquipment, linkedAssetIds: currentLinks.filter(id => id !== opt.id)});
                                                                        }
                                                                    }}
                                                                />
                                                                <span className="text-xs text-slate-700 dark:text-slate-300">{opt.name || opt.brand} ({opt.model})</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </details>
                                            );
                                        })}
                                        
                                        {unassigned.length > 0 && (
                                            <details className="group border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                                                <summary className="flex items-center justify-between p-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    <span className="flex items-center gap-1.5">
                                                        <Layers size={12} className="text-slate-400" />
                                                        Unassigned Location ({unassigned.length})
                                                    </span>
                                                    <ChevronDown size={14} className="transition-transform group-open:rotate-180 text-slate-400" />
                                                </summary>
                                                <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1 bg-slate-50 dark:bg-slate-900/50">
                                                    {unassigned.map((opt: any) => (
                                                        <label key={opt.id} className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="rounded border-slate-300"
                                                                checked={editingEquipment?.linkedAssetIds?.includes(opt.id) || false}
                                                                onChange={(e) => {
                                                                    const currentLinks = editingEquipment?.linkedAssetIds || [];
                                                                    if (e.target.checked) {
                                                                        setEditingEquipment({...editingEquipment, linkedAssetIds: [...currentLinks, opt.id]});
                                                                    } else {
                                                                        setEditingEquipment({...editingEquipment, linkedAssetIds: currentLinks.filter(id => id !== opt.id)});
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-xs text-slate-700 dark:text-slate-300">{opt.name || opt.brand} ({opt.model})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* SECTION: Auto-Create & Link Air Handler */}
                    {['System', 'Split System', 'Package Unit', 'Condenser', 'Heat Pump'].includes(editingEquipment?.type || '') && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300"
                                    checked={autoCreateAirHandler}
                                    onChange={e => setAutoCreateAirHandler(e.target.checked)}
                                />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Auto-create and link an Air Handler</span>
                            </label>
                            
                            {autoCreateAirHandler && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <Input 
                                        label="Air Handler Name" 
                                        value={airHandlerDetails.name} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, name: e.target.value})} 
                                        placeholder="e.g. Air Handler 1"
                                    />
                                    <Select 
                                        label="Air Handler Location (Floor/Space)" 
                                        value={airHandlerDetails.propertyId} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, propertyId: e.target.value})}
                                    >
                                        <option value="">-- Same Location as Condenser --</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name} ({l.locationType || 'Location'})</option>
                                        ))}
                                    </Select>
                                    <Input 
                                        label="Air Handler Brand" 
                                        value={airHandlerDetails.brand} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, brand: e.target.value})} 
                                        placeholder="e.g. Trane, Goodman"
                                    />
                                    <Input 
                                        label="Air Handler Model" 
                                        value={airHandlerDetails.model} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, model: e.target.value})} 
                                        placeholder="Model #"
                                    />
                                    <Input 
                                        label="Air Handler Serial" 
                                        value={airHandlerDetails.serial} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, serial: e.target.value})} 
                                        placeholder="Serial #"
                                    />
                                    <div className="md:col-span-2 pt-1">
                                        <button
                                            type="button"
                                            disabled={isResearchingAirHandler || !airHandlerDetails?.model}
                                            onClick={handleResearchAirHandlerSpecs}
                                            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-800 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                                        >
                                            <Sparkles size={14} className={isResearchingAirHandler ? "animate-spin" : ""} />
                                            {isResearchingAirHandler ? "Researching Air Handler Specs (AI)..." : "Research & Auto-fill Air Handler Specs (AI)"}
                                        </button>
                                    </div>
                                    <Input 
                                        label="Exact Placement (Closet/Mechanical Room)" 
                                        value={airHandlerDetails.exactPlacement} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, exactPlacement: e.target.value})} 
                                        placeholder="e.g. Janitorial closet by office"
                                    />
                                    <Input 
                                        label="Serves Area / Space" 
                                        value={airHandlerDetails.servesArea} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, servesArea: e.target.value})} 
                                        placeholder="e.g. Main Lobby"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECTION: Auto-Create & Link Thermostat */}
                    {['System', 'Split System', 'Package Unit', 'Furnace', 'Condenser', 'Air Handler', 'Heat Pump'].includes(editingEquipment?.type || '') && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300"
                                    checked={autoCreateThermostat}
                                    onChange={e => setAutoCreateThermostat(e.target.checked)}
                                />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Auto-create and link a Thermostat</span>
                            </label>
                            
                            {autoCreateThermostat && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <Input 
                                        label="Thermostat Name" 
                                        value={thermostatDetails.name} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, name: e.target.value})} 
                                        placeholder="e.g. Thermostat 1"
                                    />
                                    <Select 
                                        label="Thermostat Location (Floor/Space)" 
                                        value={thermostatDetails.propertyId} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, propertyId: e.target.value})}
                                    >
                                        <option value="">-- Same Location as RTU --</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name} ({l.locationType || 'Location'})</option>
                                        ))}
                                    </Select>
                                    <Input 
                                        label="Thermostat Brand" 
                                        value={thermostatDetails.brand} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, brand: e.target.value})} 
                                        placeholder="e.g. Honeywell, Nest"
                                    />
                                    <Input 
                                        label="Thermostat Model" 
                                        value={thermostatDetails.model} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, model: e.target.value})} 
                                        placeholder="Model #"
                                    />
                                    <Input 
                                        label="Exact Placement (Internal)" 
                                        value={thermostatDetails.exactPlacement} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, exactPlacement: e.target.value})} 
                                        placeholder="e.g. Back hallway by office"
                                    />
                                    <Input 
                                        label="Serves Area / Space" 
                                        value={thermostatDetails.servesArea} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, servesArea: e.target.value})} 
                                        placeholder="e.g. Main Lobby"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECTION 5: Asset Verification Photos */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <CameraIcon size={14} /> {t("Asset Verification Photos")}
                        </h5>
                        <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3 pt-1">
                            {[
                                { key: 'serialPhotoUrl', label: t('OCR Serial Photo') },
                                { key: 'unitTagPhotoUrl', label: t('OCR Unit Data Plate') },
                                { key: 'conditionPhotoUrl', label: t('Condition Photo') },
                                { key: 'wideLocationPhotoUrl', label: t('Wide Location Photo') },
                                { key: 'accessPointPhotoUrl', label: t('Access Point Photo') },
                                { key: 'qrCodePhotoUrl', label: t('QR Tag Close-up') }
                            ].map(({ key, label }) => {
                                const url = editingEquipment?.[key as keyof EquipmentAsset] as string;
                                const descKey = `${key.replace('Url', 'Label')}`;
                                const description = editingEquipment?.[descKey as keyof EquipmentAsset] as string || '';

                                return (
                                    <div key={key} className="shrink-0 flex flex-col gap-2">
                                        <div className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl bg-white dark:bg-slate-900 text-xs text-center w-36 h-32 relative transition-colors shadow-sm overflow-hidden group">
                                            {url ? (
                                                <>
                                                    <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => { 
                                                            e.preventDefault(); 
                                                            e.stopPropagation(); 
                                                            setEditingEquipment(prev => prev ? {
                                                                ...prev,
                                                                [key]: '',
                                                                [descKey]: ''
                                                            } : null); 
                                                        }} 
                                                        className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full z-10 shadow-md transition-transform hover:scale-110" 
                                                        title={t("Remove Photo")}
                                                    >
                                                        <X size={12}/>
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center w-full h-full">
                                                    <span className="font-medium text-slate-600 dark:text-slate-300 mb-2">{label}</span>
                                                    <div className="flex gap-2">
                                                        <label className="flex flex-col items-center justify-center cursor-pointer p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title={t("Upload from Gallery")}>
                                                            <ImageIcon size={16} className="text-blue-500 dark:text-blue-400" />
                                                            <input 
                                                                type="file" 
                                                                className="hidden" 
                                                                accept="image/*" 
                                                                onChange={(e) => handleAssetPhotoUpload(e, key as any)} 
                                                                title={label} 
                                                            />
                                                        </label>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleAssetCameraTrigger(key as any)} 
                                                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" 
                                                            title={t("Take Photo")}
                                                        >
                                                            <CameraIcon size={16} className="text-blue-500 dark:text-blue-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {url && (
                                            <input 
                                                type="text" 
                                                placeholder={t("Add description...")} 
                                                value={description} 
                                                onChange={e => setEditingEquipment(prev => prev ? {
                                                    ...prev,
                                                    [descKey]: e.target.value
                                                } : null)}
                                                className="w-36 text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveEquipment} variant="primary" className="w-full">Save Equipment</Button>
                    </div>
                </div>
            </Modal>

            {/* Web Camera Modal */}
            <WebCameraModal 
                isOpen={isWebCameraOpen} 
                onClose={() => {
                    setIsWebCameraOpen(false);
                    setAssetCameraTarget(null);
                }} 
                onCapture={handleWebCameraCapture} 
            />

            {selectedLocationForLayout && (
                <LocationPhotosLayoutModal 
                    isOpen={isLayoutModalOpen}
                    onClose={() => {
                        setIsLayoutModalOpen(false);
                        setSelectedLocationForLayout(null);
                    }}
                    customerId={customer.id}
                    locationId={selectedLocationForLayout.id}
                    onSelectEquipment={(eq) => {
                        setIsLayoutModalOpen(false);
                        setSelectedLocationForLayout(null);
                        openEquipmentModal(eq.propertyId, eq);
                    }}
                />
            )}
        </div>
    );
};

export default EquipmentHierarchy;
