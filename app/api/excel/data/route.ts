import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const DATA_SHEET_NAME = 'data';

export interface CounterData {
  id: number;
  accountId: number;
  count: number;
  lastUpdated: string;
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
async function getDataFromGoogleSheets(accountId: number): Promise<CounterData | null> {
  const { getSheetRows } = await import('@/lib/google-sheets');
  const dataArray = await getSheetRows<CounterData>(DATA_SHEET_NAME);
  return dataArray.find(d => d.accountId === accountId) || null;
}

async function saveDataToGoogleSheets(data: CounterData): Promise<void> {
  const { getSheetRows, addSheetRow, updateSheetRowById, setSheetHeaders } = await import('@/lib/google-sheets');
  const dataArray = await getSheetRows<CounterData>(DATA_SHEET_NAME);
  
  if (dataArray.length === 0) {
    await setSheetHeaders(DATA_SHEET_NAME, ['id', 'accountId', 'count', 'lastUpdated']);
  }
  
  const existing = dataArray.find(d => d.accountId === data.accountId);
  if (existing) {
    await updateSheetRowById(DATA_SHEET_NAME, 'accountId', data.accountId, {
      count: data.count,
      lastUpdated: data.lastUpdated,
    });
  } else {
    await addSheetRow(DATA_SHEET_NAME, data);
  }
}

// Use file-based storage
async function getDataFromFile(accountId: number): Promise<CounterData | null> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'database.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[DATA_SHEET_NAME];
    
    if (!sheet) {
      return null;
    }
    
    const dataArray = XLSX.utils.sheet_to_json<CounterData>(sheet);
    return dataArray.find(d => d.accountId === accountId) || null;
  } catch {
    return null;
  }
}

async function saveDataToFile(data: CounterData): Promise<void> {
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
      const dataSheet = XLSX.utils.json_to_sheet<CounterData>([]);
      XLSX.utils.book_append_sheet(workbook, dataSheet, DATA_SHEET_NAME);
    }
    
    const sheet = workbook.Sheets[DATA_SHEET_NAME];
    const dataArray = sheet ? XLSX.utils.sheet_to_json<CounterData>(sheet) : [];
    
    const index = dataArray.findIndex(d => d.accountId === data.accountId);
    if (index >= 0) {
      dataArray[index] = data;
    } else {
      dataArray.push(data);
    }
    
    const newSheet = XLSX.utils.json_to_sheet(dataArray);
    workbook.Sheets[DATA_SHEET_NAME] = newSheet;
    XLSX.writeFile(workbook, filePath);
  } catch (error) {
    console.error('Error saving to file:', error);
    throw error;
  }
}

// GET: Get counter data for an account
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    const hasSheets = await hasGoogleSheetsCredentials();
    let data: CounterData | null = null;

    try {
      if (hasSheets) {
        data = await getDataFromGoogleSheets(parseInt(accountId, 10));
      } else {
        data = await getDataFromFile(parseInt(accountId, 10));
      }
    } catch (error) {
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        data = await getDataFromFile(parseInt(accountId, 10));
      }
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Error reading counter data:', error);
    return NextResponse.json(
      { error: 'Failed to read counter data' },
      { status: 500 }
    );
  }
}

// POST: Save counter data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, count } = body;

    if (accountId === undefined || count === undefined) {
      return NextResponse.json(
        { error: 'accountId and count are required' },
        { status: 400 }
      );
    }

    const hasSheets = await hasGoogleSheetsCredentials();
    let existingData: CounterData | null = null;

    try {
      if (hasSheets) {
        existingData = await getDataFromGoogleSheets(parseInt(accountId, 10));
      } else {
        existingData = await getDataFromFile(parseInt(accountId, 10));
      }
    } catch (error) {
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        existingData = await getDataFromFile(parseInt(accountId, 10));
      }
    }

    const now = new Date().toISOString();
    let savedData: CounterData;

    if (existingData) {
      savedData = {
        ...existingData,
        count: parseInt(count, 10),
        lastUpdated: now,
      };
    } else {
      savedData = {
        id: 1,
        accountId: parseInt(accountId, 10),
        count: parseInt(count, 10),
        lastUpdated: now,
      };
    }

    try {
      if (hasSheets) {
        await saveDataToGoogleSheets(savedData);
      } else {
        await saveDataToFile(savedData);
      }
    } catch (error) {
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        await saveDataToFile(savedData);
      } else {
        throw error;
      }
    }

    return NextResponse.json({ data: savedData }, { status: existingData ? 200 : 201 });
  } catch (error) {
    console.error('Error saving counter data:', error);
    return NextResponse.json(
      { error: 'Failed to save counter data' },
      { status: 500 }
    );
  }
}
