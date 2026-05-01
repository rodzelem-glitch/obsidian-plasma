const fs = require('fs');

// 1. Fix index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');

// Fix viewport
indexHtml = indexHtml.replace(
    /name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"/g,
    'name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"'
);

// Fix text-size-adjust
indexHtml = indexHtml.replace(
    /\\-webkit-text-size-adjust: 100%;/g,
    'text-size-adjust: 100%;\\n      -webkit-text-size-adjust: 100%;'
);
indexHtml = indexHtml.replace(
    /\\-ms-text-size-adjust: 100%;/g,
    '' // remove it or replace, wait let's just do a blanket replacement of the style block if possible.
);

fs.writeFileSync('index.html', indexHtml);
console.log("index.html fixed.");
