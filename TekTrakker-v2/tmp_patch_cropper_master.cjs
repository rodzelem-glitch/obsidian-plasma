const fs = require('fs');

let c = fs.readFileSync('src/pages/master/MasterSocialMediaHub.tsx', 'utf8');

if (!c.includes('import ImageCropperModal')) {
    c = c.replace("import OmniPreviewBoard from 'components/common/OmniPreviewBoard';", "import OmniPreviewBoard from 'components/common/OmniPreviewBoard';\nimport ImageCropperModal from 'components/social/ImageCropperModal';");
}

if (!c.includes('const [isCropperOpen, setIsCropperOpen]')) {
    c = c.replace("const [isUploading, setIsUploading] = useState(false);", "const [isUploading, setIsUploading] = useState(false);\n    const [isCropperOpen, setIsCropperOpen] = useState(false);\n    const [selectedFileForCrop, setSelectedFileForCrop] = useState<File | null>(null);");
}

const origHandleImageUpload = `    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        setErrorMsg('');
        try {
            const storageRef = storage.ref(\`master_social_media/\${Date.now()}_\${file.name}\`);
            const snapshot = await storageRef.put(file);
            const url = await snapshot.ref.getDownloadURL();
            setMediaUrl(url);
        } catch (error) {
            console.error("Upload error:", error);
            setErrorMsg("Failed to upload image.");
        } finally {
            setIsUploading(false);
        }
    };`;

const newUploadLogic = `    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFileForCrop(file);
        setIsCropperOpen(true);
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setIsCropperOpen(false);
        setIsUploading(true);
        setErrorMsg('');
        try {
            const fileName = selectedFileForCrop?.name || 'media.jpg';
            const storageRef = storage.ref(\`master_social_media/\${Date.now()}_\${fileName}\`);
            const snapshot = await storageRef.put(croppedBlob);
            const url = await snapshot.ref.getDownloadURL();
            setMediaUrl(url);
        } catch (error) {
            console.error("Upload error:", error);
            setErrorMsg("Failed to upload cropped image.");
        } finally {
            setIsUploading(false);
            setSelectedFileForCrop(null);
        }
    };`;

c = c.replace(origHandleImageUpload, newUploadLogic);

const cropperModalMarkup = `            </div>

            {selectedFileForCrop && (
                <ImageCropperModal
                    isOpen={isCropperOpen}
                    onClose={() => { setIsCropperOpen(false); setSelectedFileForCrop(null); }}
                    imageFile={selectedFileForCrop}
                    onCropComplete={handleCropComplete}
                />
            )}

            {templates.length > 0 && (`

c = c.replace(`            </div>

            {templates.length > 0 && (`, cropperModalMarkup);

fs.writeFileSync('src/pages/master/MasterSocialMediaHub.tsx', c);
