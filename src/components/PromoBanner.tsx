import React, { useState } from 'react';
import { Link } from 'react-router-dom';

declare const __COMMIT_HASH__: string;

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

const PROMO_BANNER_STORAGE_KEY = 'promo_banner_img_v5';

const PromoBanner: React.FC<PromoBannerProps> = ({ lastScrapedAt = null, visitStats = null }) => {
  // Use a previously generated image from localStorage, or the mall hero (4:3) as default
  const [imageUrl] = useState<string>(
    localStorage.getItem(PROMO_BANNER_STORAGE_KEY) ||
      `${import.meta.env.BASE_URL}shopping.png`
  );
  const commitVersion = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev';

  return (
    <Link
      to="/special-offers"
      className="block mb-10 w-full rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow relative group border border-rose-200/60 dark:border-gray-800 bg-[#e8d4e4] h-[min(52vw,280px)] sm:h-[min(48vw,320px)] md:h-[min(42vw,400px)] max-h-[420px]"
    >
      <img
        src={imageUrl}
        alt="Specjalne Oferty"
        width={2560}
        height={1920}
        className="absolute inset-0 w-full h-full object-cover object-[30%_42%] sm:object-[28%_40%] md:object-[26%_38%] group-hover:scale-[1.03] transition-transform duration-500 ease-out z-0"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-rose-600/90 via-rose-500/45 to-transparent w-[min(100%,520px)] sm:w-[min(100%,480px)] md:w-[46%] flex items-center p-5 sm:p-7 md:p-10 z-10">
        <div className="text-white max-w-[min(100%,20rem)] sm:max-w-sm md:max-w-md">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black mb-2 [text-shadow:0_2px_16px_rgba(0,0,0,0.35)] tracking-tight">
            OMG! Najlepsze Okazje!
          </h2>
          <p className="text-sm sm:text-base md:text-lg font-medium [text-shadow:0_1px_10px_rgba(0,0,0,0.3)] opacity-95">
            Sprawdź naszą sekretną podstronę z najbardziej niesamowitymi ofertami w Twoim życiu.
          </p>
          <div className="mt-4 inline-block bg-white text-rose-600 px-5 py-2 md:px-6 rounded-full font-bold text-xs sm:text-sm shadow-md group-hover:bg-rose-50 transition-colors">
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
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold tracking-wide text-white/95 shadow-sm backdrop-blur-sm">
        v.{commitVersion}
      </div>
    </Link>
  );
};

export default PromoBanner;
