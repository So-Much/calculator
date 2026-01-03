'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadGameSessions, saveGameSession, loadGameSession, deleteGameSession } from '@/lib/excel-utils';

interface Player {
  id: number;
  name: string;
  isHouse: boolean;
  betAmount: number;
  result: 'win' | 'lose' | null;
  money: number;
}

interface GameSetup {
  numberOfPlayers: number;
  housePlayerId: number;
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

interface XiDachCalculatorProps {
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

export default function XiDachCalculator({ accountId, onBack }: XiDachCalculatorProps) {
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
  const [numberOfPlayersInput, setNumberOfPlayersInput] = useState<string>('');
  
  // Format input values for display
  const [betAmountDisplays, setBetAmountDisplays] = useState<{ [key: number]: string }>({});

  const loadSessions = useCallback(async () => {
    try {
      const sessions = await loadGameSessions(accountId, 'xi-dach');
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
        'xi-dach',
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
        setPlayers(loadedPlayers);
        const loadedHistory = JSON.parse(session.gameHistory);
        setGameHistory(loadedHistory);
        setCurrentSessionId(session.id);
        setShowSetup(false);
        setIsCalculated(loadedHistory.length > 0);
        
        // Restore display values
        const newBetAmountDisplays: { [key: number]: string } = {};
        loadedPlayers.forEach((p: Player) => {
          newBetAmountDisplays[p.id] = formatNumber(p.betAmount);
        });
        setBetAmountDisplays(newBetAmountDisplays);
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
    const housePlayerId = parseInt(formData.get('housePlayer') as string, 10);

    const newSetup: GameSetup = {
      numberOfPlayers,
      housePlayerId,
    };

    setSetup(newSetup);
    
    // Initialize players
    const newPlayers: Player[] = Array.from({ length: numberOfPlayers }, (_, i) => ({
      id: i + 1,
      name: `Người chơi ${i + 1}`,
      isHouse: i + 1 === housePlayerId,
      betAmount: 0,
      result: null,
      money: 0,
    }));
    
    setPlayers(newPlayers);
    setShowSetup(false);
    setIsCalculated(false);
    setGameHistory([]);
    setCurrentSessionId(null);
    setValidationError(null);
    setBetAmountDisplays({});
  };

  const handleHouseChange = (playerId: number) => {
    setSetup(prev => prev ? { ...prev, housePlayerId: playerId } : null);
    setPlayers(prev => prev.map(p => ({ ...p, isHouse: p.id === playerId })));
  };

  const handleBetAmountChange = (playerId: number, amount: number) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, betAmount: amount } : p
    ));
    setBetAmountDisplays(prev => ({
      ...prev,
      [playerId]: formatNumber(amount),
    }));
  };

  const handleBetAmountInputChange = (playerId: number, value: string) => {
    const parsed = parseFormattedNumber(value);
    handleBetAmountChange(playerId, parsed);
    setBetAmountDisplays(prev => ({
      ...prev,
      [playerId]: value,
    }));
  };

