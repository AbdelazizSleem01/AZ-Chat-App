import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Story } from '@/types';

const getStoryIdQuery = (storyId: string) =>
  ObjectId.isValid(storyId)
    ? { _id: new ObjectId(storyId) }
    : { _id: storyId };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { storyId } = await params;

    const db = await getDb();
    const storiesCollection = db.collection<Story>('stories');
    await storiesCollection.updateOne(
      getStoryIdQuery(storyId) as never,
      { $addToSet: { viewedBy: userId } }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Update story view error:', error);
    return NextResponse.json({ error: 'Failed to update story' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { storyId } = await params;

    const db = await getDb();
    const storiesCollection = db.collection<Story>('stories');
    const story = await storiesCollection.findOne(getStoryIdQuery(storyId) as never);
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }
    if (String(story.userId) !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await storiesCollection.deleteOne(getStoryIdQuery(storyId) as never);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete story error:', error);
    return NextResponse.json({ error: 'Failed to delete story' }, { status: 500 });
  }
}
