import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Call, Message } from '@/types';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { callId } = await params;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDb();
    const callsCollection = db.collection<Call>('calls');

    const call = await callsCollection.findOne({ _id: new ObjectId(callId) });

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ call });
  } catch (error) {
    console.error('Get call error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id');
    const { callId } = await params;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Missing status' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const callsCollection = db.collection<Call>('calls');
    const messagesCollection = db.collection<Message>('messages');

    const call = await callsCollection.findOne({ _id: new ObjectId(callId) });
    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    const updateData: Partial<Call> = { status };

    if (status === 'accepted') {
      updateData.startTime = new Date();
    } else if (status === 'ended' || status === 'rejected') {
      updateData.endTime = new Date();

      if (call.startTime) {
        const duration = Math.floor(
          (new Date().getTime() - new Date(call.startTime).getTime()) / 1000
        );
        updateData.duration = duration;
      }
    }

    const result = await callsCollection.updateOne(
      { _id: new ObjectId(callId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    if (status === 'ended' || status === 'rejected') {
      const callIdStr = String(call._id ?? callId);
      const existingLog = await messagesCollection.findOne({ callId: callIdStr });

      if (!existingLog) {
        const isVideo = call.type === 'video';
        const duration = updateData.duration ?? call.duration ?? 0;
        const formatDuration = (seconds: number) => {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

        const phone = '\u{1F4DE}';
        let content: string;
        if (status === 'rejected') {
          content = `${phone} ${isVideo ? 'Video' : 'Voice'} call declined`;
        } else if (!call.startTime) {
          content = `${phone} Missed ${isVideo ? 'video' : 'voice'} call`;
        } else {
          content = `${phone} ${isVideo ? 'Video' : 'Voice'} call \u2022 ${formatDuration(duration)}`;
        }

        const message: Message = {
          senderId: call.callerId,
          receiverId: call.receiverId,
          content,
          type: 'text',
          callId: callIdStr,
          isRead: false,
          status: 'sent',
          timestamp: new Date()
        };

        const insert = await messagesCollection.insertOne(message);
        await callsCollection.updateOne(
          { _id: new ObjectId(callId) },
          { $set: { logMessageId: insert.insertedId, logMessageAt: new Date() } }
        );
      }
    }

    return NextResponse.json({ message: 'Call updated' });
  } catch (error) {
    console.error('Update call error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
