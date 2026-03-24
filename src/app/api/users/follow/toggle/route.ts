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
    const action = body?.action as 'follow' | 'unfollow';
    if (!targetId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const db = await getDb();
    const usersCollection = db.collection<User>('users');

    if (action === 'follow') {
      await usersCollection.updateOne(
        ObjectId.isValid(targetId) ? { _id: new ObjectId(targetId) } as never : { _id: targetId } as never,
        { $addToSet: { followers: viewerId } }
      );
      await usersCollection.updateOne(
        ObjectId.isValid(viewerId) ? { _id: new ObjectId(viewerId) } as never : { _id: viewerId } as never,
        { $addToSet: { following: targetId } }
      );
      const notificationsCollection = db.collection('notifications');
      await notificationsCollection.insertOne({
        userId: String(targetId),
        type: 'follow_request',
        actorId: String(viewerId),
        isRead: false,
        meta: { kind: 'followed' },
        createdAt: new Date()
      });
    } else {
      await usersCollection.updateOne(
        ObjectId.isValid(targetId) ? { _id: new ObjectId(targetId) } as never : { _id: targetId } as never,
        { $pull: { followers: viewerId } }
      );
      await usersCollection.updateOne(
        ObjectId.isValid(viewerId) ? { _id: new ObjectId(viewerId) } as never : { _id: viewerId } as never,
        { $pull: { following: targetId } }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Follow toggle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
