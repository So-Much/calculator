import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/google-sheets';

// GET: Test Google Sheets connection
export async function GET() {
  try {
    console.log('[TEST] Starting Google Sheets connection test...');
    
    // Test getting the account sheet
    const sheet = await getSheet('account');
    
    console.log('[TEST] Successfully connected to Google Sheets');
    console.log('[TEST] Sheet title:', sheet.title);
    console.log('[TEST] Sheet rowCount:', sheet.rowCount);
    
    return NextResponse.json({
      success: true,
      message: 'Google Sheets connection successful',
      sheetTitle: sheet.title,
      rowCount: sheet.rowCount,
    }, { status: 200 });
  } catch (error) {
    console.error('[TEST] Google Sheets connection test failed:', error);
    if (error instanceof Error) {
      console.error('[TEST] Error message:', error.message);
      console.error('[TEST] Error stack:', error.stack);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      error: 'Google Sheets connection failed',
      details: errorMessage,
    }, { status: 500 });
  }
}

