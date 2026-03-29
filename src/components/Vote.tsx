import React, { useState } from 'react';
import { Flame, Plus, Minus } from 'lucide-react';
import { motion } from 'motion/react';

/** Matches previous Firestore increment scale (±10 per vote unit). */
const TEMPERATURE_STEP = 10;

interface VoteProps {
  dealId: string;
  initialTemperature: number;
}

const Vote: React.FC<VoteProps> = ({ dealId, initialTemperature }) => {
  const [temperature, setTemperature] = useState(initialTemperature);
  const [userVote, setUserVote] = useState<number | null>(null);

  const handleVote = (value: number) => {
    // TODO: Supabase — upsert vote for dealId + auth user, RPC or transaction for aggregate temperature
    if (import.meta.env.DEV) {
      console.debug('[vote] placeholder', { dealId, value });
    }
    if (userVote === value) {
      setUserVote(null);
      setTemperature((t) => t - value * TEMPERATURE_STEP);
      return;
    }
    const diff = userVote === null ? value : value * 2;
    setUserVote(value);
    setTemperature((t) => t + diff * TEMPERATURE_STEP);
  };

  const getTemperatureColor = () => {
    if (temperature < 0) return 'text-blue-500';
    if (temperature < 100) return 'text-orange-500';
    if (temperature < 500) return 'text-red-500';
    return 'text-red-600 font-bold animate-pulse';
  };

  return (
    <motion.div
      layout
      title="Local preview only — wire Supabase to sync votes"
      className="flex flex-col items-center gap-0.5"
    >
      <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-full p-1 shadow-sm">
        <button
          type="button"
          onClick={() => handleVote(-1)}
          className={`p-1 rounded-full transition-colors ${
            userVote === -1
              ? 'bg-blue-500 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          <Minus size={18} />
        </button>

        <div className={`flex items-center font-bold px-2 ${getTemperatureColor()}`}>
          {temperature >= 100 && <Flame size={18} className="mr-1 fill-current" />}
          <span>{temperature}°</span>
        </div>

        <button
          type="button"
          onClick={() => handleVote(1)}
          className={`p-1 rounded-full transition-colors ${
            userVote === 1
              ? 'bg-red-500 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          <Plus size={18} />
        </button>
      </div>
      <span className="text-[9px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 opacity-90 max-w-[140px] text-center leading-tight pointer-events-none">
        Offline preview
      </span>
    </motion.div>
  );
};

export default Vote;