  const handleResultChange = (playerId: number, result: 'win' | 'lose') => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, result } : p
    ));
    setValidationError(null);
  };

  const handlePlayerNameChange = (playerId: number, newName: string) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, name: newName } : p
    ));
  };

  const calculateMoney = () => {
    if (!setup) return;

    const housePlayer = players.find(p => p.isHouse);
    if (!housePlayer) return;

    // Validate: All non-house players must have bet amount and result
    const nonHousePlayers = players.filter(p => !p.isHouse);
    const playersWithoutBet = nonHousePlayers.filter(p => p.betAmount <= 0);
    const playersWithoutResult = nonHousePlayers.filter(p => !p.result);
    
    if (playersWithoutBet.length > 0) {
      setValidationError(`Vui lòng nhập mức cược cho tất cả người chơi. Còn ${playersWithoutBet.length} người chơi chưa có mức cược.`);
      setTimeout(() => setValidationError(null), 5000);
      return;
    }
    
    if (playersWithoutResult.length > 0) {
      setValidationError(`Vui lòng chọn thắng/thua cho tất cả người chơi. Còn ${playersWithoutResult.length} người chơi chưa có kết quả.`);
      setTimeout(() => setValidationError(null), 5000);
      return;
    }

    setValidationError(null);
    const newPlayers = [...players];
    
    // Reset money for calculation
    newPlayers.forEach(player => player.money = 0);

    // Calculate money for each non-house player
    nonHousePlayers.forEach(player => {
      if (player.result === 'win') {
        // Player wins: +betAmount for player, -betAmount for house
        player.money = player.betAmount;
        housePlayer.money -= player.betAmount;
      } else if (player.result === 'lose') {
        // Player loses: -betAmount for player, +betAmount for house
        player.money = -player.betAmount;
        housePlayer.money += player.betAmount;
      }
    });

    // Update house player in newPlayers array
    const houseIndex = newPlayers.findIndex(p => p.isHouse);
    if (houseIndex !== -1) {
      newPlayers[houseIndex] = housePlayer;
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
      const newBetAmountDisplays: { [key: number]: string } = {};
      lastRound.players.forEach(p => {
        newBetAmountDisplays[p.id] = formatNumber(p.betAmount);
      });
      setBetAmountDisplays(newBetAmountDisplays);
    } else {
      setPlayers(prev => prev.map(p => ({ ...p, money: 0, result: null, betAmount: 0 })));
      setBetAmountDisplays({});
    }
    setIsCalculated(false);
    setValidationError(null);
  };

  const handleNewRound = () => {
    setPlayers(prev => prev.map(p => ({ ...p, money: 0, result: null, betAmount: 0 })));
    setIsCalculated(false);
    setBetAmountDisplays({});
    setValidationError(null);
  };

  const resetGame = () => {
    setSetup(null);
    setPlayers([]);
    setShowSetup(true);
    setGameHistory([]);
    setIsCalculated(false);
    setBetAmountDisplays({});
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
                Thiết lập Xì Dách
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
                Thiết lập Xì Dách
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
                    value={numberOfPlayersInput}
                    onChange={(e) => setNumberOfPlayersInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Nhập số người chơi"
                  />
                </div>

                {/* House Player Selection */}
                {parseInt(numberOfPlayersInput) >= 2 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Chọn nhà cái
                    </label>
                    <select
                      name="housePlayer"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 cursor-pointer"
                    >
                      <option value="">Chọn người làm cái</option>
                      {Array.from({ length: parseInt(numberOfPlayersInput) }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Người chơi {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
              Tính tiền Xì Dách
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
          {players.map((player) => (
            <div
              key={player.id}
              className={`rounded-xl bg-white/80 backdrop-blur-sm border-2 ${player.isHouse ? 'border-yellow-400 dark:border-yellow-500' : 'border-slate-200/60 dark:border-slate-700/60'} dark:bg-slate-800/80 p-4`}
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
                  <div className="flex items-center justify-between mb-1">
                    <label 
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                      onClick={() => setEditingPlayerId(player.id)}
                      title="Click để chỉnh sửa tên"
                    >
                      {player.name} ✏️
                    </label>
                    {player.isHouse && (
                      <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">
                        Nhà Cái
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!player.isHouse && (
                <>
                  {/* Bet Amount */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mức cược
                    </label>
                    <input
                      type="text"
                      value={betAmountDisplays[player.id] !== undefined ? betAmountDisplays[player.id] : formatNumber(player.betAmount)}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        handleBetAmountInputChange(player.id, value);
                      }}
                      onBlur={(e) => {
                        const value = parseFormattedNumber(e.target.value);
                        handleBetAmountChange(player.id, value);
                        setBetAmountDisplays(prev => ({
                          ...prev,
                          [player.id]: formatNumber(value),
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nhập mức cược"
                    />
                  </div>

                  {/* Win/Lose Selection */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Kết quả
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleResultChange(player.id, 'win')}
                        className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          player.result === 'win'
                            ? 'bg-green-500 text-white shadow-lg scale-105 ring-2 ring-green-400 cursor-pointer'
                            : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/40 cursor-pointer'
                        }`}
                      >
                        Thắng
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResultChange(player.id, 'lose')}
                        className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          player.result === 'lose'
                            ? 'bg-red-500 text-white shadow-lg scale-105 ring-2 ring-red-400 cursor-pointer'
                            : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/40 cursor-pointer'
                        }`}
                      >
                        Thua
                      </button>
                    </div>
                  </div>
                </>
              )}

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
                          {p.name} {p.isHouse && '(Cái)'}:
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
                const playerTotals: { [key: number]: { name: string; total: number; isHouse: boolean } } = {};
                
                gameHistory.forEach(round => {
                  round.players.forEach(p => {
                    if (playerTotals[p.id]) {
                      playerTotals[p.id].total += p.money;
                      playerTotals[p.id].name = p.name;
                    } else {
                      playerTotals[p.id] = { name: p.name, total: p.money, isHouse: p.isHouse };
                    }
                  });
                });
                
                return Object.entries(playerTotals)
                  .map(([id, data]) => ({ id: parseInt(id, 10), ...data }))
                  .sort((a, b) => a.id - b.id)
                  .map((playerTotal) => (
                    <div key={playerTotal.id} className="flex justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">
                        {playerTotal.name} {playerTotal.isHouse && '(Cái)'}:
                      </span>
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
