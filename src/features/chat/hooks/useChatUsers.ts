'use client';

import { useCallback, useEffect } from 'react';
import { fetchUsers } from '../services/chatApi';
import { useChatStore } from '../store/chatStore';
import { UserWithId } from '../types/chat';

function toUsersWithId(users: UserWithId[]): UserWithId[] {
  return users.filter((user): user is UserWithId => Boolean(user._id));
}

export function useChatUsers(currentUserId?: string) {
  const users = useChatStore((state) => state.users);
  const selectedUserId = useChatStore((state) => state.selectedUserId);
  const usersLoading = useChatStore((state) => state.usersLoading);
  const setUsers = useChatStore((state) => state.setUsers);
  const setUsersLoading = useChatStore((state) => state.setUsersLoading);
  const setSelectedUserId = useChatStore((state) => state.setSelectedUserId);
  const setError = useChatStore((state) => state.setError);

  const loadUsers = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    setUsersLoading(true);
    setError(null);

    try {
      const allUsers = await fetchUsers(currentUserId);
      const normalized = toUsersWithId(allUsers as UserWithId[]).filter((user) => user._id !== currentUserId);
      setUsers(normalized);

      if (!selectedUserId && normalized.length > 0) {
        setSelectedUserId(normalized[0]._id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load users';
      setError(message);
    } finally {
      setUsersLoading(false);
    }
  }, [currentUserId, selectedUserId, setError, setSelectedUserId, setUsers, setUsersLoading]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return { users, selectedUserId, usersLoading, loadUsers, setSelectedUserId };
}
