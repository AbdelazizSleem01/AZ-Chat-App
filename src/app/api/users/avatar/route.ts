import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId: bodyUserId, avatar } = body;
    const headerUserId = request.headers.get('x-user-id');
    const userId = headerUserId || bodyUserId;

    if (!userId || !avatar) {
      return NextResponse.json(
        { error: 'User ID and avatar are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { avatar } }
    );

    return NextResponse.json({ success: true, avatar });
  } catch (error) {
    console.error('Error updating avatar:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
