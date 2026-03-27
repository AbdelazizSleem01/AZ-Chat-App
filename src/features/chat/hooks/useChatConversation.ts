'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { fetchConversation, sendTextMessage } from '../services/chatApi';
import { useChatStore } from '../store/chatStore';

export function useChatConversation() {
  const currentUser = useChatStore((state) => state.currentUser);
  const selectedUserId = useChatStore((state) => state.selectedUserId);
  const messagesByPeer = useChatStore((state) => state.messagesByPeer);
  const messagesLoading = useChatStore((state) => state.messagesLoading);
  const sending = useChatStore((state) => state.sending);
  const setMessagesForPeer = useChatStore((state) => state.setMessagesForPeer);
  const appendMessageForPeer = useChatStore((state) => state.appendMessageForPeer);
  const setMessagesLoading = useChatStore((state) => state.setMessagesLoading);
  const setSending = useChatStore((state) => state.setSending);
  const setError = useChatStore((state) => state.setError);

  const messages = useMemo(() => {
    if (!selectedUserId) {
      return [];
    }
    return messagesByPeer[selectedUserId] || [];
  }, [messagesByPeer, selectedUserId]);

  const loadConversation = useCallback(async () => {
    if (!currentUser?.id || !selectedUserId) {
      return;
    }

    setMessagesLoading(true);
    setError(null);

    try {
      const nextMessages = await fetchConversation(currentUser.id, selectedUserId);
      setMessagesForPeer(selectedUserId, nextMessages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load messages';
      setError(message);
    } finally {
      setMessagesLoading(false);
    }
  }, [currentUser?.id, selectedUserId, setError, setMessagesForPeer, setMessagesLoading]);

  const submitMessage = useCallback(
    async (content: string) => {
      if (!currentUser || !selectedUserId || !content.trim()) {
        return;
      }

      setSending(true);
      setError(null);

      try {
        const message = await sendTextMessage(currentUser, selectedUserId, content.trim());
        appendMessageForPeer(selectedUserId, message);
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Failed to send message';
        setError(text);
      } finally {
        setSending(false);
      }
    },
    [appendMessageForPeer, currentUser, selectedUserId, setError, setSending],
  );

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    const interval = window.setInterval(() => {
      loadConversation();
    }, 6000);

    return () => window.clearInterval(interval);
  }, [selectedUserId, loadConversation]);

  return { messages, messagesLoading, sending, submitMessage, reloadConversation: loadConversation };
}
