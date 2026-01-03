'use client';

import { useState } from 'react';
import TienLenCalculator from './games/TienLenCalculator';
import XiDachCalculator from './games/XiDachCalculator';
import KachTeCalculator from './games/KachTeCalculator';

interface GameMenuProps {
  accountId: number;
  onLogout: () => void;
}

interface GameButton {
  id: string;
  name: string;
  color: string;
  gradient: string;
  icon: string;
  component?: React.ComponentType;
}

const games: GameButton[] = [
  {
    id: 'tien-len',
    name: 'Tiến Lên',
    color: 'from-blue-500 to-blue-600',
    gradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
    icon: '🃏',
    component: TienLenCalculator,
  },
  {
    id: 'xi-dach',
    name: 'Xì Dách',
    color: 'from-green-500 to-green-600',
    gradient: 'bg-gradient-to-br from-green-500 to-green-600',
    icon: '♠️',
  },
  {
    id: 'kach-te',
    name: 'Kách Tê',
    color: 'from-purple-500 to-purple-600',
    gradient: 'bg-gradient-to-br from-purple-500 to-purple-600',
    icon: '🎴',
  },
];

export default function GameMenu({ accountId, onLogout }: GameMenuProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const handleGameClick = (gameId: string) => {
    setSelectedGame(gameId);
  };

  const handleBack = () => {
    setSelectedGame(null);
  };

      // Show game calculator if selected
      if (selectedGame === 'tien-len') {
        return <TienLenCalculator accountId={accountId} onBack={handleBack} />;
      }
      
      if (selectedGame === 'xi-dach') {
        return <XiDachCalculator accountId={accountId} onBack={handleBack} />;
      }
      
      if (selectedGame === 'kach-te') {
        return <KachTeCalculator accountId={accountId} onBack={handleBack} />;
      }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/80">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              Trò Chơi
            </h1>
            <button
              onClick={onLogout}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-50 cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Game Grid */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => handleGameClick(game.id)}
                className="group flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] dark:bg-slate-800/80 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {/* Icon Container - Larger, more app-like */}
                <div
                  className={`mb-4 flex h-24 w-24 items-center justify-center rounded-3xl ${game.gradient} text-5xl shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-2xl`}
                >
                  {game.icon}
                </div>

                {/* Game Name */}
                <span className="text-center text-sm font-semibold text-slate-900 dark:text-slate-50 sm:text-base">
                  {game.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

