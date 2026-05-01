const fs = require('fs');

const adminPath = 'src/pages/admin/SocialMediaHub.tsx';
let c = fs.readFileSync(adminPath, 'utf8');

c = c.replace("const [content, setContent] = useState('');", "const [baseContent, setBaseContent] = useState('');\n    const [platformContent, setPlatformContent] = useState({ fb: '', ig: '', tt: '', li: '', x: '', gb: '' });");

const oldAI = `    const handleGenerateAI = async (isRefinement = false) => {
        setIsGenerating(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI', { timeout: 300000 });
            const orgInfo = \`Business Name: \${state.currentOrganization?.name || 'Local Service Business'}. Contact Email: \${state.currentOrganization?.email || ''}\`;
            const contextMsg = isRefinement && content ? \`Refine this existing draft: "\${content}"\\n\\nNew instructions: \` : \`Create a completely new social media post.\\n\\nInstructions: \`;
            const finalPrompt = \`Act as an expert social media manager for the following business: \${orgInfo}.\\n\\n\${contextMsg}\${aiPrompt || 'Make it an engaging, organic post with popular hashtags.'}\\n\\nRules: Keep it under 500 characters, highly engaging, professional but conversational. Do not use quotes around the output.\`;
            const result: any = await callGeminiAI({ prompt: finalPrompt });
            if (result.data?.text) {
                setContent(result.data.text.replace(/^["']|["']$/g, ''));
            }
        } catch (error) {
            console.error("AI Gen Failed:", error);
            setErrorMsg("Failed to generate AI post.");
        } finally {
            setIsGenerating(false);
        }
    };`;

const newAI = `    const handleGenerateAI = async (isRefinement = false) => {
        setIsGenerating(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI', { timeout: 300000 });
            const orgInfo = \`Business Name: \${state.currentOrganization?.name || 'Local Service Business'}.\`;
            const contextMsg = isRefinement && baseContent ? \`Refine this existing draft: "\${baseContent}"\\n\\nNew instructions: \` : \`Create a completely new social media post.\\n\\nInstructions: \`;
            const finalPrompt = \`Act as an expert social media manager for: \${orgInfo}.\\n\\n\${contextMsg}\${aiPrompt || 'Make it an engaging, organic post.'}\\n\\nYou MUST return a raw JSON object exactly with this shape, and NOTHING else:\\n{\\n "fb": "...",\\n "ig": "...",\\n "tt": "...",\\n "li": "..."\\n}\\n\\nRULES:\\n"fb" = Fun, conversational, moderate length.\\n"ig" = Action driven, extremely visual descriptions, exactly 5 hashtags.\\n"tt" = Very short, hook-based text. Add #fyp.\\n"li" = Professional tone, industry insights format.\`;
            const result: any = await callGeminiAI({ prompt: finalPrompt });
            if (result.data?.text) {
                try {
                    let parsedText = result.data.text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
                    const platformGen = JSON.parse(parsedText);
                    setPlatformContent((prev) => ({
                        ...prev,
                        fb: platformGen.fb || baseContent,
                        ig: platformGen.ig || baseContent,
                        tt: platformGen.tt || baseContent,
                        li: platformGen.li || baseContent,
                        gb: platformGen.fb || baseContent,
                        x: platformGen.x || platformGen.tt || baseContent
                    }));
                    setSuccessMsg("AI Omni-Channel adaptations generated!");
                    setTimeout(() => setSuccessMsg(''), 3000);
                } catch(e) {
                   console.error("Failed to parse JSON", e);
                   setBaseContent(result.data.text.replace(/^["']|["']$/g, ''));
                }
            }
        } catch (error) {
            console.error("AI Gen Failed:", error);
            setErrorMsg("Failed to generate AI post.");
        } finally {
            setIsGenerating(false);
        }
    };`;

c = c.replace(oldAI, newAI);

c = c.replace("if (!content.trim()", "if (!baseContent.trim()");
c = c.replace("                content,", "                content: baseContent,");

