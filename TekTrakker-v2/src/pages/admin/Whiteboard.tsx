import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import { 
    Move, Pencil as DrawingIcon, Trash2, Plus, X, Type, CheckSquare, 
    Link as LinkIcon, FileText, Image as ImageIcon, RotateCcw, 
    Save, Minimize2, ZoomIn, ZoomOut, Check, User, Calendar, 
    ArrowLeft, AlertCircle, Sparkles, Layers, RefreshCw, Eraser
} from 'lucide-react';
import showToast from '../../lib/toast';

interface WhiteboardElement {
    id: string;
    type: 'sticky' | 'task' | 'link' | 'photo' | 'document' | 'text';
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    
    // Sticky note props
    color?: string;
    title?: string;
    content?: string;
    fontFamily?: 'sans' | 'serif' | 'mono' | 'handwriting';
    
    // Task props
    taskTitle?: string;
    taskDescription?: string;
    taskPriority?: 'Low' | 'Medium' | 'High';
    taskDelegatedTo?: string; // User ID
    taskDueDate?: string;
    taskChecklist?: { id: string; text: string; checked: boolean }[];
    taskCompleted?: boolean;
    
    // Link props
    linkUrl?: string;
    linkTitle?: string;
    linkDesc?: string;
    
    // Photo props
    photoTitle?: string;
    photoUrl?: string; // Base64 or direct URL
    
    // Document props
    docTitle?: string;
    docDesc?: string;
    docUrl?: string;
    
    // Floating Text props
    textColor?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
}

interface Stroke {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    tool: 'pen' | 'highlighter' | 'eraser';
}

