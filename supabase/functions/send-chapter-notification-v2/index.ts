import "jsr:@supabase/functions-js/edge-runtime.d.ts";

async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) { try { await reader.cancel(); } catch {} return null; } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST') return response({ok:false,error:'Method not allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')||'', service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'', publicKey=Deno.env.get('VAPID_PUBLIC_KEY')||'', privateKey=Deno.env.get('VAPID_PRIVATE_KEY')||'';
  if(!url||!service||!publicKey||!privateKey) return response({ok:false,error:'Notification service is not configured.'},503);
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token) return response({ok:false,error:'Authentication required'},401);
  const db=createClient(url,service);
  const {data:{user},error:ue}=await db.auth.getUser(token);
  if(ue||!user) return response({ok:false,error:'Invalid authentication'},401);
  const {data:admin}=await db.from('admins').select('user_id,role').eq('user_id',user.id).maybeSingle();
  if(!admin||!['owner','admin'].includes(String(admin.role||'').trim().toLowerCase())) return response({ok:false,error:'Admin access required'},403);
const rate=await db.rpc('consume_rate_limit',{p_rate_key:`admin-push:${user.id}`,p_limit:10,p_window_seconds:60});if(rate.error){console.error('Push rate-limit check failed.');return response({ok:false,error:'Notification service temporarily unavailable.'},503)}if(rate.data===false)return response({ok:false,error:'Too many notification sends. Please try again shortly.'},429);
  const rawBody=await readLimitedBody(req,16*1024);if(rawBody===null)return response({ok:false,error:'Request body is too large.'},413);let body:any;try{body=JSON.parse(rawBody)}catch{return response({ok:false,error:'Invalid JSON body.'},400)}if(!body||typeof body!=='object'||Array.isArray(body))return response({ok:false,error:'Invalid request body.'},400);
  const title=String(body.title||'').trim(), message=String(body.body||'').trim(), target=String(body.target||'all').trim(), dedupeKey=body.dedupeKey?String(body.dedupeKey).trim():null;
  if(!title||!message) return response({ok:false,error:'Notification title and message are required.'},422);
  if(title.length>160||message.length>1000) return response({ok:false,error:'Notification title or message is too long.'},422);
  let selectedUserId:string|null=null;
  if(target.startsWith('user:')){selectedUserId=target.slice(5).trim();if(!UUID.test(selectedUserId))return response({ok:false,error:'Invalid selected user.'},422);}
  if(!['all','community'].includes(target)&&!selectedUserId) return response({ok:false,error:'Invalid notification target.'},422);
  if(dedupeKey){
   const {data:existing}=await db.from('admin_notification_log').select('id,status,target_count,sent_count,failed_count').eq('dedupe_key',dedupeKey).maybeSingle();
   if(existing) return response({ok:false,duplicate:true,error:'Duplicate notification blocked.',log:existing},409);
  }
  const {data:log,error:le}=await db.from('admin_notification_log').insert({admin_user_id:user.id,title,body:message,target,dedupe_key:dedupeKey,status:'sending'}).select('id').single();
  if(le){
   if((le as any).code==='23505') return response({ok:false,duplicate:true,error:'Duplicate notification blocked.'},409);
   throw le;
  }
  webpush.setVapidDetails('mailto:admin@atmarekha.in',publicKey,privateKey);
  let q=db.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth');
  if(target==='community'){
   const {data:members,error:me}=await db.from('community_members').select('user_id');
   if(me) throw me;
   const ids=[...new Set((members||[]).map((x:any)=>x.user_id).filter(Boolean))];
   q=ids.length?q.in('user_id',ids):q.eq('user_id','00000000-0000-0000-0000-000000000000');
  }else if(selectedUserId){q=q.eq('user_id',selectedUserId);}
  const {data:subs,error:se}=await q;
  if(se) throw se;
  const list=subs||[];
  if(!list.length){
   const reason=selectedUserId?'Selected user has no active notification subscription.':'There are no active notification subscriptions for this target.';
   await db.from('admin_notification_log').update({target_count:0,sent_count:0,failed_count:0,removed_count:0,status:'no_subscribers',sent_at:new Date().toISOString(),error:reason}).eq('id',log.id);
   await db.from('admin_activity_log').insert({admin_user_id:user.id,action:'send_notification_no_subscriber',entity_type:'notification',entity_id:log.id,details:{target,title,reason}});
   return response({ok:false,error:reason,code:'NO_SUBSCRIPTION',logId:log.id,total:0,sent:0,failed:0,removed:0},422);
  }
  let sent=0,failed=0,removed=0;
  const payload=JSON.stringify({title,body:message,icon:'/favicon.png',badge:'/favicon.png',url:body.url||body.chapterUrl||'/',tag:body.tag||`atma-rekha-${dedupeKey||log.id}`,renotify:true});
  for(const s of list){
   try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload);sent++;}
   catch(e){failed++;const code=(e as any)?.statusCode;if(code===404||code===410){const {error}=await db.from('push_subscriptions').delete().eq('id',s.id);if(!error)removed++;}}
  }
  const status=sent===list.length?'sent':sent>0?'partial':'failed';
  await db.from('admin_notification_log').update({target_count:list.length,sent_count:sent,failed_count:failed,removed_count:removed,status,sent_at:new Date().toISOString(),error:failed?`${failed} notification delivery attempt(s) failed.`:null}).eq('id',log.id);
  await db.from('admin_activity_log').insert({admin_user_id:user.id,action:'send_notification',entity_type:'notification',entity_id:log.id,details:{target,sent,failed,removed,title}});
  return response({ok:sent>0,logId:log.id,total:list.length,sent,failed,removed,status},sent>0?200:502);
 }catch(error){console.error('Notification send failed:',error);return response({ok:false,error:error instanceof Error?error.message:'Notification send failed.'},500);}
});