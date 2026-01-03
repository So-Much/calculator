const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
const excelFile = path.join(dataDir, 'database.xlsx');

// Create data directory if it doesn't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create workbook
const workbook = XLSX.utils.book_new();

// Create account sheet with headers
const accountData = [
  { id: 1, username: 'admin', password: 'admin123' } // Example account
];
const accountSheet = XLSX.utils.json_to_sheet(accountData);
XLSX.utils.book_append_sheet(workbook, accountSheet, 'account');

// Create data sheet with headers (empty for now)
const dataSheet = XLSX.utils.json_to_sheet([]);
XLSX.utils.book_append_sheet(workbook, dataSheet, 'data');

// Create game_sessions sheet with headers (empty for now)
const gameSessionsSheet = XLSX.utils.json_to_sheet([]);
XLSX.utils.book_append_sheet(workbook, gameSessionsSheet, 'game_sessions');

// Write file
XLSX.writeFile(workbook, excelFile);
console.log(`Excel file created at: ${excelFile}`);

