import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Message } from '@/types';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get('otherUserId');

    if (!userId || !otherUserId) {
      return NextResponse.json(
        { error: 'Missing user IDs' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const messagesCollection = db.collection<Message>('messages');
    const userIdMatch = ObjectId.isValid(userId)
      ? { $in: [userId, new ObjectId(userId)] }
      : userId;
    const otherIdMatch = ObjectId.isValid(otherUserId)
      ? { $in: [otherUserId, new ObjectId(otherUserId)] }
      : otherUserId;

    // Get messages between current user and other user
    const now = new Date();
    const messages = await messagesCollection
      .find({
        $and: [
          {
            $or: [
              { senderId: userIdMatch, receiverId: otherIdMatch },
              { senderId: otherIdMatch, receiverId: userIdMatch }
            ]
          },
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] }
        ]
      } as any)
      .sort({ timestamp: 1 })
      .toArray();

    // Mark received messages as read and set status to read
    await messagesCollection.updateMany(
      {
        senderId: otherIdMatch,
        receiverId: userIdMatch,
        isRead: false
      } as any,
      {
        $set: {
          isRead: true,
          status: 'read',
          readAt: new Date()
        }
      }
    );

    // Set sent messages as delivered
    await messagesCollection.updateMany(
      {
        senderId: userIdMatch,
        receiverId: otherIdMatch,
        status: { $ne: 'read' }
      } as any,
      {
        $set: {
          status: 'delivered'
        }
      }
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const slowModeSeconds = 3;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      receiverId,
      content,
      type = 'text',
      fileUrl,
      fileName,
      fileSize,
      transcript,
      expiresAt,
      expiresInSeconds,
      forwardedFrom,
      files
    } = body;

    const trimmedContent = typeof content === 'string' ? content.trim() : '';
    const hasFiles = Array.isArray(files) && files.length > 0;
    const hasAttachment = Boolean(fileUrl) || hasFiles;

    if (!receiverId || (!trimmedContent && !hasAttachment)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const messagesCollection = db.collection<Message>('messages');

    const lastMessage = await messagesCollection
      .find({ senderId: userId, receiverId })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    if (lastMessage.length > 0) {
      const lastTime = new Date(lastMessage[0].timestamp).getTime();
      const now = Date.now();
      const diff = now - lastTime;
      if (diff < slowModeSeconds * 1000) {
        const retryAfter = Math.ceil((slowModeSeconds * 1000 - diff) / 1000);
        return NextResponse.json(
          { error: 'Slow mode', retryAfter },
          { status: 429 }
        );
      }
    }

    const message: Message = {
      senderId: userId,
      receiverId,
      content: trimmedContent,
      type,
      ...(fileUrl ? { fileUrl } : {}),
      ...(fileName ? { fileName } : {}),
      ...(fileSize ? { fileSize } : {}),
      ...(Array.isArray(files) && files.length > 0 ? { files } : {}),
      ...(typeof transcript === 'string' && transcript.trim() ? { transcript: transcript.trim() } : {}),
      ...(typeof expiresInSeconds === 'number'
        ? { expiresAt: new Date(Date.now() + expiresInSeconds * 1000) }
        : typeof expiresAt === 'number'
          ? { expiresAt: new Date(expiresAt) }
          : {}),
      ...(forwardedFrom ? { forwardedFrom } : {}),
      isRead: false,
      status: 'sent',
      timestamp: new Date()
    };

    const result = await messagesCollection.insertOne(message);

    return NextResponse.json({
      message: { ...message, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
