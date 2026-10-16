import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
const ORIGINS=new Set(['https://www.atmarekha.in','https://atmarekha.in','http://localhost:5173']);
const cors=(o:string|null)=>({'Access-Control-Allow-Origin':o&&ORIGINS.has(o)?o:'https://www.atmarekha.in','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'});
const json=(b:Record<string,unknown>,s:number,o:string|null)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(o),'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{const o=req.headers.get('origin');if(req.method==='OPTIONS')return new Response('ok',{headers:cors(o)});if(req.method!=='POST')return json({error:'Method not allowed.'},405,o);try{const keyId=Deno.env.get('RAZORPAY_KEY_ID')?.trim()||'',secret=Deno.env.get('RAZORPAY_KEY_SECRET')?.trim()||'',url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';if(!keyId||!secret||!url||!service)return json({error:'Payment server configuration is incomplete.'},500,o);const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();if(!token)return json({error:'Authentication required. Please sign in again.'},401,o);const admin=createClient(url,service);const {data:{user},error:ae}=await admin.auth.getUser(token);if(ae||!user)return json({error:'Authentication required. Please sign in again.'},401,o);const {data:rateAllowed,error:rateError}=await admin.rpc('consume_rate_limit',{p_rate_key:`razorpay-subscription-cancel:${user.id}`,p_limit:5,p_window_seconds:60});if(rateError){console.error('Subscription cancellation rate-limit check failed.');return json({error:'Cancellation temporarily unavailable.'},503,o)}if(rateAllowed===false)return json({error:'Too many requests. Please try again shortly.'},429,o);const rawBody=await readLimitedBody(req,8192);if(rawBody===null)return json({error:'Request body is too large.'},413,o);let b:any;try{b=JSON.parse(rawBody)}catch{return json({error:'Invalid JSON body.'},400,o)}if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Invalid request body.'},400,o);const sid=String(b?.subscription_id||'');if(!sid)return json({error:'Missing subscription ID.'},400,o);const {data:record,error:re}=await admin.from('user_subscriptions').select('id,provider_subscription_id,status').eq('user_id',user.id).eq('provider','razorpay').eq('provider_subscription_id',sid).maybeSingle();if(re)throw new Error(`Subscription lookup failed: ${re.message}`);if(!record)return json({error:'Subscription was not found for this account.'},404,o);if(record.status==='cancelled'||record.status==='expired')return json({ok:true,status:record.status},200,o);const response=await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(sid)}/cancel`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${keyId}:${secret}`)}`,'Content-Type':'application/json'},body:JSON.stringify({cancel_at_cycle_end:true})});const result=await response.json().catch(()=>null);if(response.status===401)return json({error:'Razorpay authentication failed. Check the matching Test/Live server key pair.'},401,o);if(!response.ok)return json({error:result?.error?.description||'Razorpay could not cancel the subscription.'},502,o);const {error:ue}=await admin.from('user_subscriptions').update({cancel_at_period_end:true,updated_at:new Date().toISOString()}).eq('id',record.id);if(ue)throw new Error(`Subscription update failed: ${ue.message}`);return json({ok:true,status:result?.status||'active',cancel_at_period_end:true},200,o)}catch(e){const m=e instanceof Error?e.message:'Unable to cancel subscription.';console.error('Razorpay cancellation failed:',m);return json({error:'Unable to cancel subscription. Please try again.'},500,o)}});
