const fs = require('fs');

let c = fs.readFileSync('src/pages/master/MasterSocialMediaHub.tsx', 'utf8');

c = c.replace(/const \[content, setContent\] = useState\(''\);/, `const [baseContent, setBaseContent] = useState('');
    const [platformContent, setPlatformContent] = useState({ fb: '', ig: '', tt: '', li: '', x: '', gb: '' });`);

const origHandleGenAI = `    const handleGenerateAI = async (isRefinement = false) => {
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

const newHandleGenAI = `    const handleGenerateAI = async (isRefinement = false) => {
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

if(c.includes(origHandleGenAI)) {
    c = c.replace(origHandleGenAI, newHandleGenAI);
}

// Fix save draft logic
c = c.replace(/if \(\!content\.trim\(\)/g, "if (!baseContent.trim()");
c = c.replace(/content,/g, "content: baseContent,");
c = c.replace(/message: content: baseContent,/g, "message: platformContent.fb || baseContent,");
c = c.replace(/caption: content: baseContent,/g, "caption: platformContent.ig || baseContent,");

// Update handlePostContent to use platform elements
c = c.replace(/ttFn\(\{ content: baseContent, mediaUrl, accessToken:/, "ttFn({ content: platformContent.tt || baseContent, mediaUrl, accessToken:");
c = c.replace(/message: baseContent, access_token: targetPage\.access_token/g, "message: platformContent.fb || baseContent, access_token: targetPage.access_token");
c = c.replace(/caption: baseContent, access_token: targetPage\.access_token/g, "caption: platformContent.ig || baseContent, access_token: targetPage.access_token");


// Update textarea bindings
c = c.replace(/<textarea[\s\S]*?value=\{baseContent\}[\s\S]*?onChange=\{\(e\) => setContent\(e\.target\.value\)\}/, 
`<textarea 
                            value={baseContent}
                            onChange={(e) => {
                                setBaseContent(e.target.value);
                                setPlatformContent({
                                    fb: e.target.value,
                                    ig: e.target.value,
                                    tt: e.target.value,
                                    li: e.target.value,
                                    x: e.target.value,
                                    gb: e.target.value
                                });
                            }}`);
c = c.replace(/<textarea[\s\S]*?value=\{content\}[\s\S]*?onChange=\{\(e\) => setContent\(e\.target\.value\)\}/, 
`<textarea 
                            value={baseContent}
                            onChange={(e) => {
                                setBaseContent(e.target.value);
                                setPlatformContent({
                                    fb: e.target.value,
                                    ig: e.target.value,
                                    tt: e.target.value,
                                    li: e.target.value,
                                    x: e.target.value,
                                    gb: e.target.value
                                });
                            }}`);

// Fix OmniPreviewBoard binding at bottom 
c = c.replace(/<OmniPreviewBoard[\s\S]*?content=\{b?a?s?e?content\}[\s\S]*?\/>/i, 
`<OmniPreviewBoard 
                    baseContent={baseContent}
                    platformContent={platformContent}
                    setPlatformContent={setPlatformContent}
                    mediaUrl={mediaUrl} 
                    orgName={'TekTrakker Master'} 
                />`);
c = c.replace(/<OmniPreviewBoard[\s\S]*?content=\{content\}[\s\S]*?\/>/, 
`<OmniPreviewBoard 
                    baseContent={baseContent}
                    platformContent={platformContent}
                    setPlatformContent={setPlatformContent}
                    mediaUrl={mediaUrl} 
                    orgName={'TekTrakker Master'} 
                />`);

// Fix templates mapping
c = c.replace(/setContent\(t\.content\);/g, "setBaseContent(t.content); setPlatformContent({ fb: t.content, ig: t.content, tt: t.content, li: t.content, x: t.content, gb: t.content });");

// Fix final state clear
c = c.replace(/setContent\(''\);/, "setBaseContent(''); setPlatformContent({ fb: '', ig: '', tt: '', li: '', x: '', gb: '' });");


fs.writeFileSync('src/pages/master/MasterSocialMediaHub.tsx', c);
