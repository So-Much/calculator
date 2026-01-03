// Storage utilities with fallback: Google Sheets -> localStorage

const STORAGE_KEYS = {
  ACCOUNTS: 'calculator_accounts',
  DATA: 'calculator_data',
  GAME_SESSIONS: 'calculator_game_sessions',
};

// Check if Google Sheets is available (for server-side)
export function hasGoogleSheetsCredentials(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: check environment variables or file
    return !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && 
      process.env.GOOGLE_PRIVATE_KEY
    );
  }
  // Client-side: always assume API routes are available
  return true;
}

// Account utilities
export interface Account {
  id: number;
  username: string;
  password: string;
}

export function getAccountsFromStorage(): Account[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
  return data ? JSON.parse(data) : [];
}

export function saveAccountsToStorage(accounts: Account[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
}

export function findAccountInStorage(username: string, password: string): Account | null {
  const accounts = getAccountsFromStorage();
  return accounts.find(a => a.username === username && a.password === password) || null;
}

export function addAccountToStorage(account: Account): void {
  const accounts = getAccountsFromStorage();
  accounts.push(account);
  saveAccountsToStorage(accounts);
}

// Counter data utilities
export interface CounterData {
  id: number;
  accountId: number;
  count: number;
  lastUpdated: string;
}

export function getCounterDataFromStorage(accountId: number): CounterData | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.DATA);
  const allData: CounterData[] = data ? JSON.parse(data) : [];
  return allData.find(d => d.accountId === accountId) || null;
}

export function saveCounterDataToStorage(data: CounterData): void {
  if (typeof window === 'undefined') return;
  const allData = localStorage.getItem(STORAGE_KEYS.DATA);
  const dataArray: CounterData[] = allData ? JSON.parse(allData) : [];
  const index = dataArray.findIndex(d => d.accountId === data.accountId);
  if (index >= 0) {
    dataArray[index] = data;
  } else {
    dataArray.push(data);
  }
  localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(dataArray));
}

// Game session utilities
export interface GameSession {
  id: number;
  accountId: number;
  gameType: string;
  sessionName: string;
  setup: string;
  players: string;
  gameHistory: string;
  lastUpdated: string;
  createdAt: string;
}

export function getGameSessionsFromStorage(accountId: number, gameType: string): GameSession[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.GAME_SESSIONS);
  const allSessions: GameSession[] = data ? JSON.parse(data) : [];
  return allSessions.filter(s => s.accountId === accountId && s.gameType === gameType);
}

export function getGameSessionFromStorage(sessionId: number): GameSession | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.GAME_SESSIONS);
  const allSessions: GameSession[] = data ? JSON.parse(data) : [];
  return allSessions.find(s => s.id === sessionId) || null;
}

export function saveGameSessionToStorage(session: GameSession): void {
  if (typeof window === 'undefined') return;
  const data = localStorage.getItem(STORAGE_KEYS.GAME_SESSIONS);
  const allSessions: GameSession[] = data ? JSON.parse(data) : [];
  const index = allSessions.findIndex(s => s.id === session.id);
  if (index >= 0) {
    allSessions[index] = session;
  } else {
    allSessions.push(session);
  }
  localStorage.setItem(STORAGE_KEYS.GAME_SESSIONS, JSON.stringify(allSessions));
}

export function deleteGameSessionFromStorage(sessionId: number): void {
  if (typeof window === 'undefined') return;
  const data = localStorage.getItem(STORAGE_KEYS.GAME_SESSIONS);
  const allSessions: GameSession[] = data ? JSON.parse(data) : [];
  const filtered = allSessions.filter(s => s.id !== sessionId);
  localStorage.setItem(STORAGE_KEYS.GAME_SESSIONS, JSON.stringify(filtered));
}

