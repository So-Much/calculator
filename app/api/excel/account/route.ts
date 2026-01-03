import { NextRequest, NextResponse } from 'next/server';
import { getSheetRows, addSheetRow, setSheetHeaders } from '@/lib/google-sheets';

const ACCOUNT_SHEET_NAME = 'account';

export interface Account {
  id: number;
  username: string;
  password: string;
}

// GET: Get account by username and password, or get all accounts
export async function GET(request: NextRequest) {
  try {
    console.log('[API] GET /api/excel/account - Request received');
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const password = searchParams.get('password');

    if (username && password) {
      console.log(`[API] Finding account for username: ${username}`);
      // Find specific account
      const accounts = await getSheetRows<Account>(ACCOUNT_SHEET_NAME);
      console.log(`[API] Found ${accounts.length} accounts`);
      const account = accounts.find(
        a => a.username === username && a.password === password
      );

      if (account) {
        console.log(`[API] Account found for username: ${username}`);
      } else {
        console.log(`[API] Account not found for username: ${username}`);
      }

      return NextResponse.json({ account: account || null }, { status: 200 });
    } else {
      console.log('[API] Getting all accounts');
      // Get all accounts
      const accounts = await getSheetRows<Account>(ACCOUNT_SHEET_NAME);
      console.log(`[API] Returning ${accounts.length} accounts`);
      return NextResponse.json({ accounts }, { status: 200 });
    }
  } catch (error) {
    console.error('[API] Error reading accounts:', error);
    if (error instanceof Error) {
      console.error('[API] Error message:', error.message);
      console.error('[API] Error stack:', error.stack);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to read accounts', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST: Create new account
export async function POST(request: NextRequest) {
  try {
    console.log('[API] POST /api/excel/account - Request received');
    const body = await request.json();
    const { username, password } = body;

    console.log(`[API] Creating account for username: ${username}`);

    if (!username || !password) {
      console.log('[API] Validation failed: username and password are required');
      return NextResponse.json(
        { error: 'username and password are required' },
        { status: 400 }
      );
    }

    // Check if account already exists
    console.log('[API] Checking if account already exists...');
    const accounts = await getSheetRows<Account>(ACCOUNT_SHEET_NAME);
    console.log(`[API] Current accounts count: ${accounts.length}`);
    
    const existingAccount = accounts.find(
      a => a.username === username && a.password === password
    );

    if (existingAccount) {
      console.log(`[API] Account already exists for username: ${username}, returning existing account`);
      return NextResponse.json({ account: existingAccount }, { status: 200 });
    }

    // Create new account
    const nextId = accounts.length > 0 
      ? Math.max(...accounts.map(a => a.id)) + 1 
      : 1;

    console.log(`[API] Creating new account with ID: ${nextId}`);

    const newAccount: Account = {
      id: nextId,
      username,
      password,
    };

    // Initialize headers if sheet is new
    if (accounts.length === 0) {
      console.log('[API] Sheet is empty, setting headers first...');
      await setSheetHeaders(ACCOUNT_SHEET_NAME, ['id', 'username', 'password']);
      console.log('[API] Headers set successfully');
    }

    console.log('[API] Adding new account row...');
    await addSheetRow(ACCOUNT_SHEET_NAME, newAccount);
    console.log('[API] Account created successfully');

    return NextResponse.json({ account: newAccount }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating account:', error);
    if (error instanceof Error) {
      console.error('[API] Error message:', error.message);
      console.error('[API] Error stack:', error.stack);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error details:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create account', details: errorMessage },
      { status: 500 }
    );
  }
}
