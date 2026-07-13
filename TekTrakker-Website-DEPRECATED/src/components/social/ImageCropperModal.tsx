import React, { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import { Crop, Check, X } from 'lucide-react';

interface ImageCropperModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageFile: File;
    onCropComplete: (croppedBlob: Blob) => void;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.src = url;
    });

export const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
): Promise<Blob | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve) => {
        canvas.toBlob((file) => {
            resolve(file);
        }, 'image/jpeg');
    });
};

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ isOpen, onClose, imageFile, onCropComplete }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [aspect, setAspect] = useState<number>(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const imageUrl = React.useMemo(() => URL.createObjectURL(imageFile), [imageFile]);

    const onCropCompleteHandler = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleApplyCrop = async () => {
        if (!croppedAreaPixels) return;
        setIsGenerating(true);
        try {
            const croppedBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
            if (croppedBlob) {
                onCropComplete(croppedBlob);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Crop & Resize Media" size="lg">
            <div className="space-y-4">
                <div className="flex gap-2 justify-center mb-4">
                    <button onClick={() => setAspect(1)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${aspect === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>1:1 Square</button>
                    <button onClick={() => setAspect(4 / 5)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${aspect === 4 / 5 ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>4:5 Portrait</button>
                    <button onClick={() => setAspect(16 / 9)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${aspect === 16 / 9 ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>16:9 Landscape</button>
                    <button onClick={() => setAspect(9 / 16)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${aspect === 9 / 16 ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>9:16 Vertical</button>
                </div>
                
                <div className="relative w-full h-[400px] bg-slate-900 rounded-xl overflow-hidden">
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={setCrop}
                        onCropComplete={onCropCompleteHandler}
                        onZoomChange={setZoom}
                        showGrid={true}
                    />
                </div>

                <div className="flex items-center gap-4 py-2 px-1">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Zoom</span>
                    <input
                        type="range"
                        title="Zoom Level"
                        placeholder="Zoom"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 cursor-pointer"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <Button variant="secondary" onClick={onClose} disabled={isGenerating}>Cancel</Button>
                    <Button onClick={handleApplyCrop} disabled={isGenerating}>
                        {isGenerating ? 'Cropping...' : 'Apply Crop'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ImageCropperModal;
