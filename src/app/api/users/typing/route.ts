import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, isTyping, activity } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const userMatch = ObjectId.isValid(userId)
      ? { $in: [userId, new ObjectId(userId)] }
      : userId;

    const updateData: Record<string, unknown> = {
      isTyping: Boolean(isTyping),
      activity: typeof activity === 'string' && activity.length > 0 ? activity : null,
      activityUpdatedAt: new Date(),
      lastSeen: new Date()
    };

    await usersCollection.updateOne(
      { _id: userMatch as any },
      { $set: updateData }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating typing status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const userMatch = ObjectId.isValid(userId)
      ? { $in: [userId, new ObjectId(userId)] }
      : userId;

    const user = await usersCollection.findOne(
      { _id: userMatch as any },
      { projection: { isTyping: 1, lastSeen: 1, activity: 1, activityUpdatedAt: 1 } }
    );

    return NextResponse.json({
      isTyping: user?.isTyping || false,
      lastSeen: user?.lastSeen,
      activity: user?.activity || null,
      activityUpdatedAt: user?.activityUpdatedAt
    });
  } catch (error) {
    console.error('Error fetching typing status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
