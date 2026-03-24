import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { WebRTCSignal } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, callId, senderId, receiverId, data }: WebRTCSignal = body;

    if (!type || !callId || !senderId || !receiverId || !data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const signalsCollection = db.collection<WebRTCSignal>('webrtc_signals');

    const signal: WebRTCSignal = {
      type,
      callId,
      senderId,
      receiverId,
      data,
      timestamp: new Date()
    };

    const result = await signalsCollection.insertOne(signal);

    return NextResponse.json({
      message: 'Signal stored',
      signalId: result.insertedId
    });
  } catch (error) {
    console.error('WebRTC signal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');
    const userId = searchParams.get('userId');

    if (!callId || !userId) {
      return NextResponse.json(
        { error: 'Missing call ID or user ID' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const signalsCollection = db.collection<WebRTCSignal>('webrtc_signals');

    // Get all signals for this call directed to this user
    const signals = await signalsCollection
      .find({
        callId,
        receiverId: userId
      })
      .sort({ timestamp: 1 })
      .toArray();

    // Optionally delete retrieved signals
    await signalsCollection.deleteMany({
      callId,
      receiverId: userId
    });

    return NextResponse.json({ signals });
  } catch (error) {
    console.error('Get WebRTC signals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}