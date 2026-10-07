import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { AdminIcon } from './admin-redesign-ui.jsx';
import './email-campaign.css';

const SITE_URL = 'https://www.atmarekha.in/';
const DRAFT_KEY = 'atma-rekha-email-campaign-draft-v1';
const EMOJIS = ['❤️','🎁','✨','🔥','🙏','⭐','🌟','📖','🖤','😊','🥹','🎉','👀','💫','⚡','🫶'];

const THANK_YOU_HTML =
  '<p>Hey,</p>' +
  '<p>Thank you for supporting <strong>ATMA REKHA</strong> and being part of this journey. It truly means a lot to me. ❤️</p>' +
  '<p>As a small thank you, I’ve gifted you <strong>2 years of Premium Membership</strong>. 🎁</p>' +
  '<p>I hope you enjoy what’s coming next. There are many more chapters, mysteries and moments waiting for you.</p>' +
  '<p><a href="' + SITE_URL + '" data-email-button="true">Enter the world of ATMA REKHA →</a></p>' +
  '<p>Thank you for being here. ❤️</p>' +
  '<p>Arkesh<br />Creator of ATMA REKHA</p>';

const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

function safeUrl(value, allowMailto = false) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.startsWith('/') ? SITE_URL.replace(/\/$/, '') + raw : (/^https?:/i.test(raw) || (allowMailto && /^mailto:/i.test(raw)) ? raw : 'https://' + raw);
  try {
    const protocol = new URL(normalized).protocol;
    if (protocol === 'http:' || protocol === 'https:' || (allowMailto && protocol === 'mailto:')) return normalized;
  } catch (_) {}
  return '';
}

function saveSelection(editorRef, selectionRef) {
  const editor = editorRef.current;
  const selection = window.getSelection?.();
  if (!editor || !selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange();
}

function restoreSelection(editorRef, selectionRef) {
  const editor = editorRef.current;
  const range = selectionRef.current;
  const selection = window.getSelection?.();
  if (!editor || !range || !selection) return false;
  editor.focus();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function command(editorRef, selectionRef, name, value = null) {
  restoreSelection(editorRef, selectionRef);
  try { document.execCommand(name, false, value); } catch (_) {}
  editorRef.current?.focus();
}

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,form,input,button,textarea,select,meta,link').forEach(node => node.remove());

  doc.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ['class','id','contenteditable'].includes(name)) node.removeAttribute(attr.name);
      if (name === 'href') {
        const href = safeUrl(attr.value, true);
        if (!href) node.removeAttribute('href'); else node.setAttribute('href', href);
      }
      if (name === 'src') {
        const src = safeUrl(attr.value, false);
        if (!src) node.removeAttribute('src'); else node.setAttribute('src', src);
      }
      if (!['href','src','alt','title','style','align','data-email-button'].includes(name)) node.removeAttribute(attr.name);
    });
  });

  doc.querySelectorAll('a').forEach(a => {
    const href = safeUrl(a.getAttribute('href') || '', true);
    if (!href) { a.replaceWith(...a.childNodes); return; }
    a.setAttribute('href', href);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.setAttribute('style', a.dataset.emailButton === 'true'
      ? 'display:inline-block;padding:13px 24px;background:#111111;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;line-height:1.2;'
      : 'color:#111111;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;font-weight:700;');
  });

  doc.querySelectorAll('img').forEach(img => {
    if (!safeUrl(img.getAttribute('src') || '', false)) img.remove();
    else img.setAttribute('style','display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;');
  });

  const blockStyles = {
    P:'margin:0 0 16px;font-size:16px;line-height:1.65;color:#111111;font-family:Arial,Helvetica,sans-serif;',
    H2:'margin:0 0 16px;font-size:25px;line-height:1.25;font-weight:800;color:#111111;font-family:Arial,Helvetica,sans-serif;',
    H3:'margin:0 0 14px;font-size:20px;line-height:1.3;font-weight:800;color:#111111;font-family:Arial,Helvetica,sans-serif;',
    UL:'margin:0 0 16px;padding-left:24px;font-size:16px;line-height:1.65;color:#111111;font-family:Arial,Helvetica,sans-serif;',
    OL:'margin:0 0 16px;padding-left:24px;font-size:16px;line-height:1.65;color:#111111;font-family:Arial,Helvetica,sans-serif;'
  };
  doc.querySelectorAll('p,h2,h3,ul,ol').forEach(node => node.setAttribute('style', blockStyles[node.tagName] || ''));
  return doc.body.innerHTML.trim();
}

