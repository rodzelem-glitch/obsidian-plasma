const fs = require('fs');
const path = require('path');

function processDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isFile() && item.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Injects dynamic self-referencing canonical & alternate tags
            const relativePath = path.relative(outDir, fullPath).replace(/\\/g, '/');
            if (item !== '404.html' && !relativePath.includes('_not-found')) {
                // Calculate correct canonical path
                let cleanPath = '/' + relativePath.replace(/index\.html$/, '');
                if (!cleanPath.endsWith('/')) {
                    cleanPath += '/';
                }
                const canonicalUrl = `https://tektrakker.com${cleanPath}`;

                // Replace incorrect canonical tag
                const canonicalRegex = /<link rel="canonical" href="[^"]*"\s*\/?>/;
                if (canonicalRegex.test(content)) {
                    content = content.replace(canonicalRegex, `<link rel="canonical" href="${canonicalUrl}"/>`);
                    modified = true;
                }

                // Replace incorrect alternate tag
                const alternateRegex = /<link rel="alternate" hrefLang="en-US" href="[^"]*"\s*\/?>/;
                if (alternateRegex.test(content)) {
                    content = content.replace(alternateRegex, `<link rel="alternate" hrefLang="en-US" href="${canonicalUrl}"/>`);
                    modified = true;
                }

                // Replace canonical inside hydration payload
                const canonicalJsonStr = '\\"rel\\":\\"canonical\\",\\"href\\":\\"https://tektrakker.com/\\"';
                const canonicalJsonReplace = `\\"rel\\":\\"canonical\\",\\"href\\":\\"${canonicalUrl}\\"`;
                if (content.includes(canonicalJsonStr)) {
                    content = content.replaceAll(canonicalJsonStr, canonicalJsonReplace);
                    modified = true;
                }

                // Replace alternate inside hydration payload
                const alternateJsonStr = '\\"rel\\":\\"alternate\\",\\"hrefLang\\":\\"en-US\\",\\"href\\":\\"https://tektrakker.com/\\"';
                const alternateJsonReplace = `\\"rel\\":\\"alternate\\",\\"hrefLang\\":\\"en-US\\",\\"href\\":\\"${canonicalUrl}\\"`;
                if (content.includes(alternateJsonStr)) {
                    content = content.replaceAll(alternateJsonStr, alternateJsonReplace);
                    modified = true;
                }
            }

            if (content.includes('<head>')) {
                content = content.replace(
                    '<head>',
                    `<head><script>(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A7280120-8afe-4b72-a064-f22dfed5844b1.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');</script>`
                );
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Processed HTML file (script injected & canonical fixed): ${fullPath}`);
            }
        }

        if (stat.isDirectory()) {
            // First recurse into subdirectories
            processDirectory(fullPath);

            // Now check if THIS directory starts with __next.
            if (item.startsWith('__next.')) {
                // E.g. out/terms/__next.terms
                // We want to move all files inside it up, renaming them with dots.
                const subItems = fs.readdirSync(fullPath);
                
                for (const subItem of subItems) {
                    const subItemPath = path.join(fullPath, subItem);
                    const subStat = fs.statSync(subItemPath);
                    
                    if (subStat.isFile()) {
                        // Move file up: out/terms/__next.terms/__PAGE__.txt -> out/terms/__next.terms.__PAGE__.txt
                        const newName = `${item}.${subItem}`;
                        const newPath = path.join(dirPath, newName);
                        fs.copyFileSync(subItemPath, newPath);
                        console.log(`Copied ${subItemPath} to ${newPath}`);
                    } else if (subStat.isDirectory() && subItem === '$d$slug') {
                        // E.g. out/industries/hvac/__next.industries/$d$slug
                        const nestedItems = fs.readdirSync(subItemPath);
                        for (const nestedItem of nestedItems) {
                            const nestedItemPath = path.join(subItemPath, nestedItem);
                            if (fs.statSync(nestedItemPath).isFile()) {
                                // Move file up: out/industries/hvac/__next.industries/$d$slug/__PAGE__.txt -> out/industries/hvac/__next.industries.$d$slug.__PAGE__.txt
                                const newName = `${item}.${subItem}.${nestedItem}`;
                                const newPath = path.join(dirPath, newName);
                                fs.copyFileSync(nestedItemPath, newPath);
                                // console.log(`Copied ${nestedItemPath} to ${newPath}`);
                            }
                        }
                    }
                }
            }
        }
    }
}

console.log('Flattening Next.js RSC payload paths for static hosting...');
const outDir = path.join(__dirname, 'out');
processDirectory(outDir);
console.log('Done flattening RSC payload paths.');
