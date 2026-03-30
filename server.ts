import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

/** Split comma-separated origins; trim whitespace; drop empties. */
function parseCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const ALLOWED_ORIGINS = [
  ...new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...parseCorsOrigins(process.env.CORS_ORIGIN),
  ]),
];

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST'],
}));

app.use(express.json({ limit: '100kb' }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI insights rate limit exceeded. Try again in a few minutes.' },
});

const MAX_QUERY_LENGTH = 500;
const MAX_DEALS_COUNT = 50;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceRoleKey);

const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

const DATA_FILE = path.join(process.cwd(), 'public', 'deals.json');

app.get('/api/deals', async (_req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
    res.status(500).json({ error: 'Failed to read deals data' });
  }
});

app.post('/api/ai/insights', aiLimiter, async (req, res) => {
  try {
    const { deals, query } = req.body;

    if (!deals || !Array.isArray(deals)) {
      return res.status(400).json({ error: 'Invalid deals data' });
    }

    if (deals.length > MAX_DEALS_COUNT) {
      return res.status(400).json({ error: `Too many deals. Maximum is ${MAX_DEALS_COUNT}.` });
    }

    const sanitizedQuery = typeof query === 'string'
      ? query.slice(0, MAX_QUERY_LENGTH)
      : 'Provide a summary of the best deals available right now.';

    const prompt = `
      You are an AI assistant for a personal website promotion aggregator.
      Analyze the following deals and answer the user's query.
      
      Query: ${sanitizedQuery}
      
      Deals:
      ${JSON.stringify(deals, null, 2)}
      
      Rules:
      1. Provide a concise, helpful response.
      2. Highlight the most valuable or relevant deals.
      3. Do not invent deals that are not in the provided list.
      4. Format your response in Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
    });

    res.json({ result: response.text });
  } catch (error) {
    console.error('AI Insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

const visitsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Visit tracking rate limit exceeded. Try again in a moment.' },
});

app.post('/api/visits/track', visitsLimiter, async (req, res) => {
  try {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      return res.status(400).json({ error: 'This endpoint does not accept request body.' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Visit tracking is not configured.' });
    }

    const { data, error } = await supabase.rpc('track_visit');

    if (error) {
      console.error('[visits.track] rpc failed', { code: error.code, message: error.message });
      return res.status(502).json({ error: 'Failed to track visit.' });
    }

    const payload = Array.isArray(data) ? data[0] : data;
    const dailyVisits = Number(payload?.daily_visits);
    const totalVisits = Number(payload?.total_visits);

    if (!Number.isInteger(dailyVisits) || dailyVisits < 0 || !Number.isInteger(totalVisits) || totalVisits < 0) {
      console.error('[visits.track] invalid rpc payload shape');
      return res.status(502).json({ error: 'Invalid visit stats payload.' });
    }

    return res.json({ dailyVisits, totalVisits });
  } catch {
    return res.status(500).json({ error: 'Unexpected visit tracking error.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
