import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const ACCOUNT_SHEET_NAME = 'account';

export interface Account {
  id: number;
  username: string;
  password: string;
}

// Check if Google Sheets credentials are available
async function hasGoogleSheetsCredentials(): Promise<boolean> {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      return true;
    }
    
    // Check for JSON file
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
async function getAccountsFromGoogleSheets(): Promise<Account[]> {
  const { getSheetRows } = await import('@/lib/google-sheets');
  return await getSheetRows<Account>(ACCOUNT_SHEET_NAME);
}

async function addAccountToGoogleSheets(account: Account): Promise<void> {
  const { getSheetRows, addSheetRow, setSheetHeaders } = await import('@/lib/google-sheets');
  const accounts = await getSheetRows<Account>(ACCOUNT_SHEET_NAME);
  
  if (accounts.length === 0) {
    await setSheetHeaders(ACCOUNT_SHEET_NAME, ['id', 'username', 'password']);
  }
  
  await addSheetRow(ACCOUNT_SHEET_NAME, account);
}

// Use file-based storage (Excel-like fallback)
async function getAccountsFromFile(): Promise<Account[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'database.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[ACCOUNT_SHEET_NAME];
    
    if (!sheet) {
      return [];
    }
    
    return XLSX.utils.sheet_to_json<Account>(sheet);
  } catch {
    return [];
  }
}

async function addAccountToFile(account: Account): Promise<void> {
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
      const accountSheet = XLSX.utils.json_to_sheet<Account>([]);
      XLSX.utils.book_append_sheet(workbook, accountSheet, ACCOUNT_SHEET_NAME);
    }
    
    const sheet = workbook.Sheets[ACCOUNT_SHEET_NAME];
    const accounts = sheet ? XLSX.utils.sheet_to_json<Account>(sheet) : [];
    
    accounts.push(account);
    
    const newSheet = XLSX.utils.json_to_sheet(accounts);
    workbook.Sheets[ACCOUNT_SHEET_NAME] = newSheet;
    XLSX.writeFile(workbook, filePath);
  } catch (error) {
    console.error('Error saving to file:', error);
    throw error;
  }
}

// GET: Get account by username and password, or get all accounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const password = searchParams.get('password');

    const hasSheets = await hasGoogleSheetsCredentials();
    let accounts: Account[] = [];

    try {
      if (hasSheets) {
        accounts = await getAccountsFromGoogleSheets();
      } else {
        accounts = await getAccountsFromFile();
      }
    } catch (error) {
      // If Google Sheets fails, fallback to file
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        accounts = await getAccountsFromFile();
      }
    }

    if (username && password) {
      const account = accounts.find(
        a => a.username === username && a.password === password
      );
      return NextResponse.json({ account: account || null }, { status: 200 });
    } else {
      return NextResponse.json({ accounts }, { status: 200 });
    }
  } catch (error) {
    console.error('Error reading accounts:', error);
    return NextResponse.json(
      { error: 'Failed to read accounts' },
      { status: 500 }
    );
  }
}

// POST: Create new account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'username and password are required' },
        { status: 400 }
      );
    }

    const hasSheets = await hasGoogleSheetsCredentials();
    let accounts: Account[] = [];

    try {
      if (hasSheets) {
        accounts = await getAccountsFromGoogleSheets();
      } else {
        accounts = await getAccountsFromFile();
      }
    } catch {
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        accounts = await getAccountsFromFile();
      }
    }

    const existingAccount = accounts.find(
      a => a.username === username && a.password === password
    );

    if (existingAccount) {
      return NextResponse.json({ account: existingAccount }, { status: 200 });
    }

    const nextId = accounts.length > 0 
      ? Math.max(...accounts.map(a => a.id)) + 1 
      : 1;

    const newAccount: Account = {
      id: nextId,
      username,
      password,
    };

    try {
      if (hasSheets) {
        await addAccountToGoogleSheets(newAccount);
      } else {
        await addAccountToFile(newAccount);
      }
    } catch {
      if (hasSheets) {
        console.warn('Google Sheets failed, falling back to file storage');
        await addAccountToFile(newAccount);
      } else {
        throw new Error('Failed to save account');
      }
    }

    return NextResponse.json({ account: newAccount }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
