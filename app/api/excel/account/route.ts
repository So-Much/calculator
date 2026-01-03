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
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const password = searchParams.get('password');

    if (username && password) {
      // Find specific account
      const accounts = await getSheetRows<Account>(ACCOUNT_SHEET_NAME);
      const account = accounts.find(
        a => a.username === username && a.password === password
      );

      return NextResponse.json({ account: account || null }, { status: 200 });
    } else {
      // Get all accounts
      const accounts = await getSheetRows<Account>(ACCOUNT_SHEET_NAME);
      return NextResponse.json({ accounts }, { status: 200 });
    }
  } catch (error) {
    console.error('Error reading accounts:', error);
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
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'username and password are required' },
        { status: 400 }
      );
    }

    // Check if account already exists
    const accounts = await getSheetRows<Account>(ACCOUNT_SHEET_NAME);
    const existingAccount = accounts.find(
      a => a.username === username && a.password === password
    );

    if (existingAccount) {
      return NextResponse.json({ account: existingAccount }, { status: 200 });
    }

    // Create new account
    const nextId = accounts.length > 0 
      ? Math.max(...accounts.map(a => a.id)) + 1 
      : 1;

    const newAccount: Account = {
      id: nextId,
      username,
      password,
    };

    // Initialize headers if sheet is new
    if (accounts.length === 0) {
      await setSheetHeaders(ACCOUNT_SHEET_NAME, ['id', 'username', 'password']);
    }

    await addSheetRow(ACCOUNT_SHEET_NAME, newAccount);

    return NextResponse.json({ account: newAccount }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create account', details: errorMessage },
      { status: 500 }
    );
  }
}
