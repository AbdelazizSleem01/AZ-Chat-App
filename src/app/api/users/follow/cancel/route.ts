import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const viewerId = request.headers.get('x-user-id');
    if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const targetId = body?.targetUserId as string;
    if (!targetId) return NextResponse.json({ error: 'Missing target' }, { status: 400 });

    const db = await getDb();
    const usersCollection = db.collection<User>('users');

    await usersCollection.updateOne(
      ObjectId.isValid(targetId) ? { _id: new ObjectId(targetId) } as never : { _id: targetId } as never,
      { $pull: { followRequests: String(viewerId) } }
    );

    const notificationsCollection = db.collection('notifications');
    await notificationsCollection.deleteMany({
      userId: String(targetId),
      actorId: String(viewerId),
      type: 'follow_request',
      isRead: false
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Follow cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
