const fs = require('fs');

function fixFile(filePath) {
    let c = fs.readFileSync(filePath, 'utf8');

    // Fix remaining setContent
    c = c.replace(/setContent\(/g, "setBaseContent(");

    // Fix remaining content variables if they are standalone
    c = c.replace(/\{content\}/g, "{baseContent}");
    c = c.replace(/content \?/g, "baseContent ?");
    c = c.replace(/content \|\|/g, "baseContent ||");
    c = c.replace(/!content/g, "!baseContent");
    c = c.replace(/content,/g, "baseContent,");
    c = c.replace(/content:/g, "baseContent:");
    
    // Reverse the bad ones we might have just caused
    c = c.replace(/baseContent: platformContent/g, "content: platformContent"); // Revert gbFn({ baseContent: platformContent.gb ... }) back to content:
    c = c.replace(/baseContent: baseContent,/g, "content: baseContent,");
    
    c = c.replace(/value=\{content\}/g, "value={baseContent}");
    c = c.replace(/t\.content/g, "t.baseContent");

    // Fix OmniPreviewBoard props if broken
    c = c.replace(/baseContent=\{baseContent\}/g, "baseContent={baseContent}");

    // The AI block string had a hardcoded 'content'
    c = c.replace(/isRefinement && content \?/g, "isRefinement && baseContent ?");
    c = c.replace(/"\$\{content\}"/g, '"${baseContent}"');

    fs.writeFileSync(filePath, c);
}

fixFile('src/pages/admin/SocialMediaHub.tsx');
fixFile('src/pages/master/MasterSocialMediaHub.tsx');

