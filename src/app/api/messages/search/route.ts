import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Message, User } from '@/types';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const filter = searchParams.get('filter') || 'all';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const db = await getDb();
    const messagesCollection = db.collection<Message>('messages');
    const usersCollection = db.collection<User>('users');

    const regex = new RegExp(query, 'i');

    const userIdMatch = ObjectId.isValid(userId)
      ? { $in: [userId, new ObjectId(userId)] }
      : userId;

    const baseMatch: Record<string, unknown> = {
      $or: [{ senderId: userIdMatch }, { receiverId: userIdMatch }]
    };

    if (filter === 'messages') {
      baseMatch.type = { $in: ['text', 'audio'] };
    } else if (filter === 'files') {
      baseMatch.type = 'file';
    } else if (filter === 'images') {
      baseMatch.type = 'image';
    }

    const messages = await messagesCollection
      .find({
        ...baseMatch,
        $or: [{ content: regex }, { fileName: regex }, { transcript: regex }]
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    const otherIds = Array.from(
      new Set(
        messages.map(msg => (String(msg.senderId) === userId ? msg.receiverId : msg.senderId))
      )
    );

    const otherIdValues = otherIds.map(id => String(id));
    const otherIdMatch = otherIdValues
      .flatMap(id => (ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id]));

    const users = await usersCollection
      .find(
        { _id: { $in: otherIdMatch } } as any,
        { projection: { _id: 1, username: 1, email: 1, avatar: 1, isOnline: 1 } }
      )
      .toArray();

    const userMap = new Map(users.map(user => [String(user._id), user]));

    const results = messages.map(message => {
      const otherUserId = String(message.senderId) === userId ? message.receiverId : message.senderId;
      const rawUser = userMap.get(String(otherUserId));
      const otherUser = rawUser ? { ...rawUser, _id: String(rawUser._id) } : {
        _id: String(otherUserId),
        username: 'Unknown',
        email: '',
        password: '',
        isOnline: false,
        createdAt: new Date()
      };
      return { message, otherUser };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
