'use client';

import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { CurrentUser } from '../types/chat';

type PersistedUser = Partial<CurrentUser> & { _id?: string };


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
      const parsed = JSON.parse(raw) as PersistedUser;
      const id = parsed.id || parsed._id;
      if (!id || !parsed.username || !parsed.email) {
        setCurrentUser(null);
        return;
      }
      setCurrentUser({
        id,
        username: parsed.username,
        email: parsed.email,
        avatar: parsed.avatar,
        statusMessage: parsed.statusMessage,
      });
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
