const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiny-pond-c959.rohitbaswaraj.workers.dev https://pdlpl-media.rohitbaswaraj.workers.dev https://*.supabase.co https://*.razorpay.com; connect-src 'self' https://pbukwjokgkqacaphlqzm.supabase.co wss://pbukwjokgkqacaphlqzm.supabase.co https://tiny-pond-c959.rohitbasaraj.workers.dev https://pdlpl-media.rohitbaswaraj.workers.dev https://atma-rekha-analytics.rohitbasaraj.workers.dev https://api.razorpay.com https://api.pwnedpasswords.com; frame-src 'self' https://checkout.razorpay.com https://*.razorpay.com; font-src 'self' data:; worker-src 'self' blob:; media-src 'self' blob:; manifest-src 'self'",
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};