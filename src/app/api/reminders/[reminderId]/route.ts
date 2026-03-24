import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ reminderId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const { reminderId } = await params;
    if (!reminderId) {
      return NextResponse.json({ error: 'Invalid reminder id' }, { status: 400 });
    }

    const db = await getDb();
    const remindersCollection = db.collection('reminders');

    const query = ObjectId.isValid(reminderId)
      ? { _id: new ObjectId(reminderId) }
      : { _id: reminderId };
    await remindersCollection.deleteOne({ ...query, userId } as any);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 });
  }
}



