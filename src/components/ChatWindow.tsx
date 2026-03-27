'use client';

import MessageComposer from '@/features/chat/components/MessageComposer';
import MessageList from '@/features/chat/components/MessageList';
import { Message } from '@/types';

type ChatWindowProps = {
  messages: Message[];
  currentUserId?: string;
  isLoading?: boolean;
  isSending?: boolean;
  onSendMessage?: (content: string) => Promise<void>;
};

export default function ChatWindow({
  messages,
  currentUserId,
  isLoading = false,
  isSending = false,
  onSendMessage,
}: ChatWindowProps) {
  const handleSubmit = onSendMessage || (async () => {});

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <MessageList messages={messages} currentUserId={currentUserId} loading={isLoading} />
      <MessageComposer onSubmit={handleSubmit} sending={isSending} />
    </section>
  );
}
