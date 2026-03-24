import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!messageId || !userId) {
      return NextResponse.json(
        { error: 'Message ID and user ID are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const messagesCollection = db.collection('messages');

    const message = await messagesCollection.findOne({
      _id: new ObjectId(messageId),
      senderId: userId
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found or unauthorized' },
        { status: 404 }
      );
    }

    await messagesCollection.updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          content: 'This message was deleted'
        }
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { messageId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const messagesCollection = db.collection('messages');

    const existing = await messagesCollection.findOne({
      _id: new ObjectId(messageId),
      senderId: userId
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Message not found or unauthorized' },
        { status: 404 }
      );
    }

    if (existing.content === content) {
      return NextResponse.json({ success: true });
    }

    const now = new Date();
    await messagesCollection.updateOne(
      { _id: new ObjectId(messageId), senderId: userId },
      {
        $set: { content, editedAt: now, isRead: false, status: 'sent', readAt: null },
        $push: { editHistory: { content: existing.content, editedAt: now } } as any
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error editing message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
