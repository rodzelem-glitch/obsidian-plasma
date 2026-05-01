const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(
    /import \{ DollarSign([^}]*)\} from 'lucide-react';/,
    "import { DollarSign$1, ArrowLeft } from 'lucide-react';"
  );
  content = content.replace(
    /<header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">\s*<div className="flex flex-wrap gap-2">/,
    `<header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Sales Overview</h1>
                </div>
                <div className="flex flex-wrap gap-2">`
  );
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Patched ' + filepath);
}

patchFile('src/pages/sales/SalesOverview.tsx');
