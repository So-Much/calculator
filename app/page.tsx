'use client';

import { useState, useEffect } from 'react';
import LoginForm from '@/components/LoginForm';
import GameMenu from '@/components/GameMenu';

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

  return <GameMenu accountId={accountId} onLogout={handleLogout} />;
}
