import React, { useState, useEffect } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { Sparkles, Save, Eye, LayoutTemplate, Settings, Copy, CheckCircle2, ArrowLeft } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { toast } from 'react-toastify';
import DOMPurify from 'dompurify';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';

const BlogManager: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [posts, setPosts] = useState<any[]>([]);
    const [profileSlug, setProfileSlug] = useState('');
    const [isSavingSlug, setIsSavingSlug] = useState(false);
    const [copiedWidget, setCopiedWidget] = useState(false);

    useEffect(() => {
        if (!state.currentOrganization?.id) return;
        
        // Load existing profile slug if available
        if (state.currentOrganization.profileSlug) {
            setProfileSlug(state.currentOrganization.profileSlug);
        } else {
            // Suggest a slug based on organization name
            const suggestedSlug = state.currentOrganization.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || '';
            setProfileSlug(suggestedSlug);
        }

        const unsub = db.collection('organizations')
            .doc(state.currentOrganization.id)
            .collection('blogPosts')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                setPosts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            
        return () => unsub();
    }, [state.currentOrganization?.id, state.currentOrganization?.name, state.currentOrganization?.profileSlug]);

    const handleSaveSlug = async () => {
        if (!profileSlug.trim()) return toast.error("Profile slug cannot be empty.");
        setIsSavingSlug(true);
        try {
            await db.collection('organizations').doc(state.currentOrganization?.id).update({
                profileSlug: profileSlug.toLowerCase()
            });
            toast.success("Profile URL updated successfully!");
        } catch (err) {
            console.error("Failed to update profile slug", err);
            toast.error("Failed to update profile URL.");
        } finally {
            setIsSavingSlug(false);
        }
    };

    const copyWidgetCode = () => {
        const widgetCode = `<div id="tektrakker-blog-widget" data-org="${state.currentOrganization?.id}"></div>\n<script src="https://app.tektrakker.com/widgets/blog.js" async></script>\n<!-- Powered by TekTrakker.com -->`;
        navigator.clipboard.writeText(widgetCode);
        setCopiedWidget(true);
        setTimeout(() => setCopiedWidget(false), 2000);
        toast.success("Widget code copied to clipboard!");
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt.trim()) return toast.error("Please enter a topic to generate.");
        
        setIsGenerating(true);
        try {
            const generateFn = httpsCallable(getFunctions(), 'generateMarketingEmail'); 
            const result = await generateFn({ prompt: `Write a comprehensive, SEO-optimized blog post in HTML format (using <h2>, <p>, <ul>) about: ${aiPrompt}` });
            const data = result.data as any;
            if (data.html) {
                setContent(DOMPurify.sanitize(data.html));
                setTitle(aiPrompt); // Default title to prompt
                toast.success("Blog draft generated!");
            }
        } catch (err: any) {
            console.error("AI Generation Error", err);
            toast.error("Failed to generate blog content.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async (published: boolean) => {
        if (!title.trim() || !content.trim()) return toast.error("Title and content are required.");
        
        setIsSaving(true);
        try {
            await db.collection('organizations').doc(state.currentOrganization?.id).collection('blogPosts').add({
                title,
                content: DOMPurify.sanitize(content),
                published,
                authorId: state.currentUser?.id,
                createdAt: new Date().toISOString(),
                slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
            });
            toast.success(published ? "Blog post published!" : "Draft saved!");
            setTitle('');
            setContent('');
        } catch (err) {
            console.error(err);
            toast.error("Failed to save blog post.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20 px-4 mt-8 md:mt-2">
            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" className="p-2 -ml-2" onClick={() => navigate(-1)}>
                        <ArrowLeft size={24} className="text-slate-600 dark:text-slate-300" />
                    </Button>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <LayoutTemplate className="text-primary-500" />
                        Blog Manager
                    </h2>
                </div>
            </header>

            <Card className="p-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <LayoutTemplate className="text-primary-500" />
                    New Blog Post
                </h3>
                
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">AI Generator</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                                placeholder="What should the blog post be about?"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                            />
                            <Button 
                                onClick={handleGenerateAI}
                                disabled={isGenerating || !aiPrompt}
                                className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                <Sparkles size={16} className="mr-2" />
                                {isGenerating ? 'Drafting...' : 'Auto-Write'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Post Title</label>
                        <input
                            type="text"
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                            placeholder="e.g. 5 Tips for HVAC Maintenance"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Post Content</label>
                        <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                            <ReactQuill 
                                theme="snow" 
                                value={content} 
                                onChange={setContent} 
                                className="h-64 bg-white dark:bg-slate-900 dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
                        <Save size={16} className="mr-2"/> Save Draft
                    </Button>
                    <Button variant="primary" onClick={() => handleSave(true)} disabled={isSaving}>
                        <Eye size={16} className="mr-2"/> Publish to Profile
                    </Button>
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Hosted Content</h3>
                <div className="space-y-3">
                    {posts.length === 0 && <p className="text-sm text-slate-500">No blog posts found.</p>}
                    {posts.map(post => (
                        <div key={post.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">{post.title}</h4>
                                <p className="text-xs text-slate-500">/{post.slug} • {new Date(post.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${post.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {post.published ? 'Live' : 'Draft'}
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => { setTitle(post.title); setContent(post.content); }}>
                                    Edit
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="p-6 border-indigo-100 dark:border-indigo-900/50">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Settings className="text-indigo-500" />
                    Consumer-Facing Profile & Widget Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Hosted Profile URL Configuration */}
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white">Public Profile URL</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                This is where your customers can read your blog posts directly on TekTrakker's optimized infrastructure.
                            </p>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Profile Slug</label>
                            <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                                <span className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm border-r border-slate-300 dark:border-slate-700 font-mono">
                                    tektrakker.com/p/
                                </span>
                                <input
                                    id="profile-slug"
                                    title="Profile Slug"
                                    placeholder="my-company"
                                    type="text"
                                    className="flex-1 border-0 focus:ring-0 text-sm bg-white dark:bg-slate-900"
                                    value={profileSlug}
                                    onChange={(e) => setProfileSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                                />
                            </div>
                            <div className="mt-3 flex justify-end">
                                <Button size="sm" onClick={handleSaveSlug} disabled={isSavingSlug || !profileSlug}>
                                    {isSavingSlug ? 'Saving...' : 'Save URL'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Embeddable SEO Widget */}
                    <div className="space-y-4 md:border-l md:pl-8 border-slate-200 dark:border-slate-700">
                        <div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-white">Website Embed Widget</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Copy and paste this code onto your own website to embed your TekTrakker blog feed. This automatically builds SEO authority back to your profile.
                            </p>
                        </div>
                        
                        <div className="relative group">
                            <pre className="p-4 bg-slate-900 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                                {`<div id="tektrakker-blog-widget" data-org="${state.currentOrganization?.id}"></div>\n<script src="https://app.tektrakker.com/widgets/blog.js" async></script>\n<!-- Powered by TekTrakker.com -->`}
                            </pre>
                            <button 
                                onClick={copyWidgetCode}
                                className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors shadow-sm"
                                title="Copy to clipboard"
                            >
                                {copiedWidget ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default BlogManager;
