import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Message } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const scheduledCollection = db.collection('scheduled_messages');
    const messagesCollection = db.collection<Message>('messages');

    const now = new Date();
    const due = await scheduledCollection.find({
      senderId: userId,
      scheduledAt: { $lte: now }
    }).toArray();

    if (due.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const inserts = due.map((item) => ({
      senderId: item.senderId,
      receiverId: item.receiverId,
      content: item.content,
      type: item.type || 'text',
      ...(item.meta?.fileUrl ? { fileUrl: item.meta.fileUrl } : {}),
      ...(item.meta?.fileName ? { fileName: item.meta.fileName } : {}),
      ...(item.meta?.fileSize ? { fileSize: item.meta.fileSize } : {}),
      ...(Array.isArray(item.meta?.files) && item.meta.files.length > 0 ? { files: item.meta.files } : {}),
      isRead: false,
      status: 'sent',
      timestamp: new Date()
    }));

    await messagesCollection.insertMany(inserts as any);
    await scheduledCollection.deleteMany({ _id: { $in: due.map(d => d._id) } });

    return NextResponse.json({ sent: inserts.length });
  } catch (error) {
    console.error('Dispatch scheduled messages error:', error);
    return NextResponse.json({ error: 'Failed to dispatch' }, { status: 500 });
  }
}

