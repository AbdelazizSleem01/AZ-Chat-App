import { Message, User } from '@/types';

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  statusMessage?: string;
};

export type UserWithId = User & { _id: string };

export type MessageDraft = {
  content: string;
};

export type MessageMap = Record<string, Message[]>;
