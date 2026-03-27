import { create } from 'zustand';
import { Message } from '@/types';
import { CurrentUser, MessageMap, UserWithId } from '../types/chat';

type ChatState = {
  currentUser: CurrentUser | null;
  users: UserWithId[];
  selectedUserId: string | null;
  messagesByPeer: MessageMap;
  usersLoading: boolean;
  messagesLoading: boolean;
  sending: boolean;
  error: string | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  setUsers: (users: UserWithId[]) => void;
  setSelectedUserId: (userId: string | null) => void;
  setMessagesForPeer: (peerId: string, messages: Message[]) => void;
  appendMessageForPeer: (peerId: string, message: Message) => void;
  setUsersLoading: (value: boolean) => void;
  setMessagesLoading: (value: boolean) => void;
  setSending: (value: boolean) => void;
  setError: (value: string | null) => void;
  resetChatState: () => void;
};

const initialState = {
  currentUser: null,
  users: [],
  selectedUserId: null,
  messagesByPeer: {},
  usersLoading: false,
  messagesLoading: false,
  sending: false,
  error: null,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  setCurrentUser: (currentUser) => set({ currentUser }),
  setUsers: (users) => set({ users }),
  setSelectedUserId: (selectedUserId) => set({ selectedUserId }),
  setMessagesForPeer: (peerId, messages) =>
    set((state) => ({
      messagesByPeer: {
        ...state.messagesByPeer,
        [peerId]: messages,
      },
    })),
  appendMessageForPeer: (peerId, message) =>
    set((state) => ({
      messagesByPeer: {
        ...state.messagesByPeer,
        [peerId]: [...(state.messagesByPeer[peerId] || []), message],
      },
    })),
  setUsersLoading: (usersLoading) => set({ usersLoading }),
  setMessagesLoading: (messagesLoading) => set({ messagesLoading }),
  setSending: (sending) => set({ sending }),
  setError: (error) => set({ error }),
  resetChatState: () => set(initialState),
}));
