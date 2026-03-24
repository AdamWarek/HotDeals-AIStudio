import { GoogleGenAI } from "@google/genai";
import fs from "fs";

async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Generating image with gemini-2.5-flash-image...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: 'A colorful cartoon illustration of a sweet white teenage girl with long hair, looking extremely happy and excited to see the best shopping offers and deals in her entire life, holding shopping bags, vibrant colors, cute style',
      config: {
        imageConfig: { aspectRatio: "16:9" }
      }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        fs.writeFileSync('./public/promo-banner.png', Buffer.from(part.inlineData.data, 'base64'));
        console.log('Image successfully saved to public/promo-banner.png');
        return;
      }
    }
    console.log("No image data found in response.");
  } catch (error) {
    console.error("Error generating image:", error);
  }
}

run();
