import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Message } from '@/types';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDb();
    const messagesCollection = db.collection<Message>('messages');
    const receiverMatch = ObjectId.isValid(userId)
      ? { $in: [userId, new ObjectId(userId)] }
      : userId;

    const unread = await messagesCollection.aggregate([
      {
        $match: {
          receiverId: receiverMatch,
          isRead: false
        }
      },
      {
        $group: {
          _id: '$senderId',
          count: { $sum: 1 },
          lastMessageAt: { $max: '$timestamp' }
        }
      }
    ]).toArray();

    const counts: Record<string, number> = {};
    const lastMessageAt: Record<string, string> = {};

    for (const item of unread) {
      counts[String(item._id)] = item.count;
      lastMessageAt[String(item._id)] = item.lastMessageAt?.toISOString?.() ?? '';
    }

    return NextResponse.json({ counts, lastMessageAt });
  } catch (error) {
    console.error('Get unread messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
