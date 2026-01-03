import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1hPkAlkmDIUUzTisBxPijxHKh_aIvACyn6nUqmOPro3o';

console.log('[Google Sheets] SPREADSHEET_ID:', SPREADSHEET_ID);
console.log('[Google Sheets] GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'NOT SET');
console.log('[Google Sheets] GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? `SET (length: ${process.env.GOOGLE_PRIVATE_KEY.length})` : 'NOT SET');

// Initialize auth
function getAuth() {
  console.log('[Google Sheets] Initializing authentication...');
  
  // Option 1: Use environment variables
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    console.log('[Google Sheets] Using environment variables for auth');
    console.log('[Google Sheets] Service Account Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log('[Google Sheets] Private Key length:', process.env.GOOGLE_PRIVATE_KEY?.length || 0);
    
    return new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  // Option 2: Use JSON file (for development)
  console.log('[Google Sheets] Environment variables not found, trying JSON file...');
  const possiblePaths = [
    path.join(process.cwd(), 'data', 'google-credentials.json'),
    path.join(process.cwd(), 'data', 'hi-garment-synch-data-a60452bc4e37.json'),
  ];
  
  for (const credentialsPath of possiblePaths) {
    if (fs.existsSync(credentialsPath)) {
      console.log('[Google Sheets] Found credentials file:', credentialsPath);
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    }
  }

  console.error('[Google Sheets] No credentials found!');
  throw new Error('Google Sheets credentials not found. Please set environment variables or place google-credentials.json in data folder.');
}

// Get or create sheet by name
export async function getSheet(sheetName: string) {
  try {
    console.log(`[Google Sheets] Getting sheet: "${sheetName}"`);
    console.log(`[Google Sheets] Spreadsheet ID: ${SPREADSHEET_ID}`);
    
    const auth = getAuth();
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    
    console.log(`[Google Sheets] Loading spreadsheet info...`);
    await doc.loadInfo();
    console.log(`[Google Sheets] Spreadsheet loaded: "${doc.title}"`);
    
    let sheet = doc.sheetsByTitle[sheetName];
    
    if (!sheet) {
      console.log(`[Google Sheets] Sheet "${sheetName}" not found, creating new sheet...`);
      sheet = await doc.addSheet({ title: sheetName });
      console.log(`[Google Sheets] Sheet "${sheetName}" created successfully`);
    } else {
      console.log(`[Google Sheets] Sheet "${sheetName}" found, rowCount: ${sheet.rowCount}`);
    }
    
    return sheet;
  } catch (error) {
    console.error(`[Google Sheets] Error getting sheet "${sheetName}":`, error);
    if (error instanceof Error) {
      console.error(`[Google Sheets] Error message: ${error.message}`);
      console.error(`[Google Sheets] Error stack: ${error.stack}`);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to access Google Sheet: ${errorMessage}`);
  }
}

// Get all rows from a sheet
export async function getSheetRows<T extends Record<string, any> = Record<string, any>>(sheetName: string): Promise<T[]> {
  try {
    console.log(`[Google Sheets] Getting rows from sheet: "${sheetName}"`);
    const sheet = await getSheet(sheetName);
    
    // Check if sheet has any data rows first
    if (sheet.rowCount === 0) {
      console.log(`[Google Sheets] Sheet "${sheetName}" is empty (rowCount = 0)`);
      return [];
    }
    
    console.log(`[Google Sheets] Sheet "${sheetName}" has ${sheet.rowCount} rows, loading headers...`);
    
    // Try to load header row
    try {
      await sheet.loadHeaderRow();
      console.log(`[Google Sheets] Headers loaded:`, sheet.headerValues);
    } catch (error) {
      // Sheet exists but has no headers yet, return empty array
      console.log(`[Google Sheets] Sheet "${sheetName}" has no headers yet`);
      return [];
    }
  
    const rows = await sheet.getRows();
    console.log(`[Google Sheets] Retrieved ${rows.length} data rows from sheet "${sheetName}"`);
    
    if (rows.length === 0) {
      return [];
    }
    
    const result = rows.map(row => {
      const data = row.toObject() as Record<string, any>;
      // Convert string numbers to numbers where appropriate
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (typeof value === 'string' && /^\d+$/.test(value)) {
          // Check if it's a numeric ID field
          if (key === 'id' || key.endsWith('Id')) {
            data[key] = parseInt(value, 10);
          }
        }
      });
      return data as T;
    });
    
    console.log(`[Google Sheets] Successfully parsed ${result.length} rows from sheet "${sheetName}"`);
    return result;
  } catch (error) {
    console.error(`[Google Sheets] Error getting rows from sheet "${sheetName}":`, error);
    throw error;
  }
}

// Add row to a sheet
export async function addSheetRow<T extends Record<string, any> = Record<string, any>>(sheetName: string, data: Partial<T>): Promise<void> {
  try {
    console.log(`[Google Sheets] Adding row to sheet: "${sheetName}"`);
    console.log(`[Google Sheets] Row data:`, JSON.stringify(data, null, 2));
    
    const sheet = await getSheet(sheetName);
    
    // Ensure headers are loaded before adding row
    try {
      await sheet.loadHeaderRow();
      console.log(`[Google Sheets] Headers loaded:`, sheet.headerValues);
    } catch (error) {
      // If headers don't exist, we can't add rows - this should have been set earlier
      console.error(`[Google Sheets] Sheet "${sheetName}" has no headers!`);
      throw new Error(`Sheet "${sheetName}" has no headers. Call setSheetHeaders first.`);
    }
    
    console.log(`[Google Sheets] Adding row...`);
    await sheet.addRow(data as Record<string, any>);
    console.log(`[Google Sheets] Row added successfully to sheet "${sheetName}"`);
  } catch (error) {
    console.error(`[Google Sheets] Error adding row to sheet "${sheetName}":`, error);
    if (error instanceof Error) {
      console.error(`[Google Sheets] Error message: ${error.message}`);
      console.error(`[Google Sheets] Error stack: ${error.stack}`);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to add row to sheet "${sheetName}": ${errorMessage}`);
  }
}

// Update row in a sheet by index
export async function updateSheetRow<T extends Record<string, any> = Record<string, any>>(sheetName: string, rowIndex: number, data: Partial<T>): Promise<void> {
  const sheet = await getSheet(sheetName);
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  
  if (rowIndex >= 0 && rowIndex < rows.length) {
    const row = rows[rowIndex];
    Object.keys(data).forEach(key => {
      row.set(key, (data as any)[key]);
    });
    await row.save();
  }
}

// Delete row from a sheet
export async function deleteSheetRow(sheetName: string, rowIndex: number): Promise<void> {
  const sheet = await getSheet(sheetName);
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  
  if (rowIndex >= 0 && rowIndex < rows.length) {
    await rows[rowIndex].delete();
  }
}

// Find row by field value
export async function findSheetRow<T extends Record<string, any> = Record<string, any>>(
  sheetName: string,
  field: string,
  value: any
): Promise<T | null> {
  const rows = await getSheetRows<T>(sheetName);
  return rows.find(row => row[field] === value) || null;
}

// Find row index by field value
export async function findSheetRowIndex(
  sheetName: string,
  field: string,
  value: any
): Promise<number> {
  const rows = await getSheetRows(sheetName);
  return rows.findIndex(row => row[field] === value);
}

// Update row by ID field
export async function updateSheetRowById<T extends Record<string, any> = Record<string, any>>(
  sheetName: string, 
  idField: string,
  idValue: any,
  data: Partial<T>
): Promise<void> {
  const sheet = await getSheet(sheetName);
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  
  const row = rows.find(r => (r.get(idField) as any) === idValue);
  if (row) {
    Object.keys(data).forEach(key => {
      row.set(key, (data as any)[key]);
    });
    await row.save();
  }
}

// Delete row by ID field
export async function deleteSheetRowById(sheetName: string, idField: string, idValue: any): Promise<void> {
  const sheet = await getSheet(sheetName);
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  
  const row = rows.find(r => (r.get(idField) as any) === idValue);
  if (row) {
    await row.delete();
  }
}

// Set header row for a sheet (use when creating new sheet)
export async function setSheetHeaders(sheetName: string, headers: string[]): Promise<void> {
  try {
    console.log(`[Google Sheets] Setting headers for sheet: "${sheetName}"`);
    console.log(`[Google Sheets] Headers:`, headers);
    
    const sheet = await getSheet(sheetName);
    await sheet.setHeaderRow(headers);
    
    console.log(`[Google Sheets] Headers set successfully for sheet "${sheetName}"`);
  } catch (error) {
    console.error(`[Google Sheets] Error setting headers for sheet "${sheetName}":`, error);
    if (error instanceof Error) {
      console.error(`[Google Sheets] Error message: ${error.message}`);
      console.error(`[Google Sheets] Error stack: ${error.stack}`);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to set headers for sheet "${sheetName}": ${errorMessage}`);
  }
}

