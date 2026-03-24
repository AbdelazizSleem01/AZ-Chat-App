import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Message } from '@/types';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const messagesCollection = db.collection<Message>('messages');
    const receiverMatch = ObjectId.isValid(userId)
      ? { $in: [userId, new ObjectId(userId)] }
      : userId;

    const unread = await messagesCollection.aggregate([
      { $match: { receiverId: receiverMatch, isRead: false } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$senderId',
          count: { $sum: 1 },
          message: { $first: '$$ROOT' }
        }
      },
      {
        $project: {
          senderId: '$_id',
          count: 1,
          message: 1,
          _id: 0
        }
      }
    ]).toArray();

    const counts: Record<string, number> = {};
    const items = unread.map((item) => {
      counts[String(item.senderId)] = item.count;
      return { senderId: String(item.senderId), message: item.message };
    });

    return NextResponse.json({ counts, items });
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
