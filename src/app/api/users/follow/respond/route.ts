import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const requesterId = body?.requesterId as string;
    const action = body?.action as 'accept' | 'decline';
    if (!requesterId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const db = await getDb();
    const usersCollection = db.collection<User>('users');

    const user = await usersCollection.findOne(
      ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } as never : { _id: userId } as never
    );
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userIdStr = String(userId);
    const requesterIdStr = String(requesterId);

    const updates: Record<string, unknown> = {};
    if (action === 'accept') {
      if (user.bioVisibility !== 'private') {
        updates.$addToSet = { followers: requesterId };
      }
      if (user.bioVisibility === 'custom' || user.bioVisibility === 'private') {
        updates.$addToSet = { ...(updates.$addToSet as Record<string, unknown>), allowedUserIds: requesterId };
      }
    }
    updates.$pull = { followRequests: requesterId };

    await usersCollection.updateOne(
      ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } as never : { _id: userId } as never,
      updates as never
    );

    if (action === 'accept') {
      await usersCollection.updateOne(
        ObjectId.isValid(requesterIdStr) ? { _id: new ObjectId(requesterIdStr) } as never : { _id: requesterIdStr } as never,
        { $addToSet: { following: userIdStr } }
      );
      const notificationsCollection = db.collection('notifications');
      await notificationsCollection.insertOne({
        userId: requesterIdStr,
        type: 'follow_accepted',
        actorId: userIdStr,
        isRead: false,
        meta: { kind: 'accepted' },
        createdAt: new Date()
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Follow respond error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
