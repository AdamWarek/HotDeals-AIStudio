import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const PromoBanner: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(localStorage.getItem('promo_banner_img_v3'));
  const [loading, setLoading] = useState(!imageUrl);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (imageUrl) return;

    const fetchImage = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: 'A colorful cartoon illustration of a sweet white teenage girl with long hair, looking extremely happy and excited to see the best shopping offers and deals in her entire life, holding shopping bags, vibrant colors, cute style, wide shot, character positioned on the far right side of the image, empty space on the left for text, full character visible in frame, plenty of headroom',
          config: {
            imageConfig: {
              aspectRatio: "16:9",
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            const url = `data:image/png;base64,${base64EncodeString}`;
            setImageUrl(url);
            try {
              localStorage.setItem('promo_banner_img_v3', url);
            } catch (e) {
              console.warn('Could not save image to localStorage (quota exceeded)');
            }
            setLoading(false);
            return;
          }
        }
        setError(true);
        setLoading(false);
      } catch (err) {
        console.error("Failed to generate image:", err);
        setError(true);
        setLoading(false);
      }
    };

    fetchImage();
  }, [imageUrl]);

  return (
    <Link to="/special-offers" className="block mb-10 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group border border-gray-100 dark:border-gray-800 bg-gray-900 min-h-[300px] md:min-h-[400px]">
      {loading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 bg-gray-900 z-0">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span className="text-sm font-medium">Generowanie obrazka (nano banana)...</span>
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 bg-gray-900 z-0">
          <span className="text-sm font-medium">Nie udało się wygenerować obrazka.</span>
        </div>
      ) : imageUrl ? (
        <img 
          src={imageUrl} 
          alt="Specjalne Oferty" 
          className="absolute inset-0 w-full h-full object-cover object-right-top md:object-right group-hover:scale-105 transition-transform duration-500 z-0"
        />
      ) : null}
      
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/95 via-red-600/60 to-transparent w-full md:w-3/4 flex items-center p-6 md:p-10 z-10">
        <div className="text-white max-w-md md:max-w-lg">
          <h2 className="text-3xl md:text-5xl font-black mb-2 drop-shadow-md tracking-tight">OMG! Najlepsze Okazje!</h2>
          <p className="text-base md:text-lg font-medium drop-shadow-md opacity-90">Sprawdź naszą sekretną podstronę z najbardziej niesamowitymi ofertami w Twoim życiu.</p>
          <div className="mt-4 inline-block bg-white text-red-600 px-6 py-2 rounded-full font-bold text-sm shadow-sm group-hover:bg-gray-50 transition-colors">
            Odkryj Oferty
          </div>
        </div>
      </div>
    </Link>
  );
};

export default PromoBanner;
