'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadGameSessions, saveGameSession, loadGameSession, deleteGameSession } from '@/lib/excel-utils';

interface Player {
  id: number;
  name: string;
  isWinner: boolean;
  winType: 'normal' | 'sap-lang' | null;
  money: number;
}

interface GameSetup {
  numberOfPlayers: number;
  defaultBetAmount: number;
  sapLangBetAmount: number;
}

interface GameRound {
  id: number;
  players: Player[];
  setup: GameSetup;
  timestamp: string;
}

interface GameSession {
  id: number;
  accountId: number;
  gameType: string;
  sessionName: string;
  setup: string;
  players: string;
  gameHistory: string;
  lastUpdated: string;
}

interface KachTeCalculatorProps {
  accountId: number;
  onBack?: () => void;
}

// Format number to VND format (1.000.000 đ)
const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
};

// Format number for display (1.000.000)
const formatNumber = (value: number | string): string => {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '')) : value;
  if (isNaN(numValue)) return '';
  return new Intl.NumberFormat('vi-VN').format(numValue);
};

// Parse formatted number to number
const parseFormattedNumber = (value: string): number => {
  return parseFloat(value.replace(/\./g, '')) || 0;
};

export default function KachTeCalculator({ accountId, onBack }: KachTeCalculatorProps) {
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showSetup, setShowSetup] = useState(true);
  const [gameHistory, setGameHistory] = useState<GameRound[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [savedSessions, setSavedSessions] = useState<Array<{ id: number; sessionName: string; lastUpdated: string }>>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Format input values for display
  const [defaultBetDisplay, setDefaultBetDisplay] = useState('');
  const [sapLangBetDisplay, setSapLangBetDisplay] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      const sessions = await loadGameSessions(accountId, 'kach-te');
      setSavedSessions(sessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, [accountId]);

  const saveSession = useCallback(async (sessionName?: string) => {
    if (!setup || players.length === 0) return;

    try {
      const name = sessionName || `Game ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      
      const session = await saveGameSession(
        accountId,
        'kach-te',
        name,
        setup,
        players,
        gameHistory,
        currentSessionId || undefined
      );
      
      setCurrentSessionId(session.id);
      await loadSessions();
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [accountId, setup, players, gameHistory, currentSessionId, loadSessions]);

  const loadSession = useCallback(async (sessionId: number) => {
    try {
      const session = await loadGameSession(sessionId);
      if (session) {
        setSetup(JSON.parse(session.setup));
        const loadedPlayers = JSON.parse(session.players);
        setPlayers(Array.isArray(loadedPlayers) ? loadedPlayers : []);
        const loadedHistory = JSON.parse(session.gameHistory);
        setGameHistory(loadedHistory);
        setCurrentSessionId(session.id);
        setShowSetup(false);
        setIsCalculated(loadedHistory.length > 0);
        
        // Restore display values
        const loadedSetup = JSON.parse(session.setup);
        setDefaultBetDisplay(formatNumber(loadedSetup.defaultBetAmount));
        setSapLangBetDisplay(formatNumber(loadedSetup.sapLangBetAmount));
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }, [accountId]);

  const deleteSession = useCallback(async (sessionId: number) => {
    try {
      await deleteGameSession(sessionId);
      await loadSessions();
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        resetGame();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }, [accountId, currentSessionId, loadSessions]);

  // Load saved sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Auto-save when game state changes (debounced)
  useEffect(() => {
    if (!setup || players.length === 0) return;
    
    const timer = setTimeout(() => {
      saveSession();
    }, 2000);

    return () => clearTimeout(timer);
  }, [setup, players, gameHistory, currentSessionId, saveSession]);

  const handleSetupSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const numberOfPlayers = parseInt(formData.get('numberOfPlayers') as string, 10);
    const defaultBetAmount = parseFormattedNumber(formData.get('defaultBetAmount') as string);
    const sapLangBetAmount = parseFormattedNumber(formData.get('sapLangBetAmount') as string);

    const newSetup: GameSetup = {
      numberOfPlayers,
      defaultBetAmount,
      sapLangBetAmount,
    };

    setSetup(newSetup);
    
    // Initialize players
    const newPlayers: Player[] = Array.from({ length: numberOfPlayers }, (_, i) => ({
      id: i + 1,
      name: `Người chơi ${i + 1}`,
      isWinner: false,
      winType: null,
      money: 0,
    }));
    
    setPlayers(newPlayers);
    setShowSetup(false);
    setIsCalculated(false);
    setGameHistory([]);
    setCurrentSessionId(null);
    setValidationError(null);
  };

  const handleWinnerChange = (playerId: number, winType: 'normal' | 'sap-lang' | null) => {
    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        return { ...p, isWinner: winType !== null, winType };
      } else {
        // Only one winner allowed
        return { ...p, isWinner: false, winType: null };
      }
    }));
    setValidationError(null);
  };

  const handlePlayerNameChange = (playerId: number, newName: string) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, name: newName } : p
    ));
  };

  const calculateMoney = () => {
    if (!setup) return;

    const winner = players.find(p => p.isWinner && p.winType);
    if (!winner) {
      setValidationError('Vui lòng chọn người thắng (thắng bình thường hoặc thắng sập làng).');
      setTimeout(() => setValidationError(null), 5000);
      return;
    }

    setValidationError(null);
    const newPlayers = [...players];
    
    // Reset money for calculation
    newPlayers.forEach(player => player.money = 0);

    const numberOfLosers = setup.numberOfPlayers - 1;
    const betAmount = winner.winType === 'sap-lang' ? setup.sapLangBetAmount : setup.defaultBetAmount;

    // Winner gets all
    winner.money = numberOfLosers * betAmount;

    // All other players lose
    newPlayers.forEach(player => {
      if (!player.isWinner) {
        player.money = -betAmount;
      }
    });

    // Update winner in newPlayers array
    const winnerIndex = newPlayers.findIndex(p => p.id === winner.id);
    if (winnerIndex !== -1) {
      newPlayers[winnerIndex] = winner;
    }

    // If recalculating, update the last round in history instead of adding new one
    if (isCalculated && gameHistory.length > 0) {
      const updatedRound: GameRound = {
        ...gameHistory[gameHistory.length - 1],
        players: newPlayers.map(p => ({ ...p })),
        timestamp: new Date().toISOString(),
      };
      setGameHistory(prev => [...prev.slice(0, -1), updatedRound]);
    } else {
      // Save to history as new round
      const newRound: GameRound = {
        id: gameHistory.length + 1,
        players: newPlayers.map(p => ({ ...p })),
        setup: { ...setup },
        timestamp: new Date().toISOString(),
      };
      setGameHistory(prev => [...prev, newRound]);
    }

    setPlayers(newPlayers);
    setIsCalculated(true);
  };

  const handleUndo = () => {
    if (gameHistory.length === 0) return;
    
    const previousHistory = gameHistory.slice(0, -1);
    setGameHistory(previousHistory);
    
    if (previousHistory.length > 0) {
      const lastRound = previousHistory[previousHistory.length - 1];
      setPlayers(lastRound.players.map(p => ({ ...p })));
      setSetup(lastRound.setup);
      setDefaultBetDisplay(formatNumber(lastRound.setup.defaultBetAmount));
      setSapLangBetDisplay(formatNumber(lastRound.setup.sapLangBetAmount));
    } else {
      setPlayers(prev => prev.map(p => ({ ...p, money: 0, isWinner: false, winType: null })));
      setDefaultBetDisplay('');
      setSapLangBetDisplay('');
    }
    setIsCalculated(false);
    setValidationError(null);
  };

  const handleNewRound = () => {
    setPlayers(prev => prev.map(p => ({ ...p, money: 0, isWinner: false, winType: null })));
    setIsCalculated(false);
    setValidationError(null);
  };

  const resetGame = () => {
    setSetup(null);
    setPlayers([]);
    setShowSetup(true);
    setGameHistory([]);
    setIsCalculated(false);
    setDefaultBetDisplay('');
    setSapLangBetDisplay('');
    setCurrentSessionId(null);
    setValidationError(null);
  };

  const handleBackToMenu = () => {
    if (onBack) {
      onBack();
    } else {
      resetGame();
    }
  };

  if (showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/80">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBackToMenu}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-50 cursor-pointer"
              >
                ← Quay lại
              </button>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                Thiết lập Kách Tê
              </h1>
              <div className="w-24"></div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl">
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-xl border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700/60 p-6 sm:p-8">
              <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-50">
                Thiết lập Kách Tê
              </h2>

              <form onSubmit={handleSetupSubmit} className="space-y-6">
                {/* Number of Players */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Số người chơi
                  </label>
                  <input
                    type="number"
                    name="numberOfPlayers"
                    min="2"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Nhập số người chơi"
                  />
                </div>

                {/* Default Bet Amount */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Tiền cược mặc định
                  </label>
                  <input
                    type="text"
                    name="defaultBetAmount"
                    value={defaultBetDisplay}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setDefaultBetDisplay(formatNumber(value));
                    }}
                    onBlur={(e) => {
                      const value = parseFormattedNumber(e.target.value);
                      setDefaultBetDisplay(formatNumber(value));
                    }}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Nhập tiền cược mặc định"
                  />
                </div>

                {/* Sập Làng Bet Amount */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Tiền cược khi bắt sập làng
                  </label>
                  <input
                    type="text"
                    name="sapLangBetAmount"
                    value={sapLangBetDisplay}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setSapLangBetDisplay(formatNumber(value));
                    }}
                    onBlur={(e) => {
                      const value = parseFormattedNumber(e.target.value);
                      setSapLangBetDisplay(formatNumber(value));
                    }}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Nhập tiền cược sập làng"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSessionList(true)}
                    className="flex-1 py-3 px-4 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                  >
                    Xem game đã lưu
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Game mới
                  </button>
                </div>
              </form>

              {/* Session List Modal */}
              {showSessionList && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="w-full max-w-2xl mx-4 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                        Game đã lưu
                      </h3>
                      <button
                        onClick={() => setShowSessionList(false)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 cursor-pointer"
                        aria-label="Đóng danh sách game đã lưu"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {savedSessions.length === 0 ? (
                      <p className="text-slate-600 dark:text-slate-400 text-center py-8">
                        Chưa có game nào được lưu
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {savedSessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200 shadow-sm hover:shadow-md cursor-pointer"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-slate-900 dark:text-slate-50">
                                {session.sessionName}
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {new Date(session.lastUpdated).toLocaleString('vi-VN')}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  loadSession(session.id);
                                  setShowSessionList(false);
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer shadow-sm hover:shadow"
                              >
                                Mở
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Bạn có chắc muốn xóa game này?')) {
                                    deleteSession(session.id);
                                  }
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer shadow-sm hover:shadow"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/80">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToMenu}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-50 cursor-pointer"
            >
              ← Quay lại
            </button>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              Tính tiền Kách Tê
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => saveSession()}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-50 cursor-pointer"
                title="Lưu game hiện tại"
              >
                💾 Lưu game
              </button>
              <button
                onClick={resetGame}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-50 cursor-pointer"
              >
                Thiết lập lại
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Players Grid */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players && players.length > 0 && players.map((player) => (
            <div
              key={player.id}
              className={`rounded-xl bg-white/80 backdrop-blur-sm border-2 ${player.isWinner ? 'border-purple-400 dark:border-purple-500' : 'border-slate-200/60 dark:border-slate-700/60'} dark:bg-slate-800/80 p-4`}
            >
              <div className="mb-3">
                {editingPlayerId === player.id ? (
                  <div className="flex gap-2 mb-1">
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                      onBlur={() => setEditingPlayerId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingPlayerId(null);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => setEditingPlayerId(null)}
                      className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors duration-200 cursor-pointer text-sm"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <label 
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                    onClick={() => setEditingPlayerId(player.id)}
                    title="Click để chỉnh sửa tên"
                  >
                    {player.name} ✏️
                  </label>
                )}
                {player.isWinner && (
                  <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded">
                    {player.winType === 'sap-lang' ? 'Thắng Sập Làng' : 'Thắng'}
                  </span>
                )}
              </div>

              {/* Winner Selection */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Chọn người thắng
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleWinnerChange(player.id, player.winType === 'normal' ? null : 'normal')}
                    className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      player.winType === 'normal'
                        ? 'bg-blue-500 text-white shadow-lg scale-105 ring-2 ring-blue-400 cursor-pointer'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/40 cursor-pointer'
                    }`}
                  >
                    Thắng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWinnerChange(player.id, player.winType === 'sap-lang' ? null : 'sap-lang')}
                    className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                      player.winType === 'sap-lang'
                        ? 'bg-purple-500 text-white shadow-lg scale-105 ring-2 ring-purple-400 cursor-pointer'
                        : 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/40 cursor-pointer'
                    }`}
                  >
                    Sập Làng
                  </button>
                </div>
              </div>

              {/* Money Display */}
              <div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 p-3">
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Kết quả</div>
                <div className={`text-lg font-bold ${player.money >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {player.money >= 0 ? '+' : ''}{formatVND(player.money)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {validationError}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 flex-wrap">
          <button
            onClick={calculateMoney}
            className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white hover:bg-blue-700 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isCalculated ? 'Tính lại' : 'Tính tiền'}
          </button>
          {isCalculated && (
            <>
              <button
                onClick={handleNewRound}
                className="rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Bàn mới
              </button>
              {gameHistory.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="rounded-lg bg-orange-600 px-6 py-3 text-lg font-semibold text-white hover:bg-orange-700 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  Hoàn tác
                </button>
              )}
            </>
          )}
        </div>

        {/* Game History */}
        {gameHistory.length > 0 && (
          <div className="mt-6 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700/60 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Lịch sử các bàn ({gameHistory.length} bàn)
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {gameHistory.map((round) => (
                <div key={round.id} className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Bàn {round.id} - {new Date(round.timestamp).toLocaleTimeString('vi-VN')}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {round.players.map((p) => (
                      <div key={p.id} className="flex justify-between">
                        <span className="text-slate-700 dark:text-slate-300">
                          {p.name} {p.isWinner && `(${p.winType === 'sap-lang' ? 'Sập Làng' : 'Thắng'})`}:
                        </span>
                        <span className={`font-medium ${p.money >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {p.money >= 0 ? '+' : ''}{formatVND(p.money)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {gameHistory.length > 0 && (
          <div className="mt-6 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700/60 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Tổng kết tất cả các bàn
            </h3>
            <div className="space-y-2">
              {(() => {
                const playerTotals: { [key: number]: { name: string; total: number } } = {};
                
                gameHistory.forEach(round => {
                  round.players.forEach(p => {
                    if (playerTotals[p.id]) {
                      playerTotals[p.id].total += p.money;
                      playerTotals[p.id].name = p.name;
                    } else {
                      playerTotals[p.id] = { name: p.name, total: p.money };
                    }
                  });
                });
                
                return Object.entries(playerTotals)
                  .map(([id, data]) => ({ id: parseInt(id, 10), ...data }))
                  .sort((a, b) => a.id - b.id)
                  .map((playerTotal) => (
                    <div key={playerTotal.id} className="flex justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">{playerTotal.name}:</span>
                      <span className={`font-medium ${playerTotal.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {playerTotal.total >= 0 ? '+' : ''}{formatVND(playerTotal.total)}
                      </span>
                    </div>
                  ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
