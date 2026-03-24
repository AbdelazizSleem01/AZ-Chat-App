import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { Group } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, avatar, createdBy, members } = body;

    if (!name || !createdBy) {
      return NextResponse.json(
        { error: 'Name and creator are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const groupsCollection = db.collection<Group>('groups');

    const group: Group = {
      name,
      description,
      avatar,
      createdBy: new ObjectId(createdBy),
      members: [new ObjectId(createdBy), ...members.map((id: string) => new ObjectId(id))],
      admins: [new ObjectId(createdBy)],
      createdAt: new Date()
    };

    const result = await groupsCollection.insertOne(group);

    return NextResponse.json({
      group: {
        ...group,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const groupsCollection = db.collection<Group>('groups');

    const groups = await groupsCollection
      .find({ members: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}