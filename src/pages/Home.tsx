import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import DealCard from '../components/DealCard';
import ThemeToggle from '../components/ThemeToggle';
import PromoBanner from '../components/PromoBanner';
import { Plus, Search, Flame, TrendingUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Home: React.FC = () => {
  const { theme } = useTheme();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('newest');

  useEffect(() => {
    fetch('/data/all_promos.json')
      .then(res => res.json())
      .then(data => {
        // Map scraped deals to the format expected by DealCard
        const mappedDeals = data.map((deal: any, index: number) => {
          let originalPrice = undefined;
          let pct = 0;
          let currentPrice = 0;
          
          // Handle new schema
          if (deal.sale_price) {
            currentPrice = parseFloat(deal.sale_price.replace(' PLN', ''));
            originalPrice = parseFloat((deal.original_price || '').replace(' PLN', ''));
            pct = deal.discount_pct || 0;
          } 
          // Handle old schema
          else if (deal.price) {
            currentPrice = parseFloat(deal.price);
            if (deal.discount) {
              pct = parseInt(deal.discount.replace('%', ''));
              if (!isNaN(pct) && pct > 0 && pct < 100) {
                originalPrice = currentPrice / (1 - pct / 100);
              } else {
                pct = 0;
              }
            }
          }

          // Map brand name from site ID if needed
          let brandName = deal.brand || deal.source_name || deal.site || 'System';
          if (brandName.toLowerCase() === 'hm') brandName = 'H&M';
          if (brandName.toLowerCase() === 'pullandbear') brandName = 'Pull&Bear';
          if (brandName.toLowerCase() === 'urbanoutfitters') brandName = 'Urban Outfitters';
          if (brandName.toLowerCase() === 'rossmann') brandName = 'Rossmann';
          if (brandName.toLowerCase() === 'hebe') brandName = 'Hebe';
          if (brandName.toLowerCase() === 'douglas') brandName = 'Douglas';
          if (brandName.toLowerCase() === 'sephora') brandName = 'Sephora';
          if (brandName.toLowerCase() === 'bershka') brandName = 'Bershka';
          if (brandName.toLowerCase() === 'stradivarius') brandName = 'Stradivarius';

          return {
            id: `scraped-${index}`,
            title: deal.name || deal.title || 'Brak nazwy',
            description: deal.description || '',
            currentPrice: currentPrice,
            originalPrice: originalPrice || currentPrice,
            imageUrl: deal.image_url || deal.image || 'https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=500&h=600&fit=crop',
            temperature: Math.floor((deal.confidence_score || 0.5) * 1000), // Fake temperature
            authorName: brandName,
            createdAt: { seconds: Date.now() / 1000 - index * 3600 }, // Fake timestamp
            category: deal.category || 'Inne',
            url: deal.product_url || deal.url // Add URL to navigate to
          };
        });
        setDeals(mappedDeals);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch deals:', err);
        setLoading(false);
      });
  }, []);

  const filteredDeals = deals.filter(deal => 
    deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort deals based on active tab
  const sortedDeals = [...filteredDeals].sort((a, b) => {
    if (activeTab === 'hot') {
      return b.temperature - a.temperature;
    } else if (activeTab === 'commented') {
      // Fake sorting for commented
      return b.title.length - a.title.length;
    } else {
      // Newest
      return b.createdAt.seconds - a.createdAt.seconds;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50 h-16 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Flame className="text-white" size={20} />
              </div>
              <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white">HOTDEALS</span>
            </div>
            
            <div className="hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Szukaj okazji, sklepów, marek..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full border-none focus:ring-2 focus:ring-red-500 w-64 lg:w-96 transition-all outline-none text-sm dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            
            <button className="hidden md:flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full font-medium text-sm transition-colors">
              <Plus size={18} />
              <span>Dodaj Okazję</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        <div className="lg:col-span-3">
          <PromoBanner />

          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-1 bg-white dark:bg-gray-900 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setActiveTab('newest')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'newest' 
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Clock size={16} />
                <span>Nowe</span>
              </button>
              <button
                onClick={() => setActiveTab('hot')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'hot' 
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Flame size={16} />
                <span>Gorące</span>
              </button>
              <button
                onClick={() => setActiveTab('commented')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'commented' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <TrendingUp size={16} />
                <span>Komentowane</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-xl h-96 animate-pulse border border-gray-100 dark:border-gray-800"></div>
              ))}
            </div>
          ) : sortedDeals.length > 0 ? (
            <motion.div 
              layout
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {sortedDeals.map((deal) => (
                  <div key={deal.id} className="block relative">
                    <DealCard deal={deal} />
                  </div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="bg-gray-100 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Nie znaleziono okazji</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Spróbuj zmienić filtry lub wyszukiwaną frazę.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">O nas</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              HOTDEALS to społeczność łowców okazji. Codziennie znajdujemy i udostępniamy najlepsze promocje, kody rabatowe i wyprzedaże z polskiego internetu.
            </p>
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Aktywne okazje</span>
                <span className="font-bold text-gray-900 dark:text-white">{deals.length}</span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default Home;
