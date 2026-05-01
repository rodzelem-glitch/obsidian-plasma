import React, { useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Share2, Music, Flag, ThumbsUp, Repeat2, MapPin, Star, Phone, Globe, ExternalLink } from 'lucide-react';

interface OmniPreviewBoardProps {
    baseContent: string;
    platformContent?: { fb: string; ig: string; tt: string; li: string; x: string; gb: string };
    setPlatformContent?: React.Dispatch<React.SetStateAction<{ fb: string; ig: string; tt: string; li: string; x: string; gb: string }>>;
    mediaUrl: string | null;
    orgName: string;
}

const OmniPreviewBoard: React.FC<OmniPreviewBoardProps> = ({ baseContent, platformContent, setPlatformContent, mediaUrl, orgName }) => {
    const [showSafeZones, setShowSafeZones] = useState(false);
    const profileInitial = orgName ? orgName.charAt(0).toUpperCase() : 'B';
    const fallbackImage = 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80';
    const displayMedia = mediaUrl || fallbackImage;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Omni-Channel Previews & Editor</h3>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition">
                    <input 
                        type="checkbox" 
                        checked={showSafeZones} 
                        onChange={e => setShowSafeZones(e.target.checked)}
                        className="accent-primary-600 cursor-pointer"
                    />
                    Show UI Safe Zones
                </label>
            </div>

            <div className="flex overflow-x-auto gap-8 pb-8 pt-2 px-2 snap-x hide-scrollbar">
                
                {/* Facebook Mock */}
                <div className="w-[320px] shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm snap-center">
                    <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                {profileInitial}
                            </div>
                            <div>
                                <p className="font-bold text-sm leading-tight dark:text-white">{orgName || 'Your Business'}</p>
                                <p className="text-xs text-slate-500 flex items-center gap-1">Just now • 🌎</p>
                            </div>
                        </div>
                        <MoreHorizontal className="text-slate-400" size={18} />
                    </div>
                    {(platformContent?.fb !== undefined || baseContent) && (
                        <div className="px-3 pb-2">
                            <textarea 
                                className="w-full text-sm text-slate-800 dark:text-slate-200 bg-transparent resize-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-md p-1.5 -ml-1.5 transition-all outline-none min-h-16"
                                value={platformContent?.fb !== undefined ? platformContent.fb : baseContent}
                                onChange={(e) => setPlatformContent?.(p => p ? { ...p, fb: e.target.value } : p)}
                                placeholder="Write a post..."
                            />
                        </div>
                    )}
                    <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800">
                        <img src={displayMedia} alt="Post Media" className="w-full h-full object-cover" />
                        {showSafeZones && (
                            <div className="absolute inset-0 border-4 border-emerald-500/50 pointer-events-none" />
                        )}
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between text-slate-500 border-t border-slate-100 dark:border-slate-800">
                        <button className="flex-1 flex justify-center items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 py-1.5 rounded-md text-sm font-bold transition-colors">
                            <Heart size={18} /> Like
                        </button>
                        <button className="flex-1 flex justify-center items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 py-1.5 rounded-md text-sm font-bold transition-colors">
                            <MessageCircle size={18} /> Comment
                        </button>
                        <button className="flex-1 flex justify-center items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 py-1.5 rounded-md text-sm font-bold transition-colors">
                            <Share2 size={18} /> Share
                        </button>
                    </div>
                </div>

                {/* Instagram Mock (4:5) */}
                <div className="w-[320px] shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm snap-center">
                    <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px]">
                                <div className="bg-white dark:bg-slate-900 w-full h-full rounded-full flex items-center justify-center font-bold text-xs">
                                    {profileInitial}
                                </div>
                            </div>
                            <p className="font-bold text-sm dark:text-white leading-none">{orgName || 'your_business'}</p>
                        </div>
                        <MoreHorizontal className="text-slate-900 dark:text-white" size={18} />
                    </div>
                    
                    <div className="relative aspect-[4/5] w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                        <img src={displayMedia} alt="Post Media" className="w-full h-full object-cover" />
                        {showSafeZones && (
                            <div className="absolute inset-x-0 bottom-0 h-16 bg-red-500/30 border-t border-red-500/50 flex items-center justify-center pointer-events-none">
                                <span className="text-white text-xs font-bold drop-shadow-md">IG Tag Overlay Zone</span>
                            </div>
                        )}
                        {showSafeZones && (
                            <div className="absolute inset-x-0 top-0 h-12 bg-emerald-500/20 border-b border-emerald-500/50 pointer-events-none flex items-end justify-center pb-2">
                                <span className="text-white text-xs font-bold drop-shadow-md">1080x1350 Safe Zone</span>
                            </div>
                        )}
                    </div>

                    <div className="p-3">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex gap-4">
                                <Heart className="text-slate-900 dark:text-white hover:text-slate-500 cursor-pointer" size={24} />
                                <MessageCircle className="text-slate-900 dark:text-white hover:text-slate-500 cursor-pointer" size={24} />
                                <Send className="text-slate-900 dark:text-white hover:text-slate-500 cursor-pointer" size={24} />
                            </div>
                            <Bookmark className="text-slate-900 dark:text-white hover:text-slate-500 cursor-pointer" size={24} />
                        </div>
                        <p className="text-sm font-bold mb-1 dark:text-white">1,234 likes</p>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-slate-900 dark:text-white mb-1">{orgName || 'your_business'}</span>
                            <textarea 
                                className="w-full text-sm text-slate-800 dark:text-slate-200 bg-transparent resize-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-md p-1 -ml-1 transition-all outline-none"
                                rows={4}
                                value={platformContent?.ig !== undefined ? platformContent.ig : baseContent}
                                onChange={(e) => setPlatformContent?.(p => p ? { ...p, ig: e.target.value } : p)}
                                placeholder="Caption here..."
                            />
                        </div>
                    </div>
                </div>

                {/* TikTok Mock (9:16) */}
                <div className="w-[320px] shrink-0 bg-black rounded-xl overflow-hidden shadow-lg snap-center relative aspect-[9/16]">
                    <img src={displayMedia} alt="Post Media" className="absolute inset-0 w-full h-full object-cover opacity-90" />
                    
                    {/* TikTok UI Elements */}
                    <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 drop-shadow-lg z-10">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-slate-800 flex items-center justify-center text-white font-bold">
                                {profileInitial}
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-500 rounded-full p-0.5 z-10 w-5 h-5 flex items-center justify-center font-bold text-white text-xs border border-white">
                                +
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <Heart size={32} className="text-white fill-white/20 hover:fill-red-500 cursor-pointer transition" />
                            <span className="text-white text-xs font-bold mt-1">12K</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <MessageCircle size={32} className="text-white fill-white/20 cursor-pointer" />
                            <span className="text-white text-xs font-bold mt-1">456</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <Bookmark size={32} className="text-white fill-white/20 cursor-pointer" />
                            <span className="text-white text-xs font-bold mt-1">89</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <Share2 size={32} className="text-white cursor-pointer" />
                            <span className="text-white text-xs font-bold mt-1">Share</span>
                        </div>
                        <div className="w-10 h-10 rounded-full border-8 border-slate-800 bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center animate-[spin_4s_linear_infinite]">
                           <Music size={12} className="text-white" />
                        </div>
                    </div>

                    <div className="absolute left-3 bottom-4 right-16 drop-shadow-md z-10 text-white">
                        <p className="font-bold text-sm mb-1 hover:underline cursor-pointer">@{orgName ? orgName.toLowerCase().replace(/\\s/g,'') : 'yourbusiness'}</p>
                        <textarea 
                            className="w-full text-sm font-medium text-white drop-shadow-sm bg-black/20 hover:bg-black/40 focus:bg-black/60 resize-none border border-transparent focus:border-white/30 rounded-md p-1.5 -ml-1.5 transition-all outline-none backdrop-blur-sm"
                            rows={3}
                            value={platformContent?.tt !== undefined ? platformContent.tt : baseContent}
                            onChange={(e) => setPlatformContent?.(p => p ? { ...p, tt: e.target.value } : p)}
                            placeholder="Your engaging video caption will go here..."
                        />
                        <div className="flex items-center gap-2 text-xs font-semibold mt-2">
                            <Music size={12} /> original sound - {orgName || 'Your Business'}
                        </div>
                    </div>

                    {/* TikTok Safe Zones Highlight Engine */}
                    {showSafeZones && (
                        <>
                            {/* Right UI Warning */}
                            <div className="absolute right-0 bottom-16 w-20 h-[380px] bg-red-500/40 border-l border-red-500 flex items-center justify-center flex-col gap-1 overflow-hidden pointer-events-none z-20">
                                <Flag size={16} className="text-white drop-shadow" />
                            </div>
                            {/* Bottom UI Warning */}
                            <div className="absolute left-0 bottom-0 right-0 h-32 bg-red-500/40 border-t border-red-500 flex items-start justify-center pt-2 pointer-events-none z-20">
                                <span className="text-white text-[10px] font-black uppercase tracking-wider drop-shadow-md bg-red-600/80 px-2 py-0.5 rounded">Caption Danger Zone</span>
                            </div>
                            {/* Top UI Warning */}
                            <div className="absolute left-0 top-0 right-0 h-16 bg-red-500/40 border-b border-red-500 flex items-center justify-center pointer-events-none z-20">
                            </div>
                            
                            {/* Safe Area Box */}
                            <div className="absolute right-20 left-4 top-16 bottom-32 border-4 border-dashed border-emerald-400 bg-emerald-400/10 pointer-events-none z-0 flex items-center justify-center">
                                <span className="text-white text-3xl font-black drop-shadow-xl tracking-widest uppercase rotate-[-15deg] opacity-60">Sweet Spot</span>
                            </div>
                        </>
                    )}
                </div>

                {/* LinkedIn Mock */}
                <div className="w-[320px] shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm snap-center">
                    <div className="p-3 flex items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-lg shrink-0">
                            {profileInitial}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-sm leading-tight dark:text-white truncate">{orgName || 'Your Business'}</p>
                            <p className="text-xs text-slate-500 truncate">1,234 followers</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1">Just now • <Globe size={10} /></p>
                        </div>
                    </div>
                    <div className="px-3 pb-2">
                        <textarea 
                            className="w-full text-sm text-slate-800 dark:text-slate-200 bg-transparent resize-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-md p-1.5 -ml-1.5 transition-all outline-none min-h-20"
                            value={platformContent?.li !== undefined ? platformContent.li : baseContent}
                            onChange={(e) => setPlatformContent?.(p => p ? { ...p, li: e.target.value } : p)}
                            placeholder="What do you want to talk about?"
                        />
                    </div>
                    {mediaUrl && (
                        <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-800">
                            <img src={displayMedia} alt="Post Media" className="w-full h-full object-cover" />
                            {showSafeZones && (
                                <div className="absolute inset-0 border-4 border-emerald-500/50 pointer-events-none" />
                            )}
                        </div>
                    )}
                    <div className="px-3 py-2 flex items-center justify-between text-slate-500 border-t border-slate-100 dark:border-slate-800">
                        <button className="flex-1 flex justify-center items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 py-2 rounded-md text-xs font-bold transition-colors">
                            <ThumbsUp size={16} /> Like
                        </button>
                        <button className="flex-1 flex justify-center items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 py-2 rounded-md text-xs font-bold transition-colors">
                            <MessageCircle size={16} /> Comment
                        </button>
                        <button className="flex-1 flex justify-center items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 py-2 rounded-md text-xs font-bold transition-colors">
                            <Repeat2 size={16} /> Repost
                        </button>
                        <button className="flex-1 flex justify-center items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 py-2 rounded-md text-xs font-bold transition-colors">
                            <Send size={16} /> Send
                        </button>
                    </div>
                </div>

                {/* X (Twitter) Mock */}
                <div className="w-[320px] shrink-0 bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm snap-center">
                    <div className="p-3 flex items-start gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold shrink-0">
                            {profileInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-bold text-sm dark:text-white truncate">{orgName || 'Your Business'}</span>
                                <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/></svg>
                            </div>
                            <p className="text-xs text-slate-500">@{orgName ? orgName.toLowerCase().replace(/\s/g, '') : 'yourbusiness'} · Just now</p>
                            <textarea 
                                className="w-full text-sm text-slate-900 dark:text-slate-100 bg-transparent resize-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:bg-slate-50 dark:focus:bg-slate-900 rounded-md p-1.5 -ml-1.5 transition-all outline-none mt-1 min-h-16"
                                value={platformContent?.x !== undefined ? platformContent.x : baseContent}
                                onChange={(e) => setPlatformContent?.(p => p ? { ...p, x: e.target.value } : p)}
                                placeholder="What's happening?"
                                maxLength={280}
                            />
                            <div className="flex justify-end">
                                <span className={`text-xs font-mono ${(platformContent?.x || baseContent || '').length > 260 ? 'text-red-500' : 'text-slate-400'}`}>
                                    {280 - (platformContent?.x !== undefined ? platformContent.x : baseContent).length}
                                </span>
                            </div>
                        </div>
                    </div>
                    {mediaUrl && (
                        <div className="relative mx-3 mb-3 rounded-xl overflow-hidden aspect-video bg-slate-100 dark:bg-slate-800">
                            <img src={displayMedia} alt="Post Media" className="w-full h-full object-cover" />
                            {showSafeZones && (
                                <div className="absolute inset-0 border-4 border-emerald-500/50 pointer-events-none" />
                            )}
                        </div>
                    )}
                    <div className="px-3 py-2 flex items-center justify-between text-slate-400 border-t border-slate-100 dark:border-slate-800">
                        <button className="flex items-center gap-1 hover:text-blue-500 transition text-xs"><MessageCircle size={16} /> 0</button>
                        <button className="flex items-center gap-1 hover:text-green-500 transition text-xs"><Repeat2 size={16} /> 0</button>
                        <button className="flex items-center gap-1 hover:text-red-500 transition text-xs"><Heart size={16} /> 0</button>
                        <button title="Bookmark" className="flex items-center gap-1 hover:text-blue-500 transition text-xs"><Bookmark size={16} /></button>
                        <button title="Share" className="flex items-center gap-1 hover:text-blue-500 transition text-xs"><ExternalLink size={16} /></button>
                    </div>
                </div>

                {/* Google Business Profile Mock */}
                <div className="w-[320px] shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm snap-center">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 flex items-center gap-2">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        <span className="text-white font-bold text-sm">Google Business Profile</span>
                    </div>
                    <div className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                {profileInitial}
                            </div>
                            <div>
                                <p className="font-bold text-sm dark:text-white">{orgName || 'Your Business'}</p>
                                <div className="flex items-center gap-1 text-xs text-yellow-500">
                                    <Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" />
                                    <span className="text-slate-500 ml-1">4.9 (128)</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                            <span className="flex items-center gap-1"><MapPin size={12} /> Local Service</span>
                            <span className="flex items-center gap-1"><Phone size={12} /> Call</span>
                            <span className="flex items-center gap-1"><Globe size={12} /> Website</span>
                        </div>
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-800 px-3 pt-2 pb-1">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Latest Update</p>
                    </div>
                    {mediaUrl && (
                        <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-800">
                            <img src={displayMedia} alt="Post Media" className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div className="px-3 py-2">
                        <textarea 
                            className="w-full text-sm text-slate-800 dark:text-slate-200 bg-transparent resize-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-md p-1.5 -ml-1.5 transition-all outline-none min-h-16"
                            value={platformContent?.gb !== undefined ? platformContent.gb : baseContent}
                            onChange={(e) => setPlatformContent?.(p => p ? { ...p, gb: e.target.value } : p)}
                            placeholder="Share an update with your customers..."
                        />
                        <p className="text-xs text-slate-400 mt-1">Posted just now</p>
                    </div>
                    <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                        <button className="flex-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 py-2 rounded-md hover:bg-blue-100 transition">Learn More</button>
                        <button className="flex-1 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 py-2 rounded-md hover:bg-slate-100 transition">Call Now</button>
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
            .hide-scrollbar::-webkit-scrollbar {
                display: none;
            }
            .hide-scrollbar {
                -ms-overflow-style: none; /* IE and Edge */
                scrollbar-width: none; /* Firefox */
            }
            `}}></style>
        </div>
    );
};

export default OmniPreviewBoard;