function buildEmailHtml(editorHtml) {
  const doc = new DOMParser().parseFromString(sanitizeHtml(editorHtml), 'text/html');
  doc.querySelectorAll('a[data-email-button="true"]').forEach(anchor => {
    const href = safeUrl(anchor.getAttribute('href') || '', false);
    if (!href) { anchor.replaceWith(...anchor.childNodes); return; }
    const label = (anchor.textContent || 'Open ATMA REKHA').trim().replace(/[<>]/g, '');
    const table = doc.createElement('table');
    table.setAttribute('role','presentation');
    table.setAttribute('width','100%');
    table.setAttribute('cellspacing','0');
    table.setAttribute('cellpadding','0');
    table.setAttribute('border','0');
    table.setAttribute('style','width:100%;margin:4px 0 20px;');
    table.innerHTML =
      '<tr><td align="center" style="padding:0;">' +
      '<a href="' + href.replace(/"/g,'&quot;') + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;line-height:1.2;">' +
      label.replace(/&/g,'&amp;').replace(/"/g,'&quot;') +
      '</a></td></tr>';
    anchor.replaceWith(table);
  });

  return '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f5f5;">' +
    '<div style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent;">Thank you for supporting ATMA REKHA.</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f5f5f5;"><tr><td align="center" style="padding:28px 14px;">' +
    '<table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e6e6e6;border-radius:14px;">' +
    '<tr><td style="padding:34px 30px;">' + doc.body.innerHTML.trim() + '</td></tr>' +
    '<tr><td style="padding:16px 30px 24px;border-top:1px solid #eeeeee;font:12px/1.5 Arial,Helvetica,sans-serif;color:#777;text-align:center;">You’re receiving this because you have an ATMA REKHA account.</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style').forEach(node => node.remove());
  doc.querySelectorAll('a').forEach(a => a.replaceWith(doc.createTextNode(a.textContent || '')));
  return (doc.body.innerText || doc.body.textContent || '').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

function ToolbarButton({label,title,onClick}) {
  return <button type="button" className="email-toolbar-button" title={title} aria-label={title} onMouseDown={event => {event.preventDefault();onClick();}}>{label}</button>;
}

export default function EmailCampaigns({adminEmail=''}) {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const [subject,setSubject] = useState('Thank You for Supporting ATMA REKHA ❤️');
  const [editorHtml,setEditorHtml] = useState(THANK_YOU_HTML);
  const [insertMode,setInsertMode] = useState('');
  const [insertData,setInsertData] = useState({label:'',url:'',alt:''});
  const [emojiOpen,setEmojiOpen] = useState(false);
  const [testEmail,setTestEmail] = useState(adminEmail || '');
  const [status,setStatus] = useState({type:'',text:''});
  const [busy,setBusy] = useState(false);
  const [testSent,setTestSent] = useState(false);
  const [recipientQuery,setRecipientQuery] = useState('');
  const [recipientResults,setRecipientResults] = useState([]);
  const [selectedRecipients,setSelectedRecipients] = useState([]);
  const [recipientBusy,setRecipientBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (saved?.subject && saved?.html) { setSubject(saved.subject); setEditorHtml(saved.html); }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({subject,html:editorHtml})); } catch (_) {}
    }, 350);
    return () => clearTimeout(timer);
  }, [subject,editorHtml]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== editorHtml) editorRef.current.innerHTML = editorHtml;
  }, [editorHtml]);

  const emailHtml = useMemo(() => buildEmailHtml(editorHtml), [editorHtml]);
  const plainText = useMemo(() => htmlToText(emailHtml), [emailHtml]);
  const canSend = Boolean(subject.trim() && plainText.trim()) && !busy;
  const hasSelectedRecipients = selectedRecipients.length > 0;

  const markChanged = () => setTestSent(false);

  const openInsert = mode => {
    saveSelection(editorRef,selectionRef);
    const selected = window.getSelection?.()?.toString?.().trim() || '';
    setInsertMode(mode);
    setEmojiOpen(false);
    setInsertData({label:mode === 'link' ? selected : mode === 'button' ? 'Continue Reading' : '',url:'',alt:''});
  };

  const insertLink = () => {
    const url = safeUrl(insertData.url,true);
    if (!url) return setStatus({type:'error',text:'Enter a valid link.'});
    restoreSelection(editorRef,selectionRef);
    const selected = window.getSelection?.()?.toString?.().trim();
    try {
      if (selected) document.execCommand('createLink',false,url);
      else document.execCommand('insertHTML',false,'<a href="' + url.replace(/"/g,'&quot;') + '">' + (insertData.label || 'Open link').replace(/[<>]/g,'') + '</a>');
    } catch (_) {}
    setEditorHtml(editorRef.current.innerHTML);
    setInsertMode('');
    markChanged();
  };

  const insertButton = () => {
    const label = insertData.label.trim();
    const url = safeUrl(insertData.url,false);
    if (!label || !url) return setStatus({type:'error',text:'Add button text and a valid HTTP or HTTPS link.'});
    restoreSelection(editorRef,selectionRef);
    const html = '<p><a href="' + url.replace(/"/g,'&quot;') + '" data-email-button="true">' + label.replace(/[<>]/g,'') + '</a></p>';
    try { document.execCommand('insertHTML',false,html); } catch (_) {}
    setEditorHtml(editorRef.current.innerHTML);
    setInsertMode('');
    markChanged();
  };

  const insertImage = () => {
    const url = safeUrl(insertData.url,false);
    if (!url) return setStatus({type:'error',text:'Enter a public HTTP or HTTPS image URL.'});
    restoreSelection(editorRef,selectionRef);
    try { document.execCommand('insertHTML',false,'<p><img src="' + url.replace(/"/g,'&quot;') + '" alt="' + (insertData.alt || 'ATMA REKHA').replace(/"/g,'&quot;') + '" /></p>'); } catch (_) {}
    setEditorHtml(editorRef.current.innerHTML);
    setInsertMode('');
    markChanged();
  };

  const insertEmoji = emoji => {
    restoreSelection(editorRef,selectionRef);
    try { document.execCommand('insertText',false,emoji); } catch (_) {}
    setEditorHtml(editorRef.current.innerHTML);
    setEmojiOpen(false);
    markChanged();
  };

  const loadTemplate = () => {
    if (!window.confirm('Replace the current email with the thank you template?')) return;
    setSubject('Thank You for Supporting ATMA REKHA ❤️');
    setEditorHtml(THANK_YOU_HTML);
    setInsertMode('');
    setStatus({type:'success',text:'Thank you template loaded.'});
    setTestSent(false);
  };

  const searchRecipients = async () => {
    const query = recipientQuery.trim();
    if (!query) {
      setRecipientResults([]);
      return;
    }
    setRecipientBusy(true);
    try {
      const result = await supabase.functions.invoke('send-email-to-users', {
        body: {action:'search_users',query}
      });
      if (result.error) throw new Error(result.data?.error || result.error.message || 'Search failed.');
      if (!result.data?.ok) throw new Error(result.data?.error || 'Search failed.');
      setRecipientResults(result.data.users || []);
    } catch (error) {
      setStatus({type:'error',text:error?.message || 'Recipient search failed.'});
    } finally {
      setRecipientBusy(false);
    }
  };

  const toggleRecipient = user => {
    setSelectedRecipients(current =>
      current.some(item => item.email === user.email)
        ? current.filter(item => item.email !== user.email)
        : [...current, user]
    );
    setTestSent(false);
  };

  const send = async isTest => {
    if (!canSend) return;
    if (isTest && !validEmail(testEmail)) return setStatus({type:'error',text:'Enter a valid test email address.'});
    if (!isTest && !testSent) return setStatus({type:'error',text:'Send a test email first.'});
    if (!isTest && !hasSelectedRecipients && !window.confirm('Send this email to every confirmed ATMA REKHA user now?')) return;
    if (!isTest && hasSelectedRecipients && !window.confirm('Send this email to the selected recipients now?')) return;

    setBusy(true);
    setStatus({type:'',text:isTest ? 'Sending test email…' : hasSelectedRecipients ? 'Sending to selected recipients…' : 'Sending to confirmed users…'});
    try {
      const result = await supabase.functions.invoke('send-email-to-users', {
        body: {subject:subject.trim(),html:emailHtml,text:plainText,...(isTest ? {testEmail:testEmail.trim()} : hasSelectedRecipients ? {recipients:selectedRecipients.map(item => item.email)} : {})}
      });
      if (result.error) throw new Error(result.data?.error || result.error.message || 'Email request failed.');
      if (!result.data?.ok) throw new Error(result.data?.error || 'Email request failed.');
      if (isTest) {
        setTestSent(true);
        setStatus({type:'success',text:'Test sent. Check Gmail and click the button.'});
      } else {
        setStatus({type:'success',text:'Sent ' + (result.data.sent || 0) + ' of ' + (result.data.total || 0) + ' confirmed users. Failed: ' + (result.data.failed || 0) + '.'});
        setTestSent(false);
        setSelectedRecipients([]);
      }
    } catch (error) {
      setStatus({type:'error',text:error?.message || 'Email send failed.'});
    } finally {
      setBusy(false);
    }
  };

  return <section className="email-campaign-shell">
    <header className="email-campaign-head">
      <div><span>OUTBOUND · RESEND</span><h2>Email Campaigns</h2><p>Build and test a clean email before sending it.</p></div>
      <div className="email-campaign-head-actions">
        <button type="button" className="email-ghost-button" onClick={loadTemplate}><AdminIcon name="refresh" size={15}/>Load thank you template</button>
      </div>
    </header>

    {status.text ? <div className={'email-status ' + status.type} role="status">{status.text}</div> : null}

    <div className="email-campaign-grid">
      <section className="email-composer-card">
        <label className="email-field"><span>Subject</span><input value={subject} maxLength={200} onChange={event => {setSubject(event.target.value);markChanged();}} /></label>

        <div className="email-editor-toolbar">
          <ToolbarButton label="B" title="Bold" onClick={() => {command(editorRef,selectionRef,'bold');setEditorHtml(editorRef.current.innerHTML);markChanged();}} />
          <ToolbarButton label="I" title="Italic" onClick={() => {command(editorRef,selectionRef,'italic');setEditorHtml(editorRef.current.innerHTML);markChanged();}} />
          <ToolbarButton label="U" title="Underline" onClick={() => {command(editorRef,selectionRef,'underline');setEditorHtml(editorRef.current.innerHTML);markChanged();}} />
          <ToolbarButton label="H2" title="Heading" onClick={() => {command(editorRef,selectionRef,'formatBlock','h2');setEditorHtml(editorRef.current.innerHTML);markChanged();}} />
          <ToolbarButton label="• List" title="Bullet list" onClick={() => {command(editorRef,selectionRef,'insertUnorderedList');setEditorHtml(editorRef.current.innerHTML);markChanged();}} />
          <ToolbarButton label="1. List" title="Numbered list" onClick={() => {command(editorRef,selectionRef,'insertOrderedList');setEditorHtml(editorRef.current.innerHTML);markChanged();}} />
          <ToolbarButton label="Link" title="Insert clickable link" onClick={() => openInsert('link')} />
          <ToolbarButton label="Button" title="Insert clickable button" onClick={() => openInsert('button')} />
          <ToolbarButton label="Image" title="Insert public image" onClick={() => openInsert('image')} />
          <ToolbarButton label="😊" title="Insert emoji" onClick={() => {saveSelection(editorRef,selectionRef);setInsertMode('');setEmojiOpen(value => !value);}} />
          <ToolbarButton label="Clear" title="Clear formatting" onClick={() => {command(editorRef,selectionRef,'removeFormat');setEditorHtml(editorRef.current.innerHTML);markChanged();}} />
        </div>

        {emojiOpen ? <div className="email-emoji-panel">{EMOJIS.map(emoji => <button key={emoji} type="button" onMouseDown={event => event.preventDefault()} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div> : null}

        {insertMode ? <div className="email-insert-panel">
          {insertMode === 'link' ? <div className="email-insert-grid">
            <label>Text<input value={insertData.label} onChange={event => setInsertData({...insertData,label:event.target.value})} placeholder="Read the chapter"/></label>
            <label>Link<input value={insertData.url} onChange={event => setInsertData({...insertData,url:event.target.value})} placeholder="https://www.atmarekha.in/"/></label>
            <div className="email-insert-actions"><button type="button" onClick={insertLink}>Insert link</button><button type="button" onClick={() => setInsertMode('')}>Cancel</button></div>
          </div> : null}
          {insertMode === 'button' ? <div className="email-insert-grid">
            <label>Button text<input value={insertData.label} onChange={event => setInsertData({...insertData,label:event.target.value})} placeholder="Read ATMA REKHA"/></label>
            <label>Button link<input value={insertData.url} onChange={event => setInsertData({...insertData,url:event.target.value})} placeholder="https://www.atmarekha.in/"/></label>
            <div className="email-insert-actions"><button type="button" onClick={insertButton}>Insert button</button><button type="button" onClick={() => setInsertMode('')}>Cancel</button></div>
          </div> : null}
          {insertMode === 'image' ? <div className="email-insert-grid">
            <label>Public image URL<input value={insertData.url} onChange={event => setInsertData({...insertData,url:event.target.value})} placeholder="https://..."/></label>
            <label>Alt text<input value={insertData.alt} onChange={event => setInsertData({...insertData,alt:event.target.value})} placeholder="ATMA REKHA"/></label>
            <div className="email-insert-actions"><button type="button" onClick={insertImage}>Insert image</button><button type="button" onClick={() => setInsertMode('')}>Cancel</button></div>
          </div> : null}
        </div> : null}

        <div
          ref={editorRef}
          className="email-editor-surface"
          contentEditable
          suppressContentEditableWarning
          onInput={event => {setEditorHtml(event.currentTarget.innerHTML);markChanged();}}
          onKeyUp={() => saveSelection(editorRef,selectionRef)}
          onMouseUp={() => saveSelection(editorRef,selectionRef)}
          onFocus={() => saveSelection(editorRef,selectionRef)}
          role="textbox"
          aria-multiline="true"
          spellCheck="true"
        />
        <div className="email-editor-note"><AdminIcon name="message" size={14}/><span>Buttons contain their link inside the email HTML. The URL is not printed as body text.</span></div>
      </section>

      <aside className="email-preview-card">
        <div className="email-preview-head"><div><span>PREVIEW</span><strong>Same HTML used for sending</strong></div></div>
        <div className="email-preview-meta"><div><span>From</span><strong>Atma Rekha</strong></div><div><span>To</span><strong>Confirmed users</strong></div><div><span>Subject</span><strong>{subject || 'No subject'}</strong></div></div>
        <iframe title="Email preview" className="email-preview-frame" srcDoc={emailHtml} sandbox="" />
      </aside>
    </div>

    <section className="email-recipient-card">
      <div className="email-recipient-head">
        <div><span>RECIPIENTS</span><h3>Choose who receives it</h3><p>Search for a reader, select people, or leave this empty to send to all confirmed users.</p></div>
        <strong>{selectedRecipients.length} selected</strong>
      </div>
      <div className="email-recipient-search">
        <input value={recipientQuery} onChange={event => setRecipientQuery(event.target.value)} onKeyDown={event => {if(event.key === 'Enter'){event.preventDefault();searchRecipients();}}} placeholder="Search by email or name" />
        <button type="button" onClick={searchRecipients} disabled={recipientBusy || !recipientQuery.trim()}>{recipientBusy ? 'Searching…' : 'Search'}</button>
      </div>
      {recipientResults.length ? <div className="email-recipient-results">
        {recipientResults.map(user => {
          const selected = selectedRecipients.some(item => item.email === user.email);
          return <button key={user.email} type="button" className={'email-recipient-row' + (selected ? ' selected' : '')} onClick={() => toggleRecipient(user)}>
            <span><strong>{user.name || user.email}</strong><small>{user.email}</small></span>
            <b>{selected ? 'Selected' : 'Select'}</b>
          </button>;
        })}
      </div> : null}
      {selectedRecipients.length ? <div className="email-selected-list">
        {selectedRecipients.map(user => <button key={user.email} type="button" onClick={() => toggleRecipient(user)}>{user.email} ×</button>)}
      </div> : null}
    </section>

    <section className="email-send-card">
      <div><span>SEND SAFELY</span><h3>Test first, then send</h3><p>The bulk send button unlocks only after a successful test.</p></div>
      <div className="email-send-controls">
        <label className="email-test-field"><span>Test email</span><input value={testEmail} onChange={event => {setTestEmail(event.target.value);setTestSent(false);}} placeholder="your@email.com" /></label>
        <div className="email-send-buttons">
          <button type="button" className="email-test-button" onClick={() => send(true)} disabled={!canSend || busy}><AdminIcon name="message" size={15}/>{busy ? 'Working…' : 'Send test'}</button>
          <button type="button" className={'email-bulk-button' + (testSent ? ' is-ready' : '')} onClick={() => send(false)} disabled={!canSend || busy || !testSent}><AdminIcon name="sparkle" size={15}/>{busy ? 'Working…' : 'Send to all users'}</button>
        </div>
      </div>
    </section>
  </section>;
}
