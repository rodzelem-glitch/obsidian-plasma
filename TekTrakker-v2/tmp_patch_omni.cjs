const fs = require('fs');

let c = fs.readFileSync('src/components/common/OmniPreviewBoard.tsx', 'utf8');

c = c.replace(/interface OmniPreviewBoardProps \{[\s\S]*?\}/, `interface OmniPreviewBoardProps {
    baseContent: string;
    platformContent?: { fb: string; ig: string; tt: string; li: string; x: string; gb: string };
    setPlatformContent?: React.Dispatch<React.SetStateAction<{ fb: string; ig: string; tt: string; li: string; x: string; gb: string }>>;
    mediaUrl: string | null;
    orgName: string;
}`);

c = c.replace(/const OmniPreviewBoard: React.FC<OmniPreviewBoardProps> = \(\{ content, mediaUrl, orgName \}\) => \{/, `const OmniPreviewBoard: React.FC<OmniPreviewBoardProps> = ({ baseContent, platformContent, setPlatformContent, mediaUrl, orgName }) => {`);

// Replace the {content && ( ... )} blocks with inline Textareas.

// FB Block (Line 47)
c = c.replace(/\{content && \([\s\S]*?\{content\}[\s\S]*?<\/div>[\s\S]*?\)\}/, 
`                   <textarea 
                        className="w-full h-24 bg-transparent resize-none border border-transparent focus:border-slate-300 dark:focus:border-slate-600 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-md px-3 py-1 mb-2 text-sm text-slate-800 dark:text-slate-200"
                        value={platformContent?.fb || baseContent || ''}
                        onChange={(e) => setPlatformContent?.(p => ({ ...p, fb: e.target.value }))}
                        placeholder="Write a caption..."
                    />`);

// IG Block (Line 110)
c = c.replace(/<span className="font-bold mr-2 text-slate-900 dark:text-white">\{orgName \|\| 'your_business'\}<\/span>[\s\S]*?\{content\}[\s\S]*?<\/p>/, 
`<span className="font-bold mr-2 text-slate-900 dark:text-white">{orgName || 'your_business'}</span>
                            <textarea 
                                className="w-full mt-1 bg-transparent resize-none border border-transparent focus:border-slate-300 dark:focus:border-slate-600 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-md px-1 py-1 text-sm text-slate-800 dark:text-slate-200"
                                rows={3}
                                value={platformContent?.ig !== undefined ? platformContent.ig : baseContent}
                                onChange={(e) => setPlatformContent?.(p => ({ ...p, ig: e.target.value }))}
                                placeholder="Caption here..."
                            />
                        </p>`);

// TT Block (Line 153)
c = c.replace(/\{content || 'Your engaging video caption will go here. Add trending hashtags and a strong CTA! #viral #fyp'\}[\s\S]*?<\/p>/, 
`                           <textarea 
                                className="w-full bg-transparent resize-none border border-transparent focus:border-slate-300/30 focus:bg-black/50 rounded-md px-1 py-1 text-sm text-white drop-shadow-md"
                                rows={3}
                                value={platformContent?.tt !== undefined ? platformContent.tt : baseContent}
                                onChange={(e) => setPlatformContent?.(p => ({ ...p, tt: e.target.value }))}
                                placeholder="Your engaging video caption will go here..."
                            />
                        </p>`);


fs.writeFileSync('src/components/common/OmniPreviewBoard.tsx', c);
