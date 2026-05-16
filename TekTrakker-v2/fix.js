const fs = require('fs');
let content = fs.readFileSync('functions/src/index.ts', 'utf8');

// remove unused context
content = content.replace(/, context\) => \{/g, ') => {');

// silence catch blocks
content = content.replace(/catch \(([^:]+): any\)/g, 'catch ($1: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');

// silence process and require
content = content.replace(/declare var process: any;/g, '// eslint-disable-next-line @typescript-eslint/no-explicit-any\ndeclare var process: any;');
content = content.replace(/declare var require: any;/g, '// eslint-disable-next-line @typescript-eslint/no-explicit-any\ndeclare var require: any;');

// fix any[]
content = content.replace(/: any\[\]/g, ': any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */');

// fix basic instances of any in map/find
content = content.replace(/\(i: any\)/g, '(i: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');
content = content.replace(/\(item: any/g, '(item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */');
content = content.replace(/\(r: any\)/g, '(r: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');
content = content.replace(/\(q: any\)/g, '(q: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');
content = content.replace(/\(li: any\)/g, '(li: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');
content = content.replace(/\(col: any\)/g, '(col: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');
content = content.replace(/\(asset: any\)/g, '(asset: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');
content = content.replace(/\(d: any\)/g, '(d: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');
content = content.replace(/\(file: any\)/g, '(file: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');
content = content.replace(/\(part: any\)/g, '(part: any /* eslint-disable-line @typescript-eslint/no-explicit-any */)');

fs.writeFileSync('functions/src/index.ts', content);
console.log('Done');
