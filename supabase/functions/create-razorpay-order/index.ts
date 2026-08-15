import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = new Set([
  'https://www.atmarekha.in',
  'https://atmarekha.in',
  'http://localhost:5173',
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atmarekha.in';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, origin);
  }

  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

  if (!keyId || !keySecret) {
    return json({ error: 'Razorpay server configuration is missing.' }, 500, origin);
  }

  try {
    const body = await req.json();
    const amount = Number(body?.amount);
    const currency = String(body?.currency || 'INR').toUpperCase();
    const receipt = body?.receipt ? String(body.receipt) : `atma_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    if (!Number.isInteger(amount) || amount < 100) {
      return json({ error: 'Amount must be an integer of at least 100 paise.' }, 400, origin);
    }

    if (amount > 50_000_000) {
      return json({ error: 'Amount exceeds Razorpay standard transaction limits.' }, 400, origin);
    }

    if (currency !== 'INR') {
      return json({ error: 'Only INR orders are supported.' }, 400, origin);
    }

    if (receipt.length > 40) {
      return json({ error: 'Receipt must be 40 characters or fewer.' }, 400, origin);
    }

    const auth = btoa(`${keyId}:${keySecret}`);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt,
        capture: 'automatic',
      }),
    });

    const result = await response.json().catch(() => null);

    if (response.status === 401) {
      return json({ error: 'Razorpay authentication failed. Check the server API keys.' }, 401, origin);
    }

    if (!response.ok) {
      return json(
        { error: result?.error?.description || 'Razorpay could not create the order.' },
        500,
        origin,
      );
    }

    return json(
      {
        order_id: result.id,
        amount: result.amount,
        currency: result.currency,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error('Razorpay order creation failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Unable to create Razorpay order.' }, 500, origin);
  }
});
