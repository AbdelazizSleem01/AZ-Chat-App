import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

type ReminderDoc = {
  userId: string;
  messageId: string;
  content: string;
  remindAt: number;
  createdAt: Date;
};

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const db = await getDb();
    const remindersCollection = db.collection<ReminderDoc>('reminders');

    const reminders = await remindersCollection
      .find({ userId })
      .sort({ remindAt: 1 })
      .toArray();

    const mapped = reminders.map(reminder => ({
      id: String(reminder._id),
      messageId: reminder.messageId,
      content: reminder.content,
      remindAt: reminder.remindAt
    }));

    return NextResponse.json({ reminders: mapped });
  } catch (error) {
    console.error('Get reminders error:', error);
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const body = await request.json();
    const messageId = typeof body?.messageId === 'string' ? body.messageId : '';
    const content = typeof body?.content === 'string' ? body.content : '';
    const remindAt = typeof body?.remindAt === 'number' ? body.remindAt : 0;

    if (!messageId || !content || !remindAt) {
      return NextResponse.json({ error: 'Missing reminder data' }, { status: 400 });
    }

    const db = await getDb();
    const remindersCollection = db.collection<ReminderDoc>('reminders');

    const reminder: ReminderDoc = {
      userId,
      messageId,
      content,
      remindAt,
      createdAt: new Date()
    };

    const result = await remindersCollection.insertOne(reminder);

    return NextResponse.json({
      reminder: {
        id: String(result.insertedId),
        messageId,
        content,
        remindAt
      }
    });
  } catch (error) {
    console.error('Create reminder error:', error);
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}