c = c.replace("gbFn({ content, accessToken:", "gbFn({ content: platformContent.gb || baseContent, accessToken:");
c = c.replace("ttFn({ content, mediaUrl, accessToken:", "ttFn({ content: platformContent.tt || baseContent, mediaUrl, accessToken:");
c = c.replace("message: content, access_token:", "message: platformContent.fb || baseContent, access_token:");
c = c.replace("caption: content, access_token:", "caption: platformContent.ig || baseContent, access_token:");
c = c.replace("message: content, access_token:", "message: platformContent.fb || baseContent, access_token:"); // second replace for fb photos vs feed

const oldTextarea = `<textarea 
                            className="w-full h-40 p-4 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 resize-none font-medium dark:text-white"
                            placeholder="What do you want to share with your audience?"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />`;
const newTextarea = `<textarea 
                            className="w-full h-40 p-4 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 resize-none font-medium dark:text-white"
                            placeholder="What do you want to share with your audience?"
                            value={baseContent}
                            onChange={(e) => {
                                setBaseContent(e.target.value);
                                setPlatformContent(p => ({ fb: e.target.value, ig: e.target.value, tt: e.target.value, li: e.target.value, x: e.target.value, gb: e.target.value }));
                            }}
                        />`;
c = c.replace(oldTextarea, newTextarea);

const oldBoard = `<OmniPreviewBoard 
                    content={content} 
                    mediaUrl={mediaUrl} 
                    orgName={state.currentOrganization?.name || ''} 
                />`;
const newBoard = `<OmniPreviewBoard 
                    baseContent={baseContent}
                    platformContent={platformContent}
                    setPlatformContent={setPlatformContent}
                    mediaUrl={mediaUrl} 
                    orgName={state.currentOrganization?.name || ''} 
                />`;
c = c.replace(oldBoard, newBoard);

c = c.replace("setContent(t.content);", "setBaseContent(t.content); setPlatformContent({ fb: t.content, ig: t.content, tt: t.content, li: t.content, x: t.content, gb: t.content });");
c = c.replace("setContent('');", "setBaseContent(''); setPlatformContent({ fb: '', ig: '', tt: '', li: '', x: '', gb: '' });");

fs.writeFileSync(adminPath, c);


const masterPath = 'src/pages/master/MasterSocialMediaHub.tsx';
let m = fs.readFileSync(masterPath, 'utf8');

m = m.replace("const [content, setContent] = useState('');", "const [baseContent, setBaseContent] = useState('');\n    const [platformContent, setPlatformContent] = useState({ fb: '', ig: '', tt: '', li: '', x: '', gb: '' });");

const oldAIM = `    const handleGenerateAI = async (isRefinement = false) => {
        setIsGenerating(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI', { timeout: 300000 });
            const contextMsg = isRefinement && content ? \`Refine this existing draft: "\${content}"\\n\\nNew instructions: \` : \`Create a completely new social media post.\\n\\nInstructions: \`;
            const finalPrompt = \`Act as an expert social media manager for the master platform administrator.\\n\\n\${contextMsg}\${aiPrompt || 'Make it an engaging, organic post with popular hashtags.'}\\n\\nRules: Keep it under 500 characters, highly engaging, professional but conversational. Do not use quotes around the output.\`;
            const result: any = await callGeminiAI({ prompt: finalPrompt });
            if (result.data?.text) {
                setContent(result.data.text.replace(/^["']|["']$/g, ''));
            }
        } catch (error) {
            console.error("AI Gen Failed:", error);
            setErrorMsg("Failed to generate AI post.");
        } finally {
            setIsGenerating(false);
        }
    };`;

