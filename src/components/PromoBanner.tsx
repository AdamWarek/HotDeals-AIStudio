import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function formatLastScrape(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

type PromoBannerProps = {
  lastScrapedAt?: string | null;
  visitStats?: {
    dailyHuman: number;
    dailyBot: number;
    totalHuman: number;
    totalBot: number;
  } | null;
};

const PromoBanner: React.FC<PromoBannerProps> = ({ lastScrapedAt = null, visitStats = null }) => {
  // Use the previously generated image from localStorage, or a static fallback if it's cleared
  const [imageUrl] = useState<string>(
    localStorage.getItem('promo_banner_img_v4') ||
      `${import.meta.env.BASE_URL}excited-teenage-friends.png`
  );

  return (
    <Link to="/special-offers" className="block mb-10 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group border border-gray-100 dark:border-gray-800 bg-gray-900 min-h-[300px] md:min-h-[400px]">
      <img 
        src={imageUrl} 
        alt="Specjalne Oferty" 
        className="absolute inset-0 w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-500 z-0 [mask-image:radial-gradient(circle_at_center,black_60%,transparent)]"
      />
      
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/95 via-red-600/60 to-transparent w-full md:w-3/4 flex items-center p-6 md:p-10 z-10">
        <div className="text-white max-w-md md:max-w-lg">
          <h2 className="text-3xl md:text-5xl font-black mb-2 drop-shadow-md tracking-tight">OMG! Najlepsze Okazje!</h2>
          <p className="text-base md:text-lg font-medium drop-shadow-md opacity-90">Sprawdź naszą sekretną podstronę z najbardziej niesamowitymi ofertami w Twoim życiu.</p>
          <div className="mt-4 inline-block bg-white text-red-600 px-6 py-2 rounded-full font-bold text-sm shadow-sm group-hover:bg-gray-50 transition-colors">
            Odkryj Oferty
          </div>
          {lastScrapedAt ? (
            <p className="mt-2 text-xs md:text-sm text-white/75 font-medium drop-shadow-sm tracking-wide">
              Odświeżone {formatLastScrape(lastScrapedAt)}
            </p>
          ) : null}
          {visitStats ? (
            <p className="mt-1 text-xs md:text-sm text-white/80 font-medium drop-shadow-sm tracking-wide">
              Dziś: {visitStats.dailyHuman} • Łącznie: {visitStats.totalHuman}
              <span className="ml-2 text-white/50 text-[0.65rem] md:text-xs">
                (boty: {visitStats.dailyBot} / {visitStats.totalBot})
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
};

export default PromoBanner;
