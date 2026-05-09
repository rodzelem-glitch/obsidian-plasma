const fs = require('fs');
const path = require('path');

function processDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

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
                                console.log(`Copied ${nestedItemPath} to ${newPath}`);
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
