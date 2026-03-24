import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Story, User } from '@/types';

const getStoryQuery = (storyId: string) =>
  ObjectId.isValid(storyId) ? { _id: new ObjectId(storyId) } : { _id: storyId };

const getUserQuery = (userId: string) =>
  ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { _id: userId };

export async function POST(request: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { storyId } = await params;
    const body = await request.json();
    const emoji = typeof body?.emoji === 'string' ? body.emoji.trim() : '';
    if (!emoji) {
      return NextResponse.json({ error: 'Emoji required' }, { status: 400 });
    }

    const db = await getDb();
    const storiesCollection = db.collection<Story>('stories');
    const usersCollection = db.collection<User>('users');
    const notificationsCollection = db.collection('notifications');

    const story = await storiesCollection.findOne(getStoryQuery(storyId) as never);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const user = await usersCollection.findOne(getUserQuery(userId) as never);
    const username = user?.username || 'User';

    await storiesCollection.updateOne(
      getStoryQuery(storyId) as never,
      {
        $pull: { reactions: { userId } },
      } as never
    );
    await storiesCollection.updateOne(
      getStoryQuery(storyId) as never,
      {
        $addToSet: { reactions: { emoji, userId, username } }
      } as never
    );

    const ownerId = String(story.userId);
    if (ownerId && ownerId !== userId) {
      await notificationsCollection.insertOne({
        userId: ownerId,
        actorId: userId,
        type: 'story_reaction',
        meta: { storyId: String(storyId), emoji },
        isRead: false,
        createdAt: new Date()
      });
    }

    return NextResponse.json({ ok: true, emoji });
  } catch (error) {
    console.error('Story reaction error:', error);
    return NextResponse.json({ error: 'Failed to react' }, { status: 500 });
  }
}
