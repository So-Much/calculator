import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'database.xlsx');

// GET: Download Excel file
export async function GET() {
  try {
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="database.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error downloading Excel file:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}

