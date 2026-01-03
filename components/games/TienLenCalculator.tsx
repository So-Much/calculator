'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadGameSessions, saveGameSession, loadGameSession, deleteGameSession } from '@/lib/excel-utils';

interface Player {
  id: number;
  name: string;
  position: 'nhat' | 'nhi' | 'ba' | 'bet' | null;
  money: number;
  adjustments: number; // For special cases (tứ quý, ba đôi thông, etc.)
}

interface GameSetup {
  numberOfPlayers: number;
  betAmount: number;
  rule: 'nhat-an-het' | 'nhat-an-bet-nhi-an-ba';
  betLevel1?: number; // For "nhat-an-bet-nhi-an-ba" rule
  betLevel2?: number; // For "nhat-an-bet-nhi-an-ba" rule
}

interface GameRound {
  id: number;
  players: Player[];
  setup: GameSetup;
  timestamp: string;
}

interface TienLenCalculatorProps {
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

export default function TienLenCalculator({ accountId, onBack }: TienLenCalculatorProps) {
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showSetup, setShowSetup] = useState(true);
  const [selectedRule, setSelectedRule] = useState<'nhat-an-het' | 'nhat-an-bet-nhi-an-ba'>('nhat-an-het');
  const [gameHistory, setGameHistory] = useState<GameRound[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [savedSessions, setSavedSessions] = useState<Array<{ id: number; sessionName: string; lastUpdated: string }>>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<number | null>(null);
  const [editingRoundPlayers, setEditingRoundPlayers] = useState<Player[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  
  // Format input values for display
  const [betAmountDisplay, setBetAmountDisplay] = useState('');
  const [betLevel1Display, setBetLevel1Display] = useState('');
  const [betLevel2Display, setBetLevel2Display] = useState('');
  const [adjustmentDisplays, setAdjustmentDisplays] = useState<{ [key: number]: string }>({});

  const loadSessions = useCallback(async () => {
    try {
      const sessions = await loadGameSessions(accountId, 'tien-len');
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
        'tien-len',
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

  // Load saved sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Auto-save when game state changes (debounced)
  useEffect(() => {
    if (!setup || players.length === 0) return;
    
    const timer = setTimeout(() => {
      saveSession();
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [setup, players, gameHistory, currentSessionId, saveSession]);

  const loadSession = async (sessionId: number) => {
    try {
      const response = await fetch(
        `/api/excel/game-sessions?accountId=${accountId}&sessionId=${sessionId}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          const session = data.session;
          setSetup(JSON.parse(session.setup));
          setPlayers(JSON.parse(session.players));
          setGameHistory(JSON.parse(session.gameHistory));
          setCurrentSessionId(session.id);
          setShowSetup(false);
          setIsCalculated(gameHistory.length > 0);
          
          // Restore display values
          const loadedSetup = JSON.parse(session.setup);
          setSelectedRule(loadedSetup.rule);
          if (loadedSetup.rule === 'nhat-an-het') {
            setBetAmountDisplay(formatNumber(loadedSetup.betAmount));
          } else {
            setBetLevel1Display(formatNumber(loadedSetup.betLevel1 || 0));
            setBetLevel2Display(formatNumber(loadedSetup.betLevel2 || 0));
          }
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const deleteSession = async (sessionId: number) => {
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
  };

  const handleSetupSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const numberOfPlayers = parseInt(formData.get('numberOfPlayers') as string, 10);
    const rule = formData.get('rule') as 'nhat-an-het' | 'nhat-an-bet-nhi-an-ba';
    
    let betLevel1: number | undefined;
    let betLevel2: number | undefined;
    
    if (rule === 'nhat-an-bet-nhi-an-ba') {
      betLevel1 = parseFormattedNumber(formData.get('betLevel1') as string);
      betLevel2 = parseFormattedNumber(formData.get('betLevel2') as string);
    }
    
    const betAmount = rule === 'nhat-an-het' 
      ? parseFormattedNumber(formData.get('betAmount') as string)
      : 0;

    const newSetup: GameSetup = {
      numberOfPlayers,
      betAmount,
      rule,
      betLevel1,
      betLevel2,
    };

    setSetup(newSetup);
    
    // Initialize players
    const newPlayers: Player[] = Array.from({ length: numberOfPlayers }, (_, i) => ({
      id: i + 1,
      name: `Người chơi ${i + 1}`,
      position: null,
      money: 0,
      adjustments: 0,
    }));
    
    setPlayers(newPlayers);
    setShowSetup(false);
  };

  const handlePositionChange = (playerId: number, position: Player['position']) => {
    setPlayers(prev => {
      // If clicking the same position, unselect it
      const currentPlayer = prev.find(p => p.id === playerId);
      if (currentPlayer?.position === position) {
        return prev.map(p => 
          p.id === playerId ? { ...p, position: null } : p
        );
      }
      
      // If selecting a position, remove it from other players first
      return prev.map(p => {
        if (p.id === playerId) {
          return { ...p, position };
        }
        // Remove this position from other players if they have it
        if (p.position === position) {
          return { ...p, position: null };
        }
        return p;
      });
    });
  };

  const handleAdjustmentChange = (playerId: number, adjustment: number) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, adjustments: adjustment } : p
    ));
    setAdjustmentDisplays(prev => ({
      ...prev,
      [playerId]: adjustment.toString(),
    }));
  };

  const handleAdjustmentInputChange = (playerId: number, value: string) => {
    // Allow negative numbers and parse
    const parsed = parseFloat(value) || 0;
    handleAdjustmentChange(playerId, parsed);
    setAdjustmentDisplays(prev => ({
      ...prev,
      [playerId]: value,
    }));
  };

  const handlePlayerNameChange = (playerId: number, newName: string) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, name: newName } : p
    ));
  };

  const calculateMoney = () => {
    if (!setup) return;

    // Validate: All players must have a position
    const playersWithoutPosition = players.filter(p => !p.position);
    if (playersWithoutPosition.length > 0) {
      setValidationError(`Vui lòng chọn hạng cho tất cả người chơi. Còn ${playersWithoutPosition.length} người chơi chưa có hạng.`);
      // Auto-hide error after 5 seconds
      setTimeout(() => setValidationError(null), 5000);
      return;
    }

    setValidationError(null);
    const newPlayers = [...players];
    
    if (setup.rule === 'nhat-an-het') {
      // Nhất ăn hết: Mỗi player trừ bằng số tiền cược
      const totalDeducted = setup.betAmount * (setup.numberOfPlayers - 1);
      
      newPlayers.forEach(player => {
        if (player.position === 'nhat') {
          player.money = totalDeducted;
        } else {
          player.money = -setup.betAmount;
        }
      });
    } else if (setup.rule === 'nhat-an-bet-nhi-an-ba' && setup.betLevel1 && setup.betLevel2) {
      // Nhất ăn bét, Nhì ăn Ba
      const betPlayer = newPlayers.find(p => p.position === 'bet');
      const baPlayer = newPlayers.find(p => p.position === 'ba');
      const nhiPlayer = newPlayers.find(p => p.position === 'nhi');
      const nhatPlayer = newPlayers.find(p => p.position === 'nhat');

      // Trừ tiền người bét với mức cho người bét
      if (betPlayer) {
        betPlayer.money = -setup.betLevel1;
      }

      // Trừ tiền người ba với mức cho còn lại
      if (baPlayer) {
        baPlayer.money = -setup.betLevel2;
      }

      // Cộng tiền cho người nhất và nhì
      if (nhatPlayer) {
        nhatPlayer.money = setup.betLevel1;
      }
      if (nhiPlayer) {
        nhiPlayer.money = setup.betLevel2;
      }
    }

    // Apply adjustments
    newPlayers.forEach(player => {
      player.money += player.adjustments;
    });

    // If recalculating, update the last round in history instead of adding new one
    if (isCalculated && gameHistory.length > 0) {
      const updatedRound: GameRound = {
        ...gameHistory[gameHistory.length - 1],
        players: newPlayers.map(p => ({ ...p })), // Deep copy
        timestamp: new Date().toISOString(),
      };
      setGameHistory(prev => [...prev.slice(0, -1), updatedRound]);
    } else {
      // Save to history as new round
      const newRound: GameRound = {
        id: gameHistory.length + 1,
        players: newPlayers.map(p => ({ ...p })), // Deep copy
        setup: { ...setup },
        timestamp: new Date().toISOString(),
      };
      setGameHistory(prev => [...prev, newRound]);
    }

    setPlayers(newPlayers);
    setIsCalculated(true);
  };

  const handleEditRound = (roundId: number) => {
    const round = gameHistory.find(r => r.id === roundId);
    if (!round) return;
    
    // Deep copy players for editing
    setEditingRoundPlayers(round.players.map(p => ({ ...p })));
    setEditingRoundId(roundId);
  };

  const handleSaveRoundEdit = () => {
    if (editingRoundId === null || !setup) return;
    
    const round = gameHistory.find(r => r.id === editingRoundId);
    if (!round) return;

    // Validate: All players must have a position
    const playersWithoutPosition = editingRoundPlayers.filter(p => !p.position);
    if (playersWithoutPosition.length > 0) {
      setEditModalError(`Vui lòng chọn hạng cho tất cả người chơi. Còn ${playersWithoutPosition.length} người chơi chưa có hạng.`);
      return;
    }

    // Recalculate money for edited players based on the round's setup
    const newPlayers = editingRoundPlayers.map(p => ({ ...p, money: 0 }));

    if (round.setup.rule === 'nhat-an-het') {
      const totalDeducted = round.setup.betAmount * (round.setup.numberOfPlayers - 1);
      
      newPlayers.forEach(player => {
        if (player.position === 'nhat') {
          player.money = totalDeducted;
        } else {
          player.money = -round.setup.betAmount;
        }
      });
    } else if (round.setup.rule === 'nhat-an-bet-nhi-an-ba' && round.setup.betLevel1 && round.setup.betLevel2) {
      const betPlayer = newPlayers.find(p => p.position === 'bet');
      const baPlayer = newPlayers.find(p => p.position === 'ba');
      const nhiPlayer = newPlayers.find(p => p.position === 'nhi');
      const nhatPlayer = newPlayers.find(p => p.position === 'nhat');

      if (betPlayer) betPlayer.money = -round.setup.betLevel1;
      if (baPlayer) baPlayer.money = -round.setup.betLevel2;
      if (nhatPlayer) nhatPlayer.money = round.setup.betLevel1;
      if (nhiPlayer) nhiPlayer.money = round.setup.betLevel2;
    }

    // Apply adjustments
    newPlayers.forEach(player => {
      player.money += player.adjustments;
    });

    // Update the round in history
    setGameHistory(prev => prev.map(r => 
      r.id === editingRoundId 
        ? { ...r, players: newPlayers, timestamp: new Date().toISOString() }
        : r
    ));

    setEditingRoundId(null);
    setEditingRoundPlayers([]);
    setEditModalError(null);
  };

  const handleDeleteRound = (roundId: number) => {
    if (!confirm('Bạn có chắc muốn xóa bàn này?')) return;
    
    setGameHistory(prev => prev.filter(r => r.id !== roundId));
  };

  const handleUndo = () => {
    if (gameHistory.length === 0) return;
    
    const previousHistory = gameHistory.slice(0, -1);
    setGameHistory(previousHistory);
    
    if (previousHistory.length > 0) {
      const lastRound = previousHistory[previousHistory.length - 1];
      setPlayers(lastRound.players.map(p => ({ ...p })));
      setSetup(lastRound.setup);
    } else {
      // Reset to initial state
      setPlayers(prev => prev.map(p => ({ ...p, money: 0, position: null, adjustments: 0 })));
    }
    setIsCalculated(false);
  };

  const handleNewRound = () => {
    // Reset positions and money but keep player names
    setPlayers(prev => prev.map(p => ({ ...p, money: 0, position: null, adjustments: 0 })));
    setIsCalculated(false);
    setAdjustmentDisplays({});
  };

  const resetGame = () => {
    setSetup(null);
    setPlayers([]);
    setShowSetup(true);
    setGameHistory([]);
    setIsCalculated(false);
    setBetAmountDisplay('');
    setBetLevel1Display('');
    setBetLevel2Display('');
    setAdjustmentDisplays({});
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
                Thiết lập Tiến Lên
              </h1>
              <div className="w-24"></div> {/* Spacer for centering */}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl">
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-xl border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700/60 p-6 sm:p-8">
              <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-50">
                Thiết lập Tiến Lên
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
                  max="4"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                  placeholder="Nhập số người chơi (2-4 người)"
                />
              </div>

              {/* Rule Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Chọn luật chơi
                </label>
                <div className="space-y-3">
                  <label className="flex items-center p-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors duration-200">
                    <input
                      type="radio"
                      name="rule"
                      value="nhat-an-het"
                      checked={selectedRule === 'nhat-an-het'}
                      onChange={(e) => setSelectedRule(e.target.value as 'nhat-an-het')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-50">Nhất ăn hết</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Mỗi player trừ bằng số tiền cược</div>
                    </div>
                  </label>

                  <label className="flex items-center p-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors duration-200">
                    <input
                      type="radio"
                      name="rule"
                      value="nhat-an-bet-nhi-an-ba"
                      checked={selectedRule === 'nhat-an-bet-nhi-an-ba'}
                      onChange={(e) => setSelectedRule(e.target.value as 'nhat-an-bet-nhi-an-ba')}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-50">Nhất ăn bét, Nhì ăn Ba</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Nhập 2 mức cược khác nhau</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Bet Amount (for nhat-an-het) */}
              {selectedRule === 'nhat-an-het' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Số tiền cược
                  </label>
                  <input
                    type="text"
                    name="betAmount"
                    value={betAmountDisplay}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setBetAmountDisplay(formatNumber(value));
                    }}
                    onBlur={(e) => {
                      const value = parseFormattedNumber(e.target.value);
                      setBetAmountDisplay(formatNumber(value));
                    }}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Nhập số tiền cược"
                  />
                </div>
              )}

              {/* Bet Levels (for nhat-an-bet-nhi-an-ba) */}
              {selectedRule === 'nhat-an-bet-nhi-an-ba' && (
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Mức cược cho người bét (Nhất ăn)
                  </label>
                  <input
                    type="text"
                    name="betLevel1"
                    value={betLevel1Display}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setBetLevel1Display(formatNumber(value));
                    }}
                    onBlur={(e) => {
                      const value = parseFormattedNumber(e.target.value);
                      setBetLevel1Display(formatNumber(value));
                    }}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Nhập mức cược 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Mức cược cho người ba (Nhì ăn)
                  </label>
                  <input
                    type="text"
                    name="betLevel2"
                    value={betLevel2Display}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setBetLevel2Display(formatNumber(value));
                    }}
                    onBlur={(e) => {
                      const value = parseFormattedNumber(e.target.value);
                      setBetLevel2Display(formatNumber(value));
                    }}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                    placeholder="Nhập mức cược 2"
                  />
                </div>
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
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="w-full max-w-2xl mx-4 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                      Game đã lưu
                    </h3>
                    <button
                      onClick={() => setShowSessionList(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      ✕
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
                          className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                            >
                              Mở
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Bạn có chắc muốn xóa game này?')) {
                                  deleteSession(session.id);
                                }
                              }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
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
              Tính tiền Tiến Lên
            </h1>
            <button
              onClick={resetGame}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-50 cursor-pointer"
            >
              Thiết lập lại
            </button>
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
              className="rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700/60 p-4"
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
                {/* Position Buttons - Quick Select */}
                <div className="grid grid-cols-4 gap-2">
                  {(() => {
                    const isNhatSelected = players.some(p => p.id !== player.id && p.position === 'nhat');
                    return (
                      <button
                        type="button"
                        onClick={() => handlePositionChange(player.id, 'nhat')}
                        disabled={isNhatSelected && player.position !== 'nhat'}
                        className={`flex flex-col items-center justify-center px-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          player.position === 'nhat'
                            ? 'bg-yellow-500 text-white shadow-lg scale-105 ring-2 ring-yellow-400 cursor-pointer'
                            : isNhatSelected
                            ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/40 cursor-pointer'
                        }`}
                        title={isNhatSelected && player.position !== 'nhat' ? 'Đã được chọn' : 'Nhất'}
                      >
                        <span className="text-lg font-bold">1</span>
                        <span className="text-xs mt-1 font-medium">Nhất</span>
                      </button>
                    );
                  })()}
                  {(() => {
                    const isNhiSelected = players.some(p => p.id !== player.id && p.position === 'nhi');
                    return (
                      <button
                        type="button"
                        onClick={() => handlePositionChange(player.id, 'nhi')}
                        disabled={isNhiSelected && player.position !== 'nhi'}
                        className={`flex flex-col items-center justify-center px-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          player.position === 'nhi'
                            ? 'bg-slate-500 text-white shadow-lg scale-105 ring-2 ring-slate-400 cursor-pointer'
                            : isNhiSelected
                            ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-600 cursor-pointer'
                        }`}
                        title={isNhiSelected && player.position !== 'nhi' ? 'Đã được chọn' : 'Nhì'}
                      >
                        <span className="text-lg font-bold">2</span>
                        <span className="text-xs mt-1 font-medium">Nhì</span>
                      </button>
                    );
                  })()}
                  {(() => {
                    const isBaSelected = players.some(p => p.id !== player.id && p.position === 'ba');
                    return (
                      <button
                        type="button"
                        onClick={() => handlePositionChange(player.id, 'ba')}
                        disabled={isBaSelected && player.position !== 'ba'}
                        className={`flex flex-col items-center justify-center px-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          player.position === 'ba'
                            ? 'bg-orange-500 text-white shadow-lg scale-105 ring-2 ring-orange-400 cursor-pointer'
                            : isBaSelected
                            ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/40 cursor-pointer'
                        }`}
                        title={isBaSelected && player.position !== 'ba' ? 'Đã được chọn' : 'Ba'}
                      >
                        <span className="text-lg font-bold">3</span>
                        <span className="text-xs mt-1 font-medium">Ba</span>
                      </button>
                    );
                  })()}
                  {(() => {
                    const isBetSelected = players.some(p => p.id !== player.id && p.position === 'bet');
                    return (
                      <button
                        type="button"
                        onClick={() => handlePositionChange(player.id, 'bet')}
                        disabled={isBetSelected && player.position !== 'bet'}
                        className={`flex flex-col items-center justify-center px-2 py-3 rounded-lg font-bold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          player.position === 'bet'
                            ? 'bg-red-500 text-white shadow-lg scale-105 ring-2 ring-red-400 cursor-pointer'
                            : isBetSelected
                            ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/40 cursor-pointer'
                        }`}
                        title={isBetSelected && player.position !== 'bet' ? 'Đã được chọn' : 'Bét'}
                      >
                        <span className="text-lg font-bold">B</span>
                        <span className="text-xs mt-1 font-medium">Bét</span>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Adjustment for special cases */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Điều chỉnh đặc biệt
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustmentChange(player.id, player.adjustments - 1000)}
                    className="flex-1 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors duration-200 cursor-pointer dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    -1k
                  </button>
                  <input
                    type="text"
                    value={adjustmentDisplays[player.id] !== undefined ? adjustmentDisplays[player.id] : player.adjustments.toString()}
                    onChange={(e) => handleAdjustmentInputChange(player.id, e.target.value)}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      handleAdjustmentChange(player.id, value);
                      setAdjustmentDisplays(prev => ({
                        ...prev,
                        [player.id]: value.toString(),
                      }));
                    }}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjustmentChange(player.id, player.adjustments + 1000)}
                    className="flex-1 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200 transition-colors duration-200 cursor-pointer dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                  >
                    +1k
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  (Tứ quý, ba đôi thông, tới trắng, cóng...)
                </p>
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
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Bàn {round.id} - {new Date(round.timestamp).toLocaleTimeString('vi-VN')}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditRound(round.id)}
                        className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteRound(round.id)}
                        className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {round.players.map((p) => (
                      <div key={p.id} className="flex justify-between">
                        <span className="text-slate-700 dark:text-slate-300">{p.name}:</span>
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

        {/* Edit Round Modal */}
        {editingRoundId !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingRoundId(null);
              setEditingRoundPlayers([]);
              setEditModalError(null);
            }
          }}>
            <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
              {/* Header - Sticky with backdrop */}
              <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  Chỉnh sửa Bàn {editingRoundId}
                </h3>
                <button
                  onClick={() => {
                    setEditingRoundId(null);
                    setEditingRoundPlayers([]);
                    setEditModalError(null);
                  }}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Đóng"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Validation Error in Edit Modal */}
                {editModalError && (
                  <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-red-800 dark:text-red-300 flex-1">
                        {editModalError}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {editingRoundPlayers.map((player) => {
                    const isNhatSelected = editingRoundPlayers.some(p => p.position === 'nhat' && p.id !== player.id);
                    const isNhiSelected = editingRoundPlayers.some(p => p.position === 'nhi' && p.id !== player.id);
                    const isBaSelected = editingRoundPlayers.some(p => p.position === 'ba' && p.id !== player.id);
                    const isBetSelected = editingRoundPlayers.some(p => p.position === 'bet' && p.id !== player.id);

                    return (
                      <div
                        key={player.id}
                        className="rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {player.name}
                          </label>
                          
                          {/* Position Buttons */}
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            {/* Nhất */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoundPlayers(prev => prev.map(p => {
                                  if (p.id === player.id) {
                                    return { ...p, position: p.position === 'nhat' ? null : 'nhat' };
                                  }
                                  if (p.position === 'nhat' && p.id !== player.id) {
                                    return { ...p, position: null };
                                  }
                                  return p;
                                }));
                              }}
                              disabled={isNhatSelected && player.position !== 'nhat'}
                              className={`flex flex-col items-center justify-center px-2 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                player.position === 'nhat'
                                  ? 'bg-yellow-500 text-white shadow-lg scale-105 ring-2 ring-yellow-400 cursor-pointer'
                                  : isNhatSelected
                                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/40 cursor-pointer'
                              }`}
                            >
                              <span className="text-lg font-bold">1</span>
                              <span className="text-xs mt-1 font-medium">Nhất</span>
                            </button>

                            {/* Nhì */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoundPlayers(prev => prev.map(p => {
                                  if (p.id === player.id) {
                                    return { ...p, position: p.position === 'nhi' ? null : 'nhi' };
                                  }
                                  if (p.position === 'nhi' && p.id !== player.id) {
                                    return { ...p, position: null };
                                  }
                                  return p;
                                }));
                              }}
                              disabled={isNhiSelected && player.position !== 'nhi'}
                              className={`flex flex-col items-center justify-center px-2 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                player.position === 'nhi'
                                  ? 'bg-slate-500 text-white shadow-lg scale-105 ring-2 ring-slate-400 cursor-pointer'
                                  : isNhiSelected
                                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-600 cursor-pointer'
                              }`}
                            >
                              <span className="text-lg font-bold">2</span>
                              <span className="text-xs mt-1 font-medium">Nhì</span>
                            </button>

                            {/* Ba */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoundPlayers(prev => prev.map(p => {
                                  if (p.id === player.id) {
                                    return { ...p, position: p.position === 'ba' ? null : 'ba' };
                                  }
                                  if (p.position === 'ba' && p.id !== player.id) {
                                    return { ...p, position: null };
                                  }
                                  return p;
                                }));
                              }}
                              disabled={isBaSelected && player.position !== 'ba'}
                              className={`flex flex-col items-center justify-center px-2 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                player.position === 'ba'
                                  ? 'bg-orange-500 text-white shadow-lg scale-105 ring-2 ring-orange-400 cursor-pointer'
                                  : isBaSelected
                                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                  : 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/40 cursor-pointer'
                              }`}
                            >
                              <span className="text-lg font-bold">3</span>
                              <span className="text-xs mt-1 font-medium">Ba</span>
                            </button>

                            {/* Bét */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoundPlayers(prev => prev.map(p => {
                                  if (p.id === player.id) {
                                    return { ...p, position: p.position === 'bet' ? null : 'bet' };
                                  }
                                  if (p.position === 'bet' && p.id !== player.id) {
                                    return { ...p, position: null };
                                  }
                                  return p;
                                }));
                              }}
                              disabled={isBetSelected && player.position !== 'bet'}
                              className={`flex flex-col items-center justify-center px-2 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                player.position === 'bet'
                                  ? 'bg-red-500 text-white shadow-lg scale-105 ring-2 ring-red-400 cursor-pointer'
                                  : isBetSelected
                                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/40 cursor-pointer'
                              }`}
                            >
                              <span className="text-lg font-bold">B</span>
                              <span className="text-xs mt-1 font-medium">Bét</span>
                            </button>
                          </div>
                        </div>

                        {/* Adjustment */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Điều chỉnh đặc biệt
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoundPlayers(prev => prev.map(p => 
                                  p.id === player.id ? { ...p, adjustments: p.adjustments - 1000 } : p
                                ));
                              }}
                              className="flex-1 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors duration-200 cursor-pointer dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              -1k
                            </button>
                            <input
                              type="text"
                              value={player.adjustments.toString()}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setEditingRoundPlayers(prev => prev.map(p => 
                                  p.id === player.id ? { ...p, adjustments: value } : p
                                ));
                              }}
                              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoundPlayers(prev => prev.map(p => 
                                  p.id === player.id ? { ...p, adjustments: p.adjustments + 1000 } : p
                                ));
                              }}
                              className="flex-1 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200 transition-colors duration-200 cursor-pointer dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                            >
                              +1k
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Footer - Sticky */}
              <div className="sticky bottom-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditingRoundId(null);
                    setEditingRoundPlayers([]);
                    setEditModalError(null);
                  }}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-medium rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveRoundEdit}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow"
                >
                  Lưu thay đổi
                </button>
              </div>
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
                // Calculate total money for each player across all rounds
                const playerTotals: { [key: number]: { name: string; total: number } } = {};
                
                // Sum up money from all rounds
                gameHistory.forEach(round => {
                  round.players.forEach(p => {
                    if (playerTotals[p.id]) {
                      playerTotals[p.id].total += p.money;
                      // Update name in case it changed (use latest)
                      playerTotals[p.id].name = p.name;
                    } else {
                      playerTotals[p.id] = { name: p.name, total: p.money };
                    }
                  });
                });
                
                // Convert to array and sort by player id to maintain consistent order
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
