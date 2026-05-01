const fs = require('fs');

const liAdditions = `    const handleConnectLI = () => {
        setIsLIConnecting(true);
        const clientId = '86fh8gh2o2gdzj'; 
        const redirectUri = 'https://app.tektrakker.com/auth/callback';
        const stateStr = 'linkedin';
        const scope = 'w_member_social'; // or correct scope
        window.location.href = \`https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=\${clientId}&redirect_uri=\${encodeURIComponent(redirectUri)}&state=\${stateStr}&scope=\${scope}\`;
    };

    const handleDisconnectLI = () => {
        localStorage.removeItem('tenant_li_token');
        localStorage.removeItem('master_li_token');
        localStorage.removeItem('tenant_li_auth');
        localStorage.removeItem('master_li_auth');
        setIsLIConnected(false);
        setPostToLI(false);
        setSuccessMsg("LinkedIn Account disconnected successfully.");
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const handleConnectFB = async () => {`;

function patchFile(filepath) {
    let c = fs.readFileSync(filepath, 'utf8');
    c = c.split('    const handleConnectFB = async () => {').join(liAdditions);
    fs.writeFileSync(filepath, c);
}

patchFile('src/pages/admin/SocialMediaHub.tsx');
patchFile('src/pages/master/MasterSocialMediaHub.tsx');
