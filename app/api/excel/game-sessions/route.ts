import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const GAME_SESSIONS_SHEET_NAME = 'game_sessions';

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

// Check if Google Sheets credentials are available
async function hasGoogleSheetsCredentials(): Promise<boolean> {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      return true;
    }
    
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'google-credentials.json'),
      path.join(process.cwd(), 'data', 'hi-garment-synch-data-a60452bc4e37.json'),
    ];
    
    for (const credentialsPath of possiblePaths) {
      if (fs.existsSync(credentialsPath)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

// Use Google Sheets
async function getSessionsFromGoogleSheets(accountId: number, gameType: string | null, sessionId: number | null): Promise<GameSession[]> {
  const { getSheetRows } = await import('@/lib/google-sheets');
  const sessions = await getSheetRows<GameSession>(GAME_SESSIONS_SHEET_NAME);
  
  let filtered = sessions.filter(s => s.accountId === accountId);
  
  if (gameType) {
    filtered = filtered.filter(s => s.gameType === gameType);
  }
  
  if (sessionId) {
    filtered = filtered.filter(s => s.id === sessionId);
  }
  
  return filtered;
}

async function addSessionToGoogleSheets(session: GameSession): Promise<void> {
  const { getSheetRows, addSheetRow, setSheetHeaders } = await import('@/lib/google-sheets');
  const sessions = await getSheetRows<GameSession>(GAME_SESSIONS_SHEET_NAME);
  
  if (sessions.length === 0) {
    await setSheetHeaders(GAME_SESSIONS_SHEET_NAME, [
      'id', 'accountId', 'gameType', 'sessionName', 'setup', 'players', 
      'gameHistory', 'lastUpdated', 'createdAt'
    ]);
  }
  
  await addSheetRow(GAME_SESSIONS_SHEET_NAME, session);
}

async function updateSessionInGoogleSheets(sessionId: number, session: Partial<GameSession>): Promise<void> {
  const { updateSheetRowById } = await import('@/lib/google-sheets');
  await updateSheetRowById(GAME_SESSIONS_SHEET_NAME, 'id', sessionId, session);
}

async function deleteSessionFromGoogleSheets(sessionId: number): Promise<void> {
  const { deleteSheetRowById } = await import('@/lib/google-sheets');
  await deleteSheetRowById(GAME_SESSIONS_SHEET_NAME, 'id', sessionId);
}

// Use file-based storage
async function getSessionsFromFile(accountId: number, gameType: string | null, sessionId: number | null): Promise<GameSession[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'database.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[GAME_SESSIONS_SHEET_NAME];
    
    if (!sheet) {
      return [];
    }
    
    let sessions = XLSX.utils.sheet_to_json<GameSession>(sheet);
    sessions = sessions.filter(s => s.accountId === accountId);
    
    if (gameType) {
      sessions = sessions.filter(s => s.gameType === gameType);
    }
    
    if (sessionId) {
      sessions = sessions.filter(s => s.id === sessionId);
    }
    
    return sessions;
  } catch {
    return [];
  }
}

async function saveSessionToFile(session: GameSession, isUpdate: boolean): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'database.xlsx');
    const dataDir = path.dirname(filePath);
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    let workbook;
    if (fs.existsSync(filePath)) {
      workbook = XLSX.readFile(filePath);
    } else {
      workbook = XLSX.utils.book_new();
    }
    
    const sheet = workbook.Sheets[GAME_SESSIONS_SHEET_NAME];
    const sessions = sheet ? XLSX.utils.sheet_to_json<GameSession>(sheet) : [];
    
    if (isUpdate) {
      const index = sessions.findIndex(s => s.id === session.id);
      if (index >= 0) {
        sessions[index] = session;
      }
    } else {
      sessions.push(session);
    }
    
    const newSheet = XLSX.utils.json_to_sheet(sessions);
    workbook.Sheets[GAME_SESSIONS_SHEET_NAME] = newSheet;
    XLSX.writeFile(workbook, filePath);
  } catch (error) {
    console.error('Error saving to file:', error);
    throw error;
  }
}

async function deleteSessionFromFile(sessionId: number): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'database.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[GAME_SESSIONS_SHEET_NAME];
    
    if (!sheet) {
      return;
    }
    
    const sessions = XLSX.utils.sheet_to_json<GameSession>(sheet);
    const filtered = sessions.filter(s => s.id !== sessionId);
    
    const newSheet = XLSX.utils.json_to_sheet(filtered);
    workbook.Sheets[GAME_SESSIONS_SHEET_NAME] = newSheet;
    XLSX.writeFile(workbook, filePath);
  } catch (error) {
    console.error('Error deleting from file:', error);
    throw error;
  }
}

