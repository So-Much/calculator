'use client';

import { useState, useEffect } from 'react';
import { getCounterData, saveCounterData, downloadExcelFile } from '@/lib/excel-utils';

interface CounterProps {
  accountId: number;
  onLogout: () => void;
}

export default function Counter({ accountId, onLogout }: CounterProps) {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load existing counter data
    const loadData = async () => {
      try {
        const data = await getCounterData(accountId);
        if (data) {
          setCount(data.count);
        }
      } catch (error) {
        console.error('Error loading counter data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [accountId]);

  const handleIncrement = async () => {
    const newCount = count + 1;
    setCount(newCount);
    try {
      await saveCounterData(accountId, newCount);
    } catch (error) {
      console.error('Error saving counter data:', error);
    }
  };

  const handleDecrement = async () => {
    const newCount = Math.max(0, count - 1);
    setCount(newCount);
    try {
      await saveCounterData(accountId, newCount);
    } catch (error) {
      console.error('Error saving counter data:', error);
    }
  };

  const handleReset = async () => {
    setCount(0);
    try {
      await saveCounterData(accountId, 0);
    } catch (error) {
      console.error('Error saving counter data:', error);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadExcelFile();
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-xl border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700/60 p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              Bộ Đếm
            </h1>
            <button
              onClick={onLogout}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition-colors duration-200 cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>

          {/* Counter Display */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-block rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-12 shadow-lg">
              <div className="text-6xl font-bold text-white">{count}</div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={handleDecrement}
                className="py-4 px-6 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-50 font-semibold rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                −
              </button>
              <button
                onClick={handleReset}
                className="py-4 px-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                Reset
              </button>
              <button
                onClick={handleIncrement}
                className="py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                +
              </button>
            </div>

            <button
              onClick={handleDownload}
              className="w-full py-3 px-4 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Tải xuống Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


