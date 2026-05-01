import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Share2, Image as ImageIcon, Send, Sparkles, RefreshCw, BarChart3, Code } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { db, storage } from 'lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';

const SocialMediaHub: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [content, setContent] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    
    // Toggles for Platforms
    const [postToFB, setPostToFB] = useState(true);
    const [postToIG, setPostToIG] = useState(true);
    const [postToLI, setPostToLI] = useState(true);
    const [postToGB, setPostToGB] = useState(true);
    
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !state.currentOrganization?.id) return;
        setIsUploading(true);
        setErrorMsg('');
        try {
            const storageRef = storage.ref(`social_media/${state.currentOrganization.id}/${Date.now()}_${file.name}`);
            const snapshot = await storageRef.put(file);
            const url = await snapshot.ref.getDownloadURL();
            setMediaUrl(url);
        } catch (error) {
            console.error("Upload error:", error);
            setErrorMsg("Failed to upload image.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI', { timeout: 300000 });
            const prompt = `Write an engaging, organic social media post for our home service business. Include popular hashtags. Keep it under 500 characters. Tone: Professional but friendly.`;
            const result: any = await callGeminiAI({ prompt });
            if (result.data?.text) {
                setContent(result.data.text);
            }
        } catch (error) {
            console.error("AI Gen Failed:", error);
            setErrorMsg("Failed to generate AI post.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePublish = async () => {
        if (!content.trim()) return setErrorMsg("Post content cannot be empty.");
        if (!postToFB && !postToIG && !postToLI && !postToGB) return setErrorMsg("Select at least one platform.");
        
        setIsPosting(true);
        setErrorMsg('');
        setSuccessMsg('');
        
        try {
            // Save the post log to Firestore
            await db.collection('organizations').doc(state.currentOrganization?.id).collection('socialMediaPosts').add({
                content,
                mediaUrl,
                platforms: { facebook: postToFB, instagram: postToIG, linkedin: postToLI, googleBusiness: postToGB },
                status: 'published',
                authorId: state.currentUser?.id,
                createdAt: new Date().toISOString()
            });

            // Simulate external API calls to social platforms since raw API keys aren't linked here
            await new Promise(r => setTimeout(r, 1500));
            
            setSuccessMsg("Successfully federated to selected platforms!");
            setContent('');
            setMediaUrl('');
            
        } catch (error) {
            console.error("Post Error:", error);
            setErrorMsg("Failed to broadcast post.");
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20 px-4 mt-8 md:mt-2">
            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black flex items-center gap-2"><Share2 className="text-primary-600" /> Social Media Hub</h2>
                    <p className="text-slate-500 font-medium">Draft and broadcast organic updates across all your unified social properties simultaneously.</p>
                </div>
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => navigate('/admin/campaigns')}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-md transition-colors text-slate-500 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-900`}
                    >
                        <Code size={16}/> Campaign Studio
                    </button>
                    <button 
                        onClick={() => navigate('/admin/campaigns?tab=analytics')}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-md transition-colors text-slate-500 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-900`}
                    >
                        <BarChart3 size={16}/> Analytics
                    </button>
                    <button 
                        onClick={() => navigate('/admin/social')}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-md transition-colors bg-white dark:bg-slate-900 text-primary-600 shadow-sm`}
                    >
                        <Share2 size={16}/> Social Media Hub
                    </button>
                </div>
            </header>

            {errorMsg && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-200">{errorMsg}</div>}
            {successMsg && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold border border-emerald-200">{successMsg}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left Column (Editor) */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900 dark:text-white">Post Content</h3>
                            <button onClick={handleGenerateAI} disabled={isGenerating} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                                {isGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Suggest with AI
                            </button>
                        </div>
                        <textarea 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-40 p-4 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 resize-none font-medium dark:text-white"
                            placeholder="What do you want to share with your audience?"
                        />
                        
                        <div className="mt-6">
                            <h3 className="font-bold mb-3 flex items-center gap-2 text-slate-900 dark:text-white"><ImageIcon size={16} /> Attached Media</h3>
                            {mediaUrl ? (
                                <div className="relative w-full md:w-1/2 h-48 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                    <img src={mediaUrl} className="w-full h-full object-cover" alt="Attached Media" />
                                    <button onClick={() => setMediaUrl('')} className="absolute top-2 right-2 bg-black/50 hover:bg-black text-white p-1.5 rounded-md text-xs font-bold">Remove</button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative">
                                    <input type="file" aria-label="Upload media" title="Upload media" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" />
                                    <div className="text-center text-slate-500 pointer-events-none">
                                        {isUploading ? <RefreshCw className="animate-spin mx-auto mb-2" /> : <ImageIcon className="mx-auto mb-2 opacity-50" />}
                                        <p className="text-sm font-bold">{isUploading ? 'Uploading...' : 'Click or drag image to attach'}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Column (Networks) */}
                <div className="space-y-6">
                    <Card className="p-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] z-10 flex items-center justify-center flex-col">
                            <div className="bg-indigo-600 text-white font-black px-4 py-2 rounded-full shadow-lg transform -rotate-12 mb-2 border-2 border-indigo-400">COMING SOON</div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 text-center px-6">Direct API integrations are currently under development.</p>
                        </div>
                        
                        <div className="opacity-40 select-none">
                            <h3 className="font-bold mb-4 text-slate-900 dark:text-white">Select Networks</h3>
                            <div className="space-y-3">
                                <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <span className="font-bold text-sm text-[#1877F2]">Facebook Page</span>
                                    <input type="checkbox" checked={postToFB} readOnly className="w-4 h-4 text-primary-600 rounded border-slate-300 pointer-events-none" />
                                </label>
                                <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <span className="font-bold text-sm text-[#E4405F]">Instagram</span>
                                    <input type="checkbox" checked={postToIG} readOnly className="w-4 h-4 text-primary-600 rounded border-slate-300 pointer-events-none" />
                                </label>
                                <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <span className="font-bold text-sm text-[#0A66C2]">LinkedIn</span>
                                    <input type="checkbox" checked={postToLI} readOnly className="w-4 h-4 text-primary-600 rounded border-slate-300 pointer-events-none" />
                                </label>
                                <label className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <span className="font-bold text-sm text-[#EA4335]">Google Business</span>
                                    <input type="checkbox" checked={postToGB} readOnly className="w-4 h-4 text-primary-600 rounded border-slate-300 pointer-events-none" />
                                </label>
                            </div>
                            
                            <Button 
                                disabled={true} 
                                className="w-full mt-6 py-3 font-black flex items-center justify-center gap-2"
                            >
                                <Send size={16} />
                                Publish Now
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SocialMediaHub;
