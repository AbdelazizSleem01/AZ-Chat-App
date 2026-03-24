import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { receiverId, content, type = 'text', scheduledAt, meta } = body;
    if (!receiverId || !content || !scheduledAt) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const db = await getDb();
    const scheduledCollection = db.collection('scheduled_messages');
    await scheduledCollection.insertOne({
      senderId: userId,
      receiverId,
      content,
      type,
      meta: meta || {},
      scheduledAt: new Date(scheduledAt),
      createdAt: new Date()
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Schedule message error:', error);
    return NextResponse.json({ error: 'Failed to schedule' }, { status: 500 });
  }
}

