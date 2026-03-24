import { ObjectId } from 'mongodb';

export interface User {
  _id?: string;
  username: string;
  email: string;
  password: string;
  avatar?: string;
  profileTitle?: string;
  statusMessage?: string;
  bio?: string;
  phones?: string[];
  socials?: Array<{ label: string; url: string; icon?: string }>;
  bioVisibility?: 'public' | 'followers' | 'private' | 'custom';
  followers?: string[];
  following?: string[];
  followRequests?: string[];
  allowedUserIds?: string[];
  chatLocks?: Record<string, {
    isLocked: boolean;
    passcodeHash?: string;
    updatedAt?: Date;
  }>;
  isOnline: boolean;
  isTyping?: boolean;
  activity?: 'typing' | 'recording' | 'editing' | 'in_call' | 'away' | null;
  activityUpdatedAt?: Date;
  status?: 'online' | 'idle' | 'offline';
  lastSeen?: Date;
  createdAt: Date;
}

export interface Message {
  _id?: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'file' | 'video-note';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  files?: Array<{
    url: string;
    name: string;
    size?: number;
    type?: string;
  }>;
  callId?: string;
  isRead: boolean;
  readAt?: Date;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
  replyTo?: {
    messageId: string;
    content: string;
    senderUsername: string;
  };
  reactions?: MessageReaction[];
  isDeleted?: boolean;
  deletedAt?: Date;
  editedAt?: Date;
  editHistory?: Array<{
    content: string;
    editedAt: Date;
  }>;
  transcript?: string;
  expiresAt?: Date;
  forwardedFrom?: {
    userId: string;
    username: string;
  };
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  username: string;
}

export interface Group {
  _id?: ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  createdBy: ObjectId;
  members: ObjectId[];
  admins: ObjectId[];
  createdAt: Date;
}

export interface GroupMessage {
  _id?: string;
  groupId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'file';
  isRead: boolean;
  readBy: string[];
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
  replyTo?: {
    messageId: string;
    content: string;
    senderUsername: string;
  };
  reactions?: MessageReaction[];
  isDeleted?: boolean;
}

export interface Story {
  _id?: string;
  userId: string;
  text?: string;
  mediaUrl?: string;
  style?: {
    background?: string;
    textColor?: string;
    fontFamily?: string;
  };
  reactions?: Array<{
    emoji: string;
    userId: string;
    username: string;
  }>;
  createdAt: Date;
  expiresAt: Date;
  viewedBy?: string[];
}

export interface TypingIndicator {
  userId: string;
  username: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface Notification {
  _id?: string;
  userId: string;
  type: 'message' | 'call' | 'group_invite' | 'reaction';
  title: string;
  body: string;
  isRead: boolean;
  timestamp: Date;
}

export interface Call {
  _id?: ObjectId;
  callerId: string;
  receiverId: string;
  type: 'audio' | 'video';
  status: 'initiated' | 'accepted' | 'rejected' | 'ended';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  logMessageId?: ObjectId | string;
  logMessageAt?: Date;
  createdAt: Date;
}

export interface CreateCallRequest {
  callerId: string;
  receiverId: string;
  type: 'audio' | 'video';
}

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  callId: string;
  senderId: string;
  receiverId: string;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  timestamp: Date;
}
