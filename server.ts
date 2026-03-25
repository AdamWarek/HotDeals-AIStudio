import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DATA_FILE = path.join(process.cwd(), 'public', 'deals.json');

app.get('/api/deals', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read deals data' });
  }
});

app.post('/api/ai/insights', async (req, res) => {
  try {
    const { deals, query } = req.body;
    
    if (!deals || !Array.isArray(deals)) {
      return res.status(400).json({ error: 'Invalid deals data' });
    }

    const prompt = `
      You are an AI assistant for a personal website promotion aggregator.
      Analyze the following deals and answer the user's query.
      
      Query: ${query || 'Provide a summary of the best deals available right now.'}
      
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
