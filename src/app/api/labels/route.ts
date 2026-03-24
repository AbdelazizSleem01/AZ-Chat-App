import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

type LabelsDoc = {
  userId: string;
  labels: Array<{ id: string; name: string; color: string }>;
  userLabels: Record<string, string[]>;
  updatedAt: Date;
};

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const db = await getDb();
    const labelsCollection = db.collection<LabelsDoc>('labels');
    const doc = await labelsCollection.findOne({ userId });

    if (!doc) {
      return NextResponse.json({ labels: [], userLabels: {} });
    }

    return NextResponse.json({
      labels: doc.labels || [],
      userLabels: doc.userLabels || {}
    });
  } catch (error) {
    console.error('Get labels error:', error);
    return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const body = await request.json();
    const labels = Array.isArray(body?.labels) ? body.labels : [];
    const userLabels = typeof body?.userLabels === 'object' && body.userLabels ? body.userLabels : {};

    const db = await getDb();
    const labelsCollection = db.collection<LabelsDoc>('labels');

    await labelsCollection.updateOne(
      { userId },
      { $set: { userId, labels, userLabels, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Save labels error:', error);
    return NextResponse.json({ error: 'Failed to save labels' }, { status: 500 });
  }
}
