const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');

let count = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix rigid grids: Make grid-cols-2 stack vertically on mobile
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bgrid-cols-2\b/g, 'grid-cols-1 md:grid-cols-2');
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bgrid-cols-3\b/g, 'grid-cols-1 md:grid-cols-3');
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bgrid-cols-4\b/g, 'grid-cols-1 lg:grid-cols-4');
    
    // Some places use grid-cols-5 or more, leave them or assume they are complex dashboards
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bgrid-cols-5\b/g, 'grid-cols-2 md:grid-cols-5');

    // Fix massive paddings that squish mobile displays
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bp-8\b/g, 'p-4 md:p-8');
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bp-10\b/g, 'p-4 md:p-10');
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bp-12\b/g, 'p-6 md:p-12');
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bpx-8\b/g, 'px-4 md:px-8');
    content = content.replace(/(?<!md:|sm:|lg:|xl:)\bpy-8\b/g, 'py-4 md:py-8');

    // Fix the Tabs buttons shrinking width issue
    // Tabs are usually inside a div with bg-gray-200. Let's look for button patterns inside such files.
    // Actually, looking for buttons with activeTab conditions and uppercase text is standard for TekTrakker tabs!
    // Example: className={`px-4 py-2 text-sm font-bold rounded-md uppercase ${activeTab === t ?
    content = content.replace(/className={`px-4 py-2 text-sm font-bold(.*?)(rounded-md|uppercase)(.*?)`}/g, (match) => {
        if (!match.includes('shrink-0')) {
            return match.replace(/className={`/, 'className={`shrink-0 min-w-max whitespace-nowrap ');
        }
        return match;
    });

    content = content.replace(/className={`flex-1 px-4 py-2(.*?)`}/g, (match) => {
        if (!match.includes('shrink-0') && match.includes('activeTab')) {
            return match.replace(/flex-1 /, 'flex-1 shrink-0 min-w-[120px] whitespace-nowrap ');
        }
        return match;
    });
    
    content = content.replace(/className={`px-4 py-2 text-sm font-medium(.*?)`}/g, (match) => {
        if (!match.includes('shrink-0') && match.includes('activeTab')) {
            return match.replace(/className={`/, 'className={`shrink-0 min-w-max whitespace-nowrap ');
        }
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(file, content);
        count++;
        console.log(`Responsive layout updated globally for: ${file}`);
    }
}

console.log(`Processed ${count} files for Mobile UX.`);
