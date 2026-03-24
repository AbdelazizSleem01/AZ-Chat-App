import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Message } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      senderId, 
      receiverId, 
      content, 
      type, 
      replyTo 
    } = body;

    if (!senderId || !receiverId || !content) {
      return NextResponse.json(
        { error: 'Sender ID, receiver ID, and content are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const messagesCollection = db.collection<Message>('messages');

    if (replyTo) {
      const repliedMessage = await messagesCollection.findOne({
        _id: new ObjectId(replyTo.messageId) as any
      });

      if (!repliedMessage) {
        return NextResponse.json(
          { error: 'Replied message not found' },
          { status: 404 }
        );
      }
    }

    const message: Message = {
      senderId,
      receiverId,
      content,
      type: type || 'text',
      isRead: false,
      timestamp: new Date(),
      status: 'sent',
      replyTo: replyTo || null
    };

    const result = await messagesCollection.insertOne(message);

    return NextResponse.json({
      message: {
        ...message,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Error sending reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
