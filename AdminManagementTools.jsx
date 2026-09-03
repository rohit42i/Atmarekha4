import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentMemberships, supabase } from './supabase';
import { getAdminRole } from './adminAuth';

const formatDate = value => value ? new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const formatTime = value => value ? new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
const planLabel = value => ({ mini_member:'Mini Member', supporter:'Member', premium:'Premium Member' }[value] || 'Free');

async function verifyAdmin(){
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) throw new Error('Admin session required.');
  const role = await getAdminRole(user.id);
  if(role !== 'owner' && role !== 'admin') throw new Error('Admin access required.');
  return user;
}

export default function AdminManagementTools(){
  const [isAdmin,setIsAdmin]=useState(false),[nav,setNav]=useState(null),[open,setOpen]=useState(null);
  const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [users,setUsers]=useState([]),[memberships,setMemberships]=useState(new Map()),[notifications,setNotifications]=useState([]),[activity,setActivity]=useState([]);
  const [pushForm,setPushForm]=useState({title:'📖 Atma Rekha',body:'A new message is available.',url:'/',audience:'all'}),[pushSending,setPushSending]=useState(false),[pushResult,setPushResult]=useState('');

  useEffect(()=>{let active=true; const check=async()=>{try{await verifyAdmin();if(active)setIsAdmin(true)}catch{if(active)setIsAdmin(false)}}; check(); const {data:l}=supabase.auth.onAuthStateChange(()=>check()); return()=>{active=false;l?.subscription?.unsubscribe()}},[]);

  useEffect(()=>{
    if(!isAdmin)return;
    let observer;
    const attach=()=>{const el=document.querySelector('.admin-tabs');if(el){setNav(el);return true}return false};
    if(!attach()){observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true})}
    return()=>observer?.disconnect();
  },[isAdmin]);

  useEffect(()=>{const close=e=>{if(e.key==='Escape')setOpen(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);

  const loadUsers=async()=>{setLoading(true);setError('');try{await verifyAdmin();const {data,error:e}=await supabase.from('profiles').select('id,username,display_name,avatar_url,created_at').order('created_at',{ascending:false}).limit(500);if(e)throw e;const rows=data||[];setUsers(rows);try{setMemberships(await getCurrentMemberships(rows.map(r=>r.id)))}catch{setMemberships(new Map())}}catch(e){setError(e.message||'Unable to load users.')}finally{setLoading(false)}};
  const loadNotifications=async()=>{setLoading(true);setError('');try{await verifyAdmin();const {data,error:e}=await supabase.from('announcements').select('title,content,image_url,is_pinned,published_at,created_at').order('created_at',{ascending:false}).limit(200);if(e)throw e;setNotifications(data||[])}catch(e){setError(e.message||'Unable to load notifications.')}finally{setLoading(false)}};
  const loadActivity=async()=>{setLoading(true);setError('');try{await verifyAdmin();const results=await Promise.all([
    supabase.from('chapters').select('chapter_number,title,created_at').order('created_at',{ascending:false}).limit(25),
    supabase.from('comments').select('author_name,content,created_at').order('created_at',{ascending:false}).limit(25),
    supabase.from('comment_reports').select('reason,created_at').order('created_at',{ascending:false}).limit(25),
    supabase.from('announcements').select('title,created_at').order('created_at',{ascending:false}).limit(25)
  ]);for(const r of results)if(r.error)throw r.error;const [c,co,r,a]=results;setActivity([
    ...(c.data||[]).map(x=>({type:'Chapter',title:`Chapter ${x.chapter_number} · ${x.title||'Untitled'}`,time:x.created_at})),
    ...(co.data||[]).map(x=>({type:'Comment',title:`${x.author_name||'Reader'} · ${String(x.content||'').slice(0,90)}`,time:x.created_at})),
    ...(r.data||[]).map(x=>({type:'Report',title:x.reason||'Comment report',time:x.created_at})),
    ...(a.data||[]).map(x=>({type:'Notification',title:x.title||'Announcement',time:x.created_at}))
  ].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,60))}catch(e){setError(e.message||'Unable to load recent activity.')}finally{setLoading(false)}};

  const sendPushNotification=async event=>{
    event.preventDefault();
    if(pushSending)return;
    setPushSending(true);setPushResult('');setError('');
    try{
      await verifyAdmin();
      const title=pushForm.title.trim();
      const body=pushForm.body.trim();
      const url=pushForm.url.trim()||'/';
      if(!title)throw new Error('Notification title is required.');
      if(!body)throw new Error('Notification message is required.');
      const {data,error:e}=await supabase.functions.invoke('send-chapter-notification-v2',{body:{title,body,url,communityOnly:pushForm.audience==='community',tag:pushForm.audience==='community'?'atma-rekha-community':'atma-rekha-admin'}});
      if(e)throw e;
      if(!data?.ok)throw new Error(data?.error||'Notification delivery failed.');
      setPushResult(`Sent ${Number(data.sent||0)} notification${Number(data.sent||0)===1?'':'s'} successfully${data.failed?`; ${Number(data.failed)} failed`:''}.`);
      await loadNotifications();
    }catch(e){setError(e?.message||'Unable to send push notification.');}
    finally{setPushSending(false)}
  };

  const openView=type=>{setQuery('');setStatus('all');setError('');setPushResult('');setOpen(type);if(type==='users')loadUsers();if(type==='notifications')loadNotifications();if(type==='activity')loadActivity()};