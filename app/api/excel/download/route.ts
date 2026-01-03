import { NextResponse } from 'next/server';
import { getSheetRows } from '@/lib/google-sheets';
import * as XLSX from 'xlsx';

// GET: Download all data as Excel file
export async function GET() {
  try {
    const workbook = XLSX.utils.book_new();

    // Get all sheets
    try {
      const accounts = await getSheetRows('account');
      if (accounts.length > 0) {
        const accountSheet = XLSX.utils.json_to_sheet(accounts);
        XLSX.utils.book_append_sheet(workbook, accountSheet, 'account');
      }
    } catch (error) {
      console.error('Error reading account sheet:', error);
    }

    try {
      const dataRows = await getSheetRows('data');
      if (dataRows.length > 0) {
        const dataSheet = XLSX.utils.json_to_sheet(dataRows);
        XLSX.utils.book_append_sheet(workbook, dataSheet, 'data');
      }
    } catch (error) {
      console.error('Error reading data sheet:', error);
    }

    try {
      const gameSessions = await getSheetRows('game_sessions');
      if (gameSessions.length > 0) {
        const gameSessionsSheet = XLSX.utils.json_to_sheet(gameSessions);
        XLSX.utils.book_append_sheet(workbook, gameSessionsSheet, 'game_sessions');
      }
    } catch (error) {
      console.error('Error reading game_sessions sheet:', error);
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="database.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
