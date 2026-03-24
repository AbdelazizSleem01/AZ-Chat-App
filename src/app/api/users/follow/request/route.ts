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
    const target = await usersCollection.findOne(
      ObjectId.isValid(targetId) ? { _id: new ObjectId(targetId) } as never : { _id: targetId } as never
    );
    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }
    const viewerIdStr = String(viewerId);
    const targetIdStr = String(target._id);

    const isPublic = (target.bioVisibility || 'public') === 'public';
    if (isPublic) {
      await usersCollection.updateOne(
        ObjectId.isValid(targetIdStr) ? { _id: new ObjectId(targetIdStr) } as never : { _id: targetIdStr } as never,
        { $addToSet: { followers: viewerIdStr } }
      );
      await usersCollection.updateOne(
        ObjectId.isValid(viewerIdStr) ? { _id: new ObjectId(viewerIdStr) } as never : { _id: viewerIdStr } as never,
        { $addToSet: { following: targetIdStr } }
      );
      const notificationsCollection = db.collection('notifications');
      await notificationsCollection.insertOne({
        userId: viewerIdStr,
        type: 'follow_accepted',
        actorId: targetIdStr,
        isRead: false,
        createdAt: new Date()
      });
      return NextResponse.json({ ok: true, followed: true });
    }

    await usersCollection.updateOne(
      ObjectId.isValid(targetIdStr) ? { _id: new ObjectId(targetIdStr) } as never : { _id: targetIdStr } as never,
      { $addToSet: { followRequests: viewerIdStr } }
    );
    const notificationsCollection = db.collection('notifications');
    await notificationsCollection.insertOne({
      userId: targetIdStr,
      type: 'follow_request',
      actorId: viewerIdStr,
      isRead: false,
      meta: { kind: 'requested' },
      createdAt: new Date()
    });

    return NextResponse.json({ ok: true, requested: true });
  } catch (error) {
    console.error('Follow request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