// GET: Get game sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const gameType = searchParams.get('gameType');
    const sessionId = searchParams.get('sessionId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    const hasSheets = await hasGoogleSheetsCredentials();
    let sessions: GameSession[] = [];

    try {
      if (hasSheets) {
        sessions = await getSessionsFromGoogleSheets(
          parseInt(accountId, 10),
          gameType,
          sessionId ? parseInt(sessionId, 10) : null
        );
      } else {
        sessions = await getSessionsFromFile(
          parseInt(accountId, 10),
          gameType,
          sessionId ? parseInt(sessionId, 10) : null
        );
      }
    } catch (error) {
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        sessions = await getSessionsFromFile(
          parseInt(accountId, 10),
          gameType,
          sessionId ? parseInt(sessionId, 10) : null
        );
      }
    }

    if (sessionId) {
      const session = sessions[0] || null;
      return NextResponse.json({ session }, { status: 200 });
    }

    if (gameType) {
      const sessionList = sessions.map(s => ({
        id: s.id,
        sessionName: s.sessionName,
        lastUpdated: s.lastUpdated,
      }));
      return NextResponse.json({ sessions: sessionList }, { status: 200 });
    }

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (error) {
    console.error('Error reading game sessions:', error);
    return NextResponse.json(
      { error: 'Failed to read game sessions' },
      { status: 500 }
    );
  }
}

// POST: Create or update game session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, gameType, sessionName, setup, players, gameHistory, sessionId } = body;

    if (!accountId || !gameType || !sessionName || !setup || !players || !gameHistory) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const hasSheets = await hasGoogleSheetsCredentials();
    let sessions: GameSession[] = [];

    try {
      if (hasSheets) {
        sessions = await getSessionsFromGoogleSheets(parseInt(accountId, 10), gameType, null);
      } else {
        sessions = await getSessionsFromFile(parseInt(accountId, 10), gameType, null);
      }
    } catch (error) {
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        sessions = await getSessionsFromFile(parseInt(accountId, 10), gameType, null);
      }
    }

    const now = new Date().toISOString();
    let savedSession: GameSession;

    if (sessionId) {
      // Update existing
      const existing = sessions.find(s => s.id === parseInt(sessionId, 10));
      if (existing) {
        savedSession = {
          ...existing,
          sessionName,
          setup,
          players,
          gameHistory,
          lastUpdated: now,
        };
        
        try {
          if (hasSheets) {
            await updateSessionInGoogleSheets(parseInt(sessionId, 10), {
              sessionName,
              setup,
              players,
              gameHistory,
              lastUpdated: now,
            });
          } else {
            await saveSessionToFile(savedSession, true);
          }
        } catch (error) {
          if (hasSheets) {
            console.warn('Google Sheets failed, falling back to file storage');
            await saveSessionToFile(savedSession, true);
          } else {
            throw error;
          }
        }
      } else {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
    } else {
      // Create new
      const nextId = sessions.length > 0 
        ? Math.max(...sessions.map(s => s.id)) + 1 
        : 1;
      
      savedSession = {
        id: nextId,
        accountId: parseInt(accountId, 10),
        gameType,
        sessionName,
        setup,
        players,
        gameHistory,
        lastUpdated: now,
        createdAt: now,
      };
      
      try {
        if (hasSheets) {
          await addSessionToGoogleSheets(savedSession);
        } else {
          await saveSessionToFile(savedSession, false);
        }
      } catch (error) {
        if (hasSheets) {
          console.warn('Google Sheets failed, falling back to file storage');
          await saveSessionToFile(savedSession, false);
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({ session: savedSession }, { status: sessionId ? 200 : 201 });
  } catch (error) {
    console.error('Error saving game session:', error);
    return NextResponse.json(
      { error: 'Failed to save game session' },
      { status: 500 }
    );
  }
}

// DELETE: Delete game session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const hasSheets = await hasGoogleSheetsCredentials();

    try {
      if (hasSheets) {
        await deleteSessionFromGoogleSheets(parseInt(sessionId, 10));
      } else {
        await deleteSessionFromFile(parseInt(sessionId, 10));
      }
    } catch (error) {
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        await deleteSessionFromFile(parseInt(sessionId, 10));
      } else {
        throw error;
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting game session:', error);
    return NextResponse.json(
      { error: 'Failed to delete game session' },
      { status: 500 }
    );
  }
}
