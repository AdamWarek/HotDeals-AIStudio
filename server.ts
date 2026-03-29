import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

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
