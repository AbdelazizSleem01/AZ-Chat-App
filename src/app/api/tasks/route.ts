import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

type TaskDoc = {
  userId: string;
  peerId: string;
  participants: string[];
  content: string;
  status: 'pending' | 'done';
  assigneeId: string;
  creatorId: string;
  deadline?: number;
  messageId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const peerId = searchParams.get('peerId') || '';

    const db = await getDb();
    const tasksCollection = db.collection<TaskDoc>('tasks');

    const filter = peerId
      ? { participants: { $all: [userId, peerId] } }
      : { participants: userId };

    const tasks = await tasksCollection
      .find(filter)
      .sort({ status: 1, deadline: 1, createdAt: -1 })
      .toArray();

    const mapped = tasks.map(task => ({
      id: String(task._id),
      content: task.content,
      status: task.status,
      assigneeId: task.assigneeId,
      creatorId: task.creatorId,
      deadline: task.deadline,
      messageId: task.messageId,
      createdAt: task.createdAt.getTime()
    }));

    return NextResponse.json({ tasks: mapped });
  } catch (error) {
    console.error('Get tasks error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const body = await request.json();
    const peerId = typeof body?.peerId === 'string' ? body.peerId : '';
    const content = typeof body?.content === 'string' ? body.content : '';
    const assigneeId = typeof body?.assigneeId === 'string' ? body.assigneeId : userId;
    const deadline = typeof body?.deadline === 'number' ? body.deadline : undefined;
    const messageId = typeof body?.messageId === 'string' ? body.messageId : undefined;

    if (!peerId || !content.trim()) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const participants = [userId, peerId].sort();
    const validAssignee = [userId, peerId].includes(assigneeId) ? assigneeId : userId;

    const db = await getDb();
    const tasksCollection = db.collection<TaskDoc>('tasks');

    const now = new Date();
    const task: TaskDoc = {
      userId,
      peerId,
      participants,
      content: content.trim(),
      status: 'pending',
      assigneeId: validAssignee,
      creatorId: userId,
      deadline,
      messageId,
      createdAt: now,
      updatedAt: now
    };

    const result = await tasksCollection.insertOne(task);
    if (validAssignee !== userId) {
      const notificationsCollection = db.collection('notifications');
      await notificationsCollection.insertOne({
        userId: validAssignee,
        type: 'task_assigned',
        actorId: userId,
        isRead: false,
        meta: {
          taskId: String(result.insertedId),
          peerId,
          messageId,
          content: task.content
        },
        createdAt: new Date()
      });
    }

    return NextResponse.json({
      task: {
        id: String(result.insertedId),
        content: task.content,
        status: task.status,
        assigneeId: task.assigneeId,
        creatorId: task.creatorId,
        deadline: task.deadline,
        messageId: task.messageId,
        createdAt: task.createdAt.getTime()
      }
    });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
