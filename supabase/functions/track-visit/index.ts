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

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BOT_UA_PATTERNS = [
  /Googlebot/i, /Bingbot/i, /Slurp/i, /DuckDuckBot/i, /Baiduspider/i,
  /YandexBot/i, /Sogou/i, /Exabot/i, /ia_archiver/i,
  /AhrefsBot/i, /SemrushBot/i, /DotBot/i, /MJ12bot/i, /MegaIndex/i,
  /BLEXBot/i, /Screaming Frog/i, /Majestic/i,
  /facebookexternalhit/i, /Twitterbot/i, /LinkedInBot/i,
  /WhatsApp/i, /TelegramBot/i, /Discordbot/i, /Slackbot/i, /PingdomBot/i,
  /curl\//i, /wget\//i, /httpie\//i, /python-requests/i, /python-urllib/i,
  /axios\//i, /node-fetch/i, /Go-http-client/i, /Java\//i, /libwww-perl/i,
  /HeadlessChrome/i, /PhantomJS/i, /Selenium/i, /Puppeteer/i, /Playwright/i,
  /bot[\s/;(,)]/i, /crawl/i, /spider/i, /scraper/i, /fetch[/\s]/i,
];

const MIN_HUMAN_UA_LENGTH = 20;

function classifyBot(userAgent: string | null): boolean {
  if (!userAgent || userAgent.length < MIN_HUMAN_UA_LENGTH) return true;
  return BOT_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
}

function resolveCorsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-visitor-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

type UniqueVisitStatsRow = {
  daily_human: number;
  daily_bot: number;
  total_human: number;
  total_bot: number;
};

function jsonError(message: string, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const hasOrigin = typeof origin === 'string' && origin.length > 0;
  if (!hasOrigin) {
    return jsonError('Origin header is required.', 403);
  }

  if (!allowedOrigins.has(origin)) {
    return jsonError('Origin not allowed.', 403);
  }

  const cors = resolveCorsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (request.method !== 'POST') {
    return jsonError('Method not allowed.', 405, cors);
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > 0) {
    return jsonError('This endpoint does not accept request body.', 400, cors);
  }

  const visitorId = request.headers.get('x-visitor-id');
  if (!visitorId || !UUID_V4_RE.test(visitorId)) {
    return jsonError('Missing or malformed x-visitor-id header. Expected UUID v4.', 400, cors);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError('Visit tracking is not configured.', 503, cors);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // --- Rate limiting ---
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
    return jsonError('Rate limit check failed.', 502, cors);
  }

  if (rateData !== true) {
    return jsonError('Rate limit exceeded. Try again later.', 429, cors);
  }

  // --- Classify and track ---
  const userAgent = request.headers.get('user-agent');
  const isBot = classifyBot(userAgent);

  const { data, error } = await supabase.rpc('track_unique_visit', {
    p_visitor_id: visitorId,
    p_is_bot: isBot,
  });

  if (error) {
    console.error('[edge.track_visit] rpc error', { code: error.code, message: error.message });
    return jsonError('Failed to track visit.', 502, cors);
  }

  const payload = (Array.isArray(data) ? data[0] : data) as UniqueVisitStatsRow | null;
  const dailyHuman = Number(payload?.daily_human);
  const dailyBot = Number(payload?.daily_bot);
  const totalHuman = Number(payload?.total_human);
  const totalBot = Number(payload?.total_bot);

  const allValid = [dailyHuman, dailyBot, totalHuman, totalBot].every(
    (n) => Number.isInteger(n) && n >= 0,
  );

  if (!allValid) {
    return jsonError('Invalid visit stats payload.', 502, cors);
  }

  return new Response(JSON.stringify({ dailyHuman, dailyBot, totalHuman, totalBot }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
