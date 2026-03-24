import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { User } from '@/types';

type StoredChatLock = {
  isLocked?: boolean;
  passcodeHash?: string;
  updatedAt?: Date;
};

type ChatLockState = {
  isLocked: boolean;
  hasPasscode: boolean;
  updatedAt?: number;
};

const getUserFilter = (userId: string) =>
  (ObjectId.isValid(userId)
    ? { _id: new ObjectId(userId) }
    : { _id: userId }) as never;

const serializeLocks = (locks?: User['chatLocks']): Record<string, ChatLockState> => {
  if (!locks || typeof locks !== 'object') return {};
  const result: Record<string, ChatLockState> = {};

  Object.entries(locks).forEach(([peerId, value]) => {
    const item = value as StoredChatLock | undefined;
    if (!peerId || !item) return;
    const hasPasscode = Boolean(item.passcodeHash);
    const updatedAt = item.updatedAt ? new Date(item.updatedAt).getTime() : undefined;
    result[peerId] = {
      isLocked: Boolean(item.isLocked && hasPasscode),
      hasPasscode,
      updatedAt
    };
  });

  return result;
};

const getLockEntry = (locks: User['chatLocks'] | undefined, peerId: string): StoredChatLock | undefined => {
  if (!locks || typeof locks !== 'object') return undefined;
  return (locks as Record<string, StoredChatLock>)[peerId];
};

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const usersCollection = db.collection<User>('users');
    const user = await usersCollection.findOne(getUserFilter(userId), {
      projection: { chatLocks: 1 }
    });

    return NextResponse.json({ locks: serializeLocks(user?.chatLocks) });
  } catch (error) {
    console.error('Get chat locks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';
    const peerId = typeof body?.peerId === 'string' ? body.peerId.trim() : '';
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
    const currentPasscode = typeof body?.currentPasscode === 'string' ? body.currentPasscode : '';
    const newPasscode = typeof body?.newPasscode === 'string' ? body.newPasscode : '';
    const lock = Boolean(body?.lock);

    if (!peerId) {
      return NextResponse.json({ error: 'peerId is required' }, { status: 400 });
    }

    const db = await getDb();
    const usersCollection = db.collection<User>('users');
    const user = await usersCollection.findOne(getUserFilter(userId), { projection: { chatLocks: 1 } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const locks: Record<string, StoredChatLock> = { ...(user.chatLocks || {}) };
    const existing = getLockEntry(locks, peerId);

    if (action === 'set') {
      if (!passcode || passcode.trim().length < 4) {
        return NextResponse.json({ error: 'Passcode must be at least 4 characters' }, { status: 400 });
      }
      locks[peerId] = {
        isLocked: true,
        passcodeHash: await bcrypt.hash(passcode.trim(), 10),
        updatedAt: new Date()
      };
    } else if (action === 'lock') {
      if (!existing?.passcodeHash) {
        return NextResponse.json({ error: 'Set passcode first' }, { status: 400 });
      }
      locks[peerId] = { ...existing, isLocked: lock, updatedAt: new Date() };
    } else if (action === 'unlock') {
      if (!existing?.passcodeHash) {
        return NextResponse.json({ error: 'No passcode set for this chat' }, { status: 400 });
      }
      const valid = await bcrypt.compare(passcode || '', existing.passcodeHash);
      if (!valid) {
        return NextResponse.json({ error: 'Wrong passcode' }, { status: 401 });
      }
      locks[peerId] = { ...existing, isLocked: false, updatedAt: new Date() };
    } else if (action === 'change') {
      if (!existing?.passcodeHash) {
        return NextResponse.json({ error: 'No passcode set for this chat' }, { status: 400 });
      }
      if (!newPasscode || newPasscode.trim().length < 4) {
        return NextResponse.json({ error: 'New passcode must be at least 4 characters' }, { status: 400 });
      }
      const valid = await bcrypt.compare(currentPasscode || '', existing.passcodeHash);
      if (!valid) {
        return NextResponse.json({ error: 'Current passcode is incorrect' }, { status: 401 });
      }
      locks[peerId] = {
        ...existing,
        passcodeHash: await bcrypt.hash(newPasscode.trim(), 10),
        updatedAt: new Date()
      };
    } else if (action === 'remove') {
      if (!existing?.passcodeHash) {
        return NextResponse.json({ error: 'No passcode set for this chat' }, { status: 400 });
      }
      const valid = await bcrypt.compare(currentPasscode || '', existing.passcodeHash);
      if (!valid) {
        return NextResponse.json({ error: 'Current passcode is incorrect' }, { status: 401 });
      }
      delete locks[peerId];
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await usersCollection.updateOne(getUserFilter(userId), { $set: { chatLocks: locks as User['chatLocks'] } });
    const serialized = serializeLocks(locks as User['chatLocks']);
    return NextResponse.json({ ok: true, locks: serialized, chatLock: serialized[peerId] || { isLocked: false, hasPasscode: false } });
  } catch (error) {
    console.error('Update chat lock error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
