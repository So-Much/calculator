import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'database.xlsx');
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

// Helper function to read Excel file
function readExcelFile() {
  const dataDir = path.dirname(EXCEL_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    const workbook = XLSX.utils.book_new();
    const accountSheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, accountSheet, 'account');
    
    const dataSheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'data');
    
    const gameSessionsSheet = XLSX.utils.json_to_sheet<GameSession>([]);
    XLSX.utils.book_append_sheet(workbook, gameSessionsSheet, GAME_SESSIONS_SHEET_NAME);
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(EXCEL_FILE_PATH, buffer);
    return workbook;
  }
  
  try {
    const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
    return XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (error) {
    console.error('Error reading Excel file:', error);
    try {
      return XLSX.readFile(EXCEL_FILE_PATH);
    } catch (fallbackError) {
      console.error('Fallback read also failed:', fallbackError);
      throw new Error(`Cannot access file ${EXCEL_FILE_PATH}. Make sure the file is not open in another application.`);
    }
  }
}

// Helper function to write Excel file
function writeExcelFile(workbook: XLSX.WorkBook) {
  try {
    const dataDir = path.dirname(EXCEL_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(EXCEL_FILE_PATH, buffer);
  } catch (error) {
    console.error('Error writing Excel file:', error);
    try {
      XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    } catch (fallbackError) {
      console.error('Fallback write also failed:', fallbackError);
      throw new Error(`Cannot save file ${EXCEL_FILE_PATH}. Make sure the file is not open in another application.`);
    }
  }
}

// GET: Get game sessions for an account
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId');
    const gameType = searchParams.get('gameType');
    const sessionId = searchParams.get('sessionId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    const workbook = readExcelFile();
    
    // Ensure game_sessions sheet exists
    if (!workbook.Sheets[GAME_SESSIONS_SHEET_NAME]) {
      const gameSessionsSheet = XLSX.utils.json_to_sheet<GameSession>([]);
      XLSX.utils.book_append_sheet(workbook, gameSessionsSheet, GAME_SESSIONS_SHEET_NAME);
      writeExcelFile(workbook);
    }

    const sheet = workbook.Sheets[GAME_SESSIONS_SHEET_NAME];
    
    if (!sheet) {
      return NextResponse.json({ sessions: [] }, { status: 200 });
    }

    const sessionsArray = XLSX.utils.sheet_to_json<GameSession>(sheet);
    
    // Filter by accountId
    let filtered = sessionsArray.filter(
      s => s.accountId === parseInt(accountId, 10)
    );

    // Filter by gameType if provided
    if (gameType) {
      filtered = filtered.filter(s => s.gameType === gameType);
    }

    // Get specific session if sessionId provided
    if (sessionId) {
      const session = filtered.find(
        s => s.id === parseInt(sessionId, 10)
      );
      return NextResponse.json({ session: session || null }, { status: 200 });
    }

    // Return all sessions
    return NextResponse.json({ sessions: filtered }, { status: 200 });
  } catch (error) {
    console.error('Error reading game sessions:', error);
    return NextResponse.json(
      { error: 'Failed to read game sessions' },
      { status: 500 }
    );
  }
}

// POST: Save or update game session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      accountId, 
      gameType, 
      sessionName, 
      setup, 
      players, 
      gameHistory,
      sessionId 
    } = body;

    if (!accountId || !gameType || !sessionName) {
      return NextResponse.json(
        { error: 'accountId, gameType, and sessionName are required' },
        { status: 400 }
      );
    }

    const workbook = readExcelFile();
    
    // Ensure game_sessions sheet exists
    if (!workbook.Sheets[GAME_SESSIONS_SHEET_NAME]) {
      const gameSessionsSheet = XLSX.utils.json_to_sheet<GameSession>([]);
      XLSX.utils.book_append_sheet(workbook, gameSessionsSheet, GAME_SESSIONS_SHEET_NAME);
    }

    const sheet = workbook.Sheets[GAME_SESSIONS_SHEET_NAME];
    
    const sessionsArray = sheet
      ? XLSX.utils.sheet_to_json<GameSession>(sheet)
      : [];

    const now = new Date().toISOString();
    let savedSession: GameSession;

    if (sessionId) {
      // Update existing session
      const existingIndex = sessionsArray.findIndex(
        s => s.id === parseInt(sessionId, 10) && s.accountId === accountId
      );

      if (existingIndex >= 0) {
        sessionsArray[existingIndex] = {
          ...sessionsArray[existingIndex],
          sessionName,
          setup: JSON.stringify(setup),
          players: JSON.stringify(players),
          gameHistory: JSON.stringify(gameHistory),
          lastUpdated: now,
        };
        savedSession = sessionsArray[existingIndex];
      } else {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
    } else {
      // Create new session
      const nextId =
        sessionsArray.length > 0
          ? Math.max(...sessionsArray.map(s => s.id)) + 1
          : 1;
      
      const newSession: GameSession = {
        id: nextId,
        accountId,
        gameType,
        sessionName,
        setup: JSON.stringify(setup),
        players: JSON.stringify(players),
        gameHistory: JSON.stringify(gameHistory),
        lastUpdated: now,
        createdAt: now,
      };

      sessionsArray.push(newSession);
      savedSession = newSession;
    }

    // Update sheet
    const newSheet = XLSX.utils.json_to_sheet(sessionsArray);
    workbook.Sheets[GAME_SESSIONS_SHEET_NAME] = newSheet;
    writeExcelFile(workbook);

    return NextResponse.json({ session: savedSession }, { status: 200 });
  } catch (error) {
    console.error('Error saving game session:', error);
    return NextResponse.json(
      { error: 'Failed to save game session' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a game session
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const accountId = searchParams.get('accountId');

    if (!sessionId || !accountId) {
      return NextResponse.json(
        { error: 'sessionId and accountId are required' },
        { status: 400 }
      );
    }

    const workbook = readExcelFile();
    const sheet = workbook.Sheets[GAME_SESSIONS_SHEET_NAME];
    
    if (!sheet) {
      return NextResponse.json(
        { error: 'No sessions found' },
        { status: 404 }
      );
    }

    const sessionsArray = XLSX.utils.sheet_to_json<GameSession>(sheet);
    const filtered = sessionsArray.filter(
      s => !(s.id === parseInt(sessionId, 10) && s.accountId === parseInt(accountId, 10))
    );

    // Update sheet
    const newSheet = XLSX.utils.json_to_sheet(filtered);
    workbook.Sheets[GAME_SESSIONS_SHEET_NAME] = newSheet;
    writeExcelFile(workbook);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting game session:', error);
    return NextResponse.json(
      { error: 'Failed to delete game session' },
      { status: 500 }
    );
  }
}

