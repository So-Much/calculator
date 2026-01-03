// Client-side utilities for interacting with Excel/Google Sheets API
// Falls back to localStorage if API is not available

const API_BASE = '/api/excel';

export interface Account {
  id: number;
  username: string;
  password: string;
}

export interface CounterData {
  id: number;
  accountId: number;
  count: number;
  lastUpdated: string;
}

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

const STORAGE_KEYS = {
  ACCOUNTS: 'calculator_accounts',
  DATA: 'calculator_data',
  GAME_SESSIONS: 'calculator_game_sessions',
};

// Helper functions for localStorage
function getAccountsFromStorage(): Account[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
  return data ? JSON.parse(data) : [];
}

function saveAccountsToStorage(accounts: Account[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
}

function getCounterDataFromStorage(accountId: number): CounterData | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.DATA);
  const allData: CounterData[] = data ? JSON.parse(data) : [];
  return allData.find(d => d.accountId === accountId) || null;
}

function saveCounterDataToStorage(data: CounterData): void {
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

function getGameSessionsFromStorage(accountId: number, gameType: string): GameSession[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.GAME_SESSIONS);
  const allSessions: GameSession[] = data ? JSON.parse(data) : [];
  return allSessions.filter(s => s.accountId === accountId && s.gameType === gameType);
}

function getGameSessionFromStorage(sessionId: number): GameSession | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(STORAGE_KEYS.GAME_SESSIONS);
  const allSessions: GameSession[] = data ? JSON.parse(data) : [];
  return allSessions.find(s => s.id === sessionId) || null;
}

