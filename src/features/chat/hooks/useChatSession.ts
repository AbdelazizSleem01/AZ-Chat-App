'use client';

import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { CurrentUser } from '../types/chat';

export function useChatSession() {
  const currentUser = useChatStore((state) => state.currentUser);
  const setCurrentUser = useChatStore((state) => state.setCurrentUser);

  useEffect(() => {
    const raw = localStorage.getItem('currentUser');
    if (!raw) {
      setCurrentUser(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as CurrentUser;
      if (!parsed.id || !parsed.username || !parsed.email) {
        setCurrentUser(null);
        return;
      }
      setCurrentUser(parsed);
    } catch {
      setCurrentUser(null);
    }
  }, [setCurrentUser]);

  return currentUser;
}
