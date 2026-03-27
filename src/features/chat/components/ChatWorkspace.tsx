'use client';

import { useMemo } from 'react';
import ChatHeader from './ChatHeader';
import MessageComposer from './MessageComposer';
import MessageList from './MessageList';
import UserSidebar from './UserSidebar';
import { useChatConversation } from '../hooks/useChatConversation';
import { useChatSession } from '../hooks/useChatSession';
import { useChatUsers } from '../hooks/useChatUsers';
import { useChatStore } from '../store/chatStore';

export default function ChatWorkspace() {
  const currentUser = useChatSession();
  const error = useChatStore((state) => state.error);
  const { users, selectedUserId, usersLoading, setSelectedUserId } = useChatUsers(currentUser?.id);
  const { messages, messagesLoading, sending, submitMessage } = useChatConversation();

  const selectedUser = useMemo(() => users.find((user) => user._id === selectedUserId) || null, [users, selectedUserId]);

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <UserSidebar users={users} selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} loading={usersLoading} />
      <section className="flex min-w-0 flex-1 flex-col">
        <ChatHeader selectedUser={selectedUser} />
        {error ? <div className="px-6 py-2 text-sm text-red-400">{error}</div> : null}
        <MessageList messages={messages} currentUserId={currentUser?.id} loading={messagesLoading} />
        <MessageComposer onSubmit={submitMessage} sending={sending} disabled={!selectedUserId} />
      </section>
    </div>
  );
}
