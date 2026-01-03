import { NextRequest, NextResponse } from 'next/server';
import { getSheetRows, addSheetRow, deleteSheetRowById, updateSheetRowById, setSheetHeaders } from '@/lib/google-sheets';

const GAME_SESSIONS_SHEET_NAME = 'game_sessions';

export interface GameSession {
  id: number;
  accountId: number;
  gameType: string; // 'tien-len', 'xi-dach', etc.
  sessionName: string;
  setup: string; // JSON string of GameSetup
  players: string; // JSON string of Player[]
  gameHistory: string; // JSON string of GameRound[]
  lastUpdated: string;
  createdAt: string;
}

// GET: Get game sessions for an account
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const gameType = searchParams.get('gameType');
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      // Get specific session
      const sessions = await getSheetRows<GameSession>(GAME_SESSIONS_SHEET_NAME);
      const session = sessions.find(s => s.id === parseInt(sessionId, 10));
      return NextResponse.json({ session: session || null }, { status: 200 });
    }

    if (accountId && gameType) {
      // Get all sessions for account and game type
      const sessions = await getSheetRows<GameSession>(GAME_SESSIONS_SHEET_NAME);
      const filteredSessions = sessions.filter(
        s => s.accountId === parseInt(accountId, 10) && s.gameType === gameType
      );
      
      // Return only id, sessionName, and lastUpdated
      const sessionList = filteredSessions.map(s => ({
        id: s.id,
        sessionName: s.sessionName,
        lastUpdated: s.lastUpdated,
      }));
      
      return NextResponse.json({ sessions: sessionList }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'accountId and gameType are required' },
      { status: 400 }
    );
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

    const sessions = await getSheetRows<GameSession>(GAME_SESSIONS_SHEET_NAME);

    // Initialize headers if sheet is new
    if (sessions.length === 0) {
      await setSheetHeaders(GAME_SESSIONS_SHEET_NAME, [
        'id', 'accountId', 'gameType', 'sessionName', 'setup', 'players', 
        'gameHistory', 'lastUpdated', 'createdAt'
      ]);
    }

    const now = new Date().toISOString();

    if (sessionId) {
      // Update existing session
      const sessionExists = sessions.find(s => s.id === parseInt(sessionId, 10));
      if (sessionExists) {
        const updatedSession: Partial<GameSession> = {
          sessionName,
          setup,
          players,
          gameHistory,
          lastUpdated: now,
        };
        await updateSheetRowById(GAME_SESSIONS_SHEET_NAME, 'id', parseInt(sessionId, 10), updatedSession);
        
        const updatedSessions = await getSheetRows<GameSession>(GAME_SESSIONS_SHEET_NAME);
        const session = updatedSessions.find(s => s.id === parseInt(sessionId, 10));
        return NextResponse.json({ session: session || null }, { status: 200 });
      }
    }

    // Create new session
    const nextId = sessions.length > 0 
      ? Math.max(...sessions.map(s => s.id)) + 1 
      : 1;

    const newSession: GameSession = {
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

    await addSheetRow(GAME_SESSIONS_SHEET_NAME, newSession);

    return NextResponse.json({ session: newSession }, { status: 201 });
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

    const sessions = await getSheetRows<GameSession>(GAME_SESSIONS_SHEET_NAME);
    const sessionExists = sessions.find(s => s.id === parseInt(sessionId, 10));

    if (sessionExists) {
      await deleteSheetRowById(GAME_SESSIONS_SHEET_NAME, 'id', parseInt(sessionId, 10));
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error deleting game session:', error);
    return NextResponse.json(
      { error: 'Failed to delete game session' },
      { status: 500 }
    );
  }
}
