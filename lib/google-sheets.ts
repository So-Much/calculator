import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1hPkAlkmDIUUzTisBxPijxHKh_aIvACyn6nUqmOPro3o';

// Initialize auth
function getAuth() {
  // Option 1: Use environment variables
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  // Option 2: Use JSON file (for development)
  // Try multiple possible filenames
  const possiblePaths = [
    path.join(process.cwd(), 'data', 'google-credentials.json'),
    path.join(process.cwd(), 'data', 'hi-garment-synch-data-a60452bc4e37.json'),
  ];
  
  for (const credentialsPath of possiblePaths) {
    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
      return new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    }
  }

  throw new Error('Google Sheets credentials not found. Please set environment variables or place google-credentials.json in data folder.');
}

// Get or create sheet by name
export async function getSheet(sheetName: string) {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  
  await doc.loadInfo();
  
  let sheet = doc.sheetsByTitle[sheetName];
  
  if (!sheet) {
    // Create sheet if it doesn't exist
    sheet = await doc.addSheet({ title: sheetName, headerValues: [] });
  }
  
  return sheet;
}

// Get all rows from a sheet
export async function getSheetRows<T extends Record<string, any> = Record<string, any>>(sheetName: string): Promise<T[]> {
  const sheet = await getSheet(sheetName);
  
  // Check if sheet has any data rows first
  if (sheet.rowCount === 0) {
    return [];
  }
  
  // Try to load header row
  try {
    await sheet.loadHeaderRow();
  } catch (error) {
    // Sheet exists but has no headers yet, return empty array
    return [];
  }
  
  const rows = await sheet.getRows();
  if (rows.length === 0) {
    return [];
  }
  
  return rows.map(row => {
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
}

// Add row to a sheet
export async function addSheetRow<T extends Record<string, any> = Record<string, any>>(sheetName: string, data: Partial<T>): Promise<void> {
  const sheet = await getSheet(sheetName);
  
  // Ensure headers are loaded before adding row
  try {
    await sheet.loadHeaderRow();
  } catch (error) {
    // If headers don't exist, we can't add rows - this should have been set earlier
    throw new Error(`Sheet "${sheetName}" has no headers. Call setSheetHeaders first.`);
  }
  
  await sheet.addRow(data as Record<string, any>);
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
  const sheet = await getSheet(sheetName);
  await sheet.setHeaderRow(headers);
}

