import { NextRequest, NextResponse } from 'next/server';
import { getSheetRows, addSheetRow, updateSheetRowById, setSheetHeaders } from '@/lib/google-sheets';

const DATA_SHEET_NAME = 'data';

export interface CounterData {
  id: number;
  accountId: number;
  count: number;
  lastUpdated: string;
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

    const dataArray = await getSheetRows<CounterData>(DATA_SHEET_NAME);
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

    const dataArray = await getSheetRows<CounterData>(DATA_SHEET_NAME);

    // Initialize headers if sheet is new
    if (dataArray.length === 0) {
      await setSheetHeaders(DATA_SHEET_NAME, ['id', 'accountId', 'count', 'lastUpdated']);
    }

    const now = new Date().toISOString();
    const existingData = dataArray.find(
      d => d.accountId === parseInt(accountId, 10)
    );

    if (existingData) {
      // Update existing
      await updateSheetRowById(DATA_SHEET_NAME, 'accountId', parseInt(accountId, 10), {
        count: parseInt(count, 10),
        lastUpdated: now,
      });
      
      const updatedDataArray = await getSheetRows<CounterData>(DATA_SHEET_NAME);
      const updatedData = updatedDataArray.find(
        d => d.accountId === parseInt(accountId, 10)
      );
      return NextResponse.json({ data: updatedData || null }, { status: 200 });
    } else {
      // Create new
      const nextId = dataArray.length > 0
        ? Math.max(...dataArray.map(d => d.id)) + 1
        : 1;
      
      const newData: CounterData = {
        id: nextId,
        accountId: parseInt(accountId, 10),
        count: parseInt(count, 10),
        lastUpdated: now,
      };

      await addSheetRow(DATA_SHEET_NAME, newData);
      return NextResponse.json({ data: newData }, { status: 201 });
    }
  } catch (error) {
    console.error('Error saving counter data:', error);
    return NextResponse.json(
      { error: 'Failed to save counter data' },
      { status: 500 }
    );
  }
}
