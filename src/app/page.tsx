'use client';

import { useState, useEffect } from 'react';
import AuthPage from '@/components/AuthPage';
import ChatApp from '@/components/ChatApp';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    setIsAuthenticated(!!(token && user));
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) {
    return null; 
  }

  return (
    <main className="min-h-screen bg-gray-900">
      {!isAuthenticated ? (
        <AuthPage onAuthSuccess={() => setIsAuthenticated(true)} />
      ) : (
        <ChatApp />
      )}
    </main>
  );
}
