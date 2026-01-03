// Client-side utilities for interacting with Excel/Google Sheets API
// Falls back to localStorage if API is not available

import { Account, CounterData } from './storage-utils';

const API_BASE = '/api/excel';

// Helper to check if API is available
async function isApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/account`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

// Account functions
export async function getAccounts(): Promise<Account[]> {
  try {
    const response = await fetch(`${API_BASE}/account`);
    if (response.ok) {
      const data = await response.json();
      return data.accounts || [];
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('calculator_accounts');
    return data ? JSON.parse(data) : [];
  }
  return [];
}

export async function findAccount(username: string, password: string): Promise<Account | null> {
  try {
    const response = await fetch(
      `${API_BASE}/account?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    );
    if (response.ok) {
      const data = await response.json();
      return data.account || null;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const accounts = await getAccounts();
    return accounts.find(a => a.username === username && a.password === password) || null;
  }
  return null;
}

export async function addAccount(username: string, password: string): Promise<Account> {
  try {
    const response = await fetch(`${API_BASE}/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.account;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const accounts = await getAccounts();
    const nextId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;
    const newAccount: Account = {
      id: nextId,
      username,
      password,
    };
    accounts.push(newAccount);
    localStorage.setItem('calculator_accounts', JSON.stringify(accounts));
    return newAccount;
  }
  
  throw new Error('Unable to add account');
}

export async function getOrCreateAccount(username: string, password: string): Promise<Account> {
  try {
    // Try to find existing account
    const findResponse = await fetch(
      `${API_BASE}/account?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
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

    if (createResponse.ok) {
      const { account } = await createResponse.json();
      return account;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const existing = await findAccount(username, password);
    if (existing) {
      return existing;
    }
    return await addAccount(username, password);
  }
  
  throw new Error('Unable to get or create account');
}

// Counter data functions
export async function getCounterData(accountId: number): Promise<CounterData | null> {
  try {
    const response = await fetch(`${API_BASE}/data?accountId=${accountId}`);
    if (response.ok) {
      const data = await response.json();
      return data.data || null;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('calculator_data');
    const allData: CounterData[] = data ? JSON.parse(data) : [];
    return allData.find(d => d.accountId === accountId) || null;
  }
  return null;
}

export async function saveCounterData(accountId: number, count: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId, count }),
    });
    if (response.ok) {
      return;
    }
  } catch (error) {
    console.warn('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('calculator_data');
    const allData: CounterData[] = data ? JSON.parse(data) : [];
    const index = allData.findIndex(d => d.accountId === accountId);
    const now = new Date().toISOString();
    
    if (index >= 0) {
      allData[index] = { ...allData[index], count, lastUpdated: now };
    } else {
      const nextId = allData.length > 0 ? Math.max(...allData.map(d => d.id)) + 1 : 1;
      allData.push({ id: nextId, accountId, count, lastUpdated: now });
    }
    
    localStorage.setItem('calculator_data', JSON.stringify(allData));
  }
}

export async function downloadExcelFile(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/download`);
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'database.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}
