import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const initial = { id: '', slug: '', name: '', category: 'transactional', subject: '', html_body: '', text_body: '' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default function EmailStudio() {
  const [templates,setTemplates] = useState([]), [users,setUsers] = useState([]), [selectedTemplate,setSelectedTemplate] = useState(''), [draft,setDraft] = useState(initial);
  const [audience,setAudience] = useState('selected'), [selectedUsers,setSelectedUsers] = useState([]), [search,setSearch] = useState('');
  const [busy,setBusy] = useState(false), [notice,setNotice] = useState(''), [preview,setPreview] = useState(false);
  const [history,setHistory] = useState([]);
  const invoke = async body => { const {data,error}=await supabase.functions.invoke('resend-email-studio',{body}); if(error)throw error; if(!data?.ok)throw new Error(data?.error||'Email operation failed.'); return data; };
  const load = async () => {
    const [t,u,h] = await Promise.all([
      supabase.from('email_templates').select('id,slug,name,category,subject,html_body,text_body,active,updated_at').order('category').order('name'),
      supabase.from('profiles').select('id,username,display_name,created_at').order('display_name',{ascending:true,nullsFirst:false}).limit(1000),
      supabase.from('email_campaigns').select('id,subject,audience,status,total_count,sent_count,failed_count,created_at,completed_at,error_summary').order('created_at',{ascending:false}).limit(50)
    ]);
    if(t.error)throw t.error; if(u.error)throw u.error; if(h.error)throw h.error;
    setTemplates(t.data||[]);setUsers(u.data||[]);setHistory(h.data||[]);
    if(!selectedTemplate && t.data?.length){setSelectedTemplate(t.data[0].id);setDraft(t.data[0]);}
  };
  useEffect(()=>{load().catch(e=>setNotice(e.message||'Could not load email studio.'));},[]);
  const filteredUsers=useMemo(()=>users.filter(u=>[u.display_name,u.username,u.id].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()))),[users,search]);
  const setField=(key,value)=>setDraft(prev=>({...prev,[key]:value}));
  const chooseTemplate=id=>{setSelectedTemplate(id);const found=templates.find(t=>t.id===id);setDraft(found?{...found}:initial);setNotice('');};
  const saveTemplate=async()=>{if(!draft.name.trim()||!draft.subject.trim()||!draft.html_body.trim()){setNotice('Add a template name, subject and HTML body.');return;}setBusy(true);setNotice('');try{const data=await invoke({action:'save-template',slug:draft.slug||draft.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name:draft.name,category:draft.category,subject:draft.subject,html_body:draft.html_body,text_body:draft.text_body});await load();setSelectedTemplate(data.template.id);setDraft(data.template);setNotice('Template saved.');}catch(e){setNotice(e.message||'Could not save template.');}finally{setBusy(false);}};
  const send=async()=>{if(!draft.subject.trim()||(!draft.html_body.trim()&&!draft.text_body.trim())){setNotice('Subject and email content are required.');return;}if(audience==='selected'&&!selectedUsers.length){setNotice('Select at least one reader.');return;}const count=audience==='selected'?selectedUsers.length:audience==='all'?users.length:audience==='recent'?users.filter(u=>Date.now()-new Date(u.created_at).getTime()<30*86400000).length:audience==='members'?'active members':'free readers';if(!window.confirm('Send this email to '+(typeof count==='number'?count.toLocaleString('en-IN'):count)+'? Emails will be sent through Resend. Marketing opt-outs are excluded.'))return;setBusy(true);setNotice('Sending emails through Resend…');try{const data=await invoke({action:'send',templateId:draft.id||selectedTemplate||undefined,subject:draft.subject,html_body:draft.html_body,text_body:draft.text_body,category:draft.category,audience:{type:audience,userIds:selectedUsers}});setNotice('Finished: '+data.sent+' accepted by Resend, '+data.failed+' failed, '+data.total+' recipients. Delivery status updates when the Resend webhook is configured.');await load();}catch(e){setNotice(e.message||'Email send failed.');}finally{setBusy(false);}};
  const sampleVars={name:'Reader',site_url:'https://www.atmarekha.in',action_url:'https://www.atmarekha.in',chapter_title:'A new chapter',announcement_title:'Creator update',announcement_body:'Your next update is ready.',expiry_date:'15 Nov 2026',amount:'₹49',payment_reference:'AR-12345',maintenance_message:'The site will be briefly unavailable.',support_message:'Your support request has been updated.'};
  const previewHtml=draft.html_body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g,(_,key)=>escapeHtml(sampleVars[key]||''));
  return <div className="admin-stack email-studio">
    <section className="admin-card">
      <div className="admin-card-title"><div><span>RESEND EMAIL STUDIO</span><h2>Email campaigns</h2><p>20 starter templates · audience selection · delivery history</p></div><button type="button" onClick={()=>{setDraft(initial);setSelectedTemplate('');setNotice('New template draft. Save it before sending if you want to reuse it.');}}>New template</button></div>
      {notice&&<div role="status" className="admin-notice" style={{marginBottom:14}}>{notice}</div>}
      <div className="admin-form-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
        <label>Saved template<select value={selectedTemplate} onChange={e=>chooseTemplate(e.target.value)}><option value="">Custom draft</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}</select></label>
        <label>Template name<input value={draft.name} onChange={e=>setField('name',e.target.value)} placeholder="Template name"/></label>
        <label>Template slug<input value={draft.slug} onChange={e=>setField('slug',e.target.value)} placeholder="template-slug"/></label>
        <label>Email type<select value={draft.category} onChange={e=>setField('category',e.target.value)}><option value="transactional">Transactional</option><option value="marketing">Marketing (respects opt-outs)</option></select></label>
      </div>
      <label style={{display:'block',marginTop:12}}>Subject<input value={draft.subject} onChange={e=>setField('subject',e.target.value)} maxLength={200} placeholder="Email subject"/></label>
      <label style={{display:'block',marginTop:12}}>HTML email body<textarea value={draft.html_body} onChange={e=>setField('html_body',e.target.value)} rows={9} placeholder="Write the email HTML. Variables: {{name}}, {{site_url}}, {{action_url}}." style={{width:'100%',fontFamily:'monospace'}}/></label>
      <label style={{display:'block',marginTop:12}}>Plain-text fallback<textarea value={draft.text_body} onChange={e=>setField('text_body',e.target.value)} rows={3} placeholder="Plain-text version for email clients"/></label>
      <p className="muted">Available variables include <code>{{name}}</code>, <code>{{email}}</code>, <code>{{site_url}}</code>, <code>{{action_url}}</code>, <code>{{chapter_title}}</code>, <code>{{announcement_title}}</code>, and <code>{{announcement_body}}</code>.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button type="button" onClick={()=>setPreview(!preview)}>{preview?'Hide preview':'Preview email'}</button><button type="button" onClick={saveTemplate} disabled={busy}>{busy?'Working…':'Save template'}</button></div>
      {preview&&<section style={{marginTop:14,border:'1px solid var(--border-color)',borderRadius:12,overflow:'hidden'}}><div style={{padding:12,borderBottom:'1px solid var(--border-color)'}}><strong>{draft.subject||'No subject'}</strong></div><iframe title="Email preview" sandbox="" srcDoc={'<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:Arial,sans-serif;padding:20px;line-height:1.6">'+previewHtml+'</body>'} style={{width:'100%',height:360,border:0,background:'#fff'}}/></section>}
    </section>
    <section className="admin-card">
      <div className="admin-card-title"><div><span>RECIPIENTS</span><h2>Choose audience</h2><p>Transactional messages can go to selected accounts; marketing opt-outs are automatically skipped.</p></div></div>
      <label>Audience<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="selected">Selected reader(s)</option><option value="all">All confirmed accounts</option><option value="members">Active members</option><option value="free">Free readers</option><option value="recent">Joined in the last 30 days</option></select></label>
      {audience==='selected'&&<><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search readers by name or username" style={{marginTop:10,width:'100%'}}/><div style={{display:'flex',gap:8,margin:'8px 0'}}><button type="button" onClick={()=>setSelectedUsers(filteredUsers.map(u=>u.id))}>Select filtered</button><button type="button" onClick={()=>setSelectedUsers([])}>Clear selection</button><span>{selectedUsers.length} selected</span></div><div style={{maxHeight:260,overflow:'auto',border:'1px solid var(--border-color)',borderRadius:10}}>{filteredUsers.map(u=><label key={u.id} style={{display:'flex',gap:8,padding:'8px 10px',borderBottom:'1px solid var(--border-soft-color)'}}><input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={e=>setSelectedUsers(old=>e.target.checked?[...new Set([...old,u.id])]:old.filter(id=>id!==u.id))}/><span>{u.display_name||u.username||'Reader'} <small className="muted">@{u.username||u.id.slice(0,8)}</small></span></label>)}{!filteredUsers.length&&<p className="muted">No readers match.</p>}</div></>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}><button type="button" className="admin-submit" disabled={busy} onClick={send}>{busy?'Sending…':'Send email via Resend'}</button></div>
    </section>
    <section className="admin-card"><div className="admin-card-title"><div><span>HISTORY</span><h2>Recent campaigns</h2></div><button type="button" onClick={()=>load().catch(e=>setNotice(e.message))}>Refresh</button></div><div style={{display:'grid',gap:8}}>{history.map(h=><article key={h.id} style={{padding:12,border:'1px solid var(--border-color)',borderRadius:10}}><strong>{h.subject}</strong><p className="muted">{h.audience?.type||'audience'} · {h.total_count} recipients · {h.sent_count} accepted · {h.failed_count} failed</p><small>{new Date(h.created_at).toLocaleString('en-IN')} · {h.status}</small>{h.error_summary&&<p>{h.error_summary}</p>}</article>)}{!history.length&&<p className="muted">No email campaigns yet.</p>}</div></section>
  </div>;
}
