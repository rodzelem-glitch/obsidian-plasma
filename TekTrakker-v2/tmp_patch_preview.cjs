const fs = require('fs');

let c = fs.readFileSync('src/pages/admin/SocialMediaHub.tsx', 'utf8');

c = c.replace(/import \{ TwitterAuthProvider, GoogleAuthProvider, linkWithPopup, signInWithPopup \} from 'firebase\/auth';\r?\nimport \{ TwitterAuthProvider, GoogleAuthProvider, linkWithPopup, signInWithPopup \} from 'firebase\/auth';/, "import { TwitterAuthProvider, GoogleAuthProvider, linkWithPopup, signInWithPopup } from 'firebase/auth';");

const targetPoint = `            </div>

            {templates.length > 0 && (`;

const insertion = `            </div>

            <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-8">
                <OmniPreviewBoard 
                    content={content} 
                    mediaUrl={mediaUrl} 
                    orgName={state.currentOrganization?.name || ''} 
                />
            </div>

            {templates.length > 0 && (`;

c = c.replace(targetPoint, insertion);

// Do the same for MasterSocialMediaHub if necessary
let cMaster = fs.readFileSync('src/pages/master/MasterSocialMediaHub.tsx', 'utf8');
cMaster = cMaster.replace(targetPoint, insertion);
cMaster = cMaster.replace(/import \{ TwitterAuthProvider, GoogleAuthProvider, linkWithPopup, signInWithPopup \} from 'firebase\/auth';\r?\nimport \{ TwitterAuthProvider, GoogleAuthProvider, linkWithPopup, signInWithPopup \} from 'firebase\/auth';/, "import { TwitterAuthProvider, GoogleAuthProvider, linkWithPopup, signInWithPopup } from 'firebase/auth';");
if (!cMaster.includes("import OmniPreviewBoard")) {
    cMaster = cMaster.replace("import { useNavigate } from 'react-router-dom';", "import { useNavigate } from 'react-router-dom';\nimport OmniPreviewBoard from 'components/common/OmniPreviewBoard';");
}

fs.writeFileSync('src/pages/admin/SocialMediaHub.tsx', c);
fs.writeFileSync('src/pages/master/MasterSocialMediaHub.tsx', cMaster);
