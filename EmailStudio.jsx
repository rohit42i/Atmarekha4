import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const SITE_URL = 'https://www.atmarekha.in';
const initial = { id: '', slug: '', name: '', category: 'transactional', subject: '', html_body: '', text_body: '' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const renderPreview = (value, vars) => String(value ?? '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => escapeHtml(vars[key] ?? ''));
const plainTextToHtml = value => {
  const normal = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!normal) return '';
  return normal.split(/\n{2,}/).map(block => {
    let safe = escapeHtml(block).replace(/\n/g, '<br>');
    safe = safe.replace(/Read the chapter:\s*{{\s*chapter_url\s*}}/i, '<a href="{{chapter_url}}" style="color:#174ea6;text-decoration:underline">Read the chapter</a>');
    return '<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#222">' + safe + '</p>';
  }).filter(Boolean).join('');
};

export default function EmailStudio() {
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [audienceCounts, setAudienceCounts] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [draft, setDraft] = useState(initial);
  const [chapter, setChapter] = useState({ chapter_number: '', chapter_title: '', chapter_description: '', chapter_url: '' });
  const [audience, setAudience] = useState('selected');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const [advancedHtml, setAdvancedHtml] = useState(false);
  const [history, setHistory] = useState([]);

  const invoke = async body => {
    const { data, error } = await supabase.functions.invoke('resend-email-studio', { body });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Email operation failed.');
    return data;
  };

  const load = async () => {
    const [templatesResult, historyResult] = await Promise.all([
      supabase.from('email_templates').select('id,slug,name,category,subject,html_body,text_body,active,updated_at').order('category').order('name'),
      supabase.from('email_campaigns').select('id,subject,audience,status,total_count,sent_count,failed_count,created_at,completed_at,error_summary').order('created_at', { ascending: false }).limit(50)
    ]);
    if (templatesResult.error) throw templatesResult.error;
    if (historyResult.error) throw historyResult.error;
    const nextTemplates = templatesResult.data || [];
    setTemplates(nextTemplates);
    setHistory(historyResult.data || []);
    if (!selectedTemplate && nextTemplates.length) {
      const preferred = nextTemplates.find(t => t.slug === 'new-chapter') || nextTemplates[0];
      setSelectedTemplate(preferred.id);
      setDraft({ ...preferred });
    }

    setLoadingRecipients(true);
    try {
      const recipientResult = await invoke({ action: 'list-recipients' });
      setUsers(recipientResult.users || []);
      setAudienceCounts(recipientResult.counts || {});
    } catch (error) {
      setUsers([]);
      setAudienceCounts({});
      setNotice(error?.message || 'Unable to load eligible recipients.');
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    load().catch(error => setNotice(error?.message || 'Could not load Email Studio.'));
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter(u => [u.display_name, u.username, u.email, u.id].some(value => String(value || '').toLowerCase().includes(query)));
  }, [users, search]);

  const setField = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const setChapterField = (key, value) => setChapter(previous => ({ ...previous, [key]: value }));

  const chooseTemplate = id => {
    setSelectedTemplate(id);
    const found = templates.find(t => t.id === id);
    setDraft(found ? { ...found } : initial);
    setChapter({ chapter_number: '', chapter_title: '', chapter_description: '', chapter_url: '' });
    setPreview(false);
    setAdvancedHtml(false);
    setNotice('');
  };

  const saveTemplate = async () => {
    if (!draft.name.trim() || !draft.slug.trim() || !draft.subject.trim() || !draft.html_body.trim()) {
      setNotice('Add a template name, slug, subject and HTML body before saving.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const data = await invoke({
        action: 'save-template',
        slug: draft.slug,
        name: draft.name,
        category: draft.category,
        subject: draft.subject,
        html_body: isChapterTemplate && !advancedHtml ? plainTextToHtml(draft.text_body) : draft.html_body,
        text_body: draft.text_body
      });
      setTemplates(previous => {
        const withoutSameSlug = previous.filter(t => t.slug !== data.template.slug);
        return [...withoutSameSlug, data.template].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedTemplate(data.template.id);
      setDraft({ ...data.template });
      setNotice('Template saved. Your edits are now stored in Supabase.');
    } catch (error) {
      setNotice(error?.message || 'Could not save template.');
    } finally {
      setBusy(false);
    }
  };

  const isChapterTemplate = draft.slug === 'new-chapter';
  const previewVars = {
    name: 'Reader',
    email: 'reader@example.com',
    site_url: SITE_URL,
    action_url: chapter.chapter_url || SITE_URL + '/chapter/1',
    chapter_url: chapter.chapter_url || SITE_URL + '/chapter/1',
    chapter_number: chapter.chapter_number || '1',
    chapter_title: chapter.chapter_title || 'Chapter title',
    chapter_description: chapter.chapter_description || '',
    announcement_title: 'Creator update',
    announcement_body: 'Your next update is ready.',
    expiry_date: '15 Nov 2026',
    amount: '₹49',
    payment_reference: 'AR-12345',
    maintenance_message: 'The site will be briefly unavailable.',
    support_message: 'Your support request has been updated.',
    unsubscribe_url: SITE_URL
  };
  const htmlBodyForEditor = isChapterTemplate && !advancedHtml ? plainTextToHtml(draft.text_body) : draft.html_body;
  const previewHtml = renderPreview(htmlBodyForEditor, previewVars);
  const previewSubject = renderPreview(draft.subject, previewVars);

  const targetCount = () => {
    if (audience === 'selected') {
      return users.filter(user => selectedUsers.includes(user.id) && (draft.category !== 'marketing' || !user.marketing_opted_out)).length;
    }
    const key = audience === 'all' ? 'all' : audience;
    return Number(audienceCounts[key + (draft.category === 'marketing' ? 'Marketing' : '')] || 0);
  };

  const send = async () => {
    if (!draft.subject.trim() || (!draft.html_body.trim() && !draft.text_body.trim())) {
      setNotice('Subject and email content are required.');
      return;
    }
    if (audience === 'selected' && !selectedUsers.length) {
      setNotice('Select at least one reader.');
      return;
    }
    if (isChapterTemplate) {
      if (!chapter.chapter_number.trim() || !chapter.chapter_title.trim() || !chapter.chapter_url.trim()) {
        setNotice('For a new-chapter email, enter the chapter number, title and reading link.');
        return;
      }
      try {
        const parsed = new URL(chapter.chapter_url, SITE_URL);
        if (parsed.protocol !== 'https:' || !['www.atmarekha.in', 'atmarekha.in'].includes(parsed.hostname)) {
          setNotice('Use a valid HTTPS reading link on atmarekha.in.');
          return;
        }
      } catch {
        setNotice('Enter a valid chapter reading link.');
        return;
      }
    }
    const count = targetCount();
    if (!count) {
      setNotice(draft.category === 'marketing' ? 'There are no eligible recipients after marketing opt-outs are applied.' : 'There are no eligible recipients in this audience.');
      return;
    }
    const audienceLabel = audience === 'selected' ? 'selected reader(s)' : ({
      all: 'all confirmed email accounts',
      members: 'active members',
      free: 'free readers',
      recent: 'readers who joined in the last 30 days'
    }[audience] || audience);
    if (!window.confirm('Send “' + (previewSubject || draft.subject) + '” to ' + count.toLocaleString('en-IN') + ' ' + audienceLabel + '? This sends real emails through Resend.')) return;

    setBusy(true);
    setNotice('Sending emails through Resend…');
    try {
      const data = await invoke({
        action: 'send',
        templateId: draft.id || selectedTemplate || undefined,
        templateSlug: draft.slug,
        subject: draft.subject,
        html_body: isChapterTemplate && !advancedHtml ? plainTextToHtml(draft.text_body) : draft.html_body,
        text_body: draft.text_body,
        category: draft.category,
        audience: { type: audience, userIds: selectedUsers },
        variables: isChapterTemplate ? chapter : {}
      });
      setNotice('Finished: ' + data.sent + ' accepted by Resend, ' + data.failed + ' failed, ' + data.total + ' eligible recipients' + (data.skippedOptOuts ? ', ' + data.skippedOptOuts + ' marketing opt-outs skipped' : '') + '. Delivery status updates when Resend webhook events arrive.');
      await load();
    } catch (error) {
      setNotice(error?.message || 'Email send failed.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="admin-stack email-studio">
    <section className="admin-card">
      <div className="admin-card-title">
        <div><span>RESEND EMAIL STUDIO</span><h2>Email campaigns</h2><p>Edit messages, preview them, and send to selected readers or an audience.</p></div>
        <button type="button" onClick={() => { setDraft(initial); setSelectedTemplate(''); setPreview(false); setNotice('New template draft. Enter a unique slug, then save it before sending.'); }}>New template</button>
      </div>
      {notice && <div role="status" className="admin-notice" style={{ marginBottom: 14 }}>{notice}</div>}
      <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <label>Saved template<select value={selectedTemplate} onChange={event => chooseTemplate(event.target.value)}><option value="">Custom draft</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}</select></label>
        <label>Template name<input value={draft.name} onChange={event => setField('name', event.target.value)} placeholder="Template name" maxLength={100} /></label>
        <label>Template slug<input value={draft.slug} onChange={event => setField('slug', event.target.value)} placeholder="e.g. new-chapter" maxLength={80} /></label>
        <label>Email type<select value={draft.category} onChange={event => setField('category', event.target.value)}><option value="transactional">Transactional</option><option value="marketing">Marketing (opt-outs respected)</option></select></label>
      </div>
      <label style={{ display: 'block', marginTop: 12 }}>Subject<input value={draft.subject} onChange={event => setField('subject', event.target.value)} maxLength={200} placeholder="Email subject" /></label>
      {(!isChapterTemplate || advancedHtml) && <label style={{ display: 'block', marginTop: 12 }}>HTML email body<textarea value={draft.html_body} onChange={event => setField('html_body', event.target.value)} rows={9} placeholder="Edit the email HTML. Use the supported variables below." style={{ width: '100%', fontFamily: 'monospace' }} /></label>}
      <label style={{ display: 'block', marginTop: 12 }}>{isChapterTemplate ? 'Email message (editable text)' : 'Plain-text version'}<textarea value={draft.text_body} onChange={event => setField('text_body', event.target.value)} rows={isChapterTemplate ? 9 : 5} placeholder={isChapterTemplate ? 'Write the message in normal text. The email layout is formatted automatically.' : 'Edit the text-only version for email apps that do not show HTML.'} style={{ width: '100%' }} /></label>
      <p className="muted">Variables: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{site_url}}'}</code>, <code>{'{{action_url}}'}</code>, <code>{'{{chapter_number}}'}</code>, <code>{'{{chapter_title}}'}</code>, <code>{'{{chapter_description}}'}</code>, <code>{'{{chapter_url}}'}</code>.</p>

      {isChapterTemplate && <section style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
        <div className="admin-card-title"><div><span>NEW CHAPTER DETAILS</span><h3>What are you announcing?</h3><p>These values are inserted when you send. They do not overwrite your saved template.</p></div></div>
        <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <label>Chapter number<input value={chapter.chapter_number} onChange={event => setChapterField('chapter_number', event.target.value)} placeholder="e.g. 1" maxLength={20} /></label>
          <label>Chapter title<input value={chapter.chapter_title} onChange={event => setChapterField('chapter_title', event.target.value)} placeholder="Exact chapter title" maxLength={180} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Reading link<input value={chapter.chapter_url} onChange={event => setChapterField('chapter_url', event.target.value)} placeholder="https://www.atmarekha.in/chapter/1" /></label>
          <label style={{ gridColumn: '1 / -1' }}>Optional message<textarea value={chapter.chapter_description} onChange={event => setChapterField('chapter_description', event.target.value)} placeholder="A short personal note about this chapter (optional)" rows={3} maxLength={2000} /></label>
        </div>
      </section>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" onClick={() => setPreview(!preview)}>{preview ? 'Hide preview' : 'Preview email'}</button>
        {isChapterTemplate && <button type="button" onClick={() => setAdvancedHtml(!advancedHtml)}>{advancedHtml ? 'Use editable text' : 'Edit HTML layout'}</button>}
        <button type="button" onClick={saveTemplate} disabled={busy}>{busy ? 'Working…' : 'Save template'}</button>
      </div>
      {preview && <section style={{ marginTop: 14, border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border-color)' }}><strong>{previewSubject || 'No subject'}</strong></div>
        <iframe title="Email preview" sandbox="" srcDoc={'<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:0;font-family:Arial,Helvetica,sans-serif;padding:16px;line-height:1.6;color:#222;background:#fff;width:auto;max-width:100%;overflow-wrap:anywhere">' + previewHtml + '</body>'} style={{ width: '100%', height: 380, border: 0, background: '#fff' }} />
      </section>}
    </section>

    <section className="admin-card">
      <div className="admin-card-title"><div><span>RECIPIENTS</span><h2>Choose audience</h2><p>Only accounts with confirmed email addresses are selectable. Marketing opt-outs are excluded automatically.</p></div></div>
      <label>Audience<select value={audience} onChange={event => setAudience(event.target.value)}><option value="selected">Selected reader(s)</option><option value="all">All confirmed email accounts</option><option value="members">Active members</option><option value="free">Free readers</option><option value="recent">Joined in the last 30 days</option></select></label>
      {audience === 'selected' && <>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, username or email" style={{ marginTop: 10, width: '100%' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
          <button type="button" onClick={() => setSelectedUsers(old => [...new Set([...old, ...filteredUsers.map(u => u.id)])])} disabled={loadingRecipients || !filteredUsers.length}>Select filtered</button>
          <button type="button" onClick={() => setSelectedUsers([])} disabled={!selectedUsers.length}>Clear selection</button>
          <span>{targetCount().toLocaleString('en-IN')} eligible selected</span>
        </div>
        <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 10 }}>
          {loadingRecipients ? <p className="muted" style={{ padding: 12 }}>Loading confirmed accounts…</p> : filteredUsers.map(user => {
            const optedOut = draft.category === 'marketing' && user.marketing_opted_out;
            return <label key={user.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--border-soft-color)', opacity: optedOut ? 0.55 : 1 }}>
              <input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={event => setSelectedUsers(old => event.target.checked ? [...new Set([...old, user.id])] : old.filter(id => id !== user.id))} />
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{user.display_name || user.username || 'Reader'} <small className="muted">{user.username ? '@' + user.username + ' · ' : ''}{user.email}{optedOut ? ' · opted out' : ''}</small></span>
            </label>;
          })}
          {!loadingRecipients && !filteredUsers.length && <p className="muted" style={{ padding: 12 }}>{users.length ? 'No readers match your search.' : 'No eligible reader list is available. Refresh after the Email Studio function update is deployed.'}</p>}
        </div>
      </>}
      {audience !== 'selected' && <p className="muted" style={{ marginTop: 10 }}>Eligible recipients: <strong>{targetCount().toLocaleString('en-IN')}</strong>{draft.category === 'marketing' ? ' after excluding marketing opt-outs' : ''}.</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="admin-submit" disabled={busy || loadingRecipients || targetCount() < 1} onClick={send}>{busy ? 'Sending…' : 'Send email via Resend'}</button>
      </div>
    </section>

    <section className="admin-card">
      <div className="admin-card-title"><div><span>HISTORY</span><h2>Recent campaigns</h2></div><button type="button" onClick={() => load().catch(error => setNotice(error?.message || 'Unable to refresh.'))} disabled={busy || loadingRecipients}>Refresh</button></div>
      <div style={{ display: 'grid', gap: 8 }}>
        {history.map(item => <article key={item.id} style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 10 }}>
          <strong>{item.subject}</strong>
          <p className="muted">{item.audience?.type || 'audience'} · {item.total_count} eligible · {item.sent_count} accepted · {item.failed_count} failed</p>
          <small>{new Date(item.created_at).toLocaleString('en-IN')} · {item.status}</small>
          {item.error_summary && <p>{item.error_summary}</p>}
        </article>)}
        {!history.length && <p className="muted">No email campaigns yet.</p>}
      </div>
    </section>
  </div>;
}
