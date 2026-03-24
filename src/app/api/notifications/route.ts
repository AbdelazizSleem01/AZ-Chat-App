import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const notificationsCollection = db.collection('notifications');

    const userMatch = ObjectId.isValid(userId)
      ? { $in: [userId, new ObjectId(userId)] }
      : userId;

    const items = await notificationsCollection
      .find({ userId: userMatch, isRead: false })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    const mapped = items.map(item => ({
      ...item,
      _id: String(item._id),
      userId: String(item.userId),
      actorId: String(item.actorId),
      meta: item.meta || null
    }));
    return NextResponse.json({ items: mapped });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0) return NextResponse.json({ ok: true });

    const db = await getDb();
    const notificationsCollection = db.collection('notifications');

    const objectIds = ids.filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id));
    await notificationsCollection.updateMany(
      { _id: { $in: objectIds } },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Update notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
