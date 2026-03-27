import { Message, User } from '@/types';
import { CurrentUser } from '../types/chat';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchUsers(): Promise<User[]> {
  const response = await fetch('/api/users', { cache: 'no-store' });
  return parseJson<User[]>(response);
}

export async function fetchConversation(userId: string, otherUserId: string): Promise<Message[]> {
  const response = await fetch(`/api/messages?userId=${userId}&otherUserId=${otherUserId}`, {
    cache: 'no-store',
  });
  return parseJson<Message[]>(response);
}

export async function sendTextMessage(currentUser: CurrentUser, receiverId: string, content: string): Promise<Message> {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderId: currentUser.id,
      receiverId,
      content,
      type: 'text',
      senderUsername: currentUser.username,
    }),
  });

  return parseJson<Message>(response);
}
