import React from 'react';
import Vote from './Vote';
import { motion } from 'motion/react';
import { ExternalLink, MessageCircle, Clock } from 'lucide-react';
import { sanitizeUrl } from '@/lib/sanitizeUrl';

interface Deal {
  id: string;
  title: string;
  description: string;
  currentPrice: number;
  originalPrice?: number;
  imageUrl: string;
  temperature: number;
  authorName: string;
  createdAt: any;
  category: string;
  url?: string;
}

interface DealCardProps {
  deal: Deal;
}

const DealCard: React.FC<DealCardProps> = ({ deal }) => {
  const isBurning = deal.temperature >= 500;
  const safeUrl = sanitizeUrl(deal.url);
  const safeImageUrl = sanitizeUrl(deal.imageUrl);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-all hover:shadow-md ${
        isBurning ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-950' : ''
      }`}
    >
      <div className="relative aspect-video overflow-hidden group">
        <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
          <img
            src={safeImageUrl}
            alt={deal.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        </a>
        <div className="absolute top-2 left-2 z-10">
          <Vote dealId={deal.id} initialTemperature={deal.temperature} />
        </div>
        {isBurning && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider animate-pulse pointer-events-none">
            Burning
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center text-xs text-gray-400 mb-2 space-x-3">
          <span className="flex items-center">
            <Clock size={12} className="mr-1" />
            {new Date(deal.createdAt?.seconds * 1000).toLocaleDateString()}
          </span>
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 font-medium">
            {deal.category}
          </span>
        </div>

        <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="block">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2 hover:text-red-600 transition-colors cursor-pointer">
            {deal.title}
          </h3>
        </a>

        {deal.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
            {deal.description}
          </p>
        )}

        {deal.currentPrice > 0 && (
          <div className="flex items-baseline space-x-2 mb-4">
            <span className="text-xl font-bold text-red-600">
              {deal.currentPrice.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
            </span>
            {deal.originalPrice && (
              <span className="text-sm text-gray-400 line-through">
                {deal.originalPrice.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-2 text-[10px] font-bold">
              {deal.authorName.charAt(0)}
            </div>
            {deal.authorName}
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="text-gray-400 hover:text-blue-500 transition-colors">
              <MessageCircle size={18} />
            </button>
            <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors inline-block">
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DealCard;
