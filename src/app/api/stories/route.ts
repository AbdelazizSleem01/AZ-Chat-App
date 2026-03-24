import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Story, User } from '@/types';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const viewerId = request.headers.get('x-user-id');
    if (!viewerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const storiesCollection = db.collection<Story>('stories');
    const usersCollection = db.collection<User>('users');
    const now = new Date();

    const stories = await storiesCollection
      .find({ expiresAt: { $gt: now } } as never)
      .sort({ createdAt: -1 })
      .toArray();

    const userIds = Array.from(new Set(stories.map(s => String(s.userId))));
    const userIdQuery = userIds.flatMap(id => (ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id]));
    const users = await usersCollection
      .find({ _id: { $in: userIdQuery } } as never, {
        projection: { _id: 1, username: 1, avatar: 1, statusMessage: 1 }
      })
      .toArray();

    const usersById = users.reduce<Record<string, User>>((acc, user) => {
      acc[String(user._id)] = { ...user, _id: String(user._id) };
      return acc;
    }, {});

    const grouped = userIds.map((id) => {
      const userStories = stories.filter(s => String(s.userId) === id);
      const hasUnseen = userStories.some(s => !(s.viewedBy || []).includes(viewerId));
      return {
        userId: id,
        user: usersById[id],
        hasUnseen,
        stories: userStories.map(s => ({
          ...s,
          _id: String(s._id),
          userId: String(s.userId)
        }))
      };
    });

    return NextResponse.json({ stories: grouped });
  } catch (error) {
    console.error('Get stories error:', error);
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const mediaUrl = typeof body?.mediaUrl === 'string' ? body.mediaUrl.trim() : '';
    const style = typeof body?.style === 'object' && body.style ? {
      background: typeof body.style.background === 'string' ? body.style.background : undefined,
      textColor: typeof body.style.textColor === 'string' ? body.style.textColor : undefined,
      fontFamily: typeof body.style.fontFamily === 'string' ? body.style.fontFamily : undefined
    } : undefined;

    if (!text && !mediaUrl) {
      return NextResponse.json({ error: 'Story content required' }, { status: 400 });
    }

    const now = new Date();
    const story: Story = {
      userId,
      text,
      mediaUrl,
      style,
      createdAt: now,
      expiresAt: new Date(now.getTime() + STORY_TTL_MS),
      viewedBy: []
    };

    const db = await getDb();
    const storiesCollection = db.collection<Story>('stories');
    const result = await storiesCollection.insertOne(story as never);

    return NextResponse.json({
      story: { ...story, _id: String(result.insertedId) }
    });
  } catch (error) {
    console.error('Create story error:', error);
    return NextResponse.json({ error: 'Failed to create story' }, { status: 500 });
  }
}



