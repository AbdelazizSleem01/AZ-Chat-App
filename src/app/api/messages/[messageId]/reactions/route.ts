import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { MessageReaction } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const body = await request.json();
    const { emoji, userId, username } = body;

    if (!messageId || !emoji || !userId || !username) {
      return NextResponse.json(
        { error: 'Message ID, emoji, user ID, and username are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const messagesCollection = db.collection('messages');

    const message = await messagesCollection.findOne({
      _id: new ObjectId(messageId)
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const reactions = (message.reactions || []) as MessageReaction[];
    const existingReactionIndex = reactions.findIndex(
      (r: MessageReaction) => r.userId === userId
    );

    let updatedReactions: MessageReaction[];

    if (existingReactionIndex !== -1) {
      if (reactions[existingReactionIndex].emoji === emoji) {
        updatedReactions = reactions.filter((r: MessageReaction) => r.userId !== userId);
      } else {
        updatedReactions = reactions.map((r: MessageReaction) =>
          r.userId === userId ? { ...r, emoji } : r
        );
      }
    } else {
      updatedReactions = [
        ...reactions,
        { emoji, userId, username }
      ];
    }

    await messagesCollection.updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { reactions: updatedReactions } }
    );

    return NextResponse.json({ 
      success: true, 
      reactions: updatedReactions 
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
      _id: new ObjectId(messageId)
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const reactions = (message.reactions || []) as MessageReaction[];
    const updatedReactions = reactions.filter((r: MessageReaction) => r.userId !== userId);

    await messagesCollection.updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { reactions: updatedReactions } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing reaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
