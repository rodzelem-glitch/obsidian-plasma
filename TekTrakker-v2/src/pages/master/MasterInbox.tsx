import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useEffect } from 'react';
import { Mail, Send, RefreshCw, X, RefreshCcw, AlertTriangle, PenTool, Bell, Edit, Reply, ReplyAll } from 'lucide-react';
import { functions, db } from '../../lib/firebase';
import Button from '../../components/ui/Button';
import showToast from '../../lib/toast';
import { useAppContext } from '../../context/AppContext';
import DOMPurify from 'dompurify';

const MasterInbox: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [token, setToken] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sentitems'>('inbox');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftTo, setDraftTo] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [processedBodyHtml, setProcessedBodyHtml] = useState<string>('');
  const [attachmentsLoading, setAttachmentsLoading] = useState<boolean>(false);

  const defaultSignature = `
<br><br>
<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; color: #334155; margin-top: 15px;">
  <tr>
    <td style="padding-right: 16px; border-right: 2px solid #6366f1;">
      <img src="https://app.tektrakker.com/tektrakker-logo-full.png" alt="TekTrakker" width="140" style="display: block;">
    </td>
    <td style="padding-left: 16px;">
      <h3 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 700;">Master Admin</h3>
      <p style="margin: 2px 0; color: #6366f1; font-weight: 600;">TekTrakker Support & Operations</p>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">
        <a href="mailto:support@tektrakker.com" style="color: #6366f1; text-decoration: none;">support@tektrakker.com</a> | 
        <a href="https://app.tektrakker.com" style="color: #6366f1; text-decoration: none;">app.tektrakker.com</a>
      </p>
    </td>
  </tr>
</table>
`;
  const [signatureHtml, setSignatureHtml] = useState<string>(defaultSignature);

  useEffect(() => {
    if (state.currentUser?.emailSignatureHtml) {
      setSignatureHtml(state.currentUser.emailSignatureHtml);
    } else {
      setSignatureHtml(localStorage.getItem('tt_admin_signature') || defaultSignature);
    }
  }, [state.currentUser]);

  useEffect(() => {
    if (!state.currentUser) return; // Wait for Firebase Auth to initialize
    
    const checkToken = async () => {
      try {
        const getAccessToken = functions.httpsCallable('getMsalAccessToken');
        const result = await getAccessToken();
        const data = result.data as { accessToken: string };
        if (data && data.accessToken) {
          setToken(data.accessToken);
        }
      } catch (error) {
        console.log("Not logged into Microsoft yet (or error):", error);
      } finally {
        setIsInitializing(false);
      }
    };
    checkToken();
  }, [state.currentUser]);

  useEffect(() => {
    if (token) fetchInbox();
  }, [token, activeFolder]);

  useEffect(() => {
    if (!selectedMsg) {
      setProcessedBodyHtml('');
      return;
    }

    const rawContent = selectedMsg.body?.content || 'No content';
    setProcessedBodyHtml(rawContent); // Immediate render of text

    if (!selectedMsg.hasAttachments || !rawContent.includes('cid:')) {
      return;
    }

    const fetchAndReplaceAttachments = async () => {
      setAttachmentsLoading(true);
      try {
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${selectedMsg.id}/attachments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          let updatedContent = rawContent;
          if (data.value && data.value.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.value.forEach((attachment: any) => {
              if (attachment.isInline && attachment.contentId && attachment.contentBytes) {
                // Escape regex special characters in contentId
                const escapedContentId = attachment.contentId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                // Replace src="cid:contentId" or src='cid:contentId'
                const cidRegex = new RegExp(`src=["']cid:${escapedContentId}["']`, 'gi');
                updatedContent = updatedContent.replace(cidRegex, `src="data:${attachment.contentType};base64,${attachment.contentBytes}"`);
                
                // Also handle cases where cid is referenced in CSS style background or elsewhere without src prefix
                const rawCidRegex = new RegExp(`cid:${escapedContentId}`, 'gi');
                updatedContent = updatedContent.replace(rawCidRegex, `data:${attachment.contentType};base64,${attachment.contentBytes}`);
              }
            });
          }
          setProcessedBodyHtml(updatedContent);
        }
      } catch (error) {
        console.error("Error loading email attachments:", error);
      } finally {
        setAttachmentsLoading(false);
      }
    };

    fetchAndReplaceAttachments();
  }, [selectedMsg, token]);

  const handleConnect = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      const getLoginUrl = functions.httpsCallable('msalLogin');
      const result = await getLoginUrl();
      const data = result.data as { url: string };
      if (data && data.url) {
        window.location.href = data.url;
      }
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast.error("Failed to generate login URL: " + errorMessage);
      setIsAuthenticating(false);
    }
  };

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/${activeFolder}/messages?$top=20&$filter=isDraft eq false&$orderby=receivedDateTime desc`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Microsoft Graph Error:", res.status, errorText);
        
        if (res.status === 401 || res.status === 403) {
          showToast.error(`Microsoft Authentication Failed (${res.status}). Please reconnect.`);
          setToken(null);
          localStorage.removeItem('msGraphToken');
        } else {
          showToast.error(`Failed to load inbox: ${res.status} ${res.statusText}`);
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.value) {
        setMessages(data.value);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Network error fetching inbox:", error);
      showToast.error("Network error connecting to Microsoft.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (replyAll: boolean = false) => {
    if (!selectedMsg || !replyText) return;
    setSending(true);
    try {
      // Format reply with HTML breaks and append signature
      const formattedReply = replyText.replace(/\n/g, '<br>') + signatureHtml;

      const endpoint = replyAll ? 'replyAll' : 'reply';
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${selectedMsg.id}/${endpoint}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment: formattedReply
        })
      });

      if (res.ok || res.status === 202) {
        showToast.success(replyAll ? "Reply to all sent!" : "Reply sent!");
        setReplyText('');
        setSelectedMsg(null);
      } else {
        throw new Error("Failed to send");
      }
    } catch (e: unknown) {
      showToast.error("Failed to send reply: " + (e instanceof Error ? e.message : 'Unknown error'));
    }
    setSending(false);
  };

  const handleSendNewMessage = async () => {
    if (!draftTo || !draftSubject || !draftBody) return;
    setSending(true);
    try {
      const formattedBody = draftBody.replace(/\n/g, '<br>') + signatureHtml;

      const res = await fetch(`https://graph.microsoft.com/v1.0/me/sendMail`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            subject: draftSubject,
            body: {
              contentType: "HTML",
              content: formattedBody
            },
            toRecipients: [
              {
                emailAddress: {
                  address: draftTo
                }
              }
            ]
          },
          saveToSentItems: "true"
        })
      });

      if (res.ok || res.status === 202) {
        showToast.success("Message sent!");
        setIsDrafting(false);
        setDraftTo('');
        setDraftSubject('');
        setDraftBody('');
        fetchInbox();
      } else {
        const err = await res.text();
        throw new Error(err || "Failed to send message");
      }
    } catch (e: unknown) {
      showToast.error("Failed to send message: " + (e instanceof Error ? e.message : 'Unknown error'));
    }
    setSending(false);
  };

  const subscribeToPushNotifications = async () => {
    if (!token) return;
    try {
      showToast.success("Subscribing to real-time notifications...");
      
      // Calculate expiration time (max 4230 minutes for message subscriptions ~ 2.9 days)
      const expirationDateTime = new Date();
      expirationDateTime.setHours(expirationDateTime.getHours() + 65);

      const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          changeType: "created",
          notificationUrl: "https://us-central1-tektrakker.cloudfunctions.net/office365Webhook",
          resource: "me/mailFolders('Inbox')/messages",
          expirationDateTime: expirationDateTime.toISOString(),
          clientState: "tektrakker-secure-webhook-secret"
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Save the subscription ID to our backend so the webhook knows who it belongs to!
        localStorage.setItem('tt_ms_subscription_id', data.id);
        if (state.currentUser) {
            try {
                await db.collection('office365_subscriptions').doc(data.id).set(cleanUndefinedFields({
                    subscriptionId: data.id,
                    userId: state.currentUser.uid,
                    createdAt: new Date().toISOString()
                }));
            } catch (err) {
                console.error("Error saving subscription to Firestore", err);
            }
        }
        showToast.success("Push Notifications Enabled Successfully!");
      } else {
        const errorData = await res.json();
        console.error("Subscription Error:", errorData);
        showToast.error("Failed to enable notifications. Webhook may not be deployed yet.");
      }
    } catch (error) {
      console.error("Network error subscribing:", error);
      showToast.error("Network error enabling notifications.");
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Mail size={48} className="text-slate-300" />
        <h2 className="text-xl font-bold">Master Admin Inbox (Office 365)</h2>
        <p className="text-slate-500 max-w-md text-center">Connect your Microsoft Exchange/Office 365 account to read and reply to emails directly within TekTrakker.</p>
        <div className="bg-amber-50 text-amber-800 text-sm p-4 rounded-lg max-w-md mb-4 border border-amber-200 flex items-start gap-3">
           <AlertTriangle size={20} className="shrink-0 mt-0.5" />
           <p>Note: To connect GoDaddy Exchange, ensure you have configured your Azure Client ID in the <code>VITE_MSAL_CLIENT_ID</code> environment variable.</p>
        </div>
        <Button onClick={handleConnect} disabled={isInitializing || isAuthenticating}>
          {isAuthenticating ? 'Connecting...' : isInitializing ? 'Loading...' : 'Connect Microsoft Exchange'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* List */}
      <div className={`${selectedMsg ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-900">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
             <button onClick={() => { setActiveFolder('inbox'); setSelectedMsg(null); }} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeFolder === 'inbox' ? 'bg-white shadow dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Inbox</button>
             <button onClick={() => { setActiveFolder('sentitems'); setSelectedMsg(null); }} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeFolder === 'sentitems' ? 'bg-white shadow dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Sent</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setIsDrafting(true); setSelectedMsg(null); }} title="Compose New Email" aria-label="Compose New Email" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-indigo-500 hover:text-indigo-600">
              <Edit size={16} />
            </button>
            <button onClick={subscribeToPushNotifications} title="Enable Push Notifications" aria-label="Enable Push Notifications" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-indigo-500 hover:text-indigo-600">
              <Bell size={16} />
            </button>
            <button onClick={() => setShowSignatureModal(true)} title="Signature Settings" aria-label="Signature Settings" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500">
              <PenTool size={16} />
            </button>
            <button onClick={fetchInbox} title="Refresh Inbox" aria-label="Refresh Inbox" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500">
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && messages.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading emails...</div>
          ) : messages.map((msg, i) => {
            const subject = msg.subject || '(No Subject)';
            const from = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown';
            const to = msg.toRecipients && msg.toRecipients.length > 0 ? (msg.toRecipients[0].emailAddress?.name || msg.toRecipients[0].emailAddress?.address) : 'Unknown';
            const displayName = activeFolder === 'sentitems' ? `To: ${to}` : from;
            const date = new Date(msg.receivedDateTime).toLocaleDateString();
            return (
              <div 
                key={i} 
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedMsg(msg); setIsDrafting(false); e.preventDefault(); } }}
                onClick={() => { setSelectedMsg(msg); setIsDrafting(false); }}
                className={`p-4 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${selectedMsg?.id === msg.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm truncate pr-2 text-slate-900 dark:text-slate-100">{displayName}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{date}</span>
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{subject}</div>
                <div className="text-xs text-slate-500 truncate mt-1">{msg.bodyPreview}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      {selectedMsg ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-4 bg-white dark:bg-slate-900">
            <button className="md:hidden p-1 text-slate-500" title="Close Message" aria-label="Close Message" onClick={() => setSelectedMsg(null)}><X size={20}/></button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{selectedMsg.subject}</h2>
                {attachmentsLoading && (
                  <span className="text-xs text-indigo-500 animate-pulse bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/50 shrink-0">Loading inline images...</span>
                )}
              </div>
              <div className="text-sm text-slate-500 truncate">From: {selectedMsg.from?.emailAddress?.address}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm whitespace-pre-wrap">
            {/* The body content from Graph API is HTML, so we dangerouslySetInnerHTML */}
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processedBodyHtml || selectedMsg.body?.content || 'No content') }} />
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
            <textarea 
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24 mb-3"
            />
            <div className="flex justify-end gap-3">
              <Button 
                variant="secondary" 
                onClick={() => handleSendReply(false)} 
                disabled={!replyText || sending}
              >
                {sending ? <RefreshCw size={16} className="animate-spin mr-2"/> : <Reply size={16} className="mr-2" />}
                Reply
              </Button>
              <Button 
                onClick={() => handleSendReply(true)} 
                disabled={!replyText || sending}
              >
                {sending ? <RefreshCw size={16} className="animate-spin mr-2"/> : <ReplyAll size={16} className="mr-2" />}
                Reply All
              </Button>
            </div>
          </div>
        </div>
      ) : isDrafting ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Message</h2>
            <button className="p-1 text-slate-500" title="Close" onClick={() => setIsDrafting(false)}><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">To</label>
              <input 
                type="email" 
                value={draftTo}
                onChange={e => setDraftTo(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
              <input 
                type="text" 
                value={draftSubject}
                onChange={e => setDraftSubject(e.target.value)}
                placeholder="Message Subject"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Message</label>
              <textarea 
                value={draftBody}
                onChange={e => setDraftBody(e.target.value)}
                placeholder="Type your message here..."
                className="w-full flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[200px]"
              />
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsDrafting(false)}>Cancel</Button>
            <Button onClick={handleSendNewMessage} disabled={!draftTo || !draftSubject || !draftBody || sending}>
              {sending ? <RefreshCw size={16} className="animate-spin mr-2"/> : <Send size={16} className="mr-2" />}
              Send Message
            </Button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 flex-col gap-4">
          <Mail size={48} className="opacity-20" />
          <p>Select an email to view</p>
        </div>
      )}

      {/* Signature Settings Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2"><PenTool size={18}/> Email Signature Settings</h2>
              <button title="Close" aria-label="Close" onClick={() => setShowSignatureModal(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              <div>
                <div className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Live Preview</div>
                <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(signatureHtml) }}></div>
              </div>

              <div className="flex-1 flex flex-col min-h-[200px]">
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="signatureHtml" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">HTML Source Code</label>
                  <button onClick={() => setSignatureHtml(defaultSignature)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Reset to Default</button>
                </div>
                <textarea 
                  id="signatureHtml"
                  title="HTML Source Code"
                  aria-label="HTML Source Code"
                  placeholder="Enter HTML signature here"
                  value={signatureHtml}
                  onChange={(e) => setSignatureHtml(e.target.value)}
                  className="w-full flex-1 min-h-[200px] font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowSignatureModal(false)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  if (state.currentUser?.id) {
                    await db.collection('users').doc(state.currentUser.id).update(cleanUndefinedFields({
                      emailSignatureHtml: signatureHtml
                    }));
                    dispatch({
                      type: 'SET_CURRENT_USER',
                      payload: {
                        ...state.currentUser,
                        emailSignatureHtml: signatureHtml
                      }
                    });
                  }
                  localStorage.setItem('tt_admin_signature', signatureHtml);
                  showToast.success("Signature saved successfully!");
                  setShowSignatureModal(false);
                } catch (err) {
                  console.error("Failed to save signature", err);
                  showToast.error("Failed to save signature");
                }
              }}>Save Signature</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterInbox;
