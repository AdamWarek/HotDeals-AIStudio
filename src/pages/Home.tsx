import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import DealCard from '../components/DealCard';
import ThemeToggle from '../components/ThemeToggle';
import { Plus, Search, LogIn, LogOut, User as UserIcon, Flame, TrendingUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Home: React.FC = () => {
  const { user, signInWithGoogle, logout, isAdmin } = useAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('newest');

  useEffect(() => {
    const dealsRef = collection(db, 'deals');
    const q = query(dealsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dealsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDeals(dealsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const seedData = async () => {
    if (!user) return;
    
    const dealsRef = collection(db, 'deals');
    const existingDeals = await getDocs(query(dealsRef, limit(1)));
    
    if (!existingDeals.empty) {
      alert('Seed data already exists!');
      return;
    }

    const sampleDeals = [
      {
        title: 'MacBook Air M2 13" 8/256GB Space Gray',
        description: 'Najnowszy MacBook Air z procesorem M2 w świetnej cenie!',
        currentPrice: 4299,
        originalPrice: 5499,
        imageUrl: 'https://images.unsplash.com/photo-1611186871348-b1ec696e5237?q=80&w=1000&auto=format&fit=crop',
        temperature: 120,
        authorUid: user.uid,
        authorName: user.displayName || 'User',
        createdAt: serverTimestamp(),
        category: 'Elektronika'
      },
      {
        title: 'Sony WH-1000XM5 Noise Cancelling Headphones',
        description: 'Najlepsze słuchawki z redukcją szumów na rynku.',
        currentPrice: 1199,
        originalPrice: 1599,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop',
        temperature: 550,
        authorUid: user.uid,
        authorName: user.displayName || 'User',
        createdAt: serverTimestamp(),
        category: 'Audio'
      },
      {
        title: 'Nike Air Max 270 React - Black/White',
        description: 'Klasyczne buty sportowe Nike w promocyjnej cenie.',
        currentPrice: 349,
        originalPrice: 599,
        imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop',
        temperature: 85,
        authorUid: user.uid,
        authorName: user.displayName || 'User',
        createdAt: serverTimestamp(),
        category: 'Moda'
      },
      {
        title: 'LEGO Star Wars Millennium Falcon 75192',
        description: 'Największy zestaw LEGO Star Wars w historii!',
        currentPrice: 2899,
        originalPrice: 3499,
        imageUrl: 'https://images.unsplash.com/photo-1585366119957-e556f403e44c?q=80&w=1000&auto=format&fit=crop',
        temperature: -20,
        authorUid: user.uid,
        authorName: user.displayName || 'User',
        createdAt: serverTimestamp(),
        category: 'Zabawki'
      },
      {
        title: 'PlayStation 5 Slim Console + 2 Controllers',
        description: 'Zestaw PS5 Slim z dwoma padami DualSense.',
        currentPrice: 2199,
        originalPrice: 2499,
        imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?q=80&w=1000&auto=format&fit=crop',
        temperature: 320,
        authorUid: user.uid,
        authorName: user.displayName || 'User',
        createdAt: serverTimestamp(),
        category: 'Gaming'
      }
    ];

    for (const deal of sampleDeals) {
      await addDoc(dealsRef, deal);
    }
    alert('Seed data added successfully!');
  };

  const filteredDeals = deals.filter(deal => 
    deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deal.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-50 h-16 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-black text-red-600 tracking-tighter cursor-pointer">
              HOTDEALS
            </h1>
            
            <div className="hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full border-none focus:ring-2 focus:ring-red-500 w-64 lg:w-96 transition-all outline-none text-sm dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {user ? (
              <>
                <button 
                  onClick={seedData}
                  className="hidden lg:flex items-center text-xs font-bold text-gray-500 hover:text-red-600 transition-colors"
                >
                  Seed Data
                </button>
                <button className="bg-red-600 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center hover:bg-red-700 transition-colors shadow-sm">
                  <Plus size={18} className="mr-1" />
                  Post Deal
                </button>
                <div className="flex items-center space-x-3 pl-4 border-l border-gray-100 dark:border-gray-800">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{user.displayName}</span>
                    <button onClick={logout} className="text-[10px] text-gray-400 hover:text-red-500">Sign Out</button>
                  </div>
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700" />
                </div>
              </>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center space-x-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm"
              >
                <LogIn size={18} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 max-w-7xl mx-auto px-4">
        {/* Hero Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">Najlepsze Promocje</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Odkryj najgorętsze okazje udostępnione przez naszą społeczność.</p>
          </div>
          
          <div className="flex bg-white dark:bg-gray-900 p-1 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
            <button 
              onClick={() => setActiveTab('newest')}
              className={`flex items-center px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'newest' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <Clock size={16} className="mr-2" />
              Newest
            </button>
            <button 
              onClick={() => setActiveTab('hot')}
              className={`flex items-center px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'hot' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <Flame size={16} className="mr-2" />
              Hot
            </button>
            <button 
              onClick={() => setActiveTab('trending')}
              className={`flex items-center px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'trending' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <TrendingUp size={16} className="mr-2" />
              Trending
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl h-96 animate-pulse border border-gray-100 dark:border-gray-800"></div>
            ))}
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && filteredDeals.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-gray-100 dark:bg-gray-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">No deals found</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Try adjusting your search or filters.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
