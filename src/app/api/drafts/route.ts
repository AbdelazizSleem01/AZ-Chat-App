import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

type DraftDoc = {
  userId: string;
  peerId: string;
  content: string;
  updatedAt: Date;
};

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const peerId = searchParams.get('peerId');

    const client = await clientPromise;
    const db = client.db();
    const draftsCollection = db.collection<DraftDoc>('drafts');

    if (peerId) {
      const draft = await draftsCollection.findOne({ userId, peerId });
      return NextResponse.json({ draft });
    }

    const drafts = await draftsCollection.find({ userId }).toArray();
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('Get drafts error:', error);
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const body = await request.json();
    const peerId = typeof body?.peerId === 'string' ? body.peerId : '';
    const content = typeof body?.content === 'string' ? body.content : '';

    if (!peerId) {
      return NextResponse.json({ error: 'Missing peerId' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const draftsCollection = db.collection<DraftDoc>('drafts');

    if (!content.trim()) {
      await draftsCollection.deleteOne({ userId, peerId });
      return NextResponse.json({ ok: true });
    }

    await draftsCollection.updateOne(
      { userId, peerId },
      { $set: { userId, peerId, content, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Save draft error:', error);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}

