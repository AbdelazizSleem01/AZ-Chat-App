'use client';

import { Message } from '@/types';

type MessageListProps = {
  messages: Message[];
  currentUserId?: string;
  loading: boolean;
};

export default function MessageList({ messages, currentUserId, loading }: MessageListProps) {
  if (loading) {
    return <div className="flex-1 px-6 py-4 text-sm text-gray-400">جاري تحميل الرسائل...</div>;
  }

  if (messages.length === 0) {
    return <div className="flex-1 px-6 py-4 text-sm text-gray-400">ابدأ المحادثة بإرسال رسالة جديدة.</div>;
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
      {messages.map((message) => {
        const mine = message.senderId === currentUserId;
        return (
          <div key={message._id || `${message.senderId}-${String(message.timestamp)}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-100'}`}>
              {message.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
