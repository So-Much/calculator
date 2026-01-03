import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'database.xlsx');
const ACCOUNT_SHEET_NAME = 'account';

export interface Account {
  id: number;
  username: string;
  password: string;
}

// Helper function to read Excel file
function readExcelFile() {
  // Ensure data directory exists
  const dataDir = path.dirname(EXCEL_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    // Create new file if doesn't exist
    const workbook = XLSX.utils.book_new();
    const accountSheet = XLSX.utils.json_to_sheet<Account>([]);
    XLSX.utils.book_append_sheet(workbook, accountSheet, ACCOUNT_SHEET_NAME);
    
    // Create data sheet
    const dataSheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'data');
    
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    return workbook;
  }
  
  try {
    // Try to read file using buffer approach (more reliable)
    const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
    return XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (error) {
    console.error('Error reading Excel file:', error);
    // If read fails, try XLSX.readFile as fallback
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
    // Ensure data directory exists
    const dataDir = path.dirname(EXCEL_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write to buffer first, then write to file (more reliable)
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(EXCEL_FILE_PATH, buffer);
  } catch (error) {
    console.error('Error writing Excel file:', error);
    // Fallback to XLSX.writeFile
    try {
      XLSX.writeFile(workbook, EXCEL_FILE_PATH);
    } catch (fallbackError) {
      console.error('Fallback write also failed:', fallbackError);
      throw new Error(`Cannot save file ${EXCEL_FILE_PATH}. Make sure the file is not open in another application.`);
    }
  }
}

// GET: Get all accounts or find account
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    const password = searchParams.get('password');

    const workbook = readExcelFile();
    const sheet = workbook.Sheets[ACCOUNT_SHEET_NAME];
    
    if (!sheet) {
      return NextResponse.json({ accounts: [] }, { status: 200 });
    }

    const accounts = XLSX.utils.sheet_to_json<Account>(sheet);

    // If username and password provided, find specific account
    if (username && password) {
      const account = accounts.find(
        acc => acc.username === username && acc.password === password
      );
      return NextResponse.json({ account: account || null }, { status: 200 });
    }

    return NextResponse.json({ accounts }, { status: 200 });
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
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const workbook = readExcelFile();
    const sheet = workbook.Sheets[ACCOUNT_SHEET_NAME];
    
    const accounts = sheet
      ? XLSX.utils.sheet_to_json<Account>(sheet)
      : [];

    // Check if account already exists
    const existing = accounts.find(
      acc => acc.username === username && acc.password === password
    );
    
    if (existing) {
      return NextResponse.json({ account: existing }, { status: 200 });
    }

    // Find next ID
    const nextId =
      accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;

    const newAccount: Account = {
      id: nextId,
      username,
      password,
    };

    accounts.push(newAccount);

    // Update sheet
    const newSheet = XLSX.utils.json_to_sheet(accounts);
    workbook.Sheets[ACCOUNT_SHEET_NAME] = newSheet;
    writeExcelFile(workbook);

    return NextResponse.json({ account: newAccount }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

