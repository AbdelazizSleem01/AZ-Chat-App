import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const { taskId } = await params;
    if (!taskId || !ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body?.content === 'string') updates.content = body.content.trim();
    if (body?.status === 'pending' || body?.status === 'done') updates.status = body.status;
    if (typeof body?.assigneeId === 'string') updates.assigneeId = body.assigneeId;
    if (typeof body?.deadline === 'number') updates.deadline = body.deadline;
    if (body?.deadline === null) updates.deadline = undefined;
    if (typeof body?.messageId === 'string') updates.messageId = body.messageId;

    updates.updatedAt = new Date();

    const db = await getDb();
    const tasksCollection = db.collection('tasks');

    const existing = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
    if (!existing || !existing.participants?.includes(userId)) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await tasksCollection.updateOne({ _id: new ObjectId(taskId) }, { $set: updates });

    if (typeof updates.assigneeId === 'string' && updates.assigneeId !== existing.assigneeId && updates.assigneeId !== userId) {
      const notificationsCollection = db.collection('notifications');
      await notificationsCollection.insertOne({
        userId: updates.assigneeId,
        type: 'task_assigned',
        actorId: userId,
        isRead: false,
        meta: {
          taskId,
          peerId: existing.peerId,
          messageId: (updates.messageId as string | undefined) ?? existing.messageId,
          content: (updates.content as string | undefined) ?? existing.content
        },
        createdAt: new Date()
      });
    }

    const updated = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      task: {
        id: String(updated._id),
        content: updated.content,
        status: updated.status,
        assigneeId: updated.assigneeId,
        creatorId: updated.creatorId,
        deadline: updated.deadline,
        messageId: updated.messageId,
        createdAt: updated.createdAt ? new Date(updated.createdAt).getTime() : undefined
      }
    });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const { taskId } = await params;
    if (!taskId || !ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }

    const db = await getDb();
    const tasksCollection = db.collection('tasks');

    await tasksCollection.deleteOne({ _id: new ObjectId(taskId), participants: userId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

