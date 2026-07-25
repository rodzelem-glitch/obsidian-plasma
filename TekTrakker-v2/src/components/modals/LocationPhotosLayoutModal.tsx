import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Customer, ServiceLocation, EquipmentAsset, LayoutHotspot, StoredFile } from 'types';
import { db, firebase } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { uploadFileToStorage } from 'lib/storageService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
    X, Camera, Upload, Trash2, MapPin, Image, Plus, Minus, Layers, Square, Circle, 
    Sparkles, RefreshCw, AlertCircle, HelpCircle, Edit2, Link, Link2Off, Eye, Undo2
} from 'lucide-react';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Spinner from 'components/ui/Spinner';
import showToast from 'lib/toast';
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
    locationId: string;
    onSelectEquipment?: (eq: EquipmentAsset) => void;
    isTechView?: boolean;
}

const LocationPhotosLayoutModal: React.FC<Props> = ({
    isOpen,
    onClose,
    customerId,
    locationId,
    onSelectEquipment,
    isTechView = false
}) => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'photos' | 'layout'>('photos');

    // Retrieve active customer and location
    const customer = useMemo(() => {
        return state.customers?.find(c => c.id === customerId);
    }, [state.customers, customerId]);

    const location = useMemo(() => {
        return customer?.serviceLocations?.find(l => l.id === locationId);
    }, [customer, locationId]);

    // Equipment assets associated with this location
    const locationAssets = useMemo(() => {
        if (!customer?.equipment) return [];
        return customer.equipment.filter(e => e.propertyId === locationId);
    }, [customer, locationId]);

    // Component states synced with location
    const [photos, setPhotos] = useState<string[]>([]);
    const [layoutPhotoUrl, setLayoutPhotoUrl] = useState<string>('');
    const [layoutProfessionalSvg, setLayoutProfessionalSvg] = useState<string>('');
    const [hotspots, setHotspots] = useState<LayoutHotspot[]>([]);

    // Loading / UI states
    const [isUploading, setIsUploading] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
    const [showMappingPanel, setShowMappingPanel] = useState(false);
    
    // Drag and drop tracking
    const viewportRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragActivePhotos, setDragActivePhotos] = useState(false);
    const [dragActiveLayout, setDragActiveLayout] = useState(false);

    // Zoom, Rotate, and Compare states
    const [zoom, setZoom] = useState<number>(1);
    const [rotation, setRotation] = useState<number>(0);
    const [showOverlay, setShowOverlay] = useState<boolean>(false);
    const [overlayOpacity, setOverlayOpacity] = useState<number>(0.5);

    // Sketcher & GPS states
    const [layoutVertices, setLayoutVertices] = useState<{ id: string; x: number; y: number }[]>([]);
    const [editorMode, setEditorMode] = useState<'view' | 'edit-perimeter' | 'gps-record'>('view');
    const [gpsPoints, setGpsPoints] = useState<{ id: string; latitude: number; longitude: number }[]>([]);
    const [gpsLoading, setGpsLoading] = useState<boolean>(false);
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [draggingVertexId, setDraggingVertexId] = useState<string | null>(null);
    const [aiInstructions, setAiInstructions] = useState<string>('');
    const [previousLayout, setPreviousLayout] = useState<{ svg: string; hotspots: LayoutHotspot[]; vertices: any[]; customShapes: any[] } | null>(null);

    // Custom Shapes editor states
    const [customShapes, setCustomShapes] = useState<{ id: string; type: 'rect' | 'circle' | 'line'; x: number; y: number; width: number; height: number; color: string; rotation?: number; zone?: string }[]>([]);
    const [activeShapeId, setActiveShapeId] = useState<string | null>(null);
    const [draggingShapeId, setDraggingShapeId] = useState<string | null>(null);

    // Zone management states
    const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('All');
    const [isCreatingNewZone, setIsCreatingNewZone] = useState<boolean>(false);
    const [newZoneName, setNewZoneName] = useState<string>('');

    // Compute unique zones from assets and shapes
    const availableZones = useMemo(() => {
        const assetZones = locationAssets.map(a => a.zone).filter(Boolean) as string[];
        const shapeZones = customShapes.map(s => s.zone).filter(Boolean) as string[];
        return Array.from(new Set([...assetZones, ...shapeZones]));
    }, [locationAssets, customShapes]);

    // Sync values when location updates
    useEffect(() => {
        if (location) {
            setPhotos(location.photos || []);
            setLayoutPhotoUrl(location.layoutPhotoUrl || '');
            setLayoutProfessionalSvg(location.layoutProfessionalSvg || '');
            setHotspots(location.layoutHotspots || []);
            setLayoutVertices(location.layoutVertices || []);
            setCustomShapes(location.layoutCustomShapes || []);
        }
    }, [location]);

    if (!isOpen || !customer || !location) return null;

    const sanitizeSvgContent = (rawSvg: string): string => {
        if (!rawSvg) return '';
        let cleaned = rawSvg;
        // Clean preserveAspectRatio capitalization or trailing garbage (e.g. "xMidYMid Meet" -> "xMidYMid meet")
        cleaned = cleaned.replace(/preserveAspectRatio\s*=\s*"([^"]*)"/gi, (match, p1) => {
            const val = p1.trim().toLowerCase();
            if (val.includes('meet')) {
                return 'preserveAspectRatio="xMidYMid meet"';
            } else if (val.includes('slice')) {
                return 'preserveAspectRatio="xMidYMid slice"';
            } else if (val === 'none') {
                return 'preserveAspectRatio="none"';
            }
            return 'preserveAspectRatio="xMidYMid meet"';
        });
        // Replace any d="..." or points="..." attributes containing alphabetical words of length 2 or more
        return cleaned.replace(/(d|points)\s*=\s*"([^"]*)"/gi, (match, attrName, p1) => {
            const cleanedVal = p1.replace(/[a-df-ik-np-rsu-y]{2,}/gi, ' ');
            return `${attrName}="${cleanedVal}"`;
        });
    };

    const handleAddShape = async (type: 'rect' | 'circle' | 'line') => {
        const newShape = {
            id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type,
            x: 50,
            y: 50,
            width: type === 'line' ? 15 : 8,
            height: 8,
            color: '#06b6d4',
            rotation: 0
        };
        const updated = [...customShapes, newShape];
        setCustomShapes(updated);
        setActiveShapeId(newShape.id);
        setActiveHotspotId(null);
        await saveLocationData({ layoutCustomShapes: updated });
        showToast.success(`Added custom ${type}`);
    };

    const handleDeleteShape = async (shapeId: string) => {
        const updated = customShapes.filter(s => s.id !== shapeId);
        setCustomShapes(updated);
        setActiveShapeId(null);
        await saveLocationData({ layoutCustomShapes: updated });
        showToast.success("Shape removed");
    };

    const handleUpdateShape = async (shapeId: string, updates: any) => {
        const updated = customShapes.map(s => s.id === shapeId ? { ...s, ...updates } : s);
        setCustomShapes(updated);
        await saveLocationData({ layoutCustomShapes: updated });
    };

    const handleShapeMouseDown = (e: React.MouseEvent, id: string) => {
        if (isTechView || !viewportRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        
        isDraggingRef.current = false;
        setDraggingShapeId(id);
        setActiveShapeId(id);
        setActiveHotspotId(null);
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!viewportRef.current) return;
            isDraggingRef.current = true;
            const { x, y } = getUntransformedPercentage(moveEvent.clientX, moveEvent.clientY);
            setCustomShapes(prev => prev.map(shape => shape.id === id ? { ...shape, x, y } : shape));
        };

        const handleMouseUp = () => {
            setDraggingShapeId(null);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            setCustomShapes(current => {
                saveLocationData({ layoutCustomShapes: current });
                return current;
            });

            setTimeout(() => {
                isDraggingRef.current = false;
            }, 50);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleResizeMouseDown = (e: React.MouseEvent, id: string) => {
        if (isTechView || !viewportRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        
        const shape = customShapes.find(s => s.id === id);
        if (!shape) return;

        isDraggingRef.current = false;
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = shape.width;
        const startHeight = shape.height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!viewportRef.current) return;
            isDraggingRef.current = true;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            const rect = viewportRef.current.getBoundingClientRect();
            const pctDx = (dx / (rect.width / zoom)) * 100;
            const pctDy = (dy / (rect.height / zoom)) * 100;

            setCustomShapes(prev => prev.map(s => {
                if (s.id === id) {
                    return {
                        ...s,
                        width: Math.max(1, startWidth + pctDx),
                        height: Math.max(1, startHeight + pctDy)
                    };
                }
                return s;
            }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            setCustomShapes(current => {
                saveLocationData({ layoutCustomShapes: current });
                return current;
            });

            setTimeout(() => {
                isDraggingRef.current = false;
            }, 50);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleRotateMouseDown = (e: React.MouseEvent, id: string) => {
        if (isTechView || !viewportRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        
        const shape = customShapes.find(s => s.id === id);
        if (!shape) return;

        isDraggingRef.current = false;
        const rect = viewportRef.current.getBoundingClientRect();
        const shapeCenterX = rect.left + (shape.x / 100) * rect.width;
        const shapeCenterY = rect.top + (shape.y / 100) * rect.height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            isDraggingRef.current = true;
            const dx = moveEvent.clientX - shapeCenterX;
            const dy = moveEvent.clientY - shapeCenterY;
            let angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
            angle = (angle + 90) % 360;
            if (angle < 0) angle += 360;

            setCustomShapes(prev => prev.map(s => {
                if (s.id === id) {
                    return {
                        ...s,
                        rotation: angle
                    };
                }
                return s;
            }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            setCustomShapes(current => {
                saveLocationData({ layoutCustomShapes: current });
                return current;
            });

            setTimeout(() => {
                isDraggingRef.current = false;
            }, 50);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const getUntransformedPercentage = (clientX: number, clientY: number) => {
        if (!viewportRef.current) return { x: 50, y: 50 };
        const rect = viewportRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const screenDx = clientX - centerX;
        const screenDy = clientY - centerY;

        // 1. Rotate the screen offset by -rotation to align with local axes
        const rad = (-rotation * Math.PI) / 180;
        const cosVal = Math.cos(rad);
        const sinVal = Math.sin(rad);
        let rx = screenDx * cosVal - screenDy * sinVal;
        let ry = screenDx * sinVal + screenDy * cosVal;

        // 2. Reverse zoom scaling on both axes
        rx = rx / zoom;
        ry = ry / zoom;

        const origWidth = viewportRef.current.clientWidth;
        const origHeight = viewportRef.current.clientHeight;

        const clickX = rx + origWidth / 2;
        const clickY = ry + origHeight / 2;

        const xPct = Math.max(0, Math.min(100, Math.round((clickX / origWidth) * 1000) / 10));
        const yPct = Math.max(0, Math.min(100, Math.round((clickY / origHeight) * 1000) / 10));

        return { x: xPct, y: yPct };
    };

    const compileSvgFromVertices = (vertices: Array<{ x: number; y: number }>) => {
        if (vertices.length < 2) return '';
        const pointsStr = vertices.map(v => `${(v.x / 100) * 800},${(v.y / 100) * 600}`).join(' ');
        const polylinePoints = [...vertices, vertices[0]].map(v => `${(v.x / 100) * 800},${(v.y / 100) * 600}`).join(' ');
        
        return `<svg viewBox="0 0 800 600" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#0f172a" />
            <rect width="100%" height="100%" fill="url(#grid)" />
            <polygon points="${pointsStr}" fill="rgba(16, 185, 129, 0.04)" stroke="rgba(16, 185, 129, 0.15)" stroke-width="2" />
            <polyline points="${polylinePoints}" fill="none" stroke="#334155" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
            <polyline points="${polylinePoints}" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;
    };

    const handleVertexMouseDown = (e: React.MouseEvent, id: string) => {
        if (isTechView) return;
        e.preventDefault();
        e.stopPropagation();
        setDraggingVertexId(id);
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const { x, y } = getUntransformedPercentage(moveEvent.clientX, moveEvent.clientY);
            setLayoutVertices(prev => {
                const updated = prev.map(v => v.id === id ? { ...v, x, y } : v);
                setLayoutProfessionalSvg(compileSvgFromVertices(updated));
                return updated;
            });
        };
        
        const handleMouseUp = () => {
            setDraggingVertexId(null);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            setLayoutVertices(currentVertices => {
                saveLocationData({ 
                    layoutVertices: currentVertices,
                    layoutProfessionalSvg: compileSvgFromVertices(currentVertices)
                });
                return currentVertices;
            });
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleVertexDoubleClick = async (vertexId: string) => {
        if (isTechView) return;
        if (layoutVertices.length <= 3) {
            showToast.error("Perimeter must have at least 3 corners.");
            return;
        }
        const updated = layoutVertices.filter(v => v.id !== vertexId);
        setLayoutVertices(updated);
        setLayoutProfessionalSvg(compileSvgFromVertices(updated));
        await saveLocationData({
            layoutVertices: updated,
            layoutProfessionalSvg: compileSvgFromVertices(updated)
        });
        showToast.success("Corner removed");
    };

    // Helper to persist location data back to customer and serviceLocation collections
    const cleanFirestoreData = (data: any): any => {
        if (Array.isArray(data)) {
            return data.map(cleanFirestoreData);
        } else if (data !== null && typeof data === 'object') {
            const cleaned: any = {};
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined) {
                    cleaned[key] = cleanFirestoreData(data[key]);
                }
            });
            return cleaned;
        }
        return data;
    };

    const saveLocationData = async (updates: Partial<ServiceLocation>) => {
        // Find the absolute latest customer state from AppContext to prevent stale closure data overwrites
        const latestCustomer = state.customers?.find(c => c.id === customer.id) || customer;
        if (!latestCustomer.serviceLocations) return;

        const updatedLocations = latestCustomer.serviceLocations.map(loc => {
            if (loc.id === locationId) {
                return { 
                    ...loc, 
                    layoutHotspots: updates.layoutHotspots !== undefined ? updates.layoutHotspots : hotspots,
                    layoutVertices: updates.layoutVertices !== undefined ? updates.layoutVertices : layoutVertices,
                    layoutCustomShapes: updates.layoutCustomShapes !== undefined ? updates.layoutCustomShapes : customShapes,
                    ...updates 
                };
            }
            return loc;
        });

        const cleanedLocations = cleanFirestoreData(updatedLocations);
        const cleanedUpdates = cleanFirestoreData(updates);

        try {
            if (!state.isDemoMode) {
                // Update in customers array
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                    serviceLocations: cleanedLocations
                }));
                // Update standalone serviceLocation document
                await db.collection('serviceLocations').doc(locationId).set(cleanUndefinedFields(cleanedUpdates), { merge: true });
            }

            dispatch({
                type: 'UPDATE_CUSTOMER',
                payload: { ...latestCustomer, serviceLocations: updatedLocations }
            });
        } catch (err) {
            console.error("Failed to save location photos/layout data:", err);
            showToast.error("Failed to sync changes with server");
        }
    };

    const saveCustomerEquipment = async (updatedEquipment: EquipmentAsset[]) => {
        // Find the absolute latest customer state from AppContext to prevent stale closure data overwrites
        const latestCustomer = state.customers?.find(c => c.id === customer.id) || customer;
        const cleaned = cleanFirestoreData(updatedEquipment);
        try {
            if (!state.isDemoMode) {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                    equipment: cleaned
                }));
            }
            dispatch({
                type: 'UPDATE_CUSTOMER',
                payload: { ...latestCustomer, equipment: updatedEquipment }
            });
        } catch (err) {
            console.error("Failed to sync customer equipment:", err);
            showToast.error("Failed to sync equipment updates");
        }
    };

    const processUploadedPhotos = async (files: File[]) => {
        if (files.length === 0) return;
        setIsUploading(true);

        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : `photo-${Date.now()}.png`;
                const orgId = state.currentOrganization?.id || 'default';
                const path = `organizations/${orgId}/customers/${customer.id}/locations/${locationId}/photos/${Date.now()}_${safeName}`;
                return await uploadFileToStorage(path, file);
            });

            const newUrls = await Promise.all(uploadPromises);
            const updatedPhotos = [...photos, ...newUrls];
            setPhotos(updatedPhotos);
            await saveLocationData({ photos: updatedPhotos });
            showToast.success("Location photo(s) uploaded");
        } catch (err) {
            console.error(err);
            showToast.error("Failed to upload photos");
        } finally {
            setIsUploading(false);
        }
    };

    // Photo Uploading
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        await processUploadedPhotos(Array.from(files));
        e.target.value = '';
    };

    const handleDragPhotos = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActivePhotos(true);
        } else if (e.type === "dragleave") {
            setDragActivePhotos(false);
        }
    };

    const handleDropPhotos = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActivePhotos(false);

        if (e.dataTransfer.files) {
            const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (imageFiles.length === 0) {
                showToast.warn("Drop Failed: Only image files are supported for property photos.");
                return;
            }
            await processUploadedPhotos(imageFiles);
        }
    };

    // Mobile camera photo trigger
    const triggerNativeCamera = async () => {
        try {
            const isNative = Capacitor.isNativePlatform();
            if (isNative) {
                const image = await CapacitorCamera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: CameraResultType.Uri,
                    source: CameraSource.Camera
                });

                if (image.webPath) {
                    setIsUploading(true);
                    const response = await fetch(image.webPath);
                    const blob = await response.blob();
                    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    
                    const orgId = state.currentOrganization?.id || 'default';
                    const path = `organizations/${orgId}/customers/${customer.id}/locations/${locationId}/photos/${Date.now()}_camera.jpg`;
                    const downloadUrl = await uploadFileToStorage(path, file);
                    
                    const updatedPhotos = [...photos, downloadUrl];
                    setPhotos(updatedPhotos);
                    await saveLocationData({ photos: updatedPhotos });
                    showToast.success("Photo captured successfully");
                }
            } else {
                // Fallback click on hidden file input
                document.getElementById('native-file-upload')?.click();
            }
        } catch (err) {
            console.error("Native Camera Error:", err);
            showToast.error("Failed to capture photo from camera");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeletePhoto = async (indexToDelete: number) => {
        if (!window.confirm("Are you sure you want to delete this photo?")) return;
        const updatedPhotos = photos.filter((_, idx) => idx !== indexToDelete);
        setPhotos(updatedPhotos);
        await saveLocationData({ photos: updatedPhotos });
        showToast.success("Photo deleted");
    };

    const processUploadedLayout = async (file: File) => {
        setIsUploading(true);

        try {
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : `layout-${Date.now()}.png`;
            const orgId = state.currentOrganization?.id || 'default';
            const path = `organizations/${orgId}/customers/${customer.id}/locations/${locationId}/layouts/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            
            setLayoutPhotoUrl(downloadUrl);
            await saveLocationData({ 
                layoutPhotoUrl: downloadUrl,
                layoutProfessionalSvg: '' // clear any previous AI SVG when a new crude layout is uploaded
            });
            showToast.success("Layout drawing uploaded. You can now enhance it!");
        } catch (err) {
            console.error(err);
            showToast.error("Failed to upload layout drawing");
        } finally {
            setIsUploading(false);
        }
    };

    // Floor Plan Uploading
    const handleLayoutUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processUploadedLayout(file);
        e.target.value = '';
    };

    const handleDragLayout = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActiveLayout(true);
        } else if (e.type === "dragleave") {
            setDragActiveLayout(false);
        }
    };

    const handleDropLayout = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActiveLayout(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (!file.type.startsWith('image/')) {
                showToast.warn("Drop Failed: Only image files are supported for layout blueprint.");
                return;
            }
            await processUploadedLayout(file);
        }
    };

    const handleDeleteLayout = async () => {
        if (!window.confirm("Are you sure you want to delete this floor plan? (All manual pin placements will be safely preserved.)")) return;
        setLayoutPhotoUrl('');
        setLayoutProfessionalSvg('');
        
        // Keep ONLY the manual hotspots!
        const manualHotspots = hotspots.filter(hp => hp.isManual);
        setHotspots(manualHotspots);
        
        // Clean up unused AI assets strictly for the current sublocation
        const manualEquipmentIds = new Set(manualHotspots.map(hp => hp.equipmentId).filter(Boolean));
        const cleanedEquipment = (customer.equipment || []).filter(asset => {
            if (asset.propertyId !== locationId) return true;
            if (asset.model !== 'AI Auto-Mapped') return true;
            return manualEquipmentIds.has(asset.id);
        });
        
        if (cleanedEquipment.length !== (customer.equipment || []).length) {
            await saveCustomerEquipment(cleanedEquipment);
        }

        setLayoutVertices([]);
        setCustomShapes([]);
        setEditorMode('view');
        await saveLocationData({ 
            layoutPhotoUrl: '',
            layoutProfessionalSvg: '',
            layoutHotspots: manualHotspots,
            layoutVertices: [],
            layoutCustomShapes: []
        });
        showToast.success("Layout deleted. Manual pins preserved!");
    };

    const handleUndoLayout = async () => {
        if (!previousLayout) return;
        
        setLayoutProfessionalSvg(previousLayout.svg);
        setHotspots(previousLayout.hotspots);
        setLayoutVertices(previousLayout.vertices);
        setCustomShapes(previousLayout.customShapes);
        
        await saveLocationData({
            layoutProfessionalSvg: previousLayout.svg,
            layoutHotspots: previousLayout.hotspots,
            layoutVertices: previousLayout.vertices,
            layoutCustomShapes: previousLayout.customShapes
        });
        
        setPreviousLayout(null);
        showToast.success("Successfully reverted to previous layout!");
    };

    // Fallback: dynamic high-quality blueprint SVG generated locally
    const generateFallbackBlueprint = () => {
        const width = 800;
        const height = 600;
        const customerNameEscaped = (customer?.name || "Client").replace(/[&<>"']/g, "");
        const locationNameEscaped = (location?.name || location?.propertyName || "Site").replace(/[&<>"']/g, "");
        
        // Generate dynamic rooms based on location assets
        const assetsCount = locationAssets.length;
        
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" className="w-full h-full bg-slate-900 text-slate-350">
            <!-- Background Grid -->
            <defs>
                <pattern id="blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="1"/>
                </pattern>
                <pattern id="blueprint-subgrid" width="100" height="100" patternUnits="userSpaceOnUse">
                    <rect width="100" height="100" fill="url(#blueprint-grid)"/>
                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" stroke-width="1.5"/>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#0f172a"/>
            <rect width="100%" height="100%" fill="url(#blueprint-subgrid)"/>
            
            <!-- Outer Border / Blueprint Frame -->
            <rect x="15" y="15" width="${width - 30}" height="${height - 30}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 4"/>
            <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
            
            <!-- Walls (Architectural Layout) -->
            <!-- Main Perimeter Walls -->
            <rect x="50" y="50" width="700" height="500" fill="none" stroke="#38bdf8" stroke-width="4"/>
            
            <!-- Corridors and Rooms partitioning -->
            <!-- Corridor horizontal wall -->
            <line x1="50" y1="200" x2="750" y2="200" stroke="#0ea5e9" stroke-width="3" stroke-dasharray="none"/>
            <!-- Lobby partitioning vertical wall -->
            <line x1="250" y1="50" x2="250" y2="200" stroke="#0ea5e9" stroke-width="3"/>
            <!-- Office Suites partitions -->
            <line x1="450" y1="50" x2="450" y2="200" stroke="#0ea5e9" stroke-width="3"/>
            <!-- Large Mechanical room horizontal divider -->
            <line x1="50" y1="380" x2="500" y2="380" stroke="#0ea5e9" stroke-width="3"/>
            <!-- Mechanical room vertical divider -->
            <line x1="500" y1="200" x2="500" y2="550" stroke="#0ea5e9" stroke-width="3"/>
            <!-- Storage Room vertical divider -->
            <line x1="280" y1="380" x2="280" y2="550" stroke="#0ea5e9" stroke-width="3"/>
            
            <!-- Door openings (indicated by light arcs) -->
            <path d="M 210 200 A 40 40 0 0 1 250 240" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3"/>
            <path d="M 410 200 A 40 40 0 0 1 450 240" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3"/>
            <path d="M 500 340 A 40 40 0 0 1 540 380" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3"/>
            
            <!-- Room Labels -->
            <text x="150" y="120" font-family="monospace" font-size="16" font-weight="bold" fill="#e0f2fe" text-anchor="middle">LOBBY / FRONT ENTRY</text>
            <text x="350" y="120" font-family="monospace" font-size="14" font-weight="bold" fill="#e0f2fe" text-anchor="middle">OFFICE SUITE A</text>
            <text x="600" y="120" font-family="monospace" font-size="14" font-weight="bold" fill="#e0f2fe" text-anchor="middle">OFFICE SUITE B</text>
            <text x="400" y="180" font-family="monospace" font-size="11" fill="#7dd3fc" text-anchor="middle">MAIN CORRIDOR</text>
            
            <text x="275" y="300" font-family="monospace" font-size="16" font-weight="bold" fill="#e0f2fe" text-anchor="middle">MECHANICAL PLANT ROOM</text>
            <text x="165" y="470" font-family="monospace" font-size="14" font-weight="bold" fill="#e0f2fe" text-anchor="middle">SPARE STORAGE</text>
            <text x="390" y="470" font-family="monospace" font-size="14" font-weight="bold" fill="#e0f2fe" text-anchor="middle">ELECTRICAL SUBSTATION</text>
            <text x="625" y="380" font-family="monospace" font-size="16" font-weight="bold" fill="#e0f2fe" text-anchor="middle">SERVER CENTER</text>
            
            <!-- Blueprint Title Block in bottom-right corner -->
            <g transform="translate(540, 480)">
                <rect width="200" height="60" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
                <line x1="0" y1="20" x2="200" y2="20" stroke="#38bdf8" stroke-width="1"/>
                <line x1="0" y1="40" x2="200" y2="40" stroke="#38bdf8" stroke-width="1"/>
                <text x="10" y="15" font-family="sans-serif" font-size="9" font-weight="bold" fill="#38bdf8">CLIENT: ${customerNameEscaped}</text>
                <text x="10" y="35" font-family="sans-serif" font-size="9" fill="#06b6d4">SITE: ${locationNameEscaped}</text>
                <text x="10" y="53" font-family="sans-serif" font-size="8" fill="#64748b">TekTrakker AI Draftsman - 2D Vector</text>
            </g>
        </svg>`;
    };

    // Render dynamic high-quality blueprint SVG from structured JSON
    const compileSvgFromLayoutJson = (jsonStr: string) => {
        const isRooftop = 
            location?.name?.toLowerCase().includes('roof') || 
            location?.propertyName?.toLowerCase().includes('roof') || 
            (aiInstructions && aiInstructions.toLowerCase().includes('roof'));

        try {
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found");
            const data = JSON.parse(jsonMatch[0]);

            const width = 800;
            const height = 600;

            const scaleX = (pct: number) => (pct / 100) * width;
            const scaleY = (pct: number) => (pct / 100) * height;

            let svgContent = '';

            // 1. Draw perimeter
            if (data.perimeter && data.perimeter.length > 1) {
                const points = data.perimeter.map((p: any) => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ');
                svgContent += `\n  <polygon points="${points}" fill="rgba(6, 182, 212, 0.03)" stroke="#06b6d4" stroke-width="4" stroke-linejoin="round" />`;
            }

            // 2. Draw partitions (inner walls)
            if (data.partitions && data.partitions.length > 0) {
                data.partitions.forEach((wall: any) => {
                    if (wall.length > 1) {
                        const points = wall.map((p: any) => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ');
                        svgContent += `\n  <polyline points="${points}" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
                    }
                });
            }

            // 3. Draw mounting pads (for rooftop layouts)
            if (data.mountingPads && data.mountingPads.length > 0) {
                data.mountingPads.forEach((pad: any) => {
                    svgContent += `\n  <rect x="${scaleX(pad.x)}" y="${scaleY(pad.y)}" width="${(pad.w / 100) * width}" height="${(pad.h / 100) * height}" fill="none" stroke="#475569" stroke-width="2" stroke-dasharray="4 2" opacity="0.6" />`;
                });
            }

            // 4. Draw rooms (room fills & labels)
            if (data.rooms && data.rooms.length > 0) {
                data.rooms.forEach((room: any) => {
                    if (room.name) {
                        const textLower = room.name.toLowerCase();
                        const isEquipment = 
                            textLower.includes('rtu') || 
                            textLower.includes('cu') || 
                            textLower.includes('ef') || 
                            textLower.includes('hvac') || 
                            textLower.includes('ac') || 
                            textLower.includes('tstat') || 
                            textLower.includes('t-stat') || 
                            textLower.includes('condenser') || 
                            textLower.includes('fan') || 
                            textLower.includes('exhaust') || 
                            textLower.includes('unit') || 
                            textLower.includes('system') || 
                            textLower.includes('compressor');

                        if (!isEquipment) {
                            svgContent += `\n  <text x="${scaleX(room.x)}" y="${scaleY(room.y)}" fill="#f8fafc" font-family="sans-serif" font-size="12" font-weight="600" text-anchor="middle">${room.name}</text>`;
                        }
                    }
                });
            }

            // 5. Draw general text labels
            if (data.labels && data.labels.length > 0) {
                data.labels.forEach((label: any) => {
                    if (label.text) {
                        const textLower = label.text.toLowerCase();
                        const isEquipment = 
                            textLower.includes('rtu') || 
                            textLower.includes('cu') || 
                            textLower.includes('ef') || 
                            textLower.includes('hvac') || 
                            textLower.includes('ac') || 
                            textLower.includes('tstat') || 
                            textLower.includes('t-stat') || 
                            textLower.includes('condenser') || 
                            textLower.includes('fan') || 
                            textLower.includes('exhaust') || 
                            textLower.includes('unit') || 
                            textLower.includes('system') || 
                            textLower.includes('compressor');

                        if (!isEquipment) {
                            svgContent += `\n  <text x="${scaleX(label.x)}" y="${scaleY(label.y)}" fill="#94a3b8" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">${label.text}</text>`;
                        }
                    }
                });
            }

            // 6. Draw doors
            if (data.doors && data.doors.length > 0) {
                data.doors.forEach((door: any) => {
                    const x = scaleX(door.x);
                    const y = scaleY(door.y);
                    let path = '';
                    if (door.direction === 'N') {
                        path = `M ${x} ${y} A 20 20 0 0 1 ${x + 20} ${y - 20}`;
                    } else if (door.direction === 'S') {
                        path = `M ${x} ${y} A 20 20 0 0 0 ${x + 20} ${y + 20}`;
                    } else if (door.direction === 'E') {
                        path = `M ${x} ${y} A 20 20 0 0 1 ${x + 20} ${y + 20}`;
                    } else {
                        path = `M ${x} ${y} A 20 20 0 0 0 ${x - 20} ${y + 20}`;
                    }
                    svgContent += `\n  <path d="${path}" fill="none" stroke="#0ea5e9" stroke-width="2" />`;
                });
            }



            // 8. Add Compass North Arrow if this is a rooftop layout
            let compassElement = '';
            if (isRooftop) {
                compassElement = `
  <!-- Compass North Arrow in top right -->
  <g transform="translate(730, 70)">
    <circle cx="0" cy="0" r="22" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
    <polygon points="0,-18 5,4 0,0 -5,4" fill="#0ea5e9" stroke="#0ea5e9" stroke-width="1" />
    <text x="0" y="-24" fill="#38bdf8" font-family="sans-serif" font-size="10" font-weight="black" text-anchor="middle">N</text>
  </g>`;
            }

            const customerNameEscaped = (customer?.name || "Client").replace(/[&<>"']/g, "");
            const locationNameEscaped = (location?.name || location?.propertyName || "Site").replace(/[&<>"']/g, "");

            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <!-- Background Slate -->
  <rect width="800" height="600" fill="#0f172a" />
  
  <!-- Subtle Blueprint Grid Pattern -->
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="0.5" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
  ${svgContent}
  ${compassElement}
  
  <!-- Blueprint Frame Border -->
  <rect x="15" y="15" width="770" height="570" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 4" opacity="0.3" />
  <rect x="20" y="20" width="760" height="560" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.3" />

  <!-- Blueprint Title Block in bottom-right corner -->
  <g transform="translate(540, 480)">
    <rect width="200" height="60" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
    <line x1="0" y1="20" x2="200" y2="20" stroke="#38bdf8" stroke-width="1"/>
    <line x1="0" y1="40" x2="200" y2="40" stroke="#38bdf8" stroke-width="1"/>
    <text x="10" y="15" font-family="sans-serif" font-size="9" font-weight="bold" fill="#38bdf8">CLIENT: ${customerNameEscaped}</text>
    <text x="10" y="35" font-family="sans-serif" font-size="9" fill="#06b6d4">SITE: ${locationNameEscaped}</text>
    <text x="10" y="53" font-family="sans-serif" font-size="8" fill="#64748b">TekTrakker AI Draftsman - 2D Vector</text>
  </g>
</svg>`;
        } catch (err) {
            console.error("Failed to parse AI JSON layout:", err);
            return generateFallbackBlueprint();
        }
    };

    // AI Floor Plan Professional Enhancement
    const runAIEnhancement = async () => {
        if (!layoutPhotoUrl) return;
        
        // Save backup for undo revert
        setPreviousLayout({
            svg: layoutProfessionalSvg,
            hotspots: hotspots,
            vertices: layoutVertices,
            customShapes: customShapes
        });

        setIsEnhancing(true);

        try {
            // Check if we are in demo mode
            if (state.isDemoMode) {
                // Wait for a second to simulate processing
                await new Promise(resolve => setTimeout(resolve, 1500));
                const mockSvg = generateFallbackBlueprint();
                
                setLayoutProfessionalSvg(mockSvg);

                await saveLocationData({
                    layoutProfessionalSvg: mockSvg,
                    layoutHotspots: hotspots // Preserve existing hotspots!
                });

                showToast.success("AI successfully drafted professional architectural floor plan!");
                return;
            }

            // Normal Cloud Function mode
            const response = await fetch(layoutPhotoUrl);
            const blob = await response.blob();
            const base64Image = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(blob);
            });

            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI', { timeout: 300000 });

            const isRooftop = 
                location?.name?.toLowerCase().includes('roof') || 
                location?.propertyName?.toLowerCase().includes('roof') || 
                (aiInstructions && aiInstructions.toLowerCase().includes('roof'));

            const prompt = isRooftop 
            ? `Analyze this hand-drawn or crude rooftop equipment layout diagram. Draft a clean, detailed, professional 2D architectural schematic roof plan.
            
            ${aiInstructions ? `USER DRAFTING HINTS: ${aiInstructions}` : ''}
            
            Instead of generating raw SVG code directly, you must return a single JSON object describing the layout structures and boundaries. This makes drafting 100% precise and prevents syntax errors.
            
            DETAILED ARCHITECTURAL DRAWING REQUIREMENTS:
            1. **Outer Boundary (perimeter)**: Identify the outer perimeter walls/edges of the roof exactly as drawn. Return them as a list of connected vertices in sequential order.
            2. **Inner Walls & Parapets (partitions)**: Identify any interior roof dividers, parapet walls, or level changes. Return them as arrays of connected wall lines.
            3. **Mounting Pads & HVAC Units**: Represent any equipment beds, mounting pads, condenser banks, or large structural sections as clean rectangular shapes (mountingPads).
            4. **Labels**: Identify any section names or readable notes on the roof (like the "N" north arrow marker) and place them as custom labels.
            
            JSON schema output format:
            {
               "perimeter": [
                  { "x": percentage_x, "y": percentage_y }
               ],
               "partitions": [
                  [ { "x": x1, "y": y1 }, { "x": x2, "y": y2 } ]
               ],
               "mountingPads": [
                  { "x": pad_x, "y": pad_y, "w": pad_width, "h": pad_height }
               ],
               "labels": [
                  { "text": "Section/Area Name", "x": x, "y": y }
               ]
            }
            
            Rules:
            - Coordinate values (x, y, w, h) must be percentages from 0.0 to 100.0 relative to the overall layout (where 0,0 is top-left, and 100,100 is bottom-right).
            - Return ONLY the raw JSON block. Do not wrap it in markdown code blocks.
            `
            : `Analyze this hand-drawn or crude floor layout diagram. Draft a clean, detailed, professional 2D architectural schematic floor plan.
            
            ${aiInstructions ? `USER DRAFTING HINTS: ${aiInstructions}` : ''}
            
            Instead of generating raw SVG code directly, you must return a single JSON object describing the layout structures, rooms, and doors. This makes drafting 100% precise and prevents syntax errors.
            
            DETAILED ARCHITECTURAL DRAWING REQUIREMENTS:
            1. **Outer Boundary (perimeter)**: Identify the outer perimeter walls of the building. Return them as a list of connected vertices in sequential order.
            2. **Inner Walls (partitions)**: Identify all inner partition walls, room dividers, hallway walls, and closet boundaries. Return them as arrays of connected wall lines.
            3. **Room Center Labels**: Identify all readable room names (e.g. Lobby, Server Room, Kitchen) and list them with their central coordinates. Do not guess names for unlabeled rooms!
            4. **Doors**: Identify every door opening or swing shown. List its center coordinate and the swing direction (N, S, E, or W).
            
            JSON schema output format:
            {
               "perimeter": [
                  { "x": percentage_x, "y": percentage_y }
               ],
               "partitions": [
                  [ { "x": x1, "y": y1 }, { "x": x2, "y": y2 } ]
               ],
               "rooms": [
                  { "name": "Room Name", "x": center_x, "y": center_y }
               ],
               "doors": [
                  { "x": x, "y": y, "direction": "N|S|E|W" }
               ]
            }
            
            Rules:
            - Coordinate values (x, y) must be percentages from 0.0 to 100.0 relative to the overall layout (where 0,0 is top-left, and 100,100 is bottom-right).
            - Return ONLY the raw JSON block. Do not wrap it in markdown code blocks.
            `;

            const result = await callGeminiAI({
                prompt,
                modelName: "gemini-3.6-flash",
                image: {
                    data: base64Image,
                    mimeType: blob.type || "image/png"
                },
                temperature: 0.1
            });

            const responseData = result.data as { text: string };
            const textContent = responseData.text.trim();
            
            let svgCode = '';
            let rawHotspots: Array<{ label: string; x: number; y: number; id?: string }> = [];

            if (textContent.includes('<svg') || textContent.includes('&lt;svg')) {
                // Parse old SVG format
                const svgMatch = textContent.match(/<svg[\s\S]*<\/svg>/i);
                svgCode = svgMatch ? svgMatch[0] : '';

                if (!svgCode) {
                    throw new Error("AI response did not contain a valid SVG floor plan.");
                }

                // Remove any SVG text elements containing watermarks, reviews, financing, or social media links
                svgCode = svgCode.replace(/<text[^>]*>[\s\S]*?(acorn|finance|financing|review|follow|social|facebook|instagram|twitter|linkedin|youtube|google|feedback|rate us|how did we do|website|call us|phone|email)[\s\S]*?<\/text>/gi, '');

                const hotspotsMatch = textContent.match(/<hotspots>([\s\S]*?)<\/hotspots>/i);
                if (hotspotsMatch) {
                    try {
                        const cleanedJson = hotspotsMatch[1].trim().replace(/```json|```/g, '').trim();
                        rawHotspots = JSON.parse(cleanedJson);
                    } catch (parseErr) {
                        console.warn("Failed to parse hotspots JSON, using regex fallback:", parseErr);
                        const hotspotRegex = /\{\s*"label"\s*:\s*"([^"]+)"\s*,\s*"x"\s*:\s*([\d.]+)\s*,\s*"y"\s*:\s*([\d.]+)\s*\}/g;
                        let match;
                        while ((match = hotspotRegex.exec(hotspotsMatch[1])) !== null) {
                            rawHotspots.push({
                                label: match[1],
                                x: parseFloat(match[2]),
                                y: parseFloat(match[3])
                            });
                        }
                    }
                }
            } else {
                // Parse new structured JSON format
                try {
                    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsedData = JSON.parse(jsonMatch[0]);
                        rawHotspots = parsedData.hotspots || [];
                        svgCode = compileSvgFromLayoutJson(jsonMatch[0]);
                    } else {
                        throw new Error("No JSON layout structure found in response.");
                    }
                } catch (err) {
                    console.error("Failed to parse AI JSON layout, falling back to SVG extract:", err);
                    const svgMatch = textContent.match(/<svg[\s\S]*<\/svg>/i);
                    svgCode = svgMatch ? svgMatch[0] : '';
                    if (!svgCode) {
                        throw new Error("AI response did not contain a valid layout format.");
                    }
                }
            }

            const sanitized = sanitizeSvgContent(svgCode);
            setLayoutProfessionalSvg(sanitized);

            await saveLocationData({
                layoutProfessionalSvg: sanitized,
                layoutHotspots: hotspots // Keep existing hotspots exactly as they were!
            });

            showToast.success("AI successfully drafted professional architectural floor plan!");
        } catch (err) {
            console.error("AI Floor Plan Generation Failed:", err);
            
            // Fallback to local blueprint instead of erroring out
            showToast.warn("AI generation failed. Loading clean drafted fallback layout...");
            const fallbackSvg = generateFallbackBlueprint();
            setLayoutProfessionalSvg(fallbackSvg);
            
            await saveLocationData({
                layoutProfessionalSvg: fallbackSvg,
                layoutHotspots: hotspots // Preserve existing hotspots!
            });
        } finally {
            setIsEnhancing(false);
        }
    };

    // Double-click/click viewport to add a hotspot marker (Admin only)
    const handleViewportClick = async (e: React.MouseEvent<HTMLDivElement>) => {
        if (isTechView || !viewportRef.current) return;
        
        // Ignore if we just finished dragging a shape/hotspot
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            return;
        }

        // Prevent click if we clicked an existing hotspot, shape, handles, or details panel
        const target = e.target as HTMLElement;
        if (
            target.closest('.hotspot-marker') || 
            target.closest('.hotspot-popover') || 
            target.closest('.vertex-node') ||
            target.closest('[class*="cursor-grab"]') ||
            target.closest('[class*="cursor-grabbing"]') ||
            target.closest('[class*="cursor-se-resize"]')
        ) {
            return;
        }

        // In view mode, require double-click (e.detail >= 2) to place a pin. Single clicks deselect active highlights.
        if (editorMode === 'view' && e.detail < 2) {
            setActiveHotspotId(null);
            setActiveShapeId(null);
            return;
        }

        const { x, y } = getUntransformedPercentage(e.clientX, e.clientY);

        if (editorMode === 'edit-perimeter') {
            const newVertex = {
                id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                x,
                y
            };
            const updated = [...layoutVertices, newVertex];
            setLayoutVertices(updated);
            setLayoutProfessionalSvg(compileSvgFromVertices(updated));
            saveLocationData({
                layoutVertices: updated,
                layoutProfessionalSvg: compileSvgFromVertices(updated)
            });
            showToast.success("Added new boundary corner");
            return;
        }

        const unplacedAssets = locationAssets.filter(a => !hotspots.some(hp => hp.equipmentId === a.id));

        if (unplacedAssets.length === 0) {
            showToast.info("All registered equipment assets have already been placed. Add new equipment in the main Equipment tab first.");
            return;
        }

        const assetToPlace = unplacedAssets[0];
        const newHp: LayoutHotspot = {
            id: `hp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            equipmentId: assetToPlace.id,
            label: assetToPlace.name || `${assetToPlace.brand} ${assetToPlace.type}`,
            x: x,
            y: y,
            isManual: true
        };

        const updated = [...hotspots, newHp];
        setHotspots(updated);
        setActiveHotspotId(newHp.id);
        setShowMappingPanel(true);
        saveLocationData({ layoutHotspots: updated });
        showToast.success(`Placed "${newHp.label}" at clicked location`);
    };

    // Hotspot Drag and Drop (Admin only)
    const handleHotspotMouseDown = (e: React.MouseEvent, id: string) => {
        if (!viewportRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        
        setActiveHotspotId(id);
        setShowMappingPanel(true);

        if (isTechView) return; // Techs can view details but cannot drag
        
        isDraggingRef.current = false;
        setDraggingId(id);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!viewportRef.current) return;
            isDraggingRef.current = true;
            const { x, y } = getUntransformedPercentage(moveEvent.clientX, moveEvent.clientY);
            setHotspots(prev => prev.map(hp => hp.id === id ? { ...hp, x, y, isManual: true } : hp));
        };

        const handleMouseUp = () => {
            setDraggingId(null);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Persist the coordinates
            setHotspots(currentHotspots => {
                const updated = currentHotspots.map(hp => hp.id === id ? { ...hp, isManual: true } : hp);
                saveLocationData({ layoutHotspots: updated });
                return updated;
            });
            
            setTimeout(() => {
                isDraggingRef.current = false;
            }, 50);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleAssignAsset = async (hotspotId: string, assetId: string) => {
        const matchedAsset = locationAssets.find(a => a.id === assetId);
        const updated = hotspots.map(hp => {
            if (hp.id === hotspotId) {
                return {
                    ...hp,
                    equipmentId: assetId || undefined,
                    label: matchedAsset ? (matchedAsset.name || `${matchedAsset.brand} ${matchedAsset.type}`) : hp.label,
                    isManual: true
                };
            }
            return hp;
        });

        setHotspots(updated);
        await saveLocationData({ layoutHotspots: updated });
        showToast.success("Equipment mapped to hotspot");
    };

    const handleDeleteHotspot = async (hotspotId: string) => {
        const updated = hotspots.filter(hp => hp.id !== hotspotId);
        setHotspots(updated);
        setActiveHotspotId(null);
        setShowMappingPanel(false);
        await saveLocationData({ layoutHotspots: updated });
        showToast.success("Marker pin removed from map");
    };

    const handleDeleteAsset = async (assetId: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this equipment asset from the customer database? This action cannot be undone.")) return;

        const updatedHotspots = hotspots.filter(hp => hp.equipmentId !== assetId);
        setHotspots(updatedHotspots);
        await saveLocationData({ layoutHotspots: updatedHotspots });

        const updatedEquipment = (customer.equipment || []).filter(eq => eq.id !== assetId);
        await saveCustomerEquipment(updatedEquipment);

        showToast.success("Equipment asset permanently deleted");
    };

    const activeHotspot = hotspots.find(hp => hp.id === activeHotspotId);
    const mappedAsset = customer.equipment?.find(e => e.id === activeHotspot?.equipmentId);

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Location Details: ${location.propertyName || location.name}`} 
            size="xl"
            zIndex="z-[260]"
        >
            <div className="flex flex-col h-full space-y-4">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                    <button 
                        onClick={() => setActiveTab('photos')} 
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'photos' 
                                ? 'bg-white dark:bg-slate-700 text-primary-650 dark:text-primary-400 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'
                        }`}
                    >
                        <Image size={16} /> Location Photos ({photos.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('layout')} 
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'layout' 
                                ? 'bg-white dark:bg-slate-700 text-primary-650 dark:text-primary-400 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'
                        }`}
                    >
                        <MapPin size={16} /> Floor Plan / Layout
                    </button>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pb-2">
                    
                    {/* 1. PHOTOS TAB */}
                    {activeTab === 'photos' && (
                        <div 
                            onDragEnter={handleDragPhotos}
                            onDragOver={handleDragPhotos}
                            onDragLeave={handleDragPhotos}
                            onDrop={handleDropPhotos}
                            className="space-y-4 relative min-h-[300px]"
                        >
                            {dragActivePhotos && (
                                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-indigo-500 rounded-2xl p-6 text-center animate-fade-in">
                                    <div className="p-4 bg-indigo-500/10 rounded-full border border-indigo-500/30 mb-3 animate-bounce">
                                        <Upload className="w-10 h-10 text-indigo-500" />
                                    </div>
                                    <p className="text-sm font-bold text-white uppercase tracking-wider">Drop photos here to upload</p>
                                    <p className="text-xs text-slate-400 mt-1">Supports multiple image files</p>
                                </div>
                            )}
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Property Verification Photos</h4>
                                    <p className="text-xs text-slate-550 mt-0.5">Upload photos of building facades, entrance gates, key lockboxes, or access points.</p>
                                </div>
                                
                                <div className="flex gap-2">
                                    <input 
                                        id="location-photo-file" 
                                        type="file" 
                                        multiple 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handlePhotoUpload} 
                                        disabled={isUploading}
                                    />
                                    <input 
                                        id="native-file-upload" 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handlePhotoUpload} 
                                    />
                                    
                                    <Button 
                                        onClick={triggerNativeCamera} 
                                        className="text-xs py-1.5 px-3 bg-indigo-600 text-white flex items-center gap-1.5"
                                        disabled={isUploading}
                                    >
                                        <Camera size={14} /> Camera
                                    </Button>
                                    
                                    <Button 
                                        onClick={() => document.getElementById('location-photo-file')?.click()} 
                                        variant="outline" 
                                        className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                                        disabled={isUploading}
                                    >
                                        <Upload size={14} /> Upload
                                    </Button>
                                </div>
                            </div>

                            {isUploading && (
                                <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/20 border border-dashed border-slate-350 dark:border-slate-750 rounded-2xl">
                                    <div className="text-center space-y-2">
                                        <Spinner size="lg" />
                                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Uploading photos to storage...</p>
                                    </div>
                                </div>
                            )}

                            {photos.length === 0 ? (
                                <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                    <Image size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-350">No photos uploaded for this location yet</p>
                                    <p className="text-xs text-slate-450 mt-1">Use the Camera or Upload buttons to add visual references for dispatch techs.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in">
                                    {photos.map((url, idx) => (
                                        <div key={idx} className="group relative aspect-square rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                            <img src={url} alt={`Location ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            
                                            {/* Preview Overlay */}
                                            <a 
                                                href={url} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="View Fullsize"
                                            >
                                                <Eye className="text-white" size={24} />
                                            </a>

                                            {/* Delete Button */}
                                            <button 
                                                onClick={() => handleDeletePhoto(idx)} 
                                                className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                title="Delete Photo"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. FLOOR PLAN / LAYOUT TAB */}
                    {activeTab === 'layout' && (
                        <div 
                            onDragEnter={handleDragLayout}
                            onDragOver={handleDragLayout}
                            onDragLeave={handleDragLayout}
                            onDrop={handleDropLayout}
                            className="space-y-4 relative min-h-[300px]"
                        >
                            {dragActiveLayout && (
                                <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-indigo-500 rounded-2xl p-6 text-center animate-fade-in">
                                    <div className="p-4 bg-indigo-500/10 rounded-full border border-indigo-500/30 mb-3 animate-bounce">
                                        <Upload className="w-10 h-10 text-indigo-500" />
                                    </div>
                                    <p className="text-sm font-bold text-white uppercase tracking-wider">Drop blueprint / sketch here to upload</p>
                                    <p className="text-xs text-slate-400 mt-1">Supports image file layouts</p>
                                </div>
                            )}
                            {/* Layout upload / sketcher initialization options */}
                            {!layoutPhotoUrl && !layoutProfessionalSvg && layoutVertices.length === 0 && editorMode !== 'gps-record' && (
                                <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-6">
                                    <div className="max-w-md mx-auto text-center">
                                        <Upload size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                                        <h5 className="text-base font-bold text-slate-850 dark:text-slate-250">Create Floor Plan or Rooftop Layout</h5>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Choose an option below to create a professional vector blueprint layout where you can map equipment hotspots.
                                        </p>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto pt-2">
                                        {/* Option 1: Sketch Upload */}
                                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between items-center text-center shadow-sm">
                                            <div className="space-y-1 mb-4">
                                                <p className="font-bold text-xs text-slate-850 dark:text-slate-200">Upload Drawing</p>
                                                <p className="text-[10px] text-slate-500 leading-normal">Upload a hand-drawn sketch or fire escape map to enhance via AI.</p>
                                            </div>
                                            <input 
                                                id="layout-file-upload" 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={handleLayoutUpload} 
                                            />
                                            <Button 
                                                onClick={() => document.getElementById('layout-file-upload')?.click()}
                                                className="w-full text-xs py-1.5"
                                            >
                                                Upload Sketch
                                            </Button>
                                        </div>

                                        {/* Option 2: Tap-to-Draw Sketcher */}
                                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between items-center text-center shadow-sm">
                                            <div className="space-y-1 mb-4">
                                                <p className="font-bold text-xs text-slate-850 dark:text-slate-200">Room Sketcher</p>
                                                <p className="text-[10px] text-slate-500 leading-normal">Draw a custom perimeter by clicking corners on a grid canvas.</p>
                                            </div>
                                            <Button 
                                                onClick={() => {
                                                    const defaultVertices = [
                                                        { id: `v-${Date.now()}-1`, x: 25, y: 25 },
                                                        { id: `v-${Date.now()}-2`, x: 75, y: 25 },
                                                        { id: `v-${Date.now()}-3`, x: 75, y: 75 },
                                                        { id: `v-${Date.now()}-4`, x: 25, y: 75 }
                                                    ];
                                                    setLayoutVertices(defaultVertices);
                                                    setEditorMode('edit-perimeter');
                                                    const svg = compileSvgFromVertices(defaultVertices);
                                                    setLayoutProfessionalSvg(svg);
                                                    saveLocationData({
                                                        layoutVertices: defaultVertices,
                                                        layoutProfessionalSvg: svg
                                                    });
                                                }}
                                                className="w-full text-xs py-1.5 bg-emerald-600 hover:bg-emerald-750 hover:text-white text-white"
                                            >
                                                Start Sketching
                                            </Button>
                                        </div>

                                        {/* Option 3: GPS Walk & Draw */}
                                        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between items-center text-center shadow-sm">
                                            <div className="space-y-1 mb-4">
                                                <p className="font-bold text-xs text-slate-850 dark:text-slate-200">GPS Roof Walk</p>
                                                <p className="text-[10px] text-slate-500 leading-normal">Walk the boundary of the roof/yard and record corners via GPS.</p>
                                            </div>
                                            <Button 
                                                onClick={() => {
                                                    setEditorMode('gps-record');
                                                    setGpsPoints([]);
                                                    setGpsAccuracy(null);
                                                }}
                                                className="w-full text-xs py-1.5 bg-indigo-650 hover:bg-indigo-700 hover:text-white text-white"
                                            >
                                                Start GPS Walk
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* GPS Walk & Draw Interface */}
                            {editorMode === 'gps-record' && (
                                <div className="p-6 bg-slate-950 text-white rounded-2xl border border-slate-800 flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
                                    <div className="space-y-2">
                                        <h5 className="text-base font-bold text-emerald-450">GPS Walk & Draw Mapper</h5>
                                        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                                            Walk along the perimeter of the rooftop or outdoor yard. At each corner point, stop and capture the coordinate. The app will automatically connect the points into a blueprint boundary.
                                        </p>
                                    </div>

                                    {/* Real-time Status / Accuracy */}
                                    <div className="flex flex-col items-center p-4 bg-slate-900 border border-slate-800 rounded-xl min-w-[280px]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-2.5 h-2.5 rounded-full ${gpsLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">GPS Receiver Status</span>
                                        </div>
                                        {gpsAccuracy !== null ? (
                                            <p className="text-xs font-mono">
                                                Accuracy: <span className={gpsAccuracy <= 6 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>±{Math.round(gpsAccuracy * 3.28084)} ft ({Math.round(gpsAccuracy)}m)</span>
                                            </p>
                                        ) : (
                                            <p className="text-xs text-slate-500 italic">Detecting satellites...</p>
                                        )}
                                    </div>

                                    {/* Capture Corners List */}
                                    {gpsPoints.length > 0 && (
                                        <div className="w-full max-w-sm">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left mb-2">Captured Corners ({gpsPoints.length})</p>
                                            <div className="max-h-36 overflow-y-auto border border-slate-900 bg-slate-900/50 rounded-lg p-2 space-y-1 custom-scrollbar text-xs font-mono text-left">
                                                {gpsPoints.map((pt, idx) => (
                                                    <div key={pt.id} className="flex justify-between items-center p-1.5 bg-slate-900/80 rounded border border-slate-850">
                                                        <span>Corner {idx + 1}: {pt.latitude.toFixed(6)}, {pt.longitude.toFixed(6)}</span>
                                                        <button 
                                                            onClick={() => setGpsPoints(prev => prev.filter(p => p.id !== pt.id))}
                                                            className="text-red-400 hover:text-red-300 font-bold px-1"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Control Buttons */}
                                    <div className="flex flex-wrap gap-3 justify-center pt-2">
                                        <Button 
                                            onClick={async () => {
                                                setGpsLoading(true);
                                                try {
                                                    const pos = await new Promise<any>((resolve, reject) => {
                                                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                                                            enableHighAccuracy: true,
                                                            timeout: 10000,
                                                            maximumAge: 0
                                                        });
                                                    });
                                                    setGpsAccuracy(pos.coords.accuracy);
                                                    const newPt = {
                                                        id: `gps-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                                        latitude: pos.coords.latitude,
                                                        longitude: pos.coords.longitude
                                                    };
                                                    setGpsPoints(prev => [...prev, newPt]);
                                                    showToast.success(`Captured Corner ${gpsPoints.length + 1}!`);
                                                } catch (err: any) {
                                                    console.error("GPS capture failed:", err);
                                                    showToast.error("Failed to get high-accuracy GPS position. Try again.");
                                                } finally {
                                                    setGpsLoading(false);
                                                }
                                            }}
                                            disabled={gpsLoading}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                                        >
                                            {gpsLoading ? <RefreshCw size={14} className="animate-spin" /> : <MapPin size={14} />} Capture Corner GPS
                                        </Button>

                                        {gpsPoints.length >= 3 && (
                                            <Button 
                                                onClick={async () => {
                                                    const lats = gpsPoints.map(p => p.latitude);
                                                    const lngs = gpsPoints.map(p => p.longitude);
                                                    const minLat = Math.min(...lats);
                                                    const maxLat = Math.max(...lats);
                                                    const minLng = Math.min(...lngs);
                                                    const maxLng = Math.max(...lngs);
                                                    
                                                    const latRange = maxLat - minLat || 0.00001;
                                                    const lngRange = maxLng - minLng || 0.00001;

                                                    const projected = gpsPoints.map((pt) => {
                                                        const xPct = ((pt.longitude - minLng) / lngRange) * 70 + 15;
                                                        const yPct = ((maxLat - pt.latitude) / latRange) * 70 + 15;
                                                        return {
                                                            id: pt.id,
                                                            x: Math.round(xPct * 10) / 10,
                                                            y: Math.round(yPct * 10) / 10
                                                        };
                                                    });

                                                    setLayoutVertices(projected);
                                                    const svg = compileSvgFromVertices(projected);
                                                    setLayoutProfessionalSvg(svg);
                                                    setEditorMode('edit-perimeter');
                                                    
                                                    await saveLocationData({
                                                        layoutVertices: projected,
                                                        layoutProfessionalSvg: svg
                                                    });
                                                    showToast.success("GPS path successfully mapped! Adjust corners below if needed.");
                                                }}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                            >
                                                Finish & Map Path
                                            </Button>
                                        )}

                                        <Button 
                                            onClick={() => {
                                                setEditorMode('view');
                                                setGpsPoints([]);
                                            }}
                                            variant="secondary"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Layout processing and interactive editor */}
                            {(layoutPhotoUrl || layoutProfessionalSvg || layoutVertices.length > 0) && editorMode !== 'gps-record' && (
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[65vh] min-h-[450px]">
                                    
                                    {/* Sidebar: Details & Mappings */}
                                    <div className="lg:col-span-1 bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-y-auto custom-scrollbar flex flex-col justify-between">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                                                <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 font-mono tracking-tight">Layout Editor</h5>
                                                {!isTechView && (
                                                    <div className="flex gap-2 items-center">
                                                        {previousLayout && (
                                                            <button onClick={handleUndoLayout} className="text-amber-500 hover:text-amber-700 text-xs flex items-center gap-1 font-semibold">
                                                                <Undo2 size={12} /> Undo AI
                                                            </button>
                                                        )}
                                                        <button onClick={handleDeleteLayout} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-semibold">
                                                            <Trash2 size={12} /> Clear layout
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Mode Selectors (Admin only - only for manual room sketch or GPS walk, not photo uploads) */}
                                            {!isTechView && !layoutPhotoUrl && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Editor Mode</p>
                                                    <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                                        <button 
                                                            onClick={() => setEditorMode('view')}
                                                            className={`text-[10px] font-bold py-1.5 px-2 rounded-lg transition-all ${
                                                                editorMode === 'view'
                                                                    ? 'bg-white dark:bg-slate-800 text-slate-850 dark:text-white shadow-sm'
                                                                    : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                        >
                                                            Place Pins
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                // Initialize default vertices if none exist
                                                                if (layoutVertices.length === 0) {
                                                                    const defaultVertices = [
                                                                        { id: `v-${Date.now()}-1`, x: 25, y: 25 },
                                                                        { id: `v-${Date.now()}-2`, x: 75, y: 25 },
                                                                        { id: `v-${Date.now()}-3`, x: 75, y: 75 },
                                                                        { id: `v-${Date.now()}-4`, x: 25, y: 75 }
                                                                    ];
                                                                    setLayoutVertices(defaultVertices);
                                                                    const svg = compileSvgFromVertices(defaultVertices);
                                                                    setLayoutProfessionalSvg(svg);
                                                                    saveLocationData({
                                                                        layoutVertices: defaultVertices,
                                                                        layoutProfessionalSvg: svg
                                                                    });
                                                                }
                                                                setEditorMode('edit-perimeter');
                                                            }}
                                                            className={`text-[10px] font-bold py-1.5 px-2 rounded-lg transition-all ${
                                                                editorMode === 'edit-perimeter'
                                                                    ? 'bg-white dark:bg-slate-800 text-slate-850 dark:text-white shadow-sm'
                                                                    : 'text-slate-500 hover:text-slate-700'
                                                            }`}
                                                        >
                                                            Edit Walls
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Original drawing image preview */}
                                            {layoutPhotoUrl && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Original Drawing</p>
                                                    <div className="h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
                                                        <img src={layoutPhotoUrl} alt="Crude layout" className="w-full h-full object-contain" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* AI Enhance Trigger & Instructions (Only for original sketch photo uploads) */}
                                            {layoutPhotoUrl && (
                                                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Drafting Hints (Optional)</label>
                                                        <textarea
                                                            value={aiInstructions}
                                                            onChange={e => setAiInstructions(e.target.value)}
                                                            placeholder="e.g., 'Draw 4 small rooms on the left side of the hallway and 3 rooms on the right. Highlight a server room at the end.'"
                                                            className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-200 focus:ring-emerald-500 focus:border-emerald-500 resize-none h-16 shadow-inner"
                                                            disabled={isEnhancing}
                                                        />
                                                    </div>
                                                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] leading-normal text-amber-700 dark:text-amber-300">
                                                        <span className="font-black uppercase tracking-wider block mb-0.5 text-amber-600 dark:text-amber-400">💡 Pro Tip</span>
                                                        To move or map equipment pins, simply <span className="font-bold">drag and drop them directly on the blueprint</span>. Do not ask the AI to move them, as re-enhancing will redraw the entire floor plan from scratch.
                                                    </div>
                                                    <Button 
                                                        onClick={runAIEnhancement} 
                                                        disabled={isEnhancing}
                                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 py-2"
                                                    >
                                                        {isEnhancing ? (
                                                            <>
                                                                <RefreshCw size={14} className="animate-spin" /> Drafting Layout...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={14} /> {layoutProfessionalSvg ? "Re-Enhance with AI" : "AI Professional Enhance"}
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Drawing Tools section */}
                                            {layoutProfessionalSvg && editorMode === 'view' && !isTechView && (
                                                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">
                                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                                                        <p className="text-xs font-black uppercase text-indigo-500 tracking-wider">Drawing Tools</p>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <Button variant="outline" onClick={() => handleAddShape('rect')} className="py-1 text-[10px] flex items-center justify-center gap-1 border-slate-300">
                                                            <Square size={10} /> + Box
                                                        </Button>
                                                        <Button variant="outline" onClick={() => handleAddShape('circle')} className="py-1 text-[10px] flex items-center justify-center gap-1 border-slate-300">
                                                            <Circle size={10} /> + Circle
                                                        </Button>
                                                        <Button variant="outline" onClick={() => handleAddShape('line')} className="py-1 text-[10px] flex items-center justify-center gap-1 border-slate-300">
                                                            <Minus size={10} /> + Line
                                                        </Button>
                                                    </div>

                                                    {/* Selected Shape editor UI */}
                                                    {(() => {
                                                        const activeShape = customShapes.find(s => s.id === activeShapeId);
                                                        if (!activeShape) return null;
                                                        return (
                                                            <div className="p-2.5 bg-indigo-50/50 dark:bg-slate-900/50 border border-indigo-100 dark:border-slate-800 rounded-lg space-y-2 mt-2">
                                                                <div className="flex justify-between items-center">
                                                                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 capitalize">Edit Shape ({activeShape.type})</p>
                                                                    <button onClick={() => handleDeleteShape(activeShape.id)} className="text-red-500 hover:text-red-700 text-[10px] font-bold">
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                    <div>
                                                                        <label className="block font-black text-slate-400 uppercase tracking-wide">Width ({Math.round(activeShape.width)}%)</label>
                                                                        <input type="range" min="1" max="50" value={activeShape.width} onChange={e => handleUpdateShape(activeShape.id, { width: parseInt(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg cursor-pointer accent-indigo-650" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block font-black text-slate-400 uppercase tracking-wide">Height ({Math.round(activeShape.height)}%)</label>
                                                                        <input type="range" min="1" max="50" value={activeShape.height} onChange={e => handleUpdateShape(activeShape.id, { height: parseInt(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg cursor-pointer accent-indigo-650" />
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                    <div>
                                                                        <label className="block font-black text-slate-400 uppercase tracking-wide">Rotation ({activeShape.rotation || 0}°)</label>
                                                                        <input type="range" min="0" max="360" value={activeShape.rotation || 0} onChange={e => handleUpdateShape(activeShape.id, { rotation: parseInt(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg cursor-pointer accent-indigo-650" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block font-black text-slate-400 uppercase tracking-wide font-mono">Zone</label>
                                                                        <select
                                                                            value={activeShape.zone || ''}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                if (val === '_new') {
                                                                                    setIsCreatingNewZone(true);
                                                                                    // set active element context
                                                                                } else {
                                                                                    handleUpdateShape(activeShape.id, { zone: val || null });
                                                                                }
                                                                            }}
                                                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] rounded px-1.5 py-0.5 mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                        >
                                                                            <option value="">-- No Zone --</option>
                                                                            {availableZones.map(z => (
                                                                                <option key={z} value={z}>{z}</option>
                                                                            ))}
                                                                            <option value="_new" className="text-indigo-500 font-bold">+ Create Zone...</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block font-black text-slate-400 uppercase tracking-wide">Color</label>
                                                                        <div className="flex gap-1.5 mt-1.5">
                                                                            {['#06b6d4', '#ef4444', '#10b981', '#f59e0b', '#3b82f6'].map(color => (
                                                                                <button 
                                                                                    key={color} 
                                                                                    onClick={() => handleUpdateShape(activeShape.id, { color })}
                                                                                    className={`w-3.5 h-3.5 rounded-full border ${activeShape.color === color ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`}
                                                                                    style={{ backgroundColor: color }}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {/* Equipment Placement Tab/Sidebar section */}
                                            {layoutProfessionalSvg && editorMode === 'view' && (
                                                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">
                                                    <div className="border-b border-slate-150 dark:border-slate-750 pb-2">
                                                        <p className="text-xs font-black uppercase text-indigo-500 tracking-wider">Equipment Placements</p>
                                                    </div>
                                                    
                                                    {/* Unplaced Assets */}
                                                    <div className="space-y-1.5">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unplaced ({locationAssets.filter(a => !hotspots.some(hp => hp.equipmentId === a.id)).length})</p>
                                                        <div className="max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5">
                                                            {locationAssets.filter(a => !hotspots.some(hp => hp.equipmentId === a.id)).map(asset => (
                                                                <div key={asset.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px] leading-tight shadow-sm">
                                                                    <div className="truncate flex-1 pr-2">
                                                                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{asset.name || `${asset.brand} ${asset.type}`}</p>
                                                                        <p className="text-[9px] text-slate-400 truncate">{asset.type} • S/N: {asset.serial || 'N/A'}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <button
                                                                            onClick={() => {
                                                                                const newHp: LayoutHotspot = {
                                                                                    id: `hp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                                                                    equipmentId: asset.id,
                                                                                    label: asset.name || `${asset.brand} ${asset.type}`,
                                                                                    x: 50,
                                                                                    y: 50,
                                                                                    isManual: true
                                                                                };
                                                                                const updated = [...hotspots, newHp];
                                                                                setHotspots(updated);
                                                                                setActiveHotspotId(newHp.id);
                                                                                setShowMappingPanel(true);
                                                                                saveLocationData({ layoutHotspots: updated });
                                                                                showToast.success(`Placed "${newHp.label}" at the center. Drag it into position!`);
                                                                            }}
                                                                            className="py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors shadow-sm"
                                                                        >
                                                                            + Place Pin
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteAsset(asset.id)}
                                                                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded cursor-pointer transition-colors"
                                                                            title="Permanently Delete Asset"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {locationAssets.filter(a => !hotspots.some(hp => hp.equipmentId === a.id)).length === 0 && (
                                                                <p className="text-[10px] text-slate-400 italic text-center py-2">All equipment placed!</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Placed Assets */}
                                                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Placed ({locationAssets.filter(a => hotspots.some(hp => hp.equipmentId === a.id)).length})</p>
                                                        <div className="max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5">
                                                            {locationAssets.filter(a => hotspots.some(hp => hp.equipmentId === a.id)).map(asset => {
                                                                const hp = hotspots.find(h => h.equipmentId === asset.id);
                                                                return (
                                                                    <div key={asset.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px] leading-tight shadow-sm">
                                                                        <div className="truncate flex-1 pr-2">
                                                                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{asset.name || `${asset.brand} ${asset.type}`}</p>
                                                                            <p className="text-[9px] text-slate-400 truncate">Coords: {hp ? `${Math.round(hp.x)}%, ${Math.round(hp.y)}%` : 'N/A'}</p>
                                                                        </div>
                                                                        <div className="flex gap-1 items-center">
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (hp) {
                                                                                        setActiveHotspotId(hp.id);
                                                                                        setShowMappingPanel(true);
                                                                                    }
                                                                                }}
                                                                                className="py-1 px-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded text-[9px] font-bold cursor-pointer transition-colors"
                                                                            >
                                                                                Locate
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (hp) handleDeleteHotspot(hp.id);
                                                                                }}
                                                                                className="py-1 px-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-[9px] font-bold cursor-pointer transition-colors"
                                                                            >
                                                                                Remove Pin
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteAsset(asset.id)}
                                                                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded cursor-pointer transition-colors"
                                                                                title="Permanently Delete Asset"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {locationAssets.filter(a => hotspots.some(hp => hp.equipmentId === a.id)).length === 0 && (
                                                                <p className="text-[10px] text-slate-400 italic text-center py-2">No equipment placed yet.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Hotspot details/mapping panel */}
                                            {layoutProfessionalSvg && showMappingPanel && activeHotspot && editorMode === 'view' && (
                                                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 animate-fade-in shadow-sm">
                                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                                                        <p className="text-xs font-black uppercase text-indigo-500 tracking-wider">Hotspot Settings</p>
                                                        <button onClick={() => setShowMappingPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                                                    </div>

                                                    <Input 
                                                        label="Marker Label"
                                                        value={activeHotspot.label}
                                                        disabled={isTechView}
                                                        onChange={e => {
                                                            const updated = hotspots.map(hp => hp.id === activeHotspot.id ? { ...hp, label: e.target.value } : hp);
                                                            setHotspots(updated);
                                                            saveLocationData({ layoutHotspots: updated });
                                                            
                                                            if (activeHotspot.equipmentId) {
                                                                const updatedEq = (customer.equipment || []).map(eq => 
                                                                    eq.id === activeHotspot.equipmentId ? { ...eq, name: e.target.value } : eq
                                                                );
                                                                saveCustomerEquipment(updatedEq);
                                                            }
                                                        }}
                                                    />

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Equipment</label>
                                                        {isTechView ? (
                                                            <div className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100">
                                                                {mappedAsset ? `${mappedAsset.brand} ${mappedAsset.type} (S/N: ${mappedAsset.serial})` : "Unassigned / General Location"}
                                                            </div>
                                                        ) : (
                                                            <Select
                                                                value={activeHotspot.equipmentId || ''}
                                                                onChange={e => handleAssignAsset(activeHotspot.id, e.target.value)}
                                                            >
                                                                <option value="">-- Unassigned --</option>
                                                                {locationAssets.map(asset => (
                                                                    <option key={asset.id} value={asset.id}>
                                                                        {asset.name ? `${asset.name} (${asset.brand} ${asset.type})` : `${asset.brand} ${asset.type} (S/N: ${asset.serial || 'N/A'})`}
                                                                    </option>
                                                                ))}
                                                            </Select>
                                                        )}
                                                    </div>

                                                    {mappedAsset && (
                                                         <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-xs space-y-2">
                                                             <div className="flex justify-between items-center">
                                                                 <span className="font-bold text-slate-700 dark:text-slate-200">System Status</span>
                                                                 <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                                                                     (mappedAsset.status || 'Operational') === 'Operational' 
                                                                         ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                                                         : (mappedAsset.status || 'Operational') === 'Down'
                                                                             ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                                             : (mappedAsset.status || 'Operational') === 'Waiting for Parts'
                                                                                 ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                                                                 : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                                 }`}>
                                                                     {mappedAsset.status || 'Operational'}
                                                                 </span>
                                                             </div>
                                                             
                                                             {!isTechView && (
                                                                 <select 
                                                                     value={mappedAsset.status || 'Operational'}
                                                                     onChange={async (e) => {
                                                                         const val = e.target.value;
                                                                         const updatedEq = (customer.equipment || []).map(eq => 
                                                                             eq.id === mappedAsset.id ? { ...eq, status: val } : eq
                                                                         );
                                                                         await saveCustomerEquipment(updatedEq);
                                                                     }}
                                                                     className="w-full bg-white dark:bg-slate-850 text-[10px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                 >
                                                                     <option value="Operational">Operational</option>
                                                                     <option value="Down">Down</option>
                                                                     <option value="Waiting for Parts">Waiting for Parts</option>
                                                                     <option value="Blower Motor Burnt Out">Blower Motor Burnt Out</option>
                                                                 </select>
                                                             )}
                                                             
                                                             <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                                                                 <p><span className="font-medium text-slate-400">Brand:</span> {mappedAsset.brand || 'N/A'}</p>
                                                                 <p><span className="font-medium text-slate-400">Model:</span> {mappedAsset.model || 'N/A'}</p>
                                                                 <p><span className="font-medium text-slate-400">Serial:</span> {mappedAsset.serial || 'N/A'}</p>
                                                             </div>
                                                         </div>
                                                     )}

                                                    {mappedAsset && onSelectEquipment && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectEquipment(mappedAsset)}
                                                            className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/20 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all border border-indigo-200/50 flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                                                        >
                                                            Edit Asset (Opens Modal)
                                                        </button>
                                                    )}

                                                    {!isTechView && activeHotspot.equipmentId && (
                                                         <div className="space-y-1 mt-1 pb-1">
                                                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assign to Zone</label>
                                                             <select
                                                                 value={mappedAsset?.zone || ''}
                                                                 onChange={async (e) => {
                                                                     const val = e.target.value;
                                                                     if (val === '_new') {
                                                                         setIsCreatingNewZone(true);
                                                                     } else {
                                                                         const updatedEq = (customer.equipment || []).map(eq => 
                                                                             eq.id === activeHotspot.equipmentId ? { ...eq, zone: val || '' } : eq
                                                                         );
                                                                         await saveCustomerEquipment(updatedEq);
                                                                     }
                                                                 }}
                                                                 className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                             >
                                                                 <option value="">-- No Zone --</option>
                                                                 {availableZones.map(z => (
                                                                     <option key={z} value={z}>{z}</option>
                                                                 ))}
                                                                 <option value="_new" className="text-indigo-500 font-bold">+ Create Zone...</option>
                                                             </select>
                                                         </div>
                                                     )}

                                                     {!isTechView && (
                                                         <button 
                                                             type="button"
                                                             onClick={() => handleDeleteHotspot(activeHotspot.id)}
                                                             className="w-full text-center text-xs font-bold text-red-500 hover:text-red-700 pt-1"
                                                         >
                                                             Remove Marker Pin
                                                         </button>
                                                     )}
                                                </div>
                                            )}

                                            {/* Create New Zone input overlay */}
                                            {isCreatingNewZone && (
                                                <div className="p-3 bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-slate-800 rounded-xl space-y-2 animate-fade-in shadow-inner">
                                                    <div className="flex justify-between items-center pb-1">
                                                        <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Create New Zone</p>
                                                        <button onClick={() => { setIsCreatingNewZone(false); setNewZoneName(''); }} className="text-slate-400 hover:text-slate-600 text-[10px] font-bold">Cancel</button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g. Zone A, RTU Area" 
                                                            value={newZoneName} 
                                                            onChange={e => setNewZoneName(e.target.value)} 
                                                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                                                        />
                                                        <Button 
                                                            variant="primary" 
                                                            className="py-1 px-3 text-[10px]"
                                                            onClick={async () => {
                                                                const trimmed = newZoneName.trim();
                                                                if (!trimmed) return;
                                                                
                                                                // Apply zone to active element
                                                                if (activeShapeId) {
                                                                    handleUpdateShape(activeShapeId, { zone: trimmed });
                                                                } else if (activeHotspot && activeHotspot.equipmentId) {
                                                                    const updatedEq = (customer.equipment || []).map(eq => 
                                                                        eq.id === activeHotspot.equipmentId ? { ...eq, zone: trimmed } : eq
                                                                    );
                                                                    await saveCustomerEquipment(updatedEq);
                                                                }
                                                                
                                                                setIsCreatingNewZone(false);
                                                                setNewZoneName('');
                                                                showToast.success(`Zone "${trimmed}" created`);
                                                            }}
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Static instructions */}
                                            {!showMappingPanel && layoutProfessionalSvg && (
                                                <div className="p-3 bg-slate-100 dark:bg-slate-800/40 rounded-xl text-xs text-slate-550 space-y-2 leading-relaxed border border-slate-200 dark:border-slate-800">
                                                    <p className="font-bold flex items-center gap-1 text-slate-705 dark:text-slate-300"><AlertCircle size={12}/> Interaction Guide</p>
                                                    {editorMode === 'view' ? (
                                                        <>
                                                            <p>• Click any marker pin to view unit mapping and details.</p>
                                                            {!isTechView && (
                                                                <>
                                                                    <p>• Drag markers to reposition them on the floor plan.</p>
                                                                    <p>• Click/Double-click empty space on the plan to place a new hotspot pin.</p>
                                                                </>
                                                            )}
                                                            <p>• Click "Open Unit Modal" inside the marker settings to configure technical specifications.</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="font-semibold text-emerald-600 dark:text-emerald-400">• Wall sketcher mode active.</p>
                                                            <p>• Drag corners (1, 2, 3, etc.) to customize wall shape and fix mistakes.</p>
                                                            <p>• Click/tap empty space on the grid to add new corners.</p>
                                                            <p>• Double-click/tap a corner node number to delete it.</p>
                                                            <Button 
                                                                onClick={() => setEditorMode('view')} 
                                                                className="w-full mt-2 text-xs py-1 bg-emerald-600 text-white hover:bg-emerald-700"
                                                            >
                                                                Save & Exit Walls Editor
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Main Viewport: Professional Layout SVG rendering */}
                                    <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-center relative shadow-inner">
                                        
                                        {/* AI Generating Loader */}
                                        {isEnhancing && (
                                            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-30 flex items-center justify-center">
                                                <div className="text-center space-y-4 max-w-sm">
                                                    <div className="relative w-16 h-16 mx-auto">
                                                        <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
                                                        <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin"></div>
                                                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400" size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-sm">TekTrakker AI Draftsman Active</p>
                                                        <p className="text-xs text-slate-400 mt-1">Analyzing sketch geometry, rectifying walls, aligning grids, and exporting to optimized architectural vector SVG blueprint...</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Floating Control Toolbar */}
                                        {layoutProfessionalSvg && (
                                            <div className="absolute top-3 left-3 right-3 z-30 flex justify-between items-center gap-2 pointer-events-none">
                                                {/* Left side: View Mode & Compare Toggle */}
                                                <div className="flex gap-3 pointer-events-auto bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] font-bold text-white shadow-lg items-center">
                                                    {/* Zone Filtering Selector */}
                                                    <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800">
                                                        <span className="text-slate-400 uppercase tracking-wider text-[9px] font-black">Zone Filter:</span>
                                                        <select
                                                            value={selectedZoneFilter}
                                                            onChange={(e) => setSelectedZoneFilter(e.target.value)}
                                                            className="bg-slate-900 border border-slate-700 text-[10px] rounded px-1.5 py-0.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                                        >
                                                            <option value="All">All Zones ({hotspots.length + customShapes.length})</option>
                                                            {availableZones.map(z => {
                                                                const count = hotspots.filter(h => {
                                                                    const asset = locationAssets.find(a => a.id === h.equipmentId);
                                                                    return asset?.zone === z;
                                                                }).length + customShapes.filter(s => s.zone === z).length;
                                                                return (
                                                                    <option key={z} value={z}>{z} ({count})</option>
                                                                );
                                                            })}
                                                        </select>
                                                    </div>

                                                    <span className="text-slate-400">Overlay Original Sketch:</span>
                                                    <input 
                                                        type="checkbox" 
                                                        disabled={!layoutPhotoUrl}
                                                        checked={showOverlay} 
                                                        onChange={(e) => setShowOverlay(e.target.checked)} 
                                                        className="rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer w-3.5 h-3.5 disabled:opacity-50"
                                                    />
                                                    {showOverlay && layoutPhotoUrl && (
                                                        <div className="flex items-center gap-1.5 ml-2 border-l border-slate-850 pl-2">
                                                            <span className="text-slate-400">Opacity:</span>
                                                            <input 
                                                                type="range" 
                                                                min="0.1" 
                                                                max="0.9" 
                                                                step="0.05"
                                                                value={overlayOpacity}
                                                                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                                                                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                            />
                                                            <span className="font-mono text-emerald-400">{Math.round(overlayOpacity * 100)}%</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right side: Zoom / Rotate Controls */}
                                                <div className="flex gap-1.5 pointer-events-auto bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-lg text-white">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                                                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                        title="Zoom Out"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span 
                                                        onClick={() => setZoom(1)}
                                                        className="px-2 py-1.5 text-[10px] font-black font-mono select-none hover:bg-slate-800 rounded-lg cursor-pointer flex items-center justify-center shrink-0 min-w-[40px]"
                                                        title="Reset Zoom"
                                                    >
                                                        {Math.round(zoom * 100)}%
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
                                                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                        title="Zoom In"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setRotation(prev => (prev + 90) % 360)}
                                                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors border-l border-slate-800 cursor-pointer flex items-center gap-1 pl-2 text-[10px] font-bold text-emerald-400"
                                                        title="Rotate 90° Clockwise"
                                                    >
                                                        <RefreshCw size={12} /> {rotation}°
                                                    </button>
                                                    {rotation !== 0 && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => setRotation(0)}
                                                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer text-[9px] font-bold"
                                                            title="Reset Rotation"
                                                        >
                                                            Reset
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Vector Plan rendering with hotspot and corner overlays */}
                                        {layoutProfessionalSvg && (
                                            <div 
                                                ref={viewportRef}
                                                className="relative w-full aspect-[4/3] max-h-full overflow-auto select-none scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
                                            >
                                                <div 
                                                    className="relative origin-center transition-transform duration-150 ease-out cursor-crosshair"
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                                    }}
                                                    onClick={handleViewportClick}
                                                >
                                                    {/* Render dynamic vector layout SVG */}
                                                    <div 
                                                        className="w-full h-full pointer-events-none svg-blueprint-container"
                                                        dangerouslySetInnerHTML={{ __html: sanitizeSvgContent(layoutProfessionalSvg) }}
                                                    />

                                                    {/* Render custom user shapes (boxes, circles, lines) */}
                                                    {editorMode === 'view' && customShapes.map((shape) => {
                                                        const isFilteredOut = selectedZoneFilter !== 'All' && shape.zone !== selectedZoneFilter;
                                                        if (isFilteredOut) return null;

                                                        const isActive = shape.id === activeShapeId;
                                                        
                                                        if (shape.type === 'rect') {
                                                            return (
                                                                <div 
                                                                    key={shape.id}
                                                                    className={`absolute border-2 transition-all ${
                                                                        draggingShapeId === shape.id ? 'cursor-grabbing border-dashed' : 'cursor-grab border-solid'
                                                                    }`}
                                                                    style={{
                                                                        left: `${shape.x}%`,
                                                                        top: `${shape.y}%`,
                                                                        width: `${shape.width}%`,
                                                                        height: `${shape.height}%`,
                                                                        borderColor: shape.color,
                                                                        backgroundColor: `${shape.color}15`,
                                                                        transform: `translate(-50%, -50%) rotate(${shape.rotation || 0}deg)`,
                                                                        zIndex: 10
                                                                    }}
                                                                    onMouseDown={(e) => handleShapeMouseDown(e, shape.id)}
                                                                >
                                                                    {isActive && !isTechView && (
                                                                        <>
                                                                            <div className="absolute inset-0 border border-white animate-pulse" />
                                                                            {/* Drag-to-Resize Handle */}
                                                                            <div 
                                                                                className="absolute w-3 h-3 bg-white border border-indigo-600 rounded-sm cursor-se-resize -right-1.5 -bottom-1.5 z-30 shadow"
                                                                                onMouseDown={(e) => handleResizeMouseDown(e, shape.id)}
                                                                            />
                                                                            {/* Drag-to-Rotate Handle */}
                                                                            <div 
                                                                                className="absolute w-3 h-3 bg-white border border-indigo-600 rounded-full cursor-grab -translate-x-1/2 -top-4 left-1/2 z-30 shadow"
                                                                                onMouseDown={(e) => handleRotateMouseDown(e, shape.id)}
                                                                            />
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (shape.type === 'circle') {
                                                            return (
                                                                <div 
                                                                    key={shape.id}
                                                                    className={`absolute border-2 rounded-full transition-all ${
                                                                        draggingShapeId === shape.id ? 'cursor-grabbing border-dashed' : 'cursor-grab border-solid'
                                                                    }`}
                                                                    style={{
                                                                        left: `${shape.x}%`,
                                                                        top: `${shape.y}%`,
                                                                        width: `${shape.width}%`,
                                                                        height: `${shape.width}%`,
                                                                        borderColor: shape.color,
                                                                        backgroundColor: `${shape.color}15`,
                                                                        transform: 'translate(-50%, -50%)',
                                                                        zIndex: 10
                                                                    }}
                                                                    onMouseDown={(e) => handleShapeMouseDown(e, shape.id)}
                                                                >
                                                                    {isActive && !isTechView && (
                                                                        <>
                                                                            <div className="absolute inset-0 rounded-full border border-white animate-pulse" />
                                                                            <div 
                                                                                className="absolute w-3 h-3 bg-white border border-indigo-600 rounded-sm cursor-se-resize -right-1 -bottom-1 z-30 shadow"
                                                                                onMouseDown={(e) => handleResizeMouseDown(e, shape.id)}
                                                                            />
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (shape.type === 'line') {
                                                            return (
                                                                <div 
                                                                    key={shape.id}
                                                                    className={`absolute transition-all ${
                                                                        draggingShapeId === shape.id ? 'cursor-grabbing' : 'cursor-grab'
                                                                    }`}
                                                                    style={{
                                                                        left: `${shape.x}%`,
                                                                        top: `${shape.y}%`,
                                                                        width: `${shape.width}%`,
                                                                        height: '3px',
                                                                        backgroundColor: shape.color,
                                                                        transform: `translate(-50%, -50%) rotate(${shape.rotation || 0}deg)`,
                                                                        zIndex: 10
                                                                    }}
                                                                    onMouseDown={(e) => handleShapeMouseDown(e, shape.id)}
                                                                >
                                                                    {isActive && !isTechView && (
                                                                        <>
                                                                            <div className="absolute -inset-1 border border-white rounded animate-pulse" />
                                                                            <div 
                                                                                className="absolute w-3 h-3 bg-white border border-indigo-650 rounded-sm cursor-se-resize -right-1.5 -bottom-1.5 z-30 shadow"
                                                                                onMouseDown={(e) => handleResizeMouseDown(e, shape.id)}
                                                                            />
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })}

                                                    {/* Original layout photo comparison overlay */}
                                                    {showOverlay && layoutPhotoUrl && (
                                                        <img 
                                                            src={layoutPhotoUrl} 
                                                            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" 
                                                            style={{ opacity: overlayOpacity }}
                                                            alt="Original layout overlay"
                                                        />
                                                    )}

                                                     {/* Hotspots Overlay (Only visible in View mode) */}
                                                     {editorMode === 'view' && hotspots.map((hp) => {
                                                         const asset = locationAssets.find(a => a.id === hp.equipmentId);
                                                         if (!asset) return null;
                                                         const isFilteredOut = selectedZoneFilter !== 'All' && asset?.zone !== selectedZoneFilter;
                                                         if (isFilteredOut) return null;

                                                         const isMapped = !!hp.equipmentId;
                                                         const isActive = hp.id === activeHotspotId;
                                                         
                                                         const labelUpper = (hp.label || '').toUpperCase();
                                                         const isRtu = labelUpper.startsWith('RTU');
                                                         const isCu = labelUpper.startsWith('CU') || labelUpper.startsWith('ACCU') || labelUpper.startsWith('HP');
                                                         const isEf = labelUpper.startsWith('EF');

                                                         return (
                                                             <div 
                                                                 key={hp.id}
                                                                 className={`hotspot-marker absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-all ${
                                                                     draggingId === hp.id ? 'scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105'
                                                                 }`}
                                                                 style={{ left: `${hp.x}%`, top: `${hp.y}%` }}
                                                                 onMouseDown={(e) => handleHotspotMouseDown(e, hp.id)}
                                                             >
                                                                 {/* Interactive CAD Schematic Pin Symbol */}
                                                                 <div className="relative flex items-center justify-center">
                                                                     {isRtu ? (
                                                                         <svg width="40" height="24" viewBox="-20 -12 40 24" className="overflow-visible drop-shadow-md">
                                                                             <rect x="-18" y="-10" width="36" height="20" fill={isActive ? "rgba(245, 158, 11, 0.2)" : "rgba(15, 23, 42, 0.85)"} stroke={isActive ? "#f59e0b" : isMapped ? "#0ea5e9" : "#eab308"} strokeWidth="2" rx="2" className={isMapped && !isActive ? "animate-pulse" : ""} />
                                                                             <line x1="2" y1="-10" x2="2" y2="10" stroke={isActive ? "#fbbf24" : isMapped ? "#06b6d4" : "#facc15"} strokeWidth="1" />
                                                                             <circle cx="-8" cy="0" r="6" fill="none" stroke={isActive ? "#fbbf24" : isMapped ? "#0ea5e9" : "#facc15"} strokeWidth="1" />
                                                                             <path d="M -12 -2 L -4 2 M -6 4 L -10 -4" stroke={isActive ? "#fbbf24" : isMapped ? "#0ea5e9" : "#facc15"} strokeWidth="1" />
                                                                             <path d="M 6 -6 H 14 M 6 -3 H 14 M 6 0 H 14 M 6 3 H 14 M 6 6 H 14" stroke={isActive ? "#fbbf24" : isMapped ? "#06b6d4" : "#facc15"} strokeWidth="1" />
                                                                         </svg>
                                                                     ) : isCu ? (
                                                                         <svg width="24" height="24" viewBox="-12 -12 24 24" className="overflow-visible drop-shadow-md">
                                                                             <rect x="-10" y="-10" width="20" height="20" fill={isActive ? "rgba(245, 158, 11, 0.2)" : "rgba(15, 23, 42, 0.85)"} stroke={isActive ? "#f59e0b" : isMapped ? "#06b6d4" : "#eab308"} strokeWidth="2" rx="2" className={isMapped && !isActive ? "animate-pulse" : ""} />
                                                                             <circle cx="0" cy="0" r="7" fill="none" stroke={isActive ? "#fbbf24" : isMapped ? "#0891b2" : "#facc15"} strokeWidth="1" />
                                                                             <path d="M -5 -3 L 5 3 M -3 5 L 3 -5" stroke={isActive ? "#fbbf24" : isMapped ? "#0891b2" : "#facc15"} strokeWidth="1" />
                                                                             <circle cx="0" cy="0" r="1.8" fill={isActive ? "#f59e0b" : isMapped ? "#06b6d4" : "#facc15"} />
                                                                         </svg>
                                                                     ) : isEf ? (
                                                                         <svg width="26" height="26" viewBox="-13 -13 26 26" className="overflow-visible drop-shadow-md">
                                                                             <circle cx="0" cy="0" r="10" fill={isActive ? "rgba(245, 158, 11, 0.2)" : "rgba(15, 23, 42, 0.85)"} stroke={isActive ? "#f59e0b" : isMapped ? "#10b981" : "#eab308"} strokeWidth="2" className={isMapped && !isActive ? "animate-pulse" : ""} />
                                                                             <path d="M -7 -3 L 7 3 M -3 7 L 3 -7" stroke={isActive ? "#fbbf24" : isMapped ? "#059669" : "#facc15"} strokeWidth="1.5" />
                                                                             <circle cx="0" cy="0" r="2" fill={isActive ? "#f59e0b" : isMapped ? "#10b981" : "#facc15"} />
                                                                         </svg>
                                                                     ) : (
                                                                         <svg width="24" height="24" viewBox="-12 -12 24 24" className="overflow-visible drop-shadow-md">
                                                                             <rect x="-10" y="-10" width="20" height="20" fill={isActive ? "rgba(245, 158, 11, 0.2)" : "rgba(15, 23, 42, 0.85)"} stroke={isActive ? "#f59e0b" : isMapped ? "#6366f1" : "#eab308"} strokeWidth="2" rx="2" className={isMapped && !isActive ? "animate-pulse" : ""} />
                                                                             <line x1="-7" y1="-7" x2="7" y2="7" stroke={isActive ? "#fbbf24" : isMapped ? "#6366f1" : "#facc15"} strokeWidth="1" />
                                                                             <line x1="7" y1="-7" x2="-7" y2="7" stroke={isActive ? "#fbbf24" : isMapped ? "#6366f1" : "#facc15"} strokeWidth="1" />
                                                                         </svg>
                                                                     )}
                                                                     
                                                                     {/* Label text below or above */}
                                                                     <span className={`absolute top-full mt-1 bg-slate-900/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap pointer-events-none uppercase transition-colors ${
                                                                         isActive 
                                                                             ? 'border-amber-400 text-amber-300' 
                                                                             : isMapped 
                                                                                 ? 'border-blue-500/50 text-blue-200' 
                                                                                 : 'border-yellow-500/50 text-yellow-200'
                                                                     }`}>
                                                                         {hp.label}
                                                                     </span>
                                                                 </div>

                                                                 {/* Floating Status Popover Card */}
                                                                 {isActive && (
                                                                     <div 
                                                                         onMouseDown={(e) => e.stopPropagation()}
                                                                         className="hotspot-popover absolute bottom-[125%] left-1/2 -translate-x-1/2 bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-xl border border-slate-700/60 shadow-2xl p-3.5 w-60 z-[250] pointer-events-auto leading-normal cursor-default select-text text-left"
                                                                     >
                                                                         {/* Arrow pointing down */}
                                                                         <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900 dark:border-t-slate-950" />
                                                                         
                                                                         <div className="space-y-2">
                                                                             <div className="flex justify-between items-start gap-1">
                                                                                 <div className="truncate flex-1">
                                                                                     <h4 className="font-black text-xs text-indigo-400 uppercase tracking-wider truncate">{asset.name || `${asset.brand} ${asset.type}`}</h4>
                                                                                     <p className="text-[10px] text-slate-400 truncate">{asset.type}</p>
                                                                                 </div>
                                                                                 <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase whitespace-nowrap ${
                                                                                     (asset.status || 'Operational') === 'Operational' 
                                                                                         ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                                                         : (asset.status || 'Operational') === 'Down'
                                                                                             ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                                                             : (asset.status || 'Operational') === 'Waiting for Parts'
                                                                                                 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                                                                 : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                                                 }`}>
                                                                                     {asset.status || 'Operational'}
                                                                                 </span>
                                                                             </div>
                                                                             
                                                                             <div className="text-[10px] text-slate-300 space-y-0.5 border-t border-slate-800/80 pt-1.5 leading-normal">
                                                                                 <p><span className="text-slate-500 font-medium">Brand:</span> {asset.brand || 'N/A'}</p>
                                                                                 <p><span className="text-slate-500 font-medium">Model:</span> {asset.model || 'N/A'}</p>
                                                                                 <p><span className="text-slate-500 font-medium">Serial:</span> {asset.serial || 'N/A'}</p>
                                                                                 {asset.zone && <p><span className="text-slate-500 font-medium">Zone:</span> {asset.zone}</p>}
                                                                                 {asset.notes && <p className="text-slate-400 italic mt-1 line-clamp-2">"{asset.notes}"</p>}
                                                                             </div>

                                                                             {/* Status Dropdown selector */}
                                                                             <div className="space-y-1 pt-1">
                                                                                 <label className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Change Status</label>
                                                                                 <select 
                                                                                     value={asset.status || 'Operational'}
                                                                                     onChange={async (e) => {
                                                                                         const val = e.target.value;
                                                                                         const updatedEq = (customer.equipment || []).map(eq => 
                                                                                             eq.id === asset.id ? { ...eq, status: val } : eq
                                                                                         );
                                                                                         await saveCustomerEquipment(updatedEq);
                                                                                     }}
                                                                                     className="w-full bg-slate-800 text-[10px] text-slate-200 border border-slate-700/60 rounded p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                                 >
                                                                                     <option value="Operational">Operational</option>
                                                                                     <option value="Down">Down</option>
                                                                                     <option value="Waiting for Parts">Waiting for Parts</option>
                                                                                     <option value="Blower Motor Burnt Out">Blower Motor Burnt Out</option>
                                                                                 </select>
                                                                             </div>

                                                                             {/* Action buttons */}
                                                                             <div className="flex gap-2 pt-1 border-t border-slate-800/80">
                                                                                 {onSelectEquipment && (
                                                                                     <button
                                                                                         type="button"
                                                                                         onClick={(e) => {
                                                                                             e.stopPropagation();
                                                                                             onSelectEquipment(asset);
                                                                                         }}
                                                                                         className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold text-center cursor-pointer transition-colors shadow-sm"
                                                                                     >
                                                                                         Edit Asset
                                                                                     </button>
                                                                                 )}
                                                                                 <button
                                                                                     type="button"
                                                                                     onClick={(e) => {
                                                                                         e.stopPropagation();
                                                                                         setActiveHotspotId(null);
                                                                                         setShowMappingPanel(false);
                                                                                     }}
                                                                                     className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded text-[10px] font-bold text-center cursor-pointer transition-colors"
                                                                                 >
                                                                                     Close
                                                                                 </button>
                                                                             </div>
                                                                         </div>
                                                                     </div>
                                                                 )}
                                                             </div>
                                                         );
                                                     })}

                                                    {/* Boundary Corners Overlay (Only visible in edit-perimeter mode) */}
                                                    {editorMode === 'edit-perimeter' && layoutVertices.map((v, idx) => (
                                                        <div 
                                                            key={v.id}
                                                            className={`vertex-node absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 border border-white text-[9px] font-black shadow-md cursor-grab active:cursor-grabbing z-30 transition-all ${
                                                                draggingVertexId === v.id ? 'scale-110' : ''
                                                            }`}
                                                            style={{ left: `${v.x}%`, top: `${v.y}%` }}
                                                            onMouseDown={(e) => handleVertexMouseDown(e, v.id)}
                                                            onDoubleClick={() => handleVertexDoubleClick(v.id)}
                                                            title="Drag corner. Double-click corner to delete."
                                                        >
                                                            {idx + 1}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>                    )}
                </div>
            </div>
        </Modal>
    );
};

export default LocationPhotosLayoutModal;
