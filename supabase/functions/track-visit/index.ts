import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://adamwarek.github.io',
];

const allowedOrigins = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? defaultAllowedOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const RATE_LIMIT_MAX_REQUESTS = Number(Deno.env.get('VISITS_RATE_LIMIT_MAX_REQUESTS') ?? '30');
const RATE_LIMIT_WINDOW_SECONDS = Number(Deno.env.get('VISITS_RATE_LIMIT_WINDOW_SECONDS') ?? '60');

function resolveCorsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

type VisitStatsRow = {
  daily_visits: number;
  total_visits: number;
};

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const hasOrigin = typeof origin === 'string' && origin.length > 0;
  if (!hasOrigin) {
    return new Response(JSON.stringify({ error: 'Origin header is required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isAllowedOrigin = allowedOrigins.has(origin);

  if (!isAllowedOrigin) {
    return new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cors = resolveCorsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > 0) {
    return new Response(JSON.stringify({ error: 'This endpoint does not accept request body.' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Visit tracking is not configured.' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';
  const ipKey = `${ip}|${origin}`;
  const { data: rateData, error: rateError } = await supabase.rpc('consume_visit_rate_limit', {
    p_ip_key: ipKey,
    p_limit: RATE_LIMIT_MAX_REQUESTS,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (rateError) {
    console.error('[edge.track_visit] rate limit rpc error', { code: rateError.code });
    return new Response(JSON.stringify({ error: 'Rate limit check failed.' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (rateData !== true) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
      status: 429,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase.rpc('track_visit');

  if (error) {
    console.error('[edge.track_visit] rpc error', { code: error.code });
    return new Response(JSON.stringify({ error: 'Failed to track visit.' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const payload = (Array.isArray(data) ? data[0] : data) as VisitStatsRow | null;
  const dailyVisits = Number(payload?.daily_visits);
  const totalVisits = Number(payload?.total_visits);

  if (!Number.isInteger(dailyVisits) || dailyVisits < 0 || !Number.isInteger(totalVisits) || totalVisits < 0) {
    return new Response(JSON.stringify({ error: 'Invalid visit stats payload.' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ dailyVisits, totalVisits }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
