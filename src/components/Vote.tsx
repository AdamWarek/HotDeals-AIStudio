import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Flame, Plus, Minus } from 'lucide-react';
import { motion } from 'motion/react';

interface VoteProps {
  dealId: string;
  initialTemperature: number;
}

const Vote: React.FC<VoteProps> = ({ dealId, initialTemperature }) => {
  const { user, signInWithGoogle } = useAuth();
  const [temperature, setTemperature] = useState(initialTemperature);
  const [userVote, setUserVote] = useState<number | null>(null);

  useEffect(() => {
    const dealRef = doc(db, 'deals', dealId);
    const unsubscribe = onSnapshot(dealRef, (doc) => {
      if (doc.exists()) {
        setTemperature(doc.data().temperature);
      }
    });

    if (user) {
      const voteRef = doc(db, 'deals', dealId, 'votes', user.uid);
      getDoc(voteRef).then((doc) => {
        if (doc.exists()) {
          setUserVote(doc.data().value);
        }
      });
    }

    return () => unsubscribe();
  }, [dealId, user]);

  const handleVote = async (value: number) => {
    if (!user) {
      signInWithGoogle();
      return;
    }

    const dealRef = doc(db, 'deals', dealId);
    const voteRef = doc(db, 'deals', dealId, 'votes', user.uid);
    const batch = writeBatch(db);

    try {
      if (userVote === value) {
        // Remove vote
        batch.set(voteRef, { 
          dealId,
          userUid: user.uid,
          value: 0, 
          timestamp: new Date() 
        });
        batch.update(dealRef, { temperature: increment(-value * 10) });
        await batch.commit();
        setUserVote(null);
      } else {
        // Add or change vote
        const diff = userVote === null ? value : value * 2;
        batch.set(voteRef, { 
          dealId, 
          userUid: user.uid, 
          value, 
          timestamp: new Date() 
        });
        batch.update(dealRef, { temperature: increment(diff * 10) });
        await batch.commit();
        setUserVote(value);
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const getTemperatureColor = () => {
    if (temperature < 0) return 'text-blue-500';
    if (temperature < 100) return 'text-orange-500';
    if (temperature < 500) return 'text-red-500';
    return 'text-red-600 font-bold animate-pulse';
  };

  return (
    <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-full p-1 shadow-sm">
      <button
        onClick={() => handleVote(-1)}
        className={`p-1 rounded-full transition-colors ${
          userVote === -1 ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
      >
        <Minus size={18} />
      </button>
      
      <div className={`flex items-center font-bold px-2 ${getTemperatureColor()}`}>
        {temperature >= 100 && <Flame size={18} className="mr-1 fill-current" />}
        <span>{temperature}°</span>
      </div>

      <button
        onClick={() => handleVote(1)}
        className={`p-1 rounded-full transition-colors ${
          userVote === 1 ? 'bg-red-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
      >
        <Plus size={18} />
      </button>
    </div>
  );
};

export default Vote;
