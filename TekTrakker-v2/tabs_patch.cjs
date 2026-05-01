const fs = require('fs');

function patch(file) {
    let raw = fs.readFileSync(file, 'utf8');
    
    // Add import
    raw = raw.replace("import { useNavigate } from 'react-router-dom';", 
        "import { useNavigate } from 'react-router-dom';\nimport SocialCalendar from 'components/social/SocialCalendar';");
        
    // Add state variable
    raw = raw.replace("const [baseContent, setBaseContent] = useState('');",
        "const [currentView, setCurrentView] = useState<'composer' | 'calendar'>('composer');\n    const [baseContent, setBaseContent] = useState('');");
    
    // Add Tabs below header
    const searchHeader = `            </header>`;
    const insertTabs = `            </header>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 w-max mb-6">
                <button 
                    onClick={() => setCurrentView('composer')}
                    className={\`px-4 py-2 text-sm font-bold rounded-md transition-colors \${currentView === 'composer' ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}\`}
                >Composer</button>
                <button 
                    onClick={() => setCurrentView('calendar')}
                    className={\`px-4 py-2 text-sm font-bold rounded-md transition-colors \${currentView === 'calendar' ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}\`}
                >Calendar</button>
            </div>`;
    raw = raw.replace(searchHeader, insertTabs);

    // Add conditional wrapper around main view
    const searchCondition = `<div className="grid grid-cols-1 md:grid-cols-3 gap-6">`;
    const insertWrapper = `{currentView === 'calendar' ? (
                <SocialCalendar 
                    orgId={state.currentOrganization?.id || null} 
                    isMaster={file.includes('Master')}
                    templates={templates} 
                    onDataChanged={fetchTemplates} 
                />
            ) : (
                <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">`;
    raw = raw.replace(searchCondition, insertWrapper);
    
    // Conclude conditional wrapper at the very bottom before closing div tag
    const searchFooter = `            {templates.length > 0 && (
                <div className="mt-8">`;
    const insertFooter = `            {templates.length > 0 && (
                <div className="mt-8">`;
    
    // Actually, `templates.length > 0` might be at the bottom.
    // Instead of messing with JSX closing braces at the bottom via string replacement (which is very brittle),
    // let me do a simpler closure logic.
    // Replace the final `</div>\n    );\n};` with `</>\n            )}\n        </div>\n    );\n};`
    raw = raw.replace(/        <\/div>\r?\n    \);\r?\n};/g, "            </>\n            )}\n        </div>\n    );\n};");

    fs.writeFileSync(file, raw);
}

patch('src/pages/admin/SocialMediaHub.tsx');
patch('src/pages/master/MasterSocialMediaHub.tsx');