const Whiteboard: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const orgId = state.currentOrganization?.id || '';
    const users = state.users || [];
    const boardRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SVGSVGElement>(null);

    // Board State loaded from Firestore
    const [elements, setElements] = useState<WhiteboardElement[]>([]);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Canvas Transform (Pan & Zoom)
    const [pan, setPan] = useState({ x: window.innerWidth / 2 - 800, y: window.innerHeight / 2 - 800 });
    const [scale, setScale] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Active tool: 'select' | 'draw' | 'highlighter' | 'eraser'
    const [activeTool, setActiveTool] = useState<'select' | 'draw' | 'highlighter' | 'eraser'>('select');
    
    // Drawing Properties
    const [brushColor, setBrushColor] = useState('#3b82f6'); // default blue
    const [brushSize, setBrushSize] = useState(4);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
    const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);

    // Drag and Resize State
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
    const [resizeStartMouse, setResizeStartMouse] = useState({ x: 0, y: 0 });

    // Floating UI states
    const [editingElementId, setEditingElementId] = useState<string | null>(null);
    const [newChecklistItemText, setNewChecklistItemText] = useState('');
    const [snapToGrid, setSnapToGrid] = useState(true);
    const GRID_SIZE = 20;

    // Load Google Handwriting Font
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    // Clear mouseCoords state if active tool is changed from eraser
    useEffect(() => {
        if (activeTool !== 'eraser') {
            setMouseCoords(null);
        }
    }, [activeTool]);

    // Firebase live sync listener
    useEffect(() => {
        if (!orgId) return;
        setIsLoading(true);
        const unsubscribe = db.collection('whiteboards').doc(orgId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data) {
                        if (data.elements) setElements(data.elements);
                        if (data.strokes) setStrokes(data.strokes);
                    }
                } else {
                    // Create default first-time whiteboard structures
                    db.collection('whiteboards').doc(orgId).set({
                        elements: [
                            {
                                id: 'welcome-sticky',
                                type: 'sticky',
                                x: 700,
                                y: 700,
                                width: 240,
                                height: 240,
                                zIndex: 1,
                                color: '#fbcfe8', // pastel pink
                                title: 'Welcome Admins! 👋',
                                content: 'This is your interactive Collaboration Board!\n\nUse this canvas to pin sticky notes, create checklist delegations, draw schemas, or drop links.\n\nChanges are synced real-time!',
                                fontFamily: 'handwriting'
                            }
                        ],
                        strokes: [],
                        updatedAt: new Date().toISOString()
                    });
                }
                setIsLoading(false);
            }, (error) => {
                console.error("Firestore Whiteboard listener error:", error);
                setIsLoading(false);
            });
        return () => unsubscribe();
    }, [orgId]);

    // Save changes helper to upload modifications to Firestore
    const saveToFirestore = async (newElements: WhiteboardElement[], newStrokes: Stroke[]) => {
        if (!orgId) return;
        try {
            await db.collection('whiteboards').doc(orgId).set({
                elements: newElements,
                strokes: newStrokes,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.error("Failed to write to whiteboard database:", e);
            showToast.error("Database sync failed.");
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        const isEditing = 
            document.activeElement?.tagName === 'INPUT' || 
            document.activeElement?.tagName === 'TEXTAREA' || 
            document.activeElement?.getAttribute('contenteditable') === 'true';
        if (isEditing) return;

        if (e.code === 'Space' && activeTool === 'select') {
            e.preventDefault();
            setIsPanning(true);
        } else if (e.key.toLowerCase() === 'v') {
            setActiveTool('select');
        } else if (e.key.toLowerCase() === 'd') {
            setActiveTool('draw');
        } else if (e.key.toLowerCase() === 'h') {
            setActiveTool('highlighter');
        } else if (e.key.toLowerCase() === 'e') {
            setActiveTool('eraser');
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTool]);

    // Conversion helper from client coordinates to board space
    const getBoardCoords = (clientX: number, clientY: number) => {
        if (!boardRef.current) return { x: 0, y: 0 };
        const rect = boardRef.current.getBoundingClientRect();
        const x = (clientX - rect.left - pan.x) / scale;
        const y = (clientY - rect.top - pan.y) / scale;
        return { x, y };
    };

    // Canvas Panning and Drawing Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        // Space pan or middle click or select tool panning
        if (e.button === 1 || isPanning || e.button === 2) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            return;
        }

        if (activeTool === 'select') {
            setEditingElementId(null);
            return;
        }

        // Draw / Highlighter / Eraser tool mouse-down
        e.preventDefault();
        setIsDrawing(true);
        const coords = getBoardCoords(e.clientX, e.clientY);
        
        if (activeTool === 'eraser') {
            setMouseCoords(coords);
            const radius = brushSize * 3;
            const remainingStrokes = strokes.filter(stroke => {
                const collides = stroke.points.some(p => {
                    const dist = Math.hypot(p.x - coords.x, p.y - coords.y);
                    return dist < radius;
                });
                return !collides;
            });

            if (remainingStrokes.length !== strokes.length) {
                setStrokes(remainingStrokes);
                saveToFirestore(elements, remainingStrokes);
            }
        } else {
            setCurrentPoints([coords]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const coords = getBoardCoords(e.clientX, e.clientY);

        // Always update mouseCoords when eraser tool is active so we can show the cursor circle
        if (activeTool === 'eraser') {
            setMouseCoords(coords);
        } else if (mouseCoords !== null) {
            setMouseCoords(null);
        }

        if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
            return;
        }

        if (draggedId) {
            let targetX = coords.x - dragOffset.x;
            let targetY = coords.y - dragOffset.y;

            if (snapToGrid) {
                targetX = Math.round(targetX / GRID_SIZE) * GRID_SIZE;
                targetY = Math.round(targetY / GRID_SIZE) * GRID_SIZE;
            }

            setElements(prev => prev.map(el => el.id === draggedId ? { ...el, x: targetX, y: targetY } : el));
            return;
        }

        if (resizingId) {
            const deltaX = (e.clientX - resizeStartMouse.x) / scale;
            const deltaY = (e.clientY - resizeStartMouse.y) / scale;
            let targetWidth = Math.max(150, resizeStartSize.width + deltaX);
            let targetHeight = Math.max(100, resizeStartSize.height + deltaY);

            if (snapToGrid) {
                targetWidth = Math.round(targetWidth / GRID_SIZE) * GRID_SIZE;
                targetHeight = Math.round(targetHeight / GRID_SIZE) * GRID_SIZE;
            }

            setElements(prev => prev.map(el => el.id === resizingId ? { ...el, width: targetWidth, height: targetHeight } : el));
            return;
        }

        if (!isDrawing) return;

        if (activeTool === 'eraser') {
            // Eraser intersects check
            const radius = brushSize * 3;
            const remainingStrokes = strokes.filter(stroke => {
                const collides = stroke.points.some(p => {
                    const dist = Math.hypot(p.x - coords.x, p.y - coords.y);
                    return dist < radius;
                });
                return !collides;
            });

            if (remainingStrokes.length !== strokes.length) {
                setStrokes(remainingStrokes);
                saveToFirestore(elements, remainingStrokes);
            }
            return;
        }

        // pen / highlighter
        setCurrentPoints(prev => [...prev, coords]);
    };

    const handleMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        if (draggedId) {
            setDraggedId(null);
            saveToFirestore(elements, strokes);
            return;
        }

        if (resizingId) {
            setResizingId(null);
            saveToFirestore(elements, strokes);
            return;
        }

        if (!isDrawing) return;
        setIsDrawing(false);

        if ((activeTool === 'draw' || activeTool === 'highlighter') && currentPoints.length > 1) {
            const newStroke: Stroke = {
                id: `stroke-${Date.now()}`,
                points: currentPoints,
                color: brushColor,
                width: activeTool === 'highlighter' ? brushSize * 3 : brushSize,
                tool: activeTool === 'highlighter' ? 'highlighter' : 'pen'
            };
            const updatedStrokes = [...strokes, newStroke];
            setStrokes(updatedStrokes);
            saveToFirestore(elements, updatedStrokes);
        }

        setCurrentPoints([]);
    };

    const handleMouseLeave = () => {
        handleMouseUp();
        setMouseCoords(null);
    };

    // Zoom Handlers
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const mouseCoords = getBoardCoords(e.clientX, e.clientY);
        
        let nextScale = scale - e.deltaY * zoomIntensity * 0.01;
        nextScale = Math.min(Math.max(0.2, nextScale), 2.5);

        // Zoom centered on cursor position
        const nextPanX = e.clientX - boardRef.current!.getBoundingClientRect().left - mouseCoords.x * nextScale;
        const nextPanY = e.clientY - boardRef.current!.getBoundingClientRect().top - mouseCoords.y * nextScale;

        setScale(nextScale);
        setPan({ x: nextPanX, y: nextPanY });
    };

    // Add elements builders
    const getMaxZ = () => {
        if (elements.length === 0) return 1;
        return Math.max(...elements.map(el => el.zIndex)) + 1;
    };

    const addSticky = () => {
        const boardCenter = getBoardCoords(window.innerWidth / 2, window.innerHeight / 2);
        const newEl: WhiteboardElement = {
            id: `sticky-${Date.now()}`,
            type: 'sticky',
            x: boardCenter.x - 110,
            y: boardCenter.y - 110,
            width: 220,
            height: 220,
            zIndex: getMaxZ(),
            color: '#fef08a', // standard yellow
            title: 'New Note',
            content: 'Write something...',
            fontFamily: 'sans'
        };
        const updated = [...elements, newEl];
        setElements(updated);
        saveToFirestore(updated, strokes);
        setEditingElementId(newEl.id);
    };

    const addTaskCard = () => {
        const boardCenter = getBoardCoords(window.innerWidth / 2, window.innerHeight / 2);
        const newEl: WhiteboardElement = {
            id: `task-${Date.now()}`,
            type: 'task',
            x: boardCenter.x - 130,
            y: boardCenter.y - 160,
            width: 260,
            height: 320,
            zIndex: getMaxZ(),
            taskTitle: 'New Delegation',
            taskDescription: 'Describe operations, tasks, or delegations here...',
            taskPriority: 'Medium',
            taskDelegatedTo: '',
            taskDueDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
            taskChecklist: [],
            taskCompleted: false
        };
        const updated = [...elements, newEl];
        setElements(updated);
        saveToFirestore(updated, strokes);
        setEditingElementId(newEl.id);
    };

    const addLinkCard = () => {
        const boardCenter = getBoardCoords(window.innerWidth / 2, window.innerHeight / 2);
        const urlInput = prompt("Enter full website URL (e.g. https://google.com):", "https://");
        if (!urlInput || urlInput === 'https://') return;
        
        let title = "Resource Link";
        try {
            const domain = new URL(urlInput).hostname;
            title = domain.replace('www.', '');
        } catch(e) {}

        const newEl: WhiteboardElement = {
            id: `link-${Date.now()}`,
            type: 'link',
            x: boardCenter.x - 120,
            y: boardCenter.y - 80,
            width: 240,
            height: 160,
            zIndex: getMaxZ(),
            linkUrl: urlInput,
            linkTitle: title,
            linkDesc: 'Click to open external reference.'
        };
        const updated = [...elements, newEl];
        setElements(updated);
        saveToFirestore(updated, strokes);
        setEditingElementId(newEl.id);
    };

    const addDocumentPin = () => {
        const boardCenter = getBoardCoords(window.innerWidth / 2, window.innerHeight / 2);
        const newEl: WhiteboardElement = {
            id: `doc-${Date.now()}`,
            type: 'document',
            x: boardCenter.x - 110,
            y: boardCenter.y - 70,
            width: 220,
            height: 140,
            zIndex: getMaxZ(),
            docTitle: 'Operations Manual.pdf',
            docDesc: 'Core guidelines, templates or checklists.',
            docUrl: '#'
        };
        const updated = [...elements, newEl];
        setElements(updated);
        saveToFirestore(updated, strokes);
        setEditingElementId(newEl.id);
    };

    const addPhotoPin = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Compress image to 300x300 canvas-size to fit Firestore 1MB limits
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const MAX_HEIGHT = 300;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                const boardCenter = getBoardCoords(window.innerWidth / 2, window.innerHeight / 2);
                const newEl: WhiteboardElement = {
                    id: `photo-${Date.now()}`,
                    type: 'photo',
                    x: boardCenter.x - 125,
                    y: boardCenter.y - 150,
                    width: 250,
                    height: 300,
                    zIndex: getMaxZ(),
                    photoTitle: file.name.substring(0, 18),
                    photoUrl: compressedBase64
                };
                const updated = [...elements, newEl];
                setElements(updated);
                saveToFirestore(updated, strokes);
                setEditingElementId(newEl.id);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const addFloatingText = () => {
        const boardCenter = getBoardCoords(window.innerWidth / 2, window.innerHeight / 2);
        const newEl: WhiteboardElement = {
            id: `text-${Date.now()}`,
            type: 'text',
            x: boardCenter.x - 100,
            y: boardCenter.y - 30,
            width: 200,
            height: 60,
            zIndex: getMaxZ(),
            content: 'Float Text',
            textColor: '#0f172a',
            fontSize: 20,
            fontWeight: 'normal'
        };
        const updated = [...elements, newEl];
        setElements(updated);
        saveToFirestore(updated, strokes);
        setEditingElementId(newEl.id);
    };

    // Actions on Elements
    const bringToFront = (id: string) => {
        const target = elements.find(el => el.id === id);
        if (!target) return;
        const currentMaxZ = getMaxZ();
        if (target.zIndex === currentMaxZ - 1 && elements.length > 1) return; // already top

        const updated = elements.map(el => el.id === id ? { ...el, zIndex: currentMaxZ } : el);
        setElements(updated);
        saveToFirestore(updated, strokes);
    };

    const deleteElement = (id: string) => {
        const updated = elements.filter(el => el.id !== id);
        setElements(updated);
        saveToFirestore(updated, strokes);
        if (editingElementId === id) setEditingElementId(null);
    };

    const clearCanvas = async () => {
        if (!window.confirm("Are you sure you want to clear all notes and drawings? This action cannot be undone.")) return;
        setElements([]);
        setStrokes([]);
        saveToFirestore([], []);
        showToast.success("Board cleared successfully!");
    };

    const handleElementDragStart = (e: React.MouseEvent, el: WhiteboardElement) => {
        if (activeTool !== 'select') return;
        e.stopPropagation();
        bringToFront(el.id);
        
        const coords = getBoardCoords(e.clientX, e.clientY);
        setDraggedId(el.id);
        setDragOffset({
            x: coords.x - el.x,
            y: coords.y - el.y
        });
    };

    const handleResizeStart = (e: React.MouseEvent, el: WhiteboardElement) => {
        e.stopPropagation();
        e.preventDefault();
        setResizingId(el.id);
        setResizeStartSize({ width: el.width, height: el.height });
        setResizeStartMouse({ x: e.clientX, y: e.clientY });
    };

    // Checklist togglers
    const toggleChecklistItem = (elId: string, itemId: string) => {
        const updated = elements.map(el => {
            if (el.id !== elId) return el;
            const nextList = el.taskChecklist?.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item) || [];
            return { ...el, taskChecklist: nextList };
        });
        setElements(updated);
        saveToFirestore(updated, strokes);
    };

    const addChecklistItem = (elId: string) => {
        if (!newChecklistItemText.trim()) return;
        const updated = elements.map(el => {
            if (el.id !== elId) return el;
            const nextList = [...(el.taskChecklist || []), { id: `item-${Date.now()}`, text: newChecklistItemText.trim(), checked: false }];
            return { ...el, taskChecklist: nextList };
        });
        setElements(updated);
        saveToFirestore(updated, strokes);
        setNewChecklistItemText('');
    };

    const deleteChecklistItem = (elId: string, itemId: string) => {
        const updated = elements.map(el => {
            if (el.id !== elId) return el;
            const nextList = el.taskChecklist?.filter(item => item.id !== itemId) || [];
            return { ...el, taskChecklist: nextList };
        });
        setElements(updated);
        saveToFirestore(updated, strokes);
    };

    // Center/Reset Canvas View
    const centerView = () => {
        setScale(1);
        setPan({ x: window.innerWidth / 2 - 800, y: window.innerHeight / 2 - 800 });
    };

    // Build SVG paths for strokes
    const getStrokePath = (points: { x: number; y: number }[]) => {
        if (points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
        
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }
        return path;
    };

    const activeEditingElement = elements.find(el => el.id === editingElementId);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col select-none touch-none text-slate-100 font-sans">
            {/* Top Toolbar Header */}
            <header className="h-16 shrink-0 bg-slate-800 border-b border-slate-700/80 px-4 flex items-center justify-between z-10 shadow-lg backdrop-blur-md bg-opacity-95">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/admin/dashboard')}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} />
                        <span className="hidden sm:inline text-sm font-semibold">Exit Board</span>
                    </button>
                    <div className="h-6 w-px bg-slate-700" />
                    <div>
                        <h1 className="text-md sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5 leading-none">
                            <Sparkles size={16} className="text-indigo-400 animate-pulse" />
                            Admin Collaboration Whiteboard
                        </h1>
                        <p className="text-[11px] text-slate-400 font-medium">Real-Time organization planning & ideation</p>
                    </div>
                </div>

                {/* Database Sync Status */}
                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-indigo-400 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-xs font-semibold">
                            <RefreshCw size={12} className="animate-spin" />
                            Syncing...
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-emerald-400 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-xs font-semibold">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                            Live Connected
                        </div>
                    )}
                    
                    <button
                        onClick={clearCanvas}
                        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all"
                        title="Clear whole board"
                    >
                        <RotateCcw size={14} />
                        Clear Canvas
                    </button>
                </div>
            </header>

            {/* Sub-toolbar tools dock (select, draw, highlighter, eraser) */}
            <div className="absolute top-20 left-4 z-20 flex flex-col gap-2 p-2 bg-slate-800 bg-opacity-90 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl">
                <button
                    onClick={() => setActiveTool('select')}
                    className={`p-3 rounded-lg transition-all ${activeTool === 'select' ? 'bg-primary-600 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'}`}
                    title="Select & Move Elements (V)"
                >
                    <Move size={20} />
                </button>
                
                <button
                    onClick={() => setActiveTool('draw')}
                    className={`p-3 rounded-lg transition-all ${activeTool === 'draw' ? 'bg-primary-600 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'}`}
                    title="Marker Pen (D)"
                >
                    <DrawingIcon size={20} className="w-5 h-5" />
                </button>
                
                <button
                    onClick={() => setActiveTool('highlighter')}
                    className={`p-3 rounded-lg transition-all ${activeTool === 'highlighter' ? 'bg-primary-600 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'}`}
                    title="Highlighter Tool (H)"
                >
                    <div className="w-5 h-5 border-b-4 border-dashed border-yellow-400 flex items-center justify-center font-bold text-xs select-none">HL</div>
                </button>
                
                <button
                    onClick={() => setActiveTool('eraser')}
                    className={`p-3 rounded-lg transition-all ${activeTool === 'eraser' ? 'bg-primary-600 text-white shadow-md scale-105' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'}`}
                    title="Eraser (E)"
                >
                    <Eraser size={20} />
                </button>

                {/* Drawing Color & Size Sliders */}
                {(activeTool === 'draw' || activeTool === 'highlighter' || activeTool === 'eraser') && (
                    <div className="mt-2 border-t border-slate-700 pt-2 flex flex-col items-center gap-3">
                        {(activeTool === 'draw' || activeTool === 'highlighter') && (
                            <div className="grid grid-cols-2 gap-1.5">
                                {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ffffff'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setBrushColor(c)}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${brushColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="w-12 flex flex-col items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-bold">
                                {activeTool === 'eraser' ? `${brushSize * 3}px` : `${brushSize}px`}
                            </span>
                            <input
                                type="range"
                                min="2"
                                max="24"
                                step="2"
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                className="w-12 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Elements Dock (Add Sticky, Task, Link, Photo, Doc, Text) */}
            <div className="absolute top-20 right-4 z-20 flex flex-col gap-2 p-2 bg-slate-800 bg-opacity-90 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl">
                <button
                    onClick={addSticky}
                    className="flex items-center gap-2 p-3 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all group"
                    title="Pin Sticky Note"
                >
                    <Plus size={18} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold pr-1">Sticky</span>
                </button>
                
                <button
                    onClick={addTaskCard}
                    className="flex items-center gap-2 p-3 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all group"
                    title="Delegate Task Board"
                >
                    <CheckSquare size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold pr-1">Task Card</span>
                </button>
                
                <button
                    onClick={addLinkCard}
                    className="flex items-center gap-2 p-3 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all group"
                    title="Pin Link Card"
                >
                    <LinkIcon size={18} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold pr-1">Link Pin</span>
                </button>
                
                <button
                    onClick={addDocumentPin}
                    className="flex items-center gap-2 p-3 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all group"
                    title="Pin Document Card"
                >
                    <FileText size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold pr-1">Doc Pin</span>
                </button>

                <label className="flex items-center gap-2 p-3 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all group cursor-pointer">
                    <ImageIcon size={18} className="text-pink-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold pr-1">Upload Photo</span>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={addPhotoPin}
                        className="hidden"
                    />
                </label>

                <button
                    onClick={addFloatingText}
                    className="flex items-center gap-2 p-3 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all group"
                    title="Floating Text"
                >
                    <Type size={18} className="text-teal-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold pr-1">Float Text</span>
                </button>

                <div className="border-t border-slate-700 pt-2 flex flex-col gap-2">
                    <button
                        onClick={() => setSnapToGrid(!snapToGrid)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-[10px] font-bold tracking-wider uppercase transition-colors ${snapToGrid ? 'bg-indigo-600/30 border border-indigo-500/50 text-indigo-300' : 'bg-slate-700 text-slate-400 border border-transparent hover:bg-slate-600'}`}
                    >
                        Grid: {snapToGrid ? 'Snap On' : 'Snap Off'}
                    </button>
                </div>
            </div>

            {/* Whiteboard Interactive Infinite Canvas area */}
            <div 
                ref={boardRef}
                className="flex-1 w-full relative overflow-hidden bg-slate-950 select-none cursor-grab"
                style={{ cursor: isPanning ? 'grabbing' : activeTool === 'select' ? 'default' : 'crosshair' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
            >
                {/* SVG Dot grid + Interactive Elements Canvas container */}
                <div 
                    className="absolute w-[3000px] h-[3000px] pointer-events-none"
                    style={{ 
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                    }}
                >
                    {/* SVG Canvas for Vector Dot Grid Pattern */}
                    <div 
                        className="absolute inset-0 transition-colors"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #334155 1.5px, transparent 1.5px)',
                            backgroundSize: '40px 40px',
                            backgroundPosition: '0 0'
                        }}
                    />

                    {/* Vector Freehand drawings layer */}
                    <svg className="absolute inset-0 pointer-events-none w-full h-full">
                        {/* Completed persistent database strokes */}
                        {strokes.map(stroke => (
                            <path
                                key={stroke.id}
                                d={getStrokePath(stroke.points)}
                                stroke={stroke.color}
                                strokeWidth={stroke.width}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={stroke.tool === 'highlighter' ? 0.35 : 1}
                            />
                        ))}

                        {/* Current active user stroke drawing */}
                        {currentPoints.length > 0 && (
                            <path
                                d={getStrokePath(currentPoints)}
                                stroke={brushColor}
                                strokeWidth={activeTool === 'highlighter' ? brushSize * 3 : brushSize}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={activeTool === 'highlighter' ? 0.35 : 1}
                            />
                        )}

                        {/* Eraser cursor outline indicator */}
                        {activeTool === 'eraser' && mouseCoords && (
                            <circle
                                cx={mouseCoords.x}
                                cy={mouseCoords.y}
                                r={brushSize * 3}
                                fill="rgba(239, 68, 68, 0.15)"
                                stroke="#ef4444"
                                strokeWidth={1.5}
                                strokeDasharray="3,3"
                                className="pointer-events-none"
                            />
                        )}
                    </svg>

                    {/* Collaborative elements layers */}
                    {elements.map(el => {
                        const isEditing = editingElementId === el.id;
                        
                        return (
                            <div
                                key={el.id}
                                className={`absolute pointer-events-auto rounded-xl flex flex-col group/card shadow-2xl transition-shadow ${
                                    isEditing ? 'ring-4 ring-indigo-500 shadow-indigo-500/20' : 'hover:shadow-indigo-500/10'
                                }`}
                                style={{
                                    left: el.x,
                                    top: el.y,
                                    width: el.width,
                                    height: el.height,
                                    zIndex: el.zIndex,
                                    cursor: draggedId === el.id ? 'grabbing' : activeTool === 'select' ? 'grab' : 'default'
                                }}
                                onMouseDown={(e) => handleElementDragStart(e, el)}
                            >
                                {/* CARD DELETE / EDIT HEADER OVERLAYS */}
                                {activeTool === 'select' && (
                                    <div className="absolute -top-3 -right-3 flex items-center gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-50">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingElementId(isEditing ? null : el.id); }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="p-1.5 bg-slate-800 border border-slate-700 text-indigo-400 hover:text-white rounded-lg shadow-lg active:scale-95 transition-all"
                                            title="Edit/Configure Card"
                                        >
                                            <Sparkles size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="p-1.5 bg-slate-800 border border-slate-700 text-rose-500 hover:text-rose-400 rounded-lg shadow-lg active:scale-95 transition-all"
                                            title="Delete Card"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}

                                {/* RENDER INDIVIDUAL ELEMENTS */}

                                {/* STICKY NOTE */}
                                {el.type === 'sticky' && (
                                    <div 
                                        className="w-full h-full flex flex-col p-4 rounded-xl relative border"
                                        style={{ 
                                            backgroundColor: el.color || '#fef08a', 
                                            color: '#1e293b',
                                            fontFamily: el.fontFamily === 'handwriting' ? 'Architects Daughter, cursive' : el.fontFamily === 'mono' ? 'monospace' : el.fontFamily === 'serif' ? 'serif' : 'sans-serif',
                                            borderColor: 'rgba(30, 41, 59, 0.12)'
                                        }}
                                    >
                                        <div className="font-extrabold text-sm border-b border-black/10 pb-1 mb-2 pr-4 truncate leading-snug">
                                            {el.title}
                                        </div>
                                        <div className="flex-1 text-xs overflow-y-auto whitespace-pre-wrap leading-relaxed pr-1 custom-scrollbar">
                                            {el.content}
                                        </div>
                                    </div>
                                )}

                                {/* CHECKLIST TASK & DELEGATION CARD */}
                                {el.type === 'task' && (
                                    <div className="w-full h-full flex flex-col bg-slate-800/95 backdrop-blur-sm border border-slate-700 text-slate-100 p-4 rounded-xl">
                                        <div className="flex items-start justify-between border-b border-slate-700 pb-2 mb-2">
                                            <div>
                                                <h3 className="font-bold text-sm text-white pr-4 truncate max-w-[170px] leading-tight">
                                                    {el.taskTitle}
                                                </h3>
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-1 ${
                                                    el.taskPriority === 'High' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                                    el.taskPriority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                    'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                }`}>
                                                    {el.taskPriority} Priority
                                                </span>
                                            </div>
                                            
                                            {/* Delegation Circle Badge */}
                                            {el.taskDelegatedTo && (
                                                <div 
                                                    className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md border border-indigo-400 shrink-0"
                                                    title={`Delegated to ${users.find(u => u.id === el.taskDelegatedTo)?.firstName || 'User'}`}
                                                >
                                                    {users.find(u => u.id === el.taskDelegatedTo)?.firstName?.[0] || 'U'}
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                                            {el.taskDescription}
                                        </p>

                                        {/* Task Checklist items scroll area */}
                                        <div className="flex-1 overflow-y-auto mb-2 pr-1 custom-scrollbar space-y-1.5">
                                            {el.taskChecklist && el.taskChecklist.length > 0 ? (
                                                el.taskChecklist.map(item => (
                                                    <div 
                                                        key={item.id} 
                                                        className="flex items-center justify-between gap-2 p-1.5 bg-slate-900/50 hover:bg-slate-900 rounded border border-slate-700/50"
                                                    >
                                                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                                            <input 
                                                                type="checkbox"
                                                                checked={item.checked}
                                                                onChange={() => toggleChecklistItem(el.id, item.id)}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                className="rounded border-slate-600 bg-slate-800 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5 shrink-0"
                                                            />
                                                            <span className={`text-[11px] font-medium truncate ${item.checked ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                                                {item.text}
                                                            </span>
                                                        </label>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); deleteChecklistItem(el.id, item.id); }}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors shrink-0"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-[10px] text-slate-500 italic text-center py-4">No itemized checklist tasks</div>
                                            )}
                                        </div>

                                        {/* Task due date footer details */}
                                        <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-700/50 pt-2 shrink-0">
                                            <span className="flex items-center gap-1 font-semibold text-rose-400">
                                                <Calendar size={10} />
                                                Due: {el.taskDueDate || 'No limit'}
                                            </span>
                                            
                                            {el.taskChecklist && el.taskChecklist.length > 0 && (
                                                <span className="font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                                                    {el.taskChecklist.filter(i => i.checked).length}/{el.taskChecklist.length} tasks
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* WEBSITE LINK PREVIEW CARD */}
                                {el.type === 'link' && (
                                    <div className="w-full h-full flex flex-col bg-slate-800 text-slate-100 p-4 border border-slate-700 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2 shrink-0 text-cyan-400">
                                            <LinkIcon size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Pinned Resource</span>
                                        </div>
                                        <h3 className="font-bold text-sm text-white line-clamp-1 mb-1 leading-tight group-hover/card:text-cyan-400 transition-colors">
                                            {el.linkTitle}
                                        </h3>
                                        <p className="text-[11px] text-slate-400 flex-1 line-clamp-2 leading-relaxed">
                                            {el.linkDesc}
                                        </p>
                                        <div className="mt-2 flex items-center justify-between border-t border-slate-700/50 pt-2 shrink-0 gap-2">
                                            <span className="text-[9px] text-slate-500 truncate font-medium max-w-[120px]" title={el.linkUrl}>
                                                {el.linkUrl}
                                            </span>
                                            <a 
                                                href={el.linkUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[9px] font-bold transition-colors uppercase tracking-wider block shrink-0"
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                Visit Link
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* DOCUMENT CARD */}
                                {el.type === 'document' && (
                                    <div className="w-full h-full flex flex-col bg-slate-800 text-slate-100 p-4 border border-slate-700 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2 text-indigo-400 shrink-0">
                                            <FileText size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Document Pin</span>
                                        </div>
                                        <h3 className="font-bold text-sm text-white line-clamp-1 mb-1 leading-tight">
                                            {el.docTitle}
                                        </h3>
                                        <p className="text-[11px] text-slate-400 flex-1 line-clamp-1 leading-relaxed">
                                            {el.docDesc}
                                        </p>
                                        <a 
                                            href={el.docUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="mt-2 w-full text-center py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold transition-colors uppercase tracking-wider block shrink-0 active:scale-95"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (activeTool !== 'select') {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            View Document
                                        </a>
                                    </div>
                                )}

                                {/* POLAROID PHOTO CARD */}
                                {el.type === 'photo' && (
                                    <div className="w-full h-full flex flex-col bg-white text-slate-800 p-3 pb-6 border border-slate-200 rounded-lg shadow-xl relative">
                                        <div className="flex-1 w-full bg-slate-100 rounded border border-slate-200 overflow-hidden relative">
                                            {el.photoUrl ? (
                                                <img 
                                                    src={el.photoUrl} 
                                                    alt="Board Pin" 
                                                    className="w-full h-full object-cover select-none pointer-events-none"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                    <ImageIcon size={32} />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div 
                                            className="text-center pt-3 text-[11px] font-bold text-slate-600 uppercase tracking-widest select-none truncate leading-none"
                                            style={{ fontFamily: 'Architects Daughter, cursive' }}
                                        >
                                            {el.photoTitle || 'Board Photo'}
                                        </div>
                                    </div>
                                )}

                                {/* FLOATING TEXT */}
                                {el.type === 'text' && (
                                    <div 
                                        className="w-full h-full flex items-center justify-center p-2 rounded-xl text-center select-none overflow-hidden font-bold"
                                        style={{ 
                                            color: el.textColor || '#ffffff', 
                                            fontSize: `${el.fontSize || 18}px`,
                                            fontWeight: el.fontWeight || 'normal'
                                        }}
                                    >
                                        {el.content}
                                    </div>
                                )}

                                {/* CARD RESIZE HANDLE */}
                                {activeTool === 'select' && (
                                    <div
                                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-40 flex items-center justify-center group-hover/card:bg-slate-700/50 rounded-br-xl opacity-0 group-hover/card:opacity-100 transition-opacity"
                                        onMouseDown={(e) => handleResizeStart(e, el)}
                                    >
                                        <svg className="w-2.5 h-2.5 text-slate-400" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                                            <line x1="1" y1="9" x2="9" y2="1" strokeWidth="1.5" />
                                            <line x1="4" y1="9" x2="9" y2="4" strokeWidth="1.5" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom floating zoom actions (reset zoom, center view) */}
            <div className="absolute bottom-6 left-4 z-20 flex items-center gap-2 p-2 bg-slate-800 bg-opacity-90 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl">
                <button
                    onClick={() => setScale(prev => Math.max(0.2, prev - 0.1))}
                    className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    title="Zoom Out"
                >
                    <ZoomOut size={16} />
                </button>
                <span className="text-[11px] font-bold text-slate-300 w-12 text-center select-none">
                    {Math.round(scale * 100)}%
                </span>
                <button
                    onClick={() => setScale(prev => Math.min(2.5, prev + 0.1))}
                    className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    title="Zoom In"
                >
                    <ZoomIn size={16} />
                </button>
                <div className="w-px h-6 bg-slate-700 mx-1" />
                <button
                    onClick={centerView}
                    className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    title="Center & reset zoom view"
                >
                    <Minimize2 size={14} />
                    Reset View
                </button>
            </div>

            {/* ELEMENT EDITING CONFIGURATION SIDEPANEL */}
            {editingElementId && activeEditingElement && (
                <div className="absolute top-20 right-28 w-80 bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-2xl z-30 max-h-[80vh] overflow-y-auto custom-scrollbar backdrop-blur-md bg-opacity-95 text-xs text-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
                        <h4 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={14} className="text-indigo-400" />
                            Configure {activeEditingElement.type}
                        </h4>
                        <button 
                            onClick={() => setEditingElementId(null)}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* STICKY NOTE CONFIG */}
                        {activeEditingElement.type === 'sticky' && (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Sticky Color</label>
                                    <div className="grid grid-cols-6 gap-2">
                                        {[
                                            { hex: '#fef08a', name: 'yellow' },
                                            { hex: '#fbcfe8', name: 'pink' },
                                            { hex: '#bfdbfe', name: 'blue' },
                                            { hex: '#bbf7d0', name: 'green' },
                                            { hex: '#e9d5ff', name: 'purple' },
                                            { hex: '#fed7aa', name: 'orange' }
                                        ].map(color => (
                                            <button
                                                key={color.hex}
                                                onClick={() => {
                                                    const updated = elements.map(el => el.id === editingElementId ? { ...el, color: color.hex } : el);
                                                    setElements(updated);
                                                    saveToFirestore(updated, strokes);
                                                }}
                                                className={`w-7 h-7 rounded border-2 transition-transform hover:scale-105 ${activeEditingElement.color === color.hex ? 'border-white scale-105 shadow-md' : 'border-transparent'}`}
                                                style={{ backgroundColor: color.hex }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Font Style</label>
                                    <div className="grid grid-cols-4 gap-1.5 bg-slate-900 p-1 rounded-lg">
                                        {[
                                            { id: 'sans', label: 'Sans' },
                                            { id: 'serif', label: 'Serif' },
                                            { id: 'mono', label: 'Mono' },
                                            { id: 'handwriting', label: 'Hand' }
                                        ].map(font => (
                                            <button
                                                key={font.id}
                                                onClick={() => {
                                                    const updated = elements.map(el => el.id === editingElementId ? { ...el, fontFamily: font.id as any } : el);
                                                    setElements(updated);
                                                    saveToFirestore(updated, strokes);
                                                }}
                                                className={`py-1.5 rounded font-bold text-[10px] transition-colors ${activeEditingElement.fontFamily === font.id ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                            >
                                                {font.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={activeEditingElement.title || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, title: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Content Text</label>
                                    <textarea
                                        rows={4}
                                        value={activeEditingElement.content || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, content: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-medium"
                                    />
                                </div>
                            </>
                        )}

                        {/* TASK & CHECKLIST CONFIG */}
                        {activeEditingElement.type === 'task' && (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Task Title</label>
                                    <input
                                        type="text"
                                        value={activeEditingElement.taskTitle || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, taskTitle: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Description</label>
                                    <textarea
                                        rows={2}
                                        value={activeEditingElement.taskDescription || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, taskDescription: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Priority</label>
                                        <select
                                            value={activeEditingElement.taskPriority || 'Medium'}
                                            onChange={(e) => {
                                                const updated = elements.map(el => el.id === editingElementId ? { ...el, taskPriority: e.target.value as any } : el);
                                                setElements(updated);
                                                saveToFirestore(updated, strokes);
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-semibold"
                                        >
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Due Date</label>
                                        <input
                                            type="date"
                                            value={activeEditingElement.taskDueDate || ''}
                                            onChange={(e) => {
                                                const updated = elements.map(el => el.id === editingElementId ? { ...el, taskDueDate: e.target.value } : el);
                                                setElements(updated);
                                                saveToFirestore(updated, strokes);
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-semibold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Delegate To Employee</label>
                                    <select
                                        value={activeEditingElement.taskDelegatedTo || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, taskDelegatedTo: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-semibold"
                                    >
                                        <option value="">-- Unassigned --</option>
                                        {users
                                            .filter(u => u.organizationId === orgId && u.role !== 'customer' && u.status !== 'archived')
                                            .map(u => (
                                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Add Checklist Task</label>
                                    <div className="flex gap-1.5">
                                        <input
                                            type="text"
                                            value={newChecklistItemText}
                                            onChange={(e) => setNewChecklistItemText(e.target.value)}
                                            placeholder="Enter sub-task..."
                                            onKeyDown={(e) => e.key === 'Enter' && addChecklistItem(activeEditingElement.id)}
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white"
                                        />
                                        <button
                                            onClick={() => addChecklistItem(activeEditingElement.id)}
                                            className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded active:scale-95 transition-all"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* WEBSITE LINK PIN CONFIG */}
                        {activeEditingElement.type === 'link' && (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Link Title / Display Name</label>
                                    <input
                                        type="text"
                                        value={activeEditingElement.linkTitle || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, linkTitle: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">URL Address</label>
                                    <input
                                        type="text"
                                        value={activeEditingElement.linkUrl || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, linkUrl: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Short Description</label>
                                    <textarea
                                        rows={3}
                                        value={activeEditingElement.linkDesc || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, linkDesc: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-medium"
                                    />
                                </div>
                            </>
                        )}

                        {/* DOCUMENT PIN CONFIG */}
                        {activeEditingElement.type === 'document' && (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Doc Title / File Name</label>
                                    <input
                                        type="text"
                                        value={activeEditingElement.docTitle || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, docTitle: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Doc File Link / URL</label>
                                    <input
                                        type="text"
                                        value={activeEditingElement.docUrl || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, docUrl: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Doc Metadata / Note</label>
                                    <textarea
                                        rows={3}
                                        value={activeEditingElement.docDesc || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, docDesc: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-medium"
                                    />
                                </div>
                            </>
                        )}

                        {/* PHOTO PIN CONFIG */}
                        {activeEditingElement.type === 'photo' && (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Photo Title / Caption</label>
                                    <input
                                        type="text"
                                        value={activeEditingElement.photoTitle || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, photoTitle: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-bold text-white text-center"
                                        style={{ fontFamily: 'Architects Daughter, cursive' }}
                                    />
                                </div>
                            </>
                        )}

                        {/* FLOATING TEXT CONFIG */}
                        {activeEditingElement.type === 'text' && (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Text Content</label>
                                    <input
                                        type="text"
                                        value={activeEditingElement.content || ''}
                                        onChange={(e) => {
                                            const updated = elements.map(el => el.id === editingElementId ? { ...el, content: e.target.value } : el);
                                            setElements(updated);
                                            saveToFirestore(updated, strokes);
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-bold"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Text Size</label>
                                        <input
                                            type="number"
                                            value={activeEditingElement.fontSize || 18}
                                            min="10"
                                            max="72"
                                            onChange={(e) => {
                                                const updated = elements.map(el => el.id === editingElementId ? { ...el, fontSize: Number(e.target.value) } : el);
                                                setElements(updated);
                                                saveToFirestore(updated, strokes);
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary-500 text-white font-semibold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Font Color</label>
                                        <input
                                            type="color"
                                            value={activeEditingElement.textColor || '#ffffff'}
                                            onChange={(e) => {
                                                const updated = elements.map(el => el.id === editingElementId ? { ...el, textColor: e.target.value } : el);
                                                setElements(updated);
                                                saveToFirestore(updated, strokes);
                                            }}
                                            className="w-full h-9 bg-slate-900 border border-slate-700 rounded p-1 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Font Weight</label>
                                    <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-lg">
                                        {[
                                            { id: 'normal', label: 'Normal' },
                                            { id: 'bold', label: 'Bold' }
                                        ].map(weight => (
                                            <button
                                                key={weight.id}
                                                onClick={() => {
                                                    const updated = elements.map(el => el.id === editingElementId ? { ...el, fontWeight: weight.id as any } : el);
                                                    setElements(updated);
                                                    saveToFirestore(updated, strokes);
                                                }}
                                                className={`py-1.5 rounded font-bold text-[10px] transition-colors ${activeEditingElement.fontWeight === weight.id ? 'bg-primary-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                            >
                                                {weight.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="border-t border-slate-700 pt-3 mt-4 flex items-center justify-between">
                            <button
                                onClick={() => bringToFront(activeEditingElement.id)}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-650 rounded font-semibold text-[10px] tracking-wide uppercase transition-colors"
                            >
                                Bring to Front
                            </button>
                            
                            <button
                                onClick={() => deleteElement(activeEditingElement.id)}
                                className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600 rounded text-rose-300 hover:text-white font-semibold text-[10px] tracking-wide uppercase transition-colors"
                            >
                                Delete Item
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Whiteboard;
