
import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import { Link as LinkIcon, Copy } from 'lucide-react';

const SalesTools: React.FC = () => {
    const [utmParams, setUtmParams] = useState({
        baseUrl: 'https://tektrakker.com',
        source: '',
        medium: '',
        campaign: '',
        term: '',
        content: ''
    });
    const [generatedLink, setGeneratedLink] = useState('');

    const generateLink = () => {
        try {
            const url = new URL(utmParams.baseUrl);
            if (utmParams.source) url.searchParams.set('utm_source', utmParams.source);
            if (utmParams.medium) url.searchParams.set('utm_medium', utmParams.medium);
            if (utmParams.campaign) url.searchParams.set('utm_campaign', utmParams.campaign);
            if (utmParams.term) url.searchParams.set('utm_term', utmParams.term);
            if (utmParams.content) url.searchParams.set('utm_content', utmParams.content);
            setGeneratedLink(url.toString());
        } catch (e) {
            setGeneratedLink(utmParams.baseUrl);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedLink);
        alert("Link copied!");
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Sales Tools</h2>
                <p className="text-slate-500">Utilities to track and optimize your outreach.</p>
            </header>

            <Card className="max-w-2xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-600"><LinkIcon size={24}/> UTM Link Builder</h3>
                <div className="space-y-4">
                    <Input label="Website URL" value={utmParams.baseUrl} onChange={e => setUtmParams({...utmParams, baseUrl: e.target.value})} placeholder="https://tektrakker.com" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Campaign Source (utm_source)" value={utmParams.source} onChange={e => setUtmParams({...utmParams, source: e.target.value})} placeholder="e.g. linkedin, newsletter" />
                        <Input label="Campaign Medium (utm_medium)" value={utmParams.medium} onChange={e => setUtmParams({...utmParams, medium: e.target.value})} placeholder="e.g. cpc, email, social" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input label="Campaign Name" value={utmParams.campaign} onChange={e => setUtmParams({...utmParams, campaign: e.target.value})} placeholder="spring_sale" />
                        <Input label="Term (Keywords)" value={utmParams.term} onChange={e => setUtmParams({...utmParams, term: e.target.value})} placeholder="hvac_software" />
                        <Input label="Content" value={utmParams.content} onChange={e => setUtmParams({...utmParams, content: e.target.value})} placeholder="text_link_a" />
                    </div>

                    <div className="pt-4 border-t dark:border-slate-700">
                        <Button onClick={generateLink} className="w-full mb-4">Generate Tracking Link</Button>
                        
                        {generatedLink && (
                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg flex gap-2 items-center">
                                <code className="flex-1 text-sm break-all font-mono text-slate-600 dark:text-slate-300">{generatedLink}</code>
                                <Button onClick={copyToClipboard} variant="secondary" className="w-auto px-3"><Copy size={16}/></Button>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default SalesTools;
