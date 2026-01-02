// Client-side utilities for Excel operations via API routes

const API_BASE = '/api/excel';

export interface Account {
  id: number;
  username: string;
  password: string;
}

export interface CounterData {
  id: number;
  accountId: number;
  count: number;
  lastUpdated: string;
}

// Get or create account (returns existing or creates new)
export async function getOrCreateAccount(
  username: string,
  password: string
): Promise<Account> {
  try {
    // Try to find existing account first
    const findResponse = await fetch(
      `${API_BASE}/account?username=${encodeURIComponent(
        username
      )}&password=${encodeURIComponent(password)}`
    );

    if (findResponse.ok) {
      const { account } = await findResponse.json();
      if (account) {
        return account;
      }
    }

    // Account doesn't exist, create new one
    const createResponse = await fetch(`${API_BASE}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create account');
    }

    const { account } = await createResponse.json();
    return account;
  } catch (error) {
    console.error('Error in getOrCreateAccount:', error);
    throw error;
  }
}

// Find account by username and password
export async function findAccount(
  username: string,
  password: string
): Promise<Account | null> {
  try {
    const response = await fetch(
      `${API_BASE}/account?username=${encodeURIComponent(
        username
      )}&password=${encodeURIComponent(password)}`
    );

    if (!response.ok) {
      return null;
    }

    const { account } = await response.json();
    return account || null;
  } catch (error) {
    console.error('Error finding account:', error);
    return null;
  }
}

// Get all accounts
export async function getAccounts(): Promise<Account[]> {
  try {
    const response = await fetch(`${API_BASE}/account`);

    if (!response.ok) {
      return [];
    }

    const { accounts } = await response.json();
    return accounts || [];
  } catch (error) {
    console.error('Error getting accounts:', error);
    return [];
  }
}

// Get counter data for an account
export async function getCounterData(
  accountId: number
): Promise<CounterData | null> {
  try {
    const response = await fetch(`${API_BASE}/data?accountId=${accountId}`);

    if (!response.ok) {
      return null;
    }

    const { data } = await response.json();
    return data || null;
  } catch (error) {
    console.error('Error getting counter data:', error);
    return null;
  }
}

// Save counter data
export async function saveCounterData(
  accountId: number,
  count: number
): Promise<CounterData> {
  try {
    const response = await fetch(`${API_BASE}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId, count }),
    });

    if (!response.ok) {
      throw new Error('Failed to save counter data');
    }

    const { data } = await response.json();
    return data;
  } catch (error) {
    console.error('Error saving counter data:', error);
    throw error;
  }
}

// Download Excel file
export async function downloadExcelFile(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/download`);
    if (!response.ok) {
      throw new Error('Failed to download file');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'database.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading Excel file:', error);
    throw error;
  }
}
