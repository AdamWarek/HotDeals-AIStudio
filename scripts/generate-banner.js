import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateBanner() {
  console.log('Generating banner image...');
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: 'A 3D cartoon style illustration of a teenage girl, fully visible full body, looking extremely happy and excited, holding shopping bags. Vibrant colors, cute 3D Pixar style. Wide shot, character positioned on the far right side of the image, empty space on the left for text, plenty of headroom.',
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        const buffer = Buffer.from(base64Data, 'base64');
        const outputPath = path.join(__dirname, '../public/banner.png');
        fs.writeFileSync(outputPath, buffer);
        console.log(`Successfully saved banner image to ${outputPath}`);
        return;
      }
    }
    console.log('No image data found in response.');
  } catch (error) {
    console.error('Error generating image:', error);
  }
}

generateBanner();
