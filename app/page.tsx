'use client';

import { useState, useEffect } from 'react';
import LoginForm from '@/components/LoginForm';
import Counter from '@/components/Counter';

export default function Home() {
  const [accountId, setAccountId] = useState<number | null>(null);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedAccountId = localStorage.getItem('accountId');
    if (savedAccountId) {
      setAccountId(parseInt(savedAccountId, 10));
    }
  }, []);

  const handleLogin = (id: number) => {
    setAccountId(id);
    localStorage.setItem('accountId', id.toString());
  };

  const handleLogout = () => {
    setAccountId(null);
    localStorage.removeItem('accountId');
  };

  if (accountId === null) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return <Counter accountId={accountId} onLogout={handleLogout} />;
}
