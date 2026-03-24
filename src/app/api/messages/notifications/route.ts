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

    const items = await messagesCollection.aggregate([
      { $match: { receiverId: receiverMatch, isRead: false } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$senderId',
          message: { $first: '$$ROOT' }
        }
      },
      {
        $project: {
          senderId: '$_id',
          message: 1,
          _id: 0
        }
      }
    ]).toArray();

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
