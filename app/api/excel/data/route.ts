import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'database.xlsx');
const DATA_SHEET_NAME = 'data';

export interface CounterData {
  id: number;
  accountId: number;
  count: number;
  lastUpdated: string;
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
    const accountSheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, accountSheet, 'account');
    
    // Create data sheet
    const dataSheet = XLSX.utils.json_to_sheet<CounterData>([]);
    XLSX.utils.book_append_sheet(workbook, dataSheet, DATA_SHEET_NAME);
    
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
  XLSX.writeFile(workbook, EXCEL_FILE_PATH);
}

// GET: Get counter data for an account
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    const workbook = readExcelFile();
    const sheet = workbook.Sheets[DATA_SHEET_NAME];
    
    if (!sheet) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    const dataArray = XLSX.utils.sheet_to_json<CounterData>(sheet);
    const data = dataArray.find(
      d => d.accountId === parseInt(accountId, 10)
    );

    return NextResponse.json({ data: data || null }, { status: 200 });
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

    const workbook = readExcelFile();
    const sheet = workbook.Sheets[DATA_SHEET_NAME];
    
    const dataArray = sheet
      ? XLSX.utils.sheet_to_json<CounterData>(sheet)
      : [];

    const now = new Date().toISOString();
    const existingIndex = dataArray.findIndex(
      d => d.accountId === accountId
    );

    if (existingIndex >= 0) {
      // Update existing
      dataArray[existingIndex] = {
        ...dataArray[existingIndex],
        count,
        lastUpdated: now,
      };
    } else {
      // Create new
      const nextId =
        dataArray.length > 0
          ? Math.max(...dataArray.map(d => d.id)) + 1
          : 1;
      dataArray.push({
        id: nextId,
        accountId,
        count,
        lastUpdated: now,
      });
    }

    // Update sheet
    const newSheet = XLSX.utils.json_to_sheet(dataArray);
    workbook.Sheets[DATA_SHEET_NAME] = newSheet;
    writeExcelFile(workbook);

    const savedData = dataArray.find(d => d.accountId === accountId)!;

    return NextResponse.json({ data: savedData }, { status: 200 });
  } catch (error) {
    console.error('Error saving counter data:', error);
    return NextResponse.json(
      { error: 'Failed to save counter data' },
      { status: 500 }
    );
  }
}

