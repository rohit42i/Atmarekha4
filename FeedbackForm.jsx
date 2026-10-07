import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { validateEmail, rememberDraft, loadDraft, clearDraft } from './formUX.js';

const DRAFT_KEY = 'atma-feedback-draft-v1';
const QUEUE_KEY = 'atma-feedback-queue-v1';
const DB_NAME = 'atma-feedback-sync-v1';
const STORE_NAME = 'queue';

function openQueueDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'));
  });
}

async function queueFeedback(payload) {
  try {
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ ...payload, id: crypto.randomUUID?.() || String(Date.now() + Math.random()) });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    const queue=readQueue();
    writeQueue([...queue,payload]);
    return false;
  }
}

async function flushIndexedDbQueue(submitPayload) {
  try {
    const db = await openQueueDb();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    for (const item of items) {
      try {
        await submitPayload(item);
        await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).delete(item.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
      } catch {}
    }
    db.close();
    return items.length;
  } catch { return 0; }
}

export default function FeedbackForm() {
  const draft = loadDraft(DRAFT_KEY, { email:'', name:'', message:'', type:'feedback' });
  const [email,setEmail]=useState(draft.email||''), [name,setName]=useState(draft.name||''), [message,setMessage]=useState(draft.message||''), [type,setType]=useState(draft.type||'feedback');
  const [honeypot,setHoneypot]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState(''), [success,setSuccess]=useState(''), [fieldErrors,setFieldErrors]=useState({});
  const emailCheck=validateEmail(email);

  useEffect(()=>{rememberDraft(DRAFT_KEY,{email,name,message,type})},[email,name,message,type]);

  const submitPayload = async payload => {
    const { data, error: fnError } = await supabase.functions.invoke('submit-feedback', { body: payload });
    if (fnError) throw fnError;
    return data;
  };

  const flushQueue = async () => {
    if (!navigator.onLine) return;
    const indexedCount = await flushIndexedDbQueue(submitPayload);
    const queue=readQueue();
    if(!queue.length){if(indexedCount)window.dispatchEvent(new CustomEvent('atma-toast',{detail:{message:'Saved feedback was sent.'}}));return;}
    const remaining=[];
    for(const payload of queue){try{await submitPayload(payload)}catch{remaining.push(payload)}}
    writeQueue(remaining);
    if((queue.length||indexedCount)&&!remaining.length)window.dispatchEvent(new CustomEvent('atma-toast',{detail:{message:'Saved feedback was sent.'}}));
  };

  useEffect(()=>{
    const online=()=>flushQueue();
    window.addEventListener('online',online);
    if(navigator.onLine)flushQueue();
    return()=>window.removeEventListener('online',online)
  },[]);

  const submit=async event=>{
    event.preventDefault();
    if(busy)return;
    setError('');setSuccess('');
    const next={};
    if(!emailCheck.ok)next.email=emailCheck.message;
    if(!message.trim())next.message='Please write a message.';
    if(message.trim().length>2000)next.message='Message must be 2000 characters or fewer.';
    if(Object.keys(next).length){setFieldErrors(next);return}
    if(honeypot){setSuccess('Thanks.');clearDraft(DRAFT_KEY);return}
    const payload={email:email.trim(),name:name.trim().slice(0,80),message:message.trim(),type,website:''};
    setBusy(true);
    try{
      if(!navigator.onLine){
        const queued = await queueFeedback(payload);
        if (queued && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => reg.sync?.register('atma-feedback-sync')).catch(()=>{});
        }
        setSuccess('You are offline. Your feedback was saved on this device and will be sent when you reconnect.');
        clearDraft(DRAFT_KEY);
        return;
      }
      await submitPayload(payload);
      clearDraft(DRAFT_KEY);
      setMessage('');setName('');setEmail('');
      setSuccess('Thanks — your message was sent successfully.');
    }catch(err){setError(err?.message||'Something went wrong. Please try again.')}
    finally{setBusy(false)}
  };

  return <form className="feedback-form" onSubmit={submit} noValidate aria-labelledby="feedback-form-title">
    <h2 id="feedback-form-title">Send feedback</h2>
    <p>For bugs, content reports, privacy requests or general feedback. Please do not include passwords or payment credentials.</p>
    <div className="feedback-field-grid">
      <label>Name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoComplete="name"/></label>
      <label>Email<input type="email" value={email} onChange={e=>{setEmail(e.target.value);setFieldErrors(v=>({...v,email:undefined}));setError('')}} autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email?'feedback-email-error':'feedback-email-help'}/>{fieldErrors.email?<span id="feedback-email-error" className="form-field-error">{fieldErrors.email}</span>:email?<span id="feedback-email-help" className={emailCheck.ok?'form-field-success':'form-field-error'}>{emailCheck.message}</span>:null}</label>
    </div>
    <label>Type<select value={type} onChange={e=>setType(e.target.value)}><option value="feedback">Website feedback</option><option value="content-report">Content report</option><option value="privacy">Privacy / DPDP request</option><option value="other">Other</option></select></label>
    <label>Message<textarea value={message} onChange={e=>{setMessage(e.target.value.slice(0,2000));if(fieldErrors.message)setFieldErrors(v=>({...v,message:undefined}))}} maxLength={2000} rows="5" required aria-invalid={Boolean(fieldErrors.message)} aria-describedby="feedback-message-counter"/><span id="feedback-message-counter" className={'character-counter '+(message.length>=1800?'near-limit ':'')+(message.length>=2000?'at-limit':'')}>{message.length}/2000</span>{fieldErrors.message&&<span className="form-field-error">{fieldErrors.message}</span>}</label>
    <label className="feedback-honeypot" aria-hidden="true">Website<input tabIndex="-1" autoComplete="off" value={honeypot} onChange={e=>setHoneypot(e.target.value)}/></label>
    <div className="feedback-form-actions"><button type="submit" className="primary-button" disabled={busy}>{busy?<><span className="button-spinner" aria-hidden="true"/> Please wait…</>:'Send message'}</button><span className="feedback-secure-note">⌁ Secure connection · no payment details needed</span></div>
    {success&&<p className="form-field-success" role="status" aria-live="polite">{success}</p>}
    {error&&<p className="form-field-error" role="alert">{error}</p>}
  </form>;
}