function saveGameSessionToStorage(session: GameSession): void {
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

function deleteGameSessionFromStorage(sessionId: number): void {
  if (typeof window === 'undefined') return;
  const data = localStorage.getItem(STORAGE_KEYS.GAME_SESSIONS);
  const allSessions: GameSession[] = data ? JSON.parse(data) : [];
  const filtered = allSessions.filter(s => s.id !== sessionId);
  localStorage.setItem(STORAGE_KEYS.GAME_SESSIONS, JSON.stringify(filtered));
}

// Account functions
export async function getAccounts(): Promise<Account[]> {
  try {
    const response = await fetch(`${API_BASE}/account`);
    if (response.ok) {
      const data = await response.json();
      return data.accounts || [];
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  return getAccountsFromStorage();
}

export async function findAccount(username: string, password: string): Promise<Account | null> {
  try {
    const response = await fetch(
      `${API_BASE}/account?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    );
    if (response.ok) {
      const data = await response.json();
      return data.account || null;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  const accounts = getAccountsFromStorage();
  return accounts.find(a => a.username === username && a.password === password) || null;
}

export async function addAccount(username: string, password: string): Promise<Account> {
  try {
    const response = await fetch(`${API_BASE}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.account;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const accounts = getAccountsFromStorage();
    const nextId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;
    const newAccount: Account = {
      id: nextId,
      username,
      password,
    };
    accounts.push(newAccount);
    saveAccountsToStorage(accounts);
    return newAccount;
  }
  
  throw new Error('Unable to add account');
}

export async function getOrCreateAccount(username: string, password: string): Promise<Account> {
  try {
    // Try to find existing account first
    const findResponse = await fetch(
      `${API_BASE}/account?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    );
    if (findResponse.ok) {
      const { account } = await findResponse.json();
      if (account) {
        return account;
      }
    }

    // Account doesn't exist, create new one
    const createResponse = await fetch(`${API_BASE}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (createResponse.ok) {
      const { account } = await createResponse.json();
      return account;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const existing = await findAccount(username, password);
    if (existing) {
      return existing;
    }
    return await addAccount(username, password);
  }
  
  throw new Error('Unable to get or create account');
}

// Counter data functions
export async function getCounterData(accountId: number): Promise<CounterData | null> {
  try {
    const response = await fetch(`${API_BASE}/data?accountId=${accountId}`);
    if (response.ok) {
      const data = await response.json();
      return data.data || null;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  return getCounterDataFromStorage(accountId);
}

export async function saveCounterData(accountId: number, count: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId, count }),
    });
    if (response.ok) {
      return;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const now = new Date().toISOString();
    const existing = getCounterDataFromStorage(accountId);
    
    if (existing) {
      saveCounterDataToStorage({ ...existing, count, lastUpdated: now });
    } else {
      const nextId = 1;
      saveCounterDataToStorage({ id: nextId, accountId, count, lastUpdated: now });
    }
  }
}

// Game session functions
export async function loadGameSessions(accountId: number, gameType: string): Promise<GameSession[]> {
  try {
    const response = await fetch(`${API_BASE}/game-sessions?accountId=${accountId}&gameType=${gameType}`);
    if (response.ok) {
      const data = await response.json();
      return data.sessions || [];
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  const sessions = getGameSessionsFromStorage(accountId, gameType);
  return sessions.map(s => ({
    id: s.id,
    sessionName: s.sessionName,
    lastUpdated: s.lastUpdated,
  } as any));
}

export async function loadGameSession(sessionId: number): Promise<GameSession | null> {
  try {
    const response = await fetch(`${API_BASE}/game-sessions?sessionId=${sessionId}`);
    if (response.ok) {
      const data = await response.json();
      return data.session || null;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    return getGameSessionFromStorage(sessionId);
  }
  return null;
}

export async function saveGameSession(
  accountId: number,
  gameType: string,
  sessionName: string,
  setup: any,
  players: any,
  gameHistory: any,
  sessionId?: number
): Promise<GameSession> {
  const now = new Date().toISOString();
  let session: GameSession;
  
  // If updating existing session, load it first to get createdAt
  if (sessionId) {
    const existing = await loadGameSession(sessionId);
    if (existing) {
      session = {
        ...existing,
        sessionName,
        setup: typeof setup === 'string' ? setup : JSON.stringify(setup),
        players: typeof players === 'string' ? players : JSON.stringify(players),
        gameHistory: typeof gameHistory === 'string' ? gameHistory : JSON.stringify(gameHistory),
        lastUpdated: now,
      };
    } else {
      // Session not found, create new
      const allSessions = getGameSessionsFromStorage(accountId, gameType);
      const nextId = allSessions.length > 0 ? Math.max(...allSessions.map(s => s.id)) + 1 : 1;
      session = {
        id: nextId,
        accountId,
        gameType,
        sessionName,
        setup: typeof setup === 'string' ? setup : JSON.stringify(setup),
        players: typeof players === 'string' ? players : JSON.stringify(players),
        gameHistory: typeof gameHistory === 'string' ? gameHistory : JSON.stringify(gameHistory),
        lastUpdated: now,
        createdAt: now,
      };
    }
  } else {
    // Create new session
    const allSessions = getGameSessionsFromStorage(accountId, gameType);
    const nextId = allSessions.length > 0 ? Math.max(...allSessions.map(s => s.id)) + 1 : 1;
    session = {
      id: nextId,
      accountId,
      gameType,
      sessionName,
      setup: typeof setup === 'string' ? setup : JSON.stringify(setup),
      players: typeof players === 'string' ? players : JSON.stringify(players),
      gameHistory: typeof gameHistory === 'string' ? gameHistory : JSON.stringify(gameHistory),
      lastUpdated: now,
      createdAt: now,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/game-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        gameType,
        sessionName,
        setup: session.setup,
        players: session.players,
        gameHistory: session.gameHistory,
        sessionId: session.id,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.session;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    saveGameSessionToStorage(session);
    return session;
  }
  
  throw new Error('Unable to save game session');
}

export async function deleteGameSession(sessionId: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/game-sessions?sessionId=${sessionId}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      return;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    deleteGameSessionFromStorage(sessionId);
  }
}

// Download Excel file
export async function downloadExcelFile(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/download`);
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'database.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}