const newAIM = `    const handleGenerateAI = async (isRefinement = false) => {
        setIsGenerating(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI', { timeout: 300000 });
            const contextMsg = isRefinement && baseContent ? \`Refine this existing draft: "\${baseContent}"\\n\\nNew instructions: \` : \`Create a completely new social media post.\\n\\nInstructions: \`;
            const finalPrompt = \`Act as an expert social media manager for the master platform administrator.\\n\\n\${contextMsg}\${aiPrompt || 'Make it an engaging, organic post.'}\\n\\nYou MUST return a raw JSON object exactly with this shape, and NOTHING else:\\n{\\n "fb": "...",\\n "ig": "...",\\n "tt": "...",\\n "li": "..."\\n}\\n\\nRULES:\\n"fb" = Fun, conversational, moderate length.\\n"ig" = Action driven, extremely visual descriptions, exactly 5 hashtags.\\n"tt" = Very short, hook-based text. Add #fyp.\\n"li" = Professional tone, industry insights format.\`;
            const result: any = await callGeminiAI({ prompt: finalPrompt });
            if (result.data?.text) {
                try {
                    let parsedText = result.data.text.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
                    const platformGen = JSON.parse(parsedText);
                    setPlatformContent((prev) => ({
                        ...prev,
                        fb: platformGen.fb || baseContent,
                        ig: platformGen.ig || baseContent,
                        tt: platformGen.tt || baseContent,
                        li: platformGen.li || baseContent,
                        gb: platformGen.fb || baseContent,
                        x: platformGen.x || platformGen.tt || baseContent
                    }));
                    setSuccessMsg("AI Omni-Channel adaptations generated!");
                    setTimeout(() => setSuccessMsg(''), 3000);
                } catch(e) {
                   console.error("Failed to parse JSON", e);
                   setBaseContent(result.data.text.replace(/^["']|["']$/g, ''));
                }
            }
        } catch (error) {
            console.error("AI Gen Failed:", error);
            setErrorMsg("Failed to generate AI post.");
        } finally {
            setIsGenerating(false);
        }
    };`;

m = m.replace(oldAIM, newAIM);

m = m.replace("if (!content.trim()", "if (!baseContent.trim()");
m = m.replace("                content,", "                content: baseContent,");

m = m.replace("gbFn({ content, accessToken:", "gbFn({ content: platformContent.gb || baseContent, accessToken:");
m = m.replace("ttFn({ content, mediaUrl, accessToken:", "ttFn({ content: platformContent.tt || baseContent, mediaUrl, accessToken:");
m = m.replace("message: content, access_token:", "message: platformContent.fb || baseContent, access_token:");
m = m.replace("caption: content, access_token:", "caption: platformContent.ig || baseContent, access_token:");
m = m.replace("message: content, access_token:", "message: platformContent.fb || baseContent, access_token:"); 


const oldTextareaM = `<textarea 
                            className="w-full h-40 p-4 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 resize-none font-medium dark:text-white"
                            placeholder="What do you want to share with your audience?"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />`;
const newTextareaM = `<textarea 
                            className="w-full h-40 p-4 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 resize-none font-medium dark:text-white"
                            placeholder="What do you want to share with your audience?"
                            value={baseContent}
                            onChange={(e) => {
                                setBaseContent(e.target.value);
                                setPlatformContent(p => ({ fb: e.target.value, ig: e.target.value, tt: e.target.value, li: e.target.value, x: e.target.value, gb: e.target.value }));
                            }}
                        />`;
m = m.replace(oldTextareaM, newTextareaM);

const oldBoardM = `<OmniPreviewBoard 
                    content={content} 
                    mediaUrl={mediaUrl} 
                    orgName="Master Admin"
                />`;
const newBoardM = `<OmniPreviewBoard 
                    baseContent={baseContent}
                    platformContent={platformContent}
                    setPlatformContent={setPlatformContent}
                    mediaUrl={mediaUrl} 
                    orgName="Master Admin"
                />`;
m = m.replace(oldBoardM, newBoardM);

m = m.replace("setContent(t.content);", "setBaseContent(t.content); setPlatformContent({ fb: t.content, ig: t.content, tt: t.content, li: t.content, x: t.content, gb: t.content });");
m = m.replace("setContent('');", "setBaseContent(''); setPlatformContent({ fb: '', ig: '', tt: '', li: '', x: '', gb: '' });");

fs.writeFileSync(masterPath, m);
