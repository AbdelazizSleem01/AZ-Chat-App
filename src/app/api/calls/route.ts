import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Call, CreateCallRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { receiverId, type }: CreateCallRequest = body;

    if (!receiverId || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const callsCollection = db.collection<Call>('calls');

    const call: Call = {
      callerId: userId,
      receiverId,
      type,
      status: 'initiated',
      createdAt: new Date()
    };

    const result = await callsCollection.insertOne(call);

    return NextResponse.json({
      call: { ...call, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Create call error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await getDb();
    const callsCollection = db.collection<Call>('calls');

    // Get calls where user is either caller or receiver
    const calls = await callsCollection
      .find({
        $or: [
          { callerId: userId },
          { receiverId: userId }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ calls });
  } catch (error) {
    console.error('Get calls error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}