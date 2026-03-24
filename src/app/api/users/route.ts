import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { User } from '@/types';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection<User>('users');

    const userIdMatch = ObjectId.isValid(userId)
      ? [userId, new ObjectId(userId)]
      : [userId];

    // Get all users except the current user
    const users = await usersCollection
      .find(
        { _id: { $nin: userIdMatch } } as any,
        {
          projection: {
            _id: 1,
            username: 1,
            email: 1,
            avatar: 1,
            statusMessage: 1,
            isOnline: 1,
            lastSeen: 1,
            createdAt: 1,
            followers: 1,
            following: 1
          }
        }
      )
      .toArray();
    const now = Date.now();
    const onlineStaleMs = 2 * 60 * 1000;
    const withCounts = users.map(user => {
      const lastSeenMs = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
      const isRecentlyActive = lastSeenMs > 0 && now - lastSeenMs <= onlineStaleMs;
      return {
        ...user,
        _id: String(user._id),
        isOnline: Boolean(user.isOnline) && isRecentlyActive,
        followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
        followingCount: Array.isArray(user.following) ? user.following.length : 0
      };
    });

    return NextResponse.json({ users: withCounts });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isOnline } = body;

    const db = await getDb();
    const usersCollection = db.collection<User>('users');

    const updateData: Partial<User> = {
      lastSeen: new Date()
    };

    if (typeof isOnline === 'boolean') {
      updateData.isOnline = isOnline;
    }

    const userIdMatch = ObjectId.isValid(userId)
      ? [new ObjectId(userId), userId]
      : [userId];

    await usersCollection.updateOne(
      { _id: { $in: userIdMatch } } as any,
      { $set: updateData }
    );

    return NextResponse.json({ message: 'Status updated' });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
