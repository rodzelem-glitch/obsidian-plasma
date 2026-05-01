import React, { useState, useMemo, useEffect } from 'react';
import { PlayCircle, Search, Clock, Tag, BookOpen, ChevronLeft, ArrowRight, Play, CheckCircle2, X, MessageSquare } from 'lucide-react';
import { User } from '../types';
import Card from '../components/ui/Card';
import { mockTrainingData, trainingCategories, TrainingArticle } from '../data/trainingModules';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TrainingHubProps {
    user: User | null;
}

const TrainingHub: React.FC<TrainingHubProps> = ({ user }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [activeArticle, setActiveArticle] = useState<TrainingArticle | null>(null);
    const [isVideoExpanded, setIsVideoExpanded] = useState(false);

    // Onboarding progress state
    const [completedModules, setCompletedModules] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('tektrakker_training_progress');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const toggleCompletion = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setCompletedModules((prev: string[]) => {
            const updated = prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id];
            localStorage.setItem('tektrakker_training_progress', JSON.stringify(updated));
            return updated;
        });
    };

    // Deep Linking Support for Chatbot
    useEffect(() => {
        // Simple hash param checker: e.g. #/admin/training?module=org-setup
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const moduleId = params.get('module');
        if (moduleId) {
            const article = mockTrainingData.find(a => a.id === moduleId);
            if (article) setActiveArticle(article);
        }
    }, []);

    // AI Fuzzy Search & Filtering
    const filteredArticles = useMemo(() => {
        let results = mockTrainingData;

        // Role-based pruning 
        if (user && user.role) {
            // Give Master Admin everything, maybe filter strict matches for others
            if (user.role !== 'master') {
                results = results.filter(a => a.roles.includes(user.role as any) || a.roles.includes('master'));
            }
        }

        if (selectedCategory !== 'All') {
            results = results.filter(a => a.category === selectedCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            results = results.filter(a => 
                a.title.toLowerCase().includes(query) || 
                a.description.toLowerCase().includes(query) ||
                a.tags.some(t => t.toLowerCase().includes(query))
            );
        }

        return results;
    }, [searchQuery, selectedCategory, user]);


    if (activeArticle) {
        const isCompleted = completedModules.includes(activeArticle.id);

        return (
            <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in pb-24">
                {/* Fullscreen Video Overlay */}
                {isVideoExpanded && activeArticle.videoUrl && (
                    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4 md:p-12">
                        <button 
                            onClick={() => setIsVideoExpanded(false)}
                            aria-label="Close Video"
                            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors border border-white/20 z-[110]"
                        >
                            <X size={24} />
                        </button>
                        <div className="w-full max-w-6xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative">
                            <img src={activeArticle.videoUrl} alt={activeArticle.title} className="w-full h-full object-contain" />
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <button 
                        onClick={() => setActiveArticle(null)}
                        className="flex items-center gap-2 text-slate-500 hover:text-primary-500 font-bold text-sm w-fit transition-colors"
                    >
                        <ChevronLeft size={16} /> Back to Hub
                    </button>
                    
                    <button
                        onClick={() => toggleCompletion(activeArticle.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
                            isCompleted 
                                ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        {isCompleted ? <><CheckCircle2 size={16} /> Completed</> : "Skip / Mark as Complete"}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Video & Metadata */}
                    <div className="lg:col-span-1 space-y-6">
                        <div 
                            className={`aspect-video w-full bg-slate-900 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10 relative group flex items-center justify-center ${activeArticle.videoUrl ? 'cursor-pointer' : ''}`}
                            onClick={() => activeArticle.videoUrl && setIsVideoExpanded(true)}
                        >
                            {activeArticle.videoUrl ? (
                                <img src={activeArticle.videoUrl} alt={activeArticle.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <img src={activeArticle.thumbnailUrl} alt={activeArticle.title} className="w-full h-full object-cover opacity-60" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex flex-col justify-end p-4 pointer-events-none">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                                        <PlayCircle size={16} className="text-primary-400 group-hover:scale-110 transition-transform" />
                                        {activeArticle.duration} Video Guide
                                    </div>
                                    {activeArticle.videoUrl && (
                                        <div className="px-3 py-1 bg-white/20 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            Click to Enlarge
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{activeArticle.title}</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                {activeArticle.description}
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {activeArticle.tags.map(tag => (
                                    <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold rounded-full">
                                        <Tag size={12} /> {tag}
                                    </span>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: Step by Step Markdown */}
                    <div className="lg:col-span-2">
                        <Card className="p-6 md:p-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-full">
                            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                                <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                    <BookOpen size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Written Guide</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Step-by-step instructions</p>
                                </div>
                            </div>
                            
                            <div className="prose prose-slate dark:prose-invert max-w-none 
                                prose-headings:font-black prose-headings:tracking-tight 
                                prose-p:leading-relaxed prose-p:text-slate-600 dark:prose-p:text-slate-400
                                prose-h3:text-primary-600 dark:prose-h3:text-primary-400 prose-h3:mb-4
                                prose-li:marker:text-slate-400
                                prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-bold
                                prose-blockquote:bg-amber-50 dark:prose-blockquote:bg-amber-500/10 
                                prose-blockquote:border-l-4 prose-blockquote:border-amber-400 
                                prose-blockquote:px-6 prose-blockquote:py-4 prose-blockquote:rounded-r-xl
                                prose-blockquote:not-italic prose-blockquote:text-slate-700 dark:prose-blockquote:text-amber-200">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {activeArticle.content}
                                </ReactMarkdown>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-24">
            
            {/* HEROS SECTION */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 md:p-12 lg:p-16 mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between shadow-2xl">
                {/* Decorative BG */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-primary-500/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/4 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
                        <BookOpen size={14} className="text-primary-400" /> Training Hub
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
                        Master TekTrakker <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-400">Like a Pro.</span>
                    </h1>
                    <p className="text-lg text-slate-300 font-medium mb-8 max-w-xl mx-auto sm:mx-0">
                        Search our library of quick video walkthroughs and step-by-step guides to speed up your onboarding and streamline your workflow.
                    </p>

                    <div className="relative w-full max-w-xl mx-auto sm:mx-0 group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                            <Search size={20} />
                        </div>
                        <input 
                            type="text" 
                            className="w-full bg-white/10 border border-white/20 focus:border-primary-500 focus:bg-white/20 focus:ring-4 focus:ring-primary-500/20 rounded-2xl py-4 pl-12 pr-6 text-white placeholder-slate-400 font-medium transition-all backdrop-blur-md shadow-inner text-lg outline-none"
                            placeholder="How do I dispatch a job?..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Micro-Interaction Metric (Gamification Mock) */}
                <div className="relative z-10 mt-12 sm:mt-0 hidden md:flex flex-col items-center p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shrink-0">
                    <svg className="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="56" className="stroke-white/10 fill-none stroke-[8]"></circle>
                        <circle 
                            cx="64" cy="64" r="56" 
                            className="stroke-primary-500 fill-none stroke-[8] transition-all duration-1000 ease-out"
                            strokeDasharray="351"
                            strokeDashoffset={351 - (351 * completedModules.length) / 8}
                        ></circle>
                    </svg>
                    <div className="absolute top-[35px] left-1/2 -translate-x-1/2 text-center">
                        <span className="text-3xl font-black text-white">{completedModules.length}</span><span className="text-xs text-slate-400">/8</span>
                    </div>
                    <p className="text-white text-sm font-bold mt-4 tracking-wide text-center">Onboarding<br/>Progress</p>
                </div>
            </div>

            {/* CATEGORY FILTERS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide shrink-0 mask-image-fade-right">
                <button 
                    onClick={() => setSelectedCategory('All')}
                    className={`px-5 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all shadow-sm ${selectedCategory === 'All' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                    All Guides
                </button>
                {trainingCategories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-5 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all shadow-sm ${selectedCategory === cat ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* GRID OF MODULES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredArticles.length === 0 ? (
                    <div className="col-span-full py-16 text-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                        <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No guides found</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">We couldn't find any training materials matching "{searchQuery}". Try a different keyword!</p>
                    </div>
                ) : (
                    filteredArticles.map((article, i) => (
                        <div 
                            key={article.id} 
                            onClick={() => setActiveArticle(article)}
                            className={`group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden cursor-pointer hover:shadow-xl hover:border-primary-400/50 transition-all hover:-translate-y-1 animate-fade-in delay-${i * 50}`}
                        >
                            <style>{`.delay-${i * 50} { animation-delay: ${i * 50}ms; }`}</style>
                            <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                                <img 
                                    src={article.thumbnailUrl} 
                                    alt={article.title}
                                    className="w-full h-full object-cover opacity-90 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500"
                                />
                                <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/0 transition-colors" />
                                
                                <div className="absolute top-3 left-3 flex gap-2">
                                    <span className="px-2 py-1 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-md border border-white/10 flex items-center gap-1.5">
                                        <article.icon size={12} /> {article.category}
                                    </span>
                                </div>

                                {completedModules.includes(article.id) && (
                                    <div className="absolute top-3 right-3 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800 z-10">
                                        <CheckCircle2 size={14} />
                                    </div>
                                )}

                                <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono rounded-md border border-white/10 flex items-center gap-1.5 shadow-sm">
                                    <Clock size={12} /> {article.duration}
                                </div>

                                {/* Hover Play Button Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 pointer-events-none">
                                    <div className="w-14 h-14 bg-primary-500/90 backdrop-blur-sm text-white rounded-full flex items-center justify-center shadow-2xl shadow-primary-500/50">
                                        <Play className="ml-1" fill="currentColor" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-5 flex-1 flex flex-col text-left">
                                <h3 className="font-bold text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-primary-500 transition-colors line-clamp-2">
                                    {article.title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 flex-1 mb-4 leading-relaxed">
                                    {article.description}
                                </p>
                                
                                <div className="flex items-center justify-between text-xs text-primary-600 dark:text-primary-400 font-bold border-t border-slate-100 dark:border-slate-800 pt-4 mt-auto">
                                    Read Article
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Disclaimer / Helper Text */}
            <div className="mt-16 bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/10 dark:to-indigo-900/10 border border-primary-100 dark:border-primary-800/50 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-sm">
                <div className="absolute -right-10 -top-10 text-primary-200 dark:text-primary-800/20 opacity-50 pointer-events-none transform rotate-12">
                     <MessageSquare size={160} strokeWidth={1} />
                </div>
                <div className="relative z-10 flex-1">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
                        Need More Training?
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-3xl">
                        If a specific task isn't covered in these videos, or if you feel that one of the tutorials isn't sufficient for your workflow, please send me an in-app message! I am always happy to help directly or record a new guide for you.
                    </p>
                </div>
                <div className="relative z-10 flex shrink-0">
                    <button 
                        onClick={() => { window.location.hash = '#/admin/messages?partner=rodzelem@gmail.com' }} 
                        className="bg-primary-600 hover:bg-primary-700 text-white font-black py-3 px-8 rounded-xl shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                    >
                        <MessageSquare size={18} /> Send Message
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrainingHub;
