import { Message, User } from '@/types';
import { CurrentUser } from '../types/chat';

type ApiEnvelope<T> = {
  error?: string;
} & T;

function authHeaders(userId: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(json?.error || `Request failed: ${response.status}`);
  }
  return json;
}

export async function fetchUsers(currentUserId: string): Promise<User[]> {
  const response = await fetch('/api/users', {
    cache: 'no-store',
    headers: authHeaders(currentUserId),
  });
  const payload = await parseJson<ApiEnvelope<{ users: User[] }>>(response);
  return payload.users || [];
}

export async function fetchConversation(currentUserId: string, otherUserId: string): Promise<Message[]> {
  const response = await fetch(`/api/messages?otherUserId=${otherUserId}`, {
    cache: 'no-store',
    headers: authHeaders(currentUserId),
  });
  const payload = await parseJson<ApiEnvelope<{ messages: Message[] }>>(response);
  return payload.messages || [];
}

export async function sendTextMessage(currentUser: CurrentUser, receiverId: string, content: string): Promise<Message> {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: authHeaders(currentUser.id),
    body: JSON.stringify({
      receiverId,
      content,
      type: 'text',
    }),
  });

  const payload = await parseJson<ApiEnvelope<{ message: Message }>>(response);
  return payload.message;
}
