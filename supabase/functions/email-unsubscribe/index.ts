import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const page=(title:string,message:string,status=200)=>new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;background:#101010;color:#f5f5f5;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:520px;padding:32px"><h1>${title}</h1><p>${message}</p><a style="color:#b6c7ff" href="https://www.atmarekha.in">Return to Atma Rekha</a></main></body></html>`,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
function readSupabaseServiceRoleKey() {
  const configured = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (parsed?.default) return String(parsed.default).trim();
    } catch (_) {}
  }
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}

Deno.serve(async req=>{if(req.method!=="GET")return new Response("Method not allowed",{status:405});const token=new URL(req.url).searchParams.get("token")||"";if(!/^[0-9a-f-]{36}$/i.test(token))return page("Invalid link","This unsubscribe link is invalid.",400);const url=Deno.env.get("SUPABASE_URL")||"",key=readSupabaseServiceRoleKey();if(!url||!key)return page("Temporarily unavailable","Please try again later.",503);const db=createClient(url,key);const {data,error}=await db.from("email_marketing_preferences").select("user_id").eq("unsubscribe_token",token).maybeSingle();if(error||!data)return page("Link unavailable","This unsubscribe link is invalid or expired.",404);const {error:updateError}=await db.from("email_marketing_preferences").update({marketing_unsubscribed:true,updated_at:new Date().toISOString()}).eq("user_id",data.user_id);if(updateError)return page("Unable to update preferences","Please try again later.",500);const contactKey=Deno.env.get("RESEND_CONTACTS_API_KEY")||"";if(contactKey){try{const {data:userData}=await db.auth.admin.getUserById(data.user_id);const email=String(userData?.user?.email||"").trim();if(email){const sync=await fetch("https://api.resend.com/contacts/"+encodeURIComponent(email),{method:"PATCH",headers:{"Authorization":"Bearer "+contactKey,"Content-Type":"application/json"},body:JSON.stringify({unsubscribed:true})});if(!sync.ok&&sync.status!==404)console.error("Resend unsubscribe sync failed.",sync.status);}}catch(error){console.error("Resend unsubscribe sync failed.",error);}}return page("You’re unsubscribed","You will no longer receive Atma Rekha chapter updates or promotional emails. Essential account and security emails may still be sent.");});